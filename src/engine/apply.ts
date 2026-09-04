import { deepClone } from './clone'
import { ctxOf } from './context'
import { dieValue, pendingDie, placementsFor, validatePlace } from './legality'
import {
  addTrafficPlane,
  drawFace,
  drawTraffic,
  endRound,
  placedCount,
  resolvePlacement,
  seatDone,
  unplacedIndices,
} from './resolve'
import { COPILOT, other } from './types'
import type { DieRef, GameState, Move, Seat } from './types'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function rollSeat(state: GameState, seat: Seat, mask?: boolean[]): void {
  for (let i = 0; i < 4; i++) {
    if (mask && !mask[i]) continue
    state.dice[seat][i] = drawFace(state)
  }
}

function validMask(state: GameState, seat: Seat, mask: boolean[], requireOne: boolean): void {
  assert(Array.isArray(mask) && mask.length === 4, 'bad mask')
  for (let i = 0; i < 4; i++) assert(!mask[i] || !state.placed[seat][i], 'mask covers a placed die')
  if (requireOne) assert(mask.some(Boolean), 'empty mask')
}

/** After `actor` finished an action: hand the turn on, or end the round. */
function advanceTurn(state: GameState, actor: Seat): void {
  const p = other(actor)
  if (!seatDone(state, p)) state.seatToAct = p
  else if (!seatDone(state, actor)) state.seatToAct = actor
  else endRound(state)
}

function consumeDie(state: GameState, seat: Seat, die: DieRef): void {
  if (die.kind === 'die') state.placed[seat][die.index] = true
  else if (die.kind === 'token') state.token[seat] = null
  else state.extra = null
}

/** Synchronisation: fires once per round when both a gear and a flap slot hold dice. */
function maybeSynchronise(state: GameState, actor: Seat): boolean {
  if (!state.abilities.includes('synchronisation') || state.syncRound === state.round) return false
  const keys = Object.keys(state.slots)
  if (!keys.some((k) => k.startsWith('gear.')) || !keys.some((k) => k.startsWith('flaps.'))) return false
  state.syncRound = state.round
  state.extra = drawTraffic(state)
  state.resume = actor
  state.seatToAct = COPILOT
  return true
}

/** Turn bookkeeping after a die (or token/extra) was placed or discarded. */
function afterDie(state: GameState, actor: Seat, die: DieRef): void {
  if (state.result) return
  if (state.token[actor] !== null) return // must place the intern token now
  if (die.kind === 'extra') {
    const resume = state.resume ?? actor
    state.resume = null
    advanceTurn(state, resume)
    return
  }
  if (maybeSynchronise(state, actor)) return
  advanceTurn(state, actor)
}

export function applyMove(prev: GameState, actor: Seat, move: Move): GameState {
  assert(!prev.result, 'game over')
  assert(actor === prev.seatToAct, 'not your seat')
  const state = deepClone(prev)
  const c = ctxOf(state)
  switch (move.type) {
    case 'brief': {
      assert(state.phase === 'briefing', 'not briefing')
      state.phase = 'rolling'
      state.seatToAct = state.firstPlayer
      return state
    }
    case 'roll': {
      assert(state.phase === 'rolling', 'not rolling')
      assert(state.dice[actor].every((d) => d === 0), 'already rolled')
      if (actor === state.firstPlayer && c.has('traffic')) {
        const icons = c.track.spaces[state.position - 1].trafficDice
        for (let i = 0; i < icons; i++) addTrafficPlane(state, drawTraffic(state))
      }
      rollSeat(state, actor)
      const p = other(actor)
      if (state.dice[p].every((d) => d > 0)) {
        state.phase = 'placing'
        state.seatToAct = state.firstPlayer
      } else {
        state.seatToAct = p
      }
      return state
    }
    case 'place': {
      const { def, value } = validatePlace(state, actor, move)
      state.coffee -= Math.abs(move.coffee)
      consumeDie(state, actor, move.die)
      state.slots[move.slot] = { seat: actor, value, kind: move.die.kind }
      resolvePlacement(state, def, state.slots[move.slot])
      afterDie(state, actor, move.die)
      return state
    }
    case 'discard': {
      assert(state.phase === 'placing', 'not placing')
      const pending = pendingDie(state, actor)
      if (pending) assert(pending.kind === move.die.kind, 'must handle pending die first')
      assert(dieValue(state, actor, move.die) !== null, 'no such die')
      assert(placementsFor(state, actor, move.die).length === 0, 'die has a legal placement')
      if (move.die.kind === 'die') assert(!seatDone(state, actor), 'nothing left to place')
      consumeDie(state, actor, move.die)
      afterDie(state, actor, move.die)
      return state
    }
    case 'spendReroll': {
      assert(state.phase === 'placing', 'not placing')
      assert(!pendingDie(state, actor), 'pending die')
      assert(state.rerollTokens > 0, 'no reroll token')
      assert(placedCount(state, actor) < state.toPlace[actor], 'nothing left to reroll')
      validMask(state, actor, move.mask, true)
      state.rerollTokens--
      state.rerollReserve++
      rollSeat(state, actor, move.mask)
      const p = other(actor)
      if (unplacedIndices(state, p).length && placedCount(state, p) < state.toPlace[p]) {
        state.phase = 'awaitReroll'
        state.seatToAct = p
        state.rerollSpender = actor
      }
      return state
    }
    case 'rerollPick': {
      assert(state.phase === 'awaitReroll', 'no reroll pending')
      validMask(state, actor, move.mask, false)
      rollSeat(state, actor, move.mask)
      state.phase = 'placing'
      state.seatToAct = state.rerollSpender ?? other(actor)
      state.rerollSpender = null
      return state
    }
    case 'swap': {
      assert(state.phase === 'placing' && !pendingDie(state, actor), 'cannot swap now')
      assert(state.abilities.includes('workingTogether'), 'no such ability')
      assert(state.workingTogetherRound !== state.round, 'already used this round')
      const p = other(actor)
      assert(dieValue(state, actor, { kind: 'die', index: move.mine }) !== null, 'no such die')
      assert(dieValue(state, p, { kind: 'die', index: move.theirs }) !== null, 'no such partner die')
      const tmp = state.dice[actor][move.mine]
      state.dice[actor][move.mine] = state.dice[p][move.theirs]
      state.dice[p][move.theirs] = tmp
      state.workingTogetherRound = state.round
      return state
    }
    case 'adapt': {
      assert(state.phase === 'placing' && !pendingDie(state, actor), 'cannot adapt now')
      assert(state.abilities.includes('adaptation'), 'no such ability')
      assert(!state.adaptationUsed[actor], 'already used')
      const v = dieValue(state, actor, { kind: 'die', index: move.index })
      assert(v !== null, 'no such die')
      state.dice[actor][move.index] = 7 - v
      state.adaptationUsed[actor] = true
      return state
    }
    case 'anticipate': {
      assert(state.phase === 'placing' && !pendingDie(state, actor), 'cannot anticipate now')
      assert(state.abilities.includes('anticipation'), 'no such ability')
      assert(actor === state.firstPlayer, 'first player only')
      assert(state.anticipationRound !== state.round, 'already used this round')
      assert(placedCount(state, actor) === 0, 'already placed a die')
      assert(dieValue(state, actor, { kind: 'die', index: move.index }) !== null, 'no such die')
      state.dice[actor][move.index] = drawFace(state)
      state.anticipationRound = state.round
      return state
    }
    case 'timeout': {
      assert(c.has('realTime'), 'no real-time module')
      assert(state.phase === 'placing' || state.phase === 'awaitReroll', 'no round in progress')
      state.placed = [[true, true, true, true], [true, true, true, true]]
      state.token = [null, null]
      state.extra = null
      state.resume = null
      state.rerollSpender = null
      state.phase = 'placing'
      endRound(state)
      return state
    }
  }
  throw new Error('unknown move')
}
