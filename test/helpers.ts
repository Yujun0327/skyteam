import { applyMove, createGame, legalMoves } from '../src/engine'
import type { AbilityId, GameState, Move, Seat } from '../src/engine'

export function newGame(scenarioId = 'yul-green', seed = 1, abilities: AbilityId[] = []): GameState {
  return createGame({ scenarioId, sharedSeed: seed, names: ['Pilot', 'Co-Pilot'], abilities, rulesVersion: '1' })
}

export function step(state: GameState, move: Move, actor: Seat = state.seatToAct): GameState {
  return applyMove(state, actor, move)
}

/** Brief + both rolls, then force the faces. Leaves the state in `placing` with the first player to act. */
export function placing(state: GameState, dice?: [number[], number[]]): GameState {
  let s = state
  if (s.phase === 'briefing') s = step(s, { type: 'brief' })
  if (s.phase === 'rolling') s = step(s, { type: 'roll' })
  if (s.phase === 'rolling') s = step(s, { type: 'roll' })
  if (dice) s = { ...s, dice: [[...dice[0]], [...dice[1]]] }
  return s
}

export function place(state: GameState, index: number, slot: string, coffee = 0): GameState {
  return step(state, { type: 'place', die: { kind: 'die', index }, slot, coffee })
}

/** Play a whole round with a fixed placement script: [dieIndex, slot, coffee?][] in turn order. */
export function playRound(state: GameState, script: [number, string, number?][]): GameState {
  let s = state
  for (const [index, slot, coffee] of script) s = place(s, index, slot, coffee ?? 0)
  return s
}

/** A quiet round for whoever acts: axis, engines, then concentration / radio. */
export function quietRound(state: GameState): GameState {
  let s = state
  const plan: [string[], string[]] = [
    ['axis.0', 'engine.0', 'radio.0', 'conc.0'],
    ['axis.1', 'engine.1', 'radio.1', 'radio.2'],
  ]
  const next: [number, number] = [0, 0]
  for (let turn = 0; turn < 8 && !s.result && s.phase === 'placing'; turn++) {
    const seat = s.seatToAct
    const index = s.placed[seat].indexOf(false)
    s = place(s, index, plan[seat][next[seat]++])
  }
  return s
}

export function randomPolicy(seed: number) {
  let a = seed >>> 0
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return (state: GameState): Move => {
    const moves = legalMoves(state, state.seatToAct).filter((m) => m.type !== 'timeout')
    if (!moves.length) throw new Error(`no legal moves in phase ${state.phase}`)
    const m = moves[Math.floor(rnd() * moves.length)]
    if (m.type === 'rerollPick') return { ...m, mask: m.mask.map((_, i) => !state.placed[state.seatToAct][i] && rnd() < 0.5) }
    return m
  }
}

export function playout(state: GameState, policy: (s: GameState) => Move, maxMoves = 400): GameState {
  let s = state
  let n = 0
  while (!s.result) {
    s = applyMove(s, s.seatToAct, policy(s))
    if (++n > maxMoves) throw new Error('playout did not terminate')
  }
  return s
}
