<script lang="ts">
  import {
    deleteReview,
    getMyReviews,
    getReviewRevisions,
    upsertReview,
  } from "$lib/api/client";
  import { appConfig } from "$lib/config.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RatingPips from "$lib/components/RatingPips.svelte";
  import type {
    MyReviewDto,
    ReviewRevisionDto,
    ReviewVisibility,
  } from "@tracklore/shared";

  const TYPE_LABEL: Record<string, string> = {
    MEDIA: "Vidéo",
    GAME: "Jeux",
    BOOK: "Livres",
    MUSIC: "Musique",
    SEASON: "Saison",
    EPISODE: "Épisode",
  };

  let reviews = $state<MyReviewDto[]>([]);
  let loading = $state(true);

  // Edit modal state.
  let editing = $state<MyReviewDto | null>(null);
  let formRating = $state<number | null>(null);
  let formText = $state("");
  let formVisibility = $state<ReviewVisibility>("FRIENDS");
  let revisions = $state<ReviewRevisionDto[]>([]);
  let busy = $state(false);
  let confirmingDelete = $state(false);

  $effect(() => {
    getMyReviews()
      .then((r) => (reviews = r))
      .finally(() => (loading = false));
  });

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  function openEdit(review: MyReviewDto) {
    editing = review;
    formRating = review.rating;
    formText = review.text ?? "";
    formVisibility = review.visibility;
    revisions = [];
    confirmingDelete = false;
    void getReviewRevisions(review.targetType, review.targetId).then(
      (r) => (revisions = r),
    );
  }

  function closeEdit() {
    editing = null;
  }

  async function save() {
    if (!editing || formRating === null || busy) return;
    busy = true;
    try {
      const updated = await upsertReview(editing.targetType, editing.targetId, {
        rating: formRating,
        text: formText.trim() || null,
        visibility: formVisibility,
      });
      // Merge back into the list, keeping the resolved target.
      reviews = reviews.map((r) =>
        r.id === editing!.id ? { ...r, ...updated, target: r.target } : r,
      );
      closeEdit();
    } finally {
      busy = false;
    }
  }

  async function doDelete() {
    if (!editing || busy) return;
    busy = true;
    try {
      await deleteReview(editing.targetType, editing.targetId);
      reviews = reviews.filter((r) => r.id !== editing!.id);
      closeEdit();
    } finally {
      busy = false;
    }
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:py-8">
  <PageHeader
    icon="star"
    title="Mes reviews"
    subtitle="Toutes vos notes et critiques, à gérer d'un seul endroit." />

  {#if loading}
    <div class="space-y-2">
      {#each Array(4) as _, i (i)}
        <div class="card flex items-center gap-3 p-3">
          <div class="skeleton h-16 w-12 rounded"></div>
          <div class="flex-1 space-y-2">
            <div class="skeleton h-4 w-48 rounded"></div>
            <div class="skeleton h-3 w-24 rounded"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if reviews.length === 0}
    <EmptyState>
      <p class="font-display text-lg font-bold">Aucune review pour l'instant</p>
      <p class="mt-1 text-sm">
        Notez une œuvre depuis sa page pour la retrouver ici.
      </p>
    </EmptyState>
  {:else}
    <ul class="space-y-2">
      {#each reviews as review (review.id)}
        <li class="card flex items-center gap-3 p-3">
          {#if review.target?.imageUrl}
            <img
              src={review.target.imageUrl}
              alt=""
              class="h-16 w-12 shrink-0 rounded object-cover" />
          {:else}
            <div
              class="bg-surface-2 text-dim flex h-16 w-12 shrink-0 items-center justify-center rounded font-mono text-xs">
              {TYPE_LABEL[review.targetType]?.[0] ?? "?"}
            </div>
          {/if}

          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold">
              {review.target?.title ?? "Œuvre"}
            </p>
            <p class="text-dim flex flex-wrap items-center gap-x-2 text-xs">
              <span class="timecode uppercase"
                >{TYPE_LABEL[review.targetType] ?? review.targetType}</span>
              {#if appConfig.socialEnabled}
                <span aria-hidden="true">·</span>
                <span
                  >{review.visibility === "PUBLIC" ? "Public" : "Amis"}</span>
              {/if}
            </p>
            {#if review.text}
              <p class="text-dim mt-1 line-clamp-1 text-sm italic">
                « {review.text} »
              </p>
            {/if}
          </div>

          <!-- Rating in the Séance amber marquee cartouche. -->
          <span
            class="bg-accent/15 text-accent shrink-0 rounded-md px-2.5 py-1 font-mono font-bold tabular-nums">
            {review.rating}<span class="text-accent/60 text-xs">/10</span>
          </span>
          <button
            class="btn btn-ghost shrink-0"
            onclick={() => openEdit(review)}>
            Éditer
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if editing}
  <Modal
    title={editing.target?.title ?? "Modifier la review"}
    onclose={closeEdit}>
    <div class="space-y-4">
      <RatingPips value={formRating} onChange={(v) => (formRating = v)} />

      <div>
        <label
          for="review-text"
          class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
          Critique · optionnel
        </label>
        <textarea
          id="review-text"
          class="input min-h-24 resize-y"
          placeholder="Votre avis…"
          bind:value={formText}></textarea>
      </div>

      {#if appConfig.socialEnabled}
        <div>
          <span
            class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
            Visible par
          </span>
          <div class="flex gap-2">
            <button
              class="chip"
              class:chip-on={formVisibility === "FRIENDS"}
              onclick={() => (formVisibility = "FRIENDS")}>
              Amis
            </button>
            <button
              class="chip"
              class:chip-on={formVisibility === "PUBLIC"}
              onclick={() => (formVisibility = "PUBLIC")}>
              Public
            </button>
          </div>
        </div>
      {/if}

      {#if revisions.length > 1}
        <details class="text-sm">
          <summary class="text-dim cursor-pointer select-none">
            Historique ({revisions.length} versions)
          </summary>
          <ul class="mt-2 space-y-1">
            {#each revisions as rev, i (i)}
              <li class="text-dim flex items-center gap-2 text-xs">
                <span class="timecode text-fg"
                  >V{revisions.length - i} · {rev.rating}/10</span>
                <span>{dateFmt.format(new Date(rev.createdAt))}</span>
              </li>
            {/each}
          </ul>
        </details>
      {/if}

      <div class="flex items-center gap-2 pt-1">
        <button
          class="btn btn-primary flex-1"
          disabled={busy || formRating === null}
          onclick={save}>
          Enregistrer
        </button>
        {#if confirmingDelete}
          <button class="btn btn-danger" disabled={busy} onclick={doDelete}>
            Confirmer
          </button>
        {:else}
          <button
            class="btn btn-ghost"
            disabled={busy}
            onclick={() => (confirmingDelete = true)}>
            Supprimer
          </button>
        {/if}
      </div>
      {#if formRating === null}
        <p class="text-dim text-xs">
          Une review a toujours une note. Choisissez-en une, ou supprimez-la.
        </p>
      {/if}
    </div>
  </Modal>
{/if}
