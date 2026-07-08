<script lang="ts">
  import { goto } from "$app/navigation";
  import { ApiError, deleteAccount, exportMyData } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";

  // --- Export ---
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
    } catch (err) {
      exportError = err instanceof ApiError ? err.message : "Export impossible";
    } finally {
      exporting = false;
    }
  }

  // --- Suppression du compte (irréversible) ---
  let showDeleteModal = $state(false);
  let deletePasswordInput = $state("");
  let deleteError = $state("");
  let deleteSaving = $state(false);

  function openDeleteModal() {
    deletePasswordInput = "";
    deleteError = "";
    showDeleteModal = true;
  }

  async function confirmDeleteAccount() {
    deleteError = "";
    deleteSaving = true;
    try {
      await deleteAccount({ currentPassword: deletePasswordInput });
      await goto("/login");
    } catch (err) {
      deleteError =
        err instanceof ApiError ? err.message : "Suppression impossible";
    } finally {
      deleteSaving = false;
    }
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
  <div class="mb-6 flex items-center gap-3">
    <a href="/account" class="text-dim hover:text-fg" aria-label="Retour">
      <Icon name="chevron-left" class="h-5 w-5" />
    </a>
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Mes données
    </h1>
  </div>

  <!-- Export -->
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="mb-1 font-display text-lg font-bold">Exporter</h2>
    <p class="mb-4 text-sm text-dim">
      Télécharge une copie complète de tes données — profil, bibliothèque et
      historique de visionnage — au format JSON.
    </p>
    <button
      class="btn btn-primary"
      disabled={exporting}
      onclick={downloadExport}>
      <Icon name="download" class="mr-1.5 inline h-4 w-4" />
      {exporting ? "Préparation…" : "Télécharger mes données (JSON)"}
    </button>
    {#if exportError}
      <p class="mt-2 text-sm text-danger">{exportError}</p>
    {/if}
  </section>

  <!-- Zone de danger -->
  <section class="card border-danger/40 p-5 md:p-6">
    <h2 class="mb-1 font-display text-lg font-bold text-danger">
      Zone de danger
    </h2>
    <p class="mb-4 text-sm text-dim">
      La suppression du compte efface définitivement ton profil, ta
      bibliothèque, ton historique de visionnage et tes notifications. Cette
      action est irréversible.
    </p>
    <button class="btn btn-danger" onclick={openDeleteModal}>
      Supprimer mon compte
    </button>
  </section>

  {#if showDeleteModal}
    <Modal
      title="Supprimer le compte"
      onclose={() => (showDeleteModal = false)}>
      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => {
          e.preventDefault();
          confirmDeleteAccount();
        }}>
        <p class="text-sm text-dim">
          Ton compte et toutes les données associées — bibliothèque, historique
          de visionnage, notes et notifications — seront définitivement
          supprimés. Cette action ne peut pas être annulée.
        </p>
        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold">
            Confirme avec ton mot de passe
          </span>
          <input
            type="password"
            class="input"
            autocomplete="current-password"
            bind:value={deletePasswordInput} />
        </label>
        {#if deleteError}
          <p class="text-sm text-danger">{deleteError}</p>
        {/if}
        <div class="mt-2 flex justify-end gap-2">
          <button
            type="button"
            class="btn btn-ghost"
            onclick={() => (showDeleteModal = false)}>
            Annuler
          </button>
          <button
            type="submit"
            class="btn btn-danger"
            disabled={deleteSaving || !deletePasswordInput}>
            {deleteSaving ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </form>
    </Modal>
  {/if}
</div>
