import { airport, getScenario, getTrack } from '../data'
import type { TimeOfDay, Weather } from '../data/airports'
import { altitudeRows } from '../data'
import type { GameState } from '../engine'

export interface TrafficDot {
  /** 0 = clouds, 1 = airport, along the corridor */
  dist: number
  count: number
}

export interface ViewParams {
  /** 0 at the clouds, 1 at the airport */
  distance: number
  /** 1 at the top row, 0 on the ground */
  altitude: number
  /** degrees, positive = right wing down (toward the Co-Pilot) */
  bank: number
  traffic: TrafficDot[]
  timeOfDay: TimeOfDay
  weather: Weather
  terrain: 'water' | 'city' | 'mountain' | 'plain' | 'ice'
  status: 'flying' | 'landed' | 'crashed'
  speed: number | null
}

export const BANK_PER_TICK = 9

/** Pure mapping from the game state to what the windshield shows. */
export function viewParams(state: GameState): ViewParams {
  const scn = getScenario(state.scenarioId)
  const track = getTrack(scn.trackId)
  const rows = altitudeRows(scn.altitudeSide, scn.startFeet)
  const ap = airport(scn.code)
  const span = Math.max(1, track.size - 1)
  const traffic: TrafficDot[] = []
  state.planes.forEach((count, i) => {
    if (count > 0 && i + 1 >= state.position) traffic.push({ dist: i / span, count })
  })
  const status = state.result ? (state.result.outcome === 'landed' ? 'landed' : 'crashed') : 'flying'
  return {
    distance: (state.position - 1) / span,
    altitude: status === 'landed' ? 0 : 1 - state.altIndex / Math.max(1, rows.length - 1),
    bank: state.axis * BANK_PER_TICK,
    traffic,
    timeOfDay: ap.timeOfDay,
    weather: ap.weather,
    terrain: ap.terrain,
    status,
    speed: state.speed,
  }
}
