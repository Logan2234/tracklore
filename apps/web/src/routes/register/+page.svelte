<script lang="ts">
	import { goto } from '$app/navigation';
	import { register, ApiError } from '$lib/api/client';

	let displayName = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		loading = true;
		try {
			await register({ email, password, displayName });
			await goto('/library');
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Inscription impossible';
		} finally {
			loading = false;
		}
	}
</script>

<form class="auth-form" onsubmit={submit}>
	<h1>Créer un compte</h1>
	<input type="text" placeholder="Pseudo" bind:value={displayName} required />
	<input type="email" placeholder="Email" bind:value={email} required />
	<input
		type="password"
		placeholder="Mot de passe (8 caractères min.)"
		bind:value={password}
		minlength="8"
		required
	/>
	{#if error}<p class="error">{error}</p>{/if}
	<button type="submit" disabled={loading}>Créer le compte</button>
	<p class="meta">Déjà inscrit ? <a href="/login" style="color: var(--accent-strong)">Se connecter</a></p>
</form>
