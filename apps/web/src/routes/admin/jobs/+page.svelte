<script lang="ts">
  import { getAdminJobs, runAdminJob, ApiError } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import type { JobDto } from "@tracklore/shared";

  let jobs = $state<JobDto[] | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let running = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      jobs = (await getAdminJobs()).jobs;
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Jobs indisponibles";
    } finally {
      loading = false;
    }
  }

  async function runJob(key: string) {
    running = key;
    error = null;
    try {
      await runAdminJob(key);
      await load();
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Échec du déclenchement";
    } finally {
      running = null;
    }
  }

  $effect(() => {
    if (auth.isAdmin) void load();
  });

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  function durationMs(run: JobDto["runs"][number]): number {
    return (
      new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
    );
  }
</script>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="calendar"
    title="Jobs & tâches"
    subtitle="Historique des scans/rafraîchissements planifiés, déclenchables à la demande.">
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
    <Banner variant="error" class="mb-6">{error}</Banner>
  {/if}

  {#if loading && !jobs}
    <div class="space-y-3">
      {#each { length: 2 } as _, i (i)}
        <div class="card h-40 animate-pulse"></div>
      {/each}
    </div>
  {:else if jobs}
    <div class="space-y-8">
      {#each jobs as job (job.key)}
        {@const last = job.runs[0]}
        <section>
          <div class="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold text-fg">{job.label}</h2>
              <p class="text-xs text-dim">{job.schedule}</p>
            </div>
            <button
              onclick={() => runJob(job.key)}
              disabled={running === job.key}
              class="btn btn-primary shrink-0 text-xs disabled:opacity-50">
              {running === job.key ? "En cours…" : "Lancer maintenant"}
            </button>
          </div>

          {#if last}
            <div
              class="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-dim">
              <span
                class="rounded-full border px-2 py-0.5 font-semibold {last.status ===
                'SUCCESS'
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-danger/40 bg-danger/10 text-danger'}">
                {last.status === "SUCCESS" ? "OK" : "Échec"}
              </span>
              <span
                >Dernier run : {dateFmt.format(new Date(last.startedAt))}</span>
              {#if last.summary}<span>· {last.summary}</span>{/if}
            </div>
          {/if}

          {#if job.runs.length === 0}
            <p
              class="rounded-lg border border-border bg-surface p-4 text-sm text-dim">
              Aucun run enregistré pour l'instant.
            </p>
          {:else}
            <details class="card group">
              <summary
                class="flex cursor-pointer list-none items-center gap-2 rounded-[inherit] bg-surface-2 px-4 py-2.5 text-sm font-semibold group-open:rounded-b-none group-open:border-b group-open:border-border [&::-webkit-details-marker]:hidden">
                <Icon
                  name="chevron-right"
                  class="h-4 w-4 shrink-0 text-dim transition-transform group-open:rotate-90" />
                Historique ({job.runs.length})
              </summary>
              <div class="overflow-hidden rounded-b-[inherit]">
                {#each job.runs as run, i (run.id)}
                  <div
                    class="flex items-center gap-3 bg-surface px-4 py-2.5 text-sm {i >
                    0
                      ? 'border-t border-border'
                      : ''}">
                    <span
                      class="h-2 w-2 shrink-0 rounded-full {run.status ===
                      'SUCCESS'
                        ? 'bg-success'
                        : 'bg-danger'}"
                      aria-hidden="true"></span>
                    <span class="w-32 shrink-0 tabular-nums text-dim">
                      {dateFmt.format(new Date(run.startedAt))}
                    </span>
                    <span class="min-w-0 flex-1 truncate text-fg">
                      {run.status === "FAILURE" ? run.error : run.summary}
                    </span>
                    <span class="shrink-0 text-xs text-dim tabular-nums">
                      {durationMs(run)} ms
                    </span>
                  </div>
                {/each}
              </div>
            </details>
          {/if}
        </section>
      {/each}
    </div>
  {/if}
</div>
