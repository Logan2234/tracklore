<script lang="ts">
  import { listGames } from "$lib/api/client";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import { GAME_STATUS_LABELS, GAME_STATUS_ORDER } from "$lib/status-labels";
  import type { GameEntryDto } from "@tracklore/shared";

  const STATUS_OPTIONS = GAME_STATUS_ORDER.map((value) => ({
    label: GAME_STATUS_LABELS[value],
    value,
  }));

  type SortKey =
    | "added"
    | "title"
    | "rating"
    | "playtime"
    | "finished"
    | "started"
    | "status";
  const SORTS: { label: string; value: SortKey }[] = [
    { label: "Ajout récent", value: "added" },
    { label: "Titre", value: "title" },
    { label: "Note", value: "rating" },
    { label: "Temps de jeu", value: "playtime" },
    { label: "Terminé récemment", value: "finished" },
    { label: "Commencé récemment", value: "started" },
    { label: "Statut", value: "status" },
  ];

  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

  // Base comparator per criterion (its natural order); the direction toggle
  // reverses the whole list.
  function compare(sort: string, a: GameEntryDto, b: GameEntryDto): number {
    switch (sort as SortKey) {
      case "title":
        return a.game.title.localeCompare(b.game.title, "fr");
      case "rating":
        return (b.rating ?? -1) - (a.rating ?? -1);
      case "playtime":
        return b.playtimeMinutes - a.playtimeMinutes;
      case "finished":
        return time(b.finishedAt) - time(a.finishedAt);
      case "started":
        return time(b.startedAt) - time(a.startedAt);
      case "status":
        return (
          GAME_STATUS_ORDER.indexOf(a.status) -
          GAME_STATUS_ORDER.indexOf(b.status)
        );
      case "added":
        return b.createdAt.localeCompare(a.createdAt);
    }
    return 0;
  }
</script>

<LibraryBrowser
  icon="gamepad"
  title="Jeux"
  subtitle={(n) => `${n} jeu${n > 1 ? "x" : ""}`}
  noun="jeu"
  load={listGames}
  keyOf={(e) => e.id}
  titleOf={(e) => e.game.title}
  favoriteOf={(e) => e.favorite}
  statusOptions={STATUS_OPTIONS}
  statusMatch={(e, statuses) => statuses.includes(e.status)}
  sorts={SORTS}
  defaultSort="added"
  {compare}>
  {#snippet card(entry: GameEntryDto)}
    <PosterCard
      href={`/games/${entry.game.sourceId}`}
      src={entry.game.coverUrl}
      title={entry.game.title}
      favorite={entry.favorite}>
      {#snippet meta()}
        <span class="timecode text-xs">
          {GAME_STATUS_LABELS[entry.status]}{#if entry.rating !== null}
            · ★ {entry.rating}{/if}
        </span>
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
