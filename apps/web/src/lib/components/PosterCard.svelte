<script lang="ts">
  // Clickable poster tile for a library entry. The line(s) under the title
  // (status/rating, progress bar, ...) vary per domain, so they're a snippet.
  import type { Snippet } from "svelte";
  import Poster from "./Poster.svelte";

  let {
    href,
    src,
    title,
    favorite = false,
    meta,
  }: {
    href: string;
    src: string | null;
    title: string;
    favorite?: boolean;
    meta: Snippet;
  } = $props();
</script>

<a
  {href}
  class="card group hover:border-accent transition-[transform,border-color] duration-150 hover:-translate-y-0.5">
  <Poster {src} {title} />
  <div class="flex flex-col gap-1.5 p-3">
    <span class="font-display text-sm leading-tight font-semibold">
      {#if favorite}<span class="text-accent">★</span>&nbsp;{/if}{title}
    </span>
    {@render meta()}
  </div>
</a>
