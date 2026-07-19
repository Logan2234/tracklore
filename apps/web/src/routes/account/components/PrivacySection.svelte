<script lang="ts">
  import { getPrivacySettings, updatePrivacySettings } from "$lib/api/client";
  import { appConfig } from "$lib/config.svelte";
  import {
    Domain,
    ProfileAccess,
    VisibilityAudience,
    VisibilityFacet,
    type VisibilitySettingsDto,
  } from "@tracklore/shared";

  const ACCESS: { id: ProfileAccess; label: string; desc: string }[] = [
    {
      id: ProfileAccess.PUBLIC,
      label: "Public",
      desc: "Tout le monde peut vous trouver et vous suivre librement.",
    },
    {
      id: ProfileAccess.PRIVATE,
      label: "Privé",
      desc: "Vous validez chaque demande ; seuls vos amis voient votre contenu.",
    },
    {
      id: ProfileAccess.GHOST,
      label: "Figurant",
      desc: "Invisible : personne ne peut vous trouver, vous suivre, ni voir votre activité. Vous pouvez suivre et commenter de façon anonyme.",
    },
  ];

  const DOMAINS: { id: Domain; label: string }[] = [
    { id: Domain.MEDIA, label: "Vidéo" },
    { id: Domain.GAMES, label: "Jeux" },
    { id: Domain.BOOKS, label: "Livres" },
    { id: Domain.MUSIC, label: "Musique" },
  ];

  const FACETS: { id: VisibilityFacet; label: string }[] = [
    { id: VisibilityFacet.LIBRARY, label: "Bibliothèque" },
    { id: VisibilityFacet.ACTIVITY, label: "Activité" },
  ];

  const AUDIENCES: { id: VisibilityAudience; label: string }[] = [
    { id: VisibilityAudience.PUBLIC, label: "Public" },
    { id: VisibilityAudience.FRIENDS, label: "Amis" },
    { id: VisibilityAudience.NONE, label: "Personne" },
  ];

  let settings = $state<VisibilitySettingsDto | null>(null);
  let saving = $state(false);

  $effect(() => {
    void getPrivacySettings().then((s) => (settings = s));
  });

  function audienceOf(
    domain: Domain,
    facet: VisibilityFacet,
  ): VisibilityAudience {
    return (
      settings?.settings.find((s) => s.domain === domain && s.facet === facet)
        ?.audience ?? VisibilityAudience.FRIENDS
    );
  }

  async function setAccess(access: ProfileAccess) {
    if (!settings || settings.profileAccess === access) return;
    saving = true;
    try {
      settings = await updatePrivacySettings({ profileAccess: access });
    } finally {
      saving = false;
    }
  }

  async function setAudience(
    domain: Domain,
    facet: VisibilityFacet,
    audience: VisibilityAudience,
  ) {
    if (!settings) return;
    saving = true;
    try {
      settings = await updatePrivacySettings({
        settings: [{ domain, facet, audience }],
      });
    } finally {
      saving = false;
    }
  }

  let isPrivate = $derived(settings?.profileAccess !== ProfileAccess.PUBLIC);
</script>

{#if appConfig.socialEnabled && settings}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-1 text-lg font-bold">Confidentialité</h2>
    <p class="text-dim mb-4 text-sm">
      Qui peut vous trouver, et ce que les autres voient de vous.
    </p>

    <!-- Profile access: the authN layer. -->
    <div class="mb-2 flex flex-wrap gap-2">
      {#each ACCESS as a (a.id)}
        <button
          class="chip"
          class:chip-on={settings.profileAccess === a.id}
          disabled={saving}
          onclick={() => setAccess(a.id)}>
          {a.label}
        </button>
      {/each}
    </div>
    <p class="text-dim mb-5 text-sm">
      {ACCESS.find((a) => a.id === settings?.profileAccess)?.desc}
    </p>

    {#if settings.profileAccess !== ProfileAccess.GHOST}
      <!-- Visibility matrix: the authZ layer, per domain × facet. -->
      <div class="divide-border divide-y">
        {#each DOMAINS as d (d.id)}
          <div class="py-4 first:pt-0">
            <p class="mb-2 font-semibold">{d.label}</p>
            <div class="space-y-2">
              {#each FACETS as f (f.id)}
                {@const current = audienceOf(d.id, f.id)}
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-dim text-sm">{f.label}</span>
                  <div class="flex gap-1.5">
                    {#each AUDIENCES as aud (aud.id)}
                      {@const capped =
                        isPrivate && aud.id === VisibilityAudience.PUBLIC}
                      <button
                        class="chip !px-3 !py-1 text-xs"
                        class:chip-on={current === aud.id}
                        disabled={saving || capped}
                        title={capped
                          ? "Un profil privé ne peut pas exposer au public."
                          : undefined}
                        onclick={() => setAudience(d.id, f.id, aud.id)}>
                        {aud.label}
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
      <p class="text-dim mt-4 text-xs">
        Vos notes privées restent toujours privées. Les reviews et commentaires
        que vous publiez ont leur propre portée, choisie à la publication.
      </p>
    {/if}
  </section>
{/if}
