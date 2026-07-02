<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { logout } from '$lib/api/client';

	async function signOut() {
		await logout();
		await goto('/login');
	}
</script>

<div class="container">
	<h1>Profil</h1>
	{#if auth.user}
		<p>
			<strong>{auth.user.displayName}</strong><br />
			<span class="meta">{auth.user.email}</span>
		</p>
		<button class="danger" onclick={signOut}>Se déconnecter</button>
	{/if}
</div>
