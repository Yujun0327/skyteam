import type { ModuleId } from '../data/types'
import { COPILOT, PILOT } from './types'
import type { SlotDef } from './types'

export const SLOTS: SlotDef[] = [
  { id: 'axis.0', group: 'axis', index: 0, seat: PILOT, values: null, mandatory: true },
  { id: 'axis.1', group: 'axis', index: 1, seat: COPILOT, values: null, mandatory: true },
  { id: 'engine.0', group: 'engine', index: 0, seat: PILOT, values: null, mandatory: true, notModule: 'engineLoss' },
  { id: 'engine.1', group: 'engine', index: 1, seat: COPILOT, values: null, mandatory: true, notModule: 'engineLoss' },
  { id: 'radio.0', group: 'radio', index: 0, seat: PILOT, values: null, mandatory: false },
  { id: 'radio.1', group: 'radio', index: 1, seat: COPILOT, values: null, mandatory: false },
  { id: 'radio.2', group: 'radio', index: 2, seat: COPILOT, values: null, mandatory: false },
  { id: 'gear.0', group: 'gear', index: 0, seat: PILOT, values: [1, 2], mandatory: false },
  { id: 'gear.1', group: 'gear', index: 1, seat: PILOT, values: [3, 4], mandatory: false },
  { id: 'gear.2', group: 'gear', index: 2, seat: PILOT, values: [5, 6], mandatory: false },
  { id: 'flaps.0', group: 'flaps', index: 0, seat: COPILOT, values: [1, 2], mandatory: false },
  { id: 'flaps.1', group: 'flaps', index: 1, seat: COPILOT, values: [2, 3], mandatory: false },
  { id: 'flaps.2', group: 'flaps', index: 2, seat: COPILOT, values: [4, 5], mandatory: false },
  { id: 'flaps.3', group: 'flaps', index: 3, seat: COPILOT, values: [5, 6], mandatory: false },
  { id: 'brakes.0', group: 'brakes', index: 0, seat: PILOT, values: [2], mandatory: false, notModule: 'iceBrakes' },
  { id: 'brakes.1', group: 'brakes', index: 1, seat: PILOT, values: [4], mandatory: false, notModule: 'iceBrakes' },
  { id: 'brakes.2', group: 'brakes', index: 2, seat: PILOT, values: [6], mandatory: false, notModule: 'iceBrakes' },
  { id: 'conc.0', group: 'conc', index: 0, seat: null, values: null, mandatory: false },
  { id: 'conc.1', group: 'conc', index: 1, seat: null, values: null, mandatory: false },
  { id: 'conc.2', group: 'conc', index: 2, seat: null, values: null, mandatory: false },
  { id: 'kerosene', group: 'kerosene', index: 0, seat: null, values: null, mandatory: false, module: 'kerosene' },
  { id: 'intern.0', group: 'intern', index: 0, seat: PILOT, values: null, mandatory: false, module: 'intern' },
  { id: 'intern.1', group: 'intern', index: 1, seat: COPILOT, values: null, mandatory: false, module: 'intern' },
  ...[2, 3, 4, 5].flatMap((v, col): SlotDef[] => [
    { id: `ice.${col}.0`, group: 'ice', index: col, row: 0, seat: PILOT, values: [v], mandatory: false, module: 'iceBrakes' },
    { id: `ice.${col}.1`, group: 'ice', index: col, row: 1, seat: null, values: [v], mandatory: false, module: 'iceBrakes' },
  ]),
]

const BY_ID = new Map(SLOTS.map((s) => [s.id, s]))

export function slotDef(id: string): SlotDef {
  const s = BY_ID.get(id)
  if (!s) throw new Error(`unknown slot ${id}`)
  return s
}

/** Slots that exist under this module set. */
export function activeSlots(modules: readonly ModuleId[]): SlotDef[] {
  return SLOTS.filter((s) => (!s.module || modules.includes(s.module)) && (!s.notModule || !modules.includes(s.notModule)))
}

/** Brake marker values in order for the plain brakes and the ice brakes. */
export const BRAKE_STEPS = [0, 2, 4, 6]
export const ICE_STEPS = [0, 2, 3, 4, 5]
