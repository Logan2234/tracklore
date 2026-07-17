<script lang="ts">
  // Generic inline message block. `error` covers the failed-request banners
  // that used to be hand-rolled on every page; `warning`/`info`/`neutral` reuse
  // the same shape for the non-error asides (degraded capability, FYI, muted
  // hint) instead of inventing a new color per case.
  import type { Snippet } from "svelte";

  type Variant = "error" | "warning" | "info" | "neutral";

  const VARIANT_CLASSES: Record<Variant, string> = {
    error: "border-danger/40 bg-danger/10 text-danger",
    warning: "border-accent/40 bg-accent/10 text-accent",
    info: "border-border bg-surface-2 text-fg",
    neutral: "border-border bg-surface-2 text-dim",
  };

  let {
    variant = "info",
    class: cls = "",
    children,
  }: {
    variant?: Variant;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<div
  class="rounded-lg border px-4 py-3 text-sm {VARIANT_CLASSES[variant]} {cls}">
  {@render children()}
</div>
