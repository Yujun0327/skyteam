// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { OnlineSession, SoloSession } from '../src/app/session.svelte'
import { legalMoves, publicHash } from '../src/engine'
import type { Move } from '../src/engine'
import { Mesh } from './mesh'
import { randomPolicy } from './helpers'

const ROOM = 'TESTROOM'

function addPeer(mesh: Mesh, i: number, creator = false): OnlineSession {
  const transport = mesh.createPeer(`peer-${i}`)
  const s = new OnlineSession(ROOM, creator, { key: `key-${i}`, name: `P${i}` }, transport)
  mesh.announce(`peer-${i}`)
  return s
}

function pair(mesh: Mesh, scenarioId = 'yul-green'): [OnlineSession, OnlineSession] {
  const host = addPeer(mesh, 0, true)
  mesh.flush()
  const guest = addPeer(mesh, 1)
  mesh.flush()
  host.setPick({ scenarioId })
  mesh.flush()
  host.startGame()
  mesh.flush()
  return [host, guest]
}

function actor(sessions: OnlineSession[]): OnlineSession {
  return sessions.find((s) => s.myTurn)!
}

function drive(sessions: OnlineSession[], mesh: Mesh, n: number, policy: (s: OnlineSession) => Move) {
  for (let i = 0; i < n; i++) {
    const a = actor(sessions)
    if (!a) break
    a.submit(policy(a))
    mesh.flush()
  }
}

const random = randomPolicy(3)
const pick = (s: OnlineSession) => random(s.state)
const first = (s: OnlineSession): Move => legalMoves(s.state, s.actor)[0]

beforeEach(() => localStorage.clear())

describe('pairing', () => {
  it('host creates the game from its pick and the guest adopts the other seat', () => {
    const mesh = new Mesh()
    const [host, guest] = pair(mesh, 'hnd-green')
    expect(host.playing && guest.playing).toBe(true)
    expect(guest.cfg.scenarioId).toBe('hnd-green')
    expect(host.seat).not.toBe(guest.seat)
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
    expect(guest.pick.scenarioId).toBe('hnd-green')
  })

  it('a third client sees room-full', () => {
    const mesh = new Mesh()
    pair(mesh)
    const third = addPeer(mesh, 2)
    mesh.flush()
    expect(third.status).toBe('room-full')
  })

  it('the guest cannot start', () => {
    const mesh = new Mesh()
    const host = addPeer(mesh, 0, true)
    mesh.flush()
    const guest = addPeer(mesh, 1)
    mesh.flush()
    expect(guest.canStart).toBe(false)
    expect(host.canStart).toBe(true)
  })
})

describe('play', () => {
  it('moves converge with identical hashes; only the seat to act may submit', () => {
    const mesh = new Mesh()
    const [host, guest] = pair(mesh)
    const idle = [host, guest].find((s) => !s.myTurn)!
    expect(() => idle.submit({ type: 'brief' })).toThrow()
    drive([host, guest], mesh, 30, pick)
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
    expect(host.state.round >= 2 || host.state.result !== null).toBe(true)
  })

  it('the reroll handshake crosses the wire', () => {
    const mesh = new Mesh()
    const [host, guest] = pair(mesh)
    const both = [host, guest]
    drive(both, mesh, 3, first) // brief, roll, roll
    const a = actor(both)
    expect(a.state.phase).toBe('placing')
    a.submit({ type: 'spendReroll', mask: [true, false, false, false] })
    mesh.flush()
    const b = actor(both)
    expect(b).not.toBe(a)
    expect(b.state.phase).toBe('awaitReroll')
    b.submit({ type: 'rerollPick', mask: [false, true, false, false] })
    mesh.flush()
    expect(actor(both)).toBe(a)
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
  })

  it('a dropped beacon is repaired by the next one', () => {
    const mesh = new Mesh()
    const [host, guest] = pair(mesh)
    let dropped = 0
    mesh.filter = () => (dropped++ % 3 !== 1)
    drive([host, guest], mesh, 20, pick)
    mesh.filter = () => true
    // a heartbeat from each side repairs any gap
    for (const s of [host, guest]) s.rescan()
    mesh.flush()
    for (const s of [host, guest]) s.rescan()
    mesh.flush()
    expect(publicHash(host.state)).toBe(publicHash(guest.state))
  })

  it('refreshing restores the game and the seat from storage', () => {
    const mesh = new Mesh()
    const [host, guest] = pair(mesh)
    drive([host, guest], mesh, 12, pick)
    const hash = publicHash(guest.state)
    const seat = guest.seat
    guest.destroy()
    mesh.drop('peer-1')
    const again = addPeer(mesh, 1)
    expect(again.playing).toBe(true)
    expect(again.seat).toBe(seat)
    expect(publicHash(again.state)).toBe(hash)
    mesh.flush()
    drive([host, again], mesh, 6, pick)
    expect(publicHash(host.state)).toBe(publicHash(again.state))
  })

  it('chat merges idempotently and closes during the sterile cockpit', () => {
    const mesh = new Mesh()
    const [host, guest] = pair(mesh)
    expect(host.chatOpen).toBe(true)
    host.say('Axis first')
    mesh.flush()
    mesh.flush()
    expect(guest.chat.map((l) => l.text)).toEqual(['Axis first'])
    host.rescan()
    mesh.flush()
    expect(guest.chat).toHaveLength(1)
    drive([host, guest], mesh, 3, first)
    expect(host.state.phase).toBe('placing')
    expect(host.chatOpen).toBe(false)
    host.say('cheating')
    expect(host.chat).toHaveLength(1)
  })

  it('rematch starts a new game on the same scenario with seats swapped', () => {
    const mesh = new Mesh()
    const [host, guest] = pair(mesh)
    const hostSeat = host.seat
    ;(host as unknown as { state: { result: unknown } }).state = { ...host.state, result: { outcome: 'crashed', reason: 'spin', round: 1 } }
    host.requestRematch()
    mesh.flush()
    expect(host.state.result).toBeNull()
    expect(host.seat).toBe(hostSeat === 0 ? 1 : 0)
    expect(guest.seat).toBe(hostSeat)
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
