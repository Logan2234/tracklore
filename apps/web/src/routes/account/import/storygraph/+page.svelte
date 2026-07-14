<script lang="ts">
  import {
    ApiError,
    commitStoryGraphImport,
    previewStoryGraphImport,
    searchBooks,
  } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type {
    BookStatus,
    BookSummaryDto,
    StoryGraphImportPreviewDto,
    StoryGraphMatchedBookDto,
    StoryGraphUnmatchedBookDto,
  } from "@tracklore/shared";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";

  const STATUS_LABELS: Record<BookStatus, string> = {
    TO_READ: "À lire",
    READING: "En lecture",
    READ: "Lu",
    DROPPED: "Abandonné",
  };
  const STATUS_ORDER: BookStatus[] = ["TO_READ", "READING", "READ", "DROPPED"];

  type Step = "input" | "review" | "done";
  let step = $state<Step>("input");

  let fileName = $state("");
  let csv = $state("");
  let loading = $state(false);
  let error = $state<string | null>(null);

  let preview = $state<StoryGraphImportPreviewDto | null>(null);
  // One row per matched + unmatched book, keyed synthetically (stable within
  // one preview session) so a manual re-match doesn't disturb selection state.
  type Row =
    | { key: string; kind: "matched"; book: StoryGraphMatchedBookDto }
    | { key: string; kind: "unmatched"; book: StoryGraphUnmatchedBookDto };
  const rows = $derived<Row[]>(
    preview
      ? [
          ...preview.matched.map((book, i): Row => ({
            key: `m${i}`,
            kind: "matched",
            book,
          })),
          ...preview.unmatched.map((book, i): Row => ({
            key: `u${i}`,
            kind: "unmatched",
            book,
          })),
        ]
      : [],
  );

  // Per-row import selection + chosen status (SvelteSet/SvelteMap are reactive,
  // so we mutate them in place rather than reassigning).
  const included = new SvelteSet<string>();
  const statuses = new SvelteMap<string, BookStatus>();
  // Manual catalogue match for a row (new match on a matched row, or the
  // first match on a previously-unmatched one).
  const picked = new SvelteMap<string, BookSummaryDto>();
  let hideOwned = $state(false);
  let importedCount = $state(0);

  // --- Per-row manual search ---
  let searchKey = $state<string | null>(null);
  let searchQuery = $state("");
  let searchResults = $state<BookSummaryDto[]>([]);
  let searching = $state(false);

  const shown = $derived(
    rows.filter(
      (r) => !hideOwned || !(r.kind === "matched" && r.book.alreadyInLibrary),
    ),
  );
  const selectedCount = $derived(included.size);

  function matchOf(row: Row): BookSummaryDto | null {
    const override = picked.get(row.key);
    if (override) return override;
    if (row.kind === "unmatched") return null;
    return {
      source: row.book.source,
      sourceId: row.book.sourceId,
      title: row.book.title,
      authors: row.book.authors,
      year: null,
      coverUrl: row.book.coverUrl,
      // Matched rows are always non-adult: the server filters 18+ titles out
      // of the preview for accounts without adult content enabled.
      isAdult: false,
    };
  }

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    fileName = file.name;
    csv = await file.text();
    error = null;
  }

  async function analyze() {
    if (!csv.trim()) return;
    loading = true;
    error = null;
    try {
      const result = await previewStoryGraphImport({ csv });
      preview = result;
      // Default: import everything already matched and not already tracked,
      // keeping the status the CSV recorded. Unmatched rows start unselected
      // until manually associated.
      included.clear();
      statuses.clear();
      picked.clear();
      result.matched.forEach((b, i) => {
        if (!b.alreadyInLibrary) included.add(`m${i}`);
        statuses.set(`m${i}`, b.status);
      });
      result.unmatched.forEach((b, i) => statuses.set(`u${i}`, b.status));
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
    searchQuery = row.kind === "matched" ? row.book.title : row.book.csvTitle;
    searchResults = [];
  }

  async function runSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }
    searching = true;
    try {
      searchResults = (await searchBooks(searchQuery.trim())).results;
    } catch {
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  function chooseMatch(key: string, book: BookSummaryDto) {
    picked.set(key, book);
    included.add(key);
    searchKey = null;
    searchQuery = "";
    searchResults = [];
  }

  async function commit() {
    if (!preview || selectedCount === 0) return;
    loading = true;
    error = null;
    try {
      const books = rows
        .filter((r) => included.has(r.key))
        .map((r) => {
          const match = matchOf(r);
          if (!match) return null;
          return {
            source: match.source,
            sourceId: match.sourceId,
            status: statuses.get(r.key) ?? r.book.status,
            rating: r.book.rating,
            notes: r.book.notes,
            startedAt: r.book.startedAt,
            finishedAt: r.book.finishedAt,
            ownershipStatus: r.book.ownershipStatus,
            readCount: r.book.readCount,
          };
        })
        .filter((b) => b !== null);
      const result = await commitStoryGraphImport({ books });
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
    csv = "";
    fileName = "";
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
      Import StoryGraph
    </h1>
  </div>

  {#if error}
    <p
      class="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  {/if}

  {#if step === "input"}
    <p class="mb-6 max-w-xl text-sm text-dim">
      <a
        href="https://app.thestorygraph.com/user-export"
        target="_blank"
        rel="noopener noreferrer"
        class="font-semibold text-accent hover:underline"
        >Exporte ta bibliothèque depuis StoryGraph ↗</a>
      (Manage Account → Export StoryGraph Library) puis dépose le fichier
      <code class="text-fg">.csv</code> ici. On associe chaque livre au catalogue
      Google Books ; tu choisis ensuite quoi importer.
    </p>

    <label
      class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center transition-colors hover:border-accent hover:bg-surface-2">
      <Icon name="book" class="h-8 w-8 text-accent" />
      <span class="text-sm font-semibold">
        {fileName || "Choisir le fichier CSV StoryGraph"}
      </span>
      <span class="text-xs text-dim"
        >Format .csv exporté depuis StoryGraph</span>
      <input
        type="file"
        accept=".csv,text/csv"
        class="hidden"
        onchange={onFile} />
    </label>

    <div class="mt-5">
      <button
        class="btn btn-primary"
        disabled={loading || !csv.trim()}
        onclick={analyze}>
        {loading ? "Analyse…" : "Analyser"}
      </button>
    </div>
  {:else if step === "review" && preview}
    <p class="mb-1 text-sm text-dim">
      <span class="font-semibold text-fg">{preview.matched.length}</span> livres
      reconnus sur {preview.totalRows} lignes.
      {#if preview.unmatched.length > 0}
        <span class="text-dim"
          >{preview.unmatched.length} à associer manuellement.</span>
      {/if}
    </p>

    {#if preview.apiErrorCount > 0}
      <p
        class="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {preview.apiErrorCount} livre{preview.apiErrorCount > 1 ? "s" : ""} n'{preview.apiErrorCount >
        1
          ? "ont"
          : "a"} pas pu être vérifié{preview.apiErrorCount > 1 ? "s" : ""} à cause
        d'une erreur de l'API Google Books (quota, panne…), pas d'une vraie absence
        de résultat. Relance l'import plus tard pour les récupérer.
      </p>
    {/if}

    {#if rows.length === 0}
      <div
        class="mt-6 rounded-xl border border-dashed border-border px-6 py-12 text-center text-dim">
        Aucun livre trouvé dans ce fichier.
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
          {@const csvTitle = row.book.csvTitle}
          <li class="flex flex-col gap-2 p-3">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                class="h-4 w-4 shrink-0 accent-accent"
                checked={on}
                disabled={!match}
                onchange={() => toggle(row.key)} />
              <div
                class="h-14 w-9 shrink-0 overflow-hidden rounded bg-surface-2">
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
                  {match?.title ?? csvTitle}
                </p>
                <p class="timecode truncate text-xs">
                  {#if match && match.title !== csvTitle}
                    {csvTitle} ·
                  {/if}
                  {#if row.kind === "matched" && row.book.rating}
                    ★ {row.book.rating}/10
                  {/if}
                  {#if row.kind === "matched" && row.book.alreadyInLibrary}
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
                value={statuses.get(row.key) ?? row.book.status}
                onchange={(e) =>
                  statuses.set(row.key, e.currentTarget.value as BookStatus)}>
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
                    placeholder="Rechercher le bon livre…"
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
                            {#if r.authors.length > 0}<span class="text-dim">
                                · {r.authors[0]}</span
                              >{/if}
                          </span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {:else if !searching}
                  <p class="timecode text-xs">
                    Lance une recherche pour choisir le bon livre.
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
            : `Importer ${selectedCount} livre${selectedCount > 1 ? "s" : ""}`}
        </button>
        <button class="btn btn-ghost" disabled={loading} onclick={reset}>
          Annuler
        </button>
      </div>
    {/if}
  {:else if step === "done"}
    <div class="rounded-xl border border-border bg-surface p-8 text-center">
      <p class="font-display text-2xl font-extrabold">
        {importedCount} livre{importedCount > 1 ? "s" : ""} importé{importedCount >
        1
          ? "s"
          : ""}
      </p>
      <p class="mt-1 text-sm text-dim">
        Ta bibliothèque de lecture est à jour.
      </p>
      <div class="mt-5 flex justify-center gap-3">
        <a href="/books" class="btn btn-primary">Voir mes livres</a>
        <button class="btn btn-ghost" onclick={reset}>Nouvel import</button>
      </div>
    </div>
  {/if}
</div>
