<script lang="ts">
  import {
    ApiError,
    commitSteamImport,
    previewSteamImport,
    searchGames,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type {
    GameStatus,
    GameSummaryDto,
    SteamImportPreviewDto,
    SteamMatchedGameDto,
    SteamUnmatchedGameDto,
  } from "@tracklore/shared";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import {
    GAME_STATUS_LABELS as STATUS_LABELS,
    GAME_STATUS_ORDER as STATUS_ORDER,
  } from "$lib/status-labels";

  type Step = "input" | "review" | "done";
  let step = $state<Step>("input");

  let steamId = $state("");
  let loading = $state(false);
  let error = $state<string | null>(null);

  let preview = $state<SteamImportPreviewDto | null>(null);
  // One row per matched + unmatched game, keyed synthetically (stable within
  // one preview session) so a manual re-match doesn't disturb selection state.
  type Row =
    | { key: string; kind: "matched"; game: SteamMatchedGameDto }
    | { key: string; kind: "unmatched"; game: SteamUnmatchedGameDto };
  const rows = $derived<Row[]>(
    preview
      ? [
          ...preview.matched.map((game, i): Row => ({
            key: `m${i}`,
            kind: "matched",
            game,
          })),
          ...preview.unmatched.map((game, i): Row => ({
            key: `u${i}`,
            kind: "unmatched",
            game,
          })),
        ]
      : [],
  );

  // Per-row import selection + chosen status. SvelteSet/SvelteMap are already
  // reactive, so we mutate them in place rather than reassigning.
  const included = new SvelteSet<string>();
  const statuses = new SvelteMap<string, GameStatus>();
  // Manual catalogue match for a row (new match on a matched row, or the
  // first match on a previously-unmatched one).
  const picked = new SvelteMap<string, GameSummaryDto>();
  let hideOwned = $state(false);
  let importedCount = $state(0);

  // --- Per-row manual search ---
  let searchKey = $state<string | null>(null);
  let searchQuery = $state("");
  let searchResults = $state<GameSummaryDto[]>([]);
  let searching = $state(false);

  const fmtPlaytime = (min: number): string => {
    if (min === 0) return "jamais joué";
    const hours = Math.round(min / 60);
    return hours === 0 ? "< 1 h" : `${hours} h`;
  };

  const shown = $derived(
    rows.filter(
      (r) => !hideOwned || !(r.kind === "matched" && r.game.alreadyInLibrary),
    ),
  );
  const selectedCount = $derived(included.size);

  function matchOf(row: Row): GameSummaryDto | null {
    const override = picked.get(row.key);
    if (override) return override;
    if (row.kind === "unmatched") return null;
    return {
      source: "IGDB",
      sourceId: row.game.sourceId,
      title: row.game.title,
      year: null,
      coverUrl: row.game.coverUrl,
      isAdult: false,
    };
  }

  async function analyze() {
    if (!steamId.trim()) return;
    loading = true;
    error = null;
    try {
      const result = await previewSteamImport({ steamId: steamId.trim() });
      preview = result;
      // Default: import everything already matched and not already tracked; a
      // game played in the last two weeks lands as "En cours", the rest as "À
      // jouer" (Steam can't tell what you finished — promote those yourself).
      // Unmatched rows start unselected until manually associated.
      included.clear();
      statuses.clear();
      picked.clear();
      result.matched.forEach((g, i) => {
        if (!g.alreadyInLibrary) included.add(`m${i}`);
        statuses.set(`m${i}`, g.recentlyPlayed ? "PLAYING" : "BACKLOG");
      });
      result.unmatched.forEach((_g, i) => statuses.set(`u${i}`, "BACKLOG"));
      step = "review";
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Analyse impossible";
    } finally {
      loading = false;
    }
  }

  function toggle(key: string) {
    if (included.has(key)) included.delete(key);
    else included.add(key);
  }

  function selectAll(on: boolean) {
    included.clear();
    if (on) for (const r of shown) if (matchOf(r)) included.add(r.key);
  }

  function openSearch(row: Row) {
    searchKey = searchKey === row.key ? null : row.key;
    searchQuery =
      row.kind === "matched" ? row.game.title : (row.game.name ?? "");
    searchResults = [];
  }

  async function runSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }
    searching = true;
    try {
      searchResults = (await searchGames(searchQuery.trim())).results;
    } catch {
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  function chooseMatch(key: string, game: GameSummaryDto) {
    picked.set(key, game);
    included.add(key);
    searchKey = null;
    searchQuery = "";
    searchResults = [];
  }

  function playtimeOf(row: Row): number {
    return row.game.playtimeMinutes;
  }

  async function commit() {
    if (!preview || selectedCount === 0) return;
    loading = true;
    error = null;
    try {
      const games = rows
        .filter((r) => included.has(r.key))
        .map((r) => {
          const match = matchOf(r);
          if (!match) return null;
          return {
            sourceId: match.sourceId,
            status: statuses.get(r.key) ?? "BACKLOG",
            playtimeMinutes: playtimeOf(r),
          };
        })
        .filter((g) => g !== null);
      const result = await commitSteamImport({ games });
      importedCount = result.imported;
      step = "done";
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Import impossible";
    } finally {
      loading = false;
    }
  }

  function reset() {
    step = "input";
    preview = null;
    included.clear();
    statuses.clear();
    picked.clear();
    importedCount = 0;
    error = null;
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
  <div class="mb-6 flex items-center gap-3">
    <a
      href="/account/import"
      class="text-dim hover:text-fg"
      aria-label="Retour">
      <Icon name="chevron-left" class="h-5 w-5" />
    </a>
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Import Steam
    </h1>
  </div>

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if step === "input"}
    <p class="mb-6 max-w-xl text-sm text-dim">
      Récupère ta bibliothèque et ton temps de jeu Steam. Ton profil et les
      détails des jeux doivent être <strong class="text-fg">publics</strong> le
      temps de l'import (<a
        href="https://steamcommunity.com/my/edit/settings"
        target="_blank"
        rel="noopener noreferrer"
        class="link-accent">réglages de confidentialité ↗</a
      >).
    </p>

    <label class="mb-2 block text-sm font-semibold" for="steamId">
      Identifiant, pseudo ou URL de profil Steam
    </label>
    <div class="flex flex-col gap-3 sm:flex-row">
      <input
        id="steamId"
        type="text"
        placeholder="76561198… ou steamcommunity.com/id/pseudo"
        bind:value={steamId}
        onkeydown={(e) => e.key === "Enter" && analyze()}
        class="input flex-1" />
      <button
        class="btn btn-primary"
        disabled={loading || !steamId.trim()}
        onclick={analyze}>
        {loading ? "Analyse…" : "Analyser"}
      </button>
    </div>
    <p class="mt-2 text-xs text-dim">
      Le SteamID64 se trouve via un outil comme <a
        href="https://steamid.io"
        target="_blank"
        rel="noopener noreferrer"
        class="link-accent">steamid.io ↗</a> si ton profil n'a pas d'URL personnalisée.
    </p>
  {:else if step === "review" && preview}
    <p class="mb-1 text-sm text-dim">
      <span class="font-semibold text-fg">{preview.matched.length}</span> jeux
      reconnus sur {preview.totalOwned} possédés.
      {#if preview.unmatched.length > 0}
        <span class="text-dim"
          >{preview.unmatched.length} à associer manuellement.</span>
      {/if}
    </p>

    {#if rows.length === 0}
      <div
        class="mt-6 rounded-xl border border-dashed border-border px-6 py-12 text-center text-dim">
        Aucun de tes jeux Steam n'a pu être associé au catalogue.
      </div>
    {:else}
      <div class="mt-4 mb-3 flex flex-wrap items-center gap-2">
        <button class="chip" onclick={() => selectAll(true)}>
          Tout cocher
        </button>
        <button class="chip" onclick={() => selectAll(false)}>
          Tout décocher
        </button>
        <button
          class="chip inline-flex items-center gap-1"
          class:chip-on={hideOwned}
          onclick={() => (hideOwned = !hideOwned)}>
          Masquer ceux déjà suivis
        </button>
        <span class="ml-auto text-sm text-dim"
          >{selectedCount} sélectionnés</span>
      </div>

      <ul
        class="flex flex-col divide-y divide-border rounded-lg border border-border">
        {#each shown as row (row.key)}
          {@const match = matchOf(row)}
          {@const on = included.has(row.key)}
          {@const steamName =
            row.kind === "matched"
              ? row.game.title
              : (row.game.name ?? "Jeu inconnu")}
          <li class="flex flex-col gap-2 p-3">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                class="h-4 w-4 shrink-0 accent-accent"
                checked={on}
                disabled={!match}
                onchange={() => toggle(row.key)} />
              <div
                class="h-12 w-9 shrink-0 overflow-hidden rounded bg-surface-2">
                {#if match?.coverUrl}
                  <img
                    src={match.coverUrl}
                    alt=""
                    loading="lazy"
                    class="h-full w-full object-cover" />
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold">
                  {match?.title ?? steamName}
                </p>
                <p class="timecode text-xs">
                  {#if match && match.title !== steamName}
                    {steamName} ·
                  {/if}
                  {fmtPlaytime(playtimeOf(row))}
                  {#if row.kind === "matched" && row.game.recentlyPlayed}
                    · <span class="text-accent">joué récemment</span>
                  {/if}
                  {#if row.kind === "matched" && row.game.alreadyInLibrary}
                    · <span class="text-dim">déjà suivi</span>
                  {/if}
                </p>
              </div>
              {#if match}
                <button class="chip text-xs" onclick={() => openSearch(row)}>
                  Changer
                </button>
              {:else}
                <button
                  class="chip text-xs text-danger"
                  onclick={() => openSearch(row)}>
                  Associer…
                </button>
              {/if}
              <select
                class="input h-8 w-auto shrink-0 py-0 text-xs"
                disabled={!on}
                value={statuses.get(row.key) ?? "BACKLOG"}
                onchange={(e) =>
                  statuses.set(row.key, e.currentTarget.value as GameStatus)}>
                {#each STATUS_ORDER as s (s)}
                  <option value={s}>{STATUS_LABELS[s]}</option>
                {/each}
              </select>
            </div>

            {#if searchKey === row.key}
              <div class="rounded-lg border border-border bg-bg p-3">
                <form
                  onsubmit={(e) => {
                    e.preventDefault();
                    void runSearch();
                  }}
                  class="mb-2 flex gap-2">
                  <input
                    class="input flex-1"
                    placeholder="Rechercher le bon jeu…"
                    bind:value={searchQuery} />
                  <button class="btn btn-primary" disabled={searching}>
                    {searching ? "…" : "Chercher"}
                  </button>
                </form>
                {#if searchResults.length > 0}
                  <ul class="flex max-h-56 flex-col gap-1 overflow-y-auto">
                    {#each searchResults as r (r.sourceId)}
                      <li>
                        <button
                          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                          onclick={() => chooseMatch(row.key, r)}>
                          <div
                            class="h-10 w-7 shrink-0 overflow-hidden rounded">
                            <Poster src={r.coverUrl} title={r.title} />
                          </div>
                          <span class="min-w-0 flex-1 truncate">
                            {r.title}
                            {#if r.year}<span class="text-dim">
                                · {r.year}</span
                              >{/if}
                          </span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {:else if !searching}
                  <p class="timecode text-xs">
                    Lance une recherche pour choisir le bon jeu.
                  </p>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>

      <div class="mt-5 flex items-center gap-3">
        <button
          class="btn btn-primary"
          disabled={loading || selectedCount === 0}
          onclick={commit}>
          {loading
            ? "Import…"
            : `Importer ${selectedCount} jeu${selectedCount > 1 ? "x" : ""}`}
        </button>
        <button class="btn btn-ghost" disabled={loading} onclick={reset}>
          Annuler
        </button>
      </div>
    {/if}
  {:else if step === "done"}
    <div class="rounded-xl border border-border bg-surface p-8 text-center">
      <p class="font-display text-2xl font-extrabold">
        {importedCount} jeu{importedCount > 1 ? "x" : ""} importé{importedCount >
        1
          ? "s"
          : ""}
      </p>
      <p class="mt-1 text-sm text-dim">
        Ta bibliothèque et ton temps de jeu sont à jour.
      </p>
      <div class="mt-5 flex justify-center gap-3">
        <a href="/games" class="btn btn-primary">Voir mes jeux</a>
        <button class="btn btn-ghost" onclick={reset}>Nouvel import</button>
      </div>
    </div>
  {/if}
</div>
