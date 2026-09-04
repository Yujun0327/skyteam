<script lang="ts">
  import type { ApproachTrack } from '../../data/types'
  interface Props {
    track: ApproachTrack
    position: number
    planes: number[]
    turnsModule: boolean
    axis: number
  }
  let { track, position, planes, turnsModule, axis }: Props = $props()
  const rows = $derived(Array.from({ length: track.size }, (_, i) => track.size - i))
</script>

<div class="strip" aria-label="approach track">
  <div class="cap label">approach</div>
  {#each rows as n}
    {@const sp = track.spaces[n - 1]}
    {@const here = n === position}
    {@const bad = turnsModule && sp.turns && !sp.turns.includes(axis)}
    <div class="space" class:here class:airport={n === track.size} class:clouds={n === 1} data-space={n}>
      <span class="n mono">{n === track.size ? 'RWY' : n === 1 ? 'CLD' : n}</span>
      <span class="tokens">
        {#each Array.from({ length: planes[n - 1] }) as _}
          <svg viewBox="0 0 24 24" class="plane" aria-label="plane"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></svg>
        {/each}
        {#each Array.from({ length: sp.trafficDice }) as _}
          <span class="tdie" title="traffic die"></span>
        {/each}
      </span>
      {#if turnsModule && sp.turns}
        <span class="turns" class:bad title="permitted axis: {sp.turns.join(', ')}">
          {#each [-2, -1, 0, 1, 2] as p}
            <i class:ok={sp.turns.includes(p)}></i>
          {/each}
        </span>
      {/if}
      {#if here}
        <svg viewBox="0 0 24 24" class="me" aria-label="your aircraft"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></svg>
      {/if}
    </div>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 96px;
  }
  .cap {
    text-align: center;
    margin-bottom: 2px;
  }
  .space {
    position: relative;
    display: grid;
    grid-template-columns: 30px 1fr auto;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 6px;
    border: 1px solid var(--hairline);
    border-radius: 3px;
    background: #05080b;
  }
  .space.airport {
    border-color: var(--green);
  }
  .space.here {
    background: color-mix(in srgb, var(--amber) 14%, #05080b);
    border-color: var(--amber);
  }
  .n {
    font-size: 0.65rem;
    color: var(--ink-dim);
  }
  .tokens {
    display: flex;
    gap: 2px;
    align-items: center;
  }
  .plane {
    width: 14px;
    height: 14px;
    fill: var(--ink);
  }
  .tdie {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    background: #1a1f26;
    border: 1px solid var(--ink-dim);
  }
  .turns {
    display: flex;
    gap: 1px;
  }
  .turns i {
    width: 5px;
    height: 8px;
    background: var(--red);
    opacity: 0.6;
  }
  .turns i.ok {
    background: var(--green);
    opacity: 0.9;
  }
  .turns.bad {
    outline: 1px solid var(--red);
  }
  .me {
    position: absolute;
    right: -14px;
    top: 5px;
    width: 16px;
    height: 16px;
    fill: var(--amber);
    filter: drop-shadow(0 0 4px var(--amber));
  }
</style>
