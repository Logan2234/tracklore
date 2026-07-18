<script lang="ts">
  import { ApiError, updateMe } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { Domain } from "@tracklore/shared";

  // Content domains the user composes the app from. Games/Books are still
  // placeholders (no screens yet), but the toggle already drives the nav.
  const DOMAINS: { id: Domain; label: string; desc: string; soon: boolean }[] =
    [
      {
        id: Domain.MEDIA,
        label: "Médias",
        desc: "Films, séries et anime.",
        soon: false,
      },
      { id: Domain.GAMES, label: "Jeux", desc: "Jeux vidéo.", soon: false },
      {
        id: Domain.BOOKS,
        label: "Livres",
        desc: "Romans, BD, mangas.",
        soon: false,
      },
      {
        id: Domain.MUSIC,
        label: "Musique",
        desc: "Albums.",
        soon: false,
      },
    ];

  let domainsError = $state("");

  async function toggleDomain(id: Domain) {
    if (!auth.user) return;
    const current = auth.user.enabledDomains;
    const has = current.includes(id);
    if (has && current.length === 1) return; // keep at least one domain visible
    // Rebuild in canonical order so the stored list stays tidy.
    const next = DOMAINS.map((d) => d.id).filter((d) =>
      d === id ? !has : current.includes(d),
    );
    domainsError = "";
    try {
      await updateMe({ enabledDomains: next });
    } catch (err) {
      domainsError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    }
  }
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="mb-1 font-display text-lg font-bold">Domaines</h2>
    <p class="mb-4 text-sm text-dim">
      Choisis les univers présents dans ton app. Ce que tu masques disparaît de
      la navigation.
    </p>
    <div class="divide-y divide-border">
      {#each DOMAINS as d (d.id)}
        {@const on = auth.user.enabledDomains.includes(d.id)}
        {@const isLast = on && auth.user.enabledDomains.length === 1}
        <div
          class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div>
            <p class="font-semibold">
              {d.label}
              {#if d.soon}
                <span
                  class="ml-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim">
                  Bientôt
                </span>
              {/if}
            </p>
            <p class="text-sm text-dim">{d.desc}</p>
          </div>
          <button
            class="chip shrink-0 disabled:pointer-events-none disabled:opacity-40"
            class:chip-on={on}
            disabled={isLast}
            title={isLast
              ? "Au moins un domaine doit rester actif."
              : undefined}
            onclick={() => toggleDomain(d.id)}>
            {on ? "Activé" : "Désactivé"}
          </button>
        </div>
      {/each}
    </div>
    {#if domainsError}
      <p class="mt-2 text-sm text-danger">{domainsError}</p>
    {/if}
  </section>
{/if}
