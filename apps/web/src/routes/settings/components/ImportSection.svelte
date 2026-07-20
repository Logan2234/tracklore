<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
</script>

<section class="card mb-5 p-5 md:p-6">
  <h2 class="font-display mb-1 text-lg font-bold">Import</h2>
  <p class="text-dim mb-4 text-sm">
    Retrouve ta bibliothèque en l'important depuis une autre appli.
  </p>
  <a
    href="/settings/import"
    class="border-border bg-bg hover:border-accent hover:bg-surface-2 flex items-center gap-3 rounded-lg border p-4 transition-colors">
    <Icon name="download" class="text-accent h-6 w-6" />
    <span class="flex-1">
      <span class="block font-semibold">Sources disponibles</span>
      <span class="text-dim text-sm">
        TV Time, Steam, The StoryGraph — et d'autres à venir.
      </span>
    </span>
    <Icon name="chevron-right" class="text-dim h-5 w-5" />
  </a>
</section>
