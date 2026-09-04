import type { Seat } from '../engine/types'

export type Difficulty = 'green' | 'yellow' | 'red' | 'black'

export type ModuleId =
  | 'traffic'
  | 'turns'
  | 'kerosene'
  | 'keroseneLeak'
  | 'winds'
  | 'windsHeadon'
  | 'realTime'
  | 'intern'
  | 'iceBrakes'
  | 'engineLoss'

export interface ApproachSpace {
  /** plane tokens placed here at setup */
  planes: number
  /** traffic-die icons rolled at the start of a round spent here */
  trafficDice: number
  /** permitted axis values when a Turns tab is printed (module `turns` only) */
  turns?: number[]
}

export interface ApproachTrack {
  id: string
  code: string
  airport: string
  difficulty: Difficulty
  size: number
  /** spaces[i] is printed space i+1; space 1 is the clouds, space `size` the airport */
  spaces: ApproachSpace[]
}

export type AltitudeSide = 'greenYellow' | 'redBlack'

export interface AltitudeRow {
  feet: number
  firstPlayer: Seat
  reroll: boolean
}

export interface Scenario {
  id: string
  trackId: string
  code: string
  airport: string
  difficulty: Difficulty
  altitudeSide: AltitudeSide
  modules: ModuleId[]
  /** number of special-ability cards the players may take */
  abilityCards: 0 | 1 | 2
  startFeet: 6000 | 5000
  promo: boolean
}
