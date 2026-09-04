<script lang="ts">
  import type { PlacedDie } from '../../engine'
  import Die from './Die.svelte'

  interface Props {
    id: string
    label?: string
    /** printed value constraint, e.g. "1-2" */
    values?: string
    color: 'blue' | 'orange' | 'any'
    filled?: PlacedDie | null
    legal?: boolean
    /** value the selected die would show here */
    preview?: number | null
    /** green lamp state: null = no lamp */
    lamp?: boolean | null
    mandatory?: boolean
    compact?: boolean
    onPick?: (id: string) => void
  }
  let { id, label, values, color, filled = null, legal = false, preview = null, lamp = null, mandatory = false, compact = false, onPick }: Props = $props()
  const dieColor = $derived(filled ? (filled.kind === 'token' ? 'token' : filled.kind === 'extra' ? 'traffic' : filled.seat === 0 ? 'blue' : 'orange') : 'blue')
</script>

<div class="slot {color}" class:compact class:has-lamp={lamp !== null}>
  {#if label}<span class="slot-label label">{label}</span>{/if}
  <button
    class="well"
    class:legal
    class:filled={!!filled}
    class:mandatory={mandatory && !filled}
    data-slot={id}
    disabled={!legal}
    aria-label="{label ?? id}{values ? ' ' + values : ''}{filled ? ', holds ' + filled.value : legal ? ', available' : ''}"
    onclick={() => legal && onPick?.(id)}
  >
    {#if filled}
      <Die value={filled.value} color={dieColor} size={compact ? 26 : 32} />
    {:else if legal && preview !== null}
      <span class="preview mono">{preview}</span>
    {:else if values}
      <span class="values mono">{values}</span>
    {/if}
  </button>
  {#if lamp !== null}
    <span class="lamp" class:on={lamp} aria-hidden="true"></span>
  {/if}
</div>

<style>
  .slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    --ring: var(--hairline-2);
  }
  .slot.blue {
    --ring: var(--blue);
  }
  .slot.orange {
    --ring: var(--orange);
  }
  .slot.any {
    --ring: var(--ink-dim);
  }
  .slot-label {
    font-size: 0.6rem;
    white-space: nowrap;
  }
  .well {
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 8px;
    border: 1.5px solid color-mix(in srgb, var(--ring) 45%, transparent);
    background: #05080b;
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.8);
    display: grid;
    place-items: center;
    text-transform: none;
    letter-spacing: 0;
    transition: box-shadow 120ms, border-color 120ms;
  }
  .compact .well {
    width: 36px;
    height: 36px;
  }
  .well:disabled {
    opacity: 1;
    cursor: default;
  }
  .well.legal {
    border-color: var(--ring);
    box-shadow:
      inset 0 2px 6px rgba(0, 0, 0, 0.8),
      0 0 0 2px color-mix(in srgb, var(--ring) 35%, transparent),
      0 0 14px color-mix(in srgb, var(--ring) 55%, transparent);
    cursor: pointer;
  }
  .well.mandatory {
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      border-color: color-mix(in srgb, var(--ring) 45%, transparent);
    }
    50% {
      border-color: var(--amber);
    }
  }
  .values {
    color: var(--ink-faint);
    font-size: 0.7rem;
  }
  .preview {
    color: var(--ink);
    font-size: 1.1rem;
  }
  .lamp {
    width: 22px;
    height: 6px;
    border-radius: 3px;
    background: #14301f;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .lamp.on {
    background: var(--green);
    box-shadow: 0 0 8px var(--green);
  }
</style>
