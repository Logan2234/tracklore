<script lang="ts">
  import {
    acceptFollowRequest,
    followUser,
    getFollowRequests,
    getMyFollowers,
    getMyFollowing,
    rejectFollowRequest,
    searchUsers,
    unfollowUser,
  } from "$lib/api/client";
  import Avatar from "$lib/components/Avatar.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import type {
    FollowRequestDto,
    UserSearchResultDto,
    UserSummaryDto,
  } from "@tracklore/shared";

  let query = $state("");
  let results = $state<UserSearchResultDto[]>([]);
  let searching = $state(false);
  let requests = $state<FollowRequestDto[]>([]);
  let busy = $state<string | null>(null);

  // Network view (shown while not searching): who follows you / who you follow.
  let followers = $state<UserSummaryDto[]>([]);
  let following = $state<UserSummaryDto[]>([]);
  let networkTab = $state<"followers" | "following">("following");
  let networkLoading = $state(true);
  const network = $derived(networkTab === "followers" ? followers : following);
  const isSearching = $derived(query.trim().length >= 2);

  let timer: ReturnType<typeof setTimeout>;

  $effect(() => {
    void getFollowRequests().then((r) => (requests = r));
    void Promise.all([getMyFollowers(), getMyFollowing()])
      .then(([f, g]) => {
        followers = f;
        following = g;
      })
      .finally(() => (networkLoading = false));
  });

  function onInput() {
    clearTimeout(timer);
    const q = query.trim();
    if (q.length < 2) {
      results = [];
      searching = false;
      return;
    }
    searching = true;
    timer = setTimeout(async () => {
      try {
        results = await searchUsers(q);
      } finally {
        searching = false;
      }
    }, 250);
  }

  async function toggleFollow(user: UserSearchResultDto) {
    busy = user.id;
    try {
      const rel =
        user.relationship.following || user.relationship.requested
          ? await unfollowUser(user.username)
          : await followUser(user.username);
      results = results.map((u) =>
        u.id === user.id ? { ...u, relationship: rel } : u,
      );
    } finally {
      busy = null;
    }
  }

  async function accept(req: FollowRequestDto) {
    busy = req.id;
    try {
      await acceptFollowRequest(req.id);
      requests = requests.filter((r) => r.id !== req.id);
    } finally {
      busy = null;
    }
  }

  async function reject(req: FollowRequestDto) {
    busy = req.id;
    try {
      await rejectFollowRequest(req.id);
      requests = requests.filter((r) => r.id !== req.id);
    } finally {
      busy = null;
    }
  }

  function followLabel(u: UserSearchResultDto): string {
    if (u.relationship.following) return "Suivi";
    if (u.relationship.requested) return "En attente";
    return u.relationship.isSelf
      ? "Vous"
      : u.profileAccess === "PRIVATE"
        ? "Demander"
        : "Suivre";
  }
</script>

<div class="mx-auto max-w-2xl px-4 py-6 md:py-8">
  <PageHeader
    icon="search"
    title="Communauté"
    subtitle="Trouvez des membres et gérez vos abonnements." />

  {#if requests.length > 0}
    <section class="mb-6">
      <h2 class="text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
        Demandes de suivi
      </h2>
      <ul class="space-y-2">
        {#each requests as req (req.id)}
          <li class="card flex items-center gap-3 p-3">
            <a href="/u/{req.user.username}">
              <Avatar seed={req.user.username} size={40} />
            </a>
            <div class="min-w-0 flex-1">
              <a
                href="/u/{req.user.username}"
                class="block truncate font-semibold hover:underline">
                {req.user.displayName}
              </a>
              <p class="timecode truncate text-xs">@{req.user.username}</p>
            </div>
            <button
              class="btn btn-primary"
              disabled={busy === req.id}
              onclick={() => accept(req)}>
              Accepter
            </button>
            <button
              class="btn btn-ghost"
              disabled={busy === req.id}
              onclick={() => reject(req)}>
              Refuser
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <div class="relative">
    <input
      class="input"
      type="search"
      placeholder="Rechercher un pseudo ou un nom…"
      bind:value={query}
      oninput={onInput} />
  </div>

  <section class="mt-4">
    {#if isSearching}
      <!-- Search results take over the panel while a query is active. -->
      {#if searching}
        <p class="text-dim py-6 text-center text-sm">Recherche…</p>
      {:else if results.length === 0}
        <p class="text-dim py-6 text-center text-sm">Aucun membre trouvé.</p>
      {:else}
        <ul class="space-y-2">
          {#each results as user (user.id)}
            <li class="card flex items-center gap-3 p-3">
              <a href="/u/{user.username}">
                <Avatar seed={user.username} size={40} />
              </a>
              <a href="/u/{user.username}" class="min-w-0 flex-1">
                <p class="truncate font-semibold hover:underline">
                  {user.displayName}
                </p>
                <p class="timecode truncate text-xs">@{user.username}</p>
              </a>
              {#if !user.relationship.isSelf}
                <button
                  class="btn {user.relationship.following ||
                  user.relationship.requested
                    ? 'btn-ghost'
                    : 'btn-primary'}"
                  disabled={busy === user.id}
                  onclick={() => toggleFollow(user)}>
                  {followLabel(user)}
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      <!-- Idle state: your network, so the page is never empty. -->
      <div class="mb-3 flex gap-1">
        <button
          class="chip"
          class:chip-on={networkTab === "following"}
          onclick={() => (networkTab = "following")}>
          Abonnements ({following.length})
        </button>
        <button
          class="chip"
          class:chip-on={networkTab === "followers"}
          onclick={() => (networkTab = "followers")}>
          Abonnés ({followers.length})
        </button>
      </div>

      {#if networkLoading}
        <p class="text-dim py-6 text-center text-sm">Chargement…</p>
      {:else if network.length === 0}
        <p class="text-dim py-6 text-center text-sm">
          {networkTab === "following"
            ? "Vous ne suivez encore personne. Cherchez des membres ci-dessus."
            : "Personne ne vous suit pour l'instant."}
        </p>
      {:else}
        <ul class="space-y-2">
          {#each network as user (user.id)}
            <li class="card flex items-center gap-3 p-3">
              <a href="/u/{user.username}">
                <Avatar seed={user.username} size={40} />
              </a>
              <a href="/u/{user.username}" class="min-w-0 flex-1">
                <p class="truncate font-semibold hover:underline">
                  {user.displayName}
                </p>
                <p class="timecode truncate text-xs">@{user.username}</p>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </section>
</div>
