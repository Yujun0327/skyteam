<script lang="ts">
  import type { OnlineSession } from '../app/session.svelte'
  import ScenarioPicker from './ScenarioPicker.svelte'

  interface Props {
    session: OnlineSession
    onExit: () => void
  }
  let { session, onExit }: Props = $props()
  let copied = $state(false)
  let relays = $state(0)
  let waitedLong = $state(false)

  $effect(() => {
    const poll = setInterval(() => (relays = session.relayCount()), 1500)
    const slow = setTimeout(() => (waitedLong = true), 12000)
    return () => {
      clearInterval(poll)
      clearTimeout(slow)
    }
  })

  async function copyInvite() {
    const url = `${location.origin}${location.pathname}#room=${session.room}`
    try {
      await navigator.clipboard.writeText(url)
      copied = true
      setTimeout(() => (copied = false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }
</script>

<main class="lobby">
  <section class="card panel">
    <div class="head">
      <h1>Crew room</h1>
      <div class="code-row">
        <span class="label">Room</span>
        <span class="code">{session.room}</span>
        <button class="btn--quiet" onclick={copyInvite}>{copied ? 'copied' : 'copy invite'}</button>
      </div>
    </div>

    {#if session.status === 'room-full'}
      <p class="hint">This cockpit already has its two seats filled.</p>
    {:else if session.status === 'version-mismatch'}
      <p class="hint">Your partner runs a different version. Both reload the page.</p>
    {:else}
      <div class="crew">
        <div class="seat" class:on={true}>
          <span class="dot on"></span>
          <span>{session.isHost ? 'you (host)' : 'you'}</span>
          <span class="label">{session.pick.hostSeat === 0 === session.isHost ? 'Pilot' : 'Co-Pilot'}</span>
        </div>
        <div class="seat" class:on={session.peerHere}>
          <span class="dot" class:on={session.peerHere}></span>
          <span>{session.peerHere ? session.partnerName || 'partner' : 'waiting for partner'}</span>
          {#if session.peerHere}<span class="label">{session.pick.hostSeat === 0 === session.isHost ? 'Co-Pilot' : 'Pilot'}</span>{/if}
        </div>
      </div>

      {#if session.isHost}
        <div class="seatpick">
          <span class="label">Host seat</span>
          <button class="btn--blue" class:active={session.pick.hostSeat === 0} onclick={() => session.setPick({ hostSeat: 0 })}>Pilot</button>
          <button class="btn--orange" class:active={session.pick.hostSeat === 1} onclick={() => session.setPick({ hostSeat: 1 })}>Co-Pilot</button>
        </div>
      {/if}

      <ScenarioPicker scenarioId={session.pick.scenarioId} abilities={session.pick.abilities} disabled={!session.isHost} onChange={(s, a) => session.setPick({ scenarioId: s, abilities: a })} />

      <div class="actions">
        {#if session.isHost}
          <button class="btn--primary" data-action="start" disabled={!session.canStart} onclick={() => session.startGame()}>
            {session.peerHere ? 'Start the approach' : 'Waiting for partner'}
          </button>
        {:else}
          <span class="label">The host starts the approach.</span>
        {/if}
        <button class="btn--quiet" onclick={() => session.rescan()}>rescan</button>
        <button class="btn--quiet" onclick={onExit}>leave</button>
      </div>

      <p class="net label">
        {relays > 0 ? `${relays} broker${relays > 1 ? 's' : ''} up` : 'connecting to brokers'}
        {#if waitedLong && !session.peerHere}· still quiet: check the code, keep both tabs in the foreground, or press rescan{/if}
      </p>
    {/if}
  </section>
</main>

<style>
  .lobby {
    min-height: 100dvh;
    display: grid;
    place-items: start center;
    padding: var(--sp-5) var(--sp-3);
  }
  .card {
    width: min(100%, 900px);
    padding: var(--sp-4);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  h1 {
    font-family: var(--font-title);
    font-size: var(--fs-lg);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    margin: 0;
  }
  .code-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .code {
    font-family: var(--font-mono);
    font-size: var(--fs-xl);
    letter-spacing: 0.2em;
    color: var(--amber);
  }
  .crew {
    display: flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .seat {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 10px;
    border: 1px solid var(--hairline);
    border-radius: var(--r);
    opacity: 0.6;
  }
  .seat.on {
    opacity: 1;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--ink-faint);
  }
  .dot.on {
    background: var(--green);
    box-shadow: 0 0 6px var(--green);
  }
  .seatpick {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .seatpick .active {
    background: var(--panel-3);
    outline: 1px solid currentColor;
  }
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .hint {
    color: var(--amber);
  }
</style>
