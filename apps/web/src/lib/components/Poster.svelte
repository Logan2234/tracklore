<script lang="ts">
  // 2:3 poster. Falls back to a deterministic gradient (stable per title) with
  // the title set in the display face, so a missing artwork still reads well.
  let {
    src = null,
    title,
    class: cls = "",
  }: { src?: string | null; title: string; class?: string } = $props();

  const hue = $derived(
    [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7),
  );
</script>

{#if src}
  <img
    {src}
    alt={title}
    loading="lazy"
    class="aspect-2/3 w-full bg-surface-2 object-cover {cls}" />
{:else}
  <div
    class="flex aspect-2/3 w-full items-end p-2 {cls}"
    style="background: linear-gradient(150deg, hsl({hue} 32% 24%), hsl({(hue +
      40) %
      360} 34% 13%));">
    <span
      class="line-clamp-3 font-display text-xs leading-tight font-bold text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">
      {title}
    </span>
  </div>
{/if}
