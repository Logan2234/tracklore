<script lang="ts">
  import { ApiError, exportMyData, exportMyDataCsv } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import { toast } from "$lib/toast.svelte";
  import { Domain } from "@tracklore/shared";

  let exporting = $state(false);
  let exportError = $state("");

  function downloadBlob(content: string, mimeType: string, filename: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadExport() {
    exporting = true;
    exportError = "";
    try {
      const data = await exportMyData();
      downloadBlob(
        JSON.stringify(data, null, 2),
        "application/json",
        `tracklore-export-${new Date().toISOString().slice(0, 10)}.json`,
      );
      toast.success("Export terminé.");
    } catch (err) {
      exportError = err instanceof ApiError ? err.message : "Export impossible";
    } finally {
      exporting = false;
    }
  }

  const CSV_DOMAINS: { domain: Domain; label: string; slug: string }[] = [
    { domain: Domain.MEDIA, label: "Films, séries et animés", slug: "media" },
    { domain: Domain.BOOKS, label: "Livres", slug: "books" },
    { domain: Domain.GAMES, label: "Jeux", slug: "games" },
    { domain: Domain.MUSIC, label: "Musique", slug: "music" },
  ];

  let csvExporting = $state<Domain | null>(null);
  let csvError = $state("");

  async function downloadCsv(domain: Domain, slug: string) {
    csvExporting = domain;
    csvError = "";
    try {
      const { csv } = await exportMyDataCsv(domain);
      downloadBlob(
        csv,
        "text/csv",
        `tracklore-${slug}-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast.success("Export terminé.");
    } catch (err) {
      csvError = err instanceof ApiError ? err.message : "Export impossible";
    } finally {
      csvExporting = null;
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

  <div class="mt-5 border-t border-border pt-5">
    <p class="mb-3 text-sm text-dim">
      Ou exporte une bibliothèque en CSV, à plat, pour l'importer ailleurs.
    </p>
    <div class="flex flex-wrap gap-2">
      {#each CSV_DOMAINS as d (d.domain)}
        <button
          class="btn btn-ghost"
          disabled={csvExporting !== null}
          onclick={() => downloadCsv(d.domain, d.slug)}>
          <Icon name="download" class="mr-1.5 inline h-4 w-4" />
          {csvExporting === d.domain ? "Préparation…" : `${d.label} (CSV)`}
        </button>
      {/each}
    </div>
    {#if csvError}
      <p class="mt-2 text-sm text-danger">{csvError}</p>
    {/if}
  </div>
</section>
