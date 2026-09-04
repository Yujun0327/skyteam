import { describe, expect, it } from 'vitest'
import { viewParams } from '../src/scene/view-params'
import { newGame } from './helpers'

describe('viewParams', () => {
  it('maps position, altitude, axis and traffic', () => {
    const s = newGame('yul-green', 1)
    const v = viewParams(s)
    expect(v.distance).toBe(0)
    expect(v.altitude).toBe(1)
    expect(v.bank).toBe(0)
    expect(v.traffic.map((t) => t.count)).toEqual([1, 2, 1, 3, 2])
    expect(v.status).toBe('flying')
    const later = viewParams({ ...s, position: 4, altIndex: 3, axis: -2 })
    expect(later.distance).toBeCloseTo(0.5)
    expect(later.altitude).toBeCloseTo(0.5)
    expect(later.bank).toBe(-18)
    expect(later.traffic.map((t) => t.count)).toEqual([2, 1, 3, 2])
  })
})
