<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { EntryStatus, MediaDetailDto, MediaType } from "@tracklore/shared";
  import {
    deleteLibraryEntry,
    deleteWatch,
    getMediaDetail,
    getMediaExtras,
    rateWatch,
    updateLibraryEntry,
    upsertLibraryEntry,
    unwatchEpisode,
    watchEpisode,
    watchSeason,
    watchThrough,
    ApiError,
  } from "$lib/api/client";
  import type {
    MediaDetailSeasonDto,
    MediaExtrasDto,
  } from "@tracklore/shared";
  import Poster from "$lib/components/Poster.svelte";
  import Icon from "$lib/components/Icon.svelte";

  const TYPE_LABELS: Record<MediaType, string> = {
    MOVIE: "Film",
    SERIES: "Série",
    ANIME: "Animé",
  };

  // Effective-status badge: label + chip styling. Statuses are derived server
  // side; here we only present them.
  const STATUS_META: Record<EntryStatus, { label: string; cls: string }> = {
    PLANNED: { label: "À voir", cls: "bg-surface-2 text-dim" },
    WATCHING: { label: "En cours", cls: "bg-accent text-accent-fg" },
    UP_TO_DATE: {
      label: "À jour",
      cls: "border border-success text-success",
    },
    COMPLETED: { label: "Terminé", cls: "bg-success/15 text-success" },
    PAUSED: { label: "En pause", cls: "border border-border text-fg" },
    DROPPED: { label: "Abandonné", cls: "border border-danger text-danger" },
  };

  let detail = $state<MediaDetailDto | null>(null);
  let error = $state<string | null>(null);
  let busyEpisodeId = $state<string | null>(null);
  let busySeasonId = $state<string | null>(null);
  // Episode whose watch history (dates + ratings) is expanded, by id.
  let openHistory = $state<string | null>(null);
  // Specials (season 0) are hidden by default; a toggle reveals them.
  let showSpecials = $state(false);

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  // Episode-row dropdown, positioned fixed (the season card clips overflow).
  let menu = $state<{ episodeId: string; top: number; right: number } | null>(
    null,
  );
  let saving = $state(false);

  const seasonWatched = (season: MediaDetailSeasonDto) =>
    season.episodes.length > 0 &&
    season.episodes.every((ep) => ep.watchCount > 0);

  // True when every regular episode *before* this one is watched — then "mark
  // through here" would only mark this episode (same as "Marquer vu"), so it's
  // hidden. Specials are not part of the linear run.
  function allPreviousWatched(seasonNumber: number, episodeNumber: number): boolean {
    if (!detail) return false;
    for (const s of detail.seasons) {
      if (s.number === 0) continue;
      for (const ep of s.episodes) {
        const before =
          s.number < seasonNumber ||
          (s.number === seasonNumber && ep.number < episodeNumber);
        if (before && ep.watchCount === 0) return false;
      }
    }
    return true;
  }

  // The episode the open dropdown belongs to (with its season number).
  const menuCtx = $derived.by(() => {
    const m = menu;
    if (!m || !detail) return null;
    for (const s of detail.seasons) {
      const ep = s.episodes.find((e) => e.id === m.episodeId);
      if (ep) return { seasonNumber: s.number, episode: ep };
    }
    return null;
  });

  const type = $derived((page.params.type ?? "").toUpperCase() as MediaType);
  const id = $derived(page.params.id ?? "");

  $effect(() => {
    const t = type;
    const i = id;
    if (!t || !i) return;
    error = null;
    getMediaDetail(t, i)
      .then((result) => (detail = result))
      .catch((err) => {
        error = err instanceof ApiError ? err.message : "Chargement impossible";
      });
  });

  async function reload() {
    detail = await getMediaDetail(type, id);
  }

  // Live extras (where to watch, cast, similar). Loaded once per media (keyed on
  // the route), independent of watch-state reloads. Best-effort: errors are
  // swallowed so a provider hiccup never breaks the page.
  let extras = $state<MediaExtrasDto | null>(null);
  $effect(() => {
    const t = type;
    const i = id;
    extras = null;
    if (!t || !i) return;
    const source = t === "ANIME" ? "anilist" : "tmdb";
    getMediaExtras(source, i, t)
      .then((x) => (extras = x))
      .catch(() => {});
  });

  const hasProviders = $derived(
    !!extras &&
      (extras.watchProviders.flatrate.length > 0 ||
        extras.watchProviders.rent.length > 0 ||
        extras.watchProviders.buy.length > 0),
  );

  const entry = $derived(detail?.entry ?? null);
  const isMovie = $derived(detail?.type === "MOVIE");
  const isOverride = $derived(
    entry?.status === "PAUSED" || entry?.status === "DROPPED",
  );
  const pct = $derived(
    entry?.progress && entry.progress.totalEpisodes > 0
      ? Math.round(
          (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
        )
      : 0,
  );

  // Specials (season 0) are excluded from progress; show them last so the
  // regular run leads.
  const orderedSeasons = $derived(
    detail
      ? [...detail.seasons].sort((a, b) => {
          if (a.number === 0) return 1;
          if (b.number === 0) return -1;
          return a.number - b.number;
        })
      : [],
  );
  const hasSpecials = $derived(orderedSeasons.some((s) => s.number === 0));
  const visibleSeasons = $derived(
    orderedSeasons.filter((s) => showSpecials || s.number !== 0),
  );

  async function add() {
    if (!detail) return;
    saving = true;
    error = null;
    try {
      await upsertLibraryEntry({
        source: detail.source,
        sourceId: detail.sourceId,
        type: detail.type,
        status: "PLANNED",
      });
      await reload();
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Impossible d'ajouter ce média";
    } finally {
      saving = false;
    }
  }

  async function patch(changes: Parameters<typeof updateLibraryEntry>[1]) {
    if (!entry) return;
    saving = true;
    error = null;
    try {
      await updateLibraryEntry(entry.id, changes);
      await reload(); // Re-fetch so the derived status/progress refresh.
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Mise à jour impossible";
    } finally {
      saving = false;
    }
  }

  async function markWatched(episodeId: string) {
    busyEpisodeId = episodeId;
    error = null;
    try {
      await watchEpisode(episodeId);
      await reload();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Impossible de marquer comme vu";
    } finally {
      busyEpisodeId = null;
    }
  }

  async function markSeason(seasonId: string) {
    busySeasonId = seasonId;
    error = null;
    try {
      await watchSeason(seasonId);
      await reload();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Impossible de marquer la saison";
    } finally {
      busySeasonId = null;
    }
  }

  async function setRating(watchId: string, raw: string) {
    error = null;
    try {
      await rateWatch(watchId, raw === "" ? null : Number(raw));
      await reload();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Impossible d'enregistrer la note";
    }
  }

  async function removeWatch(watchId: string) {
    error = null;
    try {
      await deleteWatch(watchId);
      await reload();
    } catch (err) {
      error =
        err instanceof ApiError
          ? err.message
          : "Impossible de supprimer le visionnage";
    }
  }

  const seasonWatchedCount = (season: MediaDetailSeasonDto) =>
    season.episodes.filter((e) => e.watchCount > 0).length;

  function openMenu(event: MouseEvent, episodeId: string) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    menu = {
      episodeId,
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    };
  }

  async function markThrough(episodeId: string) {
    menu = null;
    busyEpisodeId = episodeId;
    error = null;
    try {
      await watchThrough(episodeId);
      await reload();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Impossible de marquer les épisodes";
    } finally {
      busyEpisodeId = null;
    }
  }

  async function markUnwatch(episodeId: string) {
    menu = null;
    busyEpisodeId = episodeId;
    error = null;
    try {
      await unwatchEpisode(episodeId);
      await reload();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Impossible d'annuler le visionnage";
    } finally {
      busyEpisodeId = null;
    }
  }

  async function removeEntry() {
    if (
      !detail ||
      !entry ||
      !confirm(`Retirer « ${detail.title} » de ta bibliothèque ?`)
    )
      return;
    await deleteLibraryEntry(entry.id);
    await goto("/library");
  }
</script>

{#if error}
  <div class="mx-auto max-w-4xl px-4 py-6 md:px-8">
    <p
      class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  </div>
{/if}

{#if detail}
  <!-- Hero: real backdrop, gradient fallback fading into the page. -->
  <div class="relative -z-1">
    {#if detail.backdropUrl}
      <img
        src={detail.backdropUrl}
        alt=""
        class="h-44 w-full object-cover md:h-60" />
    {:else}
      <div
        class="h-44 w-full bg-linear-to-br from-surface-2 to-surface md:h-60">
      </div>
    {/if}
    <div class="absolute inset-0 bg-linear-to-t from-bg via-bg/50 to-transparent"></div>
    <a
      href="/library"
      class="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-3 py-1.5 text-sm font-semibold backdrop-blur hover:bg-bg">
      ← Écrans
    </a>
  </div>

  <div class="mx-auto max-w-4xl px-4 md:px-8">
    <div class="-mt-24 flex flex-col gap-5 sm:flex-row sm:items-end md:-mt-28">
      <div
        class="w-32 shrink-0 overflow-hidden rounded-xl border border-border shadow-lg md:w-44">
        <Poster src={detail.posterUrl} title={detail.title} />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim">
            {TYPE_LABELS[detail.type]}
          </span>
          {#if entry}
            <span
              class="rounded-full px-2.5 py-0.5 text-xs font-bold {STATUS_META[
                entry.status
              ].cls}">
              {STATUS_META[entry.status].label}
            </span>
          {/if}
          {#if entry?.rating != null}
            <span
              class="inline-flex items-center gap-1.5 rounded-md bg-accent px-2 py-0.5 font-display text-sm font-bold text-accent-fg">
              <span class="font-mono text-[0.5rem] font-bold tracking-widest opacity-75">
                NOTE
              </span>
              {entry.rating}
            </span>
          {/if}
        </div>
        <h1
          class="mt-2 font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
          {detail.title}
        </h1>
        <p class="timecode mt-1.5 text-sm">
          {#if detail.year}{detail.year}{/if}
          {#if detail.genres.length > 0}
            {#if detail.year} · {/if}{detail.genres.slice(0, 3).join(", ")}
          {/if}
          {#if !isMovie && detail.seasons.length > 0}
            · {detail.airingFinished ? "Diffusion terminée" : "En diffusion"}
          {/if}
        </p>
      </div>
    </div>

    {#if entry?.progress}
      <div class="mt-6 max-w-sm">
        <div class="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div class="h-full bg-accent" style={`width: ${pct}%`}></div>
        </div>
        <p class="timecode mt-1.5 text-sm">
          {entry.progress.watchedEpisodes} / {entry.progress.totalEpisodes} épisodes
          vus · {pct} %
        </p>
        {#if entry.progress.nextEpisode}
          {@const next = entry.progress.nextEpisode}
          <button
            class="btn btn-primary mt-3"
            disabled={busyEpisodeId === next.episodeId}
            onclick={() => markWatched(next.episodeId)}>
            ▶ Reprendre · S{String(next.seasonNumber).padStart(2, "0")}E{String(
              next.episodeNumber,
            ).padStart(2, "0")}
          </button>
        {/if}
      </div>
    {/if}

    {#if detail.overview}
      <p class="mt-6 max-w-2xl text-dim">{detail.overview}</p>
    {/if}

    {#if hasProviders && extras}
      <!-- Où regarder (TMDB / JustWatch). -->
      <section class="mt-6 max-w-2xl">
        <h2 class="mb-2 font-display text-sm font-bold">Où regarder</h2>
        <div class="flex flex-col gap-2">
          {#each [{ label: "Streaming", list: extras.watchProviders.flatrate }, { label: "Location", list: extras.watchProviders.rent }, { label: "Achat", list: extras.watchProviders.buy }] as group (group.label)}
            {#if group.list.length > 0}
              <div class="flex items-center gap-2.5">
                <span class="timecode w-20 shrink-0 text-xs">{group.label}</span>
                <div class="flex flex-wrap gap-1.5">
                  {#each group.list as p (p.name)}
                    <span title={p.name} class="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-surface-2">
                      {#if p.logoUrl}
                        <img src={p.logoUrl} alt={p.name} class="h-full w-full object-cover" loading="lazy" />
                      {:else}
                        <span class="text-[0.6rem] font-bold text-dim">{p.name.slice(0, 2)}</span>
                      {/if}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        </div>
        <p class="timecode mt-1.5 text-[0.65rem]">Données de disponibilité JustWatch · France</p>
      </section>
    {/if}

    <!-- Actions -->
    {#if !entry}
      <div class="mt-6">
        <button class="btn btn-primary" disabled={saving} onclick={add}>
          Ajouter à ma bibliothèque
        </button>
      </div>
    {:else}
      <div class="card mt-6 max-w-xl p-4">
        <div class="flex flex-wrap items-center gap-2.5">
          {#if isMovie}
            <!-- Movies: a single seen/not-seen toggle stands in for progress. -->
            {#if entry.status === "COMPLETED"}
              <button
                class="btn btn-ghost"
                disabled={saving}
                onclick={() => patch({ status: "PLANNED" })}>
                Marquer comme non vu
              </button>
            {:else}
              <button
                class="btn btn-primary"
                disabled={saving}
                onclick={() => patch({ status: "COMPLETED" })}>
                <Icon name="check" class="h-4 w-4" /> Marquer comme vu
              </button>
            {/if}
          {/if}

          {#if isOverride}
            <button
              class="btn btn-ghost"
              disabled={saving}
              onclick={() => patch({ status: "WATCHING" })}>
              Reprendre
            </button>
          {:else}
            <button
              class="btn btn-ghost"
              disabled={saving}
              onclick={() => patch({ status: "PAUSED" })}>
              En pause
            </button>
            <button
              class="btn btn-ghost"
              disabled={saving}
              onclick={() => patch({ status: "DROPPED" })}>
              Abandonner
            </button>
          {/if}

          <button
            class="btn btn-ghost"
            disabled={saving}
            onclick={() => patch({ favorite: !entry.favorite })}>
            <Icon name="star" class="h-4 w-4 {entry.favorite ? 'text-accent' : ''}" />
            {entry.favorite ? "Retirer des favoris" : "Favori"}
          </button>

          <label class="ml-auto flex items-center gap-2 text-sm text-dim">
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
        </div>

        <textarea
          placeholder="Notes personnelles…"
          rows="3"
          class="input mt-3"
          value={entry.notes ?? ""}
          onchange={(e) => {
            const raw = e.currentTarget.value;
            void patch({ notes: raw === "" ? null : raw });
          }}></textarea>

        <div class="mt-3 border-t border-border pt-3">
          <button class="btn btn-danger" disabled={saving} onclick={removeEntry}>
            Retirer de ma bibliothèque
          </button>
        </div>
      </div>
    {/if}

    <!-- Episodes (series/anime). Watch actions only once the media is tracked. -->
    {#if !isMovie && detail.seasons.length > 0}
      <div class="mt-10 mb-4 flex items-baseline justify-between gap-3">
        <h2 class="font-display text-xl font-bold">Épisodes</h2>
        {#if hasSpecials}
          <button
            class="chip"
            class:chip-on={showSpecials}
            onclick={() => (showSpecials = !showSpecials)}>
            {showSpecials ? "Masquer les Specials" : "Afficher les Specials"}
          </button>
        {/if}
      </div>
      <div class="flex flex-col gap-4 pb-4">
        {#each visibleSeasons as season (season.number)}
          <!-- Seasons are collapsible and collapsed by default. -->
          <details class="card group">
            <summary
              class="flex cursor-pointer list-none items-center gap-3 rounded-[inherit] bg-surface-2 px-4 py-2.5 font-display font-semibold group-open:rounded-b-none group-open:border-b group-open:border-border [&::-webkit-details-marker]:hidden">
              <Icon
                name="chevron-right"
                class="h-4 w-4 shrink-0 text-dim transition-transform group-open:rotate-90" />
              <span class="min-w-0 flex-1 truncate">
                {season.title ?? `Saison ${season.number}`}
              </span>
              <span class="timecode shrink-0 text-xs">
                {seasonWatchedCount(season)}/{season.episodes.length}
              </span>
              {#if entry && season.id}
                {#if seasonWatched(season)}
                  <span
                    class="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
                    <Icon name="check" class="h-4 w-4" /> Vue
                  </span>
                {:else}
                  <button
                    class="btn btn-ghost shrink-0 px-2.5 py-1 text-xs"
                    disabled={busySeasonId === season.id}
                    onclick={(e) => {
                      e.preventDefault();
                      markSeason(season.id!);
                    }}>
                    Marquer la saison vue
                  </button>
                {/if}
              {/if}
            </summary>
            <ul>
              {#each season.episodes as episode (episode.number)}
                {@const watched = episode.watchCount > 0}
                {@const historyOpen = openHistory === episode.id}
                <li class="border-b border-border last:border-b-0">
                  <div class="flex items-center gap-3 px-4 py-2.5">
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
                    {#if watched && episode.id}
                      <!-- Toggles the watch history (dates + ratings). -->
                      <button
                        class="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-success hover:underline"
                        aria-expanded={historyOpen}
                        onclick={() =>
                          (openHistory = historyOpen ? null : episode.id)}>
                        <Icon name="check" class="h-4 w-4" />
                        {dateFmt.format(new Date(episode.watches[0].watchedAt))}
                      </button>
                    {/if}
                    {#if entry && episode.id}
                      {@const canThrough =
                        season.number > 0 &&
                        !allPreviousWatched(season.number, episode.number)}
                      <!-- Split-button: primary marks this episode; the attached
                           chevron opens a dropdown (e.g. "mark through here"). -->
                      <div
                        class="inline-flex shrink-0 items-stretch overflow-hidden rounded-lg text-xs font-semibold {watched
                          ? 'border border-border text-dim'
                          : 'bg-btn text-btn-fg'}">
                        <button
                          class="px-2.5 py-1 transition-[filter,background-color,color] disabled:opacity-50 {watched
                            ? 'hover:bg-surface-2 hover:text-fg'
                            : 'hover:brightness-95'}"
                          disabled={busyEpisodeId === episode.id}
                          onclick={() => markWatched(episode.id!)}>
                          {watched ? "Revoir" : "Marquer vu"}
                        </button>
                        {#if canThrough || watched}
                          <button
                            class="border-l px-1.5 transition-[filter,background-color,color] {watched
                              ? 'border-border hover:bg-surface-2 hover:text-fg'
                              : 'border-btn-fg/25 hover:brightness-95'}"
                            aria-label="Plus d'actions"
                            aria-haspopup="menu"
                            onclick={(e) => openMenu(e, episode.id!)}>
                            ▾
                          </button>
                        {/if}
                      </div>
                    {/if}
                  </div>

                  {#if historyOpen && watched}
                    <!-- Watch history: one row per viewing (date · rating · delete). -->
                    <ul
                      class="flex flex-col gap-1.5 border-t border-border bg-surface-2/40 px-4 py-2.5 pl-[4.5rem]">
                      {#each episode.watches as w (w.id)}
                        <li class="flex items-center gap-3 text-xs">
                          <span class="flex-1 text-dim">
                            {dateFmt.format(new Date(w.watchedAt))}
                          </span>
                          <label class="flex items-center gap-1.5">
                            <span class="text-dim">Note</span>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.5"
                              placeholder="—"
                              class="input h-7 w-16 px-2 py-0 text-xs"
                              value={w.rating ?? ""}
                              onchange={(e) =>
                                setRating(w.id, e.currentTarget.value)} />
                          </label>
                          <button
                            class="text-dim hover:text-danger"
                            aria-label="Supprimer ce visionnage"
                            onclick={() => removeWatch(w.id)}>
                            Supprimer
                          </button>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </li>
              {/each}
            </ul>
          </details>
        {/each}
      </div>
    {/if}

    {#if extras && extras.cast.length > 0}
      <section class="mt-10">
        <h2 class="mb-3 font-display text-xl font-bold">Distribution</h2>
        <div
          class="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          {#each extras.cast as c (c.name + (c.role ?? ""))}
            <div class="w-24 shrink-0 snap-start text-center">
              <div
                class="aspect-2/3 w-full overflow-hidden rounded-lg bg-surface-2">
                {#if c.photoUrl}
                  <img
                    src={c.photoUrl}
                    alt={c.name}
                    loading="lazy"
                    class="h-full w-full object-cover" />
                {/if}
              </div>
              <p class="mt-1.5 truncate text-xs font-semibold">{c.name}</p>
              {#if c.role}
                <p class="truncate text-[0.65rem] text-dim">{c.role}</p>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if extras && extras.similar.length > 0}
      <section class="mt-10">
        <h2 class="mb-3 font-display text-xl font-bold">Titres similaires</h2>
        <div
          class="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          {#each extras.similar as s (`${s.source}:${s.sourceId}`)}
            <a
              href={`/media/${s.type.toLowerCase()}/${s.sourceId}`}
              class="w-28 shrink-0 snap-start sm:w-32">
              <div
                class="card overflow-hidden transition-[border-color] hover:border-accent">
                <Poster src={s.posterUrl} title={s.title} />
              </div>
              <p class="mt-1.5 truncate text-xs font-semibold">{s.title}</p>
            </a>
          {/each}
        </div>
      </section>
    {/if}
  </div>

  <!-- Episode-row dropdown (fixed so it escapes the season card's clipping). -->
  {#if menu && menuCtx}
    {@const active = menu}
    {@const showThrough =
      menuCtx.seasonNumber > 0 &&
      !allPreviousWatched(menuCtx.seasonNumber, menuCtx.episode.number)}
    {@const showUnwatch = menuCtx.episode.watchCount > 0}
    <button
      class="fixed inset-0 z-30 cursor-default"
      aria-label="Fermer le menu"
      onclick={() => (menu = null)}></button>
    <div
      role="menu"
      class="fixed z-40 min-w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      style={`top: ${active.top}px; right: ${active.right}px`}>
      {#if showThrough}
        <button
          class="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
          onclick={() => markThrough(active.episodeId)}>
          Marquer vu jusqu'ici
        </button>
      {/if}
      {#if showUnwatch}
        <button
          class="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2 {showThrough
            ? 'border-t border-border'
            : ''}"
          onclick={() => markUnwatch(active.episodeId)}>
          {menuCtx.episode.watchCount > 1
            ? "Retirer un visionnage"
            : "Marquer non vu"}
        </button>
      {/if}
    </div>
  {/if}
{:else if !error}
  <div class="mx-auto max-w-4xl px-4 py-6 md:px-8">
    <p class="timecode text-sm">Chargement…</p>
  </div>
{/if}
