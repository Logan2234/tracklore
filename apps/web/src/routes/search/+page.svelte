<script lang="ts">
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import BookSearchPanel from "$lib/components/search/BookSearchPanel.svelte";
  import GameSearchPanel from "$lib/components/search/GameSearchPanel.svelte";
  import MediaSearchPanel from "$lib/components/search/MediaSearchPanel.svelte";
  import MusicSearchPanel from "$lib/components/search/MusicSearchPanel.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { Domain } from "@tracklore/shared";

  type DomainIcon = "tv" | "gamepad" | "book" | "music";

  const DOMAIN_TABS: { label: string; value: Domain; icon: DomainIcon }[] = [
    { label: "Vidéo", value: Domain.MEDIA, icon: "tv" },
    { label: "Jeux", value: Domain.GAMES, icon: "gamepad" },
    { label: "Livres", value: Domain.BOOKS, icon: "book" },
    { label: "Musique", value: Domain.MUSIC, icon: "music" },
  ];

  // Search-box placeholder fragment, named after the active domain tab.
  const DOMAIN_HINT: Record<Domain, string> = {
    [Domain.MEDIA]: "un film, une série",
    [Domain.GAMES]: "un jeu",
    [Domain.BOOKS]: "un livre",
    [Domain.MUSIC]: "un album",
  };

  // Only the domains the user keeps enabled are searchable (mirrors the nav;
  // the API enforces the same gate on the search endpoints).
  const enabledTabs = $derived(
    DOMAIN_TABS.filter((t) => isDomainEnabled(t.value)),
  );

  let query = $state(page.url.searchParams.get("query") ?? "");
  let domain = $state<Domain>(Domain.MEDIA);

  const placeholder = $derived(`Chercher ${DOMAIN_HINT[domain]}…`);

  // If the active domain gets disabled (or was never enabled), fall back to the
  // first enabled one so the panel below always matches a visible tab.
  $effect(() => {
    if (!isDomainEnabled(domain) && enabledTabs.length > 0) {
      domain = enabledTabs[0].value;
    }
  });
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="search"
    title="Recherche"
    subtitle="Trouve un titre et ajoute-le à ta bibliothèque."
    class="mb-6" />

  <div class="relative mb-5">
    <span
      class="text-dim pointer-events-none absolute inset-y-0 left-3 flex items-center">
      <Icon name="search" class="h-5 w-5" />
    </span>
    <input type="search" {placeholder} bind:value={query} class="input pl-10" />
  </div>

  {#if enabledTabs.length > 1}
    <div class="mb-5 flex flex-wrap gap-2">
      {#each enabledTabs as tab (tab.value)}
        <button
          class="chip"
          class:chip-on={domain === tab.value}
          onclick={() => (domain = tab.value)}>
          <Icon name={tab.icon} class="mr-1 -ml-0.5 inline h-3.5 w-3.5" />
          {tab.label}
        </button>
      {/each}
    </div>
  {/if}

  {#if domain === Domain.MEDIA}
    <MediaSearchPanel {query} />
  {:else if domain === Domain.GAMES}
    <GameSearchPanel {query} />
  {:else if domain === Domain.BOOKS}
    <BookSearchPanel {query} />
  {:else if domain === Domain.MUSIC}
    <MusicSearchPanel {query} />
  {/if}
</div>
