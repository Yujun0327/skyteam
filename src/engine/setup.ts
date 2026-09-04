import { altitudeRows, getScenario, getTrack } from '../data'
import { mulberry32, seededShuffle } from './rng'
import { KEROSENE_START, WIND_START, other } from './types'
import type { GameConfig, GameState } from './types'

export function createGame(cfg: GameConfig): GameState {
  const scn = getScenario(cfg.scenarioId)
  const track = getTrack(scn.trackId)
  const rows = altitudeRows(scn.altitudeSide, scn.startFeet)
  const rng = mulberry32((cfg.sharedSeed ^ 0x51c1) >>> 0)
  const planes = track.spaces.map((s) => s.planes)
  const used = planes.reduce((a, b) => a + b, 0)
  const engineLoss = scn.modules.includes('engineLoss')
  const hasWind = scn.modules.includes('winds') || scn.modules.includes('windsHeadon')
  const hasKerosene = scn.modules.includes('kerosene') || scn.modules.includes('keroseneLeak')
  const first = rows[0].firstPlayer
  return {
    scenarioId: scn.id,
    rngState: cfg.sharedSeed >>> 0,
    round: 1,
    altIndex: 0,
    final: rows.length === 1,
    phase: 'briefing',
    seatToAct: other(first),
    firstPlayer: first,
    dice: [[0, 0, 0, 0], [0, 0, 0, 0]],
    placed: [[false, false, false, false], [false, false, false, false]],
    toPlace: engineLoss ? [3, 3] : [4, 4],
    token: [null, null],
    extra: null,
    resume: null,
    slots: {},
    axis: 0,
    position: 1,
    planes,
    planeSupply: Math.max(0, 12 - used),
    aeroBlue: 4,
    aeroOrange: 8,
    gear: [false, false, false],
    flaps: [false, false, false, false],
    brake: 0,
    coffee: 0,
    rerollTokens: rows[0].reroll ? 1 : 0,
    rerollReserve: 0,
    speed: null,
    landingSpeedOk: null,
    kerosene: hasKerosene ? KEROSENE_START : null,
    keroseneUsed: false,
    internBoard: scn.modules.includes('intern') ? seededShuffle([1, 2, 3, 4, 5, 6], rng) : [],
    wind: hasWind ? WIND_START : null,
    abilities: [...cfg.abilities],
    adaptationUsed: [false, false],
    workingTogetherRound: null,
    anticipationRound: null,
    syncRound: null,
    rerollSpender: null,
    result: null,
  }
}
