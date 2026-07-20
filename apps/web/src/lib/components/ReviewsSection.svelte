<script lang="ts">
  import { getMyReview, getReviewsForTarget } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { appConfig } from "$lib/config.svelte";
  import Avatar from "./Avatar.svelte";
  import ReviewFormModal from "./ReviewFormModal.svelte";
  import type { ReviewDto, ReviewTargetType } from "@tracklore/shared";

  // Always-visible review section for a work's detail page: the viewer's own
  // review (add/edit via the shared modal) + everyone else's, visibility-
  // filtered server-side. Anchored at the very bottom of the page.
  let {
    targetType,
    targetId,
    workTitle,
  }: {
    targetType: ReviewTargetType;
    targetId: string;
    workTitle: string;
  } = $props();

  let myReview = $state<ReviewDto | null>(null);
  let myReviewLoaded = $state(false);
  let allReviews = $state<ReviewDto[]>([]);
  let communityLoaded = $state(false);
  let editing = $state(false);

  // `listForTarget` always includes the viewer's own review — keep the
  // community list to everyone else so it isn't shown twice.
  const othersReviews = $derived(
    allReviews.filter((r) => r.author.id !== auth.user?.id),
  );

  $effect(() => {
    const type = targetType;
    const id = targetId;
    myReviewLoaded = false;
    void getMyReview(type, id)
      .then((r) => (myReview = r))
      .finally(() => (myReviewLoaded = true));
  });

  $effect(() => {
    const type = targetType;
    const id = targetId;
    if (!appConfig.socialEnabled) return;
    communityLoaded = false;
    void getReviewsForTarget(type, id)
      .then((r) => (allReviews = r))
      .catch(() => (allReviews = []))
      .finally(() => (communityLoaded = true));
  });

  function handleSaved(updated: ReviewDto) {
    myReview = updated;
  }

  function handleDeleted() {
    myReview = null;
  }
</script>

<section class="mt-6">
  <div class="mb-3 flex items-center justify-between gap-2">
    <h2 class="font-display mb-3 text-xl font-bold">
      {#if appConfig.socialEnabled}
        Critiques de la communauté ({othersReviews.length})
      {:else}
        Ma critique
      {/if}
    </h2>
    {#if myReviewLoaded}
      <button
        class="btn btn-ghost btn-sm shrink-0"
        onclick={() => (editing = true)}>
        {myReview ? "Éditer" : "Ajouter"}
      </button>
    {/if}
  </div>

  {#if myReview}
    <div class="card mb-3 p-3">
      <div class="flex items-center gap-3">
        {#if auth.user}
          <Avatar seed={auth.user.username} size={32} />
        {/if}
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">Votre critique</p>
          {#if appConfig.socialEnabled}
            <p class="timecode text-xs">
              {myReview.visibility === "PUBLIC" ? "Public" : "Amis"}
            </p>
          {/if}
        </div>
        <span
          class="bg-accent/15 text-accent shrink-0 rounded-md px-2.5 py-1 font-mono font-bold tabular-nums">
          {myReview.rating}<span class="text-accent/60 text-xs">/10</span>
        </span>
      </div>
      {#if myReview.text}
        <p class="mt-2 text-sm leading-relaxed">{myReview.text}</p>
      {/if}
    </div>
  {/if}

  {#if appConfig.socialEnabled}
    {#if communityLoaded && othersReviews.length === 0}
      <p class="text-dim text-sm">
        Aucune critique de la communauté pour l'instant.
      </p>
    {:else if othersReviews.length > 0}
      <ul class="flex flex-col gap-2">
        {#each othersReviews as review (review.id)}
          <li class="card p-3">
            <div class="flex items-center gap-3">
              <a href="/u/{review.author.username}" class="shrink-0">
                <Avatar seed={review.author.username} size={32} />
              </a>
              <a href="/u/{review.author.username}" class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold hover:underline">
                  {review.author.displayName}
                </p>
                <p class="timecode truncate text-xs">
                  @{review.author.username}
                </p>
              </a>
              <span
                class="bg-accent/15 text-accent shrink-0 rounded-md px-2.5 py-1 font-mono font-bold tabular-nums">
                {review.rating}<span class="text-accent/60 text-xs">/10</span>
              </span>
            </div>
            {#if review.text}
              <p class="mt-2 text-sm leading-relaxed">{review.text}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

{#if editing}
  <ReviewFormModal
    title={workTitle}
    {targetType}
    {targetId}
    review={myReview}
    defaultVisibility={auth.user?.defaultReviewVisibility ?? "FRIENDS"}
    onClose={() => (editing = false)}
    onSaved={handleSaved}
    onDeleted={handleDeleted} />
{/if}
