<script module lang="ts">
  export interface LibraryLoadParams {
    query: string;
    statuses: string[];
    favoritesOnly: boolean;
    /** The domain's extra filter value (media's type list), opaque here. */
    extra: unknown;
    sort: string;
    order: "asc" | "desc";
    /** 1-indexed. */
    page: number;
  }
</script>

<script lang="ts" generics="T">
  // Generic library browser shared by the games / books / media / music list
  // pages: server-paginated infinite scroll (mirrors MediaSearchPanel's
  // debounce + sentinel pattern), text filter, status multi-select, favorites
  // toggle, sort + direction, loading states, the three empty states and the
  // poster grid. Filtering/sorting itself happens server-side (see each
  // domain's `listEntries`); everything domain-specific (labels, card markup,
  // the actual `load` call, and media's extra "type" filter) is injected via
  // props/snippets.
  import { ApiError } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PosterGrid from "$lib/components/PosterGrid.svelte";
  import PosterGridSkeleton from "$lib/components/PosterGridSkeleton.svelte";
  import { debounce } from "$lib/debounce";
  import type { PagedResult } from "@tracklore/shared";
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
    statusOptions,
    sorts,
    defaultSort,
    card,
    extraFilters,
    extraActive = false,
    extra,
    onClearExtra,
  }: {
    icon: IconName;
    title: string;
    /** Header subtitle, e.g. `(n) => "3 livres"`. */
    subtitle: (count: number) => string;
    /** Masculine noun for the empty-state copy: "livre", "jeu", "titre". */
    noun: string;
    load: (params: LibraryLoadParams) => Promise<PagedResult<T>>;
    /** Stable key for the poster grid's keyed each. */
    keyOf: (entry: T) => string;
    statusOptions: Option[];
    sorts: Option[];
    defaultSort: string;
    card: Snippet<[T]>;
    /** Extra filter controls (media's "type"), rendered after the status one. */
    extraFilters?: Snippet;
    /** Whether the extra filter is active (contributes to "has filters"). */
    extraActive?: boolean;
    /** Current value of the extra filter, owned by the page — watched so a
     * change there triggers a reset+reload here. */
    extra?: unknown;
    /** Reset the extra filter when clearing all filters. */
    onClearExtra?: () => void;
  } = $props();

  let items = $state<T[]>([]);
  let total = $state(0);
  let statuses = $state<string[]>([]);
  let favoritesOnly = $state(false);
  let sort = $state<string>(defaultSort);
  let reversed = $state(false);
  let query = $state("");
  let loading = $state(true); // fetching the first page for the current filters
  let loadingMore = $state(false); // fetching a follow-up page (infinite scroll)
  let done = $state(false); // no more pages for the current filters
  let error = $state<string | null>(null);

  let sentinel = $state<HTMLElement | null>(null);

  // Non-reactive bookkeeping.
  let lastPage = 0;
  let loadId = 0; // bumped on every reset; stale responses are discarded
  const debouncedRun = debounce(() => run(true), 300);

  async function run(reset: boolean): Promise<void> {
    if (!reset && (loading || loadingMore || done)) return;

    if (reset) {
      loadId++;
      lastPage = 0;
      done = false;
      items = [];
    }
    const mine = loadId;
    const next = lastPage + 1;
    if (reset) loading = true;
    else loadingMore = true;
    error = null;

    try {
      const result = await load({
        query: query.trim(),
        statuses,
        favoritesOnly,
        extra,
        sort,
        order: reversed ? "asc" : "desc",
        page: next,
      });
      if (mine !== loadId) return; // a newer load superseded this one
      lastPage = next;
      total = result.total;
      items = reset ? result.items : [...items, ...result.items];
      done = !result.hasMore;
    } catch (err) {
      if (mine !== loadId) return;
      error = err instanceof ApiError ? err.message : "Chargement impossible";
    } finally {
      if (mine === loadId) {
        loading = false;
        loadingMore = false;
      }
    }
  }

  // The only filter not driven by a local handler below: media's "type" list
  // lives on the page, not here. Also doubles as the initial load on mount.
  $effect(() => {
    void extra;
    void run(true);
  });

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  $effect(() => {
    const el = sentinel;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void run(false);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  });

  const hasQuery = $derived(query.trim() !== "");
  const hasFilters = $derived(
    statuses.length > 0 || favoritesOnly || extraActive,
  );

  function clearFilters() {
    statuses = [];
    favoritesOnly = false;
    onClearExtra?.();
    void run(true);
  }
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <PageHeader {icon} {title} subtitle={subtitle(total)} class="mb-6" />

  <div class="relative mb-4">
    <span
      class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-dim">
      <Icon name="search" class="h-5 w-5" />
    </span>
    <input
      type="search"
      placeholder="Filtrer ma bibliothèque…"
      value={query}
      oninput={(e) => {
        query = e.currentTarget.value;
        debouncedRun.call();
      }}
      class="input pl-10" />
  </div>

  <div class="mb-7 flex flex-wrap items-center gap-2">
    <Combobox
      label="Statut"
      multiselect
      options={statusOptions}
      values={statuses}
      onChange={(v) => {
        statuses = v;
        void run(true);
      }} />
    {@render extraFilters?.()}
    <button
      class="chip inline-flex items-center gap-1"
      class:chip-on={favoritesOnly}
      onclick={() => {
        favoritesOnly = !favoritesOnly;
        void run(true);
      }}>
      <Icon name="star" class="h-3.5 w-3.5" /> Favoris
    </button>
    <div class="ml-auto flex items-center gap-2">
      <Combobox
        label="Trier"
        options={sorts}
        values={[sort]}
        onChange={(v) => {
          sort = v[0] ?? sort;
          void run(true);
        }} />
      <button
        type="button"
        class="chip px-2.5 font-mono"
        title={reversed ? "Ordre inversé" : "Ordre par défaut"}
        aria-label="Inverser le sens du tri"
        onclick={() => {
          reversed = !reversed;
          void run(true);
        }}>
        {reversed ? "↑" : "↓"}
      </button>
    </div>
  </div>

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if loading}
    <PosterGridSkeleton />
  {:else if items.length === 0}
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
      {#each items as entry (keyOf(entry))}
        {@render card(entry)}
      {/each}
    </PosterGrid>
    {#if !done}
      <!-- Sentinel: entering the viewport triggers the next page. -->
      <div bind:this={sentinel} class="h-10"></div>
    {/if}
    {#if loadingMore}
      <div class="mt-4">
        <PosterGridSkeleton count={5} />
      </div>
    {/if}
  {/if}
</div>
