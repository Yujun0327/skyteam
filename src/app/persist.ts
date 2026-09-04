import type { Seat } from '../engine'
import type { ChatLine, GameSnapshot } from '../transport/types'

/** Persistent identity: a UUID in localStorage. Reconnecting with the same key reclaims the seat. */
export function playerKey(): string {
  const KEY = 'skyteam:player-key'
  let key = localStorage.getItem(KEY)
  if (!key) {
    key = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    localStorage.setItem(KEY, key)
  }
  return key
}

export function loadPlayerName(): string {
  return localStorage.getItem('skyteam:player-name') ?? ''
}

export function savePlayerName(name: string): void {
  localStorage.setItem('skyteam:player-name', name)
}

export interface SavedGame {
  snapshot: GameSnapshot
  seat: Seat
  chat: ChatLine[]
}

const roomKey = (room: string, key: string) => `skyteam:room:${room.toUpperCase()}:${key}`

export function saveGame(room: string, key: string, data: SavedGame): void {
  try {
    localStorage.setItem(roomKey(room, key), JSON.stringify(data))
  } catch {
    /* storage full or blocked — the next beacon repairs instead */
  }
}

export function loadGame(room: string, key: string): SavedGame | null {
  try {
    const raw = localStorage.getItem(roomKey(room, key))
    return raw ? (JSON.parse(raw) as SavedGame) : null
  } catch {
    return null
  }
}

export function clearGame(room: string, key: string): void {
  localStorage.removeItem(roomKey(room, key))
}

/** Scenarios landed on this device (solo or online). */
export function landedScenarios(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem('skyteam:landed') ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function recordLanding(scenarioId: string): void {
  const set = landedScenarios()
  set.add(scenarioId)
  localStorage.setItem('skyteam:landed', JSON.stringify([...set]))
}
