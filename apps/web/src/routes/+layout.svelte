<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '$lib/auth.svelte';
	import { initAuth } from '$lib/api/client';

	let { children } = $props();
	let ready = $state(false);

	const PUBLIC_ROUTES = ['/login', '/register'];

	$effect(() => {
		initAuth().finally(() => {
			ready = true;
		});
	});

	// Redirect to /login as soon as we know the user is not authenticated.
	$effect(() => {
		if (ready && !auth.isLoggedIn && !PUBLIC_ROUTES.includes(page.url.pathname)) {
			void goto('/login');
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Tracklore</title>
</svelte:head>

{#if auth.isLoggedIn}
	<nav class="nav">
		<a class="brand" href="/library">Tracklore</a>
		<a href="/library" class:active={page.url.pathname.startsWith('/library')}>Bibliothèque</a>
		<a href="/search" class:active={page.url.pathname.startsWith('/search')}>Recherche</a>
		<span class="spacer"></span>
		<a href="/profile" class:active={page.url.pathname.startsWith('/profile')}>
			{auth.user?.displayName}
		</a>
	</nav>
{/if}

{#if ready}
	{@render children()}
{/if}
