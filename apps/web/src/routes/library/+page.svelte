<script lang="ts">
  import type {
    EntryStatus,
    LibraryEntryDto,
    MediaType,
  } from "@tracklore/shared";
  import { listLibrary, ApiError } from "$lib/api/client";
  import Poster from "$lib/components/Poster.svelte";
  import Icon from "$lib/components/Icon.svelte";

  const STATUS_TABS: { label: string; value: EntryStatus | undefined }[] = [
    { label: "Tout", value: undefined },
    { label: "En cours", value: "WATCHING" },
    { label: "À voir", value: "PLANNED" },
    { label: "Terminé", value: "COMPLETED" },
    { label: "En pause", value: "PAUSED" },
    { label: "Abandonné", value: "DROPPED" },
  ];

  const TYPE_TABS: { label: string; value: MediaType | undefined }[] = [
    { label: "Tous types", value: undefined },
    { label: "Films", value: "MOVIE" },
    { label: "Séries", value: "SERIES" },
    { label: "Animés", value: "ANIME" },
  ];

  const TYPE_LABELS: Record<MediaType, string> = {
    MOVIE: "Film",
    SERIES: "Série",
    ANIME: "Animé",
  };

  type SortKey = "recent" | "added" | "title" | "rating";
  const SORTS: { label: string; value: SortKey }[] = [
    { label: "Vu récemment", value: "recent" },
    { label: "Ajout récent", value: "added" },
    { label: "Titre A→Z", value: "title" },
    { label: "Note", value: "rating" },
  ];

  let status = $state<EntryStatus | undefined>(undefined);
  let type = $state<MediaType | undefined>(undefined);
  let entries = $state<LibraryEntryDto[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Client-side refinements over the loaded (status/type-filtered) list.
  let query = $state("");
  let favoritesOnly = $state(false);
  let sort = $state<SortKey>("recent");

  $effect(() => {
    loading = true;
    error = null;
    listLibrary({ status, type })
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

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (favoritesOnly && !e.favorite) return false;
      if (q && !e.mediaItem.title.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...list];
    switch (sort) {
      case "title":
        sorted.sort((a, b) =>
          a.mediaItem.title.localeCompare(b.mediaItem.title, "fr"),
        );
        break;
      case "rating":
        sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
        break;
      case "added":
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "recent":
        sorted.sort((a, b) => time(b.lastWatchedAt) - time(a.lastWatchedAt));
        break;
    }
    return sorted;
  });

  function pct(entry: LibraryEntryDto): number {
    if (!entry.progress || entry.progress.totalEpisodes === 0) return 0;
    return Math.round(
      (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
    );
  }
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-6">
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Écrans
    </h1>
    <p class="timecode mt-1 text-sm">
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

  <div class="mb-2 flex flex-wrap gap-2">
    {#each STATUS_TABS as tab (tab.label)}
      <button
        class="chip"
        class:chip-on={status === tab.value}
        onclick={() => (status = tab.value)}>
        {tab.label}
      </button>
    {/each}
  </div>
  <div class="mb-4 flex flex-wrap gap-2">
    {#each TYPE_TABS as tab (tab.label)}
      <button
        class="chip"
        class:chip-on={type === tab.value}
        onclick={() => (type = tab.value)}>
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
  {:else if entries.length === 0}
    <div
      class="rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <p class="text-dim">Rien ici pour l'instant.</p>
      <a href="/search" class="btn btn-primary mt-4 inline-flex">
        <Icon name="search" class="h-4 w-4" /> Chercher un titre
      </a>
    </div>
  {:else if shown.length === 0}
    <div
      class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim">
      Aucun titre ne correspond à ces filtres.
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
