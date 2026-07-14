<script lang="ts">
  import Icon from "./Icon.svelte";

  // A styled dropdown used across the library filter bars. Works in two modes:
  //  - multiselect: several values at once (status, media type). Trigger reads
  //    "Label : tous" when empty, "Label : N" otherwise.
  //  - single-select (multiselect=false): one value (sort). Trigger shows the
  //    chosen option's label.
  // Selection is always modelled as a string[]; single-select emits a 1-element
  // array. The caller owns the state and reacts through onChange.
  type Option = { label: string; value: string };

  let {
    label,
    options,
    values = [],
    multiselect = false,
    allLabel = "tous",
    onChange,
  }: {
    label: string;
    options: Option[];
    values?: string[];
    multiselect?: boolean;
    allLabel?: string;
    onChange: (values: string[]) => void;
  } = $props();

  let open = $state(false);

  const selectedOption = $derived(options.find((o) => o.value === values[0]));
  const triggerText = $derived(
    multiselect
      ? `${label} : ${values.length === 0 ? allLabel : values.length}`
      : (selectedOption?.label ?? label),
  );

  function choose(value: string) {
    if (multiselect) {
      onChange(
        values.includes(value)
          ? values.filter((v) => v !== value)
          : [...values, value],
      );
    } else {
      onChange([value]);
      open = false;
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && (open = false)} />

<div class="relative">
  <button
    type="button"
    class="chip inline-flex items-center gap-1.5"
    class:chip-on={multiselect && values.length > 0}
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={() => (open = !open)}>
    {triggerText}
    <Icon
      name="chevron-right"
      class="h-3.5 w-3.5 transition-transform {open
        ? 'rotate-[270deg]'
        : 'rotate-90'}" />
  </button>

  {#if open}
    <!-- Click-away backdrop (fixed so it covers the viewport). -->
    <button
      class="fixed inset-0 z-30 cursor-default"
      aria-label="Fermer"
      onclick={() => (open = false)}></button>
    <div
      role="listbox"
      class="absolute left-0 z-40 mt-1 min-w-48 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
      {#each options as o (o.value)}
        {@const on = values.includes(o.value)}
        <button
          type="button"
          role="option"
          aria-selected={on}
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2"
          onclick={() => choose(o.value)}>
          {#if multiselect}
            <span
              class="grid h-4 w-4 shrink-0 place-items-center rounded border {on
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-border'}">
              {#if on}<Icon name="check" class="h-3 w-3" />{/if}
            </span>
          {:else}
            <span class="grid h-4 w-4 shrink-0 place-items-center text-accent">
              {#if on}<Icon name="check" class="h-3.5 w-3.5" />{/if}
            </span>
          {/if}
          <span class="{on && !multiselect ? 'font-semibold' : ''} truncate">
            {o.label}
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>
