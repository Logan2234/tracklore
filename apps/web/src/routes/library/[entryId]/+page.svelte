<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { EntryEpisodesResponseDto, EntryStatus, LibraryEntryDto } from '@tracklore/shared';
	import {
		deleteLibraryEntry,
		getEntryEpisodes,
		getLibraryEntry,
		updateLibraryEntry,
		watchEpisode,
		ApiError
	} from '$lib/api/client';
	import Poster from '$lib/components/Poster.svelte';
	import Icon from '$lib/components/Icon.svelte';

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

	const pct = $derived(
		entry?.progress && entry.progress.totalEpisodes > 0
			? Math.round((entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100)
			: 0
	);
</script>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
	{#if error}
		<p class="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
			{error}
		</p>
	{/if}

	{#if entry}
		<a href="/library" class="mb-5 inline-flex items-center gap-1.5 text-sm text-dim hover:text-fg">
			← Bibliothèque
		</a>

		<div class="flex flex-col gap-6 sm:flex-row">
			<div class="w-40 shrink-0 self-start overflow-hidden rounded-xl border border-border sm:w-48">
				<Poster src={entry.mediaItem.posterUrl} title={entry.mediaItem.title} />
			</div>

			<div class="min-w-0 flex-1">
				<div class="flex items-start gap-3">
					<h1 class="font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
						{entry.mediaItem.title}
					</h1>
					{#if entry.rating !== null}
						<span
							class="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-2 py-1 font-display text-lg font-bold text-accent-fg"
						>
							<span class="font-mono text-[0.55rem] font-bold tracking-widest opacity-75">NOTE</span>
							{entry.rating}
						</span>
					{/if}
				</div>

				{#if entry.progress}
					<div class="mt-4 max-w-sm">
						<div class="h-1.5 overflow-hidden rounded-full bg-surface-2">
							<div class="h-full bg-accent" style={`width: ${pct}%`}></div>
						</div>
						<p class="timecode mt-1.5 text-sm">
							{entry.progress.watchedEpisodes} / {entry.progress.totalEpisodes} épisodes vus
						</p>
					</div>
				{/if}

				<div class="mt-5 flex flex-wrap items-center gap-2.5">
					<select
						class="input w-auto"
						value={entry.status}
						onchange={(e) => patch({ status: e.currentTarget.value as EntryStatus })}
					>
						{#each STATUS_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>

					<label class="flex items-center gap-2 text-sm text-dim">
						Note
						<input
							type="number"
							min="0"
							max="10"
							step="0.5"
							class="input w-20"
							value={entry.rating ?? ''}
							onchange={(e) => {
								const raw = e.currentTarget.value;
								void patch({ rating: raw === '' ? null : Number(raw) });
							}}
						/>
					</label>

					<button class="btn btn-ghost" onclick={() => patch({ favorite: !entry?.favorite })}>
						<Icon name="star" class="h-4 w-4 {entry.favorite ? 'text-accent' : ''}" />
						{entry.favorite ? 'Favori' : 'Favori'}
					</button>
					<button class="btn btn-danger" onclick={removeEntry}>Retirer</button>
				</div>

				<textarea
					placeholder="Notes personnelles…"
					rows="3"
					class="input mt-4 max-w-lg"
					value={entry.notes ?? ''}
					onchange={(e) => {
						const raw = e.currentTarget.value;
						void patch({ notes: raw === '' ? null : raw });
					}}
				></textarea>
			</div>
		</div>

		{#if episodes && episodes.seasons.length > 0}
			<h2 class="mt-10 mb-4 font-display text-xl font-bold">Épisodes</h2>
			<div class="flex flex-col gap-4">
				{#each episodes.seasons as season (season.id)}
					<div class="card">
						<header class="border-b border-border bg-surface-2 px-4 py-2.5 font-display font-semibold">
							{season.title ?? `Saison ${season.number}`}
						</header>
						<ul>
							{#each season.episodes as episode (episode.id)}
								<li class="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
									<span class="timecode w-14 shrink-0 text-sm">
										S{String(season.number).padStart(2, '0')}E{String(episode.number).padStart(2, '0')}
									</span>
									<span class="min-w-0 flex-1 truncate text-sm">
										{episode.title ?? `Épisode ${episode.number}`}
										{#if episode.watchCount > 1}
											<span class="text-success">×{episode.watchCount}</span>
										{/if}
									</span>
									{#if episode.watchCount > 0}
										<span class="inline-flex items-center gap-1 text-xs font-semibold text-success">
											<Icon name="check" class="h-4 w-4" /> Vu
										</span>
										<button
											class="btn btn-ghost px-2.5 py-1 text-xs"
											disabled={busyEpisodeId === episode.id}
											onclick={() => markWatched(episode.id)}
										>
											Revoir
										</button>
									{:else}
										<button
											class="btn btn-primary px-2.5 py-1 text-xs"
											disabled={busyEpisodeId === episode.id}
											onclick={() => markWatched(episode.id)}
										>
											Marquer vu
										</button>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		{/if}
	{:else if !error}
		<p class="timecode text-sm">Chargement…</p>
	{/if}
</div>
