<script lang="ts">
  import type { ApproachTrack, ModuleId, Scenario } from '../../data/types'
  import type { AltitudeRow } from '../../data/types'
  import { ICE_STEPS, BRAKE_STEPS } from '../../engine'
  import type { GameState, Move } from '../../engine'
  import { currentWind } from '../../engine'
  import type { Selection } from '../interact'
  import { legalSlots } from '../interact'
  import { dieValue } from '../../engine'
  import AltitudeTape from './AltitudeTape.svelte'
  import ApproachStrip from './ApproachStrip.svelte'
  import AxisHorizon from './AxisHorizon.svelte'
  import Slot from './Slot.svelte'
  import SpeedGauge from './SpeedGauge.svelte'

  interface Props {
    state: GameState
    scenario: Scenario
    track: ApproachTrack
    rows: AltitudeRow[]
    moves: Move[]
    selection: Selection
    names: [string, string]
    onPick: (slot: string) => void
  }
  let { state, scenario, track, rows, moves, selection, names, onPick }: Props = $props()

  const has = (m: ModuleId) => scenario.modules.includes(m)
  const legal = $derived(legalSlots(moves, selection))
  const preview = $derived.by(() => {
    if (!selection.die) return null
    const base = dieValue(state, state.seatToAct, selection.die)
    return base === null ? null : base + selection.coffee
  })
  const filled = (id: string) => state.slots[id] ?? null
  const corridor = $derived(has('turns') ? (track.spaces[state.position - 1]?.turns ?? null) : null)
  const wind = $derived(state.wind === null ? null : currentWind(state))
  const iceCol = $derived(ICE_STEPS.indexOf(state.brake))
</script>

<div class="panel-grid" data-phase={state.phase}>
  <!-- far left: altitude -->
  <section class="tape-col">
    <AltitudeTape {rows} altIndex={state.altIndex} rerollTokens={state.rerollTokens} {names} />
  </section>

  <!-- pilot cluster -->
  <section class="cluster pilot">
    <div class="cluster-head label blue">Pilot</div>
    <div class="group">
      <div class="group-title label">Radio</div>
      <div class="slots">
        <Slot id="radio.0" color="blue" filled={filled('radio.0')} legal={legal.has('radio.0')} {preview} {onPick} />
      </div>
    </div>
    <div class="group">
      <div class="group-title label">Landing gear</div>
      <div class="slots">
        {#each [0, 1, 2] as i}
          <Slot id="gear.{i}" color="blue" values={['1-2', '3-4', '5-6'][i]} filled={filled(`gear.${i}`)} legal={legal.has(`gear.${i}`)} {preview} lamp={state.gear[i]} {onPick} />
        {/each}
      </div>
    </div>
    {#if !has('iceBrakes')}
      <div class="group">
        <div class="group-title label">Brakes</div>
        <div class="slots">
          {#each [0, 1, 2] as i}
            <Slot id="brakes.{i}" color="blue" values={String(BRAKE_STEPS[i + 1])} filled={filled(`brakes.${i}`)} legal={legal.has(`brakes.${i}`)} {preview} lamp={state.brake >= BRAKE_STEPS[i + 1]} {onPick} />
          {/each}
        </div>
      </div>
    {/if}
    {#if has('intern')}
      <div class="group">
        <div class="group-title label">Intern</div>
        <div class="slots">
          <Slot id="intern.0" color="blue" values={state.internBoard.length ? `not ${state.internBoard[0]}` : 'done'} filled={filled('intern.0')} legal={legal.has('intern.0')} {preview} {onPick} />
        </div>
      </div>
    {/if}
  </section>

  <!-- centre: axis, engines, concentration -->
  <section class="cluster centre">
    <div class="row-axis">
      <Slot id="axis.0" label="Axis" color="blue" filled={filled('axis.0')} legal={legal.has('axis.0')} {preview} mandatory {onPick} />
      <AxisHorizon axis={state.axis} {corridor} />
      <Slot id="axis.1" label="Axis" color="orange" filled={filled('axis.1')} legal={legal.has('axis.1')} {preview} mandatory {onPick} />
    </div>
    <div class="row-engine">
      {#if !has('engineLoss')}
        <Slot id="engine.0" label="Engine" color="blue" filled={filled('engine.0')} legal={legal.has('engine.0')} {preview} mandatory {onPick} />
      {/if}
      <SpeedGauge aeroBlue={state.aeroBlue} aeroOrange={state.aeroOrange} brake={state.brake} speed={state.speed} final={state.final} ice={has('iceBrakes')} />
      {#if !has('engineLoss')}
        <Slot id="engine.1" label="Engine" color="orange" filled={filled('engine.1')} legal={legal.has('engine.1')} {preview} mandatory {onPick} />
      {/if}
    </div>
    {#if wind !== null}
      <div class="wind mono" title="wind ring {state.wind}">WIND {wind > 0 ? '+' : ''}{wind}</div>
    {/if}
    <div class="row-conc">
      <div class="group">
        <div class="group-title label">Concentration</div>
        <div class="slots">
          {#each [0, 1, 2] as i}
            <Slot id="conc.{i}" color="any" filled={filled(`conc.${i}`)} legal={legal.has(`conc.${i}`)} {preview} compact {onPick} />
          {/each}
        </div>
      </div>
      <div class="coffee" aria-label="coffee tokens {state.coffee}">
        {#each [0, 1, 2] as i}
          <span class="cup" class:on={i < state.coffee}></span>
        {/each}
      </div>
      {#if has('kerosene')}
        <div class="group">
          <div class="group-title label">Kerosene</div>
          <div class="slots">
            <Slot id="kerosene" color="any" filled={filled('kerosene')} legal={legal.has('kerosene')} {preview} compact {onPick} />
          </div>
        </div>
      {/if}
      {#if state.kerosene !== null}
        <div class="fuel" class:low={state.kerosene <= 6}>
          <span class="label">fuel</span>
          <span class="mono">{state.kerosene}</span>
          <span class="bar"><i style="width: {(Math.max(0, state.kerosene) / 20) * 100}%"></i></span>
        </div>
      {/if}
    </div>
    {#if has('iceBrakes')}
      <div class="group ice">
        <div class="group-title label">Ice brakes</div>
        <div class="ice-grid">
          {#each [0, 1, 2, 3] as col}
            <div class="ice-col" class:active={col === iceCol} class:done={col < iceCol}>
              <Slot id="ice.{col}.0" color="blue" values={String(ICE_STEPS[col + 1])} filled={filled(`ice.${col}.0`)} legal={legal.has(`ice.${col}.0`)} {preview} compact {onPick} />
              <Slot id="ice.{col}.1" color="any" values={String(ICE_STEPS[col + 1])} filled={filled(`ice.${col}.1`)} legal={legal.has(`ice.${col}.1`)} {preview} compact {onPick} />
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <!-- co-pilot cluster -->
  <section class="cluster copilot">
    <div class="cluster-head label orange">Co-Pilot</div>
    <div class="group">
      <div class="group-title label">Radio</div>
      <div class="slots">
        <Slot id="radio.1" color="orange" filled={filled('radio.1')} legal={legal.has('radio.1')} {preview} {onPick} />
        <Slot id="radio.2" color="orange" filled={filled('radio.2')} legal={legal.has('radio.2')} {preview} {onPick} />
      </div>
    </div>
    <div class="group">
      <div class="group-title label">Flaps</div>
      <div class="slots">
        {#each [0, 1, 2, 3] as i}
          <Slot id="flaps.{i}" color="orange" values={['1-2', '2-3', '4-5', '5-6'][i]} filled={filled(`flaps.${i}`)} legal={legal.has(`flaps.${i}`)} {preview} lamp={state.flaps[i]} {onPick} />
        {/each}
      </div>
    </div>
    {#if has('intern')}
      <div class="group">
        <div class="group-title label">Intern</div>
        <div class="slots">
          <Slot id="intern.1" color="orange" values={state.internBoard.length ? `not ${state.internBoard[0]}` : 'done'} filled={filled('intern.1')} legal={legal.has('intern.1')} {preview} {onPick} />
        </div>
        <div class="intern-row" aria-label="intern tokens">
          {#each state.internBoard as t, i}
            <span class="itok mono" class:next={i === 0}>{t}</span>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <!-- far right: approach -->
  <section class="strip-col">
    <ApproachStrip {track} position={state.position} planes={state.planes} turnsModule={has('turns')} axis={state.axis} />
  </section>
</div>

<style>
  .panel-grid {
    display: grid;
    grid-template-columns: auto 1fr auto 1fr auto;
    gap: var(--sp-3);
    align-items: start;
    padding: var(--sp-3);
    background: linear-gradient(180deg, #0d1218, #090d12);
    border-top: 1px solid var(--hairline-2);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .cluster {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    min-width: 0;
  }
  .cluster-head {
    text-align: center;
    padding-bottom: 2px;
    border-bottom: 1px solid var(--hairline);
  }
  .cluster-head.blue {
    color: var(--blue-hi);
  }
  .cluster-head.orange {
    color: var(--orange-hi);
  }
  .group {
    border: 1px solid var(--hairline);
    border-radius: var(--r);
    padding: 6px 8px 8px;
    background: rgba(0, 0, 0, 0.25);
  }
  .group-title {
    margin-bottom: 4px;
  }
  .slots {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .centre {
    align-items: center;
  }
  .row-axis,
  .row-engine {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--sp-2);
    align-items: center;
    width: 100%;
    max-width: 360px;
  }
  .row-conc {
    display: flex;
    gap: var(--sp-3);
    align-items: flex-end;
    flex-wrap: wrap;
    justify-content: center;
  }
  .coffee {
    display: flex;
    gap: 4px;
    padding-bottom: 12px;
  }
  .cup {
    width: 14px;
    height: 14px;
    border-radius: 3px 3px 6px 6px;
    border: 1px solid var(--amber);
    opacity: 0.3;
  }
  .cup.on {
    background: var(--amber);
    opacity: 1;
    box-shadow: 0 0 6px var(--amber);
  }
  .wind {
    color: var(--ink-dim);
    font-size: var(--fs-sm);
  }
  .fuel {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-bottom: 12px;
  }
  .fuel .bar {
    width: 70px;
    height: 6px;
    background: #05080b;
    border: 1px solid var(--hairline);
    border-radius: 3px;
    overflow: hidden;
  }
  .fuel .bar i {
    display: block;
    height: 100%;
    background: var(--amber);
  }
  .fuel.low .bar i {
    background: var(--red);
  }
  .ice-grid {
    display: flex;
    gap: 8px;
  }
  .ice-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px;
    border: 1px solid transparent;
    border-radius: var(--r);
    opacity: 0.55;
  }
  .ice-col.active {
    opacity: 1;
    border-color: var(--hairline-2);
  }
  .ice-col.done {
    opacity: 0.8;
    border-color: var(--green);
  }
  .intern-row {
    display: flex;
    gap: 3px;
    margin-top: 6px;
  }
  .itok {
    width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    background: #c9c2b2;
    color: #111;
    border-radius: 3px;
    font-size: 0.7rem;
    opacity: 0.6;
  }
  .itok.next {
    opacity: 1;
    outline: 1px solid var(--amber);
  }

  @media (max-width: 900px) {
    .panel-grid {
      grid-template-columns: auto 1fr auto;
      grid-template-areas:
        'tape centre strip'
        'pilot pilot pilot'
        'copilot copilot copilot';
      gap: var(--sp-2);
      padding: var(--sp-2);
    }
    .tape-col {
      grid-area: tape;
    }
    .strip-col {
      grid-area: strip;
    }
    .centre {
      grid-area: centre;
    }
    .pilot {
      grid-area: pilot;
      flex-direction: row;
      flex-wrap: wrap;
    }
    .copilot {
      grid-area: copilot;
      flex-direction: row;
      flex-wrap: wrap;
    }
    .cluster-head {
      width: 100%;
    }
  }
</style>
