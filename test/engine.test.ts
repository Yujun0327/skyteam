import { describe, expect, it } from 'vitest'
import { applyMove, legalMoves, publicHash } from '../src/engine'
import { newGame, place, placing, playRound, quietRound, step } from './helpers'

// A clean round on YUL: axis level, engines 5+5 = 10 -> advance 2 from the clouds.
const QUIET: [number, string][] = [
  [0, 'axis.0'], [0, 'axis.1'], [1, 'engine.0'], [1, 'engine.1'],
  [2, 'conc.0'], [2, 'conc.1'], [3, 'radio.0'], [3, 'conc.2'],
]

describe('round flow', () => {
  it('brief -> rolls -> placing with the pilot first in round 1', () => {
    let s = newGame()
    expect(s.phase).toBe('briefing')
    expect(s.seatToAct).toBe(1)
    expect(s.rerollTokens).toBe(1)
    s = step(s, { type: 'brief' })
    expect(s.phase).toBe('rolling')
    expect(s.seatToAct).toBe(0)
    s = step(s, { type: 'roll' })
    expect(s.dice[0].every((d) => d >= 1 && d <= 6)).toBe(true)
    expect(s.seatToAct).toBe(1)
    s = step(s, { type: 'roll' })
    expect(s.phase).toBe('placing')
    expect(s.seatToAct).toBe(0)
  })

  it('rejects moves out of turn or out of phase', () => {
    const s = newGame()
    expect(() => applyMove(s, 0, { type: 'brief' })).toThrow()
    expect(() => applyMove(s, 1, { type: 'roll' })).toThrow()
  })

  it('alternates placements and ends the round after 8, descending one row', () => {
    let s = placing(newGame(), [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = playRound(s, QUIET)
    expect(s.round).toBe(2)
    expect(s.altIndex).toBe(1)
    expect(s.phase).toBe('briefing')
    expect(s.firstPlayer).toBe(1)
    expect(s.seatToAct).toBe(0)
    expect(Object.keys(s.slots)).toHaveLength(0)
    expect(s.coffee).toBe(3)
  })

  it('loses when a mandatory slot is empty at the end of the round', () => {
    let s = placing(newGame(), [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = playRound(s, [[0, 'axis.0'], [0, 'axis.1'], [1, 'conc.0'], [1, 'engine.1'], [2, 'conc.1'], [2, 'conc.2'], [3, 'radio.0'], [3, 'radio.1']])
    expect(s.result?.reason).toBe('missingMandatory')
  })
})

describe('axis', () => {
  it('tilts toward the higher die and persists', () => {
    let s = placing(newGame(), [[2, 5, 2, 4], [4, 5, 2, 1]])
    s = place(s, 0, 'axis.0')
    s = place(s, 0, 'axis.1')
    expect(s.axis).toBe(2)
    s = playRound(s, [[1, 'engine.0'], [1, 'engine.1'], [2, 'conc.0'], [2, 'conc.1'], [3, 'radio.0'], [3, 'conc.2']])
    expect(s.axis).toBe(2)
    s = placing(s, [[5, 5, 2, 4], [4, 5, 2, 1]])
    s = place(s, 0, 'axis.1')
    s = place(s, 0, 'axis.0')
    expect(s.axis).toBe(1)
  })

  it('spins at three ticks', () => {
    let s = placing(newGame(), [[1, 5, 2, 4], [4, 5, 2, 1]])
    s = place(s, 0, 'axis.0')
    s = place(s, 0, 'axis.1')
    expect(s.result?.reason).toBe('spin')
  })
})

describe('engines and the approach', () => {
  it('advances 0 / 1 / 2 by the aerodynamics markers', () => {
    const run = (a: number, b: number) => {
      let s = placing(newGame(), [[3, a, 2, 4], [3, b, 2, 1]])
      s = place(s, 0, 'axis.0')
      s = place(s, 0, 'axis.1')
      s = place(s, 1, 'engine.0')
      s = place(s, 1, 'engine.1')
      return s
    }
    expect(run(2, 2).position).toBe(1)
    expect(run(2, 3).position).toBe(2)
    expect(run(4, 4).position).toBe(2)
    expect(run(4, 5).position).toBe(3)
  })

  it('collides when leaving a space that holds a plane (pass-through included)', () => {
    let s = placing(newGame(), [[3, 5, 2, 4], [3, 5, 2, 1]])
    // YUL space 3 holds a plane; from space 1 an advance of 2 leaves space 2 (empty) and lands on 3 -> fine
    s = playRound(s, QUIET)
    expect(s.position).toBe(3)
    expect(s.result).toBeNull()
    s = placing(s, [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = place(s, 0, 'axis.1')
    s = place(s, 0, 'axis.0')
    s = place(s, 1, 'engine.1')
    s = place(s, 1, 'engine.0')
    expect(s.result?.reason).toBe('collision')
  })

  it('the radio clears a plane N spaces ahead and is a legal no-op otherwise', () => {
    let s = placing(newGame(), [[3, 5, 2, 4], [3, 5, 2, 1]])
    expect(s.planes[2]).toBe(1)
    s = place(s, 3, 'radio.0') // pilot 4 -> space 4 (2 planes)
    expect(s.planes[3]).toBe(1)
    s = place(s, 2, 'radio.1') // copilot 2 -> space 2, empty: no-op
    expect(s.planes[1]).toBe(0)
    expect(s.planeSupply).toBe(4)
  })

  it('overshoots when advancing off the airport', () => {
    let s = newGame()
    s = { ...s, position: 7, planes: s.planes.map(() => 0) }
    s = placing(s, [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = playRound(s, QUIET.slice(0, 4))
    expect(s.result?.reason).toBe('overshoot')
  })

  it('crashes short of the airport when the altitude runs out', () => {
    let s = newGame()
    s = { ...s, altIndex: 4, position: 4, planes: s.planes.map(() => 0) }
    s = quietRound(placing(s, [[2, 2, 2, 4], [2, 2, 2, 1]]))
    expect(s.altIndex).toBe(5)
    s = quietRound(placing(s, [[2, 2, 2, 4], [2, 2, 2, 1]]))
    expect(s.result?.reason).toBe('shortOfAirport')
  })
})

describe('switches', () => {
  it('landing gear in any order raises the blue marker; re-placing is a no-op', () => {
    let s = placing(newGame(), [[6, 1, 6, 4], [3, 5, 2, 1]])
    s = place(s, 0, 'gear.2')
    expect(s.gear).toEqual([false, false, true])
    expect(s.aeroBlue).toBe(5)
    s = place(s, 0, 'axis.1')
    s = place(s, 1, 'gear.0')
    expect(s.aeroBlue).toBe(6)
    // next round: the slot is free again but already green -> legal no-op
    const later = placing({ ...newGame(), gear: [false, false, true] as [boolean, boolean, boolean], aeroBlue: 5 }, [[6, 1, 6, 4], [3, 5, 2, 1]])
    expect(() => place(later, 0, 'gear.2')).not.toThrow()
    expect(place(later, 0, 'gear.2').aeroBlue).toBe(5)
  })

  it('flaps must go in order and raise the orange marker', () => {
    let s = placing(newGame(), [[3, 5, 2, 4], [2, 3, 5, 6]])
    s = place(s, 0, 'axis.0')
    expect(() => place(s, 1, 'flaps.1')).toThrow(/order/)
    s = place(s, 0, 'flaps.0')
    expect(s.aeroOrange).toBe(9)
    s = place(s, 1, 'engine.0')
    s = place(s, 1, 'flaps.1')
    expect(s.flaps).toEqual([true, true, false, false])
  })

  it('brakes need exact values in order', () => {
    let s = placing(newGame(), [[2, 4, 6, 4], [3, 5, 2, 1]])
    expect(() => place(s, 1, 'brakes.1')).toThrow()
    s = place(s, 0, 'brakes.0')
    expect(s.brake).toBe(2)
    s = place(s, 0, 'axis.1')
    s = place(s, 1, 'brakes.1')
    expect(s.brake).toBe(4)
  })
})

describe('coffee and reroll', () => {
  it('coffee shifts a die within 1..6 and can satisfy a constraint', () => {
    let s = placing(newGame(), [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = { ...s, coffee: 2 }
    s = place(s, 0, 'brakes.0', -1)
    expect(s.brake).toBe(2)
    expect(s.coffee).toBe(1)
    expect(() => place(s, 3, 'gear.0', -2)).toThrow()
    expect(() => place(s, 0, 'flaps.0', 1)).toThrow(/allowed/)
  })

  it('a spent reroll token lets both players reroll their own unplaced dice', () => {
    let s = placing(newGame(), [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = place(s, 0, 'axis.0')
    s = step(s, { type: 'place', die: { kind: 'die', index: 0 }, slot: 'axis.1', coffee: 0 })
    s = step(s, { type: 'spendReroll', mask: [false, true, true, true] })
    expect(s.rerollTokens).toBe(0)
    expect(s.phase).toBe('awaitReroll')
    expect(s.seatToAct).toBe(1)
    s = step(s, { type: 'rerollPick', mask: [false, false, false, true] })
    expect(s.phase).toBe('placing')
    expect(s.seatToAct).toBe(0)
    expect(() => step(s, { type: 'spendReroll', mask: [false, true, false, false] })).toThrow()
  })

  it('a die may be discarded only when nothing accepts it', () => {
    let s = placing(newGame(), [[3, 5, 2, 4], [3, 5, 2, 1]])
    expect(() => step(s, { type: 'discard', die: { kind: 'die', index: 0 } })).toThrow()
    s = { ...s, slots: Object.fromEntries(['axis.0', 'engine.0', 'radio.0', 'conc.0', 'conc.1', 'conc.2'].map((k) => [k, { seat: 0, value: 1, kind: 'die' }])) }
    // pilot 3: gear.1 accepts 3 -> still not discardable
    expect(() => step(s, { type: 'discard', die: { kind: 'die', index: 0 } })).toThrow()
    s = { ...s, gear: [false, true, false], dice: [[3, 3, 3, 3], [3, 5, 2, 1]] }
    expect(legalMoves(s, 0).some((m) => m.type === 'discard')).toBe(false) // gear.1 green is still a legal no-op
    s = { ...s, slots: { ...s.slots, 'gear.1': { seat: 0, value: 3, kind: 'die' } } }
    expect(legalMoves(s, 0).some((m) => m.type === 'discard')).toBe(true)
  })
})

describe('landing', () => {
  function finalState() {
    let s = newGame()
    return { ...s, altIndex: 6, final: true, position: 7, planes: s.planes.map(() => 0), gear: [true, true, true] as [boolean, boolean, boolean], flaps: [true, true, true, true] as [boolean, boolean, boolean, boolean], brake: 6, firstPlayer: 0 }
  }
  it('lands when every condition holds', () => {
    let s = placing(finalState(), [[3, 2, 2, 4], [3, 3, 2, 1]])
    s = playRound(s, QUIET)
    expect(s.result?.outcome).toBe('landed')
  })
  it('reports the failed checks', () => {
    let s = placing({ ...finalState(), brake: 4 }, [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = playRound(s, [[0, 'axis.0'], [0, 'axis.1'], [1, 'engine.0'], [1, 'engine.1'], [2, 'conc.0'], [2, 'conc.1'], [3, 'radio.0'], [3, 'conc.2']])
    expect(s.result?.outcome).toBe('crashed')
    expect(s.result?.failed).toEqual(['speed'])
  })
  it('needs speed <= brake', () => {
    let s = placing({ ...finalState(), brake: 4 }, [[3, 2, 2, 4], [3, 2, 2, 1]])
    s = playRound(s, QUIET)
    expect(s.result?.outcome).toBe('landed')
  })
})

describe('hash', () => {
  it('is stable and sensitive', () => {
    const a = newGame('yul-green', 7)
    expect(publicHash(a)).toBe(publicHash(newGame('yul-green', 7)))
    expect(publicHash(a)).not.toBe(publicHash(newGame('yul-green', 8)))
  })
})
