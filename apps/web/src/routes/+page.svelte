<script lang="ts">
  import {
    getCalendar,
    listBooks,
    listGames,
    listLibrary,
    watchEpisode,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { Domain } from "@tracklore/shared";
  import type {
    BookEntryDto,
    CalendarEntryDto,
    GameEntryDto,
    LibraryEntryDto,
    NextEpisodeDto,
  } from "@tracklore/shared";

  const mediaOn = $derived(isDomainEnabled(Domain.MEDIA));
  const gamesOn = $derived(isDomainEnabled(Domain.GAMES));
  const booksOn = $derived(isDomainEnabled(Domain.BOOKS));

  let watching = $state<LibraryEntryDto[]>([]);
  let upcoming = $state<CalendarEntryDto[]>([]);
  let playingGames = $state<GameEntryDto[]>([]);
  let readingBooks = $state<BookEntryDto[]>([]);
  let loading = $state(true);
  let resuming = $state<string | null>(null); // entry id being resumed

  // Fetch only the enabled domains' "in progress" content — the dashboard is
  // best-effort, so a failing call just leaves its section empty. Reads the
  // domain flags synchronously so the effect reloads when one is toggled.
  async function load() {
    if (!auth.user) return;
    loading = true;
    const jobs: Promise<unknown>[] = [];

    if (mediaOn) {
      jobs.push(
        listLibrary({ status: "WATCHING" }).then((w) => (watching = w)),
      );
      jobs.push(getCalendar().then((c) => (upcoming = c)));
    } else {
      watching = [];
      upcoming = [];
    }
    if (gamesOn)
      jobs.push(
        listGames({ status: "PLAYING" }).then((g) => (playingGames = g)),
      );
    else playingGames = [];
    if (booksOn)
      jobs.push(
        listBooks({ status: "READING" }).then((b) => (readingBooks = b)),
      );
    else readingBooks = [];

    try {
      await Promise.all(jobs);
    } catch {
      // Dashboard is best-effort; leave sections empty on error.
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  const epCodeOf = (n: NextEpisodeDto) =>
    `S${String(n.seasonNumber).padStart(2, "0")}E${String(n.episodeNumber).padStart(2, "0")}`;

  /** One-click resume: mark the entry's next unwatched episode as watched. */
  async function resume(entry: LibraryEntryDto) {
    const next = entry.progress?.nextEpisode;
    if (!next) return;
    resuming = entry.id;
    try {
      await watchEpisode(next.episodeId);
      await load();
    } catch {
      // ignore; the card stays as-is
    } finally {
      resuming = null;
    }
  }

  const greeting = $derived.by(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  });

  function pct(e: LibraryEntryDto): number {
    if (!e.progress || e.progress.totalEpisodes === 0) return 0;
    return Math.round(
      (e.progress.watchedEpisodes / e.progress.totalEpisodes) * 100,
    );
  }

  const weekdayShort = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
  function dayShort(iso: string): string {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    if (diff === 0) return "Auj.";
    if (diff === 1) return "Demain";
    return weekdayShort.format(new Date(iso));
  }
  const epCode = (e: CalendarEntryDto) =>
    `S${String(e.seasonNumber).padStart(2, "0")}E${String(e.episodeNumber).padStart(2, "0")}`;
  const mediaHref = (e: CalendarEntryDto) =>
    `/media/${e.mediaItem.type.toLowerCase()}/${e.mediaItem.sourceId}`;
  const week = $derived(upcoming.slice(0, 3));

  // Surface the most recently watched shows first.
  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  const watchingRecent = $derived(
    [...watching].sort((a, b) => time(b.lastWatchedAt) - time(a.lastWatchedAt)),
  );

  // A domain section shows only when it has something in progress.
  const showScreens = $derived(
    mediaOn && (watching.length > 0 || week.length > 0),
  );
  const showGames = $derived(gamesOn && playingGames.length > 0);
  const showBooks = $derived(booksOn && readingBooks.length > 0);
  const nothing = $derived(
    !loading && !showScreens && !showGames && !showBooks,
  );
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-8">
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      {greeting}{#if auth.user}, {auth.user.displayName}{/if}.
    </h1>
    <p class="mt-1 text-dim">Reprends là où tu t’es arrêté.</p>
  </header>

  {#if loading}
    <p class="timecode text-sm">Chargement…</p>
  {:else if nothing}
    <div
      class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim">
      Rien en cours pour l’instant.
      <a href="/search" class="font-semibold text-accent hover:underline"
        >Trouve un titre</a> à suivre.
    </div>
  {/if}

  <!-- Écrans -->
  {#if showScreens}
    <section class="mb-10">
      <div class="mb-4 flex items-baseline justify-between">
        <p class="timecode text-xs uppercase">Écrans</p>
        <a href="/media" class="text-sm font-semibold text-dim hover:text-fg"
          >Voir →</a>
      </div>

      {#if watching.length > 0}
        <h2 class="mb-3 font-display text-lg font-bold">À reprendre</h2>
        <div
          class="-mx-4 mb-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          {#each watchingRecent as e (e.id)}
            <div class="w-32 shrink-0 snap-start sm:w-36">
              <a
                href={`/media/${e.mediaItem.type.toLowerCase()}/${e.mediaItem.sourceId}`}
                class="block">
                <div
                  class="card overflow-hidden transition-[border-color] hover:border-accent">
                  <Poster
                    src={e.mediaItem.posterUrl}
                    title={e.mediaItem.title} />
                </div>
                <p class="mt-2 truncate font-display text-sm font-semibold">
                  {e.mediaItem.title}
                </p>
              </a>
              {#if e.progress}
                <div class="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div class="h-full bg-accent" style={`width: ${pct(e)}%`}>
                  </div>
                </div>
                <p class="timecode mt-1 text-xs">
                  {e.progress.watchedEpisodes} / {e.progress.totalEpisodes}
                </p>
                {#if e.progress.nextEpisode}
                  <button
                    class="btn btn-primary mt-1.5 w-full px-2 py-1 text-xs"
                    disabled={resuming === e.id}
                    onclick={() => resume(e)}>
                    ▶ {epCodeOf(e.progress.nextEpisode)}
                  </button>
                {/if}
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if week.length > 0}
        <div class="mb-3 flex items-baseline justify-between">
          <h2 class="font-display text-lg font-bold">À venir</h2>
          <a
            href="/calendar"
            class="text-sm font-semibold text-dim hover:text-fg"
            >Calendrier →</a>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          {#each week as e (e.mediaItem.id + epCode(e))}
            <a
              href={mediaHref(e)}
              class="card flex items-center gap-3 p-3 transition-[border-color] hover:border-accent">
              <div class="w-10 shrink-0 overflow-hidden rounded-md">
                <Poster src={e.mediaItem.posterUrl} title={e.mediaItem.title} />
              </div>
              <div class="min-w-0">
                <p class="truncate font-display text-sm font-semibold">
                  {e.mediaItem.title}
                </p>
                <p class="timecode text-xs">
                  {epCode(e)} · {dayShort(e.airDate)}
                </p>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- Jeux -->
  {#if showGames}
    <section class="mb-10">
      <div class="mb-4 flex items-baseline justify-between">
        <p class="timecode text-xs uppercase">Jeux</p>
        <a href="/games" class="text-sm font-semibold text-dim hover:text-fg"
          >Voir →</a>
      </div>
      <h2 class="mb-3 font-display text-lg font-bold">En cours</h2>
      <div
        class="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {#each playingGames as e (e.id)}
          <a
            href={`/games/${e.game.sourceId}`}
            class="w-32 shrink-0 snap-start sm:w-36">
            <div
              class="card overflow-hidden transition-[border-color] hover:border-accent">
              <Poster src={e.game.coverUrl} title={e.game.title} />
            </div>
            <p class="mt-2 truncate font-display text-sm font-semibold">
              {e.game.title}
            </p>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Livres -->
  {#if showBooks}
    <section class="mb-10">
      <div class="mb-4 flex items-baseline justify-between">
        <p class="timecode text-xs uppercase">Livres</p>
        <a href="/books" class="text-sm font-semibold text-dim hover:text-fg"
          >Voir →</a>
      </div>
      <h2 class="mb-3 font-display text-lg font-bold">En lecture</h2>
      <div
        class="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {#each readingBooks as e (e.id)}
          <a
            href={`/books/${e.book.sourceId}`}
            class="w-32 shrink-0 snap-start sm:w-36">
            <div
              class="card overflow-hidden transition-[border-color] hover:border-accent">
              <Poster src={e.book.coverUrl} title={e.book.title} />
            </div>
            <p class="mt-2 truncate font-display text-sm font-semibold">
              {e.book.title}
            </p>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Stats teaser -->
  <a
    href="/stats"
    class="card flex items-center justify-between p-5 transition-[border-color] hover:border-accent">
    <div class="flex items-center gap-3">
      <Icon name="stats" class="h-6 w-6 text-accent" />
      <div>
        <p class="font-display font-bold">Tes statistiques</p>
        <p class="text-sm text-dim">Écrans, jeux et livres en un coup d’œil.</p>
      </div>
    </div>
    <span class="text-dim">→</span>
  </a>
</div>
