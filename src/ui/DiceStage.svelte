<script lang="ts">
  import { untrack } from 'svelte'
  import { Raycaster, Vector2 } from 'three'
  import { topFaceOf } from '../dice/facemap'
  import type { DieColor } from '../dice/materials'
  import { RollDirector } from '../dice/roll-director'
  import type { RollPhase } from '../dice/roll-director'
  import { createStage } from '../dice/scene'
  import type { Stage } from '../dice/scene'
  import { attachKeys } from '../input/keys'
  import { attachScrub } from '../input/scrub'
  import { ShakeSource, motionDenied, motionSupported, requestMotionPermission } from '../input/shake'
  import type { RollInputSink } from '../input/types'
  import { dieImpact, rattleTick, throwWhoosh, unlock } from './audio'
  import { motionOk } from './motion'

  interface Props {
    /** faces of the four dice on this shelf (0 = not rolled) */
    faces: number[]
    /** dice already placed on the panel (not on the shelf) */
    hidden: boolean[]
    color: DieColor
    /** 0 = plain, 1 = selectable, 2 = selected */
    highlight: number[]
    canRoll: boolean
    /** Commit a roll; returns the authoritative faces for this shelf, or null if refused. */
    onRoll: () => number[] | null
    onRevealed?: (faces: number[]) => void
    onPick?: (die: number) => void
    onPhase?: (phase: RollPhase) => void
  }

  let { faces, hidden, color, highlight, canRoll, onRoll, onRevealed, onPick, onPhase }: Props = $props()

  let canvasEl: HTMLCanvasElement
  let cupEl: HTMLButtonElement | undefined = $state()
  let hostEl: HTMLDivElement
  let phase = $state<RollPhase>('idle')

  let stage: Stage | null = null
  let director: RollDirector | null = null
  const shake = new ShakeSource()
  let shakeActive = false
  let scrubIntensity = 0
  let scrubPointerX = 0.5
  let lastVibe = 0

  const sink: RollInputSink = {
    begin() {
      if (!canRoll || !director) return
      unlock()
      if (motionSupported() && !motionDenied()) {
        void requestMotionPermission().then((res) => {
          if (res === 'granted') {
            shake.start()
            shakeActive = true
          }
        })
      }
      director.pickup([...hidden])
    },
    update(intensity, pointerX) {
      scrubIntensity = intensity
      scrubPointerX = pointerX
    },
    commit(dir, speed) {
      if (!director || director.phase !== 'shaking') return
      stopShake()
      const result = onRoll()
      if (!result) {
        director.cancelShake()
        return
      }
      throwWhoosh()
      vibrate(30)
      director.throwDice(result, dir, speed)
      if (!motionOk()) director.skip()
    },
    cancel() {
      stopShake()
      director?.cancelShake()
    },
  }

  function stopShake(): void {
    if (shakeActive) {
      shake.stop()
      shakeActive = false
    }
    scrubIntensity = 0
  }

  function vibrate(ms: number): void {
    const now = performance.now()
    if (now - lastVibe < 40) return
    lastVibe = now
    try {
      navigator.vibrate?.(ms)
    } catch {
      /* no vibration */
    }
  }

  export function visualFaces(): number[] {
    return stage ? stage.dice.map((d) => topFaceOf(d.quaternion)) : []
  }

  export function playObserved(f: number[], h: boolean[], seed: number): void {
    director?.playObserved(f, h, seed)
    if (!motionOk()) director?.skip()
  }

  export function showFaces(f: number[], h: boolean[]): void {
    director?.showFaces(f, h)
  }

  export function rolling(): boolean {
    return phase === 'shaking' || phase === 'rolling'
  }

  function pickDie(e: MouseEvent): void {
    if (!stage || phase !== 'idle') return
    const rect = canvasEl.getBoundingClientRect()
    const p = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    const ray = new Raycaster()
    ray.setFromCamera(p, stage.camera)
    const hit = ray.intersectObjects(stage.dice.filter((d) => d.visible), false)[0]
    if (!hit) return
    const idx = stage.dice.indexOf(hit.object as (typeof stage.dice)[number])
    if (idx >= 0) {
      unlock()
      onPick?.(idx)
    }
  }

  $effect(() => {
    director?.setHighlight([...highlight])
  })

  $effect(() => {
    stage?.setDiceColor(color)
  })

  // placed dice lift off the shelf; a new round's faces re-lay the shelf
  let prevHidden = untrack(() => [...hidden])
  let prevFaces = untrack(() => [...faces])
  $effect(() => {
    const h = [...hidden]
    const f = [...faces]
    const newRound = f.some((v, i) => v !== prevFaces[i]) && h.every((x) => !x)
    if (director && phase === 'idle') {
      if (newRound && f.every((v) => v > 0) && prevFaces.some((v) => v === 0 || h.some(Boolean))) {
        // faces arrived without a local throw (observer / restore): lay them out
        director.showFaces(f, h)
      } else {
        h.forEach((x, i) => {
          if (x && !prevHidden[i]) director!.hideDie(i)
        })
        if (h.every((x) => !x) && prevHidden.some(Boolean)) director.showFaces(f, h)
      }
    }
    prevHidden = h
    prevFaces = f
  })

  // Mount-once: no reactive dependencies (see yachtnight history).
  $effect(() => {
    stage = createStage(canvasEl)
    director = new RollDirector(stage, {
      onPhase: (p) => {
        phase = p
        onPhase?.(p)
      },
      onImpact: (s) => {
        dieImpact(s)
        vibrate(Math.round(10 + s * 25))
      },
      onRattle: (i) => {
        rattleTick(i)
        vibrate(Math.round(5 + i * 10))
      },
      onRevealed: (f) => onRevealed?.(f),
    })
    untrack(() => {
      stage!.setDiceColor(color)
      director!.showFaces([...faces], [...hidden])
      director!.setHighlight([...highlight])
    })

    const ro = new ResizeObserver(() => {
      const r = hostEl.getBoundingClientRect()
      stage?.setSize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)))
    })
    ro.observe(hostEl)
    const detachKeys = attachKeys(sink)

    let last = performance.now()
    let raf = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (director) {
        director.intensity = Math.max(scrubIntensity, shakeActive ? shake.intensity : 0)
        director.pointerX = scrubPointerX
        director.frame(dt)
      }
      stage?.render()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      detachKeys()
      stopShake()
      director?.dispose()
      stage?.dispose()
      stage = null
      director = null
    }
  })

  $effect(() => {
    const el = cupEl
    if (!el) return
    return attachScrub(el, sink)
  })

  const shaking = $derived(phase === 'shaking')
</script>

<div class="stage" bind:this={hostEl} data-phase={phase}>
  <canvas bind:this={canvasEl} onclick={pickDie}></canvas>

  {#if canRoll}
    <button
      bind:this={cupEl}
      class="cup-grip"
      class:shaking
      class:orange={color === 'orange'}
      aria-label="dice cup: hold and shake, release to throw. Keyboard: hold Space, mash arrow keys, release Space."
      onclick={(e) => e.preventDefault()}
    >
      {#if phase === 'idle'}
        <span class="cup-hint label">hold and shake</span>
      {/if}
    </button>
  {/if}

  {#if phase === 'rolling'}
    <button class="skip btn--quiet label" onclick={() => director?.skip()}>skip</button>
  {/if}
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 120px;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
  }
  .cup-grip {
    position: absolute;
    left: 50%;
    bottom: 6%;
    translate: -50% 0;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--blue) 50%, transparent);
    background: radial-gradient(circle, color-mix(in srgb, var(--blue) 24%, transparent) 0%, transparent 70%);
    box-shadow: none;
    color: var(--ink);
    cursor: grab;
    touch-action: none;
    display: grid;
    place-items: center;
    text-transform: none;
  }
  .cup-grip.orange {
    border-color: color-mix(in srgb, var(--orange) 50%, transparent);
    background: radial-gradient(circle, color-mix(in srgb, var(--orange) 24%, transparent) 0%, transparent 70%);
  }
  .cup-grip:active,
  .cup-grip.shaking {
    cursor: grabbing;
  }
  .cup-hint {
    pointer-events: none;
    color: var(--ink);
    animation: breathe 2.4s ease-in-out infinite;
  }
  @keyframes breathe {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }
  .skip {
    position: absolute;
    right: var(--sp-3);
    bottom: var(--sp-3);
  }
</style>
