<script lang="ts">
  import type { Scenario } from '../data/types'
  import type { GameState } from '../engine'
  import { isMuted, setMuted, unlock } from './audio'

  interface Props {
    gs: GameState
    scenario: Scenario
    feet: number
    names: [string, string]
    myTurnLine: string
    sterile: boolean
    clock: number | null
    peerStatus?: string | null
    onRules: () => void
    onLeave: () => void
  }
  let { gs, scenario, feet, names, myTurnLine, sterile, clock, peerStatus = null, onRules, onLeave }: Props = $props()
  let muted = $state(isMuted())
  function toggleMute() {
    unlock()
    muted = !muted
    setMuted(muted)
  }
</script>

<header class="bar">
  <div class="left">
    <span class="code">{scenario.code}</span>
    <span class="dot {scenario.difficulty}" title={scenario.difficulty}></span>
    <span class="label airport">{scenario.airport}</span>
  </div>
  <div class="mid">
    <span class="readout mono">RND {gs.round}</span>
    <span class="readout mono">{feet === 0 ? 'LANDING' : feet + ' FT'}</span>
    <span class="turn" class:blue={gs.seatToAct === 0} class:orange={gs.seatToAct === 1}>{myTurnLine}</span>
    {#if sterile}<span class="sterile label">Sterile cockpit</span>{/if}
    {#if clock !== null}<span class="clock mono" class:late={clock <= 10}>{Math.max(0, clock).toString().padStart(2, '0')}s</span>{/if}
    {#if peerStatus}<span class="peer label">{peerStatus}</span>{/if}
  </div>
  <div class="right">
    <span class="label crew"><b class="b">{names[0]}</b> / <b class="o">{names[1]}</b></span>
    <button class="btn--quiet" onclick={toggleMute} aria-label={muted ? 'unmute' : 'mute'}>{muted ? 'snd off' : 'snd on'}</button>
    <button class="btn--quiet" onclick={onRules}>rules</button>
    <button class="btn--quiet" onclick={onLeave}>leave</button>
  </div>
</header>

<style>
  .bar button {
    white-space: nowrap;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: 6px var(--sp-3);
    background: rgba(5, 8, 11, 0.85);
    border-bottom: 1px solid var(--hairline);
    font-size: var(--fs-sm);
  }
  .left,
  .mid,
  .right {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-width: 0;
  }
  .code {
    font-family: var(--font-title);
    letter-spacing: 0.1em;
    font-size: var(--fs-lg);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .dot.green {
    background: var(--green);
  }
  .dot.yellow {
    background: var(--amber);
  }
  .dot.red {
    background: var(--red);
  }
  .dot.black {
    background: #000;
    border: 1px solid var(--ink-dim);
  }
  .readout {
    white-space: nowrap;
    padding: 2px 6px;
    border: 1px solid var(--hairline);
    border-radius: 3px;
    color: var(--ink);
  }
  .turn {
    white-space: nowrap;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: var(--fs-xs);
  }
  .turn.blue {
    color: var(--blue-hi);
  }
  .turn.orange {
    color: var(--orange-hi);
  }
  .sterile {
    white-space: nowrap;
    color: var(--red);
    border: 1px solid var(--red);
    padding: 1px 6px;
    border-radius: 2px;
    animation: blink 2s steps(2) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0.45;
    }
  }
  .clock {
    color: var(--amber);
    font-size: var(--fs-lg);
  }
  .clock.late {
    color: var(--red);
  }
  .peer {
    color: var(--amber);
  }
  .crew .b {
    color: var(--blue-hi);
  }
  .crew .o {
    color: var(--orange-hi);
  }
  @media (max-width: 700px) {
    .airport,
    .crew,
    .turn {
      display: none;
    }
    .bar {
      padding: 4px 8px;
      gap: 6px;
      font-size: var(--fs-xs);
    }
    .code {
      font-size: var(--fs-md);
    }
    .mid {
      gap: 4px;
    }
    .right button {
      padding: 4px 6px;
      white-space: nowrap;
    }
  }
</style>
