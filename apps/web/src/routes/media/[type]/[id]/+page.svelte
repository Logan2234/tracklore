<script lang="ts">
  import { page } from "$app/state";
  import {
    ApiError,
    deleteLibraryEntry,
    getCastDetail,
    getMediaDetail,
    getMediaExtras,
    unwatchEpisode,
    updateLibraryEntry,
    upsertLibraryEntry,
    watchEpisode,
    watchSeason,
    watchThrough,
  } from "$lib/api/client";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Lightbox from "$lib/components/Lightbox.svelte";
  import NoteField from "$lib/components/NoteField.svelte";
  import OwnershipField from "$lib/components/OwnershipField.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import RatingPips from "$lib/components/RatingPips.svelte";
  import {
    MEDIA_OWNERSHIP_SOURCES,
    MEDIA_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/ownership-sources";
  import type {
    CastDetailDto,
    CastMemberDto,
    EntryStatus,
    MediaDetailDto,
    MediaDetailSeasonDto,
    MediaExtrasDto,
    MediaType,
  } from "@tracklore/shared";
  import { isDormant } from "@tracklore/shared";
  import { SvelteDate } from "svelte/reactivity";

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
    DROPPED: { label: "Abandonné", cls: "border border-danger text-danger" },
  };

  // Surfaced as a tooltip on the status badge, so each state's meaning is clear.
  const STATUS_DESC: Record<EntryStatus, string> = {
    PLANNED: "Dans ta liste, pas encore commencé.",
    WATCHING: "Tu regardes ce titre en ce moment.",
    UP_TO_DATE:
      "Tu as vu tous les épisodes disponibles ; en attente de nouveaux.",
    COMPLETED: "Tu as terminé ce titre.",
    DROPPED: "Tu as arrêté et ne comptes pas le reprendre.",
  };

  // Brand-ish colors per rating source (no official logos — those are
  // trademarked). Literal classes so Tailwind picks them up.
  const RATING_STYLES: Record<string, string> = {
    IMDb: "bg-[#f5c518] text-black",
    RT: "bg-[#fa320a] text-white",
    Metacritic: "bg-[#66cc33] text-black",
    AniList: "bg-[#02a9ff] text-white",
  };

  let detail = $state<MediaDetailDto | null>(null);
  let error = $state<string | null>(null);
  let busyEpisodeId = $state<string | null>(null);
  let busySeasonId = $state<string | null>(null);

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
  let confirmRemove = $state(false);
  let removing = $state(false);

  // Poster + backdrop + extras' backdrop gallery (TMDB only), deduped, for the
  // lightbox carousel.
  const galleryImages = $derived.by(() => {
    if (!detail) return [];
    const urls: string[] = [];
    if (detail.posterUrl) urls.push(detail.posterUrl);
    if (detail.backdropUrl && !urls.includes(detail.backdropUrl)) {
      urls.push(detail.backdropUrl);
    }
    for (const img of extras?.images ?? []) {
      if (!urls.includes(img)) urls.push(img);
    }
    return urls.map((src) => ({ src, alt: detail!.title }));
  });

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  function openLightbox(url: string | null) {
    if (!url) return;
    const i = galleryImages.findIndex((img) => img.src === url);
    lightboxIndex = i >= 0 ? i : 0;
    lightboxOpen = true;
  }

  const seasonWatched = (season: MediaDetailSeasonDto) =>
    season.episodes.length > 0 &&
    season.episodes.every((ep) => ep.watchCount > 0);

  // True when every regular episode *before* this one is watched — then "mark
  // through here" would only mark this episode (same as "Marquer vu"), so it's
  // hidden. Specials are not part of the linear run.
  function allPreviousWatched(
    seasonNumber: number,
    episodeNumber: number,
  ): boolean {
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
    detail = null; // Clear stale content so the loader shows on navigation.
    getMediaDetail(t, i)
      .then((result) => (detail = result))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          error =
            "Ce titre est réservé aux comptes ayant activé le contenu pour adultes (réglages).";
        } else {
          error =
            err instanceof ApiError ? err.message : "Chargement impossible";
        }
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

  // Cast modal: the clicked member (for the header shown immediately) plus its
  // lazily-loaded detail. Only members with an id are clickable (TMDB persons).
  let castMember = $state<CastMemberDto | null>(null);
  let castDetail = $state<CastDetailDto | null>(null);
  let castLoading = $state(false);

  function openCast(member: CastMemberDto) {
    if (!member.id) return;
    castMember = member;
    castDetail = null;
    castLoading = true;
    const source = type === "ANIME" ? "anilist" : "tmdb";
    getCastDetail(source, member.id)
      .then((d) => (castDetail = d))
      .catch(() => {})
      .finally(() => (castLoading = false));
  }

  function closeCast() {
    castMember = null;
    castDetail = null;
  }

  const entry = $derived(detail?.entry ?? null);
  const isMovie = $derived(detail?.type === "MOVIE");
  const isOverride = $derived(entry?.status === "DROPPED");
  const dormant = $derived(entry ? isDormant(entry) : false);
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
      error =
        err instanceof ApiError ? err.message : "Impossible d'ajouter ce média";
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
        err instanceof ApiError
          ? err.message
          : "Impossible de marquer comme vu";
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
        err instanceof ApiError
          ? err.message
          : "Impossible de marquer la saison";
    } finally {
      busySeasonId = null;
    }
  }

  const seasonWatchedCount = (season: MediaDetailSeasonDto) =>
    season.episodes.filter((e) => e.watchCount > 0).length;

  // Calendar-day count until an episode's air date; 0 (or negative) once it's
  // aired, matching the backend's `airDate <= now` gate.
  function daysUntilAir(airDate: string): number {
    const airStart = new SvelteDate(airDate);
    airStart.setHours(0, 0, 0, 0);
    const todayStart = new SvelteDate();
    todayStart.setHours(0, 0, 0, 0);
    return Math.round((airStart.getTime() - todayStart.getTime()) / 86_400_000);
  }

  // Label shown instead of the watch button while an episode hasn't aired yet;
  // null once it can be marked (aired, or airDate unknown as with AniList).
  function upcomingLabel(airDate: string | null): string | null {
    if (!airDate) return null;
    const days = daysUntilAir(airDate);
    if (days <= 0) return null;
    return days === 1 ? "Demain" : `Dans ${days} jours`;
  }

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
        err instanceof ApiError
          ? err.message
          : "Impossible de marquer les épisodes";
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
        err instanceof ApiError
          ? err.message
          : "Impossible d'annuler le visionnage";
    } finally {
      busyEpisodeId = null;
    }
  }

  async function doRemove() {
    if (!entry) return;
    removing = true;
    error = null;
    try {
      await deleteLibraryEntry(entry.id);
      confirmRemove = false;
      await reload(); // Entry becomes null → the page returns to the "add" state.
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Suppression impossible";
    } finally {
      removing = false;
    }
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === "Escape" && castMember && closeCast()} />

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
  <div class="relative">
    {#if detail.backdropUrl}
      <button
        type="button"
        class="block w-full cursor-zoom-in"
        aria-label="Agrandir l'image"
        onclick={() => openLightbox(detail?.backdropUrl ?? null)}>
        <img
          src={detail.backdropUrl}
          alt=""
          class="h-44 w-full object-cover md:h-60" />
      </button>
    {:else}
      <div
        class="h-44 w-full bg-linear-to-br from-surface-2 to-surface md:h-60">
      </div>
    {/if}
    <div
      class="absolute inset-0 bg-linear-to-t from-bg via-bg/50 to-transparent">
    </div>
    <a
      href="/media"
      class="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-3 py-1.5 text-sm font-semibold backdrop-blur hover:bg-bg">
      ← Écrans
    </a>
  </div>

  <!-- relative z-10: the hero above is positioned, so without a stacking
       context here it would paint over the poster pulled up into it. -->
  <div class="relative z-10 mx-auto max-w-4xl px-4 pb-6 md:px-8 md:pb-10">
    <div class="-mt-24 flex flex-col gap-5 sm:flex-row sm:items-end md:-mt-28">
      <button
        type="button"
        class="w-32 shrink-0 overflow-hidden rounded-xl border border-border shadow-lg md:w-44 {detail.posterUrl
          ? 'cursor-zoom-in'
          : ''}"
        aria-label="Agrandir l'image"
        onclick={() => openLightbox(detail?.posterUrl ?? null)}>
        <Poster src={detail.posterUrl} title={detail.title} />
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim">
            {TYPE_LABELS[detail.type]}
          </span>
          {#if detail.isAdult}
            <span
              class="rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-bold text-danger">
              18+
            </span>
          {/if}
          {#if entry}
            <span
              title={STATUS_DESC[entry.status]}
              class="rounded-full px-2.5 py-0.5 text-xs font-bold {STATUS_META[
                entry.status
              ].cls}">
              {STATUS_META[entry.status].label}
            </span>
            {#if dormant}
              <span
                title="Série en cours laissée de côté depuis plus de 30 jours."
                class="rounded-full border border-border px-2.5 py-0.5 text-xs font-bold text-dim">
                ⏸ En pause
              </span>
            {/if}
          {/if}
        </div>
        <h1
          class="mt-2 font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
          {detail.title}
        </h1>
        <p class="timecode mt-1.5 text-sm">
          {#if detail.year}{detail.year}{/if}
          {#if detail.genres.length > 0}
            {#if detail.year}
              ·
            {/if}{detail.genres.slice(0, 3).join(", ")}
          {/if}
          {#if !isMovie && detail.seasons.length > 0}
            · {detail.airingFinished ? "Diffusion terminée" : "En diffusion"}
          {/if}
        </p>

        {#if extras && extras.ratings.length > 0}
          <div class="mt-2.5 flex flex-wrap gap-1.5">
            {#each extras.ratings as r (r.source)}
              <svelte:element
                this={r.url ? "a" : "span"}
                href={r.url}
                target={r.url ? "_blank" : undefined}
                rel={r.url ? "noopener noreferrer" : undefined}
                class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold {RATING_STYLES[
                  r.source
                ] ?? 'bg-surface-2 text-fg'} {r.url
                  ? 'transition-opacity hover:opacity-80'
                  : ''}">
                <span>{r.source}</span>
                <span class="tabular-nums opacity-90">{r.score}</span>
              </svelte:element>
            {/each}
          </div>
        {/if}
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
            ▶ Continuer · S{String(next.seasonNumber).padStart(2, "0")}E{String(
              next.episodeNumber,
            ).padStart(2, "0")}
          </button>
        {/if}
      </div>
    {/if}

    {#if detail.overview}
      <p class="mt-6 max-w-2xl text-dim">{detail.overview}</p>
    {/if}

    <!-- Actions -->
    {#if !entry}
      <div class="mt-6">
        <button class="btn btn-primary" disabled={saving} onclick={add}>
          Ajouter à ma bibliothèque
        </button>
      </div>
    {:else}
      <div
        class="mt-6 flex max-w-xl flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <!-- Block header: label + favourite pinned top-right. -->
        <div class="flex items-center justify-between gap-2">
          <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase"
            >Mon suivi</span>
          <button
            type="button"
            aria-pressed={entry.favorite}
            disabled={saving}
            title={entry.favorite
              ? "Retirer des coups de cœur"
              : "Coup de cœur"}
            aria-label={entry.favorite
              ? "Retirer des coups de cœur"
              : "Coup de cœur"}
            onclick={() => patch({ favorite: !entry.favorite })}
            class="rounded-full p-1.5 transition-colors disabled:opacity-50 {entry.favorite
              ? 'text-accent'
              : 'text-dim hover:bg-surface-2 hover:text-fg'}">
            <Icon
              name="star"
              class="h-5 w-5 {entry.favorite ? 'fill-accent' : ''}" />
          </button>
        </div>

        <!-- Status is derived server-side (shown as a badge in the hero); here
             we only offer the state-changing actions it reacts to. -->
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
              onclick={() => patch({ status: "DROPPED" })}>
              Abandonner
            </button>
          {/if}
        </div>

        <hr class="border-border" />

        <RatingPips
          value={entry.rating}
          onChange={(v) => patch({ rating: v })} />

        <NoteField
          value={entry.notes}
          placeholder="Une réplique, un souvenir…"
          onChange={(v) => patch({ notes: v })} />

        <hr class="border-border" />

        <OwnershipField
          status={entry.ownershipStatus}
          source={entry.ownershipSource}
          statusOptions={MEDIA_OWNERSHIP_STATUS_OPTIONS}
          sourceOptionsByStatus={MEDIA_OWNERSHIP_SOURCES}
          onChange={(status, source) =>
            patch({
              ownershipStatus: status as typeof entry.ownershipStatus,
              ownershipSource: source,
            })} />

        <div class="flex justify-end">
          <button
            type="button"
            class="text-sm font-medium text-dim underline-offset-4 transition-colors hover:text-danger hover:underline disabled:opacity-50"
            disabled={saving}
            onclick={() => (confirmRemove = true)}>
            Retirer de ma bibliothèque
          </button>
        </div>
      </div>
    {/if}

    {#if hasProviders && extras}
      <!-- Où regarder: deliberately discreet (small, muted logos). -->
      <section class="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span class="timecode text-xs">Où regarder</span>
        {#each [{ label: "Streaming", list: extras.watchProviders.flatrate }, { label: "Location", list: extras.watchProviders.rent }, { label: "Achat", list: extras.watchProviders.buy }] as group (group.label)}
          {#if group.list.length > 0}
            <div class="flex items-center gap-1.5">
              <span class="text-[0.65rem] text-dim">{group.label}</span>
              {#each group.list as p (p.name)}
                <span
                  title={p.name}
                  class="grid h-6 w-6 place-items-center overflow-hidden rounded bg-surface-2 opacity-80">
                  {#if p.logoUrl}
                    <img
                      src={p.logoUrl}
                      alt={p.name}
                      loading="lazy"
                      class="h-full w-full object-cover" />
                  {:else}
                    <span class="text-[0.55rem] font-bold text-dim"
                      >{p.name.slice(0, 2)}</span>
                  {/if}
                </span>
              {/each}
            </div>
          {/if}
        {/each}
        <span class="timecode w-full text-[0.6rem] text-dim"
          >JustWatch · France</span>
      </section>
    {/if}

    <!-- Episodes (series/anime). Watch actions only once the media is tracked. -->
    {#if !isMovie && detail.seasons.length > 0}
      <h2 class="mt-10 mb-4 font-display text-xl font-bold">Épisodes</h2>
      <div class="flex flex-col gap-4 pb-4">
        {#each orderedSeasons as season (season.number)}
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
                      <span
                        class="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
                        <Icon name="check" class="h-4 w-4" />
                        {dateFmt.format(new Date(episode.watches[0].watchedAt))}
                      </span>
                    {/if}
                    {#if entry && episode.id}
                      {@const upcoming =
                        !watched && upcomingLabel(episode.airDate)}
                      {#if upcoming}
                        <span
                          class="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-dim"
                          title="Pas encore diffusé">
                          {upcoming}
                        </span>
                      {:else}
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
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          </details>
        {/each}
      </div>
    {/if}

    {#snippet castCard(c: CastMemberDto, clickable: boolean)}
      <div
        class="aspect-2/3 w-full overflow-hidden rounded-lg border border-transparent bg-surface-2 {clickable
          ? 'transition-colors group-hover:border-accent'
          : ''}">
        {#if c.photoUrl}
          <img
            src={c.photoUrl}
            alt={c.name}
            loading="lazy"
            class="h-full w-full object-cover" />
        {/if}
      </div>
      <p
        class="mt-1.5 truncate text-xs font-semibold {clickable
          ? 'group-hover:text-accent'
          : ''}">
        {c.name}
      </p>
      {#if c.role}
        <p class="truncate text-[0.65rem] text-dim">{c.role}</p>
      {/if}
    {/snippet}

    {#if extras && extras.cast.length > 0}
      <section class="mt-10">
        <h2 class="mb-3 font-display text-xl font-bold">Distribution</h2>
        <div
          class="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pt-2 pb-2 md:mx-0 md:px-0">
          {#each extras.cast as c (c.name + (c.role ?? ""))}
            {#if c.id}
              <button
                type="button"
                onclick={() => openCast(c)}
                class="group w-24 shrink-0 snap-start text-center">
                {@render castCard(c, true)}
              </button>
            {:else}
              <div class="w-24 shrink-0 snap-start text-center">
                {@render castCard(c, false)}
              </div>
            {/if}
          {/each}
        </div>
      </section>
    {/if}

    {#if extras && extras.similar.length > 0}
      <section class="mt-10">
        <h2 class="mb-3 font-display text-xl font-bold">Titres similaires</h2>
        <div
          class="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pt-2 pb-2 md:mx-0 md:px-0">
          {#each extras.similar as s (`${s.source}:${s.sourceId}`)}
            <a
              href={`/media/${s.type.toLowerCase()}/${s.sourceId}`}
              class="w-28 shrink-0 snap-start sm:w-32">
              <div class="card transition-colors hover:border-accent">
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

  <!-- Cast detail modal (TMDB person), lazily loaded on click. -->
  {#if castMember}
    <div
      class="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        class="absolute inset-0 cursor-default bg-black/60"
        aria-label="Fermer"
        onclick={closeCast}></button>
      <div
        role="dialog"
        aria-modal="true"
        class="card relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl">
        <button
          class="absolute top-3 right-3 rounded-full p-1.5 text-dim hover:bg-surface-2 hover:text-fg"
          aria-label="Fermer"
          onclick={closeCast}>
          <Icon name="x" class="h-5 w-5" />
        </button>

        <div class="flex gap-4">
          <div
            class="aspect-2/3 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            {#if castDetail?.photoUrl ?? castMember.photoUrl}
              <img
                src={castDetail?.photoUrl ?? castMember.photoUrl}
                alt={castMember.name}
                class="h-full w-full object-cover" />
            {/if}
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-display text-xl font-bold text-balance">
              {castMember.name}
            </h3>
            {#if castMember.role}
              <p class="text-sm text-dim">{castMember.role}</p>
            {/if}
            {#if castDetail?.subtitle}
              <p class="timecode mt-1 text-xs">{castDetail.subtitle}</p>
            {/if}
          </div>
        </div>

        {#if castLoading}
          <p class="timecode mt-4 text-sm">Chargement…</p>
        {:else if castDetail}
          {#if castDetail.imdbId || castDetail.wikidataId || castDetail.homepage}
            <div class="mt-4 flex flex-wrap gap-2">
              {#if castDetail.homepage}
                <a
                  href={castDetail.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-dim transition-colors hover:border-accent hover:text-accent"
                  >Site officiel ↗</a>
              {/if}
              {#if castDetail.imdbId}
                <a
                  href={`https://www.imdb.com/name/${castDetail.imdbId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-dim transition-colors hover:border-accent hover:text-accent"
                  >IMDb ↗</a>
              {/if}
              {#if castDetail.wikidataId}
                <a
                  href={`https://www.wikidata.org/wiki/${castDetail.wikidataId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-dim transition-colors hover:border-accent hover:text-accent"
                  >Wikidata ↗</a>
              {/if}
            </div>
          {/if}
          {#if castDetail.description}
            <p
              class="mt-4 text-sm leading-relaxed whitespace-pre-line text-fg/90">
              {castDetail.description}
            </p>
          {/if}
          {#if castDetail.knownFor.length > 0}
            <h4 class="mt-5 mb-2 font-display text-sm font-bold">Connu pour</h4>
            <div class="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
              {#each castDetail.knownFor as k (`${k.source}:${k.sourceId}`)}
                <a
                  href={`/media/${k.type.toLowerCase()}/${k.sourceId}`}
                  onclick={closeCast}
                  class="w-20 shrink-0 snap-start">
                  <div
                    class="card overflow-hidden transition-[border-color] hover:border-accent">
                    <Poster src={k.posterUrl} title={k.title} />
                  </div>
                  <p class="mt-1 truncate text-[0.65rem] font-semibold">
                    {k.title}
                  </p>
                </a>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}

  {#if confirmRemove}
    <ConfirmationModal
      title="Retirer de ma bibliothèque"
      message={`Retirer « ${detail.title} » de ta bibliothèque ? Ta progression, tes visionnages et ta note seront supprimés.`}
      confirmLabel="Retirer"
      danger
      busy={removing}
      onConfirm={doRemove}
      onCancel={() => (confirmRemove = false)} />
  {/if}

  {#if lightboxOpen}
    <Lightbox
      images={galleryImages}
      bind:index={lightboxIndex}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <div class="mx-auto max-w-4xl px-4 py-6 md:px-8">
    <p class="timecode text-sm">Chargement…</p>
  </div>
{/if}
