<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    ApiError,
    getTvTimeImportJob,
    logout,
    startTvTimeImport,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
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
    return [...byShow.entries()].map(([show, episodes]) => ({ show, episodes }));
  }
</script>

<div class="container">
  <h1>Profil</h1>
  {#if auth.user}
    <p>
      <strong>{auth.user.displayName}</strong><br />
      <span class="meta">{auth.user.email}</span>
    </p>
    <button class="danger" onclick={signOut}>Se déconnecter</button>

    <section class="import-section">
      <div class="section-header">
        <h2>Import TV Time</h2>
        <p>
          Dépose l’archive <code>.zip</code> de ton export GDPR TV Time. Les fichiers
          nécessaires sont détectés et vérifiés automatiquement.
        </p>
      </div>

      <!-- Dropzone -->
      <label
        class="dropzone"
        class:drag={dragOver}
        class:filled={zipBase64}
        ondragover={(e) => {
          e.preventDefault();
          dragOver = true;
        }}
        ondragleave={() => (dragOver = false)}
        ondrop={onDrop}>
        <input type="file" accept=".zip" onchange={onInputChange} hidden />
        {#if zipBase64}
          <span class="dz-title">📦 {fileName}</span>
          <span class="dz-hint"
            >{formatBytes(fileSize)} · clique pour changer</span>
        {:else}
          <span class="dz-title">Dépose ton export .zip ici</span>
          <span class="dz-hint">ou clique pour parcourir</span>
        {/if}
      </label>

      {#if fileError}
        <p class="error">{fileError}</p>
      {/if}

      <!-- Options -->
      <div class="options">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={importMovies} />
          Importer les films
        </label>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={dryRun} />
          Mode aperçu <span class="hint">(analyse sans rien écrire)</span>
        </label>
        <label class="checkbox-label danger-option">
          <input type="checkbox" bind:checked={overwrite} />
          Écraser toutes mes données
          <span class="hint">(sinon l’import s’ajoute à l’existant)</span>
        </label>
      </div>

      {#if overwrite && !dryRun}
        <p class="warn">
          ⚠️ Ta bibliothèque et ton historique seront supprimés avant l’import.
        </p>
      {/if}

      <button
        class="primary"
        onclick={startImport}
        disabled={isSubmitting || !zipBase64 || job?.status === "running"}>
        {isSubmitting
          ? "Démarrage…"
          : dryRun
            ? "Analyser l’archive"
            : "Démarrer l’import"}
      </button>

      {#if error}
        <div class="report-box invalid">
          <p class="rb-title">Archive invalide</p>
          <p>{error}</p>
        </div>
      {/if}

      <!-- Progress -->
      {#if job?.status === "running"}
        <div class="report-box">
          <p class="rb-title">Import en cours…</p>
          <progress max={progressTotal || 1} value={progressDone}></progress>
          <p class="progress-label">
            {job.progress.shows}/{job.progress.totalShows} séries ·
            {job.progress.movies}/{job.progress.totalMovies} films
          </p>
        </div>
      {/if}

      {#if job?.status === "failed"}
        <div class="report-box invalid">
          <p class="rb-title">Import échoué</p>
          <p>{job.error}</p>
        </div>
      {/if}

      <!-- Report -->
      {#if job?.report}
        {@const r = job.report}
        <div class="report">
          <div class="report-head">
            <h3>{r.dryRun ? "Analyse terminée" : "Import terminé"}</h3>
            {#if r.dryRun}<span class="badge">Aperçu</span>{/if}
            {#if r.overwrite && !r.dryRun}<span class="badge danger-badge"
                >Données remplacées</span
              >{/if}
          </div>

          <div class="stat-grid">
            <div class="stat-card">
              <p class="stat-head">Séries</p>
              <p class="stat-main">{r.shows.imported}<span> importées</span></p>
              <ul>
                <li>{r.shows.watchlist} en watchlist</li>
                <li class:muted={r.shows.unresolved.length === 0}>
                  {r.shows.unresolved.length} non résolues
                </li>
              </ul>
            </div>
            <div class="stat-card">
              <p class="stat-head">Épisodes</p>
              <p class="stat-main">{r.episodes.watched}<span> vus</span></p>
              <ul>
                <li>{r.episodes.watchesCreated} visionnages créés</li>
                <li class:muted={r.episodes.unmatched.length === 0}>
                  {r.episodes.unmatched.length} non appariés
                </li>
              </ul>
            </div>
            <div class="stat-card">
              <p class="stat-head">Films</p>
              <p class="stat-main">{r.movies.imported}<span> importés</span></p>
              <ul>
                <li>{r.movies.watchlist} en watchlist</li>
                <li class:muted={r.movies.unresolved.length === 0}>
                  {r.movies.unresolved.length} non résolus
                </li>
              </ul>
            </div>
          </div>

          {#if r.shows.unresolved.length || r.episodes.unmatched.length || r.movies.unresolved.length}
            <div class="unresolved">
              <p class="unresolved-intro">
                Éléments non concluants — échantillon (100 max). Une étape de
                réconciliation manuelle viendra plus tard.
              </p>

              {#if r.shows.unresolved.length}
                <details>
                  <summary
                    >Séries non résolues ({r.shows.unresolved.length})</summary>
                  <div class="item-list">
                    {#each r.shows.unresolved as show}
                      <details class="nested">
                        <summary>
                          {show.title}
                          <span class="hint">
                            · TVDB {show.tvdbId} ·
                            {show.episodes.length > 0
                              ? `${show.episodes.length} épisode${show.episodes.length > 1 ? 's' : ''} vu${show.episodes.length > 1 ? 's' : ''}`
                              : 'jamais commencée'}</span>
                        </summary>
                        {#if show.episodes.length > 0}
                          <p class="ep-chips">
                            {#each sortEpisodes(show.episodes) as ep}
                              <span class="ep-chip"
                                >{episodeCode(ep.season, ep.episode)}</span>
                            {/each}
                          </p>
                        {:else}
                          <p class="hint">
                            En watchlist : jamais commencée (aucun épisode vu dans
                            l’export).
                          </p>
                        {/if}
                      </details>
                    {/each}
                  </div>
                </details>
              {/if}

              {#if r.episodes.unmatched.length}
                <details>
                  <summary
                    >Épisodes non appariés ({r.episodes.unmatched
                      .length})</summary>
                  <div class="item-list">
                    {#each groupUnmatched(r.episodes.unmatched) as group}
                      <details class="nested">
                        <summary>
                          {group.show}
                          <span class="hint">
                            · {group.episodes.length} épisode{group.episodes
                              .length > 1
                              ? 's'
                              : ''}</span>
                        </summary>
                        <p class="ep-chips">
                          {#each sortEpisodes(group.episodes) as ep}
                            <span class="ep-chip"
                              >{episodeCode(ep.season, ep.episode)}</span>
                          {/each}
                        </p>
                      </details>
                    {/each}
                  </div>
                </details>
              {/if}

              {#if r.movies.unresolved.length}
                <details>
                  <summary
                    >Films non résolus ({r.movies.unresolved.length})</summary>
                  <ul class="item-list">
                    {#each r.movies.unresolved as movie}
                      <li>
                        <span class="mv-badge" class:seen={movie.watched}>
                          {movie.watched ? 'Déjà vu' : 'À voir'}
                        </span>
                        {movie.title}{#if movie.year}<span class="hint">
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

<style>
  .import-section {
    margin-top: 2.5rem;
    padding: 1.5rem;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .section-header {
    margin-bottom: 1.25rem;
  }

  .section-header h2 {
    margin: 0 0 0.35rem;
  }

  .section-header p {
    margin: 0;
    color: var(--text-dim);
  }

  code {
    background: var(--bg);
    padding: 0.1rem 0.35rem;
    border-radius: 6px;
    font-size: 0.85em;
  }

  /* Dropzone */
  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 2rem 1rem;
    text-align: center;
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .dropzone:hover,
  .dropzone.drag {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .dropzone.filled {
    border-style: solid;
    border-color: var(--accent);
  }

  .dz-title {
    font-weight: 600;
  }

  .dz-hint {
    font-size: 0.85rem;
    color: var(--text-dim);
  }

  /* Options */
  .options {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin: 1.25rem 0;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--text);
  }

  .checkbox-label .hint,
  .hint {
    color: var(--text-dim);
    font-size: 0.85rem;
  }

  .danger-option {
    color: var(--danger);
  }

  .warn {
    margin: 0 0 1rem;
    padding: 0.7rem 0.9rem;
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    border: 1px solid var(--danger);
    border-radius: var(--radius);
    color: var(--danger);
    font-size: 0.9rem;
  }

  button.primary {
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 0.65rem 1.2rem;
    border-radius: var(--radius);
    font-weight: 600;
    cursor: pointer;
  }

  button.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Progress / status boxes */
  .report-box {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .report-box.invalid {
    border-color: var(--danger);
  }

  .rb-title {
    margin: 0 0 0.6rem;
    font-weight: 600;
  }

  progress {
    width: 100%;
    height: 10px;
    border-radius: 6px;
    overflow: hidden;
    border: none;
    background: var(--bg-hover);
  }

  progress::-webkit-progress-bar {
    background: var(--bg-hover);
    border-radius: 6px;
  }

  progress::-webkit-progress-value {
    background: var(--accent);
    border-radius: 6px;
  }

  progress::-moz-progress-bar {
    background: var(--accent);
    border-radius: 6px;
  }

  .progress-label {
    margin: 0.6rem 0 0;
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  /* Report */
  .report {
    margin-top: 1.5rem;
  }

  .report-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .report-head h3 {
    margin: 0;
  }

  .badge {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: var(--bg-hover);
    color: var(--text-dim);
  }

  .badge.danger-badge {
    background: color-mix(in srgb, var(--danger) 18%, transparent);
    color: var(--danger);
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }

  .stat-card {
    padding: 1rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .stat-head {
    margin: 0 0 0.4rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-dim);
  }

  .stat-main {
    margin: 0 0 0.6rem;
    font-size: 1.8rem;
    font-weight: 700;
  }

  .stat-main span {
    font-size: 0.9rem;
    font-weight: 400;
    color: var(--text-dim);
  }

  .stat-card ul {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.9rem;
    color: var(--text);
  }

  .stat-card li.muted {
    color: var(--text-dim);
  }

  /* Unresolved */
  .unresolved {
    margin-top: 1.5rem;
  }

  .unresolved-intro {
    margin: 0 0 0.8rem;
    font-size: 0.85rem;
    color: var(--text-dim);
  }

  details {
    margin-bottom: 0.6rem;
    padding: 0.6rem 0.9rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  summary {
    cursor: pointer;
    font-weight: 600;
  }

  .item-list {
    margin: 0.7rem 0 0.2rem;
    padding-left: 1.1rem;
    max-height: 260px;
    overflow-y: auto;
    font-size: 0.9rem;
  }

  .item-list li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }

  /* Nested per-show details inside the "unresolved shows" list. */
  details.nested {
    margin-bottom: 0.4rem;
    padding: 0.45rem 0.7rem;
    background: var(--bg-raised);
  }

  details.nested summary {
    font-weight: 400;
  }

  .ep-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0.6rem 0 0.1rem;
  }

  .ep-chip {
    padding: 0.1rem 0.4rem;
    border-radius: 6px;
    background: var(--bg-hover);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  /* Watched vs watchlist badge on unresolved movies. */
  .mv-badge {
    flex: none;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    background: var(--bg-hover);
    color: var(--text-dim);
  }

  .mv-badge.seen {
    background: color-mix(in srgb, var(--success) 18%, transparent);
    color: var(--success);
  }

  @media (max-width: 760px) {
    .stat-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
