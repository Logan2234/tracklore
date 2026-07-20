<script lang="ts">
  import { getMyReview, upsertReview } from "$lib/api/client";
  import { appConfig } from "$lib/config.svelte";
  import type { ReviewTargetType, ReviewVisibility } from "@tracklore/shared";

  // The critique half of a review: optional text + audience. The /10 rating
  // itself is owned by the sibling RatingPips (quick-rating), passed in here as
  // `rating` — a review can't exist without one, so text/audience edits are
  // disabled until the work is rated. Persisted through the same Review as the
  // rating, so the two stay a single review.
  let {
    targetType,
    targetId,
    rating,
  }: {
    targetType: ReviewTargetType;
    targetId: string;
    /** Current /10 rating (from the entry), reactive. Null = not rated yet. */
    rating: number | null;
  } = $props();

  let text = $state("");
  let visibility = $state<ReviewVisibility>("FRIENDS");
  let loaded = $state(false);
  let saving = $state(false);

  $effect(() => {
    // Load the existing review's text + audience whenever the target changes.
    const type = targetType;
    const id = targetId;
    loaded = false;
    void getMyReview(type, id)
      .then((r) => {
        text = r?.text ?? "";
        visibility = r?.visibility ?? "FRIENDS";
      })
      .finally(() => (loaded = true));
  });

  // A rating cleared elsewhere (the pips) deletes the review server-side; drop
  // our now-orphaned draft so the field reflects reality.
  $effect(() => {
    if (rating === null) text = "";
  });

  async function persist() {
    if (rating === null || saving) return;
    saving = true;
    try {
      await upsertReview(targetType, targetId, {
        rating,
        text: text.trim() || null,
        visibility,
      });
    } finally {
      saving = false;
    }
  }

  function pickVisibility(v: ReviewVisibility) {
    if (visibility === v) return;
    visibility = v;
    void persist();
  }
</script>

<div class="flex flex-col gap-2">
  <label
    for="review-critique"
    class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
    Ma critique · optionnel
  </label>
  <textarea
    id="review-critique"
    class="input min-h-20 resize-y text-sm"
    placeholder={rating === null
      ? "Ajoutez une note pour écrire une critique…"
      : "Votre avis sur cette œuvre…"}
    disabled={rating === null || !loaded}
    bind:value={text}
    onblur={persist}></textarea>

  {#if appConfig.socialEnabled}
    <div class="flex items-center gap-2">
      <span class="text-dim text-xs">Visible par&nbsp;:</span>
      <button
        type="button"
        class="chip"
        class:chip-on={visibility === "FRIENDS"}
        disabled={rating === null}
        onclick={() => pickVisibility("FRIENDS")}>
        Amis
      </button>
      <button
        type="button"
        class="chip"
        class:chip-on={visibility === "PUBLIC"}
        disabled={rating === null}
        onclick={() => pickVisibility("PUBLIC")}>
        Public
      </button>
    </div>
  {/if}
</div>
