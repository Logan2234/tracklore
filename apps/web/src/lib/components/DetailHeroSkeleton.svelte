<script lang="ts">
  // Loading placeholder for the detail pages (media/games/books/music):
  // mirrors their shared hero shape (backdrop, overlapping poster, title
  // block, tracking panel) instead of a bare "Chargement…" line.
  let { wide = true }: { wide?: boolean } = $props();
</script>

<div class="relative">
  <div class="h-44 w-full skeleton md:h-60"></div>
  <div class="absolute inset-0 bg-linear-to-t from-bg via-bg/50 to-transparent">
  </div>
</div>

<div
  class="relative z-10 mx-auto pb-6 md:pb-10 {wide
    ? 'max-w-5xl'
    : 'max-w-4xl'} px-4 md:px-8">
  <div class="-mt-24 flex flex-col gap-5 sm:flex-row sm:items-end md:-mt-28">
    <div class="aspect-2/3 w-32 shrink-0 skeleton rounded-xl shadow-lg md:w-44">
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-3">
      <div class="h-5 w-24 skeleton rounded-full"></div>
      <div class="h-8 w-3/4 skeleton rounded"></div>
      <div class="h-4 w-1/3 skeleton rounded"></div>
    </div>
  </div>
  <div class="mt-6 h-10 w-56 skeleton rounded-lg"></div>
</div>
