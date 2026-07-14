<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { initAuth } from "$lib/api/client";
  import favicon from "$lib/assets/favicon.svg";
  import { auth } from "$lib/auth.svelte";
  import DesktopSidebar from "$lib/components/sidebars/DesktopSidebar.svelte";
  import MobileLayout from "$lib/components/sidebars/MobileLayout.svelte";
  import { notifications } from "$lib/notifications.svelte";
  import { theme } from "$lib/theme.svelte";
  import "@fontsource-variable/bricolage-grotesque/wght.css";
  import "@fontsource-variable/hanken-grotesk/wght.css";
  import "@fontsource/space-mono/400.css";
  import "@fontsource/space-mono/700.css";
  import "../app.css";

  let { children } = $props();
  let ready = $state(false);

  const PUBLIC_ROUTES = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ];

  $effect(() => {
    initAuth().finally(() => {
      ready = true;
    });
  });

  $effect(() => {
    theme.init();
  });

  // Once logged in, detect new episodes of tracked shows and load the feed.
  // Domain filtering happens server-side (a MEDIA-disabled user gets no episode
  // notifications), so the feed stays available for other notification types.
  $effect(() => {
    if (ready && auth.isLoggedIn) void notifications.refresh(true);
  });

  // Redirect to /login as soon as we know the user is not authenticated.
  $effect(() => {
    if (
      ready &&
      !auth.isLoggedIn &&
      !PUBLIC_ROUTES.includes(page.url.pathname)
    ) {
      void goto("/login");
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <!-- iOS home-screen icon (ignores the SVG favicon / manifest); required for
       installing the PWA, which is itself a prerequisite for Web Push on iOS. -->
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <title>Tracklore</title>
</svelte:head>

{#if ready && auth.isLoggedIn}
  <div class="hidden md:block">
    <DesktopSidebar>
      {@render children()}
    </DesktopSidebar>
  </div>

  <div class="md:hidden">
    <MobileLayout>
      {@render children()}
    </MobileLayout>
  </div>
{:else if ready}
  {@render children()}
{/if}
