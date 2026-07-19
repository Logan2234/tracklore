<script lang="ts">
  import { getAdminStats, getAdminTrends, ApiError } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Icon from "$lib/components/Icon.svelte";
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

  const mediaCache = $derived(
    stats ? stats.cache.mediaByType.reduce((sum, m) => sum + m.count, 0) : 0,
  );

  // Whole-instance catalogue size, across every domain — the hero figure.
  const totalCatalog = $derived(
    stats
      ? mediaCache +
          stats.cache.totalGames +
          stats.cache.totalBooks +
          stats.cache.totalMusic
      : 0,
  );

  // Four instance-wide headline figures, mixed on purpose (people, catalogue,
  // activity, footprint) so the top of the page reads as a summary, not a list.
  const heroCards = $derived(
    stats
      ? [
          { value: nf.format(stats.accounts.total), label: "Comptes" },
          { value: nf.format(totalCatalog), label: "Titres en cache" },
          {
            value: nf.format(stats.activity.totalEpisodeWatches),
            label: "Visionnages",
          },
          {
            value: formatBytes(stats.databaseBytes),
            label: "Taille de la base",
          },
        ]
      : [],
  );

  type DomainIcon =
    "tv" | "gamepad" | "book" | "music" | "podcast" | "boardgame";

  type DomainCard = {
    domain: Domain;
    icon: DomainIcon;
    label: string;
    cache: number;
    entries: number;
    accounts: number;
    /** Optional breakdown line (e.g. the media type split). */
    sub?: string;
    /** Optional secondary detail line (seasons/episodes, staleness…). */
    hint?: string;
    comingSoon?: boolean;
  };

  // One card per domain — the reorganization: every catalogue/activity number
  // now sits under the domain it describes, rather than in flat mixed grids.
  const domainCards = $derived<DomainCard[]>(
    stats
      ? [
          {
            domain: Domain.MEDIA,
            icon: "tv",
            label: "Vidéo",
            cache: mediaCache,
            entries: stats.activity.totalLibraryEntries,
            accounts: domainCount(Domain.MEDIA),
            sub: `${nf.format(mediaCount(MediaType.MOVIE))} films · ${nf.format(
              mediaCount(MediaType.SERIES),
            )} séries · ${nf.format(mediaCount(MediaType.ANIME))} animés`,
            hint: `${nf.format(stats.cache.totalSeasons)} saisons · ${nf.format(
              stats.cache.totalEpisodes,
            )} ép. · ${nf.format(stats.cache.staleMediaCount)} à rafraîchir`,
          },
          {
            domain: Domain.GAMES,
            icon: "gamepad",
            label: "Jeux",
            cache: stats.cache.totalGames,
            entries: stats.activity.totalGameEntries,
            accounts: domainCount(Domain.GAMES),
          },
          {
            domain: Domain.BOOKS,
            icon: "book",
            label: "Livres",
            cache: stats.cache.totalBooks,
            entries: stats.activity.totalBookEntries,
            accounts: domainCount(Domain.BOOKS),
          },
          {
            domain: Domain.MUSIC,
            icon: "music",
            label: "Musique",
            cache: stats.cache.totalMusic,
            entries: stats.activity.totalMusicEntries,
            accounts: domainCount(Domain.MUSIC),
          },
          {
            domain: Domain.PODCASTS,
            icon: "podcast",
            label: "Podcasts",
            cache: 0,
            entries: 0,
            accounts: domainCount(Domain.PODCASTS),
            comingSoon: true,
          },
          {
            domain: Domain.BOARDGAMES,
            icon: "boardgame",
            label: "Jeux de société",
            cache: 0,
            entries: 0,
            accounts: domainCount(Domain.BOARDGAMES),
            comingSoon: true,
          },
        ]
      : [],
  );
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
      <!-- Vue d'ensemble — instance-wide headline figures. -->
      <section>
        <h2
          class="text-dim mb-3 text-xs font-semibold tracking-wider uppercase">
          Vue d'ensemble
        </h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each heroCards as c (c.label)}
            <div class="card px-4 py-4">
              <p
                class="font-display text-3xl leading-none font-extrabold tabular-nums">
                {c.value}
              </p>
              <p class="text-dim mt-1.5 text-sm">{c.label}</p>
            </div>
          {/each}
        </div>
      </section>

      <!-- Par domaine — catalogue + activité regroupés par univers. -->
      <section>
        <h2
          class="text-dim mb-3 text-xs font-semibold tracking-wider uppercase">
          Par domaine
        </h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {#each domainCards as d (d.domain)}
            <div
              class="card flex flex-col p-4 {d.comingSoon ? 'opacity-70' : ''}">
              <div class="mb-2 flex items-center gap-2">
                <Icon name={d.icon} class="text-accent h-4 w-4 shrink-0" />
                <span class="text-sm font-semibold">{d.label}</span>
                {#if d.comingSoon}
                  <span
                    class="bg-surface-2 text-dim ml-auto rounded-full px-2 py-0.5 text-[0.6rem] font-bold">
                    Bientôt
                  </span>
                {/if}
              </div>

              {#if d.comingSoon}
                <p class="text-dim text-sm">Aucune donnée pour l'instant.</p>
              {:else}
                <p
                  class="font-display text-2xl leading-none font-bold tabular-nums">
                  {nf.format(d.cache)}
                  <span class="text-dim text-sm font-normal">en cache</span>
                </p>
                <p class="text-dim mt-2 text-xs">
                  {nf.format(d.entries)} entrées · {nf.format(d.accounts)} comptes
                </p>
                {#if d.sub}
                  <p class="text-dim mt-1 text-xs">{d.sub}</p>
                {/if}
                {#if d.hint}
                  <p class="text-dim/70 mt-1 text-xs">{d.hint}</p>
                {/if}
              {/if}
            </div>
          {/each}
        </div>
      </section>

      <!-- Activité transverse (non rattachée à un domaine). -->
      <section>
        <h2
          class="text-dim mb-3 text-xs font-semibold tracking-wider uppercase">
          Notifications & appareils
        </h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            value={nf.format(stats.activity.totalNotifications)}
            label="Notifications émises" />
          <StatCard
            value={nf.format(stats.activity.totalPushDevices)}
            label="Appareils push" />
          <StatCard
            value={nf.format(stats.accounts.withPush)}
            label="Comptes avec push" />
        </div>
      </section>

      <!-- Évolution — trends over a selectable period. -->
      <section>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-dim text-xs font-semibold tracking-wider uppercase">
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
              <span class="text-dim text-sm">Titres en cache</span>
              <span class="font-display text-xl font-bold tabular-nums">
                {nf.format(latest(trends.catalogGrowth))}
              </span>
            </div>
            <TrendChart points={trends.catalogGrowth} {period} />
          </div>
          <div class="card p-4">
            <div class="mb-1 flex items-baseline justify-between gap-2">
              <span class="text-dim text-sm">Visionnages</span>
              <span class="font-display text-xl font-bold tabular-nums">
                {nf.format(latest(trends.watchActivity))}
              </span>
            </div>
            <TrendChart points={trends.watchActivity} {period} />
          </div>
          <div class="card p-4">
            <div class="mb-1 flex items-baseline justify-between gap-2">
              <span class="text-dim text-sm">Nouveaux comptes</span>
              <span class="font-display text-xl font-bold tabular-nums">
                {nf.format(latest(trends.newAccounts))}
              </span>
            </div>
            <TrendChart points={trends.newAccounts} {period} />
          </div>
          <div class="card p-4">
            <div class="mb-1 flex items-baseline justify-between gap-2">
              <span class="text-dim text-sm">Notifications</span>
              <span class="font-display text-xl font-bold tabular-nums">
                {nf.format(latest(trends.notifications))}
              </span>
            </div>
            <TrendChart points={trends.notifications} {period} />
          </div>
        </div>
      </section>
    </div>

    <p class="text-dim mt-10 text-xs">
      Dernier rafraîchissement : {dateTimeFmt.format(
        new Date(stats.generatedAt),
      )}
    </p>
  {/if}
</div>
