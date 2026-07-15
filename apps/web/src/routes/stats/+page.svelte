<script lang="ts">
  import type {
    BookStatsDto,
    BookStatus,
    GameStatsDto,
    GameStatus,
    MediaType,
    StatsDto,
  } from "@tracklore/shared";
  import {
    getBookStats,
    getGameStats,
    getStats,
    ApiError,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { Domain } from "@tracklore/shared";

  let stats = $state<StatsDto | null>(null);
  let gameStats = $state<GameStatsDto | null>(null);
  let bookStats = $state<BookStatsDto | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const mediaOn = $derived(isDomainEnabled(Domain.MEDIA));
  const gamesOn = $derived(isDomainEnabled(Domain.GAMES));
  const booksOn = $derived(isDomainEnabled(Domain.BOOKS));

  // Only query the domains the user keeps enabled — the API 403s the others.
  // Waits for the profile so a disabled domain is never fetched. Re-runs when a
  // domain is toggled in /account.
  $effect(() => {
    if (!auth.user) return;
    loading = true;
    error = null;

    const jobs: Promise<unknown>[] = [];
    if (mediaOn) jobs.push(getStats().then((s) => (stats = s)));
    else stats = null;
    if (gamesOn) jobs.push(getGameStats().then((g) => (gameStats = g)));
    else gameStats = null;
    if (booksOn) jobs.push(getBookStats().then((b) => (bookStats = b)));
    else bookStats = null;

    Promise.all(jobs)
      .catch((err) => {
        error =
          err instanceof ApiError ? err.message : "Statistiques indisponibles";
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

  // Game status funnel: dim pile → amber in-progress → green done → red dropped.
  const GAME_STATUS: Record<GameStatus, { label: string; color: string }> = {
    BACKLOG: { label: "À jouer", color: "var(--dim)" },
    PLAYING: { label: "En cours", color: "var(--accent)" },
    COMPLETED: { label: "Terminé", color: "var(--success)" },
    DROPPED: { label: "Abandonné", color: "var(--danger)" },
  };
  const GAME_STATUS_ORDER: GameStatus[] = [
    "BACKLOG",
    "PLAYING",
    "COMPLETED",
    "DROPPED",
  ];

  // Book status funnel: dim to-read → amber reading → green read → red dropped.
  const BOOK_STATUS: Record<BookStatus, { label: string; color: string }> = {
    TO_READ: { label: "À lire", color: "var(--dim)" },
    READING: { label: "En lecture", color: "var(--accent)" },
    READ: { label: "Lu", color: "var(--success)" },
    DROPPED: { label: "Abandonné", color: "var(--danger)" },
  };
  const BOOK_STATUS_ORDER: BookStatus[] = [
    "TO_READ",
    "READING",
    "READ",
    "DROPPED",
  ];
  // BookStatsDto keys, in the same order as BOOK_STATUS_ORDER.
  const BOOK_STATUS_KEY: Record<
    BookStatus,
    "toRead" | "reading" | "read" | "dropped"
  > = {
    TO_READ: "toRead",
    READING: "reading",
    READ: "read",
    DROPPED: "dropped",
  };

  const tiles = $derived(
    stats
      ? [
          {
            value: nf.format(stats.hoursWatched),
            unit: "h",
            label: "Heures vues",
          },
          {
            value: nf.format(stats.episodesWatched),
            unit: "",
            label: "Épisodes vus",
          },
          {
            value: nf.format(stats.seriesCompleted),
            unit: "",
            label: "Séries terminées",
          },
          {
            value: nf.format(stats.moviesWatched),
            unit: "",
            label: "Films vus",
          },
        ]
      : [],
  );

  const gameTiles = $derived(
    gameStats
      ? [
          { value: gameStats.totalGames, label: "Jeux" },
          { value: gameStats.backlog, label: "À jouer" },
          { value: gameStats.playing, label: "En cours" },
          { value: gameStats.completed, label: "Terminés" },
        ]
      : [],
  );

  const bookTiles = $derived(
    bookStats
      ? [
          { value: bookStats.totalBooks, label: "Livres" },
          { value: bookStats.toRead, label: "À lire" },
          { value: bookStats.reading, label: "En lecture" },
          { value: bookStats.read, label: "Lus" },
        ]
      : [],
  );

  const totalHours = $derived(
    stats ? stats.timeByType.reduce((sum, t) => sum + t.hours, 0) : 0,
  );
  const maxGenre = $derived(stats?.topGenres[0]?.count ?? 0);
  const maxPlatform = $derived(gameStats?.topPlatforms[0]?.count ?? 0);
  const maxAuthor = $derived(bookStats?.topAuthors[0]?.count ?? 0);

  const gameCount = (status: GameStatus): number =>
    gameStats
      ? gameStats[
          status.toLowerCase() as
            "backlog" | "playing" | "completed" | "dropped"
        ]
      : 0;

  const bookCount = (status: BookStatus): number =>
    bookStats ? bookStats[BOOK_STATUS_KEY[status]] : 0;

  // A disabled domain counts as "empty" so it neither renders its section nor
  // blocks the global empty state.
  const mediaEmpty = $derived(
    !mediaOn ||
      (!!stats &&
        stats.episodesWatched === 0 &&
        stats.moviesWatched === 0 &&
        stats.seriesCompleted === 0),
  );
  const gamesEmpty = $derived(
    !gamesOn || (!!gameStats && gameStats.totalGames === 0),
  );
  const booksEmpty = $derived(
    !booksOn || (!!bookStats && bookStats.totalBooks === 0),
  );
  const allEmpty = $derived(mediaEmpty && gamesEmpty && booksEmpty);
</script>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-8">
    <h1
      class="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      <Icon name="stats" class="h-7 w-7 text-accent" />
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
  {:else if allEmpty}
    <div
      class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim">
      Rien à afficher pour l’instant. Marque des épisodes, des films, des jeux
      ou des livres pour voir tes statistiques.
    </div>
  {:else}
    {#if stats && !mediaEmpty}
      <!-- Écrans -->
      <section class="mb-10">
        <p class="timecode mb-3 text-xs uppercase">Écrans</p>
        <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            <h2 class="mb-4 font-display text-lg font-bold">
              Répartition du temps
            </h2>
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
      </section>
    {/if}

    {#if gameStats && !gamesEmpty}
      <!-- Jeux -->
      <section class="mb-10">
        <p class="timecode mb-3 text-xs uppercase">Jeux</p>
        <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each gameTiles as t (t.label)}
            <div class="card p-4">
              <p class="font-display text-3xl font-extrabold tabular-nums">
                {t.value}
              </p>
              <p class="timecode mt-1 text-xs uppercase">{t.label}</p>
            </div>
          {/each}
        </div>

        <div class="grid gap-5 md:grid-cols-2">
          <!-- Status funnel -->
          <section class="card p-5">
            <h2 class="mb-4 font-display text-lg font-bold">Progression</h2>
            <div class="flex h-3 overflow-hidden rounded-full bg-surface-2">
              {#each GAME_STATUS_ORDER as status (status)}
                {#if gameCount(status) > 0}
                  <div
                    style={`width:${(gameCount(status) / gameStats.totalGames) * 100}%;background:${GAME_STATUS[status].color}`}>
                  </div>
                {/if}
              {/each}
            </div>
            <ul class="mt-4 flex flex-col gap-2">
              {#each GAME_STATUS_ORDER as status (status)}
                {#if gameCount(status) > 0}
                  <li class="flex items-center gap-2.5 text-sm">
                    <span
                      class="h-3 w-3 rounded-sm"
                      style={`background:${GAME_STATUS[status].color}`}></span>
                    <span class="flex-1">{GAME_STATUS[status].label}</span>
                    <span class="timecode">{gameCount(status)}</span>
                  </li>
                {/if}
              {/each}
            </ul>
          </section>

          <!-- Top platforms -->
          <section class="card p-5">
            <h2 class="mb-4 font-display text-lg font-bold">Plateformes</h2>
            {#if gameStats.topPlatforms.length > 0}
              <ul class="flex flex-col gap-3">
                {#each gameStats.topPlatforms as p (p.platform)}
                  <li>
                    <div class="mb-1 flex justify-between text-sm">
                      <span class="truncate">{p.platform}</span>
                      <span class="timecode shrink-0">{p.count}</span>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        class="h-full rounded-full bg-accent"
                        style={`width:${maxPlatform > 0 ? (p.count / maxPlatform) * 100 : 0}%`}>
                      </div>
                    </div>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="timecode text-sm">Pas encore de plateforme.</p>
            {/if}
          </section>
        </div>
      </section>
    {/if}

    {#if bookStats && !booksEmpty}
      <!-- Livres -->
      <section>
        <p class="timecode mb-3 text-xs uppercase">Livres</p>
        <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each bookTiles as t (t.label)}
            <div class="card p-4">
              <p class="font-display text-3xl font-extrabold tabular-nums">
                {t.value}
              </p>
              <p class="timecode mt-1 text-xs uppercase">{t.label}</p>
            </div>
          {/each}
        </div>

        <div class="grid gap-5 md:grid-cols-2">
          <!-- Status funnel -->
          <section class="card p-5">
            <h2 class="mb-4 font-display text-lg font-bold">Progression</h2>
            <div class="flex h-3 overflow-hidden rounded-full bg-surface-2">
              {#each BOOK_STATUS_ORDER as status (status)}
                {#if bookCount(status) > 0}
                  <div
                    style={`width:${(bookCount(status) / bookStats.totalBooks) * 100}%;background:${BOOK_STATUS[status].color}`}>
                  </div>
                {/if}
              {/each}
            </div>
            <ul class="mt-4 flex flex-col gap-2">
              {#each BOOK_STATUS_ORDER as status (status)}
                {#if bookCount(status) > 0}
                  <li class="flex items-center gap-2.5 text-sm">
                    <span
                      class="h-3 w-3 rounded-sm"
                      style={`background:${BOOK_STATUS[status].color}`}></span>
                    <span class="flex-1">{BOOK_STATUS[status].label}</span>
                    <span class="timecode">{bookCount(status)}</span>
                  </li>
                {/if}
              {/each}
            </ul>
          </section>

          <!-- Top authors -->
          <section class="card p-5">
            <h2 class="mb-4 font-display text-lg font-bold">Auteurs</h2>
            {#if bookStats.topAuthors.length > 0}
              <ul class="flex flex-col gap-3">
                {#each bookStats.topAuthors as a (a.author)}
                  <li>
                    <div class="mb-1 flex justify-between text-sm">
                      <span class="truncate">{a.author}</span>
                      <span class="timecode shrink-0">{a.count}</span>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        class="h-full rounded-full bg-accent"
                        style={`width:${maxAuthor > 0 ? (a.count / maxAuthor) * 100 : 0}%`}>
                      </div>
                    </div>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="timecode text-sm">Pas encore d’auteur.</p>
            {/if}
          </section>
        </div>
      </section>
    {/if}
  {/if}
</div>
