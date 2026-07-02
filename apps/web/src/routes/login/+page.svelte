<script lang="ts">
	import { goto } from '$app/navigation';
	import { login, ApiError } from '$lib/api/client';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		loading = true;
		try {
			await login({ email, password });
			await goto('/library');
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Connexion impossible';
		} finally {
			loading = false;
		}
	}
</script>

<form class="auth-form" onsubmit={submit}>
	<h1>Connexion</h1>
	<input type="email" placeholder="Email" bind:value={email} required />
	<input type="password" placeholder="Mot de passe" bind:value={password} required />
	{#if error}<p class="error">{error}</p>{/if}
	<button type="submit" disabled={loading}>Se connecter</button>
	<p class="meta">Pas encore de compte ? <a href="/register" style="color: var(--accent-strong)">Créer un compte</a></p>
</form>
