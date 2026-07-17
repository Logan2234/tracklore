<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
</script>

<section class="card mb-5 p-5 md:p-6">
  <h2 class="mb-1 font-display text-lg font-bold">Import</h2>
  <p class="mb-4 text-sm text-dim">
    Retrouve ta bibliothèque en l'important depuis une autre appli.
  </p>
  <a
    href="/account/import"
    class="flex items-center gap-3 rounded-lg border border-border bg-bg p-4 transition-colors hover:border-accent hover:bg-surface-2">
    <Icon name="download" class="h-6 w-6 text-accent" />
    <span class="flex-1">
      <span class="block font-semibold">Sources disponibles</span>
      <span class="text-sm text-dim">
        TV Time, Steam, The StoryGraph — et d'autres à venir.
      </span>
    </span>
    <Icon name="chevron-right" class="h-5 w-5 text-dim" />
  </a>
</section>
