import { describe, expect, it } from 'vitest'
import { SCENARIOS, TRACKS, altitudeRows, getTrack } from '../src/data'
import { newGame, playout, randomPolicy } from './helpers'

describe('scenario data', () => {
  it('has 21 base scenarios and well-formed tracks', () => {
    expect(SCENARIOS.filter((s) => !s.promo)).toHaveLength(21)
    for (const t of TRACKS) {
      expect(t.spaces).toHaveLength(t.size)
      for (const sp of t.spaces) {
        expect(sp.planes).toBeGreaterThanOrEqual(0)
        if (sp.turns) for (const v of sp.turns) expect(Math.abs(v)).toBeLessThanOrEqual(2)
      }
      expect(t.spaces.reduce((a, b) => a + b.planes, 0)).toBeLessThanOrEqual(12)
    }
    for (const s of SCENARIOS) {
      expect(getTrack(s.trackId).code).toBe(s.code)
      const hasTurns = getTrack(s.trackId).spaces.some((sp) => sp.turns)
      if (hasTurns) expect(s.modules).toContain('turns')
      expect(altitudeRows(s.altitudeSide, s.startFeet).length).toBe(s.startFeet === 6000 ? 7 : 6)
    }
  })

  it('YUL matches the printed tutorial strip', () => {
    const t = getTrack('yul-green')
    expect(t.spaces.map((s) => s.planes)).toEqual([0, 0, 1, 2, 1, 3, 2])
  })

  it('every scenario plays out under a random policy without throwing', () => {
    for (const s of SCENARIOS) {
      const end = playout(newGame(s.id, 11, []), randomPolicy(11))
      expect(end.result).not.toBeNull()
    }
  })
})
