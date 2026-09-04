<script lang="ts">
  import { untrack } from 'svelte'
  import type { BaseSession, OnlineSession, SoloSession } from '../app/session.svelte'
  import { airport, altitudeRows, getTrack } from '../data'
  import type { DieRef, Move, Seat } from '../engine'
  import { other } from '../engine'
  import { createWindshield } from '../scene/windshield'
  import type { Windshield } from '../scene/windshield'
  import { viewParams } from '../scene/view-params'
  import { callout, play, setHum, startHum, unlock } from './audio'
  import ChatDock from './ChatDock.svelte'
  import DebriefOverlay from './DebriefOverlay.svelte'
  import DieChips from './DieChips.svelte'
  import type { Selection } from './interact'
  import { NO_SELECTION, coffeeOptions, discardMove, placeMove, sameDie, selectableDice, stepCoffee } from './interact'
  import Modal from './Modal.svelte'
  import { motionOk } from './motion'
  import InstrumentPanel from './panel/InstrumentPanel.svelte'
  import RulesLeaflet from './RulesLeaflet.svelte'
  import StatusBar from './StatusBar.svelte'

  interface Props {
    session: BaseSession
    onExit: () => void
    onRematch: () => void
  }
  let { session, onExit, onRematch }: Props = $props()

  const online = $derived(session.mode === 'online' ? (session as OnlineSession) : null)
  const vs = $derived(session.visibleState)
  const scenario = $derived(session.scenario)
  const track = $derived(getTrack(scenario.trackId))
  const rows = $derived(altitudeRows(scenario.altitudeSide, scenario.startFeet))
  const names = $derived(session.cfg.names)
  const moves = $derived(session.myMoves())
  const feet = $derived(rows[vs.altIndex]?.feet ?? 0)

  /* ---- whose dice sit on the shelf ---- */
  let stagePhase = $state<'idle' | 'shaking' | 'rolling' | 'done'>('idle')
  let lockedSeat = $state<Seat>(0)
  const liveTraySeat = $derived<Seat>(session.mySeat ?? vs.seatToAct)
  $effect(() => {
    if (stagePhase === 'idle') lockedSeat = liveTraySeat
  })
  const traySeat = $derived<Seat>(stagePhase === 'idle' ? liveTraySeat : lockedSeat)
  const trayFaces = $derived(vs.dice[traySeat].map((v) => Math.max(0, v)))
  const trayHidden = $derived(vs.placed[traySeat])
  const partnerSeat = $derived<Seat>(other(traySeat))
  const partnerUnplaced = $derived(vs.dice[partnerSeat].filter((v, i) => v !== 0 && !vs.placed[partnerSeat][i]).length)

  const canRoll = $derived(vs.phase === 'rolling' && session.myTurn && vs.seatToAct === traySeat)
  const sterile = $derived(vs.phase !== 'briefing' && vs.phase !== 'over')

  function onRoll(): number[] | null {
    try {
      session.submit({ type: 'roll' })
      return session.state.dice[traySeat].map((v) => Math.max(0, v))
    } catch {
      return null
    }
  }

  /* ---- selection ---- */
  let sel = $state<Selection>(NO_SELECTION)
  let mask = $state<boolean[] | null>(null)
  let swapPick = $state<number | null>(null)

  // auto-select when only one die is actionable (pending token / extra / last die)
  $effect(() => {
    const dice = selectableDice(moves)
    if (vs.phase !== 'placing' || !session.myTurn) {
      if (sel.die) sel = NO_SELECTION
      return
    }
    if (sel.die && !dice.some((d) => sameDie(d, sel.die))) sel = NO_SELECTION
    if (!sel.die && dice.length === 1) sel = { die: dice[0], coffee: 0 }
  })

  function select(die: DieRef) {
    unlock()
    if (swapPick !== null && die.kind === 'die') {
      const m = moves.find((x) => x.type === 'swap' && x.mine === swapPick && x.theirs === die.index)
      swapPick = null
      return
    }
    sel = sameDie(sel.die, die) ? NO_SELECTION : { die, coffee: 0 }
  }
  function coffee(dir: 1 | -1) {
    sel = { ...sel, coffee: stepCoffee(coffeeOptions(moves, sel.die), sel.coffee, dir) }
  }
  function pickSlot(slot: string) {
    const m = placeMove(moves, sel, slot)
    if (!m) return
    unlock()
    session.submit(m)
    sel = NO_SELECTION
  }
  function discard(m: Move) {
    session.submit(m)
    sel = NO_SELECTION
  }

  /* ---- reroll ---- */
  const rerollMove = $derived(moves.find((m) => m.type === 'spendReroll'))
  const pickMove = $derived(moves.find((m) => m.type === 'rerollPick'))
  function beginMask() {
    const base = rerollMove?.type === 'spendReroll' ? rerollMove.mask : pickMove?.type === 'rerollPick' ? vs.placed[traySeat].map((p) => !p) : null
    if (!base) return
    mask = base.map(() => false)
    sel = NO_SELECTION
  }
  function toggleMask(i: number) {
    if (!mask) return
    const allowed = vs.dice[traySeat][i] !== 0 && !vs.placed[traySeat][i]
    if (!allowed) return
    mask = mask.map((m, k) => (k === i ? !m : m))
  }
  function confirmMask() {
    if (!mask) return
    if (pickMove) session.submit({ type: 'rerollPick', mask })
    else if (mask.some(Boolean)) session.submit({ type: 'spendReroll', mask })
    mask = null
  }
  $effect(() => {
    if (pickMove && mask === null) beginMask()
    if (!pickMove && !rerollMove && mask !== null) mask = null
  })

  /* ---- abilities ---- */
  const adaptMoves = $derived(moves.filter((m) => m.type === 'adapt'))
  const anticipateMoves = $derived(moves.filter((m) => m.type === 'anticipate'))
  const swapMoves = $derived(moves.filter((m) => m.type === 'swap'))
  function useOnSelected(kind: 'adapt' | 'anticipate') {
    if (!sel.die || sel.die.kind !== 'die') return
    const index = sel.die.index
    const m = moves.find((x) => x.type === kind && x.index === index)
    if (m) session.submit(m)
  }
  function swapSelected(theirs: number) {
    if (!sel.die || sel.die.kind !== 'die') return
    const mine = sel.die.index
    const m = moves.find((x) => x.type === 'swap' && x.mine === mine && x.theirs === theirs)
    if (m) session.submit(m)
  }

  /* ---- real-time clock ---- */
  let clock = $state<number | null>(null)
  $effect(() => {
    const t = setInterval(() => {
      const d = session.clockDeadline
      if (d === null) {
        clock = null
        return
      }
      clock = Math.ceil((d - Date.now()) / 1000)
      if (Date.now() > d && session.myTurn) {
        const m = session.myMoves().find((x) => x.type === 'timeout')
        if (m) session.submit(m)
      }
    }, 250)
    return () => clearInterval(t)
  })

  /* ---- sound ---- */
  let lastEvent = -1
  $effect(() => {
    for (const e of session.events) {
      if (e.id <= lastEvent) continue
      lastEvent = e.id
      play(e.sfx)
    }
  })
  let lastFeet: number | null = null
  $effect(() => {
    const f = feet
    if (lastFeet !== null && f !== lastFeet && !vs.result) callout(f === 0 ? 'minimums' : `${f / 1000} thousand`)
    lastFeet = f
  })
  $effect(() => {
    setHum(vs.speed, 1 - vs.altIndex / Math.max(1, rows.length - 1))
  })

  /* ---- windshield ---- */
  let wsCanvas: HTMLCanvasElement
  let wsHost: HTMLDivElement
  let windshield: Windshield | null = null
  $effect(() => {
    windshield = createWindshield(wsCanvas)
    const ro = new ResizeObserver(() => {
      const r = wsHost.getBoundingClientRect()
      windshield?.setSize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)))
    })
    ro.observe(wsHost)
    untrack(() => windshield?.setParams(viewParams(session.state)))
    let last = performance.now()
    let raf = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      windshield?.frame(motionOk() ? dt : 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      windshield?.dispose()
      windshield = null
    }
  })
  $effect(() => {
    windshield?.setParams(viewParams(vs))
  })

  /* ---- dice stage (lazy) ---- */
  const diceStageModule = import('./DiceStage.svelte')
  const highlight = $derived(
    trayFaces.map((_, i) => {
      const ref: DieRef = { kind: 'die', index: i }
      if (sameDie(sel.die, ref)) return 2
      return selectableDice(moves).some((d) => sameDie(d, ref)) ? 1 : 0
    }),
  )

  /* ---- keyboard ---- */
  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return
    if (e.key >= '1' && e.key <= '4') {
      const i = Number(e.key) - 1
      if (!vs.placed[traySeat][i] && vs.dice[traySeat][i] > 0) select({ kind: 'die', index: i })
    } else if (e.key === '[') coffee(-1)
    else if (e.key === ']') coffee(1)
    else if (e.key === 'Escape') {
      sel = NO_SELECTION
      mask = null
    } else if (e.key === 'r' && rerollMove) beginMask()
  }

  let showRules = $state(false)
  const turnLine = $derived.by(() => {
    if (vs.result) return vs.result.outcome === 'landed' ? 'landed' : 'crashed'
    const who = names[vs.seatToAct]
    const mine = session.myTurn
    switch (vs.phase) {
      case 'briefing':
        return mine ? 'briefing: confirm when ready' : `briefing: waiting for ${who}`
      case 'rolling':
        return mine ? 'roll your dice' : `${who} is rolling`
      case 'awaitReroll':
        return mine ? 'pick dice to reroll' : `${who} picks a reroll`
      default:
        return mine ? 'your die' : `${who} to place`
    }
  })
  const peerStatus = $derived(online ? (online.status === 'peer-left' ? 'partner offline' : online.status === 'desync' ? 'desync: reload' : null) : null)

  $effect(() => {
    startHum()
  })
</script>

<svelte:window onkeydown={onKey} />

<main class="cockpit" data-phase={vs.phase} data-round={vs.round} data-result={vs.result?.outcome ?? ''}>
  <div class="windshield" bind:this={wsHost}>
    <canvas bind:this={wsCanvas}></canvas>
    <div class="glare"></div>
    <div class="pillar left"></div>
    <div class="pillar right"></div>
    {#if vs.result?.outcome === 'crashed'}<div class="master-warning label">Master warning</div>{/if}
    <div class="brief-line">
      <span class="label">{airport(scenario.code).briefing}</span>
    </div>
  </div>

  <span class="sr-only" aria-live="polite">{turnLine}</span>
  <StatusBar gs={vs} {scenario} {feet} {names} myTurnLine={turnLine} {sterile} {clock} {peerStatus} onRules={() => (showRules = true)} onLeave={onExit} />

  <div class="deck">
    <InstrumentPanel state={vs} {scenario} {track} {rows} {moves} selection={sel} {names} onPick={pickSlot} />

    <div class="tray-row">
      <div class="partner" aria-label="partner dice">
        <span class="label" class:blue={partnerSeat === 0} class:orange={partnerSeat === 1}>{names[partnerSeat]}</span>
        <div class="sil">
          {#each Array.from({ length: partnerUnplaced }) as _}
            <span class="s" class:blue={partnerSeat === 0} class:orange={partnerSeat === 1}></span>
          {/each}
          {#if partnerUnplaced === 0}<span class="label">no dice</span>{/if}
        </div>
        {#if online && swapMoves.length && sel.die?.kind === 'die'}
          <div class="swap-row">
            <span class="label">swap with</span>
            {#each vs.dice[partnerSeat].map((v, i) => ({ v, i })).filter(({ v, i }) => v !== 0 && !vs.placed[partnerSeat][i]) as { i }}
              <button class="btn--quiet" onclick={() => swapSelected(i)}>#{i + 1}</button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="shelf">
        {#await diceStageModule then { default: Stage }}
          <Stage
            faces={trayFaces}
            hidden={trayHidden}
            color={traySeat === 0 ? 'blue' : 'orange'}
            {highlight}
            {canRoll}
            {onRoll}
            onPick={(i) => select({ kind: 'die', index: i })}
            onPhase={(p) => (stagePhase = p)}
          />
        {/await}
      </div>

      <div class="hand">
        <div class="hand-head">
          <span class="label" class:blue={traySeat === 0} class:orange={traySeat === 1}>{names[traySeat]}{session.mySeat === null ? ' (you)' : ''}</span>
          {#if vs.phase === 'briefing' && session.myTurn}
            <button class="btn--primary" data-action="brief" onclick={() => session.submit({ type: 'brief' })}>ready to roll</button>
          {/if}
        </div>
        {#if vs.phase === 'placing' || vs.phase === 'awaitReroll'}
          <DieChips state={vs} seat={traySeat} {moves} selection={sel} {mask} onSelect={select} onCoffee={coffee} onDiscard={discard} onToggleMask={toggleMask} />
          <div class="actions">
            {#if mask}
              <button class="btn--primary" data-action="confirm-reroll" onclick={confirmMask}>{pickMove ? (mask.some(Boolean) ? 'reroll marked' : 'keep all') : 'reroll marked'}</button>
              {#if !pickMove}<button class="btn--quiet" onclick={() => (mask = null)}>cancel</button>{/if}
            {:else}
              {#if rerollMove}<button class="btn--quiet amber" data-action="reroll" onclick={beginMask}>use reroll token</button>{/if}
              {#if adaptMoves.length && sel.die?.kind === 'die'}<button class="btn--quiet amber" onclick={() => useOnSelected('adapt')}>flip die</button>{/if}
              {#if anticipateMoves.length && sel.die?.kind === 'die'}<button class="btn--quiet amber" onclick={() => useOnSelected('anticipate')}>reroll one</button>{/if}
              {#if !online && swapMoves.length && sel.die?.kind === 'die'}
                {#each vs.dice[partnerSeat].map((v, i) => ({ v, i })).filter(({ v, i }) => v !== 0 && !vs.placed[partnerSeat][i]) as { v, i }}
                  <button class="btn--quiet amber" onclick={() => swapSelected(i)}>swap with {v}</button>
                {/each}
              {/if}
            {/if}
          </div>
        {:else if vs.phase === 'rolling'}
          <span class="label">{canRoll ? 'hold the cup, shake, release' : session.myTurn ? '' : 'waiting for the roll'}</span>
        {/if}
        {#if vs.abilities.length}
          <div class="abilities label">Abilities: {vs.abilities.join(', ')}</div>
        {/if}
      </div>
    </div>

    {#if online}
      <div class="chat-slot">
        <ChatDock lines={online.chat} open={online.chatOpen} me={online.clientId} onSay={(t) => online.say(t)} />
      </div>
    {/if}
  </div>

  {#if vs.result}
    <DebriefOverlay result={vs.result} state={vs} {scenario} canRematch={!online || online.isHost || true} rematchLabel={online && !online.isHost ? 'request another flight' : 'fly again'} onRematch={onRematch} onExit={onExit} />
  {/if}

  {#if showRules}
    <Modal title="Landing procedure" onClose={() => (showRules = false)}>
      <RulesLeaflet {scenario} />
    </Modal>
  {/if}
</main>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .cockpit {
    position: relative;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    overflow: hidden;
  }
  .windshield {
    position: relative;
    height: 38dvh;
    min-height: 180px;
    overflow: hidden;
    background: #03060c;
  }
  .windshield canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
  .glare {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 35%),
      radial-gradient(ellipse at 50% 120%, transparent 55%, rgba(0, 0, 0, 0.75) 100%);
  }
  .pillar {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 7%;
    background: linear-gradient(90deg, #05080b, #0d1218 60%, transparent);
    pointer-events: none;
  }
  .pillar.right {
    right: 0;
    transform: scaleX(-1);
  }
  .pillar.left {
    left: 0;
  }
  .master-warning {
    position: absolute;
    top: 12px;
    left: 50%;
    translate: -50% 0;
    color: var(--red);
    border: 2px solid var(--red);
    padding: 4px 12px;
    font-size: var(--fs-md);
    animation: blink 0.5s steps(2) infinite;
    background: rgba(0, 0, 0, 0.5);
  }
  @keyframes blink {
    50% {
      opacity: 0.2;
    }
  }
  .brief-line {
    position: absolute;
    left: 10%;
    right: 10%;
    bottom: 8px;
    text-align: center;
    pointer-events: none;
    text-shadow: 0 1px 4px #000;
  }
  .deck {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding-bottom: var(--sp-3);
  }
  .tray-row {
    display: grid;
    grid-template-columns: 150px minmax(220px, 1fr) minmax(260px, 1.2fr);
    gap: var(--sp-3);
    align-items: stretch;
    padding: 0 var(--sp-3);
    min-height: 190px;
  }
  .shelf {
    min-height: 170px;
    border: 1px solid var(--hairline);
    border-radius: var(--r-lg);
    background: radial-gradient(ellipse at 50% 30%, #131b24, #05080b);
    overflow: hidden;
  }
  .partner {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--hairline);
    border-radius: var(--r-lg);
  }
  .sil {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .s {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: #1a222c;
    border: 1px solid var(--hairline-2);
  }
  .s.blue {
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--blue) 40%, transparent);
  }
  .s.orange {
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--orange) 40%, transparent);
  }
  .swap-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    align-items: center;
  }
  .hand {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border: 1px solid var(--hairline);
    border-radius: var(--r-lg);
  }
  .hand-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .amber {
    color: var(--amber);
    border-color: color-mix(in srgb, var(--amber) 40%, transparent);
  }
  .blue {
    color: var(--blue-hi);
  }
  .orange {
    color: var(--orange-hi);
  }
  .chat-slot {
    padding: 0 var(--sp-3);
  }
  @media (max-width: 900px) {
    .windshield {
      height: 24dvh;
      min-height: 140px;
    }
    .tray-row {
      grid-template-columns: 1fr;
      grid-template-areas:
        'hand'
        'shelf'
        'partner';
      padding: 0 var(--sp-2);
      min-height: 0;
    }
    .hand {
      grid-area: hand;
    }
    .shelf {
      grid-area: shelf;
      min-height: 130px;
    }
    .partner {
      grid-area: partner;
      flex-direction: row;
      align-items: center;
    }
    .brief-line {
      display: none;
    }
  }
</style>
