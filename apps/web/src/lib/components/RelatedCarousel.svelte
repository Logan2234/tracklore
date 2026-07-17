<script lang="ts">
  // Horizontal "related titles" strip shared by the three detail pages
  // (same author / same franchise / similar titles / known-for...).
  import Poster from "./Poster.svelte";

  let {
    title,
    items,
  }: {
    title: string;
    items: { key: string; href: string; cover: string | null; title: string }[];
  } = $props();
</script>

{#if items.length > 0}
  <section class="mt-10">
    <h2 class="mb-3 font-display text-xl font-bold">{title}</h2>
    <div
      class="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pt-2 pb-2 md:mx-0 md:px-0">
      {#each items as item (item.key)}
        <a href={item.href} class="w-28 shrink-0 snap-start sm:w-32">
          <div class="card transition-colors hover:border-accent">
            <Poster src={item.cover} title={item.title} />
          </div>
          <p class="mt-1.5 truncate text-xs font-semibold">{item.title}</p>
        </a>
      {/each}
    </div>
  </section>
{/if}
