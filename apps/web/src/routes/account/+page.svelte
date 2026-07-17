<script lang="ts">
  import { getAdminVersion } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import AppearanceSection from "./components/AppearanceSection.svelte";
  import CommunicationsSection from "./components/CommunicationsSection.svelte";
  import DangerZoneSection from "./components/DangerZoneSection.svelte";
  import DomainsSection from "./components/DomainsSection.svelte";
  import ExportSection from "./components/ExportSection.svelte";
  import IdentityHeader from "./components/IdentityHeader.svelte";
  import ImportSection from "./components/ImportSection.svelte";
  import ProfileSection from "./components/ProfileSection.svelte";
  import SecuritySection from "./components/SecuritySection.svelte";

  // AdminOnly on the backend — only fetched (and shown) for the admin account.
  let version = $state<string | null>(null);

  $effect(() => {
    if (auth.isAdmin) {
      getAdminVersion()
        .then((v) => (version = v.version))
        .catch(() => {});
    }
  });
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
  <PageHeader icon="user" title="Compte" class="mb-6" />

  {#if auth.user}
    <IdentityHeader />
    <SecuritySection />
    <ProfileSection />
    <DomainsSection />
    <CommunicationsSection />
    <AppearanceSection />
    <ImportSection />
    <ExportSection />
    <DangerZoneSection />
  {/if}

  {#if version}
    <p class="mt-6 text-center text-xs text-dim">Tracklore v{version}</p>
  {/if}
</div>
