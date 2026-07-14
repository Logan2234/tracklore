<script lang="ts">
  import { ApiError, forgotPassword } from "$lib/api/client";

  let email = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);
  let resetUrl = $state<string | null>(null);
  let submitted = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    loading = true;
    try {
      const { token } = await forgotPassword(email);
      resetUrl = token
        ? `${location.origin}/reset-password?token=${token}`
        : null;
      submitted = true;
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Impossible de générer le lien";
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
  <div class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <p class="font-display text-3xl font-extrabold tracking-tight">
        TRACK<span class="text-accent">LORE</span>
      </p>
      <p class="mt-2 text-sm text-dim">Mot de passe oublié.</p>
    </div>

    <div class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">
        Réinitialiser le mot de passe
      </h1>

      {#if !submitted}
        <p class="text-sm text-dim">
          Indique l'email de ton compte. Un lien de réinitialisation sera généré
          (valable 1h) — cette instance n'envoie pas d'email, le lien s'affiche
          directement ici.
        </p>
        <form onsubmit={submit} class="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            bind:value={email}
            required
            class="input" />
          {#if error}<p class="text-sm text-danger">{error}</p>{/if}
          <button type="submit" class="btn btn-primary" disabled={loading}>
            {loading ? "Génération…" : "Générer le lien"}
          </button>
        </form>
      {:else if resetUrl}
        <p class="text-sm text-dim">
          Voici ton lien de réinitialisation, valable 1h :
        </p>
        <a
          href={resetUrl}
          class="break-all text-sm font-semibold text-accent hover:underline">
          {resetUrl}
        </a>
      {:else}
        <p class="text-sm text-dim">
          Si un compte existe avec cet email, un lien aurait été généré ici.
        </p>
      {/if}

      <p class="text-center text-sm text-dim">
        <a href="/login" class="font-semibold text-accent hover:underline"
          >Retour à la connexion</a>
      </p>
    </div>
  </div>
</div>
