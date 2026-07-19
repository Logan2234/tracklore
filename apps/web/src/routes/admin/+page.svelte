<script lang="ts">
  import { getAdminVersion } from "$lib/api/client";
  import { ADMIN_NAV } from "$lib/admin-nav";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";

  let version = $state<string | null>(null);

  $effect(() => {
    getAdminVersion()
      .then((v) => (version = v.version))
      .catch(() => {});
  });
</script>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="shield"
    title="Administration"
    subtitle={`Connecté en tant que ${auth.user?.displayName}. Choisis une section.`} />

  <!-- Landing grid of sub-pages. Reserved for key metrics (stats…) later. -->
  <div class="grid gap-3 sm:grid-cols-2">
    {#each ADMIN_NAV as item (item.href)}
      {#if item.soon}
        <div
          class="card flex items-start gap-3 p-4 opacity-60"
          aria-disabled="true">
          <span
            class="bg-surface-2 text-dim grid h-10 w-10 shrink-0 place-items-center rounded-lg">
            <Icon name={item.icon} class="h-5 w-5" />
          </span>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-fg font-semibold">{item.label}</span>
              <span
                class="border-border text-dim rounded-full border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase">
                Bientôt
              </span>
            </div>
            <p class="text-dim mt-0.5 text-sm">{item.description}</p>
          </div>
        </div>
      {:else}
        <a
          href={item.href}
          class="card hover:border-accent/40 flex items-start gap-3 p-4 transition-colors">
          <span
            class="bg-accent/10 text-accent grid h-10 w-10 shrink-0 place-items-center rounded-lg">
            <Icon name={item.icon} class="h-5 w-5" />
          </span>
          <div class="min-w-0">
            <span class="text-fg font-semibold">{item.label}</span>
            <p class="text-dim mt-0.5 text-sm">{item.description}</p>
          </div>
        </a>
      {/if}
    {/each}
  </div>

  {#if version}
    <p class="text-dim mt-8 text-center text-xs">Tracklore v{version}</p>
  {/if}
</div>
