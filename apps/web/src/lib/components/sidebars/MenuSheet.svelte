<script lang="ts">
  // The "Menu" launcher: a full-width sheet that rises from the bottom bar and
  // lays out every destination as tiles — the mobile counterpart of the desktop
  // rail. In the app it groups libraries + tracking/account; inside /admin it
  // swaps to the admin sections (mirroring the rail) so admin subpages stay
  // reachable on a phone. Notifications and Admin live here — they have no
  // bottom-bar slot by default.
  import { page } from "$app/state";
  import { ADMIN_NAV } from "$lib/admin-nav";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { resolveMenuGroups } from "$lib/navigation";
  import { notifications } from "$lib/notifications.svelte";
  import type { ComponentProps } from "svelte";
  import { fade, fly } from "svelte/transition";

  type IconName = ComponentProps<typeof Icon>["name"];

  let open = $state(false);

  const inAdmin = $derived(page.url.pathname.startsWith("/admin"));

  const groups = $derived(
    resolveMenuGroups({ isDomainEnabled, isAdmin: auth.isAdmin }),
  );

  // JS transitions ignore the global prefers-reduced-motion CSS rule, so gate
  // their duration on the same preference explicitly.
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dur = reduced ? 0 : 220;

  function close() {
    open = false;
  }

  $effect(() => {
    const handler = () => (open = !open);
    window.addEventListener("mobile-menu-toggle", handler);
    return () => window.removeEventListener("mobile-menu-toggle", handler);
  });
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && close()} />

{#snippet tile(dest: {
  href: string;
  label: string;
  icon: IconName;
  match: (p: string) => boolean;
  comingSoon?: boolean;
})}
  {@const active = dest.match(page.url.pathname)}
  {#if dest.comingSoon}
    <div
      class="border-border text-dim/70 flex flex-col items-center gap-2 rounded-2xl border border-dashed p-3 text-center">
      <Icon name={dest.icon} class="h-6 w-6" />
      <span class="text-xs font-semibold">{dest.label}</span>
      <span class="text-dim/60 text-[0.6rem] font-bold tracking-wide uppercase">
        Bientôt
      </span>
    </div>
  {:else}
    <a
      href={dest.href}
      onclick={close}
      aria-current={active ? "page" : undefined}
      class="flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors {active
        ? 'border-accent/40 bg-accent/10 text-accent'
        : 'border-border bg-surface-2 hover:border-accent/40 text-fg'}">
      <span class="relative">
        <Icon name={dest.icon} class="text-accent h-6 w-6" />
        {#if dest.href === "/notifications" && notifications.unread > 0}
          <span
            class="bg-accent text-accent-fg absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.55rem] font-bold">
            {notifications.unread > 9 ? "9+" : notifications.unread}
          </span>
        {/if}
      </span>
      <span class="text-xs font-semibold">{dest.label}</span>
    </a>
  {/if}
{/snippet}

{#if open}
  <button
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
    aria-label="Fermer le menu"
    onclick={close}
    transition:fade={{ duration: dur }}></button>

  <aside
    class="border-border bg-surface fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-3xl border-t shadow-2xl md:hidden"
    transition:fly={{ y: 320, duration: dur, opacity: 1 }}>
    <!-- Grabber + header -->
    <div class="shrink-0 px-5 pt-3 pb-2">
      <div class="bg-border mx-auto mb-4 h-1 w-9 rounded-full"></div>
      <div class="flex items-center justify-between">
        <h2 class="font-display text-xl font-extrabold tracking-tight">
          {inAdmin ? "Administration" : "Menu"}
        </h2>
        <button
          onclick={close}
          aria-label="Fermer"
          class="hover:bg-surface-2 text-dim grid h-9 w-9 place-items-center rounded-full">
          <Icon name="x" class="h-5 w-5" />
        </button>
      </div>
    </div>

    <div
      class="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {#if inAdmin}
        <div class="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {#each ADMIN_NAV as item (item.href)}
            {@render tile(item)}
          {/each}
        </div>

        <a
          href="/"
          onclick={close}
          class="border-border bg-surface-2 hover:border-accent/40 text-fg mt-4 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold">
          <Icon name="chevron-left" class="h-4 w-4" />
          Retour à l’application
        </a>
      {:else}
        {#each groups as group (group.label)}
          <div class="mt-4 first:mt-2">
            <!-- Séance: section label as a timecode with a letterbox hairline. -->
            <div class="mb-2.5 flex items-center gap-3">
              <span
                class="timecode text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                {group.label}
              </span>
              <span class="bg-border h-px flex-1"></span>
            </div>
            <div class="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {#each group.items as item (item.id)}
                {@render tile(item)}
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </aside>
{/if}
