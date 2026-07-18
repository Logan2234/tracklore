<script lang="ts">
  import {
    getCalendar,
    listBooks,
    listGames,
    listLibrary,
    listMusic,
    watchEpisode,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Carousel from "$lib/components/Carousel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import type {
    BookEntryDto,
    CalendarEntryDto,
    GameEntryDto,
    LibraryEntryDto,
    MusicEntryDto,
    NextEpisodeDto,
  } from "@tracklore/shared";
  import { Domain } from "@tracklore/shared";

  const mediaOn = $derived(isDomainEnabled(Domain.MEDIA));
  const gamesOn = $derived(isDomainEnabled(Domain.GAMES));
  const booksOn = $derived(isDomainEnabled(Domain.BOOKS));
  const musicOn = $derived(isDomainEnabled(Domain.MUSIC));

  let watching = $state<LibraryEntryDto[]>([]);
  let upcoming = $state<CalendarEntryDto[]>([]);
  let playingGames = $state<GameEntryDto[]>([]);
  let readingBooks = $state<BookEntryDto[]>([]);
  let toListenAlbums = $state<MusicEntryDto[]>([]);
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
        listLibrary({ statuses: ["WATCHING"] }).then(
          (r) => (watching = r.items),
        ),
      );
      jobs.push(getCalendar().then((c) => (upcoming = c)));
    } else {
      watching = [];
      upcoming = [];
    }
    if (gamesOn)
      jobs.push(
        listGames({ statuses: ["PLAYING"] }).then(
          (r) => (playingGames = r.items),
        ),
      );
    else playingGames = [];
    if (booksOn)
      jobs.push(
        listBooks({ statuses: ["READING"] }).then(
          (r) => (readingBooks = r.items),
        ),
      );
    else readingBooks = [];
    if (musicOn)
      jobs.push(
        listMusic({ statuses: ["TO_LISTEN"] }).then(
          (r) => (toListenAlbums = r.items),
        ),
      );
    else toListenAlbums = [];

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

  // Surface the most recently watched shows first; capped so "reprendre"
  // stays a quick strip rather than the whole watching list.
  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  const RESUME_LIMIT = 20;
  const watchingRecent = $derived(
    [...watching]
      .sort((a, b) => time(b.lastWatchedAt) - time(a.lastWatchedAt))
      .slice(0, RESUME_LIMIT),
  );

  // A domain section shows only when it has something in progress.
  const showScreens = $derived(
    mediaOn && (watching.length > 0 || week.length > 0),
  );
  const showGames = $derived(gamesOn && playingGames.length > 0);
  const showBooks = $derived(booksOn && readingBooks.length > 0);
  const showMusic = $derived(musicOn && toListenAlbums.length > 0);
  const nothing = $derived(
    !loading && !showScreens && !showGames && !showBooks && !showMusic,
  );
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="home"
    title={`${greeting}${auth.user ? ", " + auth.user.displayName : ""}.`}
    subtitle="Reprends là où tu t’es arrêté." />

  {#if loading}
    <div class="mb-10 flex flex-col gap-8">
      {#each { length: 2 } as _, i (i)}
        <div>
          <div class="mb-4 h-3 w-20 skeleton rounded"></div>
          <div class="flex gap-4 overflow-hidden">
            {#each { length: 4 } as _, j (j)}
              <div class="w-32 shrink-0 sm:w-36">
                <div class="aspect-2/3 w-full skeleton rounded-xl"></div>
                <div class="mt-1.5 h-3 w-4/5 skeleton rounded"></div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else if nothing}
    <EmptyState class="mb-10">
      Rien en cours pour l’instant.
      <a href="/search" class="link-accent">Trouve un titre</a> à suivre.
    </EmptyState>
  {/if}

  <!-- Écrans -->
  {#if showScreens}
    <section class="mb-10">
      <div class="mb-4 flex items-baseline justify-between">
        <p class="timecode text-xs uppercase">Écrans</p>
        <a href="/media" class="text-sm font-semibold text-dim hover:text-fg"
          >Voir plus →</a>
      </div>

      {#if watching.length > 0}
        <h2 class="mb-3 font-display text-lg font-bold">À reprendre</h2>
        <div class="mb-6">
          <Carousel items={watchingRecent} keyOf={(e) => e.id}>
            {#snippet card(e)}
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
                  <div
                    class="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
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
            {/snippet}
          </Carousel>
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
      <Carousel items={playingGames} keyOf={(e) => e.id}>
        {#snippet card(e)}
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
        {/snippet}
      </Carousel>
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
      <Carousel items={readingBooks} keyOf={(e) => e.id}>
        {#snippet card(e)}
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
        {/snippet}
      </Carousel>
    </section>
  {/if}

  <!-- Musique -->
  {#if showMusic}
    <section class="mb-10">
      <div class="mb-4 flex items-baseline justify-between">
        <p class="timecode text-xs uppercase">Musique</p>
        <a href="/music" class="text-sm font-semibold text-dim hover:text-fg"
          >Voir →</a>
      </div>
      <h2 class="mb-3 font-display text-lg font-bold">À écouter</h2>
      <Carousel items={toListenAlbums} keyOf={(e) => e.id}>
        {#snippet card(e)}
          <a
            href={`/music/${e.album.sourceId}`}
            class="w-32 shrink-0 snap-start sm:w-36">
            <div
              class="card overflow-hidden transition-[border-color] hover:border-accent">
              <Poster src={e.album.coverUrl} title={e.album.title} />
            </div>
            <p class="mt-2 truncate font-display text-sm font-semibold">
              {e.album.title}
            </p>
          </a>
        {/snippet}
      </Carousel>
    </section>
  {/if}

  <!-- Quick links -->
  <div class="grid gap-3 sm:grid-cols-2">
    <a
      href="/stats"
      class="card flex items-center justify-between p-5 transition-[border-color] hover:border-accent">
      <div class="flex items-center gap-3">
        <Icon name="stats" class="h-6 w-6 text-accent" />
        <div>
          <p class="font-display font-bold">Tes statistiques</p>
          <p class="text-sm text-dim">
            Écrans, jeux et livres en un coup d’œil.
          </p>
        </div>
      </div>
      <span class="text-dim">→</span>
    </a>

    <a
      href="/account"
      class="card flex items-center justify-between p-5 transition-[border-color] hover:border-accent">
      <div class="flex items-center gap-3">
        <Icon name="user" class="h-6 w-6 text-accent" />
        <div>
          <p class="font-display font-bold">Mon compte</p>
          <p class="text-sm text-dim">Profil, préférences et notifications.</p>
        </div>
      </div>
      <span class="text-dim">→</span>
    </a>
  </div>
</div>
