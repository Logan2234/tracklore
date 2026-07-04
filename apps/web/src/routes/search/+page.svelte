<script lang="ts">
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
    PAUSED: "En pause",
    DROPPED: "Abandonné",
  };

  let query = $state("");
  let type = $state<MediaType | undefined>(undefined);
  let results = $state<MediaSummaryDto[]>([]);
  let searched = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Titles already in the library, keyed by catalogue identity, so results can
  // be flagged (and their current status shown) instead of looking already-new.
  let tracked = $state<Map<string, EntryStatus>>(new Map());
  const key = (type: MediaType, sourceId: string) => `${type}:${sourceId}`;
  const trackedStatus = (m: MediaSummaryDto) =>
    tracked.get(key(m.type, m.sourceId));

  $effect(() => {
    listLibrary()
      .then((entries) => {
        tracked = new Map(
          entries.map((e) => [
            key(e.mediaItem.type, e.mediaItem.sourceId),
            e.status,
          ]),
        );
      })
      .catch(() => {});
  });

  async function submit(event?: SubmitEvent) {
    event?.preventDefault();
    if (!query.trim()) return;
    loading = true;
    error = null;
    try {
      results = (await searchCatalog(query.trim(), type)).results;
      searched = true;
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Recherche impossible";
    } finally {
      loading = false;
    }
  }

  function selectType(value: MediaType | undefined) {
    type = value;
    if (searched) void submit();
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

  <form onsubmit={submit} class="mb-5 flex gap-2">
    <div class="relative flex-1">
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
    <button type="submit" class="btn btn-primary" disabled={loading}>
      {loading ? "Recherche…" : "Chercher"}
    </button>
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

  {#if loading}
    <p class="timecode text-sm">Recherche en cours…</p>
  {:else if searched && results.length === 0}
    <p class="timecode text-sm">Aucun résultat.</p>
  {:else if !searched}
    <div
      class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim">
      Lance une recherche pour commencer.
    </div>
  {:else}
    <div
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each results as media (`${media.source}:${media.sourceId}`)}
        <a
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
  {/if}
</div>
