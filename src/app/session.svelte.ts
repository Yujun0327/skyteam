import { DEFAULT_SCENARIO, getScenario } from '../data'
import { REAL_TIME_SECONDS, RULES_VERSION, applyMove, createGame, ctxOf, legalMoves, other, publicHash, redact } from '../engine'
import type { AbilityId, GameConfig, GameState, Move, Seat } from '../engine'
import {
  BeaconSession,
  brokersFromEnv,
  type Beacon,
  type GameAdapter,
  type Transport,
} from '@yujun/game-net'
import { WalletSession, defaultLedger, loadIdentity, type Identity as WalletIdentity, type Ledger, type LockState, type Payout } from '@yujun/game-net/wallet'
import { APP, loadChat, recordLanding, saveChat } from './persist'

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

export interface ChatLine {
  id: string
  from: string
  name: string
  seat: Seat | null
  text: string
  ts: number
}

/** Host's lobby selection, visible to the guest before the game exists. */
export interface LobbyPick {
  scenarioId: string
  hostSeat: Seat
  abilities: AbilityId[]
}

/** Game-defined beacon payload: the host's pick and everyone's chat. */
interface Extra {
  pick: LobbyPick | null
  chat: ChatLine[]
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
    this.afterApply(before, after, move, quiet)
  }

  /** Clock, landing record, sound effects and forced responses for one transition. */
  protected afterApply(before: GameState, after: GameState, move: Move, quiet = false): void {
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

type Core = BeaconSession<GameConfig, GameState, Move>

function placeholderConfig(): GameConfig {
  return { scenarioId: DEFAULT_SCENARIO, sharedSeed: 0, names: ['Pilot', 'Co-Pilot'], abilities: [], rulesVersion: RULES_VERSION }
}

/**
 * Sky Team on the shared beacon session (see @yujun/game-net). Seats are
 * 0 = pilot, 1 = co-pilot; the host's lobby pick decides who flies which,
 * and a rematch swaps them. The pick and the chat ride in the beacon's
 * game-defined `extra` payload.
 */
function makeAdapter(host: () => OnlineSession | null): GameAdapter<GameConfig, GameState, Move> {
  return {
    app: APP,
    protocol: 3,
    rulesVersion: String(RULES_VERSION),
    minSeats: 2,
    maxSeats: 2,
    makeConfig: (players, prev) => {
      if (players.length < 2) return placeholderConfig()
      const pick = host()?.pick
      return {
        scenarioId: prev ? prev.scenarioId : (pick?.scenarioId ?? DEFAULT_SCENARIO),
        sharedSeed: seed32(),
        names: [players[0].name, players[1].name],
        abilities: prev ? prev.abilities : (pick?.abilities ?? []),
        rulesVersion: RULES_VERSION,
      }
    },
    // lobby order is host first; the pick says whether the host is the pilot
    orderSeats: (players, prev) =>
      prev ? [...players].reverse() : (host()?.pick.hostSeat ?? 0) === 0 ? players : [...players].reverse(),
    create: (cfg) => ({ state: createGame(cfg) }),
    apply: applyMove,
    hash: publicHash,
    actor: (s) => s.seatToAct,
    isOver: (s) => s.result !== null,
    winners: (s) => (s.result?.outcome === 'landed' ? [0, 1] : []),
  }
}

export interface OnlineTestHooks {
  ledger?: Ledger
  identity?: WalletIdentity
  transport?: Transport<Beacon<GameConfig, Move>>
  now?: () => number
  timers?: boolean
}

export class OnlineSession extends BaseSession {
  readonly mode = 'online'
  readonly room: string
  readonly clientId: string
  scanCount = $state(0)
  chat = $state<ChatLine[]>([])
  /** Host's lobby selection; mirrored on the guest. */
  pick = $state<LobbyPick>({ scenarioId: DEFAULT_SCENARIO, hostSeat: 0, abilities: [] })

  private readonly core: Core
  private wallet: WalletSession<GameConfig, GameState, Move, undefined> | null = null
  /** Reactive revision (see toybattle history): `playing` must track something while false. */
  private rev = $state(0)
  private gameId = ''
  private seenLog = 0
  private prev: GameState
  private chatSeq = 0

  constructor(room: string, creator: boolean, me: Identity, test: OnlineTestHooks = {}) {
    const self: { s: OnlineSession | null } = { s: null }
    const core: Core = new BeaconSession(makeAdapter(() => self.s), {
      room,
      creator,
      identity: { key: me.key, name: me.name || (creator ? 'Captain' : 'First Officer') },
      transport: test.transport,
      brokers: test.transport ? undefined : brokersFromEnv(import.meta.env as Record<string, string | undefined>),
      now: test.now,
      timers: test.timers,
      log: (t) => console.log(`[${APP}] ${t}`),
    })
    super(core.cfg ?? placeholderConfig())
    self.s = this
    this.core = core
    this.room = core.room
    this.clientId = core.myKey
    this.state = core.state
    this.prev = core.state
    this.seenLog = core.logLength
    this.gameId = core.snapshot?.gameId ?? ''
    this.chat = loadChat(this.room)
    if (core.snapshot) {
      this.pick = { scenarioId: core.snapshot.cfg.scenarioId, hostSeat: (core.snapshot.seats[core.myKey] ?? 0) as Seat, abilities: core.snapshot.cfg.abilities }
    }
    core.subscribe(() => this.sync())
    // the platform wallet: locks stakes, signs and posts settlements, reports payouts
    const ledger = test.ledger ?? (test.transport ? null : defaultLedger())
    if (ledger) {
      this.wallet = new WalletSession(core, APP, test.identity ?? loadIdentity(), ledger, test.now)
      this.wallet.subscribe(() => this.rev++)
    }
    core.setReady(true) // Sky Team has no ready ritual: the host presses start
    this.announce()
    if (core.started) queueMicrotask(() => this.autoRespond())
  }

  private get c(): Core {
    void this.rev
    return this.core
  }

  private announce(): void {
    this.core.setExtra({ pick: this.core.isHost ? $state.snapshot(this.pick) : null, chat: $state.snapshot(this.chat) } satisfies Extra)
  }

  private sync(): void {
    const core = this.core
    if (core.snapshot && core.snapshot.gameId !== this.gameId) {
      this.gameId = core.snapshot.gameId
      this.seenLog = 0
      this.cfg = core.snapshot.cfg
      this.prev = createGame(core.snapshot.cfg)
      this.clockDeadline = null
    }
    this.state = core.state
    const log = core.snapshot?.log ?? []
    const fresh = log.length - this.seenLog
    if (fresh > 0) {
      let st = this.prev
      for (const wire of log.slice(this.seenLog)) {
        const next = applyMove(st, wire.actor as Seat, wire.move)
        this.afterApply(st, next, wire.move, fresh > 2)
        st = next
      }
      if (fresh > 2) queueMicrotask(() => this.autoRespond())
    }
    this.seenLog = log.length
    this.prev = core.state

    // game-defined payloads from peers: the host's pick, everyone's chat
    for (const p of core.livePeers) {
      const extra = p.extra as Extra | undefined
      if (!extra) continue
      if (extra.pick && !core.started && !core.isHost && p.key === core.hostKey) this.pick = extra.pick
      this.mergeChat(extra.chat)
    }
    this.rev++
  }

  /* ---------------- base overrides ---------------- */

  get seat(): Seat {
    return (this.c.seat ?? 0) as Seat
  }

  get mySeat(): Seat {
    return this.seat
  }

  get viewer(): Seat {
    return this.seat
  }

  get spectator(): boolean {
    return this.c.spectator
  }

  get myTurn(): boolean {
    return this.c.seat !== null && !this.state.result && this.actor === this.seat
  }

  get playing(): boolean {
    const c = this.c
    return c.started && !c.spectator && c.status !== 'desync' && c.status !== 'version-mismatch'
  }

  get isHost(): boolean {
    return this.c.isHost
  }

  get names(): [string, string] {
    return this.cfg.names
  }

  /* ---------------- presence & status ---------------- */

  private get partnerKey(): string | null {
    const c = this.core
    const seats = c.snapshot?.seats
    if (seats) return Object.keys(seats).find((k) => k !== c.myKey) ?? null
    return c.livePeers[0]?.key ?? null
  }

  get peerHere(): boolean {
    const c = this.c
    const k = this.partnerKey
    return k !== null && c.presence(k)
  }

  get partnerName(): string {
    const k = this.partnerKey
    return k ? this.c.nameOf(k) : ''
  }

  get status(): OnlineStatus {
    const c = this.c
    if (c.status === 'version-mismatch' || c.status === 'room-full' || c.status === 'desync') return c.status
    if (c.spectator) return 'room-full' // a two-seat cockpit has no jump seat
    if (c.started) return this.peerHere ? 'playing' : 'peer-left'
    return this.peerHere ? 'handshake' : 'connecting'
  }

  get rematchWanted(): boolean {
    return this.c.wantRematch
  }

  /** Talking is allowed only during the briefing and after the landing. */
  get chatOpen(): boolean {
    return !this.c.started || this.state.phase === 'briefing' || this.state.phase === 'over'
  }

  rescan(): void {
    this.scanCount++
    this.core.rescan()
  }

  relayCount(): number {
    return this.c.channelCount()
  }

  brokerCount(): number {
    return this.core.channels().length
  }

  /** Host: update the lobby selection. */
  setPick(pick: Partial<LobbyPick>): void {
    if (this.core.started || !this.core.isHost) return
    this.pick = { ...this.pick, ...pick }
    this.announce()
  }

  get canStart(): boolean {
    return this.c.canStart
  }

  /** Host: create the game from the current pick. */
  startGame(): void {
    this.core.startGame()
  }

  submit(move: Move): void {
    this.core.submit(move)
  }

  say(text: string): void {
    const t = text.trim().slice(0, 200)
    if (!t || !this.chatOpen) return
    const line: ChatLine = {
      id: `${this.clientId}-${Date.now().toString(36)}-${this.chatSeq++}`,
      from: this.clientId,
      name: this.core.name,
      seat: this.core.started ? this.seat : null,
      text: t,
      ts: Date.now(),
    }
    this.chat = [...this.chat, line].slice(-40)
    saveChat(this.room, $state.snapshot(this.chat))
    this.announce()
  }

  private mergeChat(lines: ChatLine[] | undefined): void {
    if (!lines?.length) return
    const have = new Set(this.chat.map((l) => l.id))
    const fresh = lines.filter((l) => !have.has(l.id))
    if (!fresh.length) return
    this.chat = [...this.chat, ...fresh].sort((a, b) => a.ts - b.ts).slice(-40)
    saveChat(this.room, $state.snapshot(this.chat))
  }

  requestRematch(): void {
    this.core.requestRematch()
  }

  /** Test/diagnostic access to the shared core. */
  get net(): Core {
    return this.core
  }

  /** Wallet outcome of the current game (null when this build has no wallet). */
  get payout(): Payout | null {
    void this.rev
    return this.wallet?.payout ?? null
  }

  get lockState(): LockState | null {
    void this.rev
    return this.wallet?.lock ?? null
  }

  get ledger(): Ledger | null {
    return this.wallet ? (this.wallet as unknown as { ledger: Ledger }).ledger : null
  }

  leave(): void {
    this.core.leave()
  }

  destroy(): void {
    this.wallet?.destroy()
    this.core.destroy()
  }

  /** Real-time module: the turn holder's clock submits the timeout. */
  protected autoRespond(): void {}

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
}
