<script lang="ts" generics="T extends string">
  // Segmented status picker shared by books and games (media's status is
  // server-derived, not user-selectable this way).
  let {
    statuses,
    current,
    disabled,
    meta,
    desc,
    activeClass,
    onSelect,
  }: {
    statuses: T[];
    current: T;
    disabled: boolean;
    meta: Record<T, { label: string }>;
    desc: Record<T, string>;
    activeClass: Record<T, string>;
    onSelect: (status: T) => void;
  } = $props();
</script>

<div
  class="grid gap-1 rounded-xl border border-border bg-surface-2 p-1"
  style="grid-template-columns: repeat({statuses.length}, minmax(0, 1fr));"
  role="group"
  aria-label="Statut">
  {#each statuses as status (status)}
    <button
      type="button"
      aria-pressed={current === status}
      {disabled}
      title={desc[status]}
      class="rounded-lg py-2 text-xs font-bold transition-colors disabled:opacity-50 {current ===
      status
        ? activeClass[status]
        : 'text-dim hover:text-fg'}"
      onclick={() => onSelect(status)}>
      {meta[status].label}
    </button>
  {/each}
</div>
