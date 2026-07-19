<script lang="ts">
  import { page } from "$app/state";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import {
    DEFAULT_BOTTOM_SHORTCUTS,
    resolveBottomShortcuts,
  } from "$lib/navigation";
  import { notifications } from "$lib/notifications.svelte";

  // The user's stored order (falls back to the default set), gated by enabled
  // domains / admin role at render time — a shortcut for a since-disabled domain
  // silently drops out.
  const items = $derived(
    resolveBottomShortcuts(
      auth.user?.mobileNavShortcuts?.length
        ? auth.user.mobileNavShortcuts
        : DEFAULT_BOTTOM_SHORTCUTS,
      { isDomainEnabled, isAdmin: auth.isAdmin },
    ),
  );

  // Notifications live inside the launcher unless the user pinned them to the
  // bar — in that case the bar item carries the count and the launcher dot is
  // redundant, so suppress it there.
  const notifPinned = $derived(items.some((i) => i.id === "notifications"));

  function openMenu() {
    dispatchEvent(new CustomEvent("mobile-menu-toggle"));
  }
</script>

<nav
  class="
    border-border bg-surface/95 fixed inset-x-0
    bottom-0
    z-30 flex
    border-t
    pb-[env(safe-area-inset-bottom)]
    backdrop-blur
    md:hidden
  ">
  {#each items as item (item.id)}
    {#if item.id === "menu"}
      <button
        onclick={openMenu}
        aria-label="Ouvrir le menu"
        class="text-dim relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.62rem] font-semibold">
        <span class="relative">
          <Icon name={item.icon} class="h-6 w-6" />
          {#if !notifPinned && notifications.unread > 0}
            <span
              class="bg-accent absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface)]">
            </span>
          {/if}
        </span>
        {item.label}
      </button>
    {:else}
      {@const active = item.match(page.url.pathname)}
      <a
        href={item.href}
        aria-current={active ? "page" : undefined}
        class="
          flex flex-1 flex-col items-center gap-0.5
          py-2.5
          text-[0.62rem]
          font-semibold
          transition-colors
          {active ? 'text-accent' : 'text-dim'}
        ">
        <span class="relative">
          <Icon name={item.icon} class="h-6 w-6" />

          {#if item.id === "notifications" && notifications.unread > 0}
            <span
              class="
                bg-accent
                text-accent-fg
                absolute
                -top-1
                -right-1
                grid
                h-4
                min-w-4
                place-items-center
                rounded-full
                px-1
                text-[0.55rem]
                font-bold
              ">
              {notifications.unread > 9 ? "9+" : notifications.unread}
            </span>
          {/if}
        </span>

        {item.label}
      </a>
    {/if}
  {/each}
</nav>
