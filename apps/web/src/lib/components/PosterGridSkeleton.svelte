<script lang="ts">
  // Loading placeholder for poster listings (books/games/media): a grid of
  // shimmering poster cards.
  import PosterGrid from "./PosterGrid.svelte";

  let { count = 10 }: { count?: number } = $props();
</script>

<PosterGrid>
  {#each { length: count } as _, i (i)}
    <div class="card">
      <div class="aspect-2/3 w-full skeleton"></div>
      <div class="flex flex-col gap-2 p-3">
        <div class="h-3.5 w-4/5 skeleton rounded"></div>
        <div class="h-3 w-1/2 skeleton rounded"></div>
      </div>
    </div>
  {/each}
</PosterGrid>
