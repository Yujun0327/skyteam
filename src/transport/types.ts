import type { AbilityId, GameConfig, Move, Seat } from '../engine/types'

export const PROTOCOL_VERSION = 1

export interface WireMove {
  seq: number
  actor: Seat
  move: Move
  /** publicHash of the state AFTER applying this move. */
  hash: string
}

/** The complete shared description of a game. */
export interface GameSnapshot {
  gameId: string
  cfg: GameConfig
  hostId: string
  hostSeat: Seat
  log: WireMove[]
}

export interface ChatLine {
  id: string
  from: string
  name: string
  seat: Seat | null
  text: string
  ts: number
}

/** Host's lobby selection, visible to the guest before the game exists. */
export interface LobbyPick {
  scenarioId: string
  hostSeat: Seat
  abilities: AbilityId[]
}

/**
 * The ONLY wire message. Every beacon carries the full shared state, so
 * convergence never depends on ordering or on which side spoke first: a
 * lost message is repaired by the next beacon.
 */
export interface Beacon {
  t: 'sync'
  protocol: number
  room: string
  clientId: string
  creator: boolean
  name: string
  partnerId: string | null
  wantRematch: boolean
  pick: LobbyPick | null
  chat: ChatLine[]
  game: GameSnapshot | null
}

export type NetMsg = Beacon

export interface Transport {
  send(msg: NetMsg, target?: string): void
  /** peerId is transport-specific (MQTT: the broker URL); identity is beacon.clientId. */
  onMessage(fn: (msg: NetMsg, peerId: string) => void): void
  onPeerJoin(fn: (peerId: string) => void): void
  onPeerLeave(fn: (peerId: string) => void): void
  close(): void
  relayCount?(): number
  wake?(): void
}
