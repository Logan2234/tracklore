<script lang="ts">
  // Small stroke-icon set used across the nav and pages. Inherits `currentColor`.
  type IconName =
    | "home"
    | "library"
    | "search"
    | "calendar"
    | "stats"
    | "user"
    | "menu"
    | "sun"
    | "moon"
    | "check"
    | "star"
    | "gamepad"
    | "book"
    | "chevron-left"
    | "chevron-right"
    | "download"
    | "bell"
    | "monitor"
    | "plus"
    | "trash"
    | "x"
    | "eye"
    | "eye-off"
    | "shield"
    | "mail"
    | "database"
    | "gauge"
    | "archive";

  let { name, class: cls = "h-5 w-5" }: { name: IconName; class?: string } =
    $props();
</script>

<svg
  class={cls}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true">
  {#if name === "home"}
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
  {:else if name === "library"}
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  {:else if name === "search"}
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  {:else if name === "calendar"}
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  {:else if name === "stats"}
    <rect x="4" y="12" width="4" height="8" rx="1" />
    <rect x="10" y="7" width="4" height="13" rx="1" />
    <rect x="16" y="10" width="4" height="10" rx="1" />
  {:else if name === "user"}
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  {:else if name === "menu"}
    <path d="M4 6h16M4 12h16M4 18h16" />
  {:else if name === "sun"}
    <circle cx="12" cy="12" r="4" />
    <path
      d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  {:else if name === "moon"}
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  {:else if name === "check"}
    <path d="M5 12.5 10 17.5 20 6.5" />
  {:else if name === "star"}
    <path
      d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  {:else if name === "gamepad"}
    <rect x="2" y="7" width="20" height="10" rx="5" />
    <path d="M7 12h3M8.5 10.5v3M15.5 11h.01M18 13.5h.01" />
  {:else if name === "book"}
    <path
      d="M6 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M4 18h13" />
  {:else if name === "chevron-left"}
    <path d="M15 6l-6 6 6 6" />
  {:else if name === "chevron-right"}
    <path d="M9 6l6 6-6 6" />
  {:else if name === "download"}
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  {:else if name === "bell"}
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10.5 20a1.8 1.8 0 0 0 3 0" />
  {:else if name === "monitor"}
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  {:else if name === "plus"}
    <path d="M12 5v14M5 12h14" />
  {:else if name === "trash"}
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  {:else if name === "x"}
    <path d="M6 6l12 12M18 6 6 18" />
  {:else if name === "eye"}
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  {:else if name === "eye-off"}
    <path
      d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M7.4 7.6C4.7 9.1 3 12 3 12s3.5 7 10 7c1.6 0 3-.4 4.2-1M9.9 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7s-.8 1.6-2.3 3.1" />
  {:else if name === "shield"}
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    <path d="M9.5 12l1.8 1.8L15 10" />
  {:else if name === "mail"}
    <path d="M3 5h18v14H3z" />
    <path d="M3 6l9 7 9-7" />
  {:else if name === "database"}
    <path d="M12 5c4.4 0 8 1.1 8 2.5S16.4 10 12 10s-8-1.1-8-2.5S7.6 5 12 5Z" />
    <path d="M4 7.5V12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V7.5" />
    <path d="M4 12v4.5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V12" />
  {:else if name === "gauge"}
    <path d="M4 16a8 8 0 0 1 16 0" />
    <path d="M12 16l4-5" />
    <circle cx="12" cy="16" r="1.3" />
  {:else if name === "archive"}
    <rect x="3" y="4" width="18" height="5" rx="1.5" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
    <path d="M10 13h4" />
  {/if}
</svg>
