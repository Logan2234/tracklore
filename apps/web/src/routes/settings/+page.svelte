<script lang="ts">
  import { goto } from "$app/navigation";
  import { logout } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { theme } from "$lib/theme.svelte";
  import Icon from "$lib/components/Icon.svelte";

  async function signOut() {
    await logout();
    await goto("/login");
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
  <h1
    class="mb-6 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
    Réglages
  </h1>

  {#if auth.user}
    <!-- Compte -->
    <section class="card mb-5 p-5 md:p-6">
      <h2 class="mb-4 font-display text-lg font-bold">Compte</h2>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="font-semibold">{auth.user.displayName}</p>
          <p class="timecode text-sm">{auth.user.email}</p>
        </div>
        <button class="btn btn-danger" onclick={signOut}>Se déconnecter</button>
      </div>
    </section>

    <!-- Apparence -->
    <section class="card mb-5 p-5 md:p-6">
      <h2 class="mb-1 font-display text-lg font-bold">Apparence</h2>
      <p class="mb-4 text-sm text-dim">Thème de l’interface.</p>
      <div class="flex gap-2">
        <button
          class="chip inline-flex items-center gap-2"
          class:chip-on={theme.mode === "light"}
          onclick={() => theme.mode !== "light" && theme.toggle()}>
          <Icon name="sun" class="h-4 w-4" /> Clair
        </button>
        <button
          class="chip inline-flex items-center gap-2"
          class:chip-on={theme.mode === "dark"}
          onclick={() => theme.mode !== "dark" && theme.toggle()}>
          <Icon name="moon" class="h-4 w-4" /> Sombre
        </button>
      </div>
    </section>

    <!-- Import -->
    <section class="card p-5 md:p-6">
      <h2 class="mb-1 font-display text-lg font-bold">Import</h2>
      <p class="mb-4 text-sm text-dim">
        Importe ton historique depuis une autre appli.
      </p>
      <a
        href="/settings/import"
        class="flex items-center gap-3 rounded-lg border border-border bg-bg p-4 transition-colors hover:border-accent hover:bg-surface-2">
        <Icon name="download" class="h-6 w-6 text-accent" />
        <span class="flex-1">
          <span class="block font-semibold">Import TV Time</span>
          <span class="text-sm text-dim">
            Réconciliation interactive, prévisualisation avant écriture.
          </span>
        </span>
        <Icon name="chevron-right" class="h-5 w-5 text-dim" />
      </a>
    </section>
  {/if}
</div>
