<script lang="ts">
  import { goto } from "$app/navigation";
  import { logout } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";

  // Up to two initials from the display name, for the avatar placeholder.
  let initials = $derived(
    (auth.user?.displayName ?? "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join(""),
  );

  // "juillet 2026" — month + year the account was created.
  let memberSince = $derived(
    auth.user
      ? new Intl.DateTimeFormat("fr-FR", {
          month: "long",
          year: "numeric",
        }).format(new Date(auth.user.createdAt))
      : "",
  );

  async function signOut() {
    await logout();
    await goto("/login");
  }
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div class="flex min-w-0 items-center gap-4 sm:flex-1">
        <div
          class="bg-accent/15 font-display text-accent flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold">
          {initials}
        </div>
        <div class="min-w-0">
          <p class="truncate text-lg font-bold">{auth.user.displayName}</p>
          <p class="timecode truncate text-sm">{auth.user.email}</p>
          <p class="text-dim mt-0.5 text-sm">Membre depuis {memberSince}</p>
        </div>
      </div>
      <button class="btn btn-danger w-full sm:w-auto" onclick={signOut}>
        Se déconnecter
      </button>
    </div>
  </section>
{/if}
