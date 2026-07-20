<script lang="ts">
  import { getReviewsForTarget } from "$lib/api/client";
  import { appConfig } from "$lib/config.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import type { ReviewDto, ReviewTargetType } from "@tracklore/shared";

  // Others' reviews for a work, visibility-filtered server-side. Only rendered
  // when social is enabled; hides itself entirely when there are none.
  let {
    targetType,
    targetId,
  }: {
    targetType: ReviewTargetType;
    targetId: string;
  } = $props();

  let reviews = $state<ReviewDto[]>([]);
  let loaded = $state(false);

  $effect(() => {
    const type = targetType;
    const id = targetId;
    if (!appConfig.socialEnabled) return;
    loaded = false;
    void getReviewsForTarget(type, id)
      .then((r) => (reviews = r))
      .catch(() => (reviews = []))
      .finally(() => (loaded = true));
  });
</script>

{#if appConfig.socialEnabled && loaded && reviews.length > 0}
  <section class="mt-6">
    <h2 class="timecode mb-3 text-[0.62rem] tracking-[0.18em] uppercase">
      Critiques de la communauté
    </h2>
    <ul class="flex flex-col gap-2">
      {#each reviews as review (review.id)}
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
  </section>
{/if}
