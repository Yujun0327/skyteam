import { loadPlayerName as load, playerKey as key, savePlayerName as save } from '@yujun/game-net'
import type { ChatLine } from './session.svelte'

/** Storage prefix and MQTT topic namespace for this game. */
export const APP = 'skyteam'

/** Persistent identity per browser: the same key reclaims the same seat after a refresh. */
export const playerKey = (): string => key(APP)
export const loadPlayerName = (): string => load(APP)
export const savePlayerName = (name: string): void => save(APP, name)

const chatKey = (room: string) => `${APP}:chat:${room.toUpperCase()}`

export function saveChat(room: string, chat: ChatLine[]): void {
  try {
    localStorage.setItem(chatKey(room), JSON.stringify(chat))
  } catch {
    /* storage full or blocked */
  }
}

export function loadChat(room: string): ChatLine[] {
  try {
    const raw = localStorage.getItem(chatKey(room))
    return raw ? (JSON.parse(raw) as ChatLine[]) : []
  } catch {
    return []
  }
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
