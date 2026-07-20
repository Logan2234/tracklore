<script lang="ts">
  import Avatar from "./Avatar.svelte";
  import Icon from "./Icon.svelte";

  // Fullscreen zoom for a profile avatar. Avatar is a generated identicon
  // (inline SVG, no bitmap `src`), so it can't reuse Lightbox — same chrome,
  // just a bigger Avatar instead of an <img>.
  let { seed, onClose }: { seed: string; onClose: () => void } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onClose()} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
  role="dialog"
  aria-modal="true"
  aria-label="Avatar en grand">
  <button
    type="button"
    class="absolute inset-0"
    aria-label="Fermer"
    onclick={onClose}>
  </button>

  <button
    type="button"
    class="absolute top-4 right-4 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60"
    aria-label="Fermer"
    onclick={onClose}>
    <Icon name="x" class="h-5 w-5" />
  </button>

  <div class="pointer-events-none relative">
    <Avatar {seed} size={280} />
  </div>
</div>
