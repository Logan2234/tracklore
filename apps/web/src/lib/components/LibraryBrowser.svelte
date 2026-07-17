<script lang="ts" generics="T">
  // Generic library browser shared by the games / books / media list pages:
  // fetch on mount, text filter, status multi-select, favorites toggle, sort +
  // direction, loading skeleton, the three empty states and the poster grid.
  // Everything domain-specific (comparators, labels, card markup, and media's
  // extra "type" filter) is injected via props/snippets.
  import { ApiError } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PosterGrid from "$lib/components/PosterGrid.svelte";
  import PosterGridSkeleton from "$lib/components/PosterGridSkeleton.svelte";
  import type { ComponentProps, Snippet } from "svelte";

  type IconName = ComponentProps<typeof Icon>["name"];

  interface Option {
    label: string;
    value: string;
  }

  let {
    icon,
    title,
    subtitle,
    noun,
    load,
    keyOf,
    titleOf,
    favoriteOf,
    statusOptions,
    statusMatch,
    sorts,
    defaultSort,
    compare,
    card,
    extraFilters,
    extraActive = false,
    extraMatch,
    onClearExtra,
  }: {
    icon: IconName;
    title: string;
    /** Header subtitle, e.g. `(n) => "3 livres"`. */
    subtitle: (count: number) => string;
    /** Masculine noun for the empty-state copy: "livre", "jeu", "titre". */
    noun: string;
    load: () => Promise<T[]>;
    /** Stable key for the poster grid's keyed each. */
    keyOf: (entry: T) => string;
    /** Title used by the text filter. */
    titleOf: (entry: T) => string;
    favoriteOf: (entry: T) => boolean;
    statusOptions: Option[];
    statusMatch: (entry: T, statuses: string[]) => boolean;
    sorts: Option[];
    defaultSort: string;
    /** Natural-order comparator for the chosen sort key. */
    compare: (sort: string, a: T, b: T) => number;
    card: Snippet<[T]>;
    /** Extra filter controls (media's "type"), rendered after the status one. */
    extraFilters?: Snippet;
    /** Whether the extra filter is active (contributes to "has filters"). */
    extraActive?: boolean;
    /** Extra filter predicate (media's "type"). */
    extraMatch?: (entry: T) => boolean;
    /** Reset the extra filter when clearing all filters. */
    onClearExtra?: () => void;
  } = $props();

  let entries = $state<T[]>([]);
  let statuses = $state<string[]>([]);
  let favoritesOnly = $state(false);
  // svelte-ignore state_referenced_locally -- defaultSort is a fixed initial value
  let sort = $state<string>(defaultSort);
  let reversed = $state(false);
  let query = $state("");
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    loading = true;
    error = null;
    load()
      .then((result) => {
        entries = result;
      })
      .catch((err) => {
        error = err instanceof ApiError ? err.message : "Chargement impossible";
      })
      .finally(() => {
        loading = false;
      });
  });

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (statuses.length > 0 && !statusMatch(e, statuses)) return false;
      if (extraMatch && !extraMatch(e)) return false;
      if (favoritesOnly && !favoriteOf(e)) return false;
      if (q && !titleOf(e).toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...list].sort((a, b) => compare(sort, a, b));
    if (reversed) sorted.reverse();
    return sorted;
  });

  const hasQuery = $derived(query.trim() !== "");
  const hasFilters = $derived(
    statuses.length > 0 || favoritesOnly || extraActive,
  );

  function clearFilters() {
    statuses = [];
    favoritesOnly = false;
    onClearExtra?.();
  }
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <PageHeader {icon} {title} subtitle={subtitle(shown.length)} class="mb-6" />

  <div class="relative mb-4">
    <span
      class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-dim">
      <Icon name="search" class="h-5 w-5" />
    </span>
    <input
      type="search"
      placeholder="Filtrer ma bibliothèque…"
      bind:value={query}
      class="input pl-10" />
  </div>

  <div class="mb-7 flex flex-wrap items-center gap-2">
    <Combobox
      label="Statut"
      multiselect
      options={statusOptions}
      values={statuses}
      onChange={(v) => (statuses = v)} />
    {@render extraFilters?.()}
    <button
      class="chip inline-flex items-center gap-1"
      class:chip-on={favoritesOnly}
      onclick={() => (favoritesOnly = !favoritesOnly)}>
      <Icon name="star" class="h-3.5 w-3.5" /> Favoris
    </button>
    <div class="ml-auto flex items-center gap-2">
      <Combobox
        label="Trier"
        options={sorts}
        values={[sort]}
        onChange={(v) => (sort = v[0] ?? sort)} />
      <button
        type="button"
        class="chip px-2.5 font-mono"
        title={reversed ? "Ordre inversé" : "Ordre par défaut"}
        aria-label="Inverser le sens du tri"
        onclick={() => (reversed = !reversed)}>
        {reversed ? "↑" : "↓"}
      </button>
    </div>
  </div>

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if loading}
    <PosterGridSkeleton />
  {:else if shown.length === 0}
    <EmptyState>
      {#if !hasFilters && !hasQuery}
        <p>Tu n'as encore aucun {noun} dans ta bibliothèque.</p>
        <a href="/search" class="btn btn-primary mt-4 inline-flex">
          <Icon name="search" class="h-4 w-4" /> Chercher un {noun}
        </a>
      {:else if hasQuery && !hasFilters}
        <p>
          Aucun {noun} ne correspond à « {query.trim()} » dans ta bibliothèque.
          <a
            href={`/search?query=${encodeURIComponent(query.trim())}`}
            class="link-accent">
            Le chercher dans le catalogue →
          </a>
        </p>
      {:else}
        <p>
          {#if hasQuery}
            Aucun {noun} ne correspond à ces filtres pour « {query.trim()} ».
          {:else}
            Aucun {noun} ne correspond à ces filtres.
          {/if}
        </p>
        <button class="btn btn-ghost mt-4" onclick={clearFilters}>
          Effacer les filtres
        </button>
      {/if}
    </EmptyState>
  {:else}
    <PosterGrid>
      {#each shown as entry (keyOf(entry))}
        {@render card(entry)}
      {/each}
    </PosterGrid>
  {/if}
</div>
