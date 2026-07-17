<script lang="ts">
  import {
    ApiError,
    unwatchEpisode,
    watchEpisode,
    watchSeason,
    watchThrough,
  } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import type {
    LibraryEntryDto,
    MediaDetailSeasonDto,
  } from "@tracklore/shared";
  import { SvelteDate } from "svelte/reactivity";

  let {
    seasons,
    entry,
    reload,
    onError,
  }: {
    seasons: MediaDetailSeasonDto[];
    entry: LibraryEntryDto | null;
    reload: () => Promise<void>;
    onError: (message: string) => void;
  } = $props();

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  let busyEpisodeId = $state<string | null>(null);
  let busySeasonId = $state<string | null>(null);

  // Episode-row dropdown, positioned fixed (the season card clips overflow).
  let menu = $state<{ episodeId: string; top: number; right: number } | null>(
    null,
  );

  const seasonWatched = (season: MediaDetailSeasonDto) =>
    season.episodes.length > 0 &&
    season.episodes.every((ep) => ep.watchCount > 0);

  const seasonWatchedCount = (season: MediaDetailSeasonDto) =>
    season.episodes.filter((e) => e.watchCount > 0).length;

  // True when every regular episode *before* this one is watched — then "mark
  // through here" would only mark this episode (same as "Marquer vu"), so it's
  // hidden. Specials are not part of the linear run.
  function allPreviousWatched(
    seasonNumber: number,
    episodeNumber: number,
  ): boolean {
    for (const s of seasons) {
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
    if (!m) return null;
    for (const s of seasons) {
      const ep = s.episodes.find((e) => e.id === m.episodeId);
      if (ep) return { seasonNumber: s.number, episode: ep };
    }
    return null;
  });

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

  async function markWatched(episodeId: string) {
    busyEpisodeId = episodeId;
    onError("");
    try {
      await watchEpisode(episodeId);
      await reload();
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : "Impossible de marquer comme vu",
      );
    } finally {
      busyEpisodeId = null;
    }
  }

  async function markSeason(seasonId: string) {
    busySeasonId = seasonId;
    onError("");
    try {
      await watchSeason(seasonId);
      await reload();
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : "Impossible de marquer la saison",
      );
    } finally {
      busySeasonId = null;
    }
  }

  async function markThrough(episodeId: string) {
    menu = null;
    busyEpisodeId = episodeId;
    onError("");
    try {
      await watchThrough(episodeId);
      await reload();
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : "Impossible de marquer les épisodes",
      );
    } finally {
      busyEpisodeId = null;
    }
  }

  async function markUnwatch(episodeId: string) {
    menu = null;
    busyEpisodeId = episodeId;
    onError("");
    try {
      await unwatchEpisode(episodeId);
      await reload();
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'annuler le visionnage",
      );
    } finally {
      busyEpisodeId = null;
    }
  }
</script>

<h2 class="mt-10 mb-4 font-display text-xl font-bold">Épisodes</h2>
<div class="flex flex-col gap-4 pb-4">
  {#each seasons as season (season.number)}
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
                {@const upcoming = !watched && upcomingLabel(episode.airDate)}
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
