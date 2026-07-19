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
  <p class="text-dim mt-1.5 text-sm">{label}</p>
  {#if hint}
    <p class="text-dim/70 mt-0.5 text-xs">{hint}</p>
  {/if}
</div>
