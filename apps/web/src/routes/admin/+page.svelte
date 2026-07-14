<script lang="ts">
  import { ADMIN_NAV } from "$lib/admin-nav";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
</script>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-8">
    <h1
      class="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      <Icon name="shield" class="h-7 w-7 text-accent" />
      Administration
    </h1>
    <p class="mt-1 text-dim">
      Connecté en tant que {auth.user?.displayName}. Choisis une section.
    </p>
  </header>

  <!-- Landing grid of sub-pages. Reserved for key metrics (stats…) later. -->
  <div class="grid gap-3 sm:grid-cols-2">
    {#each ADMIN_NAV as item (item.href)}
      {#if item.soon}
        <div
          class="card flex items-start gap-3 p-4 opacity-60"
          aria-disabled="true">
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-dim">
            <Icon name={item.icon} class="h-5 w-5" />
          </span>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-fg">{item.label}</span>
              <span
                class="rounded-full border border-border px-1.5 py-0.5 text-[0.55rem] font-bold text-dim uppercase">
                Bientôt
              </span>
            </div>
            <p class="mt-0.5 text-sm text-dim">{item.description}</p>
          </div>
        </div>
      {:else}
        <a
          href={item.href}
          class="card flex items-start gap-3 p-4 transition-colors hover:border-accent/40">
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
            <Icon name={item.icon} class="h-5 w-5" />
          </span>
          <div class="min-w-0">
            <span class="font-semibold text-fg">{item.label}</span>
            <p class="mt-0.5 text-sm text-dim">{item.description}</p>
          </div>
        </a>
      {/if}
    {/each}
  </div>
</div>
