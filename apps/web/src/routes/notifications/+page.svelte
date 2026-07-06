<script lang="ts">
  import { onMount } from "svelte";
  import { notifications } from "$lib/notifications.svelte";
  import Icon from "$lib/components/Icon.svelte";

  let loading = $state(true);

  onMount(async () => {
    await notifications.refresh(true); // scan for new episodes, then list
    loading = false;
    await notifications.markAllRead(); // opening the feed clears the badge
  });

  const relFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
  });
  const epCode = (s: number, e: number) =>
    `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}`;
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
  <h1 class="mb-6 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
    Notifications
  </h1>

  {#if loading}
    <p class="timecode text-sm">Chargement…</p>
  {:else if notifications.items.length === 0}
    <div
      class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim">
      Rien de neuf. Les nouveaux épisodes de tes séries suivies apparaîtront ici.
    </div>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each notifications.items as n (n.id)}
        <a
          href={`/media/${n.mediaType.toLowerCase()}/${n.sourceId}`}
          class="card flex items-center gap-3 p-3 transition-[border-color] hover:border-accent {n.read
            ? ''
            : 'border-accent/50'}">
          <span
            class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent">
            <Icon name="bell" class="h-5 w-5" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm">
              <span class="font-semibold">{n.mediaTitle}</span>
              <span class="text-dim">
                · nouvel épisode {epCode(n.seasonNumber, n.episodeNumber)}</span>
            </p>
            {#if n.episodeTitle}
              <p class="truncate text-xs text-dim">{n.episodeTitle}</p>
            {/if}
          </div>
          <span class="timecode shrink-0 text-xs">
            {relFmt.format(new Date(n.createdAt))}
          </span>
          {#if !n.read}
            <span class="h-2 w-2 shrink-0 rounded-full bg-accent"></span>
          {/if}
        </a>
      {/each}
    </ul>
  {/if}
</div>
