<script lang="ts">
  import { ApiError, listLibrary } from "$lib/api/client";
  import Combobox from "$lib/components/Combobox.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type {
    EntryStatus,
    LibraryEntryDto,
    MediaType,
  } from "@tracklore/shared";
  import { isDormant } from "@tracklore/shared";

  // "DORMANT" is not a real status: it's a client-side refinement over WATCHING
  // (nothing watched for a while).
  type StatusTab = EntryStatus | "DORMANT";
  const STATUS_OPTIONS: { label: string; value: StatusTab }[] = [
    { label: "En cours", value: "WATCHING" },
    { label: "À voir", value: "PLANNED" },
    { label: "Terminé", value: "COMPLETED" },
    { label: "En pause", value: "DORMANT" },
    { label: "Abandonné", value: "DROPPED" },
  ];

  const TYPE_OPTIONS: { label: string; value: MediaType }[] = [
    { label: "Films", value: "MOVIE" },
    { label: "Séries", value: "SERIES" },
    { label: "Animés", value: "ANIME" },
  ];

  const TYPE_LABELS: Record<MediaType, string> = {
    MOVIE: "Film",
    SERIES: "Série",
    ANIME: "Animé",
  };

  // Order used by the "Statut" sort.
  const STATUS_SORT_ORDER: EntryStatus[] = [
    "WATCHING",
    "PLANNED",
    "UP_TO_DATE",
    "COMPLETED",
    "DROPPED",
  ];

  type SortKey =
    | "recent"
    | "added"
    | "title"
    | "rating"
    | "progress"
    | "finished"
    | "started"
    | "status";
  const SORTS: { label: string; value: SortKey }[] = [
    { label: "Vu récemment", value: "recent" },
    { label: "Ajout récent", value: "added" },
    { label: "Titre", value: "title" },
    { label: "Note", value: "rating" },
    { label: "Progression", value: "progress" },
    { label: "Terminé récemment", value: "finished" },
    { label: "Commencé récemment", value: "started" },
    { label: "Statut", value: "status" },
  ];

  let entries = $state<LibraryEntryDto[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Client-side filters/refinements over the full loaded list.
  let query = $state("");
  let statuses = $state<StatusTab[]>([]);
  let types = $state<MediaType[]>([]);
  let favoritesOnly = $state(false);
  let sort = $state<SortKey>("recent");
  let reversed = $state(false);

  $effect(() => {
    loading = true;
    error = null;
    // Load the whole library once; all filtering happens client-side so the
    // status/type multi-selects can combine freely.
    listLibrary({})
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

  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

  function pct(entry: LibraryEntryDto): number {
    if (!entry.progress || entry.progress.totalEpisodes === 0) return 0;
    return Math.round(
      (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
    );
  }

  // Base comparator per criterion (its natural order); the direction toggle
  // reverses the whole list.
  function compare(a: LibraryEntryDto, b: LibraryEntryDto): number {
    switch (sort) {
      case "title":
        return a.mediaItem.title.localeCompare(b.mediaItem.title, "fr");
      case "rating":
        return (b.rating ?? -1) - (a.rating ?? -1);
      case "progress":
        return pct(b) - pct(a);
      case "finished":
        return time(b.finishedAt) - time(a.finishedAt);
      case "started":
        return time(b.startedAt) - time(a.startedAt);
      case "status":
        return (
          STATUS_SORT_ORDER.indexOf(a.status) -
          STATUS_SORT_ORDER.indexOf(b.status)
        );
      case "added":
        return b.createdAt.localeCompare(a.createdAt);
      case "recent":
        return time(b.lastWatchedAt) - time(a.lastWatchedAt);
    }
    return 0;
  }

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (
        statuses.length > 0 &&
        !statuses.some((s) => (s === "DORMANT" ? isDormant(e) : e.status === s))
      )
        return false;
      if (types.length > 0 && !types.includes(e.mediaItem.type)) return false;
      if (favoritesOnly && !e.favorite) return false;
      if (q && !e.mediaItem.title.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...list].sort(compare);
    if (reversed) sorted.reverse();
    return sorted;
  });

  const hasQuery = $derived(query.trim() !== "");
  const hasFilters = $derived(
    statuses.length > 0 || types.length > 0 || favoritesOnly,
  );

  function clearFilters() {
    statuses = [];
    types = [];
    favoritesOnly = false;
  }
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-6">
    <h1
      class="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      <Icon name="library" class="h-7 w-7 text-accent" />
      Écrans
    </h1>
    <p class="mt-1 text-dim">
      {shown.length} titre{shown.length > 1 ? "s" : ""}
    </p>
  </header>

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
      options={STATUS_OPTIONS}
      values={statuses}
      onChange={(v) => (statuses = v as StatusTab[])} />
    <Combobox
      label="Type"
      multiselect
      options={TYPE_OPTIONS}
      values={types}
      onChange={(v) => (types = v as MediaType[])} />
    <button
      class="chip inline-flex items-center gap-1"
      class:chip-on={favoritesOnly}
      onclick={() => (favoritesOnly = !favoritesOnly)}>
      <Icon name="star" class="h-3.5 w-3.5" /> Favoris
    </button>
    <div class="ml-auto flex items-center gap-2">
      <Combobox
        label="Trier"
        options={SORTS}
        values={[sort]}
        onChange={(v) => (sort = v[0] as SortKey)} />
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
    <p
      class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  {:else if loading}
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
      {#if !hasFilters && !hasQuery}
        <p>Tu n'as encore aucun titre dans ta bibliothèque.</p>
        <a href="/search" class="btn btn-primary mt-4 inline-flex">
          <Icon name="search" class="h-4 w-4" /> Chercher un titre
        </a>
      {:else if hasQuery && !hasFilters}
        <p>
          Aucun titre ne correspond à « {query.trim()} » dans ta bibliothèque.
          <a
            href={`/search?query=${encodeURIComponent(query.trim())}`}
            class="font-semibold text-accent hover:underline">
            Le chercher dans le catalogue →
          </a>
        </p>
      {:else}
        <p>
          {#if hasQuery}
            Aucun titre ne correspond à ces filtres pour « {query.trim()} ».
          {:else}
            Aucun titre ne correspond à ces filtres.
          {/if}
        </p>
        <button class="btn btn-ghost mt-4" onclick={clearFilters}>
          Effacer les filtres
        </button>
      {/if}
    </div>
  {:else}
    <div
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each shown as entry (entry.id)}
        <a
          href={`/media/${entry.mediaItem.type.toLowerCase()}/${entry.mediaItem.sourceId}`}
          class="card group transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-accent">
          <Poster
            src={entry.mediaItem.posterUrl}
            title={entry.mediaItem.title} />
          <div class="flex flex-col gap-1.5 p-3">
            <span class="font-display text-sm leading-tight font-semibold">
              {#if entry.favorite}<span class="text-accent">★</span
                >&nbsp;{/if}{entry.mediaItem.title}
            </span>
            {#if entry.progress}
              <div class="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div class="h-full bg-accent" style={`width: ${pct(entry)}%`}>
                </div>
              </div>
              <span class="timecode text-xs">
                {entry.progress.watchedEpisodes} / {entry.progress
                  .totalEpisodes} ép.
                {#if isDormant(entry)}
                  <span class="text-dim">· ⏸ En pause</span>
                {/if}
              </span>
            {:else}
              <span class="timecode text-xs">
                {TYPE_LABELS[entry.mediaItem.type]}{#if entry.rating !== null}
                  · ★ {entry.rating}{/if}
              </span>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
