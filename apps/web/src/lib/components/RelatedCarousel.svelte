<script lang="ts">
  // Poster+title carousel — thin wrapper around Carousel.svelte for the
  // common case (same author / same franchise / similar titles / same
  // artist...) shared by the four detail pages.
  import Carousel from "./Carousel.svelte";
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
    <Carousel {items} keyOf={(item) => item.key}>
      {#snippet card(item)}
        <a href={item.href} class="w-28 shrink-0 snap-start sm:w-32">
          <div class="card transition-colors hover:border-accent">
            <Poster src={item.cover} title={item.title} />
          </div>
          <p class="mt-1.5 truncate text-xs font-semibold">{item.title}</p>
        </a>
      {/snippet}
    </Carousel>
  </section>
{/if}
