/**
 * Pure selection state for the die -> coffee -> slot interaction, kept
 * DOM-free so it is unit-testable and shared by pointer and keyboard paths.
 */
import type { DieRef, Move } from '../engine'

export interface Selection {
  die: DieRef | null
  coffee: number
}

export const NO_SELECTION: Selection = { die: null, coffee: 0 }

export function sameDie(a: DieRef | null, b: DieRef | null): boolean {
  if (!a || !b) return a === b
  return a.kind === b.kind && (a.kind !== 'die' || b.kind !== 'die' || a.index === b.index)
}

/** Dice that have at least one legal move (place or discard). */
export function selectableDice(moves: Move[]): DieRef[] {
  const out: DieRef[] = []
  for (const m of moves) {
    if (m.type !== 'place' && m.type !== 'discard') continue
    if (!out.some((d) => sameDie(d, m.die))) out.push(m.die)
  }
  return out
}

/** Coffee deltas that lead somewhere for this die, ascending. */
export function coffeeOptions(moves: Move[], die: DieRef | null): number[] {
  if (!die) return [0]
  const set = new Set<number>()
  for (const m of moves) if (m.type === 'place' && sameDie(m.die, die)) set.add(m.coffee)
  if (set.size === 0) set.add(0)
  return [...set].sort((a, b) => a - b)
}

/** Slot ids the selected die can go to at the chosen coffee delta. */
export function legalSlots(moves: Move[], sel: Selection): Set<string> {
  const out = new Set<string>()
  if (!sel.die) return out
  for (const m of moves) if (m.type === 'place' && sameDie(m.die, sel.die) && m.coffee === sel.coffee) out.add(m.slot)
  return out
}

/** The move for dropping the selection onto a slot, if legal. */
export function placeMove(moves: Move[], sel: Selection, slot: string): Move | null {
  if (!sel.die) return null
  return moves.find((m) => m.type === 'place' && sameDie(m.die, sel.die) && m.coffee === sel.coffee && m.slot === slot) ?? null
}

export function discardMove(moves: Move[], die: DieRef | null): Move | null {
  if (!die) return null
  return moves.find((m) => m.type === 'discard' && sameDie(m.die, die)) ?? null
}

/** Clamp a coffee step to the options that exist. */
export function stepCoffee(options: number[], current: number, dir: 1 | -1): number {
  const i = options.indexOf(current)
  const j = Math.max(0, Math.min(options.length - 1, (i < 0 ? options.indexOf(0) : i) + dir))
  return options[j] ?? 0
}
