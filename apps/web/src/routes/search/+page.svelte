<script lang="ts">
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { page } from "$app/state";
  import type {
    EntryStatus,
    MediaSummaryDto,
    MediaType,
  } from "@tracklore/shared";
  import { listLibrary, searchCatalog, ApiError } from "$lib/api/client";
  import Poster from "$lib/components/Poster.svelte";
  import Icon from "$lib/components/Icon.svelte";

  const TYPE_TABS: { label: string; value: MediaType | undefined }[] = [
    { label: "Tout", value: undefined },
    { label: "Films", value: "MOVIE" },
    { label: "Séries", value: "SERIES" },
    { label: "Animés", value: "ANIME" },
  ];

  const TYPE_LABELS: Record<MediaType, string> = {
    MOVIE: "Film",
    SERIES: "Série",
    ANIME: "Animé",
  };

  const STATUS_LABELS: Record<EntryStatus, string> = {
    PLANNED: "À voir",
    WATCHING: "En cours",
    UP_TO_DATE: "À jour",
    COMPLETED: "Terminé",
    DROPPED: "Abandonné",
  };

  const DEBOUNCE_MS = 300;

  let query = $state(page.url.searchParams.get("query") ?? "");
  let type = $state<MediaType | undefined>(undefined);
  let results = $state<MediaSummaryDto[]>([]);
  let searched = $state(false);
  let loading = $state(false); // fetching the first page of a new search
  let loadingMore = $state(false); // fetching a follow-up page (infinite scroll)
  let done = $state(false); // no more pages for the current search
  let error = $state<string | null>(null);

  let sentinel = $state<HTMLElement | null>(null);
  let reduced = $state(false); // prefers-reduced-motion: skip enter animation

  // Non-reactive search bookkeeping.
  let lastPage = 0; // last page number fetched for the current search
  let searchId = 0; // bumped on every reset; stale responses are discarded
  let seen = new Set<string>(); // catalogue keys already shown (cross-page dedup)
  let debounceTimer: ReturnType<typeof setTimeout>;

  const keyOf = (m: MediaSummaryDto) => `${m.source}:${m.sourceId}`;

  // Titles already in the library, keyed by catalogue identity, so results can
  // be flagged (and their current status shown) instead of looking already-new.
  let tracked = $state<Map<string, EntryStatus>>(new Map());
  const trackKey = (t: MediaType, sourceId: string) => `${t}:${sourceId}`;
  const trackedStatus = (m: MediaSummaryDto) =>
    tracked.get(trackKey(m.type, m.sourceId));

  $effect(() => {
    listLibrary()
      .then((entries) => {
        tracked = new Map(
          entries.map((e) => [
            trackKey(e.mediaItem.type, e.mediaItem.sourceId),
            e.status,
          ]),
        );
      })
      .catch(() => {});
  });

  onMount(() => {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  function clearResults() {
    searchId++; // invalidate any in-flight request
    lastPage = 0;
    done = false;
    seen = new Set();
    results = [];
    searched = false;
    error = null;
    loading = false;
    loadingMore = false;
  }

  /**
   * Runs the search. `reset` starts a fresh search from page 1 (new query or
   * type); otherwise it appends the next page for the infinite scroll.
   */
  async function runSearch(reset: boolean) {
    const q = query.trim();
    if (!q) {
      clearResults();
      return;
    }
    if (!reset && (loading || loadingMore || done)) return;

    if (reset) {
      searchId++;
      lastPage = 0;
      done = false;
      seen = new Set();
      results = [];
    }
    const mine = searchId;
    const next = lastPage + 1;
    if (reset) loading = true;
    else loadingMore = true;
    error = null;

    try {
      const batch = (await searchCatalog(q, type, next)).results;
      if (mine !== searchId) return; // a newer search superseded this one
      lastPage = next;
      searched = true;
      if (batch.length === 0) {
        done = true;
      } else {
        const fresh = batch.filter((m) => !seen.has(keyOf(m)));
        for (const m of fresh) seen.add(keyOf(m));
        results = [...results, ...fresh];
      }
    } catch (err) {
      if (mine !== searchId) return;
      error = err instanceof ApiError ? err.message : "Recherche impossible";
    } finally {
      if (mine === searchId) {
        loading = false;
        loadingMore = false;
      }
    }
  }

  // Debounced live search: refetch page 1 whenever the query changes.
  $effect(() => {
    const q = query; // track the query only (type is handled eagerly below)
    clearTimeout(debounceTimer);
    if (!q.trim()) {
      clearResults();
      return;
    }
    debounceTimer = setTimeout(() => void runSearch(true), DEBOUNCE_MS);
    return () => clearTimeout(debounceTimer);
  });

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  $effect(() => {
    const el = sentinel;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void runSearch(false);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  });

  function submitNow(event: SubmitEvent) {
    event.preventDefault();
    clearTimeout(debounceTimer);
    if (query.trim()) void runSearch(true);
  }

  function selectType(value: MediaType | undefined) {
    if (value === type) return;
    type = value;
    clearTimeout(debounceTimer);
    if (query.trim())
      void runSearch(true); // eager, no debounce
    else clearResults();
  }
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-6">
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Recherche
    </h1>
    <p class="mt-1 text-sm text-dim">
      Films, séries et animés — ajoute-les à ta bibliothèque.
    </p>
  </header>

  <form onsubmit={submitNow} class="mb-5">
    <div class="relative">
      <span
        class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-dim">
        <Icon name="search" class="h-5 w-5" />
      </span>
      <input
        type="search"
        placeholder="Titre d'un film, d'une série, d'un animé…"
        bind:value={query}
        class="input pl-10" />
    </div>
  </form>

  <div class="mb-7 flex flex-wrap gap-2">
    {#each TYPE_TABS as tab (tab.label)}
      <button
        class="chip"
        class:chip-on={type === tab.value}
        onclick={() => selectType(tab.value)}>
        {tab.label}
      </button>
    {/each}
  </div>

  {#if error}
    <p
      class="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  {/if}

  {#if loading && results.length === 0}
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
      {#each results as media (keyOf(media))}
        <a
          in:fly={{ y: 8, duration: reduced ? 0 : 220 }}
          href={`/media/${media.type.toLowerCase()}/${media.sourceId}`}
          class="card group flex flex-col transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-accent">
          <div class="relative">
            <Poster src={media.posterUrl} title={media.title} />
            {#if trackedStatus(media)}
              <span
                class="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.6rem] font-bold text-accent-fg shadow">
                <Icon name="check" class="h-3 w-3" />
                {STATUS_LABELS[trackedStatus(media)!]}
              </span>
            {/if}
          </div>
          <div class="flex flex-1 flex-col gap-1.5 p-3">
            <span class="font-display text-sm leading-tight font-semibold"
              >{media.title}</span>
            <span class="timecode text-xs">
              {TYPE_LABELS[media.type]}{#if media.year}
                · {media.year}{/if}
            </span>
          </div>
        </a>
      {/each}
    </div>

    {#if !done}
      <!-- Sentinel: entering the viewport triggers the next page. -->
      <div bind:this={sentinel} class="h-10"></div>
    {/if}
    {#if loadingMore}
      <p class="timecode mt-4 text-center text-sm">Chargement…</p>
    {/if}
  {:else if searched}
    <p class="timecode text-sm">Aucun résultat.</p>
  {:else}
    <div
      class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim">
      Lance une recherche pour commencer.
    </div>
  {/if}
</div>
