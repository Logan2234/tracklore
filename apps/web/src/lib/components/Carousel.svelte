<script lang="ts" generics="T">
  // Content-agnostic horizontal scroll-snap strip, shared by every "row of
  // cards" in the app (related titles, cast, home dashboard resume strips...).
  // Navigable by mouse drag or by hover-revealed edge arrows; native touch
  // swipe still works since only mouse pointers drive the drag logic. Callers
  // supply their own per-item markup via the `card` snippet.
  import Icon from "./Icon.svelte";
  import type { Snippet } from "svelte";

  let {
    items,
    keyOf,
    card,
    gap = "gap-4",
    wrapClass = "-mx-4 md:mx-0",
    innerClass = "px-4 pt-2 pb-2 md:px-0",
  }: {
    items: T[];
    keyOf: (item: T) => string;
    card: Snippet<[T]>;
    /** Tailwind gap class between cards — cast strips use a tighter gap-3. */
    gap?: string;
    /** Outer negative-margin/breakpoint class, tuned to the page gutter. */
    wrapClass?: string;
    /** Inner scroll-track padding, tuned to the surrounding layout. */
    innerClass?: string;
  } = $props();

  let stripEl = $state<HTMLDivElement | null>(null);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);
  let dragging = $state(false);

  function updateEdges() {
    const el = stripEl;
    if (!el) return;
    canScrollLeft = el.scrollLeft > 4;
    canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 4;
  }

  function scrollByPage(dir: 1 | -1) {
    const el = stripEl;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  $effect(() => {
    items;
    updateEdges();
    const el = stripEl;
    if (!el) return;
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    window.addEventListener("resize", updateEdges);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateEdges);
    };
  });

  // Drag-to-pan (mouse only — touch keeps its native swipe scroll). A real
  // drag (the strip actually ended up scrolled somewhere else) suppresses
  // the click on whatever's underneath so panning doesn't accidentally
  // trigger a link/button. Listens on window (not pointer capture) so the
  // click that follows keeps its normal hit-tested target — pointer capture
  // retargets that click to the strip itself, silently swallowing it.
  let dragged = false;
  let startX = 0;
  let startScroll = 0;

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0 || !stripEl) return;
    // Nothing to pan (row fits without overflow) — skip drag tracking
    // entirely so ordinary mouse jitter during a click never gets
    // mistaken for a drag and cancels the underlying link/button.
    if (stripEl.scrollWidth <= stripEl.clientWidth) return;
    dragging = true;
    startX = e.clientX;
    startScroll = stripEl.scrollLeft;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e: PointerEvent) {
    if (!stripEl) return;
    stripEl.scrollLeft = startScroll - (e.clientX - startX);
  }

  // Checked once, from the strip's actual net displacement, rather than
  // latching on any single transient movement sample — a mouse click is
  // rarely perfectly still, and momentary overshoot below this threshold
  // must not get mistaken for a deliberate pan.
  function onPointerUp() {
    dragging = false;
    dragged = stripEl ? Math.abs(stripEl.scrollLeft - startScroll) > 4 : false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  function onClickCapture(e: MouseEvent) {
    if (dragged) {
      e.preventDefault();
      e.stopPropagation();
    }
    dragged = false;
  }
</script>

{#if items.length > 0}
  <div class="group relative {wrapClass}">
    <!-- Drag-to-pan is a progressive enhancement over native scroll/touch;
         the strip's content (links/buttons) stays independently reachable. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={stripEl}
      class="no-scrollbar flex snap-x {gap} {innerClass} overflow-x-auto select-none {dragging
        ? 'cursor-grabbing'
        : 'cursor-grab'}"
      onscroll={updateEdges}
      onpointerdown={onPointerDown}
      onclickcapture={onClickCapture}>
      {#each items as item (keyOf(item))}
        {@render card(item)}
      {/each}
    </div>

    {#if canScrollLeft}
      <button
        type="button"
        aria-label="Précédent"
        class="absolute top-1/2 left-2 -translate-y-1/2 rounded-full border border-border bg-bg/90 p-1.5 opacity-0 shadow-md backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-surface-2"
        onclick={() => scrollByPage(-1)}>
        <Icon name="chevron-left" class="h-4 w-4" />
      </button>
    {/if}
    {#if canScrollRight}
      <button
        type="button"
        aria-label="Suivant"
        class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full border border-border bg-bg/90 p-1.5 opacity-0 shadow-md backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-surface-2"
        onclick={() => scrollByPage(1)}>
        <Icon name="chevron-right" class="h-4 w-4" />
      </button>
    {/if}
  </div>
{/if}
