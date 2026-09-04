import type { AltitudeRow, AltitudeSide } from './types'

const P = 0, C = 1

/** Altitude track rows, top (6000 ft) to bottom (0 ft). Transcribed from the physical strip via BGA. */
export const ALTITUDE: Record<AltitudeSide, AltitudeRow[]> = {
  greenYellow: [
    { feet: 6000, firstPlayer: P, reroll: true },
    { feet: 5000, firstPlayer: C, reroll: false },
    { feet: 4000, firstPlayer: P, reroll: false },
    { feet: 3000, firstPlayer: C, reroll: false },
    { feet: 2000, firstPlayer: P, reroll: true },
    { feet: 1000, firstPlayer: C, reroll: false },
    { feet: 0, firstPlayer: P, reroll: false },
  ],
  redBlack: [
    { feet: 6000, firstPlayer: P, reroll: true },
    { feet: 5000, firstPlayer: C, reroll: false },
    { feet: 4000, firstPlayer: P, reroll: false },
    { feet: 3000, firstPlayer: C, reroll: false },
    { feet: 2000, firstPlayer: P, reroll: false },
    { feet: 1000, firstPlayer: C, reroll: false },
    { feet: 0, firstPlayer: P, reroll: false },
  ],
}

/** Rows actually played: a 5000 ft start skips the top row (and its reroll token). */
export function altitudeRows(side: AltitudeSide, startFeet: number): AltitudeRow[] {
  return ALTITUDE[side].filter((r) => r.feet <= startFeet)
}
