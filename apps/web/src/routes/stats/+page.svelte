<script lang="ts">
  import type { MediaType, StatsDto } from "@tracklore/shared";
  import { getStats, ApiError } from "$lib/api/client";

  let stats = $state<StatsDto | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    getStats()
      .then((s) => (stats = s))
      .catch((err) => {
        error = err instanceof ApiError ? err.message : "Statistiques indisponibles";
      })
      .finally(() => (loading = false));
  });

  const nf = new Intl.NumberFormat("fr-FR");

  const TYPE_LABEL: Record<MediaType, string> = {
    MOVIE: "Films",
    SERIES: "Séries",
    ANIME: "Animés",
  };
  // Few, distinct category colors (kept in sync with the type split).
  const TYPE_COLOR: Record<MediaType, string> = {
    SERIES: "var(--accent)",
    ANIME: "#4a9db8",
    MOVIE: "#c77da0",
  };

  const tiles = $derived(
    stats
      ? [
          { value: nf.format(stats.hoursWatched), unit: "h", label: "Heures vues" },
          { value: nf.format(stats.episodesWatched), unit: "", label: "Épisodes vus" },
          { value: nf.format(stats.seriesCompleted), unit: "", label: "Séries terminées" },
          { value: nf.format(stats.moviesWatched), unit: "", label: "Films vus" },
        ]
      : [],
  );

  const totalHours = $derived(
    stats ? stats.timeByType.reduce((sum, t) => sum + t.hours, 0) : 0,
  );
  const maxGenre = $derived(stats?.topGenres[0]?.count ?? 0);

  const isEmpty = $derived(
    !!stats &&
      stats.episodesWatched === 0 &&
      stats.moviesWatched === 0 &&
      stats.seriesCompleted === 0,
  );
</script>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-8">
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Statistiques
    </h1>
    <p class="mt-1 text-dim">Ton activité en un coup d’œil.</p>
  </header>

  {#if error}
    <p
      class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  {:else if loading}
    <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {#each { length: 4 } as _, i (i)}
        <div class="card p-4">
          <div class="h-8 w-2/3 animate-pulse rounded bg-surface-2"></div>
          <div class="mt-2 h-3 w-4/5 animate-pulse rounded bg-surface-2"></div>
        </div>
      {/each}
    </div>
  {:else if isEmpty}
    <div
      class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim">
      Rien à afficher pour l’instant. Marque des épisodes ou des films comme vus
      pour voir tes statistiques.
    </div>
  {:else if stats}
    <!-- Stat tiles -->
    <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {#each tiles as t (t.label)}
        <div class="card p-4">
          <p class="font-display text-3xl font-extrabold tabular-nums">
            {t.value}<span class="text-lg text-dim">{t.unit}</span>
          </p>
          <p class="timecode mt-1 text-xs uppercase">{t.label}</p>
        </div>
      {/each}
    </div>

    <div class="grid gap-5 md:grid-cols-2">
      <!-- Type split (share of watch time) -->
      <section class="card p-5">
        <h2 class="mb-4 font-display text-lg font-bold">Répartition du temps</h2>
        {#if totalHours > 0}
          <div class="flex h-3 overflow-hidden rounded-full">
            {#each stats.timeByType as s (s.type)}
              <div
                style={`width:${(s.hours / totalHours) * 100}%;background:${TYPE_COLOR[s.type]}`}>
              </div>
            {/each}
          </div>
          <ul class="mt-4 flex flex-col gap-2">
            {#each stats.timeByType as s (s.type)}
              <li class="flex items-center gap-2.5 text-sm">
                <span
                  class="h-3 w-3 rounded-sm"
                  style={`background:${TYPE_COLOR[s.type]}`}></span>
                <span class="flex-1">{TYPE_LABEL[s.type]}</span>
                <span class="timecode"
                  >{Math.round((s.hours / totalHours) * 100)} %</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="timecode text-sm">Pas encore de temps de visionnage.</p>
        {/if}
      </section>

      <!-- Top genres -->
      <section class="card p-5">
        <h2 class="mb-4 font-display text-lg font-bold">Genres favoris</h2>
        {#if stats.topGenres.length > 0}
          <ul class="flex flex-col gap-3">
            {#each stats.topGenres as g (g.genre)}
              <li>
                <div class="mb-1 flex justify-between text-sm">
                  <span>{g.genre}</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    class="h-full rounded-full bg-accent"
                    style={`width:${maxGenre > 0 ? (g.count / maxGenre) * 100 : 0}%`}>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="timecode text-sm">Aucun genre pour l’instant.</p>
        {/if}
      </section>
    </div>
  {/if}
</div>
