<script lang="ts">
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import BookSearchPanel from "$lib/components/search/BookSearchPanel.svelte";
  import GameSearchPanel from "$lib/components/search/GameSearchPanel.svelte";
  import MediaSearchPanel from "$lib/components/search/MediaSearchPanel.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { Domain } from "@tracklore/shared";

  const DOMAIN_TABS: { label: string; value: Domain }[] = [
    { label: "Médias", value: Domain.MEDIA },
    { label: "Jeux", value: Domain.GAMES },
    { label: "Livres", value: Domain.BOOKS },
  ];

  // Search-box placeholder fragments, so it names only the enabled domains.
  const DOMAIN_HINT: Record<Domain, string> = {
    [Domain.MEDIA]: "un film, une série",
    [Domain.GAMES]: "un jeu",
    [Domain.BOOKS]: "un livre",
  };

  // Only the domains the user keeps enabled are searchable (mirrors the nav;
  // the API enforces the same gate on the search endpoints).
  const enabledTabs = $derived(
    DOMAIN_TABS.filter((t) => isDomainEnabled(t.value)),
  );

  const placeholder = $derived(
    `Chercher ${enabledTabs.map((t) => DOMAIN_HINT[t.value]).join(", ")}…`,
  );

  let query = $state(page.url.searchParams.get("query") ?? "");
  let domain = $state<Domain>(Domain.MEDIA);

  // If the active domain gets disabled (or was never enabled), fall back to the
  // first enabled one so the panel below always matches a visible tab.
  $effect(() => {
    if (!isDomainEnabled(domain) && enabledTabs.length > 0) {
      domain = enabledTabs[0].value;
    }
  });
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-6">
    <h1
      class="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      <Icon name="search" class="h-7 w-7 text-accent" />
      Recherche
    </h1>
    <p class="mt-1 text-dim">Trouve un titre et ajoute-le à ta bibliothèque.</p>
  </header>

  <div class="relative mb-5">
    <span
      class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-dim">
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
  {/if}
</div>
