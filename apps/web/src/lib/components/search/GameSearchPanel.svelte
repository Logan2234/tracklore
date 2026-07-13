<script lang="ts">
  import {
    ApiError,
    listGames,
    searchGames,
    upsertGameEntry,
  } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type {
    GameEntryDto,
    GameStatus,
    GameSummaryDto,
  } from "@tracklore/shared";
  import { SvelteMap } from "svelte/reactivity";

  // The search query is owned by the page and shared across domain panels.
  let { query }: { query: string } = $props();

  const STATUS_LABELS: Record<GameStatus, string> = {
    BACKLOG: "À jouer",
    PLAYING: "En cours",
    COMPLETED: "Terminé",
    DROPPED: "Abandonné",
  };

  const DEBOUNCE_MS = 300;

  let results = $state<GameSummaryDto[]>([]);
  let searching = $state(false);
  let searched = $state(false);
  let searchError = $state<string | null>(null);
  let searchId = 0;
  let debounceTimer: ReturnType<typeof setTimeout>;

  // Games already in the library, keyed by source id → their entry, so a search
  // result can be flagged (and jumped to) instead of re-added.
  let entries = $state<GameEntryDto[]>([]);
  const tracked = $derived(
    new SvelteMap(entries.map((e) => [e.game.sourceId, e])),
  );

  async function loadLibrary() {
    try {
      entries = await listGames();
    } catch {
      // A failed library load only costs the "already added" flag; ignore.
    }
  }

  $effect(() => {
    void loadLibrary();
  });

  // Debounced catalogue search.
  $effect(() => {
    const q = query.trim();
    clearTimeout(debounceTimer);
    if (!q) {
      searchId++;
      results = [];
      searched = false;
      searchError = null;
      searching = false;
      return;
    }
    debounceTimer = setTimeout(() => void runSearch(q), DEBOUNCE_MS);
    return () => clearTimeout(debounceTimer);
  });

  async function runSearch(q: string) {
    const mine = ++searchId;
    searching = true;
    searchError = null;
    try {
      const batch = (await searchGames(q)).results;
      if (mine !== searchId) return;
      results = batch;
      searched = true;
    } catch (err) {
      if (mine !== searchId) return;
      searchError =
        err instanceof ApiError ? err.message : "Recherche impossible";
    } finally {
      if (mine === searchId) searching = false;
    }
  }

  async function addGame(game: GameSummaryDto) {
    try {
      await upsertGameEntry({
        source: game.source,
        sourceId: game.sourceId,
        status: "BACKLOG",
      });
      await loadLibrary();
    } catch (err) {
      searchError = err instanceof ApiError ? err.message : "Ajout impossible";
    }
  }
</script>

{#if searchError}
  <p
    class="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
    {searchError}
  </p>
{/if}

{#if searching && results.length === 0}
  <div
    class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
    {#each { length: 10 } as _, i (i)}
      <div class="card flex flex-col">
        <div class="aspect-2/3 w-full animate-pulse bg-surface-2"></div>
        <div class="flex flex-col gap-2 p-3">
          <div class="h-3.5 w-4/5 animate-pulse rounded bg-surface-2"></div>
          <div class="h-3 w-1/2 animate-pulse rounded bg-surface-2"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if results.length > 0}
  <div
    class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
    {#each results as game (game.sourceId)}
      {@const entry = tracked.get(game.sourceId)}
      <div class="card group flex flex-col">
        <a href={`/games/${game.sourceId}`} class="block">
          <Poster src={game.coverUrl} title={game.title} />
        </a>
        <div class="flex flex-1 flex-col gap-2 p-3">
          <a
            href={`/games/${game.sourceId}`}
            class="font-display text-sm leading-tight font-semibold group-hover:text-accent">
            {game.title}
          </a>
          <span class="timecode text-xs">
            Jeu{#if game.year}
              · {game.year}{/if}
          </span>
          {#if entry}
            <span
              class="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-accent">
              <Icon name="check" class="h-3.5 w-3.5" />
              {STATUS_LABELS[entry.status]}
            </span>
          {:else}
            <button
              class="btn btn-primary mt-auto h-8 text-xs"
              onclick={() => addGame(game)}>
              <Icon name="plus" class="h-4 w-4" /> Ajouter
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{:else if searched}
  <p class="timecode text-sm">Aucun jeu trouvé.</p>
{:else}
  <div
    class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim">
    Lance une recherche pour trouver un jeu à ajouter.
  </div>
{/if}
