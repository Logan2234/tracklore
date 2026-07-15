<script lang="ts">
  import { page } from "$app/state";
  import {
    getAdminUsers,
    getAdminPushDevices,
    sendAdminTestPush,
    ApiError,
  } from "$lib/api/client";
  import Combobox from "$lib/components/Combobox.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import type {
    AdminPushDeviceDto,
    AdminPushSendResponseDto,
    AdminUserDto,
  } from "@tracklore/shared";

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
</script>

<div class="mx-auto max-w-xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-8">
    <h1
      class="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      <Icon name="bell" class="h-7 w-7 text-accent" />
      Notifications push
    </h1>
    <p class="mt-1 text-dim">
      Envoie une notification de test aux appareils abonnés d'un compte.
    </p>
  </header>

  <div class="card space-y-4 p-4">
    <div>
      <span class="mb-1 block text-xs font-semibold text-dim">Compte</span>
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
        class="mb-1 block text-xs font-semibold text-dim">
        Titre (optionnel)
      </label>
      <input
        id="admin-push-title"
        type="text"
        bind:value={title}
        placeholder="Tracklore (admin)"
        maxlength="100"
        class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
    </div>

    <div>
      <label
        for="admin-push-body"
        class="mb-1 block text-xs font-semibold text-dim">
        Message (optionnel)
      </label>
      <textarea
        id="admin-push-body"
        bind:value={body}
        placeholder="Ceci est une notification de test envoyée depuis le panel admin."
        maxlength="500"
        rows="2"
        class="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm"
      ></textarea>
    </div>

    {#if !devicesLoading && devices && devices.length === 0}
      <p
        class="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-dim">
        Aucun appareil abonné pour ce compte — l'envoi n'atteindra personne.
      </p>
    {:else if devices && devices.length > 0}
      <div>
        <p class="mb-1.5 text-xs font-semibold text-dim">
          {devices.length} appareil{devices.length > 1 ? "s" : ""} abonné{devices.length >
          1
            ? "s"
            : ""}
        </p>
        <ul class="space-y-1">
          {#each devices as d (d.id)}
            <li
              class="truncate rounded-lg border border-border px-3 py-1.5 text-xs text-dim">
              {d.userAgent ?? "Appareil inconnu"}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <button
      onclick={send}
      disabled={!email || sending}
      class="btn-secondary disabled:opacity-50">
      {sending ? "Envoi…" : "Envoyer un test"}
    </button>
  </div>

  {#if sendError}
    <p
      class="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {sendError}
    </p>
  {:else if result}
    {#if result.subscriptionCount === 0}
      <p
        class="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        Aucun appareil abonné — rien n'a été envoyé.
      </p>
    {:else}
      <div class="mt-4 space-y-2">
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
</div>
