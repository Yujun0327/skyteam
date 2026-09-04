export * from './types'
export { TRACKS, SCENARIOS } from './approaches'
export { ALTITUDE, altitudeRows } from './altitude'
export { AIRPORTS, airport } from './airports'
import { SCENARIOS, TRACKS } from './approaches'
import type { ApproachTrack, Scenario } from './types'

export function getScenario(id: string): Scenario {
  const s = SCENARIOS.find((x) => x.id === id)
  if (!s) throw new Error(`unknown scenario ${id}`)
  return s
}

export function getTrack(id: string): ApproachTrack {
  const t = TRACKS.find((x) => x.id === id)
  if (!t) throw new Error(`unknown track ${id}`)
  return t
}

export const DEFAULT_SCENARIO = 'yul-green'
