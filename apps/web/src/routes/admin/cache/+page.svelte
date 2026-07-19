<script lang="ts">
  import {
    getAdminCache,
    resyncAdminCacheItem,
    ApiError,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import type { AdminCacheItemDto, Domain } from "@tracklore/shared";

  const DOMAINS: {
    id: Domain;
    label: string;
    icon: "tv" | "gamepad" | "book" | "music";
  }[] = [
    { id: "MEDIA", label: "Écrans", icon: "tv" },
    { id: "GAMES", label: "Jeux", icon: "gamepad" },
    { id: "BOOKS", label: "Livres", icon: "book" },
    { id: "MUSIC", label: "Musique", icon: "music" },
  ];

  let activeDomain = $state<Domain>("MEDIA");
  let searchInput = $state("");
  let search = $state("");
  let items = $state<AdminCacheItemDto[]>([]);
  let total = $state(0);
  let page = $state(1);
  let loading = $state(false);
  let error = $state("");
  let resyncing = $state<string | null>(null);

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  async function load(reset: boolean) {
    loading = true;
    error = "";
    const targetPage = reset ? 1 : page + 1;
    try {
      const res = await getAdminCache({
        domain: activeDomain,
        search: search || undefined,
        page: targetPage,
      });
      items = reset ? res.items : [...items, ...res.items];
      total = res.total;
      page = targetPage;
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Cache indisponible";
    } finally {
      loading = false;
    }
  }

  function selectDomain(domain: Domain) {
    activeDomain = domain;
    void load(true);
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  function onSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      search = searchInput.trim();
      void load(true);
    }, 300);
  }

  $effect(() => {
    void load(true);
  });

  async function resync(item: AdminCacheItemDto) {
    resyncing = item.id;
    error = "";
    try {
      await resyncAdminCacheItem(item.domain, item.id);
      const fresh = await getAdminCache({
        domain: activeDomain,
        search: search || undefined,
        page: 1,
      });
      items = fresh.items;
      total = fresh.total;
      page = 1;
    } catch (err) {
      error =
        err instanceof ApiError
          ? err.message
          : "Échec de la re-synchronisation";
    } finally {
      resyncing = null;
    }
  }

  const hasMore = $derived(items.length < total);
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="database"
    title="Cache & synchronisation"
    subtitle="Le cache à la demande : chaque titre n'existe ici qu'une fois référencé par au moins un compte. Les plus obsolètes (>24h) apparaissent en premier." />

  <div class="mb-5 flex flex-wrap items-center gap-2">
    {#each DOMAINS as d (d.id)}
      <button
        class="chip"
        class:chip-on={activeDomain === d.id}
        onclick={() => selectDomain(d.id)}>
        <Icon name={d.icon} class="mr-1 -ml-0.5 inline h-3.5 w-3.5" />
        {d.label}
      </button>
    {/each}
  </div>

  <input
    type="text"
    bind:value={searchInput}
    oninput={onSearchInput}
    placeholder="Filtrer par titre…"
    class="input mb-5" />

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if loading && items.length === 0}
    <div class="space-y-2">
      {#each { length: 6 } as _, i (i)}
        <div class="card h-16 animate-pulse"></div>
      {/each}
    </div>
  {:else if items.length === 0}
    <EmptyState>Aucun titre en cache pour ce domaine.</EmptyState>
  {:else}
    <p class="mb-2 text-xs text-dim">{total} titre(s) en cache.</p>
    <ul class="space-y-2">
      {#each items as item (item.id)}
        <li class="card flex items-center gap-3 p-3">
          {#if item.coverUrl}
            <img
              src={item.coverUrl}
              alt=""
              class="h-14 w-10 shrink-0 rounded object-cover" />
          {:else}
            <div
              class="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-surface-2 text-dim">
              <Icon
                name={DOMAINS.find((d) => d.id === item.domain)?.icon ??
                  "database"}
                class="h-4 w-4" />
            </div>
          {/if}
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="truncate font-semibold text-fg">{item.title}</span>
              <span
                class="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold text-dim">
                {item.canonicalSource}
              </span>
              {#if item.stale}
                <span
                  class="flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                  <span class="h-1.5 w-1.5 rounded-full bg-accent"></span>
                  Obsolète
                </span>
              {/if}
            </div>
            <p class="timecode mt-0.5 text-xs">
              Sync {dateFmt.format(new Date(item.lastSyncedAt))}
              · {item.referenceCount} compte(s)
            </p>
          </div>
          <button
            class="btn btn-ghost shrink-0 text-xs"
            disabled={resyncing === item.id}
            onclick={() => resync(item)}>
            <Icon
              name="refresh"
              class="h-3.5 w-3.5 {resyncing === item.id
                ? 'animate-spin'
                : ''}" />
            {resyncing === item.id ? "…" : "Re-sync"}
          </button>
        </li>
      {/each}
    </ul>

    {#if hasMore}
      <button
        class="btn btn-ghost mt-4 w-full"
        disabled={loading}
        onclick={() => load(false)}>
        {loading ? "Chargement…" : "Charger plus"}
      </button>
    {/if}
  {/if}
</div>
