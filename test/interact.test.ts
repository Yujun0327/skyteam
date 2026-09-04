import { describe, expect, it } from 'vitest'
import { legalMoves } from '../src/engine'
import { coffeeOptions, legalSlots, placeMove, selectableDice, stepCoffee } from '../src/ui/interact'
import { newGame, placing } from './helpers'

describe('selection helpers', () => {
  it('derive selectable dice, coffee options and legal slots from the move list', () => {
    let s = placing(newGame(), [[3, 5, 2, 4], [3, 5, 2, 1]])
    s = { ...s, coffee: 1 }
    const moves = legalMoves(s, 0)
    expect(selectableDice(moves)).toHaveLength(4)
    const die = { kind: 'die' as const, index: 0 }
    expect(coffeeOptions(moves, die)).toEqual([-1, 0, 1])
    expect(legalSlots(moves, { die, coffee: -1 }).has('brakes.0')).toBe(true)
    expect(legalSlots(moves, { die, coffee: 0 }).has('brakes.0')).toBe(false)
    expect(placeMove(moves, { die, coffee: 1 }, 'gear.1')?.type).toBe('place')
    expect(placeMove(moves, { die, coffee: 1 }, 'flaps.0')).toBeNull()
    expect(stepCoffee([-1, 0, 1], 0, 1)).toBe(1)
    expect(stepCoffee([-1, 0, 1], 1, 1)).toBe(1)
  })
})
