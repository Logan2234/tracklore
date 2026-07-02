<script lang="ts">
  import Poster from "$lib/components/Poster.svelte";

  // Preview data. Wiring: episode `airDate`s across the user's library feed this
  // once a "upcoming episodes" endpoint exists (needs TMDB/TVDB air dates).
  type Slot = { title: string; code: string; epTitle: string; time: string };
  type Day = { label: string; date: string; slots: Slot[] };

  const days: Day[] = [
    {
      label: "Aujourd’hui",
      date: "lun. 2 juil.",
      slots: [
        {
          title: "Severance",
          code: "S02E05",
          epTitle: "Trojan’s Horse",
          time: "21:00",
        },
        { title: "The Bear", code: "S03E08", epTitle: "Ice Chips", time: "—" },
      ],
    },
    {
      label: "Demain",
      date: "mar. 3 juil.",
      slots: [
        {
          title: "Shōgun",
          code: "S01E05",
          epTitle: "Broken to the Fist",
          time: "—",
        },
      ],
    },
    {
      label: "Mercredi",
      date: "mer. 4 juil.",
      slots: [
        {
          title: "Frieren",
          code: "S01E29",
          epTitle: "Aussi ordinaire que possible",
          time: "18:30",
        },
      ],
    },
    {
      label: "Vendredi",
      date: "ven. 6 juil.",
      slots: [
        {
          title: "The Boys",
          code: "S04E07",
          epTitle: "Season Finale",
          time: "—",
        },
        {
          title: "Dan Da Dan",
          code: "S01E02",
          epTitle: "Un ennemi arrive",
          time: "17:00",
        },
      ],
    },
  ];
</script>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-8">
    <div class="flex items-baseline gap-3">
      <h1
        class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        Calendrier
      </h1>
      <span
        class="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim"
        >Aperçu</span>
    </div>
    <p class="mt-1 text-dim">
      Les prochains épisodes de ce que tu suis. Données de démonstration — elles
      se brancheront sur les dates de diffusion réelles.
    </p>
  </header>

  <div class="flex flex-col gap-8">
    {#each days as day (day.date)}
      <section>
        <div class="mb-3 flex items-baseline gap-3 border-b border-border pb-2">
          <h2 class="font-display text-lg font-bold">{day.label}</h2>
          <span class="timecode text-sm">{day.date}</span>
        </div>
        <div class="flex flex-col gap-2.5">
          {#each day.slots as slot (slot.title + slot.code)}
            <div class="card flex items-center gap-4 p-3">
              <div class="w-12 shrink-0 overflow-hidden rounded-md">
                <Poster src={null} title={slot.title} />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate font-display font-semibold">{slot.title}</p>
                <p class="timecode text-sm">{slot.code} · {slot.epTitle}</p>
              </div>
              <span class="timecode shrink-0 text-sm">{slot.time}</span>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>
