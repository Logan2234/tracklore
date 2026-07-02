<script lang="ts">
	import type { EntryStatus, LibraryEntryDto, MediaType } from '@tracklore/shared';
	import { listLibrary, ApiError } from '$lib/api/client';

	const STATUS_TABS: { label: string; value: EntryStatus | undefined }[] = [
		{ label: 'Tout', value: undefined },
		{ label: 'En cours', value: 'WATCHING' },
		{ label: 'À voir', value: 'PLANNED' },
		{ label: 'Terminé', value: 'COMPLETED' },
		{ label: 'En pause', value: 'PAUSED' },
		{ label: 'Abandonné', value: 'DROPPED' }
	];

	const TYPE_TABS: { label: string; value: MediaType | undefined }[] = [
		{ label: 'Tous types', value: undefined },
		{ label: 'Films', value: 'MOVIE' },
		{ label: 'Séries', value: 'SERIES' },
		{ label: 'Animés', value: 'ANIME' }
	];

	let status = $state<EntryStatus | undefined>(undefined);
	let type = $state<MediaType | undefined>(undefined);
	let entries = $state<LibraryEntryDto[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		loading = true;
		error = null;
		listLibrary({ status, type })
			.then((result) => {
				entries = result;
			})
			.catch((err) => {
				error = err instanceof ApiError ? err.message : 'Chargement impossible';
			})
			.finally(() => {
				loading = false;
			});
	});
</script>

<div class="container">
	<h1>Ma bibliothèque</h1>

	<div class="tabs">
		{#each STATUS_TABS as tab (tab.label)}
			<button class:active={status === tab.value} onclick={() => (status = tab.value)}>
				{tab.label}
			</button>
		{/each}
	</div>
	<div class="tabs">
		{#each TYPE_TABS as tab (tab.label)}
			<button class:active={type === tab.value} onclick={() => (type = tab.value)}>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if error}<p class="error">{error}</p>{/if}

	{#if loading}
		<p class="meta">Chargement…</p>
	{:else if entries.length === 0}
		<p class="meta">
			Rien ici pour l'instant — ajoute des médias depuis la <a
				href="/search"
				style="color: var(--accent-strong)">recherche</a
			>.
		</p>
	{:else}
		<div class="grid">
			{#each entries as entry (entry.id)}
				<a class="card" href={`/library/${entry.id}`}>
					{#if entry.mediaItem.posterUrl}
						<img class="poster" src={entry.mediaItem.posterUrl} alt={entry.mediaItem.title} loading="lazy" />
					{:else}
						<div class="poster placeholder">🎬</div>
					{/if}
					<div class="body">
						<span class="title">
							{#if entry.favorite}⭐&nbsp;{/if}{entry.mediaItem.title}
						</span>
						{#if entry.progress}
							<div class="progress">
								<div
									style={`width: ${Math.round((entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100)}%`}
								></div>
							</div>
							<span class="meta">
								{entry.progress.watchedEpisodes}/{entry.progress.totalEpisodes} épisodes
							</span>
						{:else if entry.rating !== null}
							<span class="meta">Note : {entry.rating}/10</span>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
