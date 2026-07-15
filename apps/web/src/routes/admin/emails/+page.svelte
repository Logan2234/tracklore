<script lang="ts">
  import {
    getAdminEmailTemplates,
    getAdminEmailPreview,
    sendAdminTestEmail,
    ApiError,
  } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import type { MailTemplateInfoDto } from "@tracklore/shared";

  let templates = $state<MailTemplateInfoDto[] | null>(null);
  let smtpConfigured = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let selectedKey = $state<string | null>(null);
  const selectedTemplate = $derived(
    templates?.find((t) => t.key === selectedKey) ?? null,
  );

  /** Editable sample-data values for the selected template, keyed by field key. */
  let fieldValues = $state<Record<string, string>>({});

  let previewSubject = $state<string | null>(null);
  let previewHtml = $state<string | null>(null);
  let previewText = $state<string | null>(null);
  let previewLoading = $state(false);
  let previewTab = $state<"html" | "text">("html");

  let copied = $state(false);
  let previewDebounce: ReturnType<typeof setTimeout> | undefined;

  let testTo = $state("");
  let sending = $state(false);
  let sendResult = $state<{ ok: boolean; message: string } | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      const res = await getAdminEmailTemplates();
      templates = res.templates;
      smtpConfigured = res.smtpConfigured;
      if (templates.length > 0) selectTemplate(templates[0].key);
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Gabarits indisponibles";
    } finally {
      loading = false;
    }
  }

  function selectTemplate(key: string) {
    selectedKey = key;
    sendResult = null;
    const template = templates?.find((t) => t.key === key);
    fieldValues = Object.fromEntries(
      (template?.fields ?? []).map((f) => [f.key, f.default]),
    );
    void loadPreview();
  }

  function onFieldInput(key: string, value: string) {
    fieldValues = { ...fieldValues, [key]: value };
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(() => void loadPreview(), 300);
  }

  async function loadPreview() {
    if (!selectedKey) return;
    previewLoading = true;
    try {
      const preview = await getAdminEmailPreview(selectedKey, fieldValues);
      previewSubject = preview.subject;
      previewHtml = preview.html;
      previewText = preview.text;
    } catch {
      previewSubject = null;
      previewHtml = null;
      previewText = null;
    } finally {
      previewLoading = false;
    }
  }

  async function copyHtml() {
    if (!previewHtml) return;
    await navigator.clipboard.writeText(previewHtml);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  async function sendTest() {
    if (!selectedKey || !testTo) return;
    sending = true;
    sendResult = null;
    try {
      await sendAdminTestEmail(selectedKey, {
        to: testTo,
        values: fieldValues,
      });
      sendResult = { ok: true, message: `Envoyé à ${testTo}.` };
    } catch (err) {
      sendResult = {
        ok: false,
        message: err instanceof ApiError ? err.message : "Échec de l'envoi",
      };
    } finally {
      sending = false;
    }
  }

  $effect(() => {
    void load();
  });
</script>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
  <header class="mb-8">
    <h1
      class="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      <Icon name="mail" class="h-7 w-7 text-accent" />
      Emails
    </h1>
    <p class="mt-1 text-dim">
      Aperçu des gabarits (données d'exemple modifiables) et envoi de test.
    </p>
  </header>

  {#if error}
    <p
      class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  {:else if loading}
    <div class="card h-96 animate-pulse"></div>
  {:else if templates}
    {#if !smtpConfigured}
      <p
        class="mb-6 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-dim">
        SMTP n'est pas configuré — l'aperçu fonctionne, mais l'envoi de test est
        désactivé.
      </p>
    {/if}

    <div class="grid gap-6 md:grid-cols-[220px_1fr]">
      <nav class="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {#each templates as t (t.key)}
          <button
            onclick={() => selectTemplate(t.key)}
            class="shrink-0 rounded-lg px-3 py-2 text-left text-sm font-semibold whitespace-nowrap transition-colors md:whitespace-normal {selectedKey ===
            t.key
              ? 'bg-accent/15 text-accent'
              : 'text-dim hover:bg-surface-2 hover:text-fg'}">
            {t.label}
          </button>
        {/each}
      </nav>

      <div class="min-w-0 space-y-4">
        {#if selectedTemplate && selectedTemplate.fields.length > 0}
          <div class="card grid gap-3 p-4 sm:grid-cols-2">
            {#each selectedTemplate.fields as f (f.key)}
              <div>
                <label
                  for="field-{f.key}"
                  class="mb-1 block text-xs font-semibold text-dim">
                  {f.label}
                </label>
                <input
                  id="field-{f.key}"
                  type="text"
                  value={fieldValues[f.key] ?? f.default}
                  oninput={(e) => onFieldInput(f.key, e.currentTarget.value)}
                  class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
              </div>
            {/each}
          </div>
        {/if}

        <div class="flex items-center justify-between gap-2">
          <div class="flex gap-1">
            <button
              onclick={() => (previewTab = "html")}
              class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {previewTab ===
              'html'
                ? 'bg-accent/15 text-accent'
                : 'text-dim hover:bg-surface-2 hover:text-fg'}">
              HTML
            </button>
            <button
              onclick={() => (previewTab = "text")}
              class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {previewTab ===
              'text'
                ? 'bg-accent/15 text-accent'
                : 'text-dim hover:bg-surface-2 hover:text-fg'}">
              Texte brut
            </button>
          </div>
          <button
            onclick={copyHtml}
            disabled={!previewHtml}
            class="rounded-lg px-3 py-1.5 text-xs font-semibold text-dim transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50">
            {copied ? "Copié !" : "Copier le HTML"}
          </button>
        </div>

        <div
          class="overflow-hidden rounded-xl border border-border bg-surface-2">
          {#if previewLoading}
            <div class="h-96 animate-pulse"></div>
          {:else if previewTab === "html" && previewHtml}
            <iframe
              title="Aperçu de l'email"
              sandbox=""
              srcdoc={previewHtml}
              class="h-[520px] w-full border-0 bg-white"></iframe>
          {:else if previewTab === "text" && previewText}
            <pre
              class="h-[520px] overflow-auto bg-surface p-4 text-xs whitespace-pre-wrap text-fg">{previewSubject
                ? `Sujet : ${previewSubject}\n\n`
                : ""}{previewText}</pre>
          {:else}
            <div class="grid h-96 place-items-center text-sm text-dim">
              Aperçu indisponible.
            </div>
          {/if}
        </div>

        <div class="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <input
            type="email"
            bind:value={testTo}
            placeholder="destinataire@example.com"
            disabled={!smtpConfigured}
            class="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm disabled:opacity-50" />
          <button
            onclick={sendTest}
            disabled={!smtpConfigured || !testTo || sending}
            class="btn-secondary shrink-0 disabled:opacity-50">
            {sending ? "Envoi…" : "Envoyer un test"}
          </button>
        </div>

        {#if sendResult}
          <p
            class="rounded-lg border px-4 py-3 text-sm {sendResult.ok
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-danger/40 bg-danger/10 text-danger'}">
            {sendResult.message}
          </p>
        {/if}
      </div>
    </div>
  {/if}
</div>
