<script lang="ts">
  // Lets the user compose the mobile bottom bar: 3–7 ordered shortcuts, the
  // "Menu" launcher always kept. Choices are gated by the enabled domains, so a
  // disabled domain never appears here (and a stored shortcut for one silently
  // drops on the next save). Persisted server-side via updateMe.
  import { ApiError, updateMe } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import {
    DEFAULT_BOTTOM_SHORTCUTS,
    resolveBottomShortcuts,
    resolveShortcutChoices,
  } from "$lib/navigation";

  const MIN = 3;
  const MAX = 7;

  let error = $state("");
  let saving = $state(false);

  const gate = $derived({ isDomainEnabled, isAdmin: auth.isAdmin });

  // Stored order, gated to what's visible now (drops disabled/unknown ids and
  // keeps "menu"). This is the working set every action rebuilds from.
  const selected = $derived(
    resolveBottomShortcuts(
      auth.user?.mobileNavShortcuts?.length
        ? auth.user.mobileNavShortcuts
        : DEFAULT_BOTTOM_SHORTCUTS,
      gate,
    ),
  );
  const selectedIds = $derived(selected.map((d) => d.id));

  // Pinnable destinations not already in the bar.
  const choices = $derived(
    resolveShortcutChoices(gate).filter((d) => !selectedIds.includes(d.id)),
  );

  const canRemove = $derived(selected.length > MIN);
  const canAdd = $derived(selected.length < MAX);

  async function save(next: string[]) {
    error = "";
    saving = true;
    try {
      await updateMe({ mobileNavShortcuts: next });
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    } finally {
      saving = false;
    }
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...selectedIds];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    void save(next);
  }

  function remove(id: string) {
    if (!canRemove || id === "menu") return;
    void save(selectedIds.filter((x) => x !== id));
  }

  function add(id: string) {
    if (!canAdd) return;
    void save([...selectedIds, id]);
  }
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-1 text-lg font-bold">
      Barre de navigation mobile
    </h2>
    <p class="text-dim mb-4 text-sm">
      Choisis les raccourcis du bas de l’écran sur téléphone ({MIN} à {MAX}) et
      leur ordre. « Menu » reste toujours présent — c’est lui qui ouvre toutes
      les pages.
    </p>

    <ul class="divide-border divide-y">
      {#each selected as item, i (item.id)}
        {@const locked = item.id === "menu"}
        <li class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <span class="timecode w-5 shrink-0 text-center text-xs">{i + 1}</span>
          <Icon name={item.icon} class="text-accent h-5 w-5 shrink-0" />
          <span class="min-w-0 flex-1 truncate font-semibold">
            {item.label}
            {#if locked}
              <span class="text-dim ml-1 text-xs font-normal"
                >· toujours affiché</span>
            {/if}
          </span>

          <div class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              class="hover:bg-surface-2 text-dim grid h-8 w-8 place-items-center rounded-lg disabled:pointer-events-none disabled:opacity-30"
              aria-label="Monter"
              disabled={saving || i === 0}
              onclick={() => move(i, -1)}>
              <Icon name="chevron-left" class="h-4 w-4 rotate-90" />
            </button>
            <button
              type="button"
              class="hover:bg-surface-2 text-dim grid h-8 w-8 place-items-center rounded-lg disabled:pointer-events-none disabled:opacity-30"
              aria-label="Descendre"
              disabled={saving || i === selected.length - 1}
              onclick={() => move(i, 1)}>
              <Icon name="chevron-left" class="h-4 w-4 rotate-[270deg]" />
            </button>
            <button
              type="button"
              class="hover:bg-danger/10 hover:text-danger text-dim grid h-8 w-8 place-items-center rounded-lg disabled:pointer-events-none disabled:opacity-30"
              aria-label="Retirer"
              disabled={saving || locked || !canRemove}
              title={locked
                ? "« Menu » ne peut pas être retiré."
                : !canRemove
                  ? `Au moins ${MIN} raccourcis.`
                  : undefined}
              onclick={() => remove(item.id)}>
              <Icon name="x" class="h-4 w-4" />
            </button>
          </div>
        </li>
      {/each}
    </ul>

    {#if choices.length > 0}
      <div class="border-border mt-4 border-t pt-4">
        <p class="text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
          Ajouter
        </p>
        <div class="flex flex-wrap gap-2">
          {#each choices as c (c.id)}
            <button
              type="button"
              class="chip inline-flex items-center gap-1.5 disabled:pointer-events-none disabled:opacity-40"
              disabled={saving || !canAdd}
              title={!canAdd ? `Maximum ${MAX} raccourcis.` : undefined}
              onclick={() => add(c.id)}>
              <Icon name={c.icon} class="h-3.5 w-3.5" />
              {c.label}
            </button>
          {/each}
        </div>
        {#if !canAdd}
          <p class="text-dim mt-2 text-xs">
            Maximum atteint — retire un raccourci pour en ajouter un autre.
          </p>
        {/if}
      </div>
    {/if}

    {#if error}
      <p class="text-danger mt-3 text-sm">{error}</p>
    {/if}
  </section>
{/if}
