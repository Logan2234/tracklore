<script lang="ts">
  import { goto } from "$app/navigation";
  import { register, ApiError } from "$lib/api/client";

  let displayName = $state("");
  let email = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    loading = true;
    try {
      await register({ email, password, displayName });
      await goto("/");
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Inscription impossible";
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
      <p class="mt-2 text-sm text-dim">
        Suis tout ce que tu regardes, au même endroit.
      </p>
    </div>

    <form onsubmit={submit} class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">Créer un compte</h1>
      <input
        type="text"
        placeholder="Pseudo"
        bind:value={displayName}
        required
        class="input" />
      <input
        type="email"
        placeholder="Email"
        bind:value={email}
        required
        class="input" />
      <input
        type="password"
        placeholder="Mot de passe (8 caractères min.)"
        bind:value={password}
        minlength="8"
        required
        class="input" />
      {#if error}<p class="text-sm text-danger">{error}</p>{/if}
      <button type="submit" class="btn btn-primary" disabled={loading}>
        {loading ? "Création…" : "Créer le compte"}
      </button>
      <p class="text-center text-sm text-dim">
        Déjà inscrit ?
        <a href="/login" class="font-semibold text-accent hover:underline"
          >Se connecter</a>
      </p>
    </form>
  </div>
</div>
