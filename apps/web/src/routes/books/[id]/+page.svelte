<script lang="ts">
  import { page } from "$app/state";
  import {
    addBookReplay,
    ApiError,
    deleteBookEntry,
    deleteBookReplay,
    getBookDetail,
    updateBookEntry,
    upsertBookEntry,
  } from "$lib/api/client";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Lightbox from "$lib/components/Lightbox.svelte";
  import NoteField from "$lib/components/NoteField.svelte";
  import OwnershipField from "$lib/components/OwnershipField.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import RatingPips from "$lib/components/RatingPips.svelte";
  import {
    BOOK_OWNERSHIP_SOURCES,
    BOOK_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/ownership-sources";
  import type { BookDetailDto, BookStatus } from "@tracklore/shared";

  const STATUS_META: Record<BookStatus, { label: string; cls: string }> = {
    TO_READ: { label: "À lire", cls: "bg-surface-2 text-dim" },
    READING: { label: "En lecture", cls: "bg-accent text-accent-fg" },
    READ: { label: "Lu", cls: "bg-success/15 text-success" },
    DROPPED: { label: "Abandonné", cls: "border border-danger text-danger" },
  };
  // Surfaced as a tooltip on the status badge / segments.
  const STATUS_DESC: Record<BookStatus, string> = {
    TO_READ: "Dans ta pile, pas encore commencé.",
    READING: "Tu lis ce livre en ce moment.",
    READ: "Tu as terminé ce livre.",
    DROPPED: "Tu as arrêté et ne comptes pas le reprendre.",
  };
  const STATUS_ORDER: BookStatus[] = ["TO_READ", "READING", "READ", "DROPPED"];
  // Active-segment styling for the segmented status control.
  const SEG_ACTIVE: Record<BookStatus, string> = {
    TO_READ: "bg-surface text-fg shadow-sm",
    READING: "bg-accent text-accent-fg",
    READ: "bg-success/20 text-success",
    DROPPED: "text-danger shadow-[inset_0_0_0_1px_var(--color-danger)]",
  };

  // Google Books is the only book source today; the web route carries just the id.
  const SOURCE = "google_books";

  // Brand-ish color for the rating source (no official logo — trademarked).
  const RATING_STYLES: Record<string, string> = {
    "Google Books": "bg-[#4285f4] text-white",
  };

  let detail = $state<BookDetailDto | null>(null);
  let error = $state<string | null>(null);
  let saving = $state(false);
  let confirmRemove = $state(false);
  let removing = $state(false);
  let lightboxOpen = $state(false);
  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const id = $derived(page.params.id ?? "");
  const entry = $derived(detail?.entry ?? null);
  const hasMeta = $derived(
    !!detail && (!!detail.publisher || !!detail.pageCount),
  );

  // Reading progress as a percentage of the known page count (0 when unknown).
  const progressPct = $derived(
    entry && detail?.pageCount
      ? Math.min(100, Math.round((entry.currentPage / detail.pageCount) * 100))
      : 0,
  );

  $effect(() => {
    const i = id;
    if (!i) return;
    error = null;
    getBookDetail(SOURCE, i)
      .then((result) => (detail = result))
      .catch((err) => {
        error = err instanceof ApiError ? err.message : "Chargement impossible";
      });
  });

  async function reload() {
    detail = await getBookDetail(SOURCE, id);
  }

  async function add() {
    if (!detail) return;
    saving = true;
    error = null;
    try {
      await upsertBookEntry({
        source: detail.source,
        sourceId: detail.sourceId,
        status: "TO_READ",
      });
      await reload();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Impossible d'ajouter ce livre";
    } finally {
      saving = false;
    }
  }

  async function patch(changes: Parameters<typeof updateBookEntry>[1]) {
    if (!entry) return;
    saving = true;
    error = null;
    try {
      await updateBookEntry(entry.id, changes);
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
      await deleteBookEntry(entry.id);
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
      await addBookReplay(entry.id);
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
      await deleteBookReplay(replayId);
      await reload();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Impossible de supprimer";
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
    <a href="/books" class="btn btn-ghost mt-4">← Livres</a>
  </div>
{/if}

{#if detail}
  <!-- Hero: books have no wide artwork, so a gradient fades into the page. -->
  <div class="relative">
    <div class="h-44 w-full bg-linear-to-br from-surface-2 to-surface md:h-60">
    </div>
    <div
      class="absolute inset-0 bg-linear-to-t from-bg via-bg/50 to-transparent">
    </div>
    <a
      href="/books"
      class="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-3 py-1.5 text-sm font-semibold backdrop-blur hover:bg-bg">
      ← Livres
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
            onclick={() => detail?.coverUrl && (lightboxOpen = true)}>
            <Poster src={detail.coverUrl} title={detail.title} />
          </button>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim">
                Livre
              </span>
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
            {#if detail.subtitle}
              <p class="mt-0.5 text-lg text-dim">{detail.subtitle}</p>
            {/if}
            {#if detail.authors.length > 0}
              <p class="mt-1.5 font-display text-lg font-semibold text-dim">
                {detail.authors.join(", ")}
              </p>
            {/if}
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
            Voir sur Google Books ↗
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

            <!-- Reading progress: page position, with a bar when the total is known. -->
            <div class="flex flex-col gap-2">
              <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase"
                >Progression de lecture</span>
              <div class="flex items-center gap-2 text-sm text-dim">
                <span>Page</span>
                <input
                  type="number"
                  min="0"
                  max={detail.pageCount ?? undefined}
                  class="input w-24"
                  value={entry.currentPage || ""}
                  onchange={(e) => {
                    const raw = e.currentTarget.value;
                    void patch({ currentPage: raw === "" ? 0 : Number(raw) });
                  }} />
                {#if detail.pageCount}
                  <span class="timecode">/ {detail.pageCount}</span>
                  <span class="ml-auto font-display font-bold text-fg">
                    {progressPct} %
                  </span>
                {/if}
              </div>
              {#if detail.pageCount}
                <div class="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    class="h-full rounded-full bg-accent transition-[width]"
                    style={`width:${progressPct}%`}>
                  </div>
                </div>
              {/if}
            </div>

            <hr class="border-border" />

            <RatingPips
              value={entry.rating}
              onChange={(v) => patch({ rating: v })} />

            <NoteField
              value={entry.notes}
              placeholder="Une phrase, une note de lecture…"
              onChange={(v) => patch({ notes: v })} />

            <hr class="border-border" />

            <OwnershipField
              status={entry.ownershipStatus}
              source={entry.ownershipSource}
              statusOptions={BOOK_OWNERSHIP_STATUS_OPTIONS}
              sourceOptionsByStatus={BOOK_OWNERSHIP_SOURCES}
              onChange={(status, source) =>
                patch({
                  ownershipStatus: status as typeof entry.ownershipStatus,
                  ownershipSource: source,
                })} />

            {#if entry.status === "READ" || entry.replays.length > 0}
              <hr class="border-border" />

              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
                    Relectures{#if entry.replays.length > 0}
                      &nbsp;· {entry.replays.length}{/if}
                  </span>
                  {#if entry.status === "READ"}
                    <button
                      type="button"
                      class="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                      disabled={saving}
                      onclick={addReplay}>
                      + J'ai relu ce livre
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

        {#if detail.sameAuthorBooks.length > 0}
          <section class="mt-10">
            <h2 class="mb-3 font-display text-xl font-bold">
              Du même auteur
            </h2>
            <div
              class="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pt-2 pb-2 md:mx-0 md:px-0">
              {#each detail.sameAuthorBooks as book (book.sourceId)}
                <a
                  href={`/books/${book.sourceId}`}
                  class="w-28 shrink-0 snap-start sm:w-32">
                  <div class="card transition-colors hover:border-accent">
                    <Poster src={book.coverUrl} title={book.title} />
                  </div>
                  <p class="mt-1.5 truncate text-xs font-semibold">
                    {book.title}
                  </p>
                </a>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Details panel, mobile position: after "Mon suivi". -->
        {#if hasMeta}
          <div class="mt-8 md:hidden">
            {@render detailsPanel()}
          </div>
        {/if}
      </div>

      <!-- Details panel, desktop position: sidebar next to the main column. -->
      {#snippet detailsPanel()}
        <div class="card p-4">
          <h2 class="font-display text-sm font-bold tracking-tight">
            Détails
          </h2>
          <dl class="mt-3 flex flex-col gap-3">
            {#if detail?.publisher}
              <div>
                <dt class="timecode text-xs">Éditeur</dt>
                <dd class="mt-0.5 text-sm">{detail.publisher}</dd>
              </div>
            {/if}
            {#if detail?.pageCount}
              <div>
                <dt class="timecode text-xs">Pages</dt>
                <dd class="mt-0.5 text-sm">{detail.pageCount}</dd>
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

  {#if lightboxOpen && detail.coverUrl}
    <Lightbox
      images={[{ src: detail.coverUrl, alt: detail.title }]}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <div class="mx-auto max-w-4xl px-4 py-6 md:px-8">
    <p class="timecode text-sm">Chargement…</p>
  </div>
{/if}
