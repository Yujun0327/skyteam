import { DEFAULT_SCENARIO, getScenario } from '../data'
import { REAL_TIME_SECONDS, RULES_VERSION, applyMove, createGame, ctxOf, legalMoves, other, publicHash, redact } from '../engine'
import type { AbilityId, GameConfig, GameState, Move, Seat } from '../engine'
import { PROTOCOL_VERSION } from '../transport/types'
import type { Beacon, ChatLine, GameSnapshot, LobbyPick, Transport, WireMove } from '../transport/types'
import { connectRoom } from '../transport/mqtt'
import { clearGame, loadGame, recordLanding, saveGame } from './persist'

export type SfxEvent =
  | 'roll'
  | 'place'
  | 'switch'
  | 'lever'
  | 'radio'
  | 'coffee'
  | 'axis'
  | 'advance'
  | 'brake'
  | 'reroll'
  | 'warning'
  | 'crash'
  | 'landed'
  | 'descend'

export type OnlineStatus =
  | 'connecting'
  | 'handshake'
  | 'playing'
  | 'peer-left'
  | 'desync'
  | 'room-full'
  | 'version-mismatch'

function log(text: string): void {
  console.log(`[skyteam] ${text}`)
}

function seed32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

export abstract class BaseSession {
  cfg = $state<GameConfig>() as GameConfig
  state = $state<GameState>() as GameState
  events = $state<{ id: number; sfx: SfxEvent }[]>([])
  /** wall-clock deadline of the real-time round, or null */
  clockDeadline = $state<number | null>(null)
  private eventId = 0
  private landedRecorded = false

  constructor(cfg: GameConfig) {
    this.cfg = cfg
    this.state = createGame(cfg)
  }

  abstract readonly mode: 'solo' | 'online'
  /** The seat this client plays, or null when it plays both. */
  abstract get mySeat(): Seat | null
  /** Whose hidden dice may be shown; null shows everything. */
  abstract get viewer(): Seat | null

  get scenario() {
    return getScenario(this.cfg.scenarioId)
  }

  get ctx() {
    return ctxOf(this.state)
  }

  get visibleState(): GameState {
    return redact(this.state, this.viewer)
  }

  get actor(): Seat {
    return this.state.seatToAct
  }

  get myTurn(): boolean {
    return !this.state.result && (this.mySeat === null || this.actor === this.mySeat)
  }

  myMoves(): Move[] {
    if (!this.myTurn) return []
    return legalMoves(this.state, this.actor)
  }

  protected emit(sfx: SfxEvent) {
    this.events = [...this.events.slice(-6), { id: this.eventId++, sfx }]
  }

  protected applyLocal(actor: Seat, move: Move, quiet = false): void {
    const before = this.state
    const after = applyMove(before, actor, move)
    this.state = after
    this.trackClock(before, after)
    if (after.result?.outcome === 'landed' && !this.landedRecorded) {
      this.landedRecorded = true
      try {
        recordLanding(after.scenarioId)
      } catch {
        /* no storage */
      }
    }
    if (quiet) return
    this.deriveSfx(before, after, move)
    queueMicrotask(() => this.autoRespond())
  }

  private trackClock(before: GameState, after: GameState): void {
    if (!this.ctx.has('realTime')) return
    if (before.phase !== 'placing' && after.phase === 'placing' && before.round === after.round && before.phase === 'rolling') {
      this.clockDeadline = Date.now() + REAL_TIME_SECONDS * 1000
    }
    if (after.phase === 'briefing' || after.phase === 'over') this.clockDeadline = null
  }

  private deriveSfx(before: GameState, after: GameState, move: Move): void {
    if (move.type === 'roll' || move.type === 'spendReroll' || move.type === 'rerollPick' || move.type === 'anticipate') this.emit('roll')
    if (move.type === 'spendReroll') this.emit('reroll')
    if (move.type === 'place') {
      const g = move.slot.split('.')[0]
      if (g === 'gear' || g === 'brakes' || g === 'ice') this.emit('switch')
      else if (g === 'flaps') this.emit('lever')
      else if (g === 'radio') this.emit('radio')
      else if (g === 'conc') this.emit('coffee')
      else this.emit('place')
      if (after.axis !== before.axis) this.emit('axis')
      if (after.position !== before.position) this.emit('advance')
      if (Math.abs(after.axis) === 2 && Math.abs(before.axis) < 2) this.emit('warning')
    }
    if (after.altIndex !== before.altIndex) this.emit('descend')
    if (!before.result && after.result) this.emit(after.result.outcome === 'landed' ? 'landed' : 'crash')
  }

  /** Forced moves with no human decision. */
  protected autoRespond(): void {}

  abstract submit(move: Move): void
  destroy(): void {}
}

/* ------------------------------------------------------------------ */

/** One person at the practice table plays both seats; nothing is hidden. */
export class SoloSession extends BaseSession {
  readonly mode = 'solo'

  constructor(scenarioId: string = DEFAULT_SCENARIO, abilities: AbilityId[] = [], seed = seed32()) {
    super({ scenarioId, sharedSeed: seed, names: ['Pilot', 'Co-Pilot'], abilities, rulesVersion: RULES_VERSION })
    queueMicrotask(() => this.autoRespond())
  }

  get mySeat(): null {
    return null
  }

  get viewer(): null {
    return null
  }

  submit(move: Move): void {
    this.applyLocal(this.actor, move)
  }

  protected autoRespond(): void {
    if (this.state.phase === 'briefing') this.submit({ type: 'brief' })
  }

  rematch(): SoloSession {
    return new SoloSession(this.cfg.scenarioId, this.cfg.abilities)
  }
}

/* ------------------------------------------------------------------ */

export interface Identity {
  key: string
  name: string
}

/**
 * Online play over stateless beacons (see transport/types.ts). Host election
 * is deterministic from any beacon (creator wins, clientId breaks ties); the
 * host creates the game from its lobby pick when it presses start; guests
 * adopt it idempotently; moves ride in the beacon's log.
 */
export class OnlineSession extends BaseSession {
  readonly mode = 'online'
  readonly room: string
  status = $state<OnlineStatus>('connecting')
  peerHere = $state(false)
  seat = $state<Seat>(0)
  partnerName = $state('')
  rematchWanted = $state(false)
  scanCount = $state(0)
  chat = $state<ChatLine[]>([])
  /** Host's lobby selection; mirrored on the guest. */
  pick = $state<LobbyPick>({ scenarioId: DEFAULT_SCENARIO, hostSeat: 0, abilities: [] })

  private transport: Transport
  readonly clientId: string
  private readonly creator: boolean
  private name: string
  private partnerId: string | null = null
  private partnerCreator = false
  private snapshot: GameSnapshot | null = null
  /** MUST be reactive (see toybattle history): `playing` short-circuits on it. */
  private started = $state(false)
  private lastBeaconIn = 0
  private lastBeaconOut = 0
  private chatSeq = 0
  private timers: ReturnType<typeof setInterval>[] = []
  private onVisible = () => {
    if (typeof document === 'undefined' || document.hidden) return
    this.transport.wake?.()
    this.sendBeacon()
  }

  constructor(room: string, creator: boolean, me: Identity, transport?: Transport) {
    const saved = loadGame(room, me.key)
    super(
      saved?.snapshot.cfg ?? {
        scenarioId: DEFAULT_SCENARIO,
        sharedSeed: 0,
        names: ['Pilot', 'Co-Pilot'],
        abilities: [],
        rulesVersion: RULES_VERSION,
      },
    )
    this.room = room
    this.creator = creator
    this.clientId = me.key
    this.name = me.name || (creator ? 'Captain' : 'First Officer')
    this.transport = transport ?? connectRoom(room)
    this.attach(this.transport)

    if (saved) {
      this.seat = saved.seat
      this.chat = saved.chat ?? []
      this.snapshot = { ...saved.snapshot, log: [] }
      this.pick = { scenarioId: saved.snapshot.cfg.scenarioId, hostSeat: saved.snapshot.hostSeat, abilities: saved.snapshot.cfg.abilities }
      try {
        for (const wire of saved.snapshot.log) this.applyWire(wire, true)
        this.started = true
        log(`restored game ${this.snapshot.gameId} at move ${this.snapshot.log.length}`)
        queueMicrotask(() => this.autoRespond())
      } catch (err) {
        log(`saved game unusable, starting fresh (${String(err)})`)
        this.snapshot = null
        clearGame(room, me.key)
      }
    }

    this.timers.push(setInterval(() => this.tick(), 1000))
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisible)
    log(`session up · room=${room} creator=${creator} id=${this.clientId} resumed=${this.started}`)
  }

  get mySeat(): Seat {
    return this.seat
  }

  get viewer(): Seat {
    return this.seat
  }

  get playing(): boolean {
    return this.started && this.status !== 'desync' && this.status !== 'version-mismatch'
  }

  get isHost(): boolean {
    if (this.snapshot) return this.snapshot.hostId === this.clientId
    if (this.creator !== this.partnerCreator) return this.creator
    return this.clientId < (this.partnerId ?? '~')
  }

  get names(): [string, string] {
    return this.cfg.names
  }

  /** Talking is allowed only during the briefing and after the landing. */
  get chatOpen(): boolean {
    return !this.started || this.state.phase === 'briefing' || this.state.phase === 'over'
  }

  rescan(): void {
    this.scanCount++
    this.transport.wake?.()
    this.sendBeacon()
  }

  relayCount(): number {
    return this.transport.relayCount?.() ?? 0
  }

  /** Host: update the lobby selection. */
  setPick(pick: Partial<LobbyPick>): void {
    if (this.started || !this.isHost) return
    this.pick = { ...this.pick, ...pick }
    this.sendBeacon()
  }

  get canStart(): boolean {
    return !this.started && this.isHost && this.peerHere
  }

  /** Host: create the game from the current pick. */
  startGame(): void {
    if (!this.canStart) return
    this.createNewGame(false)
  }

  submit(move: Move): void {
    if (!this.snapshot) return
    const actor = this.actor
    if (actor !== this.seat) throw new Error('not your seat')
    this.applyLocal(actor, move)
    this.snapshot.log.push({ seq: this.snapshot.log.length + 1, actor, move, hash: publicHash(this.state) })
    this.persist()
    this.sendBeacon()
  }

  say(text: string): void {
    const t = text.trim().slice(0, 200)
    if (!t || !this.chatOpen) return
    const line: ChatLine = {
      id: `${this.clientId}-${Date.now().toString(36)}-${this.chatSeq++}`,
      from: this.clientId,
      name: this.name,
      seat: this.started ? this.seat : null,
      text: t,
      ts: Date.now(),
    }
    this.chat = [...this.chat, line].slice(-40)
    this.persist()
    this.sendBeacon()
  }

  requestRematch(): void {
    this.rematchWanted = true
    if (this.isHost && this.state.result) this.createNewGame(true)
    else this.sendBeacon()
  }

  leave(): void {
    clearGame(this.room, this.clientId)
    this.destroy()
  }

  destroy(): void {
    for (const t of this.timers) clearInterval(t)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisible)
    this.transport.close()
  }

  /** Real-time module: the turn holder's clock submits the timeout. */
  protected autoRespond(): void {
    if (!this.snapshot || this.state.result) return
    if (this.state.phase === 'over') return
  }

  /** Called by the UI clock when the deadline passes. */
  expireClock(): void {
    if (!this.myTurn || !this.ctx.has('realTime')) return
    if (this.state.phase !== 'placing' && this.state.phase !== 'awaitReroll') return
    try {
      this.submit({ type: 'timeout' })
    } catch {
      /* superseded */
    }
  }

  /* ---- internals ---- */

  private attach(t: Transport): void {
    t.onMessage((msg) => this.onBeacon(msg))
    t.onPeerJoin(() => this.sendBeacon())
    t.onPeerLeave(() => {})
  }

  private tick(): void {
    const now = Date.now()
    if (this.peerHere && now - this.lastBeaconIn > 15_000) {
      this.peerHere = false
      if (this.started && this.status === 'playing') this.status = 'peer-left'
      log('partner beacons stopped')
    }
    const cadence = this.peerHere && this.snapshot ? 6_000 : 2_500
    if (now - this.lastBeaconOut >= cadence) this.sendBeacon()
  }

  private sendBeacon(): void {
    this.lastBeaconOut = Date.now()
    this.transport.send({
      t: 'sync',
      protocol: PROTOCOL_VERSION,
      room: this.room,
      clientId: this.clientId,
      creator: this.creator,
      name: this.name,
      partnerId: this.partnerId,
      wantRematch: this.rematchWanted,
      pick: this.isHost ? this.pick : null,
      chat: this.chat,
      game: this.snapshot,
    })
  }

  private onBeacon(b: Beacon): void {
    if (b.t !== 'sync' || b.room !== this.room || b.clientId === this.clientId) return
    if (b.protocol !== PROTOCOL_VERSION) {
      if (!this.started) this.status = 'version-mismatch'
      return
    }
    const sameGame = !!(this.snapshot && b.game && b.game.gameId === this.snapshot.gameId)
    if (b.partnerId && b.partnerId !== this.clientId && !sameGame) {
      if (!this.started) this.status = 'room-full'
      return
    }
    if (this.partnerId && b.clientId !== this.partnerId) {
      if (!sameGame && this.peerHere) return
      log(`partner reseated: ${this.partnerId} → ${b.clientId}`)
      this.partnerId = b.clientId
    }
    this.partnerId ??= b.clientId
    this.partnerCreator = b.creator
    this.partnerName = b.name
    this.lastBeaconIn = Date.now()
    if (!this.peerHere) {
      this.peerHere = true
      log(`partner present: ${b.clientId}`)
    }
    if (this.status === 'connecting' || this.status === 'room-full') this.status = 'handshake'
    if (this.started && this.status === 'peer-left') this.status = 'playing'

    if (b.pick && !this.isHost && !this.started) this.pick = b.pick
    this.mergeChat(b.chat)
    if (b.game) this.mergeGame(b.game)

    if (this.snapshot && this.isHost && this.state.result && (b.wantRematch || this.rematchWanted)) {
      this.createNewGame(true)
    }
    if (
      this.snapshot &&
      (!b.game || (b.game.gameId === this.snapshot.gameId && b.game.log.length < this.snapshot.log.length))
    ) {
      this.sendBeacon()
    }
  }

  private mergeChat(lines: ChatLine[] | undefined): void {
    if (!lines?.length) return
    const have = new Set(this.chat.map((l) => l.id))
    const fresh = lines.filter((l) => !have.has(l.id))
    if (!fresh.length) return
    this.chat = [...this.chat, ...fresh].sort((a, b) => a.ts - b.ts).slice(-40)
  }

  private createNewGame(rematch: boolean): void {
    const prev = this.snapshot
    const hostSeat: Seat = rematch && prev ? other(this.seat) : this.pick.hostSeat
    const cfgBase = rematch && prev ? prev.cfg : null
    const scenarioId = cfgBase?.scenarioId ?? this.pick.scenarioId
    const abilities = cfgBase?.abilities ?? this.pick.abilities
    const names: [string, string] = hostSeat === 0 ? [this.name, this.partnerName || 'First Officer'] : [this.partnerName || 'Captain', this.name]
    const snapshot: GameSnapshot = {
      gameId: `${this.room}-${seed32().toString(36)}`,
      cfg: { scenarioId, sharedSeed: seed32(), names, abilities, rulesVersion: RULES_VERSION },
      hostId: this.clientId,
      hostSeat,
      log: [],
    }
    log(`hosting game ${snapshot.gameId} on ${scenarioId}, I am seat ${hostSeat}`)
    this.adopt(snapshot, hostSeat)
  }

  private adopt(snap: GameSnapshot, seat: Seat): void {
    this.snapshot = { ...snap, log: [] }
    this.seat = seat
    this.rematchWanted = false
    this.cfg = snap.cfg
    this.state = createGame(snap.cfg)
    this.clockDeadline = null
    this.started = true
    if (this.status !== 'desync') this.status = 'playing'
    try {
      for (const wire of snap.log) this.applyWire(wire, true)
    } catch (err) {
      log(`adopt replay failed: ${String(err)}`)
      this.status = 'desync'
    }
    this.persist()
    this.sendBeacon()
    queueMicrotask(() => this.autoRespond())
  }

  private mergeGame(g: GameSnapshot): void {
    if (g.cfg.rulesVersion !== RULES_VERSION) {
      if (!this.started) this.status = 'version-mismatch'
      return
    }
    if (!this.snapshot) {
      const seat = g.hostId === this.clientId ? g.hostSeat : other(g.hostSeat)
      log(`adopting game ${g.gameId} as seat ${seat}`)
      this.adopt(g, seat)
      return
    }
    if (g.gameId !== this.snapshot.gameId) {
      if (!this.isHost) {
        log(`replacing game ${this.snapshot.gameId} with host's ${g.gameId}`)
        this.adopt(g, other(g.hostSeat))
      }
      return
    }
    const before = this.snapshot.log.length
    for (let i = this.snapshot.log.length; i < g.log.length; i++) {
      try {
        this.applyWire(g.log[i], g.log.length - before > 2)
      } catch (err) {
        log(`remote move rejected: ${String(err)}`)
        this.status = 'desync'
        return
      }
    }
    if (this.snapshot.log.length > before) {
      this.persist()
      queueMicrotask(() => this.autoRespond())
    }
  }

  private applyWire(wire: WireMove, quiet = false): void {
    if (!this.snapshot) return
    if (wire.seq !== this.snapshot.log.length + 1) throw new Error(`bad seq ${wire.seq}`)
    this.applyLocal(wire.actor, wire.move, quiet)
    if (publicHash(this.state) !== wire.hash) throw new Error(`hash mismatch at seq ${wire.seq}`)
    this.snapshot.log.push(wire)
  }

  private persist(): void {
    if (!this.snapshot) return
    saveGame(this.room, this.clientId, { snapshot: this.snapshot, seat: this.seat, chat: this.chat })
  }
}
