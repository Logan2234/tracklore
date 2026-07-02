<script lang="ts">
	// Preview data. Real figures come from aggregating EpisodeWatch rows + entries
	// once a stats endpoint exists.
	const tiles = [
		{ value: '312', unit: 'h', label: 'Heures vues' },
		{ value: '1 248', unit: '', label: 'Épisodes vus' },
		{ value: '37', unit: '', label: 'Séries terminées' },
		{ value: '92', unit: '', label: 'Films vus' }
	];

	// Type split (share of watch time). Category colors kept few and distinct.
	const split = [
		{ label: 'Séries', pct: 58, color: 'var(--accent)' },
		{ label: 'Animés', pct: 27, color: '#4a9db8' },
		{ label: 'Films', pct: 15, color: '#c77da0' }
	];

	const genres = [
		{ label: 'Science-fiction', pct: 100 },
		{ label: 'Drame', pct: 82 },
		{ label: 'Action', pct: 64 },
		{ label: 'Comédie', pct: 41 },
		{ label: 'Thriller', pct: 33 }
	];
</script>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
	<header class="mb-8">
		<div class="flex items-baseline gap-3">
			<h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">Statistiques</h1>
			<span class="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim">Aperçu</span>
		</div>
		<p class="mt-1 text-dim">Ton activité en un coup d’œil. Chiffres de démonstration pour l’instant.</p>
	</header>

	<!-- Stat tiles -->
	<div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each tiles as t (t.label)}
			<div class="card p-4">
				<p class="font-display text-3xl font-extrabold tabular-nums">
					{t.value}<span class="text-lg text-dim">{t.unit}</span>
				</p>
				<p class="timecode mt-1 text-xs uppercase">{t.label}</p>
			</div>
		{/each}
	</div>

	<div class="grid gap-5 md:grid-cols-2">
		<!-- Type split -->
		<section class="card p-5">
			<h2 class="mb-4 font-display text-lg font-bold">Répartition du temps</h2>
			<div class="flex h-3 overflow-hidden rounded-full">
				{#each split as s (s.label)}
					<div style={`width:${s.pct}%;background:${s.color}`}></div>
				{/each}
			</div>
			<ul class="mt-4 flex flex-col gap-2">
				{#each split as s (s.label)}
					<li class="flex items-center gap-2.5 text-sm">
						<span class="h-3 w-3 rounded-sm" style={`background:${s.color}`}></span>
						<span class="flex-1">{s.label}</span>
						<span class="timecode">{s.pct} %</span>
					</li>
				{/each}
			</ul>
		</section>

		<!-- Top genres -->
		<section class="card p-5">
			<h2 class="mb-4 font-display text-lg font-bold">Genres favoris</h2>
			<ul class="flex flex-col gap-3">
				{#each genres as g (g.label)}
					<li>
						<div class="mb-1 flex justify-between text-sm">
							<span>{g.label}</span>
						</div>
						<div class="h-2 overflow-hidden rounded-full bg-surface-2">
							<div class="h-full rounded-full bg-accent" style={`width:${g.pct}%`}></div>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	</div>
</div>
