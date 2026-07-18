<script lang="ts">
  import { ApiError, exportMyData } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import { toast } from "$lib/toast.svelte";

  let exporting = $state(false);
  let exportError = $state("");

  async function downloadExport() {
    exporting = true;
    exportError = "";
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tracklore-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export terminé.");
    } catch (err) {
      exportError = err instanceof ApiError ? err.message : "Export impossible";
    } finally {
      exporting = false;
    }
  }
</script>

<section class="card mb-5 p-5 md:p-6">
  <h2 class="mb-1 font-display text-lg font-bold">Export</h2>
  <p class="mb-4 text-sm text-dim">
    Télécharge une copie complète de tes données — profil, bibliothèque et
    historique de visionnage — au format JSON.
  </p>
  <button class="btn btn-primary" disabled={exporting} onclick={downloadExport}>
    <Icon name="download" class="mr-1.5 inline h-4 w-4" />
    {exporting ? "Préparation…" : "Télécharger mes données (JSON)"}
  </button>
  {#if exportError}
    <p class="mt-2 text-sm text-danger">{exportError}</p>
  {/if}
</section>
