<script lang="ts">
  import { ApiError, listGames } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type { GameEntryDto, GameStatus } from "@tracklore/shared";

  const STATUS_LABELS: Record<GameStatus, string> = {
    BACKLOG: "À jouer",
    PLAYING: "En cours",
    COMPLETED: "Terminé",
    DROPPED: "Abandonné",
  };
  const STATUS_ORDER: GameStatus[] = [
    "BACKLOG",
    "PLAYING",
    "COMPLETED",
    "DROPPED",
  ];

  const STATUS_TABS: { label: string; value: GameStatus | undefined }[] = [
    { label: "Tout", value: undefined },
    ...STATUS_ORDER.map((value) => ({ label: STATUS_LABELS[value], value })),
  ];

  type SortKey = "added" | "title" | "rating";
  const SORTS: { label: string; value: SortKey }[] = [
    { label: "Ajout récent", value: "added" },
    { label: "Titre A→Z", value: "title" },
    { label: "Note", value: "rating" },
  ];

  let entries = $state<GameEntryDto[]>([]);
  let statusFilter = $state<GameStatus | undefined>(undefined);
  let favoritesOnly = $state(false);
  let sort = $state<SortKey>("added");
  let query = $state("");
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    loading = true;
    error = null;
    listGames()
      .then((result) => {
        entries = result;
      })
      .catch((err) => {
        error = err instanceof ApiError ? err.message : "Chargement impossible";
      })
      .finally(() => {
        loading = false;
      });
  });

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (favoritesOnly && !e.favorite) return false;
      if (q && !e.game.title.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...list];
    switch (sort) {
      case "title":
        sorted.sort((a, b) => a.game.title.localeCompare(b.game.title, "fr"));
        break;
      case "rating":
        sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
        break;
      case "added":
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
    }
    return sorted;
  });

  const hasQuery = $derived(query.trim() !== "");
  const hasFilters = $derived(statusFilter !== undefined || favoritesOnly);

  function clearFilters() {
    statusFilter = undefined;
    favoritesOnly = false;
  }
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-6">
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Jeux
    </h1>
    <p class="timecode mt-1 text-sm">
      {shown.length} jeu{shown.length > 1 ? "x" : ""}
    </p>
  </header>

  <div class="relative mb-4">
    <span
      class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-dim">
      <Icon name="search" class="h-5 w-5" />
    </span>
    <input
      type="search"
      placeholder="Filtrer ma bibliothèque…"
      bind:value={query}
      class="input pl-10" />
  </div>

  <div class="mb-2 flex flex-wrap gap-2">
    {#each STATUS_TABS as tab (tab.label)}
      <button
        class="chip"
        class:chip-on={statusFilter === tab.value}
        onclick={() => (statusFilter = tab.value)}>
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="mb-7 flex flex-wrap items-center gap-2">
    <button
      class="chip inline-flex items-center gap-1"
      class:chip-on={favoritesOnly}
      onclick={() => (favoritesOnly = !favoritesOnly)}>
      <Icon name="star" class="h-3.5 w-3.5" /> Favoris
    </button>
    <span class="ml-auto flex items-center gap-2 text-sm text-dim">
      Trier
      <select bind:value={sort} class="input h-9 w-auto py-0 pr-8 text-sm">
        {#each SORTS as s (s.value)}
          <option value={s.value}>{s.label}</option>
        {/each}
      </select>
    </span>
  </div>

  {#if error}
    <p
      class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  {:else if loading}
    <div
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each { length: 10 } as _, i (i)}
        <div class="card">
          <div class="aspect-2/3 w-full animate-pulse bg-surface-2"></div>
          <div class="flex flex-col gap-2 p-3">
            <div class="h-3.5 w-4/5 animate-pulse rounded bg-surface-2"></div>
            <div class="h-3 w-1/2 animate-pulse rounded bg-surface-2"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if shown.length === 0}
    <div
      class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim">
      {#if !hasFilters && !hasQuery}
        <p>Tu n'as encore aucun jeu dans ta bibliothèque.</p>
        <a href="/search" class="btn btn-primary mt-4 inline-flex">
          <Icon name="search" class="h-4 w-4" /> Chercher un jeu
        </a>
      {:else if hasQuery && !hasFilters}
        <p>
          Aucun jeu ne correspond à « {query.trim()} » dans ta bibliothèque.
          <a
            href={`/search?query=${encodeURIComponent(query.trim())}`}
            class="font-semibold text-accent hover:underline">
            Le chercher dans le catalogue →
          </a>
        </p>
      {:else}
        <p>
          {#if hasQuery}
            Aucun jeu ne correspond à ces filtres pour « {query.trim()} ».
          {:else}
            Aucun jeu ne correspond à ces filtres.
          {/if}
        </p>
        <button class="btn btn-ghost mt-4" onclick={clearFilters}>
          Effacer les filtres
        </button>
      {/if}
    </div>
  {:else}
    <div
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each shown as entry (entry.id)}
        <a
          href={`/games/${entry.game.sourceId}`}
          class="card group transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-accent">
          <Poster src={entry.game.coverUrl} title={entry.game.title} />
          <div class="flex flex-col gap-1.5 p-3">
            <span class="font-display text-sm leading-tight font-semibold">
              {#if entry.favorite}<span class="text-accent">★</span
                >&nbsp;{/if}{entry.game.title}
            </span>
            <span class="timecode text-xs">
              {STATUS_LABELS[entry.status]}{#if entry.rating !== null}
                · ★ {entry.rating}{/if}
            </span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
