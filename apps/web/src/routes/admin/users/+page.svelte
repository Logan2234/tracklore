<script lang="ts">
  import {
    getAdminUsers,
    getAdminUserSessions,
    revokeAdminUserSession,
    ApiError,
  } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import type { AdminUserDto, SessionDto } from "@tracklore/shared";

  let users = $state<AdminUserDto[] | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let selected = $state<AdminUserDto | null>(null);
  let sessions = $state<SessionDto[] | null>(null);
  let sessionsLoading = $state(false);
  let revoking = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      users = await getAdminUsers();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Utilisateurs indisponibles";
    } finally {
      loading = false;
    }
  }

  async function selectUser(user: AdminUserDto) {
    selected = user;
    sessions = null;
    sessionsLoading = true;
    try {
      sessions = await getAdminUserSessions(user.id);
    } catch {
      sessions = [];
    } finally {
      sessionsLoading = false;
    }
  }

  async function revoke(sessionId: string) {
    if (!selected) return;
    revoking = sessionId;
    try {
      await revokeAdminUserSession(selected.id, sessionId);
      sessions = (sessions ?? []).filter((s) => s.id !== sessionId);
    } finally {
      revoking = null;
    }
  }

  $effect(() => {
    void load();
  });

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
</script>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-8">
    <h1
      class="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      <Icon name="user" class="h-7 w-7 text-accent" />
      Utilisateurs
    </h1>
    <p class="mt-1 text-dim">Comptes enregistrés et sessions actives.</p>
  </header>

  {#if error}
    <p
      class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  {:else if loading}
    <div class="card h-64 animate-pulse"></div>
  {:else if users}
    <div class="grid gap-6 md:grid-cols-[1fr_320px]">
      <div class="overflow-hidden rounded-xl border border-border">
        {#each users as u, i (u.id)}
          <button
            onclick={() => selectUser(u)}
            class="flex w-full items-center gap-3 bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2 {i >
            0
              ? 'border-t border-border'
              : ''} {selected?.id === u.id ? 'bg-surface-2' : ''}">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-display text-sm font-bold text-fg">
              {u.displayName.charAt(0).toUpperCase()}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate font-semibold text-fg">
                  {u.displayName}
                </span>
                {#if u.entitlements.includes("admin")}
                  <span
                    class="rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[0.55rem] font-bold text-accent uppercase">
                    Admin
                  </span>
                {/if}
                {#if !u.emailVerified}
                  <span
                    class="rounded-full border border-border px-1.5 py-0.5 text-[0.55rem] font-bold text-dim uppercase">
                    Non vérifié
                  </span>
                {/if}
              </div>
              <p class="truncate text-xs text-dim">{u.email}</p>
            </div>
            <span class="shrink-0 text-xs text-dim">
              {dateFmt.format(new Date(u.createdAt))}
            </span>
          </button>
        {/each}
        {#if users.length === 0}
          <p class="px-4 py-6 text-center text-sm text-dim">
            Aucun compte enregistré.
          </p>
        {/if}
      </div>

      <div class="card p-4">
        {#if !selected}
          <p class="text-sm text-dim">
            Sélectionne un compte pour voir ses sessions.
          </p>
        {:else}
          <div class="mb-3 flex items-center justify-between gap-2">
            <h2 class="font-semibold text-fg">
              Sessions — {selected.displayName}
            </h2>
            <a
              href="/admin/push?email={encodeURIComponent(selected.email)}"
              title="Envoyer un push de test"
              aria-label="Envoyer un push de test"
              class="shrink-0 rounded-lg p-1.5 text-dim transition-colors hover:bg-surface-2 hover:text-accent">
              <Icon name="bell" class="h-4 w-4" />
            </a>
          </div>
          {#if sessionsLoading}
            <div class="space-y-2">
              {#each { length: 2 } as _, i (i)}
                <div class="h-12 animate-pulse rounded-lg bg-surface-2"></div>
              {/each}
            </div>
          {:else if sessions && sessions.length > 0}
            <ul class="space-y-2">
              {#each sessions as s (s.id)}
                <li
                  class="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-xs font-semibold text-fg">
                      {s.userAgent ?? "Appareil inconnu"}
                    </p>
                    <p class="text-[0.65rem] text-dim">
                      Actif {dateTimeFmt.format(new Date(s.lastUsedAt))}
                    </p>
                  </div>
                  <button
                    onclick={() => revoke(s.id)}
                    disabled={revoking === s.id}
                    aria-label="Révoquer cette session"
                    class="shrink-0 rounded-lg p-1.5 text-dim transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50">
                    <Icon name="trash" class="h-4 w-4" />
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-sm text-dim">Aucune session active.</p>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>
