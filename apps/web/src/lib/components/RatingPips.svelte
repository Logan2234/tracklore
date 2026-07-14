<script lang="ts">
  // 0–10 rating as 11 tappable pips. Emits integers; "0" is a real score, so a
  // separate "effacer" clears back to unrated (null) — the distinction a bare
  // number input can't make. Legacy half-point values are shown on the nearest
  // pip (rounded), and any new pick writes an integer.
  let {
    value = null,
    label = "Ma note · sur 10",
    onChange,
  }: {
    value?: number | null;
    label?: string;
    onChange: (value: number | null) => void;
  } = $props();

  const pips = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // Rounded so a legacy 8.5 lights the "9" pip; picking always yields an integer.
  const selected = $derived(value === null ? null : Math.round(value));
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase"
      >{label}</span>
    <button
      type="button"
      class="ml-auto font-mono text-[0.7rem] text-dim transition-colors hover:text-danger {selected ===
      null
        ? 'invisible'
        : ''}"
      onclick={() => onChange(null)}>
      effacer
    </button>
  </div>
  <div class="grid grid-cols-11 gap-1" role="group" aria-label="Note sur 10">
    {#each pips as n (n)}
      {@const on = selected === n}
      {@const lit = selected !== null && n < selected}
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${n} sur 10`}
        class="h-8 rounded-lg border font-mono text-sm font-bold transition-colors {on
          ? 'border-transparent bg-accent text-accent-fg'
          : lit
            ? 'border-accent/30 bg-accent/15 text-fg'
            : 'border-border bg-surface-2 text-dim hover:border-accent/55 hover:text-fg'}"
        onclick={() => onChange(n)}>
        {n}
      </button>
    {/each}
  </div>
</div>
