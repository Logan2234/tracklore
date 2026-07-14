<script lang="ts">
  import { page } from "$app/state";
  import {
    addGameReplay,
    ApiError,
    deleteGameEntry,
    deleteGameReplay,
    getGameDetail,
    updateGameEntry,
    upsertGameEntry,
  } from "$lib/api/client";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Lightbox from "$lib/components/Lightbox.svelte";
  import NoteField from "$lib/components/NoteField.svelte";
  import OwnershipField from "$lib/components/OwnershipField.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import RatingPips from "$lib/components/RatingPips.svelte";
  import {
    GAME_OWNERSHIP_SOURCES,
    GAME_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/ownership-sources";
  import type {
    GameDetailDto,
    GameStatus,
    GameSummaryDto,
  } from "@tracklore/shared";

  const STATUS_META: Record<GameStatus, { label: string; cls: string }> = {
    BACKLOG: { label: "À jouer", cls: "bg-surface-2 text-dim" },
    PLAYING: { label: "En cours", cls: "bg-accent text-accent-fg" },
    COMPLETED: { label: "Terminé", cls: "bg-success/15 text-success" },
    DROPPED: { label: "Abandonné", cls: "border border-danger text-danger" },
  };
  // Surfaced as a tooltip on the status badge / segments.
  const STATUS_DESC: Record<GameStatus, string> = {
    BACKLOG: "Dans ta pile, pas encore commencé.",
    PLAYING: "Tu joues à ce jeu en ce moment.",
    COMPLETED: "Tu as fini ce jeu.",
    DROPPED: "Tu as arrêté et ne comptes pas le reprendre.",
  };
  const STATUS_ORDER: GameStatus[] = [
    "BACKLOG",
    "PLAYING",
    "COMPLETED",
    "DROPPED",
  ];
  // Active-segment styling for the segmented status control (inactive segments
  // are muted; the selected one carries its semantic colour).
  const SEG_ACTIVE: Record<GameStatus, string> = {
    BACKLOG: "bg-surface text-fg shadow-sm",
    PLAYING: "bg-accent text-accent-fg",
    COMPLETED: "bg-success/20 text-success",
    DROPPED: "text-danger shadow-[inset_0_0_0_1px_var(--color-danger)]",
  };

  // IGDB is the only game source today; the web route carries just the id.
  const SOURCE = "igdb";

  // Brand-ish colors per rating source (no official logos — those are
  // trademarked). Literal classes so Tailwind picks them up.
  const RATING_STYLES: Record<string, string> = {
    IGDB: "bg-[#9147ff] text-white",
    Critiques: "bg-[#66cc33] text-black",
  };

  let detail = $state<GameDetailDto | null>(null);
  let error = $state<string | null>(null);
  let saving = $state(false);
  let confirmRemove = $state(false);
  let removing = $state(false);
  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const id = $derived(page.params.id ?? "");
  const entry = $derived(detail?.entry ?? null);
  const hasMeta = $derived(
    !!detail &&
      (detail.developers.length > 0 ||
        detail.publishers.length > 0 ||
        detail.gameModes.length > 0 ||
        detail.playerPerspectives.length > 0),
  );

  // Cover + backdrop + screenshots, deduped, for the lightbox carousel.
  const galleryImages = $derived.by(() => {
    if (!detail) return [];
    const urls: string[] = [];
    if (detail.coverUrl) urls.push(detail.coverUrl);
    if (detail.backdropUrl && !urls.includes(detail.backdropUrl)) {
      urls.push(detail.backdropUrl);
    }
    for (const s of detail.screenshots) if (!urls.includes(s)) urls.push(s);
    return urls.map((src) => ({ src, alt: detail!.title }));
  });

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  function openLightbox(url: string | null) {
    if (!url) return;
    const i = galleryImages.findIndex((img) => img.src === url);
    lightboxIndex = i >= 0 ? i : 0;
    lightboxOpen = true;
  }

  $effect(() => {
    const i = id;
    if (!i) return;
    error = null;
    getGameDetail(SOURCE, i)
      .then((result) => (detail = result))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          error =
            "Ce jeu est réservé aux comptes ayant activé le contenu pour adultes (réglages).";
        } else {
          error =
            err instanceof ApiError ? err.message : "Chargement impossible";
        }
      });
  });

  async function reload() {
    detail = await getGameDetail(SOURCE, id);
  }

  async function add() {
    if (!detail) return;
    saving = true;
    error = null;
    try {
      await upsertGameEntry({
        source: detail.source,
        sourceId: detail.sourceId,
        status: "BACKLOG",
      });
      await reload();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Impossible d'ajouter ce jeu";
    } finally {
      saving = false;
    }
  }

  async function patch(changes: Parameters<typeof updateGameEntry>[1]) {
    if (!entry) return;
    saving = true;
    error = null;
    try {
      await updateGameEntry(entry.id, changes);
      await reload();
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Mise à jour impossible";
    } finally {
      saving = false;
    }
  }

  async function doRemove() {
    if (!entry) return;
    removing = true;
    error = null;
    try {
      await deleteGameEntry(entry.id);
      confirmRemove = false;
      await reload(); // Entry becomes null → the page returns to the "add" state.
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Suppression impossible";
    } finally {
      removing = false;
    }
  }

  async function addReplay() {
    if (!entry) return;
    saving = true;
    error = null;
    try {
      await addGameReplay(entry.id);
      await reload();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Impossible d'enregistrer";
    } finally {
      saving = false;
    }
  }

  async function removeReplay(replayId: string) {
    saving = true;
    error = null;
    try {
      await deleteGameReplay(replayId);
      await reload();
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Impossible de supprimer";
    } finally {
      saving = false;
    }
  }
</script>

{#if error}
  <div class="mx-auto max-w-4xl px-4 py-6 md:px-8">
    <p
      class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
    <a href="/games" class="btn btn-ghost mt-4">← Jeux</a>
  </div>
{/if}

{#if detail}
  <!-- Hero: real artwork, gradient fallback fading into the page. -->
  <div class="relative">
    {#if detail.backdropUrl}
      <button
        type="button"
        class="block w-full cursor-zoom-in"
        aria-label="Agrandir l'image"
        onclick={() => openLightbox(detail?.backdropUrl ?? null)}>
        <img
          src={detail.backdropUrl}
          alt=""
          class="h-44 w-full object-cover md:h-60" />
      </button>
    {:else}
      <div
        class="h-44 w-full bg-linear-to-br from-surface-2 to-surface md:h-60">
      </div>
    {/if}
    <div
      class="absolute inset-0 bg-linear-to-t from-bg via-bg/50 to-transparent">
    </div>
    <a
      href="/games"
      class="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-3 py-1.5 text-sm font-semibold backdrop-blur hover:bg-bg">
      ← Jeux
    </a>
  </div>

  <!-- relative z-10: the positioned hero would otherwise paint over the cover
       pulled up into it. -->
  <div class="relative z-10 mx-auto max-w-5xl px-4 pb-6 md:px-8 md:pb-10">
    <div class="md:grid md:grid-cols-[1fr_260px] md:items-start md:gap-8">
      <div class="min-w-0">
        <div
          class="-mt-24 flex flex-col gap-5 sm:flex-row sm:items-end md:-mt-28">
          <button
            type="button"
            class="w-32 shrink-0 overflow-hidden rounded-xl border border-border shadow-lg md:w-44 {detail.coverUrl
              ? 'cursor-zoom-in'
              : ''}"
            aria-label="Agrandir l'image"
            onclick={() => openLightbox(detail?.coverUrl ?? null)}>
            <Poster src={detail.coverUrl} title={detail.title} />
          </button>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim">
                Jeu
              </span>
              {#if detail.isAdult}
                <span
                  class="rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-bold text-danger">
                  18+
                </span>
              {/if}
              {#if entry}
                <span
                  title={STATUS_DESC[entry.status]}
                  class="rounded-full px-2.5 py-0.5 text-xs font-bold {STATUS_META[
                    entry.status
                  ].cls}">
                  {STATUS_META[entry.status].label}
                </span>
              {/if}
            </div>
            <h1
              class="mt-2 font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
              {detail.title}
            </h1>
            <p class="timecode mt-1.5 text-sm">
              {#if detail.year}{detail.year}{/if}
              {#if detail.genres.length > 0}
                {#if detail.year}·{/if}
                {detail.genres.slice(0, 3).join(", ")}
              {/if}
            </p>
            {#if detail.ratings.length > 0}
              <div class="mt-2.5 flex flex-wrap gap-1.5">
                {#each detail.ratings as r (r.source)}
                  <span
                    class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold {RATING_STYLES[
                      r.source
                    ] ?? 'bg-surface-2 text-fg'}">
                    <span>{r.source}</span>
                    <span class="tabular-nums opacity-90">{r.score}</span>
                  </span>
                {/each}
              </div>
            {/if}
            {#if detail.platforms.length > 0}
              <div class="mt-2.5 flex flex-wrap gap-1.5">
                {#each detail.platforms as platform (platform)}
                  <span
                    class="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-dim">
                    {platform}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        {#if detail.overview}
          <p class="mt-6 max-w-2xl whitespace-pre-line text-dim">
            {detail.overview}
          </p>
        {/if}

        {#if detail.website}
          <a
            href={detail.website}
            target="_blank"
            rel="noopener noreferrer"
            class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            Site officiel ↗
          </a>
        {/if}

        <!-- Actions -->
        {#if !entry}
          <div class="mt-6">
            <button class="btn btn-primary" disabled={saving} onclick={add}>
              <Icon name="plus" class="h-4 w-4" /> Ajouter à ma bibliothèque
            </button>
          </div>
        {:else}
          <div
            class="mt-6 flex max-w-xl flex-col gap-4 rounded-xl border border-border bg-surface p-4">
            <!-- Block header: label + favourite pinned top-right. -->
            <div class="flex items-center justify-between gap-2">
              <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase"
                >Mon suivi</span>
              <button
                type="button"
                aria-pressed={entry.favorite}
                disabled={saving}
                title={entry.favorite
                  ? "Retirer des coups de cœur"
                  : "Coup de cœur"}
                aria-label={entry.favorite
                  ? "Retirer des coups de cœur"
                  : "Coup de cœur"}
                onclick={() => patch({ favorite: !entry.favorite })}
                class="rounded-full p-1.5 transition-colors disabled:opacity-50 {entry.favorite
                  ? 'text-accent'
                  : 'text-dim hover:bg-surface-2 hover:text-fg'}">
                <Icon
                  name="star"
                  class="h-5 w-5 {entry.favorite ? 'fill-accent' : ''}" />
              </button>
            </div>

            <!-- Statut (user-owned) — segmented so every state reads at a glance. -->
            <div
              class="grid grid-cols-4 gap-1 rounded-xl border border-border bg-surface-2 p-1"
              role="group"
              aria-label="Statut">
              {#each STATUS_ORDER as status (status)}
                <button
                  type="button"
                  aria-pressed={entry.status === status}
                  disabled={saving}
                  title={STATUS_DESC[status]}
                  class="rounded-lg py-2 text-xs font-bold transition-colors disabled:opacity-50 {entry.status ===
                  status
                    ? SEG_ACTIVE[status]
                    : 'text-dim hover:text-fg'}"
                  onclick={() => patch({ status })}>
                  {STATUS_META[status].label}
                </button>
              {/each}
            </div>

            <hr class="border-border" />

            <RatingPips
              value={entry.rating}
              onChange={(v) => patch({ rating: v })} />

            <NoteField
              value={entry.notes}
              placeholder="Un boss, une astuce, ta config…"
              onChange={(v) => patch({ notes: v })} />

            <div class="flex items-center justify-between gap-2">
              <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
                Temps de jeu
              </span>
              <div class="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  inputmode="decimal"
                  aria-label="Temps de jeu en heures"
                  class="input w-20 text-right text-sm"
                  disabled={saving}
                  value={Math.round((entry.playtimeMinutes / 60) * 10) / 10}
                  onchange={(e) => {
                    const hours = parseFloat(e.currentTarget.value);
                    if (Number.isFinite(hours) && hours >= 0) {
                      patch({ playtimeMinutes: Math.round(hours * 60) });
                    } else {
                      e.currentTarget.value = String(
                        Math.round((entry.playtimeMinutes / 60) * 10) / 10,
                      );
                    }
                  }} />
                <span class="text-xs text-dim">h</span>
              </div>
            </div>

            <hr class="border-border" />

            <OwnershipField
              status={entry.ownershipStatus}
              source={entry.ownershipSource}
              statusOptions={GAME_OWNERSHIP_STATUS_OPTIONS}
              sourceOptionsByStatus={GAME_OWNERSHIP_SOURCES}
              onChange={(status, source) =>
                patch({
                  ownershipStatus: status as typeof entry.ownershipStatus,
                  ownershipSource: source,
                })} />

            {#if entry.status === "COMPLETED" || entry.replays.length > 0}
              <hr class="border-border" />

              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
                    Relectures{#if entry.replays.length > 0}
                      &nbsp;· {entry.replays.length}{/if}
                  </span>
                  {#if entry.status === "COMPLETED"}
                    <button
                      type="button"
                      class="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                      disabled={saving}
                      onclick={addReplay}>
                      + J'ai refait ce jeu
                    </button>
                  {/if}
                </div>
                {#if entry.replays.length > 0}
                  <ul class="flex flex-col gap-1">
                    {#each entry.replays as replay (replay.id)}
                      <li class="flex items-center gap-2 text-xs text-dim">
                        <span class="flex-1">
                          {dateFmt.format(new Date(replay.finishedAt))}
                        </span>
                        <button
                          type="button"
                          class="hover:text-danger"
                          aria-label="Supprimer cette relecture"
                          disabled={saving}
                          onclick={() => removeReplay(replay.id)}>
                          Supprimer
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}

            <div class="flex justify-end">
              <button
                type="button"
                class="text-sm font-medium text-dim underline-offset-4 transition-colors hover:text-danger hover:underline disabled:opacity-50"
                disabled={saving}
                onclick={() => (confirmRemove = true)}>
                Retirer de ma bibliothèque
              </button>
            </div>
          </div>
        {/if}

        {#snippet gameCard(game: GameSummaryDto)}
          <a
            href={`/games/${game.sourceId}`}
            class="w-28 shrink-0 snap-start sm:w-32">
            <div class="card transition-colors hover:border-accent">
              <Poster src={game.coverUrl} title={game.title} />
            </div>
            <p class="mt-1.5 truncate text-xs font-semibold">{game.title}</p>
          </a>
        {/snippet}

        <!-- Details panel, mobile position: after "Mon suivi", before the carousels. -->
        {#if hasMeta}
          <div class="mt-8 md:hidden">
            {@render detailsPanel()}
          </div>
        {/if}

        {#if detail.franchiseGames.length > 0}
          <section class="mt-10">
            <h2 class="mb-3 font-display text-xl font-bold">Même franchise</h2>
            <div
              class="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pt-2 pb-2 md:mx-0 md:px-0">
              {#each detail.franchiseGames as game (game.sourceId)}
                {@render gameCard(game)}
              {/each}
            </div>
          </section>
        {/if}

        {#if detail.similarGames.length > 0}
          <section class="mt-10">
            <h2 class="mb-3 font-display text-xl font-bold">
              Titres similaires
            </h2>
            <div
              class="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pt-2 pb-2 md:mx-0 md:px-0">
              {#each detail.similarGames as game (game.sourceId)}
                {@render gameCard(game)}
              {/each}
            </div>
          </section>
        {/if}
      </div>

      <!-- Details panel, desktop position: sidebar next to the main column. -->
      {#snippet detailsPanel()}
        <div class="card p-4">
          <h2 class="font-display text-sm font-bold tracking-tight">Détails</h2>
          <dl class="mt-3 flex flex-col gap-3">
            {#if detail && detail.developers.length > 0}
              <div>
                <dt class="timecode text-xs">Développeur</dt>
                <dd class="mt-0.5 text-sm">
                  {detail.developers.join(", ")}
                </dd>
              </div>
            {/if}
            {#if detail && detail.publishers.length > 0}
              <div>
                <dt class="timecode text-xs">Éditeur</dt>
                <dd class="mt-0.5 text-sm">
                  {detail.publishers.join(", ")}
                </dd>
              </div>
            {/if}
            {#if detail && detail.gameModes.length > 0}
              <div>
                <dt class="timecode text-xs">Modes de jeu</dt>
                <dd class="mt-0.5 text-sm">{detail.gameModes.join(", ")}</dd>
              </div>
            {/if}
            {#if detail && detail.playerPerspectives.length > 0}
              <div>
                <dt class="timecode text-xs">Vue</dt>
                <dd class="mt-0.5 text-sm">
                  {detail.playerPerspectives.join(", ")}
                </dd>
              </div>
            {/if}
          </dl>
        </div>
      {/snippet}
      {#if hasMeta}
        <div class="hidden md:block">
          {@render detailsPanel()}
        </div>
      {/if}
    </div>
  </div>

  {#if confirmRemove}
    <ConfirmationModal
      title="Retirer de ma bibliothèque"
      message={`Retirer « ${detail.title} » de ta bibliothèque ? Ta progression et ta note seront supprimées.`}
      confirmLabel="Retirer"
      danger
      busy={removing}
      onConfirm={doRemove}
      onCancel={() => (confirmRemove = false)} />
  {/if}

  {#if lightboxOpen}
    <Lightbox
      images={galleryImages}
      bind:index={lightboxIndex}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <div class="mx-auto max-w-4xl px-4 py-6 md:px-8">
    <p class="timecode text-sm">Chargement…</p>
  </div>
{/if}
