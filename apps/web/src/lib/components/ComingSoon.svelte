<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";

  // Placeholder hub for a future domain (games, books). Title + sections only,
  // no data — the shape of the page before it's wired to a real backend.
  let {
    icon,
    title,
    subtitle,
    sections,
  }: {
    icon: "gamepad" | "book";
    title: string;
    subtitle: string;
    sections: string[];
  } = $props();
</script>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-8">
    <div class="flex items-center gap-3">
      <span
        class="grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-accent">
        <Icon name={icon} class="h-6 w-6" />
      </span>
      <div class="flex items-baseline gap-3">
        <h1
          class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          {title}
        </h1>
        <span
          class="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim"
          >Bientôt</span>
      </div>
    </div>
    <p class="mt-2 max-w-2xl text-dim">{subtitle}</p>
  </header>

  <div class="flex flex-col gap-8">
    {#each sections as section (section)}
      <section>
        <h2 class="mb-3 font-display text-lg font-bold">{section}</h2>
        <div
          class="grid place-items-center rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-dim">
          Bientôt — cette section se remplira quand {title.toLowerCase()} arriveront.
        </div>
      </section>
    {/each}
  </div>
</div>
