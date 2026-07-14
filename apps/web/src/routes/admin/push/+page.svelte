<script lang="ts">
  import { sendAdminTestPush, ApiError } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";

  let email = $state("");
  let sending = $state(false);
  let result = $state<{ ok: boolean; message: string } | null>(null);

  $effect(() => {
    if (auth.user && !email) email = auth.user.email;
  });

  async function send() {
    if (!email) return;
    sending = true;
    result = null;
    try {
      await sendAdminTestPush({ email });
      result = {
        ok: true,
        message: `Envoyé aux appareils de ${email} (si un abonnement push existe).`,
      };
    } catch (err) {
      result = {
        ok: false,
        message: err instanceof ApiError ? err.message : "Échec de l'envoi",
      };
    } finally {
      sending = false;
    }
  }
</script>

<div class="mx-auto max-w-xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-8">
    <h1
      class="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      <Icon name="bell" class="h-7 w-7 text-accent" />
      Notifications push
    </h1>
    <p class="mt-1 text-dim">
      Envoie une notification de test à tous les appareils abonnés d'un
      compte.
    </p>
  </header>

  <div class="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
    <input
      type="email"
      bind:value={email}
      placeholder="compte@example.com"
      class="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
    <button
      onclick={send}
      disabled={!email || sending}
      class="btn-secondary shrink-0 disabled:opacity-50">
      {sending ? "Envoi…" : "Envoyer un test"}
    </button>
  </div>

  {#if result}
    <p
      class="mt-4 rounded-lg border px-4 py-3 text-sm {result.ok
        ? 'border-success/40 bg-success/10 text-success'
        : 'border-danger/40 bg-danger/10 text-danger'}">
      {result.message}
    </p>
  {/if}
</div>
