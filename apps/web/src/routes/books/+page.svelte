<script lang="ts">
  import { listBooks } from "$lib/api/client";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import { BOOK_STATUS_LABELS, BOOK_STATUS_ORDER } from "$lib/status-labels";
  import type { BookEntryDto } from "@tracklore/shared";

  const STATUS_OPTIONS = BOOK_STATUS_ORDER.map((value) => ({
    label: BOOK_STATUS_LABELS[value],
    value,
  }));

  type SortKey =
    | "added"
    | "title"
    | "author"
    | "rating"
    | "pages"
    | "progress"
    | "finished"
    | "started"
    | "status";
  const SORTS: { label: string; value: SortKey }[] = [
    { label: "Ajout récent", value: "added" },
    { label: "Titre", value: "title" },
    { label: "Auteur", value: "author" },
    { label: "Note", value: "rating" },
    { label: "Nombre de pages", value: "pages" },
    { label: "Progression de lecture", value: "progress" },
    { label: "Terminé récemment", value: "finished" },
    { label: "Commencé récemment", value: "started" },
    { label: "Statut", value: "status" },
  ];

  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  const readPct = (e: BookEntryDto) =>
    e.book.pageCount ? e.currentPage / e.book.pageCount : 0;

  // Base comparator per criterion (its natural order); the direction toggle
  // reverses the whole list.
  function compare(sort: string, a: BookEntryDto, b: BookEntryDto): number {
    switch (sort as SortKey) {
      case "title":
        return a.book.title.localeCompare(b.book.title, "fr");
      case "author":
        return (a.book.authors[0] ?? "").localeCompare(
          b.book.authors[0] ?? "",
          "fr",
        );
      case "rating":
        return (b.rating ?? -1) - (a.rating ?? -1);
      case "pages":
        return (b.book.pageCount ?? 0) - (a.book.pageCount ?? 0);
      case "progress":
        return readPct(b) - readPct(a);
      case "finished":
        return time(b.finishedAt) - time(a.finishedAt);
      case "started":
        return time(b.startedAt) - time(a.startedAt);
      case "status":
        return (
          BOOK_STATUS_ORDER.indexOf(a.status) -
          BOOK_STATUS_ORDER.indexOf(b.status)
        );
      case "added":
        return b.createdAt.localeCompare(a.createdAt);
    }
    return 0;
  }
</script>

<LibraryBrowser
  icon="book"
  title="Livres"
  subtitle={(n) => `${n} livre${n > 1 ? "s" : ""}`}
  noun="livre"
  load={listBooks}
  keyOf={(e) => e.id}
  titleOf={(e) => e.book.title}
  favoriteOf={(e) => e.favorite}
  statusOptions={STATUS_OPTIONS}
  statusMatch={(e, statuses) => statuses.includes(e.status)}
  sorts={SORTS}
  defaultSort="added"
  {compare}>
  {#snippet card(entry: BookEntryDto)}
    <PosterCard
      href={`/books/${entry.book.sourceId}`}
      src={entry.book.coverUrl}
      title={entry.book.title}
      favorite={entry.favorite}>
      {#snippet meta()}
        <span class="timecode text-xs">
          {BOOK_STATUS_LABELS[entry.status]}{#if entry.rating !== null}
            · ★ {entry.rating}{/if}
        </span>
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
