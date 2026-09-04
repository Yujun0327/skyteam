<script lang="ts">
  import { loadPlayerName, savePlayerName } from '../app/persist'
  import { DEFAULT_SCENARIO } from '../data'
  import type { AbilityId } from '../engine'
  import Modal from './Modal.svelte'
  import RulesLeaflet from './RulesLeaflet.svelte'
  import ScenarioPicker from './ScenarioPicker.svelte'

  interface Props {
    onSolo: (scenarioId: string, abilities: AbilityId[]) => void
    onCreateRoom: () => void
    onJoinRoom: (code: string) => void
  }
  let { onSolo, onCreateRoom, onJoinRoom }: Props = $props()

  let name = $state(loadPlayerName())
  let code = $state('')
  let scenarioId = $state(DEFAULT_SCENARIO)
  let abilities = $state<AbilityId[]>([])
  let showRules = $state(false)
  let showPicker = $state(false)

  function saveName() {
    savePlayerName(name.trim())
  }
</script>

<main class="home">
  <section class="hero">
    <div class="ident">
      <h1>Sky Team</h1>
      <p class="tag label">Two seats · one aircraft · seven rounds · complete silence</p>
    </div>
    <p class="lede">
      The Pilot and the Co-Pilot bring an airliner down through traffic, weather and fuel limits with nothing but their dice and
      the discipline not to talk. Clear the approach, deploy everything, level the wings, and land under the brakes.
    </p>
  </section>

  <section class="modes">
    <div class="mode panel">
      <h2 class="label">Practice table</h2>
      <p>Fly both seats yourself. Every die is visible. The way to learn the cockpit.</p>
      <button class="btn--quiet" onclick={() => (showPicker = true)}>approach: <b>{scenarioId.replace('-', ' ').toUpperCase()}</b></button>
      <button class="btn--primary" data-action="solo" onclick={() => onSolo(scenarioId, abilities)}>Start solo flight</button>
    </div>

    <div class="mode panel">
      <h2 class="label">Online crew</h2>
      <p>Create a room, send the code to your partner. Dice stay behind your own screen.</p>
      <label class="field">
        <span class="label">Your name</span>
        <input type="text" maxlength="14" bind:value={name} onchange={saveName} placeholder="Captain" />
      </label>
      <button class="btn--primary" data-action="create" onclick={() => (saveName(), onCreateRoom())}>Create room</button>
      <form class="join" onsubmit={(e) => (e.preventDefault(), saveName(), code.trim() && onJoinRoom(code.trim()))}>
        <input type="text" maxlength="8" bind:value={code} placeholder="ROOM CODE" aria-label="room code" style="text-transform: uppercase" />
        <button type="submit" data-action="join">Join</button>
      </form>
    </div>
  </section>

  <footer>
    <button class="btn--quiet" onclick={() => (showRules = true)}>Landing procedure</button>
    <a class="btn--quiet lab" href="#lab">Practice sandbox</a>
    <span class="stamp label">{__BUILD_STAMP__}</span>
    <span class="label">Fan project. Sky Team is by Luc Rémond and Le Scorpion Masqué.</span>
  </footer>

  {#if showRules}
    <Modal title="Landing procedure" onClose={() => (showRules = false)}><RulesLeaflet /></Modal>
  {/if}
  {#if showPicker}
    <Modal title="Choose the approach" onClose={() => (showPicker = false)}>
      <ScenarioPicker {scenarioId} {abilities} onChange={(s, a) => ((scenarioId = s), (abilities = a))} />
      <div class="pick-actions"><button class="btn--primary" onclick={() => (showPicker = false)}>Confirm</button></div>
    </Modal>
  {/if}
</main>

<style>
  .home {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    padding: var(--sp-6) var(--sp-4) var(--sp-4);
    max-width: 960px;
    margin: 0 auto;
    background:
      radial-gradient(ellipse at 50% -10%, rgba(47, 123, 255, 0.12), transparent 55%),
      radial-gradient(ellipse at 80% 110%, rgba(255, 138, 31, 0.08), transparent 50%);
  }
  h1 {
    font-family: var(--font-title);
    font-size: clamp(2rem, 6vw, 3.4rem);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    margin: 0;
    color: var(--ink);
    text-shadow: 0 0 24px rgba(47, 123, 255, 0.35);
  }
  .tag {
    margin: 6px 0 0;
  }
  .lede {
    max-width: 640px;
    color: var(--ink-dim);
  }
  .modes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--sp-4);
  }
  .mode {
    padding: var(--sp-4);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .mode p {
    margin: 0;
    color: var(--ink-dim);
    font-size: var(--fs-sm);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .join {
    display: flex;
    gap: 8px;
  }
  .join input {
    flex: 1;
    min-width: 0;
  }
  footer {
    margin-top: auto;
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
    align-items: center;
  }
  .lab {
    text-decoration: none;
    display: inline-block;
  }
  .pick-actions {
    margin-top: var(--sp-3);
    display: flex;
    justify-content: flex-end;
  }
</style>
