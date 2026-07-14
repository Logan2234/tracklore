<script lang="ts">
  import { tick } from "svelte";

  // Opt-in personal note: while empty it's a single "＋ Ajouter une note"
  // button, so cards that will never carry a note stay clean. Once revealed (or
  // when a note already exists) it's a plain textarea; "supprimer" clears it and
  // collapses back to the button.
  let {
    value = null,
    placeholder = "Notes personnelles…",
    onChange,
  }: {
    value?: string | null;
    placeholder?: string;
    onChange: (value: string | null) => void;
  } = $props();

  // Show the textarea when a note already exists, or once the user reveals it.
  let revealed = $state(false);
  let textarea = $state<HTMLTextAreaElement>();
  const open = $derived(revealed || Boolean(value));

  async function reveal() {
    revealed = true;
    await tick();
    textarea?.focus();
  }

  function remove() {
    revealed = false;
    onChange(null);
  }
</script>

{#if open}
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center">
      <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase">Prise de note</span>
      <button
        type="button"
        class="ml-auto font-mono text-[0.68rem] text-dim transition-colors hover:text-danger"
        onclick={remove}>
        supprimer
      </button>
    </div>
    <textarea
      bind:this={textarea}
      rows="3"
      {placeholder}
      class="input min-h-[66px] rounded-l-sm border-l-[3px] border-l-accent/50 bg-surface-2"
      value={value ?? ""}
      onchange={(e) => {
        const raw = e.currentTarget.value.trim();
        onChange(raw === "" ? null : raw);
      }}></textarea>
  </div>
{:else}
  <button
    type="button"
    class="self-start rounded-lg border border-dashed border-border px-3.5 py-2 text-sm font-semibold text-dim transition-colors hover:border-accent/45 hover:text-fg"
    onclick={reveal}>
    ＋ Ajouter une note
  </button>
{/if}
