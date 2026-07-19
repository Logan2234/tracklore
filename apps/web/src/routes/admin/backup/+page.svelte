<script lang="ts">
  import {
    ApiError,
    getAdminBackup,
    restoreAdminBackup,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { toast } from "$lib/toast.svelte";

  const CONFIRM_PHRASE = "RESTAURER";

  let downloading = $state(false);
  let downloadError = $state("");
  let lastDownloadedAt = $state<string | null>(null);

  let fileInput = $state<HTMLInputElement | null>(null);
  let pendingFile = $state<File | null>(null);
  let showRestoreModal = $state(false);
  let confirmText = $state("");
  let restoring = $state(false);
  let restoreError = $state("");
  let restoreDone = $state(false);

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    const units = ["Ko", "Mo", "Go"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }
    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`.replace(
      ".",
      ",",
    );
  }

  async function downloadBackup() {
    downloading = true;
    downloadError = "";
    try {
      const { sql, generatedAt } = await getAdminBackup();
      const blob = new Blob([sql], { type: "application/sql" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tracklore-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      lastDownloadedAt = generatedAt;
      toast.success("Sauvegarde téléchargée.");
    } catch (err) {
      downloadError =
        err instanceof ApiError ? err.message : "Sauvegarde impossible";
    } finally {
      downloading = false;
    }
  }

  function pickFile() {
    fileInput?.click();
  }

  function onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) return;
    pendingFile = file;
    confirmText = "";
    restoreError = "";
    restoreDone = false;
    showRestoreModal = true;
  }

  function closeRestoreModal() {
    if (restoring) return;
    showRestoreModal = false;
    pendingFile = null;
    if (fileInput) fileInput.value = "";
  }

  async function confirmRestore() {
    if (!pendingFile || confirmText !== CONFIRM_PHRASE) return;
    restoring = true;
    restoreError = "";
    try {
      const sql = await pendingFile.text();
      await restoreAdminBackup({ sql });
      restoreDone = true;
      toast.success("Base de données restaurée.");
    } catch (err) {
      restoreError =
        err instanceof ApiError ? err.message : "Restauration impossible";
    } finally {
      restoring = false;
    }
  }
</script>

<div class="mx-auto max-w-2xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="archive"
    title="Sauvegarde"
    subtitle="Export et restauration complète de la base de données." />

  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-1 text-lg font-bold">Télécharger</h2>
    <p class="text-dim mb-4 text-sm">
      Génère un dump SQL complet de l'instance (comptes, bibliothèques,
      historique…) et le télécharge localement.
    </p>
    <button
      class="btn btn-primary"
      disabled={downloading}
      onclick={downloadBackup}>
      <Icon name="download" class="mr-1.5 inline h-4 w-4" />
      {downloading ? "Génération…" : "Télécharger une sauvegarde (.sql)"}
    </button>
    {#if downloadError}
      <Banner variant="error" class="mt-3">{downloadError}</Banner>
    {:else if lastDownloadedAt}
      <p class="text-dim mt-3 text-xs">
        Dernière sauvegarde générée : {new Date(
          lastDownloadedAt,
        ).toLocaleString("fr-FR")}
      </p>
    {/if}
  </section>

  <section class="card border-danger/40 p-5 md:p-6">
    <h2 class="font-display text-danger mb-1 text-lg font-bold">Restaurer</h2>
    <p class="text-dim mb-4 text-sm">
      Remplace <strong>l'intégralité</strong> de la base de données par le contenu
      d'un fichier de sauvegarde. Toute donnée créée depuis cette sauvegarde sera
      définitivement perdue. Cette action est irréversible.
    </p>
    <input
      bind:this={fileInput}
      type="file"
      accept=".sql"
      class="hidden"
      onchange={onFileSelected} />
    <button class="btn btn-danger" onclick={pickFile}>
      Choisir un fichier à restaurer…
    </button>
  </section>
</div>

{#if showRestoreModal && pendingFile}
  <Modal title="Restaurer la sauvegarde" onclose={closeRestoreModal}>
    {#if restoreDone}
      <Banner variant="info">
        Restauration terminée. Recharge la page pour repartir sur les données
        restaurées.
      </Banner>
      <div class="mt-5 flex justify-end">
        <button class="btn btn-primary" onclick={() => location.reload()}>
          Recharger
        </button>
      </div>
    {:else}
      <p class="text-dim text-sm">
        Fichier sélectionné : <strong class="text-fg"
          >{pendingFile.name}</strong>
        ({formatBytes(pendingFile.size)})
      </p>
      <p class="text-dim mt-3 text-sm">
        Cette action écrase <strong>toutes</strong> les données actuelles de
        l'instance, sans retour en arrière possible. Pour confirmer, tape
        <code class="bg-surface-2 rounded px-1.5 py-0.5 text-xs font-bold"
          >{CONFIRM_PHRASE}</code>
        ci-dessous.
      </p>
      <input
        type="text"
        bind:value={confirmText}
        disabled={restoring}
        placeholder={CONFIRM_PHRASE}
        class="border-border bg-surface mt-3 w-full rounded-lg border px-3 py-2 text-sm" />
      {#if restoreError}
        <Banner variant="error" class="mt-3">{restoreError}</Banner>
      {/if}
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          disabled={restoring}
          onclick={closeRestoreModal}>
          Annuler
        </button>
        <button
          type="button"
          class="btn btn-danger"
          disabled={restoring || confirmText !== CONFIRM_PHRASE}
          onclick={confirmRestore}>
          {restoring ? "Restauration…" : "Restaurer définitivement"}
        </button>
      </div>
    {/if}
  </Modal>
{/if}
