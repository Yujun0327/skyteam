<script lang="ts">
  import type { Scenario } from '../data/types'
  interface Props {
    scenario?: Scenario | null
  }
  let { scenario = null }: Props = $props()
  const MODULE_TEXT: Record<string, string> = {
    traffic: 'Traffic die: at the start of a round spent on a space with die icons, a plane is added that many spaces ahead (2 to 5).',
    turns: 'Turns: some spaces print permitted axis positions. When leaving such a space the axis must be inside them.',
    kerosene: 'Kerosene: a die on the fuel slot burns its value; a round without one burns 6. Below zero is a crash.',
    keroseneLeak: 'Kerosene leak: the engines burn the difference between their dice plus one.',
    winds: 'Winds: the ring turns by the axis each round; its value is added to the speed, even on the last round.',
    windsHeadon: 'Head-on winds: as winds, but the modifier is negated.',
    realTime: 'Real time: sixty seconds from the roll. Unplaced dice are lost; empty Axis or Engines means a crash.',
    intern: 'Intern: place a die of a different value on your intern slot, take the next token and place it as a die (never on Concentration, never with coffee). All tokens must be used to land.',
    iceBrakes: 'Ice brakes: each column needs a blue and an orange die of its value in the same round, in order; the marker must reach 5.',
    engineLoss: 'Engine loss: no engines. Three dice each per round; the aircraft glides one space every round.',
  }
</script>

<div class="leaflet">
  <p>Two seats, one aircraft, seven rounds. Talk during the briefing, then roll behind your screen and stay silent until every die is down.</p>
  <ul>
    <li><b>Axis</b> and <b>Engines</b> must each hold one blue and one orange die every round. The axis tilts by the difference toward the higher die; three ticks is a spin.</li>
    <li><b>Engines</b> add up to the speed. At or under the blue marker: hold. Up to the orange marker: advance one. Above: advance two. Leaving a space with traffic on it is a collision. On the final round the speed must not exceed the brakes.</li>
    <li><b>Radio</b> removes a plane N spaces ahead (1 = here). <b>Gear</b> (1-2, 3-4, 5-6, any order) raises the blue marker. <b>Flaps</b> (1-2, 2-3, 4-5, 5-6, in order) raise the orange marker. <b>Brakes</b> take exactly 2, 4, 6 in order.</li>
    <li><b>Concentration</b> earns coffee (max 3). Spend coffee when placing to shift a die by one per token.</li>
    <li>A <b>reroll token</b> lets both players reroll any of their unplaced dice once.</li>
    <li>Land with no traffic left, all gear and flaps green, the axis level, and speed at or under the brakes.</li>
  </ul>
  {#if scenario?.modules.length}
    <h4 class="label">This approach</h4>
    <ul>
      {#each scenario.modules as m}<li>{MODULE_TEXT[m]}</li>{/each}
    </ul>
  {/if}
  <p class="label">Keyboard: 1-4 select a die, [ ] coffee, Tab to a lit slot and Enter, R reroll, Esc clear. Roll: hold Space and mash the arrows, release Space.</p>
</div>

<style>
  .leaflet {
    max-width: 560px;
    font-size: var(--fs-sm);
    color: var(--ink);
  }
  ul {
    padding-left: 18px;
  }
  li {
    margin-bottom: 6px;
  }
  h4 {
    margin: 12px 0 4px;
  }
</style>
