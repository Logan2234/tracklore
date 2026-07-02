<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type {
		EntryEpisodesResponseDto,
		EntryStatus,
		LibraryEntryDto
	} from '@tracklore/shared';
	import {
		deleteLibraryEntry,
		getEntryEpisodes,
		getLibraryEntry,
		updateLibraryEntry,
		watchEpisode,
		ApiError
	} from '$lib/api/client';

	const STATUS_OPTIONS: { label: string; value: EntryStatus }[] = [
		{ label: 'En cours', value: 'WATCHING' },
		{ label: 'À voir', value: 'PLANNED' },
		{ label: 'Terminé', value: 'COMPLETED' },
		{ label: 'En pause', value: 'PAUSED' },
		{ label: 'Abandonné', value: 'DROPPED' }
	];

	let entry = $state<LibraryEntryDto | null>(null);
	let episodes = $state<EntryEpisodesResponseDto | null>(null);
	let error = $state<string | null>(null);
	let busyEpisodeId = $state<string | null>(null);

	const entryId = $derived(page.params.entryId ?? '');

	$effect(() => {
		if (!entryId) return;
		Promise.all([getLibraryEntry(entryId), getEntryEpisodes(entryId)])
			.then(([entryResult, episodesResult]) => {
				entry = entryResult;
				episodes = episodesResult;
			})
			.catch((err) => {
				error = err instanceof ApiError ? err.message : 'Chargement impossible';
			});
	});

	async function patch(changes: Parameters<typeof updateLibraryEntry>[1]) {
		if (!entry) return;
		error = null;
		try {
			entry = await updateLibraryEntry(entry.id, changes);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Mise à jour impossible';
		}
	}

	async function markWatched(episodeId: string) {
		busyEpisodeId = episodeId;
		error = null;
		try {
			await watchEpisode(episodeId);
			// Refresh both watch counts and global progress.
			const [entryResult, episodesResult] = await Promise.all([
				getLibraryEntry(entryId),
				getEntryEpisodes(entryId)
			]);
			entry = entryResult;
			episodes = episodesResult;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Impossible de marquer comme vu';
		} finally {
			busyEpisodeId = null;
		}
	}

	async function removeEntry() {
		if (!entry || !confirm(`Retirer « ${entry.mediaItem.title} » de ta bibliothèque ?`)) return;
		await deleteLibraryEntry(entry.id);
		await goto('/library');
	}
</script>

<div class="container">
	{#if error}<p class="error">{error}</p>{/if}

	{#if entry}
		<div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
			{#if entry.mediaItem.posterUrl}
				<img
					src={entry.mediaItem.posterUrl}
					alt={entry.mediaItem.title}
					style="width: 180px; border-radius: var(--radius); align-self: flex-start;"
				/>
			{/if}
			<div style="flex: 1; min-width: 260px;">
				<h1>
					{#if entry.favorite}⭐&nbsp;{/if}{entry.mediaItem.title}
				</h1>

				{#if entry.progress}
					<div class="progress" style="max-width: 320px;">
						<div
							style={`width: ${Math.round((entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100)}%`}
						></div>
					</div>
					<p class="meta">{entry.progress.watchedEpisodes}/{entry.progress.totalEpisodes} épisodes vus</p>
				{/if}

				<div style="display: flex; gap: 0.6rem; flex-wrap: wrap; margin: 1rem 0; align-items: center;">
					<select
						value={entry.status}
						onchange={(e) => patch({ status: e.currentTarget.value as EntryStatus })}
					>
						{#each STATUS_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>

					<label class="meta" style="display: flex; align-items: center; gap: 0.4rem;">
						Note
						<input
							type="number"
							min="0"
							max="10"
							step="0.5"
							style="width: 5rem;"
							value={entry.rating ?? ''}
							onchange={(e) => {
								const raw = e.currentTarget.value;
								void patch({ rating: raw === '' ? null : Number(raw) });
							}}
						/>
					</label>

					<button class="ghost" onclick={() => patch({ favorite: !entry?.favorite })}>
						{entry.favorite ? '★ Favori' : '☆ Favori'}
					</button>
					<button class="danger" onclick={removeEntry}>Retirer</button>
				</div>

				<textarea
					placeholder="Notes personnelles…"
					rows="3"
					style="width: 100%; max-width: 480px;"
					value={entry.notes ?? ''}
					onchange={(e) => {
						const raw = e.currentTarget.value;
						void patch({ notes: raw === '' ? null : raw });
					}}
				></textarea>
			</div>
		</div>

		{#if episodes && episodes.seasons.length > 0}
			<h2>Épisodes</h2>
			{#each episodes.seasons as season (season.id)}
				<div class="season-block">
					<header>{season.title ?? `Saison ${season.number}`}</header>
					{#each season.episodes as episode (episode.id)}
						<div class="episode">
							<span class="num">{episode.number}</span>
							<span class="ep-title">
								{episode.title ?? `Épisode ${episode.number}`}
								{#if episode.watchCount > 1}
									<span class="watched">&nbsp;×{episode.watchCount}</span>
								{/if}
							</span>
							{#if episode.watchCount > 0}
								<span class="watched">Vu ✓</span>
								<button
									class="ghost"
									style="padding: 0.25rem 0.6rem; font-size: 0.75rem;"
									disabled={busyEpisodeId === episode.id}
									onclick={() => markWatched(episode.id)}
								>
									Revoir
								</button>
							{:else}
								<button
									style="padding: 0.25rem 0.6rem; font-size: 0.75rem;"
									disabled={busyEpisodeId === episode.id}
									onclick={() => markWatched(episode.id)}
								>
									Marquer vu
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		{/if}
	{:else if !error}
		<p class="meta">Chargement…</p>
	{/if}
</div>
