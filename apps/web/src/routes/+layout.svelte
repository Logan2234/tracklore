<script lang="ts">
	import '../app.css';
	import '@fontsource-variable/bricolage-grotesque/wght.css';
	import '@fontsource-variable/hanken-grotesk/wght.css';
	import '@fontsource/space-mono/400.css';
	import '@fontsource/space-mono/700.css';

	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { auth } from '$lib/auth.svelte';
	import { theme } from '$lib/theme.svelte';
	import { initAuth } from '$lib/api/client';
	import Icon from '$lib/components/Icon.svelte';

	let { children } = $props();
	let ready = $state(false);
	let expanded = $state(browser ? localStorage.getItem('tl-rail') === 'open' : false);

	const PUBLIC_ROUTES = ['/login', '/register'];

	type NavItem = { href: string; label: string; icon: 'home' | 'library' | 'search' | 'calendar' | 'stats'; match: (p: string) => boolean };

	const NAV: NavItem[] = [
		{ href: '/', label: 'Accueil', icon: 'home', match: (p) => p === '/' },
		{ href: '/library', label: 'Bibliothèque', icon: 'library', match: (p) => p.startsWith('/library') },
		{ href: '/search', label: 'Recherche', icon: 'search', match: (p) => p.startsWith('/search') },
		{ href: '/calendar', label: 'Calendrier', icon: 'calendar', match: (p) => p.startsWith('/calendar') },
		{ href: '/stats', label: 'Statistiques', icon: 'stats', match: (p) => p.startsWith('/stats') }
	];
	// Mobile bottom bar keeps to five thumb targets; Stats lives in the desktop rail.
	const BOTTOM = NAV.filter((n) => n.icon !== 'stats');

	$effect(() => {
		initAuth().finally(() => {
			ready = true;
		});
	});

	$effect(() => {
		theme.init();
	});

	// Redirect to /login as soon as we know the user is not authenticated.
	$effect(() => {
		if (ready && !auth.isLoggedIn && !PUBLIC_ROUTES.includes(page.url.pathname)) {
			void goto('/login');
		}
	});

	function toggleRail() {
		expanded = !expanded;
		if (browser) localStorage.setItem('tl-rail', expanded ? 'open' : 'closed');
	}

	const initial = $derived((auth.user?.displayName ?? '?').charAt(0).toUpperCase());
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Tracklore</title>
</svelte:head>

{#if ready}
	{#if auth.isLoggedIn}
		<div class="flex min-h-screen">
			<!-- Desktop rail: collapsible icon nav -->
			<aside
				class="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface py-3 transition-[width] duration-200 md:flex {expanded
					? 'w-56 px-3'
					: 'w-16 items-center px-0'}"
			>
				<button
					onclick={toggleRail}
					class="flex h-10 w-10 items-center justify-center rounded-xl text-fg transition-colors hover:bg-surface-2"
					aria-label={expanded ? 'Replier le menu' : 'Déplier le menu'}
					aria-expanded={expanded}
				>
					<Icon name="menu" />
				</button>

				<a
					href="/"
					class="mb-3 flex h-10 items-center font-display font-extrabold text-accent {expanded
						? 'px-2 text-xl'
						: 'w-10 justify-center text-2xl'}"
				>
					{expanded ? 'Tracklore' : 'T'}
				</a>

				<nav class="flex flex-1 flex-col gap-1 {expanded ? '' : 'items-center'}">
					{#each NAV as item (item.href)}
						{@const active = item.match(page.url.pathname)}
						<a
							href={item.href}
							aria-current={active ? 'page' : undefined}
							title={expanded ? undefined : item.label}
							class="flex items-center gap-3 rounded-xl text-sm font-semibold transition-colors {expanded
								? 'px-3 py-2.5'
								: 'h-10 w-10 justify-center'} {active
								? 'bg-accent/15 text-accent'
								: 'text-dim hover:bg-surface-2 hover:text-fg'}"
						>
							<Icon name={item.icon} class="h-5 w-5 shrink-0" />
							{#if expanded}<span>{item.label}</span>{/if}
						</a>
					{/each}
				</nav>

				<button
					onclick={() => theme.toggle()}
					class="flex items-center gap-3 rounded-xl text-sm font-semibold text-dim transition-colors hover:bg-surface-2 hover:text-fg {expanded
						? 'px-3 py-2.5'
						: 'h-10 w-10 justify-center'}"
					aria-label="Changer de thème"
				>
					<Icon name={theme.mode === 'dark' ? 'sun' : 'moon'} class="h-5 w-5 shrink-0" />
					{#if expanded}<span>{theme.mode === 'dark' ? 'Thème clair' : 'Thème sombre'}</span>{/if}
				</button>

				<a
					href="/settings"
					title={expanded ? undefined : auth.user?.displayName}
					class="mt-1 flex items-center gap-3 rounded-xl transition-colors hover:bg-surface-2 {expanded
						? 'px-2 py-2'
						: 'h-10 w-10 justify-center'} {page.url.pathname.startsWith('/settings')
						? 'bg-surface-2'
						: ''}"
				>
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-display text-sm font-bold text-fg"
					>
						{initial}
					</span>
					{#if expanded}
						<span class="min-w-0 truncate text-sm font-semibold text-fg">{auth.user?.displayName}</span>
					{/if}
				</a>
			</aside>

			<!-- Page content -->
			<main class="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
				{@render children()}
			</main>
		</div>

		<!-- Mobile bottom bar -->
		<nav
			class="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
		>
			{#each BOTTOM as item (item.href)}
				{@const active = item.match(page.url.pathname)}
				<a
					href={item.href}
					aria-current={active ? 'page' : undefined}
					class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.62rem] font-semibold {active
						? 'text-accent'
						: 'text-dim'}"
				>
					<Icon name={item.icon} class="h-6 w-6" />
					{item.label}
				</a>
			{/each}
			<a
				href="/settings"
				aria-current={page.url.pathname.startsWith('/settings') ? 'page' : undefined}
				class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.62rem] font-semibold {page.url.pathname.startsWith(
					'/settings'
				)
					? 'text-accent'
					: 'text-dim'}"
			>
				<Icon name="user" class="h-6 w-6" />
				Compte
			</a>
		</nav>
	{:else}
		{@render children()}
	{/if}
{/if}
