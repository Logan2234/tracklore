<script lang="ts">
  let {
    value = null,
    placeholder = "Notes personnelles…",
    onChange,
  }: {
    value?: string | null;
    placeholder?: string;
    onChange: (value: string | null) => void;
  } = $props();
</script>

<div class="flex flex-col gap-1.5">
  <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase"
    >Prise de note</span>

  <textarea
    rows="3"
    {placeholder}
    class="input bg-surface-2 min-h-16.5 rounded-l-sm text-sm"
    value={value ?? ""}
    onchange={(e) => {
      const raw = e.currentTarget.value.trim();
      onChange(raw === "" ? null : raw);
    }}></textarea>
</div>
