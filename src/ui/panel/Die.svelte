<script lang="ts">
  interface Props {
    value: number
    color: 'blue' | 'orange' | 'token' | 'traffic' | 'hidden'
    size?: number
  }
  let { value, color, size = 34 }: Props = $props()
  const PIPS: Record<number, [number, number][]> = {
    0: [],
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[26, 26], [50, 50], [74, 74]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  }
  const pips = $derived(PIPS[Math.max(0, Math.min(6, value))] ?? [])
</script>

<svg class="die {color}" width={size} height={size} viewBox="0 0 100 100" aria-label="{color} die showing {value}">
  <rect x="4" y="4" width="92" height="92" rx="18" class="body" />
  {#if color === 'hidden'}
    <text x="50" y="62" text-anchor="middle" class="q">?</text>
  {:else}
    {#each pips as [x, y]}
      <circle cx={x} cy={y} r="9" class="pip" />
    {/each}
  {/if}
</svg>

<style>
  .die {
    display: block;
    flex: none;
  }
  .body {
    fill: var(--blue);
    stroke: rgba(0, 0, 0, 0.35);
    stroke-width: 2;
  }
  .orange .body {
    fill: var(--orange);
  }
  .token .body {
    fill: #c9c2b2;
  }
  .traffic .body {
    fill: #1a1f26;
    stroke: var(--ink-dim);
  }
  .hidden .body {
    fill: #1a222c;
    stroke: var(--hairline-2);
  }
  .pip {
    fill: #fff;
  }
  .token .pip {
    fill: #1a1a1a;
  }
  .q {
    fill: var(--ink-dim);
    font-family: var(--font-mono);
    font-size: 54px;
  }
</style>
