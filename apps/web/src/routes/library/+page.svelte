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

  let status = $state<EntryStatus | undefined>(undefined);
  let type = $state<MediaType | undefined>(undefined);
  let entries = $state<LibraryEntryDto[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

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
      {entries.length} titre{entries.length > 1 ? "s" : ""}
    </p>
  </header>

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
  <div class="mb-7 flex flex-wrap gap-2">
    {#each TYPE_TABS as tab (tab.label)}
      <button
        class="chip"
        class:chip-on={type === tab.value}
        onclick={() => (type = tab.value)}>
        {tab.label}
      </button>
    {/each}
  </div>

  {#if error}
    <p
      class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  {:else if loading}
    <p class="timecode text-sm">Chargement…</p>
  {:else if entries.length === 0}
    <div
      class="rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <p class="text-dim">Rien ici pour l'instant.</p>
      <a href="/search" class="btn btn-primary mt-4 inline-flex">
        <Icon name="search" class="h-4 w-4" /> Chercher un titre
      </a>
    </div>
  {:else}
    <div
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each entries as entry (entry.id)}
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
