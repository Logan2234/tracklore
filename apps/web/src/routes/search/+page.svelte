<script lang="ts">
	import { goto } from '$app/navigation';
	import type { MediaSummaryDto, MediaType } from '@tracklore/shared';
	import { searchCatalog, upsertLibraryEntry, ApiError } from '$lib/api/client';

	const TYPE_TABS: { label: string; value: MediaType | undefined }[] = [
		{ label: 'Tout', value: undefined },
		{ label: 'Films', value: 'MOVIE' },
		{ label: 'Séries', value: 'SERIES' },
		{ label: 'Animés', value: 'ANIME' }
	];

	const TYPE_LABELS: Record<MediaType, string> = {
		MOVIE: 'Film',
		SERIES: 'Série',
		ANIME: 'Animé'
	};

	let query = $state('');
	let type = $state<MediaType | undefined>(undefined);
	let results = $state<MediaSummaryDto[]>([]);
	let searched = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let addingKey = $state<string | null>(null);

	async function submit(event?: SubmitEvent) {
		event?.preventDefault();
		if (!query.trim()) return;
		loading = true;
		error = null;
		try {
			results = (await searchCatalog(query.trim(), type)).results;
			searched = true;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Recherche impossible';
		} finally {
			loading = false;
		}
	}

	function selectType(value: MediaType | undefined) {
		type = value;
		if (searched) void submit();
	}

	async function add(media: MediaSummaryDto, status: 'WATCHING' | 'PLANNED') {
		addingKey = `${media.source}:${media.sourceId}`;
		error = null;
		try {
			const entry = await upsertLibraryEntry({
				source: media.source,
				sourceId: media.sourceId,
				type: media.type,
				status
			});
			await goto(`/library/${entry.id}`);
		} catch (err) {
			error = err instanceof ApiError ? err.message : "Impossible d'ajouter ce média";
		} finally {
			addingKey = null;
		}
	}
</script>

<div class="container">
	<h1>Recherche</h1>

	<form onsubmit={submit} style="display: flex; gap: 0.6rem; margin-bottom: 1rem;">
		<input
			type="search"
			placeholder="Titre d'un film, d'une série, d'un animé…"
			bind:value={query}
			style="flex: 1"
		/>
		<button type="submit" disabled={loading}>Chercher</button>
	</form>

	<div class="tabs">
		{#each TYPE_TABS as tab (tab.label)}
			<button class:active={type === tab.value} onclick={() => selectType(tab.value)}>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if error}<p class="error">{error}</p>{/if}

	{#if loading}
		<p class="meta">Recherche en cours…</p>
	{:else if searched && results.length === 0}
		<p class="meta">Aucun résultat.</p>
	{:else}
		<div class="grid">
			{#each results as media (`${media.source}:${media.sourceId}`)}
				<div class="card">
					{#if media.posterUrl}
						<img class="poster" src={media.posterUrl} alt={media.title} loading="lazy" />
					{:else}
						<div class="poster placeholder">🎬</div>
					{/if}
					<div class="body">
						<span class="title">{media.title}</span>
						<span class="meta">
							<span class="badge accent">{TYPE_LABELS[media.type]}</span>
							{#if media.year}&nbsp;{media.year}{/if}
						</span>
						<div style="display: flex; gap: 0.4rem; margin-top: auto;">
							<button
								style="flex: 1; padding: 0.4rem 0.5rem; font-size: 0.8rem;"
								disabled={addingKey !== null}
								onclick={() => add(media, 'WATCHING')}
							>
								Suivre
							</button>
							<button
								class="ghost"
								style="flex: 1; padding: 0.4rem 0.5rem; font-size: 0.8rem;"
								disabled={addingKey !== null}
								onclick={() => add(media, 'PLANNED')}
							>
								À voir
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
