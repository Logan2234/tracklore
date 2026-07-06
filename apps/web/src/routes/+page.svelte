<script lang="ts">
  import type {
    CalendarEntryDto,
    LibraryEntryDto,
    NextEpisodeDto,
  } from "@tracklore/shared";
  import { getCalendar, listLibrary, watchEpisode } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import Icon from "$lib/components/Icon.svelte";

  let watching = $state<LibraryEntryDto[]>([]);
  let planned = $state<LibraryEntryDto[]>([]);
  let upcoming = $state<CalendarEntryDto[]>([]);
  let loading = $state(true);
  let resuming = $state<string | null>(null); // entry id being resumed

  async function load() {
    try {
      const [w, p, c] = await Promise.all([
        listLibrary({ status: "WATCHING" }),
        listLibrary({ status: "PLANNED" }),
        getCalendar(),
      ]);
      watching = w;
      planned = p;
      upcoming = c;
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
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-8">
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      {greeting}{#if auth.user}, {auth.user.displayName}{/if}.
    </h1>
    <p class="mt-1 text-dim">Reprends là où tu t’es arrêté.</p>
  </header>

  <!-- À reprendre (real) -->
  <section class="mb-10">
    <div class="mb-4 flex items-baseline justify-between">
      <h2 class="font-display text-xl font-bold">À reprendre</h2>
      <a href="/library" class="text-sm font-semibold text-dim hover:text-fg"
        >Tout voir →</a>
    </div>
    {#if loading}
      <p class="timecode text-sm">Chargement…</p>
    {:else if watching.length === 0}
      <div
        class="rounded-xl border border-dashed border-border px-6 py-12 text-center text-dim">
        Rien en cours. <a
          href="/search"
          class="font-semibold text-accent hover:underline">Trouve un titre</a> à
        suivre.
      </div>
    {:else}
      <div
        class="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {#each watching as e (e.id)}
          <div class="w-32 shrink-0 snap-start sm:w-36">
            <a
              href={`/media/${e.mediaItem.type.toLowerCase()}/${e.mediaItem.sourceId}`}
              class="block">
              <div
                class="card overflow-hidden transition-[border-color] hover:border-accent">
                <Poster src={e.mediaItem.posterUrl} title={e.mediaItem.title} />
              </div>
              <p class="mt-2 truncate font-display text-sm font-semibold">
                {e.mediaItem.title}
              </p>
            </a>
            {#if e.progress}
              <div class="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                <div class="h-full bg-accent" style={`width: ${pct(e)}%`}></div>
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
  </section>

  <!-- Prochains épisodes (real) -->
  {#if week.length > 0}
    <section class="mb-10">
      <div class="mb-4 flex items-baseline justify-between">
        <h2 class="font-display text-xl font-bold">À venir</h2>
        <a href="/calendar" class="text-sm font-semibold text-dim hover:text-fg"
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
              <p class="timecode text-xs">{epCode(e)} · {dayShort(e.airDate)}</p>
            </div>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- À voir (real) -->
  {#if planned.length > 0}
    <section class="mb-10">
      <div class="mb-4 flex items-baseline justify-between">
        <h2 class="font-display text-xl font-bold">Ta liste d’envies</h2>
        <a href="/library" class="text-sm font-semibold text-dim hover:text-fg"
          >Tout voir →</a>
      </div>
      <div
        class="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {#each planned as e (e.id)}
          <a
            href={`/media/${e.mediaItem.type.toLowerCase()}/${e.mediaItem.sourceId}`}
            class="w-32 shrink-0 snap-start sm:w-36">
            <div
              class="card overflow-hidden transition-[border-color] hover:border-accent">
              <Poster src={e.mediaItem.posterUrl} title={e.mediaItem.title} />
            </div>
            <p class="mt-2 truncate font-display text-sm font-semibold">
              {e.mediaItem.title}
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
        <p class="font-display font-bold">Ton année en séries</p>
        <p class="text-sm text-dim">Heures vues, genres, séries terminées…</p>
      </div>
    </div>
    <span class="text-dim">→</span>
  </a>
</div>
