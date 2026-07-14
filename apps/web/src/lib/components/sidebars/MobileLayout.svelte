<script lang="ts">
  import BottomNavigation from "./BottomNavigation.svelte";
  import MobileDrawer from "./MobileDrawer.svelte";

  let { children } = $props();
</script>

<div class="min-h-screen">
  <main
    class="
      min-h-screen
      pb-[calc(4.5rem+env(safe-area-inset-bottom))]
    ">
    {@render children()}
  </main>

  <BottomNavigation />

  <MobileDrawer />
</div>
