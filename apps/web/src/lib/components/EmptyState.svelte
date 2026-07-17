<script lang="ts">
  // Dashed placeholder box for "nothing here yet" / "no results" states.
  import type { Snippet } from "svelte";

  let {
    class: cls = "",
    children,
  }: {
    class?: string;
    children: Snippet;
  } = $props();
</script>

<div
  class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim {cls}">
  {@render children()}
</div>
