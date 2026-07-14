<script lang="ts">
  import { page } from "$app/state";
  import { ADMIN_NAV } from "$lib/admin-nav";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { getDrawerNavigation } from "$lib/navigation";
  import { theme } from "$lib/theme.svelte";

  let open = $state(false);

  const items = getDrawerNavigation();

  const inAdmin = $derived(page.url.pathname.startsWith("/admin"));

  function close() {
    open = false;
  }

  function toggle() {
    open = !open;
  }

  $effect(() => {
    const handler = () => toggle();

    window.addEventListener("mobile-menu-toggle", handler);

    return () => window.removeEventListener("mobile-menu-toggle", handler);
  });
</script>

{#if open}
  <!-- Overlay -->
  <button
    class="
      fixed
      inset-0
      z-40
      bg-black/30
      backdrop-blur-sm
      md:hidden
    "
    aria-label="Fermer le menu"
    onclick={close}></button>

  <!-- Drawer -->
  <aside
    class="
      fixed
      right-0
      bottom-0
      z-50
      flex
      h-[80vh]
      w-[90vw]
      max-w-sm
      flex-col
      rounded-t-3xl
      border
      border-border
      bg-surface
      shadow-xl
      md:hidden
    ">
    <!-- Header -->

    <div
      class="
        flex
        items-center
        justify-between
        border-b
        border-border
        px-5
        py-4
      ">
      <h2
        class="
          font-display
          text-lg
          font-bold
        ">
        Menu
      </h2>

      <button
        onclick={close}
        class="
          grid
          h-9
          w-9
          place-items-center
          rounded-full
          hover:bg-surface-2
        ">
        <Icon name="x" class="h-5 w-5" />
      </button>
    </div>

    <nav
      class="
        flex-1
        overflow-y-auto
        px-4
        py-4
      ">
      {#if inAdmin}
        <div
          class="
            mb-2
            text-xs
            font-bold
            uppercase
            tracking-wider
            text-dim
          ">
          Administration
        </div>

        {#each ADMIN_NAV as item (item.href)}
          {@const active = item.match(page.url.pathname)}

          <a
            href={item.href}
            onclick={close}
            class="
              flex
              items-center
              gap-3
              rounded-xl
              px-3
              py-3
              text-sm
              font-semibold

              {active
              ? 'bg-accent/15 text-accent'
              : 'text-dim hover:bg-surface-2'}
            ">
            <Icon name={item.icon} class="h-5 w-5" />

            {item.label}
          </a>
        {/each}
      {:else}
        {#each items as item (item.href)}
          {#if !item.domain || isDomainEnabled(item.domain)}
            {@const active = item.match(page.url.pathname)}

            <a
              href={item.href}
              onclick={close}
              class="
                flex
                items-center
                gap-3
                rounded-xl
                px-3
                py-3
                text-sm
                font-semibold

                {active
                ? 'bg-accent/15 text-accent'
                : 'text-dim hover:bg-surface-2'}
              ">
              <Icon name={item.icon} class="h-5 w-5" />

              {item.label}
            </a>
          {/if}
        {/each}
      {/if}
    </nav>

    <!-- Footer -->

    <div
      class="
        border-t
        border-border
        p-4
      ">
      <button
        onclick={() => theme.toggle()}
        class="
          flex
          w-full
          items-center
          gap-3
          rounded-xl
          px-3
          py-3
          text-sm
          font-semibold
          text-dim
          hover:bg-surface-2
        ">
        <Icon name={theme.mode === "dark" ? "sun" : "moon"} class="h-5 w-5" />

        {theme.mode === "dark" ? "Thème clair" : "Thème sombre"}
      </button>

      <a
        href="/account"
        onclick={close}
        class="
          mt-2
          flex
          items-center
          gap-3
          rounded-xl
          px-3
          py-3
          text-sm
          font-semibold
          hover:bg-surface-2
        ">
        <Icon name="user" class="h-5 w-5" />

        {auth.user?.displayName}
      </a>
    </div>
  </aside>
{/if}
