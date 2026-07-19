<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  let {
    title,
    onclose,
    children,
  }: {
    title: string;
    onclose: () => void;
    children: Snippet;
  } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onclose()} />

<div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
  <button
    class="absolute inset-0 cursor-default bg-black/60"
    aria-label="Fermer"
    onclick={onclose}></button>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    class="card relative z-10 w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl">
    <button
      class="text-dim hover:bg-surface-2 hover:text-fg absolute top-3 right-3 rounded-full p-1.5"
      aria-label="Fermer"
      onclick={onclose}>
      <Icon name="x" class="h-5 w-5" />
    </button>
    <h3 id="modal-title" class="font-display mb-4 text-lg font-bold">
      {title}
    </h3>
    {@render children()}
  </div>
</div>
