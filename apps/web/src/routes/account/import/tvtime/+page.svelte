<script lang="ts">
  import type {
    ImportCommitOverride,
    ImportMatch,
    ImportPlan,
    ImportPlanMovie,
    ImportPlanShow,
    MediaSummaryDto,
    TvTimeImportJobDto,
  } from "@tracklore/shared";
  import {
    analyzeTvTimeImport,
    commitTvTimeImport,
    getTvTimeImportJob,
    searchCatalog,
    ApiError,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import Icon from "$lib/components/Icon.svelte";

  type Phase = "upload" | "analyzing" | "review" | "committing" | "done";
  type Kind = "show" | "movie";
  type PlanItem = ImportPlanShow | ImportPlanMovie;

  let phase = $state<Phase>("upload");
  let error = $state<string | null>(null);

  // --- Upload ---
  let fileName = $state<string | null>(null);
  let zipBase64 = $state<string | null>(null);
  let fileError = $state<string | null>(null);
  let dragOver = $state(false);
  let importMovies = $state(true);

  // --- Analysis / commit jobs ---
  let planJobId = $state<string | null>(null);
  let job = $state<TvTimeImportJobDto | null>(null);
  let plan = $state<ImportPlan | null>(null);

  // --- Decisions ---
  let include = $state<Set<string>>(new Set());
  // Manual matches chosen for unresolved items (full match kept for display).
  let picked = $state<Record<string, ImportMatch>>({});
  let overwrite = $state(false);

  // --- Per-item manual search ---
  let searchKey = $state<string | null>(null);
  let searchQuery = $state("");
  let searchResults = $state<MediaSummaryDto[]>([]);
  let searching = $state(false);

  const collections = $derived(
    plan
      ? [
          {
            id: "seriesTracked",
            label: "Séries suivies",
            kind: "show" as Kind,
            items: plan.seriesTracked as PlanItem[],
          },
          {
            id: "seriesWatchlist",
            label: "Séries — watchlist",
            kind: "show" as Kind,
            items: plan.seriesWatchlist as PlanItem[],
          },
          {
            id: "moviesWatched",
            label: "Films vus",
            kind: "movie" as Kind,
            items: plan.moviesWatched as PlanItem[],
          },
          {
            id: "moviesWatchlist",
            label: "Films — watchlist",
            kind: "movie" as Kind,
            items: plan.moviesWatchlist as PlanItem[],
          },
        ]
      : [],
  );

  // What will actually be written, given the current decisions.
  const summary = $derived.by(() => {
    let shows = 0;
    let movies = 0;
    let needMatch = 0;
    for (const c of collections) {
      for (const it of c.items) {
        if (!include.has(it.key)) continue;
        const match = picked[it.key] ?? it.match;
        if (!match) {
          needMatch++;
        } else if (c.kind === "show") {
          shows++;
        } else {
          movies++;
        }
      }
    }
    return { shows, movies, needMatch };
  });

  function readBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(",");
        resolve(comma === -1 ? result : result.slice(comma + 1));
      };
      reader.onerror = () => reject(reader.error ?? new Error("read error"));
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file: File) {
    error = null;
    fileError = null;
    zipBase64 = null;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      fileError = "Sélectionne l’archive .zip de ton export TV Time.";
      return;
    }
    const base64 = await readBase64(file);
    // A real ZIP starts with PK\x03\x04 → base64 "UEsD".
    if (!base64.startsWith("UEsD")) {
      fileError = "Ce fichier ne ressemble pas à une archive .zip valide.";
      return;
    }
    fileName = file.name;
    zipBase64 = base64;
  }

  function onInputChange(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) void handleFile(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  }

  async function analyze() {
    if (!zipBase64) return;
    error = null;
    phase = "analyzing";
    try {
      const started = await analyzeTvTimeImport({ zipBase64, importMovies });
      planJobId = started.id;
      job = started;
      pollJob(started.id, "review");
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Analyse impossible.";
      phase = "upload";
    }
  }

  function pollJob(jobId: string, nextPhase: "review" | "done") {
    getTvTimeImportJob(jobId)
      .then((j) => {
        job = j;
        if (j.status === "running") {
          window.setTimeout(() => pollJob(jobId, nextPhase), 1000);
        } else if (j.status === "failed") {
          error = j.error ?? "Le traitement a échoué.";
          phase = nextPhase === "review" ? "upload" : "review";
        } else if (nextPhase === "review" && j.plan) {
          plan = j.plan;
          include = initialInclude(j.plan);
          phase = "review";
        } else {
          phase = "done";
        }
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Suivi du job impossible.";
      });
  }

  /** Pre-select the confidently-resolved items. */
  function initialInclude(p: ImportPlan): Set<string> {
    const keys = new Set<string>();
    for (const list of [
      p.seriesTracked,
      p.seriesWatchlist,
      p.moviesWatched,
      p.moviesWatchlist,
    ]) {
      for (const it of list) if (it.include) keys.add(it.key);
    }
    return keys;
  }

  function toggle(key: string) {
    const next = new Set(include);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    include = next;
  }

  function setAll(items: PlanItem[], on: boolean) {
    const next = new Set(include);
    for (const it of items) {
      // Only auto-include items that have a match (auto or manual).
      if (on) {
        if (picked[it.key] ?? it.match) next.add(it.key);
      } else {
        next.delete(it.key);
      }
    }
    include = next;
  }

  function openSearch(item: PlanItem) {
    searchKey = searchKey === item.key ? null : item.key;
    searchQuery = item.title;
    searchResults = [];
  }

  async function runSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }
    searching = true;
    try {
      searchResults = (await searchCatalog(searchQuery.trim())).results;
    } catch {
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  function chooseMatch(key: string, m: MediaSummaryDto) {
    picked = {
      ...picked,
      [key]: {
        source: m.source,
        sourceId: m.sourceId,
        type: m.type,
        title: m.title,
        year: m.year,
        posterUrl: m.posterUrl,
      },
    };
    include = new Set(include).add(key);
    searchKey = null;
    searchQuery = "";
    searchResults = [];
  }

  async function commit() {
    if (!planJobId) return;
    if (overwrite) {
      const ok = confirm(
        "Écraser supprimera définitivement toute ta bibliothèque et ton " +
          "historique avant l’import. Cette action est irréversible. Continuer ?",
      );
      if (!ok) return;
    }
    error = null;
    phase = "committing";
    const overrides: Record<string, ImportCommitOverride> = {};
    for (const [key, m] of Object.entries(picked)) {
      if (include.has(key)) {
        overrides[key] = {
          source: m.source,
          sourceId: m.sourceId,
          type: m.type,
        };
      }
    }
    try {
      const started = await commitTvTimeImport(planJobId, {
        include: [...include],
        overrides,
        overwrite,
      });
      job = started;
      pollJob(started.id, "done");
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Import impossible.";
      phase = "review";
    }
  }

  function matchOf(item: PlanItem): ImportMatch | null {
    return picked[item.key] ?? item.match;
  }

  function subtitle(item: PlanItem, kind: Kind): string {
    if (kind === "show") {
      const n = (item as ImportPlanShow).episodesWatched;
      return n > 0
        ? `${n} épisode${n > 1 ? "s" : ""} vu${n > 1 ? "s" : ""}`
        : "watchlist";
    }
    const y = (item as ImportPlanMovie).year;
    return y ? String(y) : "";
  }

  const progressPct = $derived.by(() => {
    if (!job) return 0;
    const total = job.progress.totalShows + job.progress.totalMovies;
    const done = job.progress.shows + job.progress.movies;
    return total ? Math.round((done / total) * 100) : 0;
  });
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
      Import TV Time
    </h1>
  </div>

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if phase === "upload"}
    <section class="card p-5 md:p-6">
      <p class="mb-5 text-sm text-dim">
        Dépose l’archive <code
          class="rounded bg-bg px-1.5 py-0.5 font-mono text-xs">.zip</code>
        de ton
        <a
          href="https://gdpr.tvtime.com/gdpr/self-service"
          target="_blank"
          rel="noopener noreferrer"
          class="link-accent">export GDPR TV Time ↗</a
        >. On l’analyse pour te laisser trier collection par collection avant
        d’écrire quoi que ce soit.
      </p>

      <label
        class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors {dragOver ||
        zipBase64
          ? 'border-accent bg-surface-2'
          : 'border-border hover:border-accent hover:bg-surface-2'}"
        ondragover={(e) => {
          e.preventDefault();
          dragOver = true;
        }}
        ondragleave={() => (dragOver = false)}
        ondrop={onDrop}>
        <input type="file" accept=".zip" onchange={onInputChange} hidden />
        {#if zipBase64}
          <span class="font-semibold">📦 {fileName}</span>
          <span class="timecode text-sm">clique pour changer</span>
        {:else}
          <span class="font-semibold">Dépose ton export .zip ici</span>
          <span class="text-sm text-dim">ou clique pour parcourir</span>
        {/if}
      </label>

      {#if fileError}
        <p class="mt-3 text-sm text-danger">{fileError}</p>
      {/if}

      <label class="my-5 flex items-center gap-2.5">
        <input
          type="checkbox"
          bind:checked={importMovies}
          class="accent-[var(--accent)]" />
        Inclure les films
      </label>

      <button class="btn btn-primary" onclick={analyze} disabled={!zipBase64}>
        Analyser l’archive
      </button>
    </section>
  {:else if phase === "analyzing" || phase === "committing"}
    <section class="card p-5 md:p-6">
      <p class="mb-2 font-semibold">
        {phase === "analyzing" ? "Analyse en cours…" : "Import en cours…"}
      </p>
      <div class="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          class="h-full bg-accent transition-[width]"
          style={`width: ${progressPct}%`}>
        </div>
      </div>
      {#if job}
        <p class="timecode mt-2 text-sm">
          {job.progress.shows}/{job.progress.totalShows} séries ·
          {job.progress.movies}/{job.progress.totalMovies} films
        </p>
      {/if}
    </section>
  {:else if phase === "review" && plan}
    <!-- Preview banner -->
    <div
      class="sticky top-2 z-10 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div class="text-sm">
        <span class="font-semibold">{summary.shows}</span> séries ·
        <span class="font-semibold">{summary.movies}</span> films à importer
        {#if summary.needMatch > 0}
          <span class="text-danger"> · {summary.needMatch} à associer</span>
        {/if}
      </div>
      <label class="flex items-center gap-2 text-sm text-danger">
        <input
          type="checkbox"
          bind:checked={overwrite}
          class="accent-[var(--danger)]" />
        Écraser mes données
      </label>
      <button class="btn btn-primary" onclick={commit}>
        Importer ({summary.shows + summary.movies})
      </button>
    </div>

    {#each collections as c (c.id)}
      {#if c.items.length > 0}
        <details class="card mb-3 p-4" open={c.id === "seriesTracked"}>
          <summary
            class="flex cursor-pointer items-center justify-between font-display font-bold">
            <span>{c.label} ({c.items.length})</span>
            <span class="flex gap-2 text-xs font-normal">
              <button
                class="chip"
                onclick={(e) => {
                  e.preventDefault();
                  setAll(c.items, true);
                }}>
                Tout
              </button>
              <button
                class="chip"
                onclick={(e) => {
                  e.preventDefault();
                  setAll(c.items, false);
                }}>
                Rien
              </button>
            </span>
          </summary>

          <ul class="mt-3 flex flex-col divide-y divide-border">
            {#each c.items as item (item.key)}
              {@const match = matchOf(item)}
              <li class="py-2.5">
                <div class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={include.has(item.key)}
                    onchange={() => toggle(item.key)}
                    class="accent-[var(--accent)]" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold">{item.title}</p>
                    <p class="timecode text-xs">{subtitle(item, c.kind)}</p>
                  </div>
                  {#if match}
                    <span
                      class="flex items-center gap-1.5 text-xs text-dim"
                      title={match.title}>
                      <Icon name="check" class="h-3.5 w-3.5 text-success" />
                      <span class="max-w-32 truncate">{match.title}</span>
                    </span>
                    <button
                      class="chip text-xs"
                      onclick={() => openSearch(item)}>
                      Changer
                    </button>
                  {:else}
                    <button
                      class="chip text-xs text-danger"
                      onclick={() => openSearch(item)}>
                      Associer…
                    </button>
                  {/if}
                </div>

                {#if searchKey === item.key}
                  <div class="mt-2 rounded-lg border border-border bg-bg p-3">
                    <form
                      onsubmit={(e) => {
                        e.preventDefault();
                        void runSearch();
                      }}
                      class="mb-2 flex gap-2">
                      <input
                        class="input flex-1"
                        placeholder="Rechercher le bon titre…"
                        bind:value={searchQuery} />
                      <button class="btn btn-primary" disabled={searching}>
                        {searching ? "…" : "Chercher"}
                      </button>
                    </form>
                    {#if searchResults.length > 0}
                      <ul class="flex max-h-56 flex-col gap-1 overflow-y-auto">
                        {#each searchResults as r (`${r.source}:${r.sourceId}`)}
                          <li>
                            <button
                              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                              onclick={() => chooseMatch(item.key, r)}>
                              <div
                                class="h-10 w-7 shrink-0 overflow-hidden rounded">
                                <Poster src={r.posterUrl} title={r.title} />
                              </div>
                              <span class="min-w-0 flex-1 truncate">
                                {r.title}
                                {#if r.year}<span class="text-dim">
                                    · {r.year}</span
                                  >{/if}
                              </span>
                              <span class="timecode text-xs">{r.type}</span>
                            </button>
                          </li>
                        {/each}
                      </ul>
                    {:else if !searching}
                      <p class="timecode text-xs">
                        Lance une recherche pour choisir le bon titre.
                      </p>
                    {/if}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        </details>
      {/if}
    {/each}
  {:else if phase === "done" && job?.report}
    {@const r = job.report}
    <section class="card p-5 md:p-6">
      <div class="mb-4 flex items-center gap-3">
        <Icon name="check" class="h-6 w-6 text-success" />
        <h2 class="font-display text-lg font-bold">Import terminé</h2>
        {#if r.overwrite}
          <span
            class="rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-semibold text-danger">
            Données remplacées
          </span>
        {/if}
      </div>
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-lg border border-border bg-bg p-4">
          <p class="timecode text-xs uppercase">Séries</p>
          <p class="font-display text-2xl font-bold">{r.shows.imported}</p>
          <p class="text-sm text-dim">{r.shows.watchlist} en watchlist</p>
        </div>
        <div class="rounded-lg border border-border bg-bg p-4">
          <p class="timecode text-xs uppercase">Épisodes</p>
          <p class="font-display text-2xl font-bold">
            {r.episodes.watchesCreated}
          </p>
          <p class="text-sm text-dim">visionnages créés</p>
        </div>
        <div class="rounded-lg border border-border bg-bg p-4">
          <p class="timecode text-xs uppercase">Films</p>
          <p class="font-display text-2xl font-bold">{r.movies.imported}</p>
          <p class="text-sm text-dim">{r.movies.watchlist} en watchlist</p>
        </div>
      </div>
      <div class="mt-5 flex gap-2">
        <a href="/media" class="btn btn-primary">Voir ma bibliothèque</a>
        <a
          href="/account/import/tvtime"
          class="btn"
          onclick={() => location.reload()}>
          Nouvel import
        </a>
      </div>
    </section>
  {/if}
</div>
