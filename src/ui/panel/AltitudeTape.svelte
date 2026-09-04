<script lang="ts">
  import type { AltitudeRow } from '../../data/types'
  interface Props {
    rows: AltitudeRow[]
    altIndex: number
    rerollTokens: number
    names: [string, string]
  }
  let { rows, altIndex, rerollTokens, names }: Props = $props()
</script>

<div class="tape" aria-label="altitude">
  <div class="cap label">altitude</div>
  {#each rows as r, i}
    <div class="row" class:here={i === altIndex} class:past={i < altIndex} class:last={i === rows.length - 1}>
      <span class="feet mono">{r.feet === 0 ? 'LAND' : r.feet}</span>
      <span class="first" class:blue={r.firstPlayer === 0} class:orange={r.firstPlayer === 1} title="first player: {names[r.firstPlayer]}"></span>
      {#if r.reroll}<span class="reroll" class:gone={i <= altIndex} title="reroll token">R</span>{/if}
    </div>
  {/each}
  <div class="tokens label">reroll <b class="mono">{rerollTokens}</b></div>
</div>

<style>
  .tape {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 84px;
  }
  .cap {
    text-align: center;
    margin-bottom: 2px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 10px 14px;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 6px;
    border: 1px solid var(--hairline);
    border-radius: 3px;
    background: #05080b;
    color: var(--ink-dim);
  }
  .row.past {
    opacity: 0.35;
  }
  .row.here {
    color: var(--ink);
    border-color: var(--amber);
    background: color-mix(in srgb, var(--amber) 14%, #05080b);
  }
  .row.last {
    border-color: var(--green);
  }
  .feet {
    font-size: 0.7rem;
  }
  .first {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .first.blue {
    background: var(--blue);
  }
  .first.orange {
    background: var(--orange);
  }
  .reroll {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    color: var(--amber);
    border: 1px solid var(--amber);
    border-radius: 50%;
    width: 14px;
    height: 14px;
    display: grid;
    place-items: center;
  }
  .reroll.gone {
    opacity: 0.25;
  }
  .tokens {
    margin-top: 4px;
    text-align: center;
  }
  .tokens b {
    color: var(--amber);
  }
</style>
