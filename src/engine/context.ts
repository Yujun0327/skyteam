import { altitudeRows, getScenario, getTrack } from '../data'
import type { AltitudeRow, ApproachTrack, ModuleId, Scenario } from '../data/types'
import type { GameState } from './types'

export interface Ctx {
  scn: Scenario
  track: ApproachTrack
  rows: AltitudeRow[]
  modules: readonly ModuleId[]
  has(m: ModuleId): boolean
}

const cache = new Map<string, Ctx>()

/** Static scenario context for a state (memoized by scenario id). */
export function ctxOf(state: Pick<GameState, 'scenarioId'>): Ctx {
  let c = cache.get(state.scenarioId)
  if (!c) {
    const scn = getScenario(state.scenarioId)
    const modules = scn.modules
    c = {
      scn,
      track: getTrack(scn.trackId),
      rows: altitudeRows(scn.altitudeSide, scn.startFeet),
      modules,
      has: (m) => modules.includes(m),
    }
    cache.set(state.scenarioId, c)
  }
  return c
}
