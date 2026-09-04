<script lang="ts">
  import type { DieRef, GameState, Move, Seat } from '../engine'
  import { dieValue } from '../engine'
  import type { Selection } from './interact'
  import { coffeeOptions, discardMove, sameDie, selectableDice } from './interact'
  import Die from './panel/Die.svelte'

  interface Props {
    state: GameState
    seat: Seat
    moves: Move[]
    selection: Selection
    /** reroll mask editing: null when not editing */
    mask: boolean[] | null
    onSelect: (die: DieRef) => void
    onCoffee: (dir: 1 | -1) => void
    onDiscard: (move: Move) => void
    onToggleMask: (index: number) => void
  }
  let { state, seat, moves, selection, mask, onSelect, onCoffee, onDiscard, onToggleMask }: Props = $props()

  const color = $derived(seat === 0 ? 'blue' : 'orange')
  const selectable = $derived(selectableDice(moves))
  const refs = $derived.by(() => {
    const out: { ref: DieRef; value: number }[] = []
    state.dice[seat].forEach((v, index) => {
      if (!state.placed[seat][index] && v !== 0) out.push({ ref: { kind: 'die', index }, value: v })
    })
    if (state.token[seat] !== null) out.push({ ref: { kind: 'token' }, value: state.token[seat]! })
    if (seat === 1 && state.extra !== null) out.push({ ref: { kind: 'extra' }, value: state.extra })
    return out
  })
  const options = $derived(coffeeOptions(moves, selection.die))
  const canDiscard = $derived(discardMove(moves, selection.die))
  const selValue = $derived(selection.die ? dieValue(state, seat, selection.die) : null)
</script>

<div class="chips" data-seat={seat}>
  {#each refs as { ref, value } (ref.kind + (ref.kind === 'die' ? ref.index : ''))}
    {@const isSel = sameDie(selection.die, ref)}
    {@const ok = selectable.some((d) => sameDie(d, ref))}
    {@const masked = mask && ref.kind === 'die' ? mask[ref.index] : false}
    <button
      class="chip"
      class:selected={isSel}
      class:ok
      class:masked
      class:hidden={value < 0}
      data-die={ref.kind === 'die' ? ref.index : ref.kind}
      disabled={mask ? ref.kind !== 'die' : !ok}
      aria-pressed={isSel}
      aria-label="{ref.kind === 'die' ? 'die' : ref.kind === 'token' ? 'intern token' : 'traffic die'} {value < 0 ? 'hidden' : value}"
      onclick={() => (mask && ref.kind === 'die' ? onToggleMask(ref.index) : onSelect(ref))}
    >
      <Die value={Math.max(0, value)} color={value < 0 ? 'hidden' : ref.kind === 'token' ? 'token' : ref.kind === 'extra' ? 'traffic' : color} size={40} />
      {#if ref.kind === 'token'}<span class="tag label">intern</span>{/if}
      {#if ref.kind === 'extra'}<span class="tag label">traffic</span>{/if}
      {#if masked}<span class="tag label amber">reroll</span>{/if}
    </button>
  {/each}

  {#if selection.die && !mask && (options.length > 1 || canDiscard)}
    <div class="tools">
      {#if options.length > 1}
        <div class="coffee-step" aria-label="coffee adjustment">
          <button class="btn--quiet" onclick={() => onCoffee(-1)} disabled={options.indexOf(selection.coffee) <= 0} aria-label="minus one">-</button>
          <span class="mono val">{selValue === null ? '' : selValue + selection.coffee}</span>
          <button class="btn--quiet" onclick={() => onCoffee(1)} disabled={options.indexOf(selection.coffee) >= options.length - 1} aria-label="plus one">+</button>
          <span class="label">{selection.coffee === 0 ? 'coffee' : `${Math.abs(selection.coffee)} coffee`}</span>
        </div>
      {/if}
      {#if canDiscard}
        <button class="btn--quiet discard" onclick={() => onDiscard(canDiscard)}>discard</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .chips {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .chip {
    position: relative;
    padding: 4px;
    border-radius: 10px;
    border: 1.5px solid transparent;
    background: transparent;
    box-shadow: none;
    opacity: 0.45;
  }
  .chip.ok {
    opacity: 1;
    border-color: var(--hairline-2);
  }
  .chip.selected {
    border-color: var(--amber);
    box-shadow: 0 0 12px color-mix(in srgb, var(--amber) 60%, transparent);
  }
  .chip.masked {
    border-color: var(--amber);
    opacity: 1;
  }
  .chip.hidden {
    opacity: 0.8;
  }
  .chip:disabled {
    cursor: default;
  }
  .tag {
    position: absolute;
    left: 50%;
    bottom: -8px;
    translate: -50% 0;
    font-size: 0.55rem;
    background: var(--panel);
    padding: 0 3px;
  }
  .tag.amber {
    color: var(--amber);
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .coffee-step {
    display: flex;
    align-items: center;
    gap: 2px;
    border: 1px solid var(--hairline);
    border-radius: var(--r);
    padding: 0 6px;
  }
  .coffee-step .val {
    min-width: 1.4em;
    text-align: center;
    color: var(--amber);
    font-size: var(--fs-lg);
  }
  .discard {
    color: var(--red);
  }
</style>
