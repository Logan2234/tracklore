<script lang="ts">
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { getBottomNavigation } from "$lib/navigation";
  import { notifications } from "$lib/notifications.svelte";

  const items = getBottomNavigation();
</script>

<nav
  class="
    fixed inset-x-0 bottom-0 z-30
    flex
    border-t border-border
    bg-surface/95
    pb-[env(safe-area-inset-bottom)]
    backdrop-blur
    md:hidden
  ">
  {#each items.filter((item) => !item.domain || isDomainEnabled(item.domain)) as item (item.href)}
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

        {#if item.href === "/notifications" && notifications.unread > 0}
          <span
            class="
              absolute
              -top-1
              -right-1
              grid
              h-4
              min-w-4
              place-items-center
              rounded-full
              bg-accent
              px-1
              text-[0.55rem]
              font-bold
              text-accent-fg
            ">
            {notifications.unread > 9 ? "9+" : notifications.unread}
          </span>
        {/if}
      </span>

      {item.label}
    </a>
  {/each}

  <!-- Bouton plus : ouvre le drawer -->
  <button
    class="
      flex flex-1 flex-col items-center gap-0.5
      py-2.5
      text-[0.62rem]
      font-semibold
      text-dim
    "
    onclick={() => dispatchEvent(new CustomEvent("mobile-menu-toggle"))}>
    <Icon name="menu" class="h-6 w-6" />

    Plus
  </button>
</nav>
