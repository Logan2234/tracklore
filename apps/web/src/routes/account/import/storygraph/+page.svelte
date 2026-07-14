<script lang="ts">
  import {
    ApiError,
    commitStoryGraphImport,
    previewStoryGraphImport,
  } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import type {
    BookStatus,
    StoryGraphImportPreviewDto,
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
  // Per-book import selection + chosen status (SvelteSet/SvelteMap are reactive,
  // so we mutate them in place rather than reassigning).
  const included = new SvelteSet<string>();
  const statuses = new SvelteMap<string, BookStatus>();
  let hideOwned = $state(false);
  let importedCount = $state(0);

  const shown = $derived(
    preview
      ? preview.matched.filter((b) => !hideOwned || !b.alreadyInLibrary)
      : [],
  );
  const selectedCount = $derived(included.size);

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
      // Default: import everything not already tracked, keeping the status the
      // CSV recorded.
      included.clear();
      statuses.clear();
      for (const b of result.matched) {
        if (!b.alreadyInLibrary) included.add(b.sourceId);
        statuses.set(b.sourceId, b.status);
      }
      step = "review";
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Analyse impossible";
    } finally {
      loading = false;
    }
  }

  function toggle(id: string) {
    if (included.has(id)) included.delete(id);
    else included.add(id);
  }

  function selectAll(on: boolean) {
    included.clear();
    if (on) for (const b of shown) included.add(b.sourceId);
  }

  async function commit() {
    if (!preview || selectedCount === 0) return;
    loading = true;
    error = null;
    try {
      const books = preview.matched
        .filter((b) => included.has(b.sourceId))
        .map((b) => ({
          source: b.source,
          sourceId: b.sourceId,
          status: statuses.get(b.sourceId) ?? b.status,
          rating: b.rating,
          notes: b.notes,
          startedAt: b.startedAt,
          finishedAt: b.finishedAt,
          ownershipStatus: b.ownershipStatus,
          readCount: b.readCount,
        }));
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
          >{preview.unmatched.length} introuvables dans le catalogue.</span>
      {/if}
    </p>

    {#if preview.matched.length === 0}
      <div
        class="mt-6 rounded-xl border border-dashed border-border px-6 py-12 text-center text-dim">
        Aucun de tes livres StoryGraph n'a pu être associé au catalogue.
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
        {#each shown as book (book.sourceId)}
          {@const on = included.has(book.sourceId)}
          <li class="flex items-center gap-3 p-3">
            <input
              type="checkbox"
              class="h-4 w-4 shrink-0 accent-accent"
              checked={on}
              onchange={() => toggle(book.sourceId)} />
            <div class="h-14 w-9 shrink-0 overflow-hidden rounded bg-surface-2">
              {#if book.coverUrl}
                <img
                  src={book.coverUrl}
                  alt=""
                  loading="lazy"
                  class="h-full w-full object-cover" />
              {/if}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">{book.title}</p>
              <p class="timecode truncate text-xs">
                {#if book.authors.length > 0}{book.authors[0]}{/if}
                {#if book.rating}
                  · ★ {book.rating}/10
                {/if}
                {#if book.alreadyInLibrary}
                  · <span class="text-dim">déjà suivi</span>
                {/if}
              </p>
            </div>
            <select
              class="input h-8 w-auto shrink-0 py-0 text-xs"
              disabled={!on}
              value={statuses.get(book.sourceId) ?? book.status}
              onchange={(e) =>
                statuses.set(
                  book.sourceId,
                  e.currentTarget.value as BookStatus,
                )}>
              {#each STATUS_ORDER as s (s)}
                <option value={s}>{STATUS_LABELS[s]}</option>
              {/each}
            </select>
          </li>
        {/each}
      </ul>

      {#if preview.unmatched.length > 0}
        <details class="mt-4 rounded-lg border border-border bg-surface p-3">
          <summary class="cursor-pointer text-sm font-semibold text-dim">
            {preview.unmatched.length} livres non associés
          </summary>
          <ul class="mt-2 flex flex-col gap-1 text-sm text-dim">
            {#each preview.unmatched as title (title)}
              <li class="truncate">{title}</li>
            {/each}
          </ul>
        </details>
      {/if}

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
