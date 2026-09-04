<script lang="ts">
  import { SCENARIOS, airport, getTrack } from '../data'
  import type { Scenario } from '../data/types'
  import { landedScenarios } from '../app/persist'
  import { ABILITY_IDS } from '../engine'
  import type { AbilityId } from '../engine'

  interface Props {
    scenarioId: string
    abilities: AbilityId[]
    disabled?: boolean
    onChange: (scenarioId: string, abilities: AbilityId[]) => void
  }
  let { scenarioId, abilities, disabled = false, onChange }: Props = $props()

  const ORDER = { green: 0, yellow: 1, red: 2, black: 3 }
  const TITLE = { green: 'Routine landing', yellow: 'Exceptional conditions', red: 'Elite pilots only', black: 'Heroic landing' }
  const MODULE_SHORT: Record<string, string> = {
    traffic: 'traffic', turns: 'turns', kerosene: 'fuel', keroseneLeak: 'leak', winds: 'wind', windsHeadon: 'headwind',
    realTime: '60 s', intern: 'intern', iceBrakes: 'ice', engineLoss: 'no engines',
  }
  const ABILITY_TEXT: Record<AbilityId, string> = {
    anticipation: 'Anticipation: the first player may reroll one die before placing.',
    adaptation: 'Adaptation: once per game each player flips a die to its opposite face.',
    mastery: 'Mastery: equal engine dice recover a spent reroll token.',
    control: 'Control: equal axis dice earn a coffee.',
    synchronisation: 'Synchronisation: gear plus flaps in one round hands the Co-Pilot a traffic die.',
    workingTogether: 'Working Together: once per round swap one die with your partner.',
  }
  let showPromo = $state(false)
  const landed = landedScenarios()
  const list = $derived(SCENARIOS.filter((s) => showPromo || !s.promo).sort((a, b) => ORDER[a.difficulty] - ORDER[b.difficulty] || a.code.localeCompare(b.code)))
  const current = $derived(SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0])
  const track = $derived(getTrack(current.trackId))

  function pick(s: Scenario) {
    if (disabled) return
    onChange(s.id, abilities.slice(0, s.abilityCards))
  }
  function toggleAbility(a: AbilityId) {
    if (disabled) return
    const next = abilities.includes(a) ? abilities.filter((x) => x !== a) : [...abilities, a].slice(-current.abilityCards)
    onChange(current.id, next)
  }
</script>

<div class="picker">
  <div class="list" role="listbox" aria-label="approach">
    {#each list as s (s.id)}
      <button class="item {s.difficulty}" class:active={s.id === scenarioId} class:done={landed.has(s.id)} role="option" aria-selected={s.id === scenarioId} {disabled} onclick={() => pick(s)}>
        <span class="dot"></span>
        <span class="code">{s.code}</span>
        <span class="name">{s.airport}</span>
        <span class="mods label">{s.modules.filter((m) => m !== 'traffic').map((m) => MODULE_SHORT[m]).join(' · ')}</span>
        {#if landed.has(s.id)}<span class="tick" title="landed">landed</span>{/if}
      </button>
    {/each}
    <label class="promo label"><input type="checkbox" bind:checked={showPromo} /> show promo approaches</label>
  </div>
  <div class="detail panel">
    <div class="d-head">
      <span class="d-code">{current.code}</span>
      <span class="d-diff {current.difficulty} label">{TITLE[current.difficulty]}</span>
    </div>
    <div class="d-name">{current.airport} · {airport(current.code).city}</div>
    <p class="brief">{airport(current.code).briefing}</p>
    <div class="facts label">
      <span>{track.size} spaces</span>
      <span>{track.spaces.reduce((a, b) => a + b.planes, 0)} planes</span>
      <span>{current.startFeet} ft · {current.altitudeSide === 'greenYellow' ? 'two rerolls' : 'one reroll'}</span>
      <span>{current.modules.filter((m) => m !== 'traffic').map((m) => MODULE_SHORT[m]).join(', ') || 'no modules'}</span>
    </div>
    {#if current.abilityCards > 0}
      <div class="ab">
        <div class="label">Special abilities: choose {current.abilityCards}</div>
        {#each ABILITY_IDS.filter((a) => !(current.modules.includes('engineLoss') && a === 'mastery')) as a}
          <label class="ab-row" class:on={abilities.includes(a)}>
            <input type="checkbox" checked={abilities.includes(a)} {disabled} onchange={() => toggleAbility(a)} />
            <span>{ABILITY_TEXT[a]}</span>
          </label>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .picker {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) minmax(260px, 1.1fr);
    gap: var(--sp-3);
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 60dvh;
    overflow-y: auto;
    padding-right: 4px;
  }
  .item {
    display: grid;
    grid-template-columns: 10px 48px 1fr auto;
    align-items: center;
    gap: 8px;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    padding: 6px 8px;
    border-color: var(--hairline);
  }
  .item.active {
    border-color: var(--amber);
    background: color-mix(in srgb, var(--amber) 10%, var(--panel-2));
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .green .dot {
    background: var(--green);
  }
  .yellow .dot {
    background: var(--amber);
  }
  .red .dot {
    background: var(--red);
  }
  .black .dot {
    background: #000;
    border: 1px solid var(--ink-dim);
  }
  .code {
    font-family: var(--font-title);
    font-size: var(--fs-sm);
    letter-spacing: 0.08em;
  }
  .name {
    font-size: var(--fs-sm);
  }
  .mods {
    grid-column: 2 / -1;
    font-size: 0.6rem;
  }
  .tick {
    color: var(--green);
    font-size: 0.6rem;
    text-transform: uppercase;
  }
  .promo {
    margin-top: 6px;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .detail {
    padding: var(--sp-3) var(--sp-4);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .d-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .d-code {
    font-family: var(--font-title);
    font-size: var(--fs-2xl);
    letter-spacing: 0.1em;
  }
  .d-diff.green {
    color: var(--green);
  }
  .d-diff.yellow {
    color: var(--amber);
  }
  .d-diff.red {
    color: var(--red);
  }
  .d-diff.black {
    color: var(--ink);
  }
  .d-name {
    color: var(--ink-dim);
  }
  .brief {
    margin: 0;
    font-size: var(--fs-sm);
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
  }
  .ab {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }
  .ab-row {
    display: flex;
    gap: 8px;
    font-size: var(--fs-xs);
    color: var(--ink-dim);
    align-items: flex-start;
  }
  .ab-row.on {
    color: var(--ink);
  }
  @media (max-width: 700px) {
    .picker {
      grid-template-columns: 1fr;
    }
    .list {
      max-height: 34dvh;
    }
  }
</style>
