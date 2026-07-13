<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    ApiError,
    deleteGameEntry,
    getGameDetail,
    updateGameEntry,
    upsertGameEntry,
  } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type { GameDetailDto, GameStatus } from "@tracklore/shared";

  const STATUS_META: Record<GameStatus, { label: string; cls: string }> = {
    BACKLOG: { label: "À jouer", cls: "bg-surface-2 text-dim" },
    PLAYING: { label: "En cours", cls: "bg-accent text-accent-fg" },
    COMPLETED: { label: "Terminé", cls: "bg-success/15 text-success" },
    DROPPED: { label: "Abandonné", cls: "border border-danger text-danger" },
  };
  const STATUS_ORDER: GameStatus[] = [
    "BACKLOG",
    "PLAYING",
    "COMPLETED",
    "DROPPED",
  ];

  // IGDB is the only game source today; the web route carries just the id.
  const SOURCE = "igdb";

  let detail = $state<GameDetailDto | null>(null);
  let error = $state<string | null>(null);
  let saving = $state(false);

  const id = $derived(page.params.id ?? "");
  const entry = $derived(detail?.entry ?? null);

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

  async function removeEntry() {
    if (
      !detail ||
      !entry ||
      !confirm(`Retirer « ${detail.title} » de ta bibliothèque ?`)
    )
      return;
    await deleteGameEntry(entry.id);
    await goto("/games");
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
      <img
        src={detail.backdropUrl}
        alt=""
        class="h-44 w-full object-cover md:h-60" />
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
  <div class="relative z-10 mx-auto max-w-4xl px-4 pb-6 md:px-8 md:pb-10">
    <div class="-mt-24 flex flex-col gap-5 sm:flex-row sm:items-end md:-mt-28">
      <div
        class="w-32 shrink-0 overflow-hidden rounded-xl border border-border shadow-lg md:w-44">
        <Poster src={detail.coverUrl} title={detail.title} />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim">
            Jeu
          </span>
          {#if entry}
            <span
              class="rounded-full px-2.5 py-0.5 text-xs font-bold {STATUS_META[
                entry.status
              ].cls}">
              {STATUS_META[entry.status].label}
            </span>
          {/if}
          {#if entry?.rating}
            <span
              class="inline-flex items-center gap-1.5 rounded-md bg-accent px-2 py-0.5 font-display text-sm font-bold text-accent-fg">
              <span
                class="font-mono text-[0.5rem] font-bold tracking-widest opacity-75">
                NOTE
              </span>
              {entry.rating}
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

    <!-- Actions -->
    {#if !entry}
      <div class="mt-6">
        <button class="btn btn-primary" disabled={saving} onclick={add}>
          <Icon name="plus" class="h-4 w-4" /> Ajouter à ma bibliothèque
        </button>
      </div>
    {:else}
      <div class="card mt-6 max-w-xl p-4">
        <div class="flex flex-wrap items-center gap-2.5">
          <label class="flex items-center gap-2 text-sm text-dim">
            Statut
            <select
              class="input h-9 w-auto py-0 text-sm"
              value={entry.status}
              onchange={(e) =>
                patch({ status: e.currentTarget.value as GameStatus })}>
              {#each STATUS_ORDER as status (status)}
                <option value={status}>{STATUS_META[status].label}</option>
              {/each}
            </select>
          </label>

          <button
            type="button"
            class="rounded-lg p-2 text-dim transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-50"
            disabled={saving}
            title={entry.favorite
              ? "Retirer des favoris"
              : "Ajouter aux favoris"}
            aria-label={entry.favorite
              ? "Retirer des favoris"
              : "Ajouter aux favoris"}
            aria-pressed={entry.favorite}
            onclick={() => patch({ favorite: !entry.favorite })}>
            <Icon
              name="star"
              class="h-5 w-5 {entry.favorite
                ? 'fill-accent text-accent'
                : ''}" />
          </button>

          <label class="ml-auto flex items-center gap-2 text-sm text-dim">
            Note
            <input
              type="number"
              min="0"
              max="10"
              step="0.5"
              class="input w-20"
              value={entry.rating ?? ""}
              onchange={(e) => {
                const raw = e.currentTarget.value;
                void patch({ rating: raw === "" ? null : Number(raw) });
              }} />
          </label>
        </div>

        <textarea
          placeholder="Notes personnelles…"
          rows="3"
          class="input mt-3"
          value={entry.notes ?? ""}
          onchange={(e) => {
            const raw = e.currentTarget.value;
            void patch({ notes: raw === "" ? null : raw });
          }}></textarea>

        <div class="mt-3 border-t border-border pt-3">
          <button
            class="btn btn-danger"
            disabled={saving}
            onclick={removeEntry}>
            <Icon name="trash" class="h-4 w-4" /> Retirer de ma bibliothèque
          </button>
        </div>
      </div>
    {/if}
  </div>
{:else if !error}
  <div class="mx-auto max-w-4xl px-4 py-6 md:px-8">
    <p class="timecode text-sm">Chargement…</p>
  </div>
{/if}
