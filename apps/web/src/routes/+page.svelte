<script lang="ts">
  import type { LibraryEntryDto } from "@tracklore/shared";
  import { listLibrary } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import Icon from "$lib/components/Icon.svelte";

  let watching = $state<LibraryEntryDto[]>([]);
  let planned = $state<LibraryEntryDto[]>([]);
  let loading = $state(true);

  $effect(() => {
    Promise.all([
      listLibrary({ status: "WATCHING" }),
      listLibrary({ status: "PLANNED" }),
    ])
      .then(([w, p]) => {
        watching = w;
        planned = p;
      })
      .catch(() => {})
      .finally(() => (loading = false));
  });

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

  // "Cette semaine" is a preview until the release calendar is wired to air dates.
  const thisWeek = [
    { title: "Severance", code: "S02E05", day: "Aujourd’hui" },
    { title: "Shōgun", code: "S01E05", day: "Demain" },
    { title: "Frieren", code: "S01E29", day: "Ven." },
  ];
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
          <a href={`/library/${e.id}`} class="w-32 shrink-0 snap-start sm:w-36">
            <div
              class="card overflow-hidden transition-[border-color] hover:border-accent">
              <Poster src={e.mediaItem.posterUrl} title={e.mediaItem.title} />
            </div>
            <p class="mt-2 truncate font-display text-sm font-semibold">
              {e.mediaItem.title}
            </p>
            {#if e.progress}
              <div class="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                <div class="h-full bg-accent" style={`width: ${pct(e)}%`}></div>
              </div>
              <p class="timecode mt-1 text-xs">
                {e.progress.watchedEpisodes} / {e.progress.totalEpisodes}
              </p>
            {/if}
          </a>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Cette semaine (preview) -->
  <section class="mb-10">
    <div class="mb-4 flex items-baseline justify-between">
      <div class="flex items-baseline gap-3">
        <h2 class="font-display text-xl font-bold">Cette semaine</h2>
        <span
          class="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-dim"
          >Aperçu</span>
      </div>
      <a href="/calendar" class="text-sm font-semibold text-dim hover:text-fg"
        >Calendrier →</a>
    </div>
    <div class="grid gap-3 sm:grid-cols-3">
      {#each thisWeek as ep (ep.title + ep.code)}
        <div class="card flex items-center gap-3 p-3">
          <div class="w-10 shrink-0 overflow-hidden rounded-md">
            <Poster src={null} title={ep.title} />
          </div>
          <div class="min-w-0">
            <p class="truncate font-display text-sm font-semibold">
              {ep.title}
            </p>
            <p class="timecode text-xs">{ep.code} · {ep.day}</p>
          </div>
        </div>
      {/each}
    </div>
  </section>

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
          <a href={`/library/${e.id}`} class="w-32 shrink-0 snap-start sm:w-36">
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

  <!-- Bientôt : autres domaines -->
  <section class="mt-10">
    <div class="mb-4 flex items-baseline gap-3">
      <h2 class="font-display text-xl font-bold">Bientôt</h2>
      <span class="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-dim">
        Aperçu
      </span>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <a
        href="/games"
        class="card flex items-center gap-3 p-5 transition-[border-color] hover:border-accent">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent">
          <Icon name="gamepad" class="h-6 w-6" />
        </span>
        <div>
          <p class="font-display font-bold">Jeux</p>
          <p class="text-sm text-dim">Backlog, heures de jeu, platines.</p>
        </div>
      </a>
      <a
        href="/books"
        class="card flex items-center gap-3 p-5 transition-[border-color] hover:border-accent">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent">
          <Icon name="book" class="h-6 w-6" />
        </span>
        <div>
          <p class="font-display font-bold">Livres</p>
          <p class="text-sm text-dim">Lectures en cours, sagas, à lire.</p>
        </div>
      </a>
    </div>
  </section>
</div>
