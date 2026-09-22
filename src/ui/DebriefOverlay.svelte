<script lang="ts">
  import type { LockState, Payout } from '@yujun/game-net/wallet'
  import PayoutLine from './PayoutLine.svelte'
  import type { GameResult, GameState } from '../engine'
  import type { Scenario } from '../data/types'
  interface Props {
    result: GameResult
    state: GameState
    scenario: Scenario
    canRematch: boolean
    rematchLabel?: string
    payout?: Payout | null
    lock?: LockState | null
    onRematch: () => void
    onExit: () => void
  }
  let { result, state, scenario, canRematch, rematchLabel = 'fly again', payout = null, lock = null, onRematch, onExit }: Props = $props()
  const REASON: Record<string, string> = {
    spin: 'The aircraft entered a spin. Axis exceeded the limit.',
    collision: 'Mid-air collision with traffic on the approach.',
    overshoot: 'Overshot the runway. The aircraft flew past the airport.',
    offCorridor: 'Departed the approach corridor. The axis was outside the permitted turn.',
    missingMandatory: 'Axis or Engines were left without a die at the end of the round.',
    shortOfAirport: 'Ran out of altitude before reaching the airport.',
    kerosene: 'Fuel exhausted.',
    landing: 'The landing checks failed.',
  }
  const CHECK: Record<string, string> = $derived({
    planes: 'traffic still on the approach',
    gear: 'landing gear not fully deployed',
    flaps: 'flaps not fully deployed',
    axis: 'aircraft not level',
    speed: `speed ${state.speed ?? '?'} exceeded brakes ${state.brake}`,
    intern: 'intern training unfinished',
    iceBrakes: 'ice brakes not fully deployed',
  })
</script>

<div class="veil" class:landed={result.outcome === 'landed'} role="dialog" aria-modal="true" aria-label="debrief">
  <div class="card debrief">
    <div class="label">{scenario.code} · {scenario.airport} · debrief</div>
    <h2 class:ok={result.outcome === 'landed'}>{result.outcome === 'landed' ? 'Landed' : 'Crashed'}</h2>
    {#if result.outcome === 'landed'}
      <p>The passengers burst into applause. Touchdown on runway {scenario.code}, round {result.round}.</p>
    {:else}
      <p>{REASON[result.reason ?? 'landing']}</p>
      {#if result.failed?.length}
        <ul>
          {#each result.failed as f}<li>{CHECK[f]}</li>{/each}
        </ul>
      {/if}
      <p class="label">Round {result.round}</p>
    {/if}
    <div class="actions">
      <PayoutLine {payout} {lock} />
      {#if canRematch}<button class="btn--primary" onclick={onRematch}>{rematchLabel}</button>{/if}
      <button onclick={onExit}>exit cockpit</button>
    </div>
  </div>
</div>

<style>
  .veil {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    background: radial-gradient(ellipse at center, rgba(40, 0, 0, 0.6), rgba(5, 8, 11, 0.92));
    animation: fade 900ms ease-out;
  }
  .veil.landed {
    background: radial-gradient(ellipse at center, rgba(0, 40, 20, 0.5), rgba(5, 8, 11, 0.92));
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  .card {
    padding: var(--sp-5);
    max-width: 440px;
    width: calc(100% - 32px);
    background: var(--panel-2);
    border: 1px solid var(--hairline-2);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow);
  }
  h2 {
    font-family: var(--font-title);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--red);
    margin: 8px 0;
  }
  h2.ok {
    color: var(--green);
  }
  ul {
    padding-left: 18px;
    color: var(--ink-dim);
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: var(--sp-4);
  }
</style>
