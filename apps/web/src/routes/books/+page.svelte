<script lang="ts">
  import {
    ApiError,
    listBooks,
    searchBooks,
    upsertBookEntry,
  } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type {
    BookEntryDto,
    BookStatus,
    BookSummaryDto,
  } from "@tracklore/shared";
  import { SvelteMap } from "svelte/reactivity";

  const STATUS_LABELS: Record<BookStatus, string> = {
    TO_READ: "À lire",
    READING: "En lecture",
    READ: "Lu",
    DROPPED: "Abandonné",
  };
  const STATUS_ORDER: BookStatus[] = ["TO_READ", "READING", "READ", "DROPPED"];

  const STATUS_TABS: { label: string; value: BookStatus | undefined }[] = [
    { label: "Tout", value: undefined },
    ...STATUS_ORDER.map((value) => ({ label: STATUS_LABELS[value], value })),
  ];

  type SortKey = "added" | "title" | "rating";
  const SORTS: { label: string; value: SortKey }[] = [
    { label: "Ajout récent", value: "added" },
    { label: "Titre A→Z", value: "title" },
    { label: "Note", value: "rating" },
  ];

  const DEBOUNCE_MS = 300;

  // Library state (the full library is loaded once; status/favorites/sort are
  // refined client-side, so the "already added" flag on search stays complete).
  let entries = $state<BookEntryDto[]>([]);
  let statusFilter = $state<BookStatus | undefined>(undefined);
  let favoritesOnly = $state(false);
  let sort = $state<SortKey>("added");
  let libLoading = $state(true);
  let libError = $state<string | null>(null);

  // Search state.
  let query = $state("");
  let results = $state<BookSummaryDto[]>([]);
  let searching = $state(false);
  let searched = $state(false);
  let searchError = $state<string | null>(null);
  let searchId = 0;
  let debounceTimer: ReturnType<typeof setTimeout>;

  const inSearch = $derived(query.trim() !== "");

  // Books already in the library, keyed by source id → their entry, so a search
  // result can be flagged (and jumped to) instead of re-added.
  const tracked = $derived(
    new SvelteMap(entries.map((e) => [e.book.sourceId, e])),
  );

  async function loadLibrary() {
    libLoading = true;
    libError = null;
    try {
      entries = await listBooks();
    } catch (err) {
      libError =
        err instanceof ApiError ? err.message : "Chargement impossible";
    } finally {
      libLoading = false;
    }
  }

  $effect(() => {
    void loadLibrary();
  });

  const shown = $derived.by(() => {
    const list = entries.filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (favoritesOnly && !e.favorite) return false;
      return true;
    });
    const sorted = [...list];
    switch (sort) {
      case "title":
        sorted.sort((a, b) => a.book.title.localeCompare(b.book.title, "fr"));
        break;
      case "rating":
        sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
        break;
      case "added":
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
    }
    return sorted;
  });

  const hasFilters = $derived(statusFilter !== undefined || favoritesOnly);

  function clearFilters() {
    statusFilter = undefined;
    favoritesOnly = false;
  }

  // Debounced catalogue search.
  $effect(() => {
    const q = query.trim();
    clearTimeout(debounceTimer);
    if (!q) {
      searchId++;
      results = [];
      searched = false;
      searchError = null;
      searching = false;
      return;
    }
    debounceTimer = setTimeout(() => void runSearch(q), DEBOUNCE_MS);
    return () => clearTimeout(debounceTimer);
  });

  async function runSearch(q: string) {
    const mine = ++searchId;
    searching = true;
    searchError = null;
    try {
      const batch = (await searchBooks(q)).results;
      if (mine !== searchId) return;
      results = batch;
      searched = true;
    } catch (err) {
      if (mine !== searchId) return;
      searchError =
        err instanceof ApiError ? err.message : "Recherche impossible";
    } finally {
      if (mine === searchId) searching = false;
    }
  }

  async function addBook(book: BookSummaryDto) {
    try {
      await upsertBookEntry({
        source: book.source,
        sourceId: book.sourceId,
        status: "TO_READ",
      });
      await loadLibrary();
    } catch (err) {
      searchError = err instanceof ApiError ? err.message : "Ajout impossible";
    }
  }
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-6">
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Livres
    </h1>
    <p class="timecode mt-1 text-sm">
      {#if inSearch}
        Catalogue Open Library
      {:else}
        {entries.length} livre{entries.length > 1 ? "s" : ""}
      {/if}
    </p>
  </header>

  <div class="relative mb-5">
    <span
      class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-dim">
      <Icon name="search" class="h-5 w-5" />
    </span>
    <input
      type="search"
      placeholder="Chercher un livre à ajouter…"
      bind:value={query}
      class="input pl-10" />
  </div>

  {#if inSearch}
    <!-- Catalogue search mode. -->
    {#if searchError}
      <p
        class="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {searchError}
      </p>
    {/if}

    {#if searching && results.length === 0}
      <div
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each { length: 10 } as _, i (i)}
          <div class="card flex flex-col">
            <div class="aspect-2/3 w-full animate-pulse bg-surface-2"></div>
            <div class="flex flex-col gap-2 p-3">
              <div class="h-3.5 w-4/5 animate-pulse rounded bg-surface-2"></div>
              <div class="h-3 w-1/2 animate-pulse rounded bg-surface-2"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if results.length > 0}
      <div
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each results as book (book.sourceId)}
          {@const entry = tracked.get(book.sourceId)}
          <div class="card group flex flex-col">
            <a href={`/books/${book.source}/${book.sourceId}`} class="block">
              <Poster src={book.coverUrl} title={book.title} />
            </a>
            <div class="flex flex-1 flex-col gap-2 p-3">
              <a
                href={`/books/${book.source}/${book.sourceId}`}
                class="font-display text-sm leading-tight font-semibold group-hover:text-accent">
                {book.title}
              </a>
              <span class="timecode text-xs">
                {#if book.authors.length > 0}
                  {book.authors[0]}{#if book.year}
                    · {book.year}{/if}
                {:else if book.year}
                  {book.year}
                {:else}
                  Livre
                {/if}
              </span>
              {#if entry}
                <span
                  class="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-accent">
                  <Icon name="check" class="h-3.5 w-3.5" />
                  {STATUS_LABELS[entry.status]}
                </span>
              {:else}
                <button
                  class="btn btn-primary mt-auto h-8 text-xs"
                  onclick={() => addBook(book)}>
                  <Icon name="plus" class="h-4 w-4" /> Ajouter
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else if searched}
      <p class="timecode text-sm">Aucun livre trouvé.</p>
    {/if}
  {:else}
    <!-- Library mode. -->
    {#if libError}
      <p
        class="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {libError}
      </p>
    {/if}

    <div class="mb-2 flex flex-wrap gap-2">
      {#each STATUS_TABS as tab (tab.label)}
        <button
          class="chip"
          class:chip-on={statusFilter === tab.value}
          onclick={() => (statusFilter = tab.value)}>
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="mb-7 flex flex-wrap items-center gap-2">
      <button
        class="chip inline-flex items-center gap-1"
        class:chip-on={favoritesOnly}
        onclick={() => (favoritesOnly = !favoritesOnly)}>
        <Icon name="star" class="h-3.5 w-3.5" /> Favoris
      </button>
      <span class="ml-auto flex items-center gap-2 text-sm text-dim">
        Trier
        <select bind:value={sort} class="input h-9 w-auto py-0 pr-8 text-sm">
          {#each SORTS as s (s.value)}
            <option value={s.value}>{s.label}</option>
          {/each}
        </select>
      </span>
    </div>

    {#if libLoading}
      <div
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each { length: 10 } as _, i (i)}
          <div class="card">
            <div class="aspect-2/3 w-full animate-pulse bg-surface-2"></div>
            <div class="flex flex-col gap-2 p-3">
              <div class="h-3.5 w-4/5 animate-pulse rounded bg-surface-2"></div>
              <div class="h-3 w-1/2 animate-pulse rounded bg-surface-2"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if shown.length === 0}
      <div
        class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim">
        {#if !hasFilters}
          <p>Tu n'as encore aucun livre dans ta bibliothèque.</p>
          <p class="mt-1 text-sm">
            Cherche un titre ci-dessus pour l'ajouter à ta liste de lecture.
          </p>
        {:else}
          <p>Aucun livre ne correspond à ces filtres.</p>
          <button class="btn btn-ghost mt-4" onclick={clearFilters}>
            Effacer les filtres
          </button>
        {/if}
      </div>
    {:else}
      <div
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each shown as entry (entry.id)}
          <div class="card group flex flex-col">
            <a
              href={`/books/${entry.book.canonicalSource}/${entry.book.sourceId}`}
              class="block">
              <Poster src={entry.book.coverUrl} title={entry.book.title} />
            </a>
            <div class="flex flex-1 flex-col gap-2 p-3">
              <a
                href={`/books/${entry.book.canonicalSource}/${entry.book.sourceId}`}
                class="font-display text-sm leading-tight font-semibold group-hover:text-accent">
                {#if entry.favorite}<span class="text-accent">★</span
                  >&nbsp;{/if}{entry.book.title}
              </a>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
