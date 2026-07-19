<script lang="ts">
  import { page } from "$app/state";
  import {
    getAdminPushDevices,
    getAdminStats,
    getAdminUsers,
    sendAdminBroadcastPush,
    sendAdminTestPush,
    ApiError,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { toast } from "$lib/toast.svelte";
  import type {
    AdminPushDeviceDto,
    AdminPushSendResponseDto,
    AdminPushBroadcastResponseDto,
    AdminUserDto,
  } from "@tracklore/shared";

  // --- Individual test ---

  let users = $state<AdminUserDto[]>([]);
  let email = $state(page.url.searchParams.get("email") ?? "");
  let title = $state("");
  let body = $state("");

  const userOptions = $derived(
    users.map((u) => ({
      label: `${u.displayName} <${u.email}>`,
      value: u.email,
    })),
  );

  let devices = $state<AdminPushDeviceDto[] | null>(null);
  let devicesLoading = $state(false);

  let sending = $state(false);
  let result = $state<AdminPushSendResponseDto | null>(null);
  let sendError = $state<string | null>(null);

  async function loadDevices() {
    if (!email) {
      devices = null;
      return;
    }
    devicesLoading = true;
    try {
      devices = await getAdminPushDevices(email);
    } catch {
      devices = null;
    } finally {
      devicesLoading = false;
    }
  }

  async function send() {
    if (!email) return;
    sending = true;
    sendError = null;
    result = null;
    try {
      result = await sendAdminTestPush({
        email,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      await loadDevices();
      await refreshCounts();
      toast.success("Notification de test envoyée.");
    } catch (err) {
      sendError = err instanceof ApiError ? err.message : "Échec de l'envoi";
    } finally {
      sending = false;
    }
  }

  $effect(() => {
    getAdminUsers()
      .then((u) => (users = u))
      .catch(() => {});
  });

  $effect(() => {
    void email;
    result = null;
    sendError = null;
    void loadDevices();
  });

  // --- Broadcast to every account ---

  let accountCount = $state<number | null>(null);
  let deviceCount = $state<number | null>(null);

  async function refreshCounts() {
    try {
      const stats = await getAdminStats();
      accountCount = stats.accounts.withPush;
      deviceCount = stats.activity.totalPushDevices;
    } catch {
      accountCount = null;
      deviceCount = null;
    }
  }

  $effect(() => {
    void refreshCounts();
  });

  let broadcastTitle = $state("");
  let broadcastBody = $state("");
  let showBroadcastConfirm = $state(false);
  let broadcasting = $state(false);
  let broadcastResult = $state<AdminPushBroadcastResponseDto | null>(null);
  let broadcastError = $state<string | null>(null);

  function openBroadcastConfirm() {
    broadcastResult = null;
    broadcastError = null;
    showBroadcastConfirm = true;
  }

  async function confirmBroadcast() {
    broadcasting = true;
    broadcastError = null;
    try {
      broadcastResult = await sendAdminBroadcastPush({
        title: broadcastTitle.trim() || undefined,
        body: broadcastBody.trim() || undefined,
      });
      showBroadcastConfirm = false;
      toast.success("Diffusion envoyée.");
    } catch (err) {
      broadcastError =
        err instanceof ApiError ? err.message : "Échec de la diffusion";
      showBroadcastConfirm = false;
    } finally {
      broadcasting = false;
    }
  }
</script>

<div class="mx-auto max-w-xl px-4 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="bell"
    title="Notifications push"
    subtitle="Envoie une notification de test ou une diffusion générale." />

  <section class="card mb-6 space-y-4 p-4 md:p-5">
    <h2 class="font-display text-lg font-bold">Test individuel</h2>
    <div>
      <span class="text-dim mb-1 block text-xs font-semibold">Compte</span>
      <Combobox
        label="Choisir un compte"
        options={userOptions}
        values={email ? [email] : []}
        searchable
        searchPlaceholder="Rechercher par nom ou email…"
        onChange={(v) => (email = v[0] ?? "")} />
    </div>

    <div>
      <label
        for="admin-push-title"
        class="text-dim mb-1 block text-xs font-semibold">
        Titre (optionnel)
      </label>
      <input
        id="admin-push-title"
        type="text"
        bind:value={title}
        placeholder="Tracklore (admin)"
        maxlength="100"
        class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm" />
    </div>

    <div>
      <label
        for="admin-push-body"
        class="text-dim mb-1 block text-xs font-semibold">
        Message (optionnel)
      </label>
      <textarea
        id="admin-push-body"
        bind:value={body}
        placeholder="Ceci est une notification de test envoyée depuis le panel admin."
        maxlength="500"
        rows="2"
        class="border-border bg-surface w-full resize-none rounded-lg border px-3 py-2 text-sm"
      ></textarea>
    </div>

    {#if !devicesLoading && devices && devices.length === 0}
      <Banner variant="warning">
        Aucun appareil abonné pour ce compte — l'envoi n'atteindra personne.
      </Banner>
    {:else if devices && devices.length > 0}
      <div>
        <p class="text-dim mb-1.5 text-xs font-semibold">
          {devices.length} appareil{devices.length > 1 ? "s" : ""} abonné{devices.length >
          1
            ? "s"
            : ""}
        </p>
        <ul class="space-y-1">
          {#each devices as d (d.id)}
            <li
              class="border-border text-dim truncate rounded-lg border px-3 py-1.5 text-xs">
              {d.userAgent ?? "Appareil inconnu"}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <button
      onclick={send}
      disabled={!email || sending}
      class="btn btn-primary disabled:opacity-50">
      {sending ? "Envoi…" : "Envoyer un test"}
    </button>

    {#if sendError}
      <Banner variant="error">{sendError}</Banner>
    {:else if result}
      {#if result.subscriptionCount === 0}
        <Banner variant="warning">
          Aucun appareil abonné — rien n'a été envoyé.
        </Banner>
      {:else}
        <div class="space-y-2">
          {#each result.results as r, i (i)}
            <p
              class="rounded-lg border px-4 py-2 text-sm {r.ok
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-danger/40 bg-danger/10 text-danger'}">
              {r.userAgent ?? "Appareil inconnu"} —
              {r.ok ? "envoyé" : (r.error ?? "échec")}
            </p>
          {/each}
        </div>
      {/if}
    {/if}
  </section>

  <section class="card border-accent/40 space-y-4 p-4 md:p-5">
    <div>
      <h2 class="font-display text-lg font-bold">Diffusion générale</h2>
      <p class="text-dim mt-1 text-sm">
        Envoie le même message à tous les appareils abonnés, tous comptes
        confondus.
        {#if accountCount !== null && deviceCount !== null}
          Portée actuelle : <strong class="text-fg">{accountCount}</strong>
          compte{accountCount > 1 ? "s" : ""} /
          <strong class="text-fg">{deviceCount}</strong>
          appareil{deviceCount > 1 ? "s" : ""}.
        {/if}
      </p>
    </div>

    <div>
      <label
        for="admin-broadcast-title"
        class="text-dim mb-1 block text-xs font-semibold">
        Titre (optionnel)
      </label>
      <input
        id="admin-broadcast-title"
        type="text"
        bind:value={broadcastTitle}
        placeholder="Tracklore (admin)"
        maxlength="100"
        class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm" />
    </div>

    <div>
      <label
        for="admin-broadcast-body"
        class="text-dim mb-1 block text-xs font-semibold">
        Message (optionnel)
      </label>
      <textarea
        id="admin-broadcast-body"
        bind:value={broadcastBody}
        placeholder="Message envoyé à tous les comptes depuis le panel admin."
        maxlength="500"
        rows="2"
        class="border-border bg-surface w-full resize-none rounded-lg border px-3 py-2 text-sm"
      ></textarea>
    </div>

    <button
      onclick={openBroadcastConfirm}
      disabled={!accountCount}
      class="btn btn-primary disabled:opacity-50">
      Diffuser à tous les comptes
    </button>

    {#if broadcastError}
      <Banner variant="error">{broadcastError}</Banner>
    {:else if broadcastResult}
      <Banner variant={broadcastResult.failureCount === 0 ? "info" : "warning"}>
        Diffusé à {broadcastResult.accountCount} compte{broadcastResult.accountCount >
        1
          ? "s"
          : ""}
        — {broadcastResult.successCount} appareil{broadcastResult.successCount >
        1
          ? "s"
          : ""} atteint{broadcastResult.successCount > 1 ? "s" : ""}
        {#if broadcastResult.failureCount > 0}
          , {broadcastResult.failureCount} échec{broadcastResult.failureCount >
          1
            ? "s"
            : ""}
        {/if}.
      </Banner>
    {/if}
  </section>
</div>

{#if showBroadcastConfirm}
  <ConfirmationModal
    title="Diffuser à tous les comptes ?"
    message={`Cette notification sera envoyée à ${accountCount ?? 0} compte${(accountCount ?? 0) > 1 ? "s" : ""} (${deviceCount ?? 0} appareil${(deviceCount ?? 0) > 1 ? "s" : ""}). Cette action ne peut pas être annulée une fois lancée.`}
    confirmLabel="Diffuser"
    danger
    busy={broadcasting}
    onConfirm={confirmBroadcast}
    onCancel={() => (showBroadcastConfirm = false)} />
{/if}
