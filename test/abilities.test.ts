import { describe, expect, it } from 'vitest'
import { legalMoves } from '../src/engine'
import { newGame, place, placing, step } from './helpers'

describe('special abilities', () => {
  it('Control: equal axis dice give a coffee', () => {
    let s = placing(newGame('yul-green', 1, ['control']), [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = place(s, 0, 'axis.0')
    s = place(s, 0, 'axis.1')
    expect(s.coffee).toBe(1)
  })
  it('Mastery: equal engine dice recover a spent reroll token', () => {
    let s = placing(newGame('yul-green', 1, ['mastery']), [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = place(s, 0, 'axis.0')
    s = place(s, 0, 'axis.1')
    s = place(s, 1, 'engine.0')
    s = place(s, 1, 'engine.1')
    expect(s.rerollTokens).toBe(1) // reserve empty: nothing gained
    s = { ...s, rerollReserve: 1, slots: {}, placed: [[false, false, false, false], [false, false, false, false]] }
    s = place(s, 1, 'engine.0')
    s = place(s, 1, 'engine.1')
    expect(s.rerollTokens).toBe(2)
    expect(s.rerollReserve).toBe(0)
  })
  it('Working Together swaps one die each, once per round', () => {
    let s = placing(newGame('yul-green', 1, ['workingTogether']), [[3, 5, 2, 4], [6, 5, 2, 1]])
    s = step(s, { type: 'swap', mine: 0, theirs: 0 })
    expect(s.dice[0][0]).toBe(6)
    expect(s.dice[1][0]).toBe(3)
    expect(() => step(s, { type: 'swap', mine: 1, theirs: 1 })).toThrow()
  })
  it('Adaptation flips a die once per game per player', () => {
    let s = placing(newGame('yul-green', 1, ['adaptation']), [[3, 5, 2, 4], [6, 5, 2, 1]])
    s = step(s, { type: 'adapt', index: 1 })
    expect(s.dice[0][1]).toBe(2)
    expect(legalMoves(s, 0).some((m) => m.type === 'adapt')).toBe(false)
  })
  it('Anticipation lets the first player reroll one die before placing', () => {
    let s = placing(newGame('yul-green', 1, ['anticipation']), [[3, 5, 2, 4], [6, 5, 2, 1]])
    expect(legalMoves(s, 0).some((m) => m.type === 'anticipate')).toBe(true)
    s = step(s, { type: 'anticipate', index: 0 })
    expect(s.dice[0][0]).toBeGreaterThan(0)
    s = place(s, 0, 'axis.0')
    expect(legalMoves(s, 1).some((m) => m.type === 'anticipate')).toBe(false)
  })
  it('Synchronisation hands the Co-Pilot a traffic die once gear and flaps both hold dice', () => {
    let s = placing(newGame('yul-green', 1, ['synchronisation']), [[1, 5, 2, 4], [2, 5, 2, 1]])
    s = place(s, 0, 'gear.0')
    expect(s.extra).toBeNull()
    s = place(s, 0, 'flaps.0')
    expect(s.extra).not.toBeNull()
    expect(s.seatToAct).toBe(1)
    expect(s.resume).toBe(1)
    const moves = legalMoves(s, 1)
    expect(moves.every((m) => (m.type === 'place' || m.type === 'discard') && m.die.kind === 'extra')).toBe(true)
    expect(moves.some((m) => m.type === 'place' && m.slot === 'gear.1')).toBe(s.extra === 3 || s.extra === 4)
    s = step(s, { type: 'place', die: { kind: 'extra' }, slot: 'axis.0', coffee: 0 })
    expect(s.slots['axis.0'].kind).toBe('extra')
    expect(s.seatToAct).toBe(0)
  })
})
