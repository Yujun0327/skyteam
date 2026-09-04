import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../src/data'
import { ABILITY_IDS, applyMove, legalMoves, publicHash } from '../src/engine'
import { newGame, playout, randomPolicy } from './helpers'

describe('random playouts', () => {
  it('terminate with a result and are deterministic per seed', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const scn = SCENARIOS[seed % SCENARIOS.length]
      const abilities = ABILITY_IDS.filter((_, i) => (seed >> i) & 1).slice(0, 2)
      const a = playout(newGame(scn.id, seed, abilities), randomPolicy(seed))
      const b = playout(newGame(scn.id, seed, abilities), randomPolicy(seed))
      expect(a.result).not.toBeNull()
      expect(publicHash(a)).toBe(publicHash(b))
    }
  })

  it('every enumerated move applies, and applying a foreign seat throws', () => {
    for (let seed = 50; seed < 60; seed++) {
      let s = newGame(SCENARIOS[seed % SCENARIOS.length].id, seed, ['workingTogether', 'adaptation'])
      const policy = randomPolicy(seed)
      let n = 0
      while (!s.result && n++ < 120) {
        for (const m of legalMoves(s, s.seatToAct)) {
          if (m.type === 'timeout') continue
          expect(() => applyMove(s, s.seatToAct, m)).not.toThrow()
        }
        expect(() => applyMove(s, s.seatToAct === 0 ? 1 : 0, policy(s))).toThrow()
        s = applyMove(s, s.seatToAct, policy(s))
      }
    }
  })
})
