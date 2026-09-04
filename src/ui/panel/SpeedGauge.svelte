<script lang="ts">
  interface Props {
    aeroBlue: number
    aeroOrange: number
    brake: number
    speed: number | null
    final: boolean
    ice: boolean
  }
  let { aeroBlue, aeroOrange, brake, speed, final, ice }: Props = $props()
  // arc from 2 (left, 200deg) to 12 (right, -20deg)
  const angle = (v: number) => Math.PI * (1 + (0.1 - 1.2 * ((v - 2) / 10)))
  const pt = (v: number, r: number) => [100 + Math.cos(angle(v)) * r, 96 - Math.sin(angle(v)) * r]
  const arc = (from: number, to: number, r: number) => {
    const [x1, y1] = pt(from, r)
    const [x2, y2] = pt(to, r)
    return `M${x1} ${y1} A${r} ${r} 0 ${to - from > 8.3 ? 1 : 0} 1 ${x2} ${y2}`
  }
  const brakeMax = $derived(ice ? 5 : 6)
</script>

<svg class="gauge" viewBox="0 0 200 110" aria-label="speed gauge, blue marker {aeroBlue}, orange marker {aeroOrange}, brakes {brake}">
  <path d={arc(2, 12, 74)} fill="none" stroke="var(--hairline-2)" stroke-width="10" />
  <path d={arc(2, aeroBlue + 0.5, 74)} fill="none" stroke="var(--blue-lo)" stroke-width="10" opacity="0.9" />
  <path d={arc(aeroBlue + 0.5, Math.min(12, aeroOrange + 0.5), 74)} fill="none" stroke="#2c3a2f" stroke-width="10" />
  {#if aeroOrange < 12}
    <path d={arc(aeroOrange + 0.5, 12, 74)} fill="none" stroke="var(--orange-lo)" stroke-width="10" />
  {/if}
  {#each Array.from({ length: 11 }, (_, i) => i + 2) as v}
    {@const [x, y] = pt(v, 60)}
    <text {x} y={y + 3} text-anchor="middle" class="tick" class:on={speed === v}>{v}</text>
  {/each}
  <!-- aerodynamics markers -->
  {#each [[aeroBlue + 0.5, 'var(--blue)'], [aeroOrange + 0.5, 'var(--orange)']] as [v, c]}
    {@const [x1, y1] = pt(Number(v), 66)}
    {@const [x2, y2] = pt(Number(v), 84)}
    <line {x1} {y1} {x2} {y2} stroke={String(c)} stroke-width="3" stroke-linecap="round" />
  {/each}
  <!-- brake arc under the speed arc -->
  <path d={arc(2, brakeMax, 48)} fill="none" stroke="var(--hairline)" stroke-width="5" />
  {#if brake >= 2}
    <path d={arc(2, brake + 0.5, 48)} fill="none" stroke="var(--red)" stroke-width="5" opacity="0.85" />
  {/if}
  {#if speed !== null}
    {@const [x, y] = pt(Math.max(2, Math.min(12, speed)), 20)}
    <line x1="100" y1="96" x2={x} y2={y} stroke="var(--ink)" stroke-width="2" />
    {@const [nx, ny] = pt(Math.max(2, Math.min(12, speed)), 70)}
    <line x1="100" y1="96" x2={nx} y2={ny} stroke="var(--ink)" stroke-width="2" />
  {/if}
  <circle cx="100" cy="96" r="5" fill="var(--panel-3)" stroke="var(--hairline-2)" />
  <text x="100" y="86" text-anchor="middle" class="readout mono">{speed ?? '--'}</text>
  <text x="100" y="108" text-anchor="middle" class="cap label">{final ? 'brakes' : 'speed'}</text>
</svg>

<style>
  .gauge {
    width: 100%;
    max-width: 220px;
    display: block;
  }
  .tick {
    fill: var(--ink-dim);
    font-family: var(--font-mono);
    font-size: 9px;
  }
  .tick.on {
    fill: var(--ink);
    font-weight: 700;
  }
  .readout {
    fill: var(--ink);
    font-size: 15px;
  }
  .cap {
    fill: var(--ink-dim);
    font-size: 7px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
</style>
