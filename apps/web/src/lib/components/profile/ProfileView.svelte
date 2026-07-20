<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    blockUser,
    followUser,
    getProfile,
    getUserFollowers,
    getUserFollowing,
    logout,
    unblockUser,
    unfollowUser,
  } from "$lib/api/client";
  import { ApiError } from "$lib/api/core";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import AvatarLightbox from "$lib/components/AvatarLightbox.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import ProfileActivity from "$lib/components/ProfileActivity.svelte";
  import type {
    RelationshipDto,
    SocialProfileDto,
    UserSummaryDto,
  } from "@tracklore/shared";

  // Shared body for both /u/[username] (any profile) and /profile (the
  // current user's own, via the isSelf branch below — same data, same card,
  // just the extra self-management actions).
  let { username }: { username: string } = $props();

  const DOMAIN_LABEL: Record<string, string> = {
    MEDIA: "Vidéo",
    GAMES: "Jeux",
    BOOKS: "Livres",
    MUSIC: "Musique",
    PODCASTS: "Podcasts",
    BOARDGAMES: "Jeux de société",
  };

  const DOMAIN_HREF: Record<string, string> = {
    MEDIA: "/media",
    GAMES: "/games",
    BOOKS: "/books",
    MUSIC: "/music",
  };

  let profile = $state<SocialProfileDto | null>(null);
  let notFound = $state(false);
  let loading = $state(true);
  let busy = $state(false);

  $effect(() => {
    // Re-fetch whenever the target username changes.
    const name = username;
    loading = true;
    notFound = false;
    profile = null;
    getProfile(name)
      .then((p) => (profile = p))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) notFound = true;
      })
      .finally(() => (loading = false));
  });

  let rel = $derived<RelationshipDto | null>(profile?.relationship ?? null);

  let memberSince = $derived(
    profile
      ? new Intl.DateTimeFormat("fr-FR", {
          month: "long",
          year: "numeric",
        }).format(new Date(profile.createdAt))
      : "",
  );

  // The primary action label reflects the relationship + the target's access.
  let followLabel = $derived.by(() => {
    if (!rel || !profile) return "";
    if (rel.following) return "Suivi";
    if (rel.requested) return "Demande envoyée";
    return profile.profileAccess === "PRIVATE" ? "Demander à suivre" : "Suivre";
  });

  function applyRelationship(next: RelationshipDto) {
    if (!profile) return;
    // Keep follower count roughly in sync for the common accepted-follow case.
    const wasFollowing = profile.relationship.following;
    profile = {
      ...profile,
      relationship: next,
      followerCount:
        profile.followerCount +
        (next.following && !wasFollowing
          ? 1
          : !next.following && wasFollowing
            ? -1
            : 0),
    };
  }

  async function toggleFollow() {
    if (!profile || busy) return;
    busy = true;
    try {
      const next =
        rel?.following || rel?.requested
          ? await unfollowUser(profile.username)
          : await followUser(profile.username);
      applyRelationship(next);
    } finally {
      busy = false;
    }
  }

  let confirmBlock = $state(false);
  let avatarZoomed = $state(false);

  async function toggleBlock() {
    if (!profile || busy) return;
    // Blocking is consequential (cuts the relationship both ways) — confirm
    // first. Unblocking just restores access, no confirmation needed.
    if (!rel?.blocking) {
      confirmBlock = true;
      return;
    }
    busy = true;
    try {
      const next = await unblockUser(profile.username);
      applyRelationship(next);
    } finally {
      busy = false;
    }
  }

  async function confirmBlockUser() {
    if (!profile || busy) return;
    busy = true;
    try {
      const next = await blockUser(profile.username);
      applyRelationship(next);
    } finally {
      busy = false;
      confirmBlock = false;
    }
  }

  async function signOut() {
    await logout();
    await goto("/login");
  }

  // Followers/following modal, opened from the counts below.
  let connectionsKind = $state<"followers" | "following" | null>(null);
  let connections = $state<UserSummaryDto[]>([]);
  let connectionsLoading = $state(false);

  async function openConnections(kind: "followers" | "following") {
    connectionsKind = kind;
    connectionsLoading = true;
    connections = [];
    try {
      connections = await (kind === "followers"
        ? getUserFollowers(username)
        : getUserFollowing(username));
    } finally {
      connectionsLoading = false;
    }
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:py-8">
  {#if loading}
    <div class="card p-6">
      <div class="flex items-center gap-4">
        <div class="skeleton h-20 w-20 rounded-md"></div>
        <div class="flex-1 space-y-2">
          <div class="skeleton h-5 w-40 rounded"></div>
          <div class="skeleton h-4 w-24 rounded"></div>
        </div>
      </div>
    </div>
  {:else if notFound || !profile}
    <div class="card flex flex-col items-center gap-3 p-10 text-center">
      <p class="font-display text-xl font-bold">Profil introuvable</p>
      <p class="text-dim max-w-sm text-sm">
        Ce profil n'existe pas, ou il n'est pas visible pour vous.
      </p>
      <a href="/" class="btn btn-ghost mt-2">Retour à l'accueil</a>
    </div>
  {:else if profile.locked}
    <!-- Private profile the viewer can't see yet: identity only, under embargo.
         The server withholds bio/counts/library entirely. -->
    <section class="card flex flex-col items-center gap-4 p-8 text-center">
      <div class="relative">
        <div class="blur-[6px] select-none" aria-hidden="true">
          <Avatar seed={profile.username} size={88} />
        </div>
        <div
          class="absolute inset-0 flex items-center justify-center"
          aria-hidden="true">
          <svg
            class="text-dim h-8 w-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      </div>
      <div>
        <h1 class="font-display text-2xl font-extrabold md:text-3xl">
          {profile.displayName}
        </h1>
        <p class="timecode mt-0.5 text-sm">@{profile.username}</p>
      </div>
      <p class="text-dim max-w-sm text-sm leading-relaxed">
        Ce profil est privé. Demandez à suivre {profile.displayName} pour voir sa
        bibliothèque et son activité.
      </p>
      {#if rel && !rel.isSelf}
        <button
          class="btn {rel.requested ? 'btn-ghost' : 'btn-primary'}"
          disabled={busy}
          onclick={toggleFollow}>
          {rel.requested ? "Annuler la demande" : "Demander à suivre"}
        </button>
      {/if}
    </section>
  {:else}
    <!-- Billing block: the person credited, handle set like a film credit. -->
    <section class="card p-5 md:p-6">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-start">
        <button
          type="button"
          class="shrink-0 cursor-zoom-in"
          aria-label="Agrandir l'avatar"
          onclick={() => (avatarZoomed = true)}>
          <Avatar seed={profile.username} size={80} />
        </button>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1
              class="font-display truncate text-2xl font-extrabold md:text-3xl">
              {profile.displayName}
            </h1>
            {#if rel?.isFriend && !rel.isSelf}
              <span class="chip chip-on !py-1 text-xs">Amis</span>
            {:else if rel?.followsYou && !rel.isSelf}
              <span class="chip !py-1 text-xs">Vous suit</span>
            {/if}
          </div>
          <p
            class="text-dim mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
            <span class="timecode">@{profile.username}</span>
            {#if rel?.isSelf && auth.user}
              <span aria-hidden="true">·</span>
              <span>{auth.user.email}</span>
            {/if}
          </p>
          <p class="text-dim mt-1 flex flex-wrap items-center gap-x-2 text-sm">
            <span
              >{profile.profileAccess === "PUBLIC"
                ? "Profil public"
                : profile.profileAccess === "PRIVATE"
                  ? "Profil privé"
                  : "Figurant"}</span>
            <span aria-hidden="true">·</span>
            <span>Membre depuis {memberSince}</span>
          </p>
          {#if profile.bio}
            <p class="mt-3 text-sm leading-relaxed">{profile.bio}</p>
          {/if}

          <!-- Credits: followers / following as quiet mono figures, clickable
               to list who they are. -->
          <div class="mt-4 flex gap-6">
            <button
              type="button"
              class="hover:text-fg"
              onclick={() => openConnections("followers")}>
              <span class="timecode text-fg text-lg font-bold"
                >{profile.followerCount}</span>
              <span class="text-dim ml-1 text-xs tracking-wide uppercase"
                >{profile.followerCount > 1 ? "abonnés" : "abonné"}</span>
            </button>
            <button
              type="button"
              class="hover:text-fg"
              onclick={() => openConnections("following")}>
              <span class="timecode text-fg text-lg font-bold"
                >{profile.followingCount}</span>
              <span class="text-dim ml-1 text-xs tracking-wide uppercase"
                >{profile.followingCount > 1
                  ? "abonnements"
                  : "abonnement"}</span>
            </button>
          </div>
        </div>

        {#if rel && !rel.isSelf}
          <div class="flex shrink-0 gap-2">
            {#if rel.blocking}
              <button
                class="btn btn-ghost"
                disabled={busy}
                onclick={toggleBlock}>
                Débloquer
              </button>
            {:else}
              <button
                class="btn {rel.following || rel.requested
                  ? 'btn-ghost'
                  : 'btn-primary'}"
                disabled={busy}
                onclick={toggleFollow}>
                {followLabel}
              </button>
              <button
                class="btn btn-ghost"
                disabled={busy}
                title="Bloquer"
                aria-label="Bloquer"
                onclick={toggleBlock}>
                Bloquer
              </button>
            {/if}
          </div>
        {:else if rel?.isSelf}
          <div class="flex shrink-0 gap-2">
            <a href="/settings" class="btn btn-ghost">
              <Icon name="gear" class="h-4 w-4" /> Paramètres
            </a>
            <button class="btn btn-danger" onclick={signOut}>
              Se déconnecter
            </button>
          </div>
        {/if}
      </div>
    </section>

    <!-- Per-domain library, gated by the viewer's visibility. -->
    <section class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {#each profile.domains as d (d.domain)}
        {@const href = rel?.isSelf ? DOMAIN_HREF[d.domain] : undefined}
        <svelte:element
          this={href ? "a" : "div"}
          {href}
          class="card p-4 {href
            ? 'hover:border-accent transition-colors'
            : ''}">
          <p class="text-dim text-xs font-semibold tracking-wide uppercase">
            {DOMAIN_LABEL[d.domain] ?? d.domain}
          </p>
          {#if d.visible}
            <p class="timecode text-fg mt-1 text-2xl font-bold">{d.count}</p>
            <p class="text-dim text-xs">
              {d.count > 1 ? "titres" : "titre"}
            </p>
          {:else}
            <p class="text-dim mt-1 text-sm">Privé</p>
          {/if}
        </svelte:element>
      {/each}
    </section>

    <!-- Recent activity (visibility-filtered server-side; self-hides if empty). -->
    <ProfileActivity username={profile.username} />
  {/if}
</div>

{#if connectionsKind}
  <Modal
    title={connectionsKind === "followers" ? "Abonnés" : "Abonnements"}
    onclose={() => (connectionsKind = null)}>
    {#if connectionsLoading}
      <div class="space-y-3">
        {#each { length: 4 } as _, i (i)}
          <div class="flex items-center gap-3">
            <div class="skeleton h-9 w-9 rounded-full"></div>
            <div class="skeleton h-4 w-32 rounded"></div>
          </div>
        {/each}
      </div>
    {:else if connections.length === 0}
      <p class="text-dim text-sm">
        {connectionsKind === "followers"
          ? "Personne ne suit ce profil pour l'instant."
          : "Ce profil ne suit personne pour l'instant."}
      </p>
    {:else}
      <ul class="max-h-96 space-y-1 overflow-y-auto">
        {#each connections as u (u.id)}
          <li>
            <a
              href={`/u/${u.username}`}
              class="hover:bg-surface-2 flex items-center gap-3 rounded-lg p-2"
              onclick={() => (connectionsKind = null)}>
              <Avatar seed={u.username} size={36} />
              <span class="min-w-0">
                <span class="block truncate text-sm font-semibold"
                  >{u.displayName}</span>
                <span class="timecode block truncate text-xs"
                  >@{u.username}</span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </Modal>
{/if}

{#if confirmBlock && profile}
  <ConfirmationModal
    title="Bloquer {profile.displayName}"
    message="{profile.displayName} ne pourra plus vous suivre ni voir votre contenu, et vous ne verrez plus le sien. Vous pourrez débloquer à tout moment."
    confirmLabel="Bloquer"
    danger
    {busy}
    onConfirm={confirmBlockUser}
    onCancel={() => (confirmBlock = false)} />
{/if}

{#if avatarZoomed && profile}
  <AvatarLightbox
    seed={profile.username}
    onClose={() => (avatarZoomed = false)} />
{/if}
