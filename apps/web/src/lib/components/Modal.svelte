<script lang="ts">
  import type { Snippet } from "svelte";
  import Drawer from "./Drawer.svelte";
  import Icon from "./Icon.svelte";

  let {
    title,
    onclose,
    children,
    wide = false,
  }: {
    title: string;
    onclose: () => void;
    children: Snippet;
    /** Wider variant (max-w-2xl instead of max-w-md), for content like tables. */
    wide?: boolean;
  } = $props();
</script>

{#snippet header(showClose: boolean)}
  {#if showClose}
    <button
      class="text-dim hover:bg-surface-2 hover:text-fg absolute top-3 right-3 rounded-full p-1.5"
      aria-label="Fermer"
      onclick={onclose}>
      <Icon name="x" class="h-5 w-5" />
    </button>
  {/if}
  <h3 id="modal-title" class="font-display mb-4 text-lg font-bold">
    {title}
  </h3>
{/snippet}

<!-- Mobile: a real swipe-to-dismiss bottom sheet, same primitive as the nav
     drawer (MenuSheet) — no close cross, the swipe/backdrop tap covers it.
     Stacked above FocusOverlay (z-50) since a Modal can be opened from within
     a focused comment on touch. Desktop: a centered dialog, below. -->
<Drawer {onclose} labelledby="modal-title" zIndex={60}>
  <div
    data-drawer-scroll
    class="relative touch-pan-y overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
    {@render header(false)}
    {@render children()}
  </div>
</Drawer>

<div class="fixed inset-0 z-[60] hidden items-center justify-center md:flex">
  <button
    class="absolute inset-0 cursor-default bg-black/60"
    aria-label="Fermer"
    onclick={onclose}></button>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    class="card relative z-10 w-full {wide
      ? 'max-w-2xl'
      : 'max-w-md'} rounded-2xl p-5">
    {@render header(true)}
    {@render children()}
  </div>
</div>
