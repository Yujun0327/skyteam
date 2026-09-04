<script lang="ts">
  import type { Snippet } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { dur, settle } from './motion'

  interface Props {
    title?: string
    onClose?: () => void
    children: Snippet
  }
  let { title = '', onClose, children }: Props = $props()

  function backdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose?.()
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose?.()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div class="backdrop" onclick={backdrop} role="dialog" aria-modal="true" tabindex="-1" transition:fade={{ duration: dur(160) }}>
  <div class="sheet panel" transition:fly={{ y: 26, duration: dur(260), easing: settle }}>
    <div class="head">
      <span class="label">{title}</span>
      <button class="btn--quiet" onclick={onClose} aria-label="close">close</button>
    </div>
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(3 5 8 / 0.78);
    display: grid;
    place-items: center;
    z-index: 40;
    padding: var(--sp-4);
  }
  .sheet {
    padding: var(--sp-4) var(--sp-5) var(--sp-5);
    max-width: min(92vw, 560px);
    max-height: 88dvh;
    overflow-y: auto;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--sp-3);
  }
  @media (max-width: 640px) {
    .backdrop {
      place-items: end center;
      padding: 0;
    }
    .sheet {
      width: 100%;
      max-width: none;
      border-radius: var(--r-lg) var(--r-lg) 0 0;
      padding-bottom: max(var(--sp-5), env(safe-area-inset-bottom));
    }
  }
</style>
