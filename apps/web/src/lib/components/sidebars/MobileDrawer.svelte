<script lang="ts">
  import { page } from "$app/state";
  import { ADMIN_NAV } from "$lib/admin-nav";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { getDrawerNavigation } from "$lib/navigation";

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
      border-border
      bg-surface
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
      shadow-xl
      md:hidden
    ">
    <!-- Header -->

    <div
      class="
        border-border
        flex
        items-center
        justify-between
        border-b
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
          hover:bg-surface-2
          grid
          h-9
          w-9
          place-items-center
          rounded-full
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
            text-dim
            mb-2
            text-xs
            font-bold
            tracking-wider
            uppercase
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
        border-border
        border-t
        p-4
      ">
      <a
        href="/account"
        onclick={close}
        class="
          hover:bg-surface-2
          mt-2
          flex
          items-center
          gap-3
          rounded-xl
          px-3
          py-3
          text-sm
          font-semibold
        ">
        <Icon name="user" class="h-5 w-5" />

        {auth.user?.displayName}
      </a>
    </div>
  </aside>
{/if}
