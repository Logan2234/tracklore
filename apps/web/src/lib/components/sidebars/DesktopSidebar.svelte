<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { ADMIN_NAV } from "$lib/admin-nav";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { NAVIGATION } from "$lib/navigation";
  import { notifications } from "$lib/notifications.svelte";
  import { theme } from "$lib/theme.svelte";

  let expanded = $state(
    browser ? localStorage.getItem("tl-rail") === "open" : false,
  );

  let { children } = $props();

  const inAdmin = $derived(page.url.pathname.startsWith("/admin"));

  const initial = $derived(
    (auth.user?.displayName ?? "?").charAt(0).toUpperCase(),
  );

  function toggleRail() {
    expanded = !expanded;

    if (browser) {
      localStorage.setItem("tl-rail", expanded ? "open" : "closed");
    }
  }

  // Scrollable nav: when the item list is taller than the viewport, the list
  // scrolls on its own while the actions below stay pinned. Fades at the top
  // and bottom edges signal that more items exist out of view.
  let navEl = $state<HTMLElement | null>(null);
  let atTop = $state(true);
  let atBottom = $state(true);

  function updateScroll() {
    const el = navEl;
    if (!el) return;
    atTop = el.scrollTop <= 1;
    atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
  }

  $effect(() => {
    window.addEventListener("resize", updateScroll);
    updateScroll();
    return () => window.removeEventListener("resize", updateScroll);
  });

  // Recompute when the rendered list changes height (rail width, admin vs app
  // navigation, or a new notification badge shifting layout).
  $effect(() => {
    void expanded;
    void inAdmin;
    void notifications.unread;
    updateScroll();
  });
</script>

<div class="flex min-h-screen">
  <aside
    class="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-surface px-3 py-3 transition-[width] duration-200 md:flex
    {expanded ? 'w-60' : 'w-16'}">
    <button
      onclick={toggleRail}
      class="flex w-full items-center overflow-hidden rounded-xl text-fg hover:bg-surface-2"
      aria-label="Changer la largeur du menu">
      <span class="grid h-10 w-10 shrink-0 place-items-center">
        <Icon name="menu" />
      </span>

      <span
        class="whitespace-nowrap text-sm font-semibold transition-opacity
        {expanded ? 'opacity-100' : 'opacity-0'}">
        Réduire
      </span>
    </button>

    <a href="/" class="mb-2 flex items-center overflow-hidden">
      <span
        class="grid h-10 w-10 shrink-0 place-items-center font-display text-xl font-extrabold text-accent">
        T
      </span>

      <span
        class="font-display text-lg font-extrabold whitespace-nowrap transition-opacity
        {expanded ? 'opacity-100' : 'opacity-0'}">
        Tracklore
      </span>
    </a>

    <div class="relative flex min-h-0 flex-1 flex-col">
      <nav
        bind:this={navEl}
        onscroll={updateScroll}
        class="tl-rail-scroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {#if inAdmin}
          <a
            href="/admin"
            aria-current={page.url.pathname === "/admin" ? "page" : undefined}
            title={expanded ? undefined : "Vue d’ensemble"}
            class="flex w-full items-center overflow-hidden rounded-xl transition-colors {page
              .url.pathname === '/admin'
              ? 'bg-accent/15 text-accent'
              : 'text-dim hover:bg-surface-2 hover:text-fg'}">
            <span class="grid h-10 w-10 shrink-0 place-items-center">
              <Icon name="home" class="h-5 w-5" />
            </span>
            <span
              class="whitespace-nowrap text-sm font-semibold transition-opacity duration-150 {expanded
                ? 'opacity-100'
                : 'opacity-0'}">
              Vue d’ensemble
            </span>
          </a>

          {#if expanded}
            <div
              class="px-3 pt-3 pb-1 text-[0.6rem] font-bold tracking-[0.13em] text-dim uppercase">
              Administration
            </div>
          {:else}
            <div class="mx-3 my-2 border-t border-border" aria-hidden="true">
            </div>
          {/if}

          {#each ADMIN_NAV as item (item.href)}
            {@const active = item.match(page.url.pathname)}
            <a
              href={item.soon ? undefined : item.href}
              aria-current={active ? "page" : undefined}
              aria-disabled={item.soon ? "true" : undefined}
              title={expanded ? undefined : item.label}
              class="flex w-full items-center overflow-hidden rounded-xl transition-colors {active
                ? 'bg-accent/15 text-accent'
                : 'text-dim hover:bg-surface-2 hover:text-fg'} {item.soon
                ? 'pointer-events-none opacity-60'
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
        {:else}
          {#each NAVIGATION as section (section.label)}
            {#if section.label && expanded}
              <div
                class="px-3 pt-3 pb-1 text-[0.6rem] font-bold tracking-widest text-dim uppercase">
                {section.label}
              </div>
            {/if}

            {#each section.items.filter((item) => !item.domain || isDomainEnabled(item.domain)) as item (item.href)}
              {@const active = item.match(page.url.pathname)}

              <a
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={expanded ? undefined : item.label}
                class="
              flex shrink-0 items-center overflow-hidden rounded-xl
              transition-colors
              {active
                  ? 'bg-accent/15 text-accent'
                  : 'text-dim hover:bg-surface-2 hover:text-fg'}
              ">
                <span class="grid h-10 w-10 shrink-0 place-items-center">
                  <Icon name={item.icon} class="h-5 w-5" />
                </span>

                <span
                  class="whitespace-nowrap text-sm font-semibold transition-opacity
                {expanded ? 'opacity-100' : 'opacity-0'}">
                  {item.label}
                </span>
              </a>
            {/each}
          {/each}
        {/if}
      </nav>

      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-surface to-transparent transition-opacity duration-150 {atTop
          ? 'opacity-0'
          : 'opacity-100'}"
        aria-hidden="true">
      </div>
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-surface to-transparent transition-opacity duration-150 {atBottom
          ? 'opacity-0'
          : 'opacity-100'}"
        aria-hidden="true">
      </div>
    </div>

    <div class="mt-2 flex flex-col gap-1 border-t border-border pt-2">
      {#if auth.isAdmin && !inAdmin}
        <a
          href="/admin"
          title={expanded ? undefined : "Admin"}
          aria-current={page.url.pathname.startsWith("/admin")
            ? "page"
            : undefined}
          class="flex w-full items-center overflow-hidden rounded-xl transition-colors {page.url.pathname.startsWith(
            '/admin',
          )
            ? 'bg-accent/15 text-accent'
            : 'text-dim hover:bg-surface-2 hover:text-fg'}">
          <span class="grid h-10 w-10 shrink-0 place-items-center">
            <Icon name="shield" class="h-5 w-5" />
          </span>
          <span
            class="whitespace-nowrap text-sm font-semibold transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            Admin
          </span>
        </a>
      {/if}

      {#if !inAdmin}
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
      {/if}

      {#if !inAdmin}
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
      {:else}
        <a
          href="/"
          title={expanded ? undefined : "Retour à l’application"}
          class="mt-1 flex w-full items-center overflow-hidden rounded-xl transition-colors hover:bg-surface-2 hover:text-fg">
          <span class="grid h-10 w-10 shrink-0 place-items-center">
            <Icon name="chevron-left" class="h-5 w-5" />
          </span>
          <span
            class="whitespace-nowrap text-sm font-semibold transition-opacity duration-150 {expanded
              ? 'opacity-100'
              : 'opacity-0'}">
            Application
          </span>
        </a>
      {/if}
    </div>
  </aside>

  <main class="min-w-0 flex-1">
    {@render children()}
  </main>
</div>

<style>
  /* Hide the native scrollbar in the narrow rail; the edge fades convey that
     the list scrolls. */
  .tl-rail-scroll {
    scrollbar-width: none;
  }
  .tl-rail-scroll::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
</style>
