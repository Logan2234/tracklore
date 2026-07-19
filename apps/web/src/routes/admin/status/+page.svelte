<script lang="ts">
  import { getAdminServices, ApiError } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import type { ServiceStatusDto } from "@tracklore/shared";

  let services = $state<ServiceStatusDto[] | null>(null);
  let checkedAt = $state<string | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      const res = await getAdminServices();
      services = res.services;
      checkedAt = res.checkedAt;
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Statut indisponible";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (auth.isAdmin) void load();
  });

  // Ordered areas so groups render in a stable, sensible order. Must match the
  // ServiceArea values the API emits (see admin.service.ts) — "Écrans", not "Vidéo".
  const AREAS = ["Écrans", "Jeux", "Livres", "Musique", "Système"] as const;

  const grouped = $derived(
    AREAS.map((area) => ({
      area,
      items: (services ?? []).filter((s) => s.area === area),
    })).filter((g) => g.items.length > 0),
  );

  const timeFmt = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  type Health = { label: string; cls: string };

  /** Overall health badge for one service, combining config + probe. */
  function health(s: ServiceStatusDto): Health {
    if (!s.configured) {
      return s.required
        ? {
            label: "Non configuré",
            cls: "border-danger/40 bg-danger/10 text-danger",
          }
        : {
            label: "Non configuré",
            cls: "border-border bg-surface-2 text-dim",
          };
    }
    if (s.reachable === true) {
      return {
        label: "OK",
        cls: "border-success/40 bg-success/10 text-success",
      };
    }
    if (s.reachable === false) {
      return {
        label: "En panne",
        cls: "border-danger/40 bg-danger/10 text-danger",
      };
    }
    // Configured but not probed (no cheap ping, e.g. VAPID).
    return {
      label: "Configuré",
      cls: "border-accent/40 bg-accent/10 text-accent",
    };
  }
</script>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="monitor"
    title="Services"
    subtitle="État des services externes dont dépend l’application.">
    {#snippet actions()}
      <button
        onclick={load}
        disabled={loading}
        class="btn btn-ghost shrink-0 disabled:opacity-50">
        {loading ? "…" : "Rafraîchir"}
      </button>
    {/snippet}
  </PageHeader>

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if loading && !services}
    <div class="space-y-3">
      {#each { length: 5 } as _, i (i)}
        <div class="card h-16 animate-pulse"></div>
      {/each}
    </div>
  {:else}
    <div class="space-y-8">
      {#each grouped as group (group.area)}
        <section>
          <h2
            class="mb-2 text-xs font-bold tracking-[0.13em] text-dim uppercase">
            {group.area}
          </h2>
          <div class="overflow-hidden rounded-xl border border-border">
            {#each group.items as s, i (s.key)}
              {@const h = health(s)}
              <div
                class="flex items-center gap-3 bg-surface px-4 py-3 {i > 0
                  ? 'border-t border-border'
                  : ''}">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-fg">{s.label}</span>
                    {#if s.required}
                      <span
                        class="rounded-full border border-border px-1.5 py-0.5 text-[0.55rem] font-bold text-dim uppercase">
                        Requis
                      </span>
                    {/if}
                  </div>
                  {#if s.detail}
                    <p class="mt-0.5 text-xs text-dim">
                      {s.detail}
                      {#if !s.configured && s.keyUrl}
                        · <a
                          href={s.keyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
                          Obtenir une clé
                        </a>
                      {/if}
                    </p>
                  {/if}
                </div>
                {#if s.latencyMs !== undefined}
                  <span class="shrink-0 text-xs text-dim tabular-nums">
                    {s.latencyMs} ms
                  </span>
                {/if}
                <span
                  class="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold {h.cls}">
                  {h.label}
                </span>
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>

    {#if checkedAt}
      <p class="mt-6 text-xs text-dim">
        Vérifié à {timeFmt.format(new Date(checkedAt))}.
      </p>
    {/if}
  {/if}
</div>
