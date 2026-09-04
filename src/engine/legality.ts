import { ctxOf } from './context'
import { placedCount, seatDone, unplacedIndices } from './resolve'
import { BRAKE_STEPS, ICE_STEPS, activeSlots, slotDef } from './slots'
import { COPILOT, other } from './types'
import type { DieRef, GameState, Move, Seat, SlotDef } from './types'

/** Base value of the die a ref points at, or null when that die is not available. */
export function dieValue(state: GameState, seat: Seat, die: DieRef): number | null {
  if (die.kind === 'die') {
    if (die.index < 0 || die.index > 3 || state.placed[seat][die.index]) return null
    const v = state.dice[seat][die.index]
    return v > 0 ? v : null
  }
  if (die.kind === 'token') return state.token[seat]
  return seat === COPILOT ? state.extra : null
}

/** The die this seat is obliged to place before anything else, if any. */
export function pendingDie(state: GameState, seat: Seat): DieRef | null {
  if (state.token[seat] !== null) return { kind: 'token' }
  if (seat === COPILOT && state.extra !== null) return { kind: 'extra' }
  return null
}

function sameRef(a: DieRef, b: DieRef): boolean {
  return a.kind === b.kind && (a.kind !== 'die' || b.kind !== 'die' || a.index === b.index)
}

/** Throws when the placement is illegal; returns the slot definition and final value. */
export function validatePlace(
  state: GameState,
  actor: Seat,
  move: { die: DieRef; slot: string; coffee: number },
): { def: SlotDef; value: number } {
  if (state.phase !== 'placing') throw new Error('not placing')
  if (actor !== state.seatToAct) throw new Error('not your turn')
  const pending = pendingDie(state, actor)
  if (pending && !sameRef(pending, move.die)) throw new Error('must place pending die first')
  const base = dieValue(state, actor, move.die)
  if (base === null) throw new Error('no such die')
  const c = ctxOf(state)
  const def = activeSlots(c.modules).find((s) => s.id === move.slot)
  if (!def) throw new Error('no such slot')
  if (move.slot in state.slots) throw new Error('slot taken')
  if (move.die.kind !== 'extra' && def.seat !== null && def.seat !== actor) throw new Error('wrong colour')
  if (!Number.isInteger(move.coffee)) throw new Error('bad coffee')
  if (Math.abs(move.coffee) > state.coffee) throw new Error('not enough coffee')
  if (move.die.kind === 'token' && move.coffee !== 0) throw new Error('intern token cannot take coffee')
  const value = base + move.coffee
  if (value < 1 || value > 6) throw new Error('value out of range')
  if (def.values && !def.values.includes(value)) throw new Error('value not allowed')
  if (move.die.kind === 'token' && def.group === 'conc') throw new Error('token cannot concentrate')
  switch (def.group) {
    case 'flaps':
      if (def.index > 0 && !state.flaps[def.index - 1]) throw new Error('flaps out of order')
      break
    case 'brakes':
      if (state.brake !== BRAKE_STEPS[def.index]) throw new Error('brakes out of order')
      break
    case 'ice':
      if (ICE_STEPS.indexOf(state.brake) !== def.index) throw new Error('ice brakes out of order')
      break
    case 'intern':
      if (move.die.kind === 'token') throw new Error('token cannot train the intern')
      if (state.internBoard.length === 0) throw new Error('intern fully trained')
      if (value === state.internBoard[0]) throw new Error('die equals next intern token')
      if (state.token[actor] !== null) throw new Error('already holding a token')
      break
  }
  return { def, value }
}

function coffeeRange(state: GameState, die: DieRef): number[] {
  if (die.kind === 'token' || state.coffee === 0) return [0]
  const out: number[] = []
  for (let d = -state.coffee; d <= state.coffee; d++) out.push(d)
  return out
}

/** Every legal placement of one die (all slots, all coffee deltas). */
export function placementsFor(state: GameState, seat: Seat, die: DieRef): Move[] {
  const out: Move[] = []
  if (state.phase !== 'placing' || seat !== state.seatToAct) return out
  const c = ctxOf(state)
  for (const def of activeSlots(c.modules)) {
    for (const coffee of coffeeRange(state, die)) {
      const move = { type: 'place' as const, die, slot: def.id, coffee }
      try {
        validatePlace(state, seat, move)
        out.push(move)
      } catch {
        /* illegal */
      }
    }
  }
  return out
}

function ownDieRefs(state: GameState, seat: Seat): DieRef[] {
  const pending = pendingDie(state, seat)
  if (pending) return [pending]
  return unplacedIndices(state, seat).map((index) => ({ kind: 'die', index }) as DieRef)
}

export function legalMoves(state: GameState, seat: Seat): Move[] {
  if (state.result || seat !== state.seatToAct) return []
  const c = ctxOf(state)
  switch (state.phase) {
    case 'briefing':
      return [{ type: 'brief' }]
    case 'rolling':
      return [{ type: 'roll' }]
    case 'awaitReroll':
      return [{ type: 'rerollPick', mask: [false, false, false, false] }]
    case 'over':
      return []
  }
  const out: Move[] = []
  const pending = pendingDie(state, seat)
  for (const die of ownDieRefs(state, seat)) {
    const places = placementsFor(state, seat, die)
    if (places.length) out.push(...places)
    else if (!seatDone(state, seat) || die.kind !== 'die') out.push({ type: 'discard', die })
  }
  if (!pending) {
    const free = unplacedIndices(state, seat)
    if (state.rerollTokens > 0 && free.length && placedCount(state, seat) < state.toPlace[seat]) {
      const mask = [false, false, false, false]
      for (const i of free) mask[i] = true
      out.push({ type: 'spendReroll', mask })
    }
    if (state.abilities.includes('workingTogether') && state.workingTogetherRound !== state.round) {
      for (const mine of free) for (const theirs of unplacedIndices(state, other(seat))) out.push({ type: 'swap', mine, theirs })
    }
    if (state.abilities.includes('adaptation') && !state.adaptationUsed[seat]) {
      for (const index of free) out.push({ type: 'adapt', index })
    }
    if (
      state.abilities.includes('anticipation') &&
      seat === state.firstPlayer &&
      state.anticipationRound !== state.round &&
      placedCount(state, seat) === 0
    ) {
      for (const index of free) out.push({ type: 'anticipate', index })
    }
    if (c.has('realTime')) out.push({ type: 'timeout' })
  }
  return out
}

export { slotDef }
