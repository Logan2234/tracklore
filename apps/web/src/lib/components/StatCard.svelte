<script lang="ts">
  // Compact, uniform stat tile — the single building block of the stats grid,
  // so every number reads with the same weight and rhythm.
  let {
    value,
    label,
    hint,
  }: { value: string | number; label: string; hint?: string } = $props();
</script>

<div class="card px-4 py-3.5">
  <p class="font-display text-2xl leading-none font-bold tabular-nums">
    {value}
  </p>
  <p class="mt-1.5 text-sm text-dim">{label}</p>
  {#if hint}
    <p class="mt-0.5 text-xs text-dim/70">{hint}</p>
  {/if}
</div>
