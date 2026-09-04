import { deepClone } from './clone'
import type { GameState, Seat } from './types'

/**
 * The viewer's picture of the cockpit: the partner's unplaced dice become 0.
 * Display-only privacy (honour system): every client derives all faces from the
 * shared seed. A null viewer (solo table, spectator) sees everything.
 */
export function redact(state: GameState, viewer: Seat | null): GameState {
  if (viewer === null) return state
  const view = deepClone(state)
  const p: Seat = viewer === 0 ? 1 : 0
  view.dice[p] = view.dice[p].map((v, i) => (view.placed[p][i] ? v : v > 0 ? -1 : 0))
  return view
}
