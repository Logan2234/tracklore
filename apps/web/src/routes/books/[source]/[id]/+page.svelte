<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    ApiError,
    deleteBookEntry,
    getBookDetail,
    updateBookEntry,
    upsertBookEntry,
  } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type { BookDetailDto, BookStatus } from "@tracklore/shared";

  const STATUS_META: Record<BookStatus, { label: string; cls: string }> = {
    TO_READ: { label: "À lire", cls: "bg-surface-2 text-dim" },
    READING: { label: "En lecture", cls: "bg-accent text-accent-fg" },
    READ: { label: "Lu", cls: "bg-success/15 text-success" },
    DROPPED: { label: "Abandonné", cls: "border border-danger text-danger" },
  };
  const STATUS_ORDER: BookStatus[] = ["TO_READ", "READING", "READ", "DROPPED"];

  let detail = $state<BookDetailDto | null>(null);
  let error = $state<string | null>(null);
  let saving = $state(false);

  // A book can come from either catalogue (Google Books / Open Library), so the
  // route carries the source alongside the id.
  const source = $derived(page.params.source ?? "");
  const id = $derived(page.params.id ?? "");
  const entry = $derived(detail?.entry ?? null);

  // Reading progress as a percentage of the known page count (0 when unknown).
  const progressPct = $derived(
    entry && detail?.pageCount
      ? Math.min(100, Math.round((entry.currentPage / detail.pageCount) * 100))
      : 0,
  );

  $effect(() => {
    const i = id;
    const s = source;
    if (!i || !s) return;
    error = null;
    getBookDetail(s, i)
      .then((result) => (detail = result))
      .catch((err) => {
        error = err instanceof ApiError ? err.message : "Chargement impossible";
      });
  });

  async function reload() {
    detail = await getBookDetail(source, id);
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

  async function removeEntry() {
    if (
      !detail ||
      !entry ||
      !confirm(`Retirer « ${detail.title} » de ta bibliothèque ?`)
    )
      return;
    await deleteBookEntry(entry.id);
    await goto("/books");
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
            Livre
          </span>
          {#if entry}
            <span
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
        {#if detail.authors.length > 0}
          <p class="mt-1.5 font-display text-lg font-semibold text-dim">
            {detail.authors.join(", ")}
            {#if detail.authorWikidataId}
              <a
                href={`https://www.wikidata.org/wiki/${detail.authorWikidataId}`}
                target="_blank"
                rel="noopener noreferrer"
                class="align-middle text-xs font-semibold text-accent hover:underline"
                >Wikidata ↗</a>
            {/if}
          </p>
        {/if}
        <p class="timecode mt-1.5 text-sm">
          {#if detail.year}{detail.year}{/if}
          {#if detail.pageCount}
            {#if detail.year}·{/if}
            {detail.pageCount} pages
          {/if}
          {#if detail.genres.length > 0}
            {#if detail.year || detail.pageCount}·{/if}
            {detail.genres.slice(0, 3).join(", ")}
          {/if}
        </p>
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
                patch({ status: e.currentTarget.value as BookStatus })}>
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

        <!-- Reading progress: page position, with a bar when the total is known. -->
        <div class="mt-4 border-t border-border pt-3">
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
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                class="h-full rounded-full bg-accent transition-[width]"
                style={`width:${progressPct}%`}>
              </div>
            </div>
          {/if}
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
