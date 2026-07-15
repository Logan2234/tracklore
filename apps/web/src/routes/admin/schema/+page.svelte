<script lang="ts">
  import { getAdminSchema, ApiError } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import MermaidDiagram from "$lib/components/MermaidDiagram.svelte";
  import type { SchemaGraphResponseDto } from "@tracklore/shared";

  type Tab = "erd" | "modules";

  let data = $state<SchemaGraphResponseDto | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let tab = $state<Tab>("erd");

  async function load() {
    loading = true;
    error = null;
    try {
      data = await getAdminSchema();
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Schéma indisponible";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (auth.isAdmin) void load();
  });

  const TABS: { value: Tab; label: string; regenerate: string }[] = [
    {
      value: "erd",
      label: "Base de données",
      regenerate: "pnpm --filter @tracklore/api exec prisma generate",
    },
    {
      value: "modules",
      label: "Modules",
      regenerate: "pnpm --filter @tracklore/api run graph",
    },
  ];

  const active = $derived(TABS.find((t) => t.value === tab)!);
  const activeGraph = $derived(tab === "erd" ? data?.erd : data?.modules);
</script>

<div class="px-4 py-6 md:px-8 md:py-10">
  <header class="mb-6">
    <h1
      class="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      <Icon name="library" class="h-7 w-7 text-accent" />
      Schéma
    </h1>
    <p class="mt-1 text-dim">
      Graphe de la base de données et des modules de l'app, générés localement.
    </p>
  </header>

  <div class="mb-5 flex flex-wrap gap-2">
    {#each TABS as t (t.value)}
      <button
        class="chip"
        class:chip-on={tab === t.value}
        onclick={() => (tab = t.value)}>
        {t.label}
      </button>
    {/each}
  </div>

  {#if error}
    <p
      class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  {:else if loading && !data}
    <div class="card h-64 animate-pulse"></div>
  {:else if activeGraph}
    <MermaidDiagram code={activeGraph} />
  {:else}
    <div class="card p-6 text-sm text-dim">
      <p>
        Pas encore généré pour cette session de développement (fichier absent de <code
          class="text-fg">docs/</code
        >, ignoré par git).
      </p>
      <p class="mt-3">Génère-le avec :</p>
      <pre
        class="mt-2 overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg">{active.regenerate}</pre>
      <p class="mt-3">Puis rafraîchis cette page.</p>
    </div>
  {/if}
</div>
