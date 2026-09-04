<script lang="ts">
  interface Props {
    axis: number
    /** permitted axis values on the current space, if a Turns tab is printed */
    corridor?: number[] | null
  }
  let { axis, corridor = null }: Props = $props()
  const deg = $derived(axis * 9)
</script>

<svg class="horizon" viewBox="0 0 200 140" aria-label="artificial horizon, axis {axis}">
  <defs>
    <clipPath id="hz-clip"><circle cx="100" cy="72" r="58" /></clipPath>
  </defs>
  <g clip-path="url(#hz-clip)">
    <g style="transform: rotate({deg}deg); transform-origin: 100px 72px;">
      <rect x="-50" y="-100" width="300" height="172" fill="#1d3f7a" />
      <rect x="-50" y="72" width="300" height="200" fill="#4a3018" />
      <line x1="-50" y1="72" x2="250" y2="72" stroke="#e6ebf0" stroke-width="1.5" />
      {#each [-20, -10, 10, 20] as p}
        <line x1={100 - (Math.abs(p) === 20 ? 22 : 12)} y1={72 + p * 1.6} x2={100 + (Math.abs(p) === 20 ? 22 : 12)} y2={72 + p * 1.6} stroke="#e6ebf0" stroke-width="1" opacity="0.7" />
      {/each}
    </g>
  </g>
  <circle cx="100" cy="72" r="58" fill="none" stroke="var(--hairline-2)" stroke-width="2" />
  <!-- aircraft symbol -->
  <path d="M60 72 h26 l6 6 h16 l6 -6 h26" fill="none" stroke="var(--amber)" stroke-width="3" stroke-linecap="round" />
  <circle cx="100" cy="72" r="2.5" fill="var(--amber)" />
  <!-- bank scale: five legal positions -->
  {#each [-2, -1, 0, 1, 2] as p}
    {@const a = ((p * 9 - 90) * Math.PI) / 180}
    {@const ok = corridor === null || corridor.includes(p)}
    <circle cx={100 + Math.cos(a) * 66} cy={72 + Math.sin(a) * 66} r={p === axis ? 4 : 2.5} fill={p === axis ? 'var(--amber)' : ok ? 'var(--ink-dim)' : 'var(--red)'} />
  {/each}
  {#each [-3, 3] as p}
    {@const a = ((p * 9 - 90) * Math.PI) / 180}
    <text x={100 + Math.cos(a) * 68} y={72 + Math.sin(a) * 68 + 3} text-anchor="middle" fill="var(--red)" font-size="9" font-family="var(--font-mono)">X</text>
  {/each}
  <polygon points="100,3 95,11 105,11" fill="var(--ink)" />
</svg>

<style>
  .horizon {
    width: 100%;
    max-width: 200px;
    display: block;
  }
  .horizon g[style] {
    transition: transform 500ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
</style>
