<script lang="ts">
  import { page } from "$app/state";
  import {
    blockUser,
    followUser,
    getProfile,
    unblockUser,
    unfollowUser,
  } from "$lib/api/client";
  import { ApiError } from "$lib/api/core";
  import Avatar from "$lib/components/Avatar.svelte";
  import type { RelationshipDto, SocialProfileDto } from "@tracklore/shared";

  const DOMAIN_LABEL: Record<string, string> = {
    MEDIA: "Vidéo",
    GAMES: "Jeux",
    BOOKS: "Livres",
    MUSIC: "Musique",
    PODCASTS: "Podcasts",
    BOARDGAMES: "Jeux de société",
  };

  let username = $derived(page.params.username ?? "");

  let profile = $state<SocialProfileDto | null>(null);
  let notFound = $state(false);
  let loading = $state(true);
  let busy = $state(false);

  $effect(() => {
    // Re-fetch whenever the route username changes.
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

  async function toggleBlock() {
    if (!profile || busy) return;
    busy = true;
    try {
      const next = rel?.blocking
        ? await unblockUser(profile.username)
        : await blockUser(profile.username);
      applyRelationship(next);
    } finally {
      busy = false;
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
      <a href="/people" class="btn btn-ghost mt-2">Rechercher des membres</a>
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
        <Avatar seed={profile.username} size={80} />
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
          <p class="timecode mt-0.5 text-sm">@{profile.username}</p>
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

          <!-- Credits: followers / following as quiet mono figures. -->
          <div class="mt-4 flex gap-6">
            <div>
              <span class="timecode text-fg text-lg font-bold"
                >{profile.followerCount}</span>
              <span class="text-dim ml-1 text-xs tracking-wide uppercase"
                >{profile.followerCount > 1 ? "abonnés" : "abonné"}</span>
            </div>
            <div>
              <span class="timecode text-fg text-lg font-bold"
                >{profile.followingCount}</span>
              <span class="text-dim ml-1 text-xs tracking-wide uppercase"
                >{profile.followingCount > 1
                  ? "abonnements"
                  : "abonnement"}</span>
            </div>
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
          <a href="/account" class="btn btn-ghost shrink-0">Modifier</a>
        {/if}
      </div>
    </section>

    <!-- Per-domain library, gated by the viewer's visibility. -->
    <section class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {#each profile.domains as d (d.domain)}
        <div class="card p-4">
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
        </div>
      {/each}
    </section>
  {/if}
</div>
