<script lang="ts">
  import "@fontsource-variable/bricolage-grotesque/wght.css";
  import "@fontsource-variable/hanken-grotesk/wght.css";
  import "@fontsource/space-mono/400.css";
  import "@fontsource/space-mono/700.css";
  import "../app.css";

  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { initAuth } from "$lib/api/client";
  import favicon from "$lib/assets/favicon.svg";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { notifications } from "$lib/notifications.svelte";
  import { theme } from "$lib/theme.svelte";
  import { Domain } from "@tracklore/shared";

  let { children } = $props();
  let ready = $state(false);
  let expanded = $state(
    browser ? localStorage.getItem("tl-rail") === "open" : false,
  );

  const PUBLIC_ROUTES = ["/login", "/register"];

  type NavItem = {
    href: string;
    label: string;
    icon:
      "home" | "library" | "search" | "calendar" | "stats" | "gamepad" | "book";
    match: (p: string) => boolean;
    /** Placeholder domain (P3): dimmed + "Bientôt" badge, still reachable. */
    soon?: boolean;
    /** Domain-scoped entry: hidden when the user disabled that domain. */
    domain?: Domain;
  };
  type NavSection = { label?: string; items: NavItem[] };

  const HOME: NavItem = {
    href: "/",
    label: "Accueil",
    icon: "home",
    match: (p) => p === "/",
  };
  const SEARCH: NavItem = {
    href: "/search",
    label: "Recherche",
    icon: "search",
    match: (p) => p.startsWith("/search"),
  };
  const SCREENS: NavItem = {
    href: "/media",
    label: "Écrans",
    icon: "library",
    match: (p) => p.startsWith("/media"),
    domain: Domain.MEDIA,
  };
  const CALENDAR: NavItem = {
    href: "/calendar",
    label: "Calendrier",
    icon: "calendar",
    match: (p) => p.startsWith("/calendar"),
  };

  // Grouped rail: global entries (no header), then the collection domains, then
  // time-based views. Games/Books are P3 placeholders (soon).
  const SECTIONS: NavSection[] = [
    { items: [HOME, SEARCH] },
    {
      label: "Ma bibliothèque",
      items: [
        SCREENS,
        {
          href: "/games",
          label: "Jeux",
          icon: "gamepad",
          match: (p) => p.startsWith("/games"),
          soon: true,
          domain: Domain.GAMES,
        },
        {
          href: "/books",
          label: "Livres",
          icon: "book",
          match: (p) => p.startsWith("/books"),
          soon: true,
          domain: Domain.BOOKS,
        },
      ],
    },
    {
      label: "Suivi",
      items: [
        CALENDAR,
        {
          href: "/stats",
          label: "Statistiques",
          icon: "stats",
          match: (p) => p.startsWith("/stats"),
        },
      ],
    },
  ];
  // Mobile bottom bar keeps to five thumb targets (Compte is added in markup);
  // Games/Books and Stats live only in the desktop rail.
  const BOTTOM: NavItem[] = [HOME, SCREENS, SEARCH, CALENDAR];

  $effect(() => {
    initAuth().finally(() => {
      ready = true;
    });
  });

  $effect(() => {
    theme.init();
  });

  // Once logged in, detect new episodes of tracked shows and load the feed.
  $effect(() => {
    if (ready && auth.isLoggedIn) void notifications.refresh(true);
  });

  // Redirect to /login as soon as we know the user is not authenticated.
  $effect(() => {
    if (
      ready &&
      !auth.isLoggedIn &&
      !PUBLIC_ROUTES.includes(page.url.pathname)
    ) {
      void goto("/login");
    }
  });

  function toggleRail() {
    expanded = !expanded;
    if (browser) localStorage.setItem("tl-rail", expanded ? "open" : "closed");
  }

  const initial = $derived(
    (auth.user?.displayName ?? "?").charAt(0).toUpperCase(),
  );
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>Tracklore</title>
</svelte:head>

{#if ready}
  {#if auth.isLoggedIn}
    <div class="flex min-h-screen">
      <!-- Desktop rail: collapsible icon nav. Icons sit in fixed 40px boxes so
			     they never shift; only width + label opacity animate. -->
      <aside
        class="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-surface px-3 py-3 transition-[width] duration-200 md:flex {expanded
          ? 'w-60'
          : 'w-16'}">
        <button
          onclick={toggleRail}
          class="flex w-full items-center overflow-hidden rounded-xl text-fg transition-colors hover:bg-surface-2"
          aria-label={expanded ? "Replier le menu" : "Déplier le menu"}
          aria-expanded={expanded}>
          <span class="grid h-10 w-10 shrink-0 place-items-center"
            ><Icon name="menu" /></span>
          <span
            class="whitespace-nowrap text-sm font-semibold transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            Réduire
          </span>
        </button>

        <a
          href="/"
          aria-label="Tracklore — accueil"
          class="mb-2 flex w-full items-center overflow-hidden">
          <span
            class="grid h-10 w-10 shrink-0 place-items-center font-display text-xl font-extrabold text-accent">
            T
          </span>
          <span
            class="font-display text-lg font-extrabold whitespace-nowrap transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            Tracklore
          </span>
        </a>

        <nav class="flex flex-1 flex-col gap-0.5 py-2">
          {#each SECTIONS as section, i (i)}
            {#if section.label}
              {#if expanded}
                <div
                  class="px-3 pt-3 pb-1 text-[0.6rem] font-bold tracking-[0.13em] text-dim uppercase">
                  {section.label}
                </div>
              {:else}
                <div
                  class="mx-3 my-2 border-t border-border"
                  aria-hidden="true">
                </div>
              {/if}
            {/if}
            {#each section.items.filter((it) => !it.domain || isDomainEnabled(it.domain)) as item (item.href)}
              {@const active = item.match(page.url.pathname)}
              <a
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={expanded ? undefined : item.label}
                class="flex w-full items-center overflow-hidden rounded-xl transition-colors {active
                  ? 'bg-accent/15 text-accent'
                  : 'text-dim hover:bg-surface-2 hover:text-fg'} {item.soon
                  ? 'opacity-60'
                  : ''}">
                <span class="grid h-10 w-10 shrink-0 place-items-center">
                  <Icon name={item.icon} class="h-5 w-5" />
                </span>
                <span
                  class="whitespace-nowrap text-sm font-semibold transition-opacity duration-150 {expanded
                    ? 'opacity-100'
                    : 'opacity-0'}">
                  {item.label}
                </span>
                {#if item.soon}
                  <span
                    class="mr-2 ml-auto rounded-full border border-border px-1.5 py-0.5 text-[0.55rem] font-bold whitespace-nowrap text-dim transition-opacity duration-150 {expanded
                      ? 'opacity-100'
                      : 'opacity-0'}">
                    Bientôt
                  </span>
                {/if}
              </a>
            {/each}
          {/each}
        </nav>

        <button
          onclick={() => theme.toggle()}
          class="flex w-full items-center overflow-hidden rounded-xl text-dim transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label="Changer de thème">
          <span class="grid h-10 w-10 shrink-0 place-items-center">
            <Icon
              name={theme.mode === "dark" ? "sun" : "moon"}
              class="h-5 w-5" />
          </span>
          <span
            class="whitespace-nowrap text-sm font-semibold transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            {theme.mode === "dark" ? "Thème clair" : "Thème sombre"}
          </span>
        </button>

        <a
          href="/notifications"
          title={expanded ? undefined : "Notifications"}
          aria-current={page.url.pathname.startsWith("/notifications")
            ? "page"
            : undefined}
          class="flex w-full items-center overflow-hidden rounded-xl transition-colors {page.url.pathname.startsWith(
            '/notifications',
          )
            ? 'bg-accent/15 text-accent'
            : 'text-dim hover:bg-surface-2 hover:text-fg'}">
          <span class="relative grid h-10 w-10 shrink-0 place-items-center">
            <Icon name="bell" class="h-5 w-5" />
            {#if notifications.unread > 0}
              <span
                class="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.55rem] font-bold text-accent-fg">
                {notifications.unread > 9 ? "9+" : notifications.unread}
              </span>
            {/if}
          </span>
          <span
            class="whitespace-nowrap text-sm font-semibold transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            Notifications
          </span>
        </a>

        <a
          href="/account"
          title={expanded ? undefined : auth.user?.displayName}
          class="mt-1 flex w-full items-center overflow-hidden rounded-xl transition-colors hover:bg-surface-2 {page.url.pathname.startsWith(
            '/account',
          )
            ? 'bg-surface-2'
            : ''}">
          <span class="grid h-10 w-10 shrink-0 place-items-center">
            <span
              class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 font-display text-sm font-bold text-fg">
              {initial}
            </span>
          </span>
          <span
            class="truncate text-sm font-semibold text-fg transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            {auth.user?.displayName}
          </span>
        </a>
      </aside>

      <!-- Page content -->
      <main
        class="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {@render children()}
      </main>
    </div>

    <!-- Mobile bottom bar -->
    <nav
      class="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {#each BOTTOM.filter((it) => !it.domain || isDomainEnabled(it.domain)) as item (item.href)}
        {@const active = item.match(page.url.pathname)}
        <a
          href={item.href}
          aria-current={active ? "page" : undefined}
          class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.62rem] font-semibold {active
            ? 'text-accent'
            : 'text-dim'}">
          <Icon name={item.icon} class="h-6 w-6" />
          {item.label}
        </a>
      {/each}
      <a
        href="/notifications"
        aria-current={page.url.pathname.startsWith("/notifications")
          ? "page"
          : undefined}
        class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.62rem] font-semibold {page.url.pathname.startsWith(
          '/notifications',
        )
          ? 'text-accent'
          : 'text-dim'}">
        <span class="relative">
          <Icon name="bell" class="h-6 w-6" />
          {#if notifications.unread > 0}
            <span
              class="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.55rem] font-bold text-accent-fg">
              {notifications.unread > 9 ? "9+" : notifications.unread}
            </span>
          {/if}
        </span>
        Alertes
      </a>
      <a
        href="/account"
        aria-current={page.url.pathname.startsWith("/account")
          ? "page"
          : undefined}
        class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.62rem] font-semibold {page.url.pathname.startsWith(
          '/account',
        )
          ? 'text-accent'
          : 'text-dim'}">
        <Icon name="user" class="h-6 w-6" />
        Compte
      </a>
    </nav>
  {:else}
    {@render children()}
  {/if}
{/if}
