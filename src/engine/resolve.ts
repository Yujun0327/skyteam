import { ctxOf } from './context'
import { rngStep } from './rng'
import { BRAKE_STEPS, ICE_STEPS } from './slots'
import { COPILOT, MAX_COFFEE, TRAFFIC_FACES, other } from './types'
import type { CrashReason, GameState, LandingCheck, PlacedDie, Seat, SlotDef } from './types'

/** Wind ring position → engine modifier (BGA table). */
export function windModifier(pos: number, headon: boolean): number {
  const p = ((pos % 20) + 20) % 20
  let m = 0
  if (p >= 9 && p <= 11) m = 3
  else if (p === 7 || p === 8 || p === 12 || p === 13) m = 2
  else if (p === 6 || p === 14) m = 1
  else if (p === 5 || p === 15) m = 0
  else if (p === 4 || p === 16) m = -1
  else if (p === 2 || p === 3 || p === 17 || p === 18) m = -2
  else m = -3
  return headon ? -m : m
}

export function currentWind(state: GameState): number {
  if (state.wind === null) return 0
  return windModifier(state.wind, ctxOf(state).has('windsHeadon'))
}

export function crash(state: GameState, reason: CrashReason, failed?: LandingCheck[]): void {
  state.result = { outcome: 'crashed', reason, failed, round: state.round }
  state.phase = 'over'
}

/** Draw one traffic-die face. */
export function drawTraffic(state: GameState): number {
  const step = rngStep(state.rngState)
  state.rngState = step.state
  return TRAFFIC_FACES[Math.floor(step.value * 6)]
}

export function drawFace(state: GameState): number {
  const step = rngStep(state.rngState)
  state.rngState = step.state
  return 1 + Math.floor(step.value * 6)
}

/** Add a plane `value` spaces ahead (value 1 = the current space), clamped to the airport. */
export function addTrafficPlane(state: GameState, value: number): void {
  const { track } = ctxOf(state)
  if (state.planeSupply <= 0) return
  const target = Math.min(track.size, state.position + value - 1)
  state.planes[target - 1]++
  state.planeSupply--
}

/** Advance the plane `steps` spaces following the BGA procedure (RL-10). */
export function movePlane(state: GameState, steps: number): void {
  const c = ctxOf(state)
  for (let k = 0; k < steps; k++) {
    const space = c.track.spaces[state.position - 1]
    if (c.has('turns') && space.turns && !space.turns.includes(state.axis)) return crash(state, 'offCorridor')
    if (state.planes[state.position - 1] > 0) return crash(state, 'collision')
    state.position++
    if (state.position > c.track.size) return crash(state, 'overshoot')
  }
}

function bothFilled(state: GameState, group: 'axis' | 'engine'): boolean {
  return `${group}.0` in state.slots && `${group}.1` in state.slots
}

export function resolvePlacement(state: GameState, def: SlotDef, die: PlacedDie): void {
  const c = ctxOf(state)
  switch (def.group) {
    case 'axis': {
      if (!bothFilled(state, 'axis')) return
      const a = state.slots['axis.0'].value
      const b = state.slots['axis.1'].value
      state.axis += b - a
      if (Math.abs(state.axis) >= 3) return crash(state, 'spin')
      if (a === b && state.abilities.includes('control')) state.coffee = Math.min(MAX_COFFEE, state.coffee + 1)
      if (state.wind !== null) state.wind = (((state.wind + state.axis) % 20) + 20) % 20
      return
    }
    case 'engine': {
      if (!bothFilled(state, 'engine')) return
      const a = state.slots['engine.0'].value
      const b = state.slots['engine.1'].value
      const speed = a + b + currentWind(state)
      state.speed = speed
      if (c.has('keroseneLeak') && state.kerosene !== null) {
        state.kerosene -= Math.abs(a - b) + 1
        if (state.kerosene < 0) return crash(state, 'kerosene')
      }
      if (a === b && state.abilities.includes('mastery') && state.rerollReserve > 0) {
        state.rerollReserve--
        state.rerollTokens++
      }
      if (state.final) {
        state.landingSpeedOk = speed <= state.brake && state.brake >= 2
        return
      }
      const adv = speed <= state.aeroBlue ? 0 : speed <= state.aeroOrange ? 1 : 2
      movePlane(state, adv)
      return
    }
    case 'radio': {
      const target = state.position + die.value - 1
      if (target <= c.track.size && state.planes[target - 1] > 0) {
        state.planes[target - 1]--
        state.planeSupply++
      }
      return
    }
    case 'gear':
      if (!state.gear[def.index]) {
        state.gear[def.index] = true
        state.aeroBlue++
      }
      return
    case 'flaps':
      if (!state.flaps[def.index]) {
        state.flaps[def.index] = true
        state.aeroOrange++
      }
      return
    case 'brakes':
      state.brake = BRAKE_STEPS[def.index + 1]
      return
    case 'conc':
      state.coffee = Math.min(MAX_COFFEE, state.coffee + 1)
      return
    case 'kerosene':
      if (state.kerosene !== null) {
        state.kerosene -= die.value
        state.keroseneUsed = true
        if (state.kerosene < 0) return crash(state, 'kerosene')
      }
      return
    case 'intern': {
      const tok = state.internBoard.shift()
      if (tok !== undefined) state.token[die.seat] = tok
      return
    }
    case 'ice': {
      const otherRow = `ice.${def.index}.${def.row === 0 ? 1 : 0}`
      if (otherRow in state.slots) state.brake = ICE_STEPS[def.index + 1]
      return
    }
  }
}

export function placedCount(state: GameState, seat: Seat): number {
  return state.placed[seat].filter(Boolean).length
}

export function unplacedIndices(state: GameState, seat: Seat): number[] {
  return state.placed[seat].map((p, i) => (p ? -1 : i)).filter((i) => i >= 0)
}

/** A seat is done for the round when it has nothing left it must place. */
export function seatDone(state: GameState, seat: Seat): boolean {
  if (placedCount(state, seat) < state.toPlace[seat]) return false
  if (state.token[seat] !== null) return false
  if (seat === COPILOT && state.extra !== null) return false
  return true
}

export function landingChecks(state: GameState): LandingCheck[] {
  const c = ctxOf(state)
  const failed: LandingCheck[] = []
  if (state.planes.some((n) => n > 0)) failed.push('planes')
  if (!state.gear.every(Boolean)) failed.push('gear')
  if (!state.flaps.every(Boolean)) failed.push('flaps')
  if (state.axis !== 0) failed.push('axis')
  if (!c.has('engineLoss') && !state.landingSpeedOk) failed.push('speed')
  if (c.has('intern') && state.internBoard.length > 0) failed.push('intern')
  if (c.has('iceBrakes') && state.brake !== 5) failed.push('iceBrakes')
  return failed
}

export function endRound(state: GameState): void {
  const c = ctxOf(state)
  const mandatoryOk = bothFilled(state, 'axis') && (c.has('engineLoss') || bothFilled(state, 'engine'))
  if (!mandatoryOk) return crash(state, 'missingMandatory')
  if (c.has('kerosene') && state.kerosene !== null && !state.keroseneUsed) {
    state.kerosene -= 6
    if (state.kerosene < 0) return crash(state, 'kerosene')
  }
  if (c.has('engineLoss')) {
    movePlane(state, 1)
    if (state.result) return
  }
  if (state.final) {
    const failed = landingChecks(state)
    if (failed.length) return crash(state, 'landing', failed)
    state.result = { outcome: 'landed', round: state.round }
    state.phase = 'over'
    return
  }
  state.altIndex++
  const row = c.rows[state.altIndex]
  if (state.altIndex === c.rows.length - 1) {
    state.final = true
    if (state.position !== c.track.size) return crash(state, 'shortOfAirport')
  }
  if (row.reroll) state.rerollTokens++
  state.firstPlayer = row.firstPlayer
  state.round++
  state.slots = {}
  state.dice = [[0, 0, 0, 0], [0, 0, 0, 0]]
  state.placed = [[false, false, false, false], [false, false, false, false]]
  state.token = [null, null]
  state.extra = null
  state.resume = null
  state.speed = null
  state.keroseneUsed = false
  state.rerollSpender = null
  state.phase = 'briefing'
  state.seatToAct = other(state.firstPlayer)
}
