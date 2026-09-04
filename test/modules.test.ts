import { describe, expect, it } from 'vitest'
import { legalMoves, windModifier } from '../src/engine'
import { newGame, place, placing, quietRound, step } from './helpers'

describe('traffic die', () => {
  it('adds planes ahead at the first roll of a round spent on a traffic space', () => {
    let s = newGame('lhr-green', 3) // LHR: 1 traffic icon on the clouds
    const before = s.planes.reduce((a, b) => a + b, 0)
    s = step(s, { type: 'brief' })
    s = step(s, { type: 'roll' })
    expect(s.planes.reduce((a, b) => a + b, 0)).toBe(before + 1)
    expect(s.planeSupply).toBe(12 - before - 1)
    s = step(s, { type: 'roll' })
    expect(s.planes.reduce((a, b) => a + b, 0)).toBe(before + 1)
  })

  it('never rolls without the module', () => {
    let s = newGame('yul-green', 3)
    const before = [...s.planes]
    s = placing(s)
    expect(s.planes).toEqual(before)
  })
})

describe('turns', () => {
  it('forbids leaving a corridor space with the axis outside the permitted set', () => {
    // HND green space 3 permits {-1, 0}; put the plane there with axis +1 and advance 1
    let s = newGame('hnd-green', 5)
    s = { ...s, position: 3, axis: 1, planes: s.planes.map(() => 0) }
    s = placing(s, [[3, 3, 2, 4], [3, 3, 2, 1]])
    s = place(s, 0, 'axis.0')
    s = place(s, 0, 'axis.1')
    s = place(s, 1, 'engine.0')
    s = place(s, 1, 'engine.1')
    expect(s.result?.reason).toBe('offCorridor')
  })
  it('a zero advance is never checked', () => {
    let s = newGame('hnd-green', 5)
    s = { ...s, position: 3, axis: 1, planes: s.planes.map(() => 0) }
    s = placing(s, [[2, 2, 2, 4], [2, 2, 2, 1]])
    s = quietRound(s)
    expect(s.result).toBeNull()
  })
})

describe('kerosene', () => {
  it('burns the die value, or 6 when no die was placed', () => {
    let s = placing(newGame('osl-green', 2), [[3, 2, 2, 4], [3, 2, 2, 1]])
    expect(s.kerosene).toBe(20)
    s = place(s, 3, 'kerosene')
    expect(s.kerosene).toBe(16)
    s = quietRound(s)
    expect(s.round).toBe(2)
    expect(s.kerosene).toBe(16)
    s = quietRound(placing(s, [[3, 2, 2, 4], [3, 2, 2, 1]]))
    expect(s.result).toBeNull()
    expect(s.kerosene).toBe(10)
  })
  it('loses below zero', () => {
    let s = placing({ ...newGame('osl-green', 2), kerosene: 3 }, [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = place(s, 3, 'kerosene')
    expect(s.result?.reason).toBe('kerosene')
  })
  it('leak burns |e1 - e2| + 1 on the engines', () => {
    let s = placing(newGame('prg-yellow', 2), [[6, 5, 2, 4], [3, 5, 2, 1]])
    expect(legalMoves(s, 0).some((m) => m.type === 'place' && m.slot === 'kerosene')).toBe(false)
    s = place(s, 1, 'axis.0')
    s = place(s, 1, 'axis.1')
    s = place(s, 0, 'engine.0')
    s = place(s, 0, 'engine.1')
    expect(s.kerosene).toBe(20 - 4)
  })
})

describe('wind', () => {
  it('table matches BGA', () => {
    expect(windModifier(10, false)).toBe(3)
    expect(windModifier(5, false)).toBe(0)
    expect(windModifier(15, false)).toBe(0)
    expect(windModifier(0, false)).toBe(-3)
    expect(windModifier(16, false)).toBe(-1)
    expect(windModifier(10, true)).toBe(-3)
  })
  it('rotates the ring by the axis after the axis resolves and adds to speed', () => {
    let s = placing(newGame('gig-yellow', 2), [[2, 2, 2, 4], [4, 2, 2, 1]])
    s = place(s, 0, 'axis.0')
    s = place(s, 0, 'axis.1') // axis +2 -> ring 12 -> +2
    expect(s.wind).toBe(12)
    s = place(s, 1, 'engine.0')
    s = place(s, 1, 'engine.1') // 4 + 2 = 6 -> advance 1
    expect(s.speed).toBe(6)
    expect(s.position).toBe(2)
  })
})

describe('intern', () => {
  it('trains with a die of a different value and places the token this turn', () => {
    let s = placing(newGame('atl-green', 4), [[3, 5, 2, 4], [3, 5, 2, 1]])
    const next = s.internBoard[0]
    const die = s.dice[0].findIndex((v) => v !== next)
    s = place(s, die, 'intern.0')
    expect(s.token[0]).toBe(next)
    expect(s.seatToAct).toBe(0)
    const moves = legalMoves(s, 0)
    expect(moves.every((m) => (m.type === 'place' || m.type === 'discard') && m.die.kind === 'token')).toBe(true)
    expect(moves.some((m) => m.type === 'place' && m.slot.startsWith('conc'))).toBe(false)
    s = step(s, { type: 'place', die: { kind: 'token' }, slot: 'axis.0', coffee: 0 })
    expect(s.slots['axis.0'].kind).toBe('token')
    expect(s.seatToAct).toBe(1)
  })
  it('rejects a die equal to the next token', () => {
    const s = placing(newGame('atl-green', 4), [[1, 2, 3, 4], [3, 5, 2, 1]])
    expect(() => place(s, s.internBoard[0] - 1, 'intern.0')).toThrow(/equals/)
  })
})

describe('ice brakes', () => {
  it('needs matching pairs in order and advances the marker', () => {
    let s = placing(newGame('kef-yellow', 2), [[2, 2, 3, 4], [2, 3, 2, 1]])
    expect(legalMoves(s, 0).some((m) => m.type === 'place' && m.slot.startsWith('brakes'))).toBe(false)
    s = place(s, 0, 'ice.0.0')
    expect(s.brake).toBe(0)
    s = place(s, 0, 'ice.0.1')
    expect(s.brake).toBe(2)
    s = place(s, 1, 'axis.0')
    expect(() => place(s, 1, 'ice.0.1')).toThrow()
    s = place(s, 1, 'ice.1.1')
    s = place(s, 2, 'ice.1.0')
    expect(s.brake).toBe(3)
  })
})

describe('real time', () => {
  it('timeout discards unplaced dice and loses when a mandatory slot is empty', () => {
    let s = placing(newGame('pbh-red', 2), [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = place(s, 0, 'axis.0')
    s = step(s, { type: 'timeout' })
    expect(s.result?.reason).toBe('missingMandatory')
  })
})

describe('engine loss (TER)', () => {
  it('has no engine slots, places 3 dice each, and glides one space per round', () => {
    // TER space 1 is a corridor permitting only -2/-1: tilt one tick toward the pilot
    let s = placing(newGame('ter-yellow', 2), [[3, 3, 3, 3], [2, 3, 3, 3]])
    expect(legalMoves(s, 0).some((m) => m.type === 'place' && m.slot.startsWith('engine'))).toBe(false)
    s = place(s, 0, 'axis.0')
    s = place(s, 0, 'axis.1')
    expect(s.axis).toBe(-1)
    s = place(s, 1, 'conc.0')
    s = place(s, 1, 'conc.1')
    s = place(s, 2, 'conc.2')
    s = place(s, 2, 'radio.1')
    expect(s.round).toBe(2)
    expect(s.position).toBe(2)
  })
})
