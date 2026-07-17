<script lang="ts">
  import { listLibrary } from "$lib/api/client";
  import Combobox from "$lib/components/Combobox.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import type {
    EntryStatus,
    LibraryEntryDto,
    MediaType,
  } from "@tracklore/shared";
  import { isDormant } from "@tracklore/shared";

  // "DORMANT" is not a real status: it's a client-side refinement over WATCHING
  // (nothing watched for a while).
  type StatusTab = EntryStatus | "DORMANT";
  const STATUS_OPTIONS: { label: string; value: StatusTab }[] = [
    { label: "En cours", value: "WATCHING" },
    { label: "À voir", value: "PLANNED" },
    { label: "Terminé", value: "COMPLETED" },
    { label: "En pause", value: "DORMANT" },
    { label: "Abandonné", value: "DROPPED" },
  ];

  const TYPE_OPTIONS: { label: string; value: MediaType }[] = [
    { label: "Films", value: "MOVIE" },
    { label: "Séries", value: "SERIES" },
    { label: "Animés", value: "ANIME" },
  ];

  const TYPE_LABELS: Record<MediaType, string> = {
    MOVIE: "Film",
    SERIES: "Série",
    ANIME: "Animé",
  };

  // Order used by the "Statut" sort.
  const STATUS_SORT_ORDER: EntryStatus[] = [
    "WATCHING",
    "PLANNED",
    "UP_TO_DATE",
    "COMPLETED",
    "DROPPED",
  ];

  type SortKey =
    | "recent"
    | "added"
    | "title"
    | "rating"
    | "progress"
    | "finished"
    | "started"
    | "status";
  const SORTS: { label: string; value: SortKey }[] = [
    { label: "Vu récemment", value: "recent" },
    { label: "Ajout récent", value: "added" },
    { label: "Titre", value: "title" },
    { label: "Note", value: "rating" },
    { label: "Progression", value: "progress" },
    { label: "Terminé récemment", value: "finished" },
    { label: "Commencé récemment", value: "started" },
    { label: "Statut", value: "status" },
  ];

  // Extra "type" filter, owned by the page and passed to LibraryBrowser.
  let types = $state<MediaType[]>([]);

  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

  function pct(entry: LibraryEntryDto): number {
    if (!entry.progress || entry.progress.totalEpisodes === 0) return 0;
    return Math.round(
      (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
    );
  }

  // Base comparator per criterion (its natural order); the direction toggle
  // reverses the whole list.
  function compare(sort: string, a: LibraryEntryDto, b: LibraryEntryDto): number {
    switch (sort as SortKey) {
      case "title":
        return a.mediaItem.title.localeCompare(b.mediaItem.title, "fr");
      case "rating":
        return (b.rating ?? -1) - (a.rating ?? -1);
      case "progress":
        return pct(b) - pct(a);
      case "finished":
        return time(b.finishedAt) - time(a.finishedAt);
      case "started":
        return time(b.startedAt) - time(a.startedAt);
      case "status":
        return (
          STATUS_SORT_ORDER.indexOf(a.status) -
          STATUS_SORT_ORDER.indexOf(b.status)
        );
      case "added":
        return b.createdAt.localeCompare(a.createdAt);
      case "recent":
        return time(b.lastWatchedAt) - time(a.lastWatchedAt);
    }
    return 0;
  }

  function statusMatch(entry: LibraryEntryDto, statuses: string[]): boolean {
    return statuses.some((s) =>
      s === "DORMANT" ? isDormant(entry) : entry.status === s,
    );
  }
</script>

<LibraryBrowser
  icon="library"
  title="Écrans"
  subtitle={(n) => `${n} titre${n > 1 ? "s" : ""}`}
  noun="titre"
  load={listLibrary}
  keyOf={(e) => e.id}
  titleOf={(e) => e.mediaItem.title}
  favoriteOf={(e) => e.favorite}
  statusOptions={STATUS_OPTIONS}
  {statusMatch}
  sorts={SORTS}
  defaultSort="recent"
  {compare}
  extraActive={types.length > 0}
  extraMatch={(e) => types.length === 0 || types.includes(e.mediaItem.type)}
  onClearExtra={() => (types = [])}>
  {#snippet extraFilters()}
    <Combobox
      label="Type"
      multiselect
      options={TYPE_OPTIONS}
      values={types}
      onChange={(v) => (types = v as MediaType[])} />
  {/snippet}
  {#snippet card(entry: LibraryEntryDto)}
    <PosterCard
      href={`/media/${entry.mediaItem.type.toLowerCase()}/${entry.mediaItem.sourceId}`}
      src={entry.mediaItem.posterUrl}
      title={entry.mediaItem.title}
      favorite={entry.favorite}>
      {#snippet meta()}
        {#if entry.progress}
          <div class="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div class="h-full bg-accent" style={`width: ${pct(entry)}%`}></div>
          </div>
          <span class="timecode text-xs">
            {entry.progress.watchedEpisodes} / {entry.progress.totalEpisodes} ép.
            {#if isDormant(entry)}
              <span class="text-dim">· ⏸ En pause</span>
            {/if}
          </span>
        {:else}
          <span class="timecode text-xs">
            {TYPE_LABELS[entry.mediaItem.type]}{#if entry.rating !== null}
              · ★ {entry.rating}{/if}
          </span>
        {/if}
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
