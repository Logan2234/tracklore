<script lang="ts">
  import {
    ApiError,
    getAdminReports,
    resolveAdminReport,
  } from "$lib/api/client";
  import { adminReports } from "$lib/admin-reports.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import type { ReportDto, ReportStatus } from "@tracklore/shared";

  const STATUS_LABELS: Record<ReportStatus, string> = {
    PENDING: "En attente",
    RESOLVED: "Résolu",
    DISMISSED: "Rejeté",
  };

  const STATUS_COLORS: Record<ReportStatus, string> = {
    PENDING: "border-accent/40 bg-accent/10 text-accent",
    RESOLVED: "border-success/40 bg-success/10 text-success",
    DISMISSED: "border-border bg-surface-2 text-dim",
  };

  const STATUS_OPTIONS = [
    { label: "En attente", value: "PENDING" },
    ...(Object.keys(STATUS_LABELS) as ReportStatus[])
      .filter((s) => s !== "PENDING")
      .map((s) => ({ label: STATUS_LABELS[s], value: s })),
  ];

  let activeStatus = $state<ReportStatus>("PENDING");
  let reports = $state<ReportDto[]>([]);
  let cursor = $state<string | null>(null);
  let hasMore = $state(false);
  let loading = $state(false);
  let error = $state("");
  let resolvingId = $state<string | null>(null);

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  async function load(reset: boolean) {
    loading = true;
    error = "";
    try {
      const res = await getAdminReports({
        status: activeStatus,
        cursor: reset ? undefined : (cursor ?? undefined),
      });
      reports = reset ? res.reports : [...reports, ...res.reports];
      cursor = res.nextCursor;
      hasMore = !!res.nextCursor;
    } catch (err) {
      error = err instanceof ApiError ? err.message : "File indisponible";
    } finally {
      loading = false;
    }
  }

  function selectStatus(status: ReportStatus) {
    activeStatus = status;
    void load(true);
  }

  async function resolve(id: string, status: "RESOLVED" | "DISMISSED") {
    resolvingId = id;
    try {
      await resolveAdminReport(id, status);
      reports = reports.filter((r) => r.id !== id);
      void adminReports.refresh();
    } catch (err) {
      error = err instanceof ApiError ? err.message : "L'action a échoué";
    } finally {
      resolvingId = null;
    }
  }

  $effect(() => {
    void load(true);
  });
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="flag"
    title="Signalements"
    subtitle="Commentaires (et à terme reviews/profils) signalés par les utilisateurs." />

  <div class="mb-5 flex flex-wrap items-center gap-2">
    <Combobox
      label="Statut"
      options={STATUS_OPTIONS}
      values={[activeStatus]}
      onChange={(v) => selectStatus((v[0] as ReportStatus) || "PENDING")} />
  </div>

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if loading && reports.length === 0}
    <div class="space-y-2">
      {#each { length: 4 } as _, i (i)}
        <div class="card h-20 animate-pulse"></div>
      {/each}
    </div>
  {:else if reports.length === 0}
    <EmptyState>Aucun signalement pour ce statut.</EmptyState>
  {:else}
    <ul class="space-y-2">
      {#each reports as r (r.id)}
        <li class="card p-3.5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-bold {STATUS_COLORS[
                r.status
              ]}">
              {STATUS_LABELS[r.status]}
            </span>
            <span class="text-dim text-xs">{r.targetType}</span>
            <span class="text-dim ml-auto text-xs">
              {dateFmt.format(new Date(r.createdAt))}
            </span>
          </div>

          {#if r.target}
            {#if r.target.href}
              <a
                href={r.target.href}
                class="mt-1.5 block text-sm hover:underline">
                {r.target.label}
              </a>
            {:else}
              <p class="mt-1.5 text-sm">{r.target.label}</p>
            {/if}
          {:else}
            <p class="text-dim mt-1.5 text-sm italic">
              Cible introuvable (supprimée).
            </p>
          {/if}

          <p class="text-dim mt-1 text-xs">
            Signalé par @{r.reporter.username}
            {#if r.reason}· « {r.reason} »{/if}
          </p>

          {#if r.status === "PENDING"}
            <div class="mt-2 flex gap-2">
              <button
                class="btn btn-primary btn-sm"
                disabled={resolvingId === r.id}
                onclick={() => resolve(r.id, "RESOLVED")}>
                Marquer résolu
              </button>
              <button
                class="btn btn-ghost btn-sm"
                disabled={resolvingId === r.id}
                onclick={() => resolve(r.id, "DISMISSED")}>
                Rejeter
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    {#if hasMore}
      <button
        class="btn btn-ghost mt-4 w-full"
        disabled={loading}
        onclick={() => load(false)}>
        {loading ? "Chargement…" : "Charger plus"}
      </button>
    {/if}
  {/if}
</div>
