<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type {
    EntryEpisodesResponseDto,
    EntryStatus,
    LibraryEntryDto,
  } from "@tracklore/shared";
  import {
    deleteLibraryEntry,
    getEntryEpisodes,
    getLibraryEntry,
    updateLibraryEntry,
    watchEpisode,
    ApiError,
  } from "$lib/api/client";
  import Poster from "$lib/components/Poster.svelte";
  import Icon from "$lib/components/Icon.svelte";

  const STATUS_OPTIONS: { label: string; value: EntryStatus }[] = [
    { label: "En cours", value: "WATCHING" },
    { label: "À voir", value: "PLANNED" },
    { label: "Terminé", value: "COMPLETED" },
    { label: "En pause", value: "PAUSED" },
    { label: "Abandonné", value: "DROPPED" },
  ];
  const TYPE_LABELS: Record<string, string> = {
    MOVIE: "Film",
    SERIES: "Série",
    ANIME: "Animé",
  };

  let entry = $state<LibraryEntryDto | null>(null);
  let episodes = $state<EntryEpisodesResponseDto | null>(null);
  let error = $state<string | null>(null);
  let busyEpisodeId = $state<string | null>(null);

  const entryId = $derived(page.params.entryId ?? "");

  $effect(() => {
    if (!entryId) return;
    Promise.all([getLibraryEntry(entryId), getEntryEpisodes(entryId)])
      .then(([entryResult, episodesResult]) => {
        entry = entryResult;
        episodes = episodesResult;
      })
      .catch((err) => {
        error = err instanceof ApiError ? err.message : "Chargement impossible";
      });
  });

  async function patch(changes: Parameters<typeof updateLibraryEntry>[1]) {
    if (!entry) return;
    error = null;
    try {
      entry = await updateLibraryEntry(entry.id, changes);
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Mise à jour impossible";
    }
  }

  async function markWatched(episodeId: string) {
    busyEpisodeId = episodeId;
    error = null;
    try {
      await watchEpisode(episodeId);
      const [entryResult, episodesResult] = await Promise.all([
        getLibraryEntry(entryId),
        getEntryEpisodes(entryId),
      ]);
      entry = entryResult;
      episodes = episodesResult;
    } catch (err) {
      error =
        err instanceof ApiError
          ? err.message
          : "Impossible de marquer comme vu";
    } finally {
      busyEpisodeId = null;
    }
  }

  async function removeEntry() {
    if (
      !entry ||
      !confirm(`Retirer « ${entry.mediaItem.title} » de ta bibliothèque ?`)
    )
      return;
    await deleteLibraryEntry(entry.id);
    await goto("/library");
  }

  const pct = $derived(
    entry?.progress && entry.progress.totalEpisodes > 0
      ? Math.round(
          (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
        )
      : 0,
  );

  // --- Mock enrichment (dotted-underlined in the UI). The entry DTO carries no
  // synopsis/genres/runtime; these are deterministic placeholders per title
  // until external IDs are exposed and real catalogue details can be fetched.
  const GENRES = [
    "Science-fiction",
    "Drame",
    "Action",
    "Thriller",
    "Comédie",
    "Aventure",
    "Fantastique",
    "Mystère",
  ];
  const NETWORKS = [
    "Netflix",
    "HBO",
    "Crunchyroll",
    "Prime Video",
    "Disney+",
    "Apple TV+",
  ];

  function hash(s: string): number {
    return [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  }

  const mock = $derived.by(() => {
    if (!entry) return null;
    const h = hash(entry.mediaItem.title);
    const t = entry.mediaItem.type;
    const g = [
      GENRES[h % 8],
      GENRES[(h >> 3) % 8],
      GENRES[(h >> 6) % 8],
    ].filter((x, i, a) => a.indexOf(x) === i);
    return {
      hue: h % 360,
      year: 2000 + (h % 25),
      genres: g.slice(0, 3),
      runtime:
        t === "MOVIE"
          ? `${1 + (h % 2)} h ${(h % 55) + 5} min`
          : `~${20 + (h % 25)} min / épisode`,
      network: NETWORKS[h % NETWORKS.length],
      synopsis:
        "Synopsis de démonstration : un récit à la fois intime et spectaculaire, porté par des " +
        "personnages fêlés qui cherchent leur place. Les détails réels (résumé, distribution, " +
        "genres) se brancheront sur le catalogue quand les identifiants externes seront exposés.",
    };
  });
</script>

{#if error}
  <div class="mx-auto max-w-4xl px-4 py-6 md:px-8">
    <p
      class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  </div>
{/if}

{#if entry && mock}
  <!-- Hero with a (mock) backdrop that fades into the page. -->
  <div class="relative -z-1">
    <div
      class="h-44 w-full md:h-60"
      style={`background: linear-gradient(120deg, hsl(${mock.hue} 34% 26%), hsl(${(mock.hue + 45) % 360} 38% 14%));`}>
    </div>
    <div
      class="absolute inset-0 bg-linear-to-t from-bg via-bg/50 to-transparent">
    </div>
    <a
      href="/library"
      class="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-3 py-1.5 text-sm font-semibold backdrop-blur hover:bg-bg">
      ← Bibliothèque
    </a>
  </div>

  <div class="mx-auto max-w-4xl px-4 md:px-8">
    <div class="-mt-24 flex flex-col gap-5 sm:flex-row sm:items-end md:-mt-28">
      <div
        class="w-32 shrink-0 overflow-hidden rounded-xl border border-border shadow-lg md:w-44">
        <Poster src={entry.mediaItem.posterUrl} title={entry.mediaItem.title} />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim">
            {TYPE_LABELS[entry.mediaItem.type]}
          </span>
          {#if entry.rating !== null}
            <span
              class="inline-flex items-center gap-1.5 rounded-md bg-accent px-2 py-0.5 font-display text-sm font-bold text-accent-fg">
              <span
                class="font-mono text-[0.5rem] font-bold tracking-widest opacity-75"
                >NOTE</span>
              {entry.rating}
            </span>
          {/if}
        </div>
        <h1
          class="mt-2 font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
          {entry.mediaItem.title}
        </h1>
        <p class="timecode mt-1.5 text-sm">
          <span class="mock" title="Donnée de démonstration">{mock.year}</span>
          ·
          <span class="mock" title="Donnée de démonstration"
            >{mock.runtime}</span>
          ·
          <span class="mock" title="Donnée de démonstration"
            >{mock.genres.join(", ")}</span>
        </p>
      </div>
    </div>

    {#if entry.progress}
      <div class="mt-6 max-w-sm">
        <div class="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div class="h-full bg-accent" style={`width: ${pct}%`}></div>
        </div>
        <p class="timecode mt-1.5 text-sm">
          {entry.progress.watchedEpisodes} / {entry.progress.totalEpisodes} épisodes
          vus · {pct} %
        </p>
      </div>
    {/if}

    <!-- Synopsis (mock) -->
    <p class="mock mt-6 max-w-2xl text-dim" title="Donnée de démonstration">
      {mock.synopsis}
    </p>
    <p class="timecode mt-2 text-xs">
      Diffusion : <span class="mock" title="Donnée de démonstration"
        >{mock.network}</span>
    </p>

    <!-- Controls (real) -->
    <div class="mt-6 flex flex-wrap items-center gap-2.5">
      <select
        class="input w-auto"
        value={entry.status}
        onchange={(e) =>
          patch({ status: e.currentTarget.value as EntryStatus })}>
        {#each STATUS_OPTIONS as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>

      <label class="flex items-center gap-2 text-sm text-dim">
        Note
        <input
          type="number"
          min="0"
          max="10"
          step="0.5"
          class="input w-20"
          value={entry.rating ?? ""}
          onchange={(e) => {
            const raw = e.currentTarget.value;
            void patch({ rating: raw === "" ? null : Number(raw) });
          }} />
      </label>

      <button
        class="btn btn-ghost"
        onclick={() => patch({ favorite: !entry?.favorite })}>
        <Icon
          name="star"
          class="h-4 w-4 {entry.favorite ? 'text-accent' : ''}" />
        {entry.favorite ? "Retirer des favoris" : "Favori"}
      </button>
      <button class="btn btn-danger" onclick={removeEntry}>Retirer</button>
    </div>

    <textarea
      placeholder="Notes personnelles…"
      rows="3"
      class="input mt-4 max-w-lg"
      value={entry.notes ?? ""}
      onchange={(e) => {
        const raw = e.currentTarget.value;
        void patch({ notes: raw === "" ? null : raw });
      }}></textarea>

    <!-- Episodes (real) -->
    {#if episodes && episodes.seasons.length > 0}
      <h2 class="mt-10 mb-4 font-display text-xl font-bold">Épisodes</h2>
      <div class="flex flex-col gap-4 pb-4">
        {#each episodes.seasons as season (season.id)}
          <div class="card">
            <header
              class="border-b border-border bg-surface-2 px-4 py-2.5 font-display font-semibold">
              {season.title ?? `Saison ${season.number}`}
            </header>
            <ul>
              {#each season.episodes as episode (episode.id)}
                <li
                  class="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
                  <span class="timecode w-14 shrink-0 text-sm">
                    S{String(season.number).padStart(2, "0")}E{String(
                      episode.number,
                    ).padStart(2, "0")}
                  </span>
                  <span class="min-w-0 flex-1 truncate text-sm">
                    {episode.title ?? `Épisode ${episode.number}`}
                    {#if episode.watchCount > 1}
                      <span class="text-success">×{episode.watchCount}</span>
                    {/if}
                  </span>
                  {#if episode.watchCount > 0}
                    <span
                      class="inline-flex items-center gap-1 text-xs font-semibold text-success">
                      <Icon name="check" class="h-4 w-4" /> Vu
                    </span>
                    <button
                      class="btn btn-ghost px-2.5 py-1 text-xs"
                      disabled={busyEpisodeId === episode.id}
                      onclick={() => markWatched(episode.id)}>
                      Revoir
                    </button>
                  {:else}
                    <button
                      class="btn btn-primary px-2.5 py-1 text-xs"
                      disabled={busyEpisodeId === episode.id}
                      onclick={() => markWatched(episode.id)}>
                      Marquer vu
                    </button>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{:else if !error}
  <div class="mx-auto max-w-4xl px-4 py-6 md:px-8">
    <p class="timecode text-sm">Chargement…</p>
  </div>
{/if}
