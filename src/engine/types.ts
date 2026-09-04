import type { ModuleId } from '../data/types'

export type Seat = 0 | 1
export const PILOT: Seat = 0
export const COPILOT: Seat = 1
export const other = (s: Seat): Seat => (s === 0 ? 1 : 0)

export type AbilityId =
  | 'anticipation'
  | 'adaptation'
  | 'mastery'
  | 'control'
  | 'synchronisation'
  | 'workingTogether'

export const ABILITY_IDS: AbilityId[] = [
  'anticipation',
  'adaptation',
  'mastery',
  'control',
  'synchronisation',
  'workingTogether',
]

export type SlotGroup =
  | 'axis'
  | 'engine'
  | 'radio'
  | 'gear'
  | 'flaps'
  | 'brakes'
  | 'conc'
  | 'kerosene'
  | 'intern'
  | 'ice'

export interface SlotDef {
  id: string
  group: SlotGroup
  /** index within the group (gear 0..2, flaps 0..3, ice column) */
  index: number
  /** ice brakes: 0 = top row (Pilot), 1 = bottom row (either) */
  row?: number
  /** null = either seat */
  seat: Seat | null
  /** null = any value */
  values: number[] | null
  mandatory: boolean
  /** present only while this module is active */
  module?: ModuleId
  /** absent while this module is active */
  notModule?: ModuleId
}

export interface GameConfig {
  scenarioId: string
  sharedSeed: number
  names: [string, string]
  /** special-ability cards chosen by the crew (0..scenario.abilityCards) */
  abilities: AbilityId[]
  rulesVersion: string
}

export const RULES_VERSION = '1'

/** Which die a move refers to. `token` = intern token in hand, `extra` = Synchronisation traffic die. */
export type DieRef = { kind: 'die'; index: number } | { kind: 'token' } | { kind: 'extra' }

export interface PlacedDie {
  seat: Seat
  value: number
  kind: DieRef['kind']
}

export type Phase = 'briefing' | 'rolling' | 'placing' | 'awaitReroll' | 'over'

export type CrashReason =
  | 'spin'
  | 'collision'
  | 'overshoot'
  | 'offCorridor'
  | 'missingMandatory'
  | 'shortOfAirport'
  | 'kerosene'
  | 'landing'

export type LandingCheck = 'planes' | 'gear' | 'flaps' | 'axis' | 'speed' | 'intern' | 'iceBrakes'

export interface GameResult {
  outcome: 'landed' | 'crashed'
  reason?: CrashReason
  failed?: LandingCheck[]
  round: number
}

export interface GameState {
  scenarioId: string
  rngState: number
  round: number
  /** index into the played altitude rows */
  altIndex: number
  /** true while the last altitude row is being played */
  final: boolean
  phase: Phase
  seatToAct: Seat
  firstPlayer: Seat
  /** 4 faces per seat; 0 = not rolled */
  dice: [number[], number[]]
  placed: [boolean[], boolean[]]
  /** dice each seat must place this round (4, or 3 under engine loss) */
  toPlace: [number, number]
  /** intern token in hand, must be placed this turn */
  token: [number | null, number | null]
  /** Synchronisation traffic die awaiting the Co-Pilot */
  extra: number | null
  /** seat whose turn resumes after the Co-Pilot places the extra die */
  resume: Seat | null
  slots: Record<string, PlacedDie>
  axis: number
  /** 1 = clouds, size = airport */
  position: number
  /** planes[i] = tokens on printed space i+1 */
  planes: number[]
  planeSupply: number
  aeroBlue: number
  aeroOrange: number
  gear: [boolean, boolean, boolean]
  flaps: [boolean, boolean, boolean, boolean]
  /** brake marker: 0/2/4/6, or 0/2/3/4/5 with ice brakes */
  brake: number
  coffee: number
  rerollTokens: number
  /** spent reroll tokens back in the box (Mastery draws from here) */
  rerollReserve: number
  speed: number | null
  landingSpeedOk: boolean | null
  kerosene: number | null
  keroseneUsed: boolean
  internBoard: number[]
  /** wind ring position 0..19, or null without a wind module */
  wind: number | null
  abilities: AbilityId[]
  adaptationUsed: [boolean, boolean]
  workingTogetherRound: number | null
  anticipationRound: number | null
  syncRound: number | null
  rerollSpender: Seat | null
  result: GameResult | null
}

export type Move =
  | { type: 'brief' }
  | { type: 'roll' }
  | { type: 'place'; die: DieRef; slot: string; coffee: number }
  | { type: 'discard'; die: DieRef }
  | { type: 'spendReroll'; mask: boolean[] }
  | { type: 'rerollPick'; mask: boolean[] }
  | { type: 'swap'; mine: number; theirs: number }
  | { type: 'adapt'; index: number }
  | { type: 'anticipate'; index: number }
  | { type: 'timeout' }

export const DICE_PER_SEAT = 4
export const MAX_COFFEE = 3
export const TRAFFIC_FACES = [2, 3, 3, 4, 4, 5]
export const REAL_TIME_SECONDS = 60
export const KEROSENE_START = 20
export const WIND_START = 10
