<script lang="ts">
  import { untrack } from 'svelte'
  import { createWindshield } from '../scene/windshield'
  import type { Windshield } from '../scene/windshield'
  import type { ViewParams } from '../scene/view-params'
  import DiceStage from './DiceStage.svelte'
  import { motionOk } from './motion'

  /** #lab or #lab=3,1,4,6 forces the faces the next throw reveals. */
  function parseForced(): number[] | null {
    const m = location.hash.match(/#lab=([1-6](?:,[1-6]){3})/)
    return m ? m[1].split(',').map(Number) : null
  }

  let faces = $state<number[]>([0, 0, 0, 0])
  let hidden = $state<boolean[]>([false, false, false, false])
  let color = $state<'blue' | 'orange'>('blue')
  let forced = $state<string>(parseForced()?.join(',') ?? '')
  let stageRef: DiceStage | undefined = $state()
  let rolling = $state(false)

  let params = $state<ViewParams>({ distance: 0.2, altitude: 0.8, bank: 0, traffic: [{ dist: 0.5, count: 2 }, { dist: 0.8, count: 1 }], timeOfDay: 'night', weather: 'rain', terrain: 'city', status: 'flying', speed: 7 })
  let wsCanvas: HTMLCanvasElement
  let wsHost: HTMLDivElement
  let ws: Windshield | null = null
  $effect(() => {
    ws = createWindshield(wsCanvas)
    const ro = new ResizeObserver(() => {
      const r = wsHost.getBoundingClientRect()
      ws?.setSize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)))
    })
    ro.observe(wsHost)
    untrack(() => ws?.setParams({ ...params }))
    let last = performance.now()
    let raf = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ws?.frame(motionOk() ? dt : 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      ws?.dispose()
    }
  })
  $effect(() => {
    ws?.setParams({ ...params, traffic: [...params.traffic] })
  })

  function onRoll(): number[] {
    const f = forced.match(/^[1-6],[1-6],[1-6],[1-6]$/) ? forced.split(',').map(Number) : Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6))
    faces = f
    hidden = [false, false, false, false]
    return f
  }

  $effect(() => {
    ;(window as unknown as Record<string, unknown>).__lab = {
      visualFaces: () => stageRef?.visualFaces() ?? [],
      faces: () => [...faces],
      sceneParams: () => ({ ...params }),
      setParams: (p: Partial<ViewParams>) => (params = { ...params, ...p }),
    }
  })
</script>

<main class="lab" data-rolling={rolling} data-faces={faces.join(',')}>
  <div class="ws" bind:this={wsHost}><canvas bind:this={wsCanvas}></canvas></div>
  <div class="controls panel">
    <div class="row">
      <label class="label">distance <input type="range" min="0" max="1" step="0.01" bind:value={params.distance} /></label>
      <label class="label">altitude <input type="range" min="0" max="1" step="0.01" bind:value={params.altitude} /></label>
      <label class="label">bank <input type="range" min="-27" max="27" step="9" bind:value={params.bank} /></label>
      <label class="label">weather
        <select bind:value={params.weather}>{#each ['clear', 'fog', 'rain', 'storm', 'snow', 'haze'] as w}<option value={w}>{w}</option>{/each}</select>
      </label>
      <label class="label">time
        <select bind:value={params.timeOfDay}>{#each ['night', 'dusk', 'dawn', 'day'] as t}<option value={t}>{t}</option>{/each}</select>
      </label>
      <label class="label">terrain
        <select bind:value={params.terrain}>{#each ['city', 'water', 'mountain', 'plain', 'ice'] as t}<option value={t}>{t}</option>{/each}</select>
      </label>
      <label class="label">status
        <select bind:value={params.status}>{#each ['flying', 'landed', 'crashed'] as t}<option value={t}>{t}</option>{/each}</select>
      </label>
    </div>
    <div class="row">
      <label class="label">forced faces <input type="text" bind:value={forced} placeholder="3,1,4,6" size="8" /></label>
      <label class="label">dice
        <select bind:value={color}><option value="blue">blue</option><option value="orange">orange</option></select>
      </label>
      <button class="btn--quiet" onclick={() => (hidden = hidden.map((h, i) => (i === hidden.indexOf(false) ? true : h)))}>place next</button>
      <button class="btn--quiet" onclick={() => (hidden = [false, false, false, false])}>reset</button>
      <a class="btn--quiet" href={location.pathname}>home</a>
      <span class="stamp label">{__BUILD_STAMP__}</span>
    </div>
  </div>
  <div class="shelf">
    <DiceStage bind:this={stageRef} {faces} {hidden} {color} highlight={[1, 1, 1, 1]} canRoll={true} {onRoll} onPhase={(p) => (rolling = p === 'shaking' || p === 'rolling')} />
  </div>
</main>

<style>
  .lab {
    min-height: 100dvh;
    display: grid;
    grid-template-rows: 40dvh auto 1fr;
  }
  .ws {
    position: relative;
    overflow: hidden;
  }
  .ws canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
  .controls {
    margin: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
    align-items: center;
  }
  label {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .shelf {
    min-height: 240px;
    margin: 0 var(--sp-2) var(--sp-2);
    border: 1px solid var(--hairline);
    border-radius: var(--r-lg);
    background: radial-gradient(ellipse at 50% 30%, #131b24, #05080b);
  }
</style>
