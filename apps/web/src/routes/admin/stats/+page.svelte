<script lang="ts">
  import { getAdminStats, getAdminTrends, ApiError } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import StatCard from "$lib/components/StatCard.svelte";
  import TrendChart from "$lib/components/TrendChart.svelte";
  import {
    Domain,
    MediaType,
    type AdminStatsDto,
    type AdminTrendsSeriesDto,
    type TrendPeriod,
  } from "@tracklore/shared";

  let stats = $state<AdminStatsDto | null>(null);
  let trends = $state<AdminTrendsSeriesDto | null>(null);
  let period = $state<TrendPeriod>("week");
  let trendsBusy = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      stats = await getAdminStats();
      trends = stats.trends;
      period = "week";
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Statistiques indisponibles";
    } finally {
      loading = false;
    }
  }

  async function setPeriod(p: TrendPeriod) {
    if (p === period || trendsBusy) return;
    trendsBusy = true;
    error = null;
    try {
      const res = await getAdminTrends(p);
      trends = res.trends;
      period = p;
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Évolution indisponible";
    } finally {
      trendsBusy = false;
    }
  }

  $effect(() => {
    if (auth.isAdmin) void load();
  });

  const nf = new Intl.NumberFormat("fr-FR");
  const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const PERIODS: { value: TrendPeriod; label: string }[] = [
    { value: "day", label: "Jour" },
    { value: "week", label: "Semaine" },
    { value: "month", label: "Mois" },
    { value: "year", label: "Année" },
  ];

  const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
    [MediaType.MOVIE]: "Films",
    [MediaType.SERIES]: "Séries",
    [MediaType.ANIME]: "Animés",
  };

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    const units = ["Ko", "Mo", "Go", "To"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }
    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`.replace(
      ".",
      ",",
    );
  }

  function mediaCount(type: MediaType): number {
    return stats?.cache.mediaByType.find((m) => m.type === type)?.count ?? 0;
  }

  function domainCount(domain: Domain): number {
    return (
      stats?.accounts.byDomain.find((d) => d.domain === domain)?.count ?? 0
    );
  }

  // Latest bucket of a series — the current running total for the catalogue,
  // or the count over the most recent period for the others.
  const latest = (s: AdminTrendsSeriesDto["catalogGrowth"]) =>
    s.length > 0 ? s[s.length - 1].count : 0;
</script>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="stats"
    title="Statistiques"
    subtitle="Vue d'ensemble de l'instance, tous comptes confondus.">
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

  {#if loading && !stats}
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {#each { length: 8 } as _, i (i)}
        <div class="card h-[76px] animate-pulse"></div>
      {/each}
    </div>
  {:else if stats && trends}
    <div class="flex flex-col gap-9">
      <section>
        <h2
          class="mb-3 text-xs font-semibold uppercase tracking-wider text-dim">
          Comptes
        </h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard value={nf.format(stats.accounts.total)} label="Total" />
          <StatCard
            value={nf.format(stats.accounts.withPush)}
            label="Avec push actif" />
          <StatCard
            value="{domainCount(Domain.MEDIA)} / {domainCount(
              Domain.GAMES,
            )} / {domainCount(Domain.BOOKS)} / {domainCount(Domain.MUSIC)}"
            label="Domaines actifs"
            hint="Écrans / Jeux / Livres / Musique" />
        </div>
      </section>

      <section>
        <h2
          class="mb-3 text-xs font-semibold uppercase tracking-wider text-dim">
          Catalogue en cache
        </h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            value={nf.format(mediaCount(MediaType.MOVIE))}
            label={MEDIA_TYPE_LABEL.MOVIE} />
          <StatCard
            value={nf.format(mediaCount(MediaType.SERIES))}
            label={MEDIA_TYPE_LABEL.SERIES} />
          <StatCard
            value={nf.format(mediaCount(MediaType.ANIME))}
            label={MEDIA_TYPE_LABEL.ANIME} />
          <StatCard value={nf.format(stats.cache.totalGames)} label="Jeux" />
          <StatCard value={nf.format(stats.cache.totalBooks)} label="Livres" />
          <StatCard value={nf.format(stats.cache.totalMusic)} label="Albums" />
          <StatCard
            value="{nf.format(stats.cache.totalSeasons)} / {nf.format(
              stats.cache.totalEpisodes,
            )}"
            label="Saisons / épisodes" />
          <StatCard
            value={nf.format(stats.cache.staleMediaCount)}
            label="Cache à rafraîchir"
            hint="Média non synchronisé > 24 h" />
          <StatCard
            value={formatBytes(stats.databaseBytes)}
            label="Taille de la base" />
        </div>
      </section>

      <section>
        <h2
          class="mb-3 text-xs font-semibold uppercase tracking-wider text-dim">
          Activité
        </h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            value={nf.format(stats.activity.totalEpisodeWatches)}
            label="Visionnages"
            hint="Épisodes vus, rediffusions comprises" />
          <StatCard
            value={nf.format(stats.activity.totalNotifications)}
            label="Notifications émises" />
          <StatCard
            value={nf.format(stats.activity.totalPushDevices)}
            label="Appareils push" />
        </div>
      </section>

      <section>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-dim">
            Évolution
          </h2>
          <div class="flex gap-1.5">
            {#each PERIODS as p (p.value)}
              <button
                class="chip"
                class:chip-on={period === p.value}
                disabled={trendsBusy}
                onclick={() => setPeriod(p.value)}>
                {p.label}
              </button>
            {/each}
          </div>
        </div>

        <div
          class="grid gap-3 transition-opacity sm:grid-cols-2"
          class:opacity-50={trendsBusy}>
          <div class="card p-4">
            <div class="mb-1 flex items-baseline justify-between gap-2">
              <span class="text-sm text-dim">Titres en cache</span>
              <span class="font-display text-xl font-bold tabular-nums">
                {nf.format(latest(trends.catalogGrowth))}
              </span>
            </div>
            <TrendChart points={trends.catalogGrowth} {period} />
          </div>
          <div class="card p-4">
            <div class="mb-1 flex items-baseline justify-between gap-2">
              <span class="text-sm text-dim">Visionnages</span>
              <span class="font-display text-xl font-bold tabular-nums">
                {nf.format(latest(trends.watchActivity))}
              </span>
            </div>
            <TrendChart points={trends.watchActivity} {period} />
          </div>
          <div class="card p-4">
            <div class="mb-1 flex items-baseline justify-between gap-2">
              <span class="text-sm text-dim">Nouveaux comptes</span>
              <span class="font-display text-xl font-bold tabular-nums">
                {nf.format(latest(trends.newAccounts))}
              </span>
            </div>
            <TrendChart points={trends.newAccounts} {period} />
          </div>
          <div class="card p-4">
            <div class="mb-1 flex items-baseline justify-between gap-2">
              <span class="text-sm text-dim">Notifications</span>
              <span class="font-display text-xl font-bold tabular-nums">
                {nf.format(latest(trends.notifications))}
              </span>
            </div>
            <TrendChart points={trends.notifications} {period} />
          </div>
        </div>
      </section>
    </div>

    <p class="mt-10 text-xs text-dim">
      Dernier rafraîchissement : {dateTimeFmt.format(
        new Date(stats.generatedAt),
      )}
    </p>
  {/if}
</div>
