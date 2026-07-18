<script lang="ts">
  // Loading placeholder for simple list-of-cards pages (sessions,
  // notifications, calendar): a few rows shaped like the real cards.
  let { count = 4 }: { count?: number } = $props();
</script>

<div class="flex flex-col gap-2.5">
  {#each { length: count } as _, i (i)}
    <div class="card flex items-center gap-4 p-4">
      <div class="h-9 w-9 shrink-0 skeleton rounded-xl"></div>
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="h-3.5 w-2/5 skeleton rounded"></div>
        <div class="h-3 w-1/4 skeleton rounded"></div>
      </div>
    </div>
  {/each}
</div>
