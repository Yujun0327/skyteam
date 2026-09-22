<script lang="ts">
  import type { ChatLine } from '../app/session.svelte'
  interface Props {
    lines: ChatLine[]
    open: boolean
    me: string
    onSay: (text: string) => void
  }
  let { lines, open, me, onSay }: Props = $props()
  let text = $state('')
  const QUICK = ['Axis first', 'You take engines', 'I have the radio', 'Hold the coffee', 'Reroll this round', 'Clear the traffic', 'Ready to roll']
  function send() {
    if (!text.trim()) return
    onSay(text)
    text = ''
  }
</script>

<aside class="dock" class:closed={!open} aria-label="crew intercom">
  <div class="head label">Intercom {open ? '' : ' — sterile cockpit, no talking'}</div>
  <div class="lines">
    {#each lines.slice(-8) as l (l.id)}
      <div class="line" class:mine={l.from === me}>
        <span class="who" class:blue={l.seat === 0} class:orange={l.seat === 1}>{l.name}</span>
        <span class="txt">{l.text}</span>
      </div>
    {/each}
  </div>
  {#if open}
    <div class="quick">
      {#each QUICK as q}
        <button class="btn--quiet q" onclick={() => onSay(q)}>{q}</button>
      {/each}
    </div>
    <form class="compose" onsubmit={(e) => (e.preventDefault(), send())}>
      <input type="text" bind:value={text} placeholder="strategy only, never the dice" maxlength="200" />
      <button type="submit">send</button>
    </form>
  {/if}
</aside>

<style>
  .dock {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: rgba(5, 8, 11, 0.9);
    border: 1px solid var(--hairline);
    border-radius: var(--r-lg);
    max-width: 420px;
    width: 100%;
  }
  .dock.closed .lines {
    opacity: 0.5;
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 120px;
    overflow-y: auto;
    font-size: var(--fs-sm);
  }
  .who {
    color: var(--ink-dim);
    margin-right: 6px;
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .who.blue {
    color: var(--blue-hi);
  }
  .who.orange {
    color: var(--orange-hi);
  }
  .quick {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .q {
    font-size: 0.65rem;
    padding: 3px 6px;
    border: 1px solid var(--hairline);
  }
  .compose {
    display: flex;
    gap: 6px;
  }
  .compose input {
    flex: 1;
    min-width: 0;
  }
</style>
