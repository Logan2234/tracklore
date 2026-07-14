<script lang="ts">
  import { ApiError, listBooks } from "$lib/api/client";
  import Combobox from "$lib/components/Combobox.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type { BookEntryDto, BookStatus } from "@tracklore/shared";

  const STATUS_LABELS: Record<BookStatus, string> = {
    TO_READ: "À lire",
    READING: "En lecture",
    READ: "Lu",
    DROPPED: "Abandonné",
  };
  const STATUS_ORDER: BookStatus[] = ["TO_READ", "READING", "READ", "DROPPED"];

  const STATUS_OPTIONS = STATUS_ORDER.map((value) => ({
    label: STATUS_LABELS[value],
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

  let entries = $state<BookEntryDto[]>([]);
  let statuses = $state<BookStatus[]>([]);
  let favoritesOnly = $state(false);
  let sort = $state<SortKey>("added");
  let reversed = $state(false);
  let query = $state("");
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    loading = true;
    error = null;
    listBooks()
      .then((result) => {
        entries = result;
      })
      .catch((err) => {
        error = err instanceof ApiError ? err.message : "Chargement impossible";
      })
      .finally(() => {
        loading = false;
      });
  });

  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  const readPct = (e: BookEntryDto) =>
    e.book.pageCount ? e.currentPage / e.book.pageCount : 0;

  // Base comparator per criterion (its natural order); the direction toggle
  // reverses the whole list.
  function compare(a: BookEntryDto, b: BookEntryDto): number {
    switch (sort) {
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
        return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      case "added":
        return b.createdAt.localeCompare(a.createdAt);
    }
    return 0;
  }

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (statuses.length > 0 && !statuses.includes(e.status)) return false;
      if (favoritesOnly && !e.favorite) return false;
      if (q && !e.book.title.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...list].sort(compare);
    if (reversed) sorted.reverse();
    return sorted;
  });

  const hasQuery = $derived(query.trim() !== "");
  const hasFilters = $derived(statuses.length > 0 || favoritesOnly);

  function clearFilters() {
    statuses = [];
    favoritesOnly = false;
  }
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-6">
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Livres
    </h1>
    <p class="timecode mt-1 text-sm">
      {shown.length} livre{shown.length > 1 ? "s" : ""}
    </p>
  </header>

  <div class="relative mb-4">
    <span
      class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-dim">
      <Icon name="search" class="h-5 w-5" />
    </span>
    <input
      type="search"
      placeholder="Filtrer ma bibliothèque…"
      bind:value={query}
      class="input pl-10" />
  </div>

  <div class="mb-7 flex flex-wrap items-center gap-2">
    <Combobox
      label="Statut"
      multiselect
      options={STATUS_OPTIONS}
      values={statuses}
      onChange={(v) => (statuses = v as BookStatus[])} />
    <button
      class="chip inline-flex items-center gap-1"
      class:chip-on={favoritesOnly}
      onclick={() => (favoritesOnly = !favoritesOnly)}>
      <Icon name="star" class="h-3.5 w-3.5" /> Favoris
    </button>
    <div class="ml-auto flex items-center gap-2">
      <Combobox
        label="Trier"
        options={SORTS}
        values={[sort]}
        onChange={(v) => (sort = v[0] as SortKey)} />
      <button
        type="button"
        class="chip px-2.5 font-mono"
        title={reversed ? "Ordre inversé" : "Ordre par défaut"}
        aria-label="Inverser le sens du tri"
        onclick={() => (reversed = !reversed)}>
        {reversed ? "↑" : "↓"}
      </button>
    </div>
  </div>

  {#if error}
    <p
      class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  {:else if loading}
    <div
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each { length: 10 } as _, i (i)}
        <div class="card">
          <div class="aspect-2/3 w-full animate-pulse bg-surface-2"></div>
          <div class="flex flex-col gap-2 p-3">
            <div class="h-3.5 w-4/5 animate-pulse rounded bg-surface-2"></div>
            <div class="h-3 w-1/2 animate-pulse rounded bg-surface-2"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if shown.length === 0}
    <div
      class="rounded-xl border border-dashed border-border px-6 py-16 text-center text-dim">
      {#if !hasFilters && !hasQuery}
        <p>Tu n'as encore aucun livre dans ta bibliothèque.</p>
        <a href="/search" class="btn btn-primary mt-4 inline-flex">
          <Icon name="search" class="h-4 w-4" /> Chercher un livre
        </a>
      {:else if hasQuery && !hasFilters}
        <p>
          Aucun livre ne correspond à « {query.trim()} » dans ta bibliothèque.
          <a
            href={`/search?query=${encodeURIComponent(query.trim())}`}
            class="font-semibold text-accent hover:underline">
            Le chercher dans le catalogue →
          </a>
        </p>
      {:else}
        <p>
          {#if hasQuery}
            Aucun livre ne correspond à ces filtres pour « {query.trim()} ».
          {:else}
            Aucun livre ne correspond à ces filtres.
          {/if}
        </p>
        <button class="btn btn-ghost mt-4" onclick={clearFilters}>
          Effacer les filtres
        </button>
      {/if}
    </div>
  {:else}
    <div
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each shown as entry (entry.id)}
        <a
          href={`/books/${entry.book.sourceId}`}
          class="card group transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-accent">
          <Poster src={entry.book.coverUrl} title={entry.book.title} />
          <div class="flex flex-col gap-1.5 p-3">
            <span class="font-display text-sm leading-tight font-semibold">
              {#if entry.favorite}<span class="text-accent">★</span
                >&nbsp;{/if}{entry.book.title}
            </span>
            <span class="timecode text-xs">
              {STATUS_LABELS[entry.status]}{#if entry.rating !== null}
                · ★ {entry.rating}{/if}
            </span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
