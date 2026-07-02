<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    ApiError,
    getTvTimeImportJob,
    logout,
    startTvTimeImport,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { theme } from "$lib/theme.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import type { TvTimeImportJobDto } from "@tracklore/shared";

  // --- Selected archive ---
  let fileName = $state<string | null>(null);
  let fileSize = $state(0);
  let zipBase64 = $state<string | null>(null);
  let fileError = $state<string | null>(null);
  let dragOver = $state(false);

  // --- Options ---
  let importMovies = $state(true);
  let overwrite = $state(false);
  let dryRun = $state(false);

  // --- Run state ---
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let job = $state<TvTimeImportJobDto | null>(null);

  async function signOut() {
    await logout();
    await goto("/login");
  }

  /** Read a File as base64 (no `data:` prefix), handling large files safely. */
  function readBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string; // "data:...;base64,XXXX"
        const comma = result.indexOf(",");
        resolve(comma === -1 ? result : result.slice(comma + 1));
      };
      reader.onerror = () => reject(reader.error ?? new Error("read error"));
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file: File) {
    job = null;
    error = null;
    fileError = null;
    zipBase64 = null;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      fileError = "Sélectionne l’archive .zip de ton export TV Time.";
      return;
    }

    const base64 = await readBase64(file);
    // A real ZIP starts with the local-header signature PK\x03\x04 → base64 "UEsD".
    if (!base64.startsWith("UEsD")) {
      fileError = "Ce fichier ne ressemble pas à une archive .zip valide.";
      return;
    }

    fileName = file.name;
    fileSize = file.size;
    zipBase64 = base64;
  }

  function onInputChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void handleFile(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  }

  async function startImport() {
    if (!auth.user || !zipBase64) return;

    // Overwrite on a real run is destructive: confirm before firing.
    if (overwrite && !dryRun) {
      const ok = confirm(
        "Écraser supprimera définitivement toute ta bibliothèque et ton historique " +
          "de visionnage avant l’import. Cette action est irréversible. Continuer ?",
      );
      if (!ok) return;
    }

    isSubmitting = true;
    error = null;
    job = null;

    try {
      job = await startTvTimeImport({
        zipBase64,
        dryRun,
        importMovies,
        overwrite,
      });
      if (job.status === "running") void pollJob(job.id);
    } catch (err) {
      error =
        err instanceof ApiError
          ? err.message
          : "Impossible de démarrer l’import.";
    } finally {
      isSubmitting = false;
    }
  }

  async function pollJob(jobId: string) {
    try {
      job = await getTvTimeImportJob(jobId);
      if (job.status === "running") {
        window.setTimeout(() => void pollJob(jobId), 1000);
      }
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : "Impossible de récupérer l’état du job.";
    }
  }

  // --- Derived display helpers ---
  const progressTotal = $derived(
    job ? job.progress.totalShows + job.progress.totalMovies : 0,
  );
  const progressDone = $derived(
    job ? job.progress.shows + job.progress.movies : 0,
  );

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  function episodeCode(season: number, episode: number): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `S${pad(season)}E${pad(episode)}`;
  }

  type Ep = { season: number; episode: number };
  function sortEpisodes(episodes: Ep[]): Ep[] {
    return [...episodes].sort(
      (a, b) => a.season - b.season || a.episode - b.episode,
    );
  }

  /** Group the flat unmatched-episode list by show title. */
  function groupUnmatched(
    unmatched: { show: string; season: number; episode: number }[],
  ): { show: string; episodes: Ep[] }[] {
    const byShow = new Map<string, Ep[]>();
    for (const ep of unmatched) {
      const list = byShow.get(ep.show) ?? [];
      list.push({ season: ep.season, episode: ep.episode });
      byShow.set(ep.show, list);
    }
    return [...byShow.entries()].map(([show, episodes]) => ({
      show,
      episodes,
    }));
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
  <h1
    class="mb-6 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
    Réglages
  </h1>

  {#if auth.user}
    <!-- Compte -->
    <section class="card mb-5 p-5 md:p-6">
      <h2 class="mb-4 font-display text-lg font-bold">Compte</h2>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="font-semibold">{auth.user.displayName}</p>
          <p class="timecode text-sm">{auth.user.email}</p>
        </div>
        <button class="btn btn-danger" onclick={signOut}>Se déconnecter</button>
      </div>
    </section>

    <!-- Apparence -->
    <section class="card mb-5 p-5 md:p-6">
      <h2 class="mb-1 font-display text-lg font-bold">Apparence</h2>
      <p class="mb-4 text-sm text-dim">Thème de l’interface.</p>
      <div class="flex gap-2">
        <button
          class="chip inline-flex items-center gap-2"
          class:chip-on={theme.mode === "light"}
          onclick={() => theme.mode !== "light" && theme.toggle()}>
          <Icon name="sun" class="h-4 w-4" /> Clair
        </button>
        <button
          class="chip inline-flex items-center gap-2"
          class:chip-on={theme.mode === "dark"}
          onclick={() => theme.mode !== "dark" && theme.toggle()}>
          <Icon name="moon" class="h-4 w-4" /> Sombre
        </button>
      </div>
    </section>

    <!-- Import TV Time -->
    <section class="card p-5 md:p-6">
      <h2 class="mb-1 font-display text-lg font-bold">Import TV Time</h2>
      <p class="mb-5 text-sm text-dim">
        Dépose l’archive <code
          class="rounded bg-bg px-1.5 py-0.5 font-mono text-xs">.zip</code> de ton
        export GDPR TV Time. Les fichiers nécessaires sont détectés et vérifiés automatiquement.
      </p>

      <!-- Dropzone -->
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
          <span class="timecode text-sm"
            >{formatBytes(fileSize)} · clique pour changer</span>
        {:else}
          <span class="font-semibold">Dépose ton export .zip ici</span>
          <span class="text-sm text-dim">ou clique pour parcourir</span>
        {/if}
      </label>

      {#if fileError}
        <p class="mt-3 text-sm text-danger">{fileError}</p>
      {/if}

      <!-- Options -->
      <div class="my-5 flex flex-col gap-3">
        <label class="flex items-center gap-2.5">
          <input
            type="checkbox"
            bind:checked={importMovies}
            class="accent-[var(--accent)]" />
          Importer les films
        </label>
        <label class="flex items-center gap-2.5">
          <input
            type="checkbox"
            bind:checked={dryRun}
            class="accent-[var(--accent)]" />
          Mode aperçu
          <span class="text-sm text-dim">(analyse sans rien écrire)</span>
        </label>
        <label class="flex items-center gap-2.5 text-danger">
          <input
            type="checkbox"
            bind:checked={overwrite}
            class="accent-[var(--danger)]" />
          Écraser toutes mes données
          <span class="text-sm opacity-80"
            >(sinon l’import s’ajoute à l’existant)</span>
        </label>
      </div>

      {#if overwrite && !dryRun}
        <p
          class="mb-4 rounded-lg border border-danger bg-danger/10 px-3 py-2.5 text-sm text-danger">
          ⚠️ Ta bibliothèque et ton historique seront supprimés avant l’import.
        </p>
      {/if}

      <button
        class="btn btn-primary"
        onclick={startImport}
        disabled={isSubmitting || !zipBase64 || job?.status === "running"}>
        {isSubmitting
          ? "Démarrage…"
          : dryRun
            ? "Analyser l’archive"
            : "Démarrer l’import"}
      </button>

      {#if error}
        <div class="mt-5 rounded-lg border border-danger bg-danger/10 p-4">
          <p class="mb-1 font-semibold">Archive invalide</p>
          <p class="text-sm">{error}</p>
        </div>
      {/if}

      <!-- Progress -->
      {#if job?.status === "running"}
        <div class="mt-5 rounded-lg border border-border bg-bg p-4">
          <p class="mb-2 font-semibold">Import en cours…</p>
          <div class="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              class="h-full bg-accent transition-[width]"
              style={`width: ${progressTotal ? Math.round((progressDone / progressTotal) * 100) : 0}%`}>
            </div>
          </div>
          <p class="timecode mt-2 text-sm">
            {job.progress.shows}/{job.progress.totalShows} séries ·
            {job.progress.movies}/{job.progress.totalMovies} films
          </p>
        </div>
      {/if}

      {#if job?.status === "failed"}
        <div class="mt-5 rounded-lg border border-danger bg-danger/10 p-4">
          <p class="mb-1 font-semibold">Import échoué</p>
          <p class="text-sm">{job.error}</p>
        </div>
      {/if}

      <!-- Report -->
      {#if job?.report}
        {@const r = job.report}
        <div class="mt-6">
          <div class="mb-4 flex items-center gap-3">
            <h3 class="font-display text-lg font-bold">
              {r.dryRun ? "Analyse terminée" : "Import terminé"}
            </h3>
            {#if r.dryRun}
              <span
                class="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim"
                >Aperçu</span>
            {/if}
            {#if r.overwrite && !r.dryRun}
              <span
                class="rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-semibold text-danger">
                Données remplacées
              </span>
            {/if}
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-lg border border-border bg-bg p-4">
              <p class="timecode text-xs uppercase">Séries</p>
              <p class="font-display text-2xl font-bold">
                {r.shows.imported}<span class="text-sm font-normal text-dim">
                  importées</span>
              </p>
              <ul class="mt-1 text-sm">
                <li>{r.shows.watchlist} en watchlist</li>
                <li class:text-dim={r.shows.unresolved.length === 0}>
                  {r.shows.unresolved.length} non résolues
                </li>
              </ul>
            </div>
            <div class="rounded-lg border border-border bg-bg p-4">
              <p class="timecode text-xs uppercase">Épisodes</p>
              <p class="font-display text-2xl font-bold">
                {r.episodes.watched}<span class="text-sm font-normal text-dim">
                  vus</span>
              </p>
              <ul class="mt-1 text-sm">
                <li>{r.episodes.watchesCreated} visionnages créés</li>
                <li class:text-dim={r.episodes.unmatched.length === 0}>
                  {r.episodes.unmatched.length} non appariés
                </li>
              </ul>
            </div>
            <div class="rounded-lg border border-border bg-bg p-4">
              <p class="timecode text-xs uppercase">Films</p>
              <p class="font-display text-2xl font-bold">
                {r.movies.imported}<span class="text-sm font-normal text-dim">
                  importés</span>
              </p>
              <ul class="mt-1 text-sm">
                <li>{r.movies.watchlist} en watchlist</li>
                <li class:text-dim={r.movies.unresolved.length === 0}>
                  {r.movies.unresolved.length} non résolus
                </li>
              </ul>
            </div>
          </div>

          {#if r.shows.unresolved.length || r.episodes.unmatched.length || r.movies.unresolved.length}
            <div class="mt-5 flex flex-col gap-2.5">
              <p class="text-sm text-dim">
                Éléments non concluants — échantillon (100 max). Une étape de
                réconciliation manuelle viendra plus tard.
              </p>

              {#if r.shows.unresolved.length}
                <details
                  class="rounded-lg border border-border bg-bg px-4 py-3">
                  <summary class="cursor-pointer font-semibold">
                    Séries non résolues ({r.shows.unresolved.length})
                  </summary>
                  <div
                    class="mt-3 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                    {#each r.shows.unresolved as show}
                      <details
                        class="rounded-md border border-border bg-surface px-3 py-2">
                        <summary class="cursor-pointer text-sm">
                          {show.title}
                          <span class="text-dim">
                            · TVDB {show.tvdbId} ·
                            {show.episodes.length > 0
                              ? `${show.episodes.length} épisode${show.episodes.length > 1 ? "s" : ""} vu${show.episodes.length > 1 ? "s" : ""}`
                              : "jamais commencée"}
                          </span>
                        </summary>
                        {#if show.episodes.length > 0}
                          <div class="mt-2 flex flex-wrap gap-1.5">
                            {#each sortEpisodes(show.episodes) as ep}
                              <span
                                class="timecode rounded bg-surface-2 px-1.5 py-0.5 text-xs">
                                {episodeCode(ep.season, ep.episode)}
                              </span>
                            {/each}
                          </div>
                        {:else}
                          <p class="mt-2 text-sm text-dim">
                            En watchlist : jamais commencée (aucun épisode vu
                            dans l’export).
                          </p>
                        {/if}
                      </details>
                    {/each}
                  </div>
                </details>
              {/if}

              {#if r.episodes.unmatched.length}
                <details
                  class="rounded-lg border border-border bg-bg px-4 py-3">
                  <summary class="cursor-pointer font-semibold">
                    Épisodes non appariés ({r.episodes.unmatched.length})
                  </summary>
                  <div
                    class="mt-3 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                    {#each groupUnmatched(r.episodes.unmatched) as group}
                      <details
                        class="rounded-md border border-border bg-surface px-3 py-2">
                        <summary class="cursor-pointer text-sm">
                          {group.show}
                          <span class="text-dim">
                            · {group.episodes.length} épisode{group.episodes
                              .length > 1
                              ? "s"
                              : ""}
                          </span>
                        </summary>
                        <div class="mt-2 flex flex-wrap gap-1.5">
                          {#each sortEpisodes(group.episodes) as ep}
                            <span
                              class="timecode rounded bg-surface-2 px-1.5 py-0.5 text-xs">
                              {episodeCode(ep.season, ep.episode)}
                            </span>
                          {/each}
                        </div>
                      </details>
                    {/each}
                  </div>
                </details>
              {/if}

              {#if r.movies.unresolved.length}
                <details
                  class="rounded-lg border border-border bg-bg px-4 py-3">
                  <summary class="cursor-pointer font-semibold">
                    Films non résolus ({r.movies.unresolved.length})
                  </summary>
                  <ul
                    class="mt-3 flex max-h-64 flex-col gap-1.5 overflow-y-auto text-sm">
                    {#each r.movies.unresolved as movie}
                      <li class="flex items-baseline gap-2">
                        <span
                          class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold {movie.watched
                            ? 'bg-success/15 text-success'
                            : 'bg-surface-2 text-dim'}">
                          {movie.watched ? "Déjà vu" : "À voir"}
                        </span>
                        {movie.title}{#if movie.year}<span class="text-dim">
                            · {movie.year}</span
                          >{/if}
                      </li>
                    {/each}
                  </ul>
                </details>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </section>
  {/if}
</div>
