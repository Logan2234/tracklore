import { redirect } from "@sveltejs/kit";
import { auth } from "$lib/auth.svelte";

// "Mon profil" shortcut: bounce to the current user's public profile so the nav
// entry can stay a static href (the username is only known at runtime). Falls
// back to the directory if we somehow don't have a session yet.
export function load() {
  const username = auth.user?.username;
  redirect(307, username ? `/u/${username}` : "/people");
}
