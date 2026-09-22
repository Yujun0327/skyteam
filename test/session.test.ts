// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { Mesh } from '@yujun/game-net/mesh'
import { OnlineSession, SoloSession } from '../src/app/session.svelte'
import { legalMoves, publicHash } from '../src/engine'
import type { GameState, Move } from '../src/engine'
import { randomPolicy } from './helpers'

const ROOM = 'TESTROOM'
let clock = 1_000_000
const now = () => clock

/** Deterministic room: an in-memory broadcast mesh plus a manual clock. */
class World {
  mesh = new Mesh<never>()
  sessions: OnlineSession[] = []

  add(i: number, creator = false): OnlineSession {
    const s = new OnlineSession(
      ROOM,
      creator,
      { key: `key-${i}`, name: `P${i}` },
      { transport: this.mesh.peer(`peer-${i}`), now, timers: false },
    )
    this.sessions.push(s)
    return s
  }

  second(times = 1): void {
    for (let i = 0; i < times; i++) {
      clock += 1000
      for (const s of this.sessions) s.net.tick()
      this.mesh.flush()
    }
  }

  flush(): void {
    this.mesh.flush()
  }

  remove(s: OnlineSession): void {
    s.destroy()
    this.sessions = this.sessions.filter((x) => x !== s)
  }

  pair(scenarioId = 'yul-green'): [OnlineSession, OnlineSession] {
    const host = this.add(0, true)
    const guest = this.add(1)
    this.second(2)
    host.setPick({ scenarioId })
    this.flush()
    host.startGame()
    this.flush()
    return [host, guest]
  }
}

function actor(sessions: OnlineSession[]): OnlineSession {
  return sessions.find((s) => s.myTurn)!
}

function drive(w: World, n: number, policy: (s: OnlineSession) => Move) {
  for (let i = 0; i < n; i++) {
    const a = actor(w.sessions)
    if (!a) break
    a.submit(policy(a))
    w.flush()
  }
}

const random = randomPolicy(3)
const pick = (s: OnlineSession) => random(s.state)
const first = (s: OnlineSession): Move => legalMoves(s.state, s.actor)[0]

beforeEach(() => {
  localStorage.clear()
  clock = 1_000_000
})

describe('pairing', () => {
  it('host creates the game from its pick and the guest adopts the other seat', () => {
    const w = new World()
    const [host, guest] = w.pair('hnd-green')
    expect(host.playing && guest.playing).toBe(true)
    expect(guest.cfg.scenarioId).toBe('hnd-green')
    expect(host.seat).not.toBe(guest.seat)
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
    expect(guest.pick.scenarioId).toBe('hnd-green')
  })

  it("the host's seat choice decides who flies as pilot", () => {
    const w = new World()
    const host = w.add(0, true)
    const guest = w.add(1)
    w.second(2)
    host.setPick({ hostSeat: 1 })
    w.flush()
    expect(guest.pick.hostSeat).toBe(1) // mirrored on the guest
    host.startGame()
    w.flush()
    expect(host.seat).toBe(1)
    expect(guest.seat).toBe(0)
    expect(host.names).toEqual(['P1', 'P0'])
  })

  it('a third client sees room-full', () => {
    const w = new World()
    w.pair()
    const third = w.add(2)
    w.second(2)
    expect(third.status).toBe('room-full')
  })

  it('the guest cannot start', () => {
    const w = new World()
    const host = w.add(0, true)
    const guest = w.add(1)
    w.second(2)
    expect(guest.canStart).toBe(false)
    expect(host.canStart).toBe(true)
    expect(host.peerHere && guest.peerHere).toBe(true)
    expect(guest.partnerName).toBe('P0')
  })
})

describe('play', () => {
  it('moves converge with identical hashes; only the seat to act may submit', () => {
    const w = new World()
    const [host, guest] = w.pair()
    const idle = [host, guest].find((s) => !s.myTurn)!
    expect(() => idle.submit({ type: 'brief' })).toThrow()
    drive(w, 30, pick)
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
    expect(host.state.round >= 2 || host.state.result !== null).toBe(true)
  })

  it('the reroll handshake crosses the wire', () => {
    const w = new World()
    const [host, guest] = w.pair()
    const both = [host, guest]
    drive(w, 3, first) // brief, roll, roll
    const a = actor(both)
    expect(a.state.phase).toBe('placing')
    a.submit({ type: 'spendReroll', mask: [true, false, false, false] })
    w.flush()
    const b = actor(both)
    expect(b).not.toBe(a)
    expect(b.state.phase).toBe('awaitReroll')
    b.submit({ type: 'rerollPick', mask: [false, true, false, false] })
    w.flush()
    expect(actor(both)).toBe(a)
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
  })

  it('dropped beacons are repaired by the next ones', () => {
    const w = new World()
    const [host, guest] = w.pair()
    let dropped = 0
    w.mesh.filter = () => dropped++ % 3 !== 1
    for (let i = 0; i < 20; i++) {
      const a = actor(w.sessions)
      if (a) a.submit(pick(a))
      w.second()
    }
    w.mesh.filter = () => true
    w.second(3)
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
    expect(host.status).toBe('playing')
  })

  it('refreshing restores the game and the seat from storage', () => {
    const w = new World()
    const [host, guest] = w.pair()
    drive(w, 12, pick)
    const hash = publicHash(guest.state)
    const seat = guest.seat
    w.remove(guest)
    const again = w.add(1)
    expect(again.playing).toBe(true)
    expect(again.seat).toBe(seat)
    expect(publicHash(again.state)).toBe(hash)
    w.second()
    drive(w, 6, pick)
    expect(publicHash(host.state)).toBe(publicHash(again.state))
  })

  it('chat merges idempotently and closes during the sterile cockpit', () => {
    const w = new World()
    const [host, guest] = w.pair()
    expect(host.chatOpen).toBe(true)
    host.say('Axis first')
    w.flush()
    expect(guest.chat.map((l) => l.text)).toEqual(['Axis first'])
    host.rescan()
    w.second()
    expect(guest.chat).toHaveLength(1)
    drive(w, 3, first)
    expect(host.state.phase).toBe('placing')
    expect(host.chatOpen).toBe(false)
    host.say('cheating')
    expect(host.chat).toHaveLength(1)
  })

  it('reports peer-left when the partner goes quiet', () => {
    const w = new World()
    const [host, guest] = w.pair()
    w.remove(guest)
    w.second(16)
    expect(host.status).toBe('peer-left')
    expect(host.peerHere).toBe(false)
  })

  it('rematch starts a new game on the same scenario with seats swapped', () => {
    const w = new World()
    const [host, guest] = w.pair()
    const hostSeat = host.seat
    ;(host.net as unknown as { state: GameState }).state = {
      ...host.state,
      result: { outcome: 'crashed', reason: 'spin', round: 1 },
    } as GameState
    host.requestRematch()
    w.second(2)
    expect(host.state.result).toBeNull()
    expect(host.seat).toBe(hostSeat === 0 ? 1 : 0)
    expect(guest.seat).toBe(hostSeat)
    expect(guest.cfg.scenarioId).toBe('yul-green')
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
  })
})

describe('solo', () => {
  it('auto-briefs and plays both seats', () => {
    const s = new SoloSession('yul-green', [], 5)
    s.submit({ type: 'brief' }) // manual brief also fine
    expect(s.state.phase).toBe('rolling')
    expect(s.myTurn).toBe(true)
    s.submit({ type: 'roll' })
    s.submit({ type: 'roll' })
    expect(s.state.phase).toBe('placing')
    expect(legalMoves(s.state, s.actor).length).toBeGreaterThan(0)
  })
})
