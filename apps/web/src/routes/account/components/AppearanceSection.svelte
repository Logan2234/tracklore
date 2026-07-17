<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import { theme } from "$lib/theme.svelte";
</script>

<section class="card mb-5 p-5 md:p-6">
  <h2 class="mb-1 font-display text-lg font-bold">Apparence</h2>
  <p class="mb-4 text-sm text-dim">Thème de l’interface.</p>
  <div class="flex gap-2">
    <button
      class="chip inline-flex items-center gap-2"
      class:chip-on={theme.mode === "light"}
      onclick={() => theme.mode !== "light" && theme.toggle()}>
      <Icon name="sun" class="h-4 w-4" /> Clair
    </button>
    <button
      class="chip inline-flex items-center gap-2"
      class:chip-on={theme.mode === "dark"}
      onclick={() => theme.mode !== "dark" && theme.toggle()}>
      <Icon name="moon" class="h-4 w-4" /> Sombre
    </button>
  </div>
</section>
