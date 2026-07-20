<script lang="ts">
  import {
    createInfiniteQuery,
    createMutation,
    useQueryClient,
    type InfiniteData,
  } from "@tanstack/svelte-query";
  import {
    createComment,
    deleteComment,
    getComments,
    reactToComment,
    reportComment,
    unreactToComment,
    updateComment,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { formatRelative } from "$lib/format";
  import { toast } from "$lib/toast.svelte";
  import {
    COMMENT_EMOTE_DISPLAY,
    COMMENT_TEXT_MAX_LENGTH,
    type CommentDto,
    type CommentEmote,
    type CommentPageDto,
    type CommentTargetType,
  } from "@tracklore/shared";
  import Avatar from "./Avatar.svelte";
  import Icon from "./Icon.svelte";

  let {
    targetType,
    targetId,
  }: { targetType: CommentTargetType; targetId: string } = $props();

  const queryClient = useQueryClient();
  const key = $derived(["comments", targetType, targetId] as const);

  const query = createInfiniteQuery<
    CommentPageDto,
    Error,
    InfiniteData<CommentPageDto>,
    typeof key,
    string | undefined
  >(() => ({
    queryKey: key,
    queryFn: ({ pageParam }) => getComments(targetType, targetId, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Only the currently-open thread polls, and only while the tab is active.
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  }));

  const comments = $derived(query.data?.pages.flatMap((p) => p.comments) ?? []);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: key });
  }

  const createMut = createMutation(() => ({
    mutationFn: createComment,
    onSuccess: invalidate,
  }));
  const updateMut = createMutation(() => ({
    mutationFn: (vars: { id: string; text: string; spoilerTag?: boolean }) =>
      updateComment(vars.id, { text: vars.text, spoilerTag: vars.spoilerTag }),
    onSuccess: invalidate,
  }));
  const deleteMut = createMutation(() => ({
    mutationFn: deleteComment,
    onSuccess: invalidate,
  }));
  const reactMut = createMutation(() => ({
    mutationFn: (vars: { id: string; emote: CommentEmote }) =>
      reactToComment(vars.id, vars.emote),
    onSuccess: invalidate,
  }));
  const unreactMut = createMutation(() => ({
    mutationFn: unreactToComment,
    onSuccess: invalidate,
  }));

  let newText = $state("");
  let newSpoilerTag = $state(false);
  let replyToId = $state<string | null>(null);
  let replyText = $state("");
  let editingId = $state<string | null>(null);
  let editText = $state("");
  let editSpoilerTag = $state(false);
  let reactingId = $state<string | null>(null);
  let revealed = $state<Set<string>>(new Set());
  let ignoreSpoilers = $state(false);

  const allowSpoilerTag = $derived(targetType !== "MUSIC");

  function reveal(id: string) {
    revealed = new Set(revealed).add(id);
  }

  async function submitTop() {
    const text = newText.trim();
    if (!text) return;
    await createMut.mutateAsync({
      targetType,
      targetId,
      text,
      spoilerTag: allowSpoilerTag ? newSpoilerTag : undefined,
    });
    newText = "";
    newSpoilerTag = false;
  }

  async function submitReply(parentId: string) {
    const text = replyText.trim();
    if (!text) return;
    await createMut.mutateAsync({ targetType, targetId, parentId, text });
    replyText = "";
    replyToId = null;
  }

  function startEdit(c: CommentDto) {
    editingId = c.id;
    editText = c.text ?? "";
    editSpoilerTag = c.spoilerTag;
  }

  async function submitEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    await updateMut.mutateAsync({
      id,
      text,
      spoilerTag: allowSpoilerTag ? editSpoilerTag : undefined,
    });
    editingId = null;
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce commentaire ?")) return;
    await deleteMut.mutateAsync(id);
  }

  async function react(id: string, emote: CommentEmote) {
    reactingId = null;
    await reactMut.mutateAsync({ id, emote });
  }

  async function report(id: string) {
    const reason =
      prompt("Pourquoi signaler ce commentaire ? (optionnel)") ?? undefined;
    try {
      await reportComment(id, reason || undefined);
      toast.success("Commentaire signalé.");
    } catch {
      toast.error("Le signalement a échoué.");
    }
  }
</script>

{#snippet reactionRow(c: CommentDto)}
  <div class="mt-2 flex flex-wrap items-center gap-1">
    {#each Object.entries(COMMENT_EMOTE_DISPLAY) as [emote, glyph] (emote)}
      {@const count = c.reactions.find((r) => r.emote === emote)?.count ?? 0}
      {#if count > 0 || c.myReaction === emote}
        <button
          class="rounded-full px-2 py-0.5 text-xs {c.myReaction === emote
            ? 'bg-accent/20 text-accent'
            : 'bg-surface-2 text-dim hover:text-fg'}"
          onclick={() =>
            c.myReaction === emote
              ? unreactMut.mutate(c.id)
              : react(c.id, emote as CommentEmote)}>
          {glyph}
          {count > 0 ? count : ""}
        </button>
      {/if}
    {/each}

    <div class="relative">
      <button
        class="text-dim hover:text-fg hover:bg-surface-2 grid h-6 w-6 place-items-center rounded-full"
        aria-label="Réagir"
        onclick={() => (reactingId = reactingId === c.id ? null : c.id)}>
        <Icon name="plus" class="h-3.5 w-3.5" />
      </button>
      {#if reactingId === c.id}
        <div
          class="bg-surface border-border absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border p-1 shadow-lg">
          {#each Object.entries(COMMENT_EMOTE_DISPLAY) as [emote, glyph] (emote)}
            <button
              class="hover:bg-surface-2 rounded px-1.5 py-1 text-base"
              onclick={() => react(c.id, emote as CommentEmote)}>
              {glyph}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet commentCard(c: CommentDto, isReply: boolean)}
  <div class="card p-3 {isReply ? 'ml-8' : ''}">
    {#if c.deleted}
      <p class="text-dim text-sm italic">Commentaire supprimé.</p>
    {:else if c.masked && !revealed.has(c.id) && !ignoreSpoilers}
      <button
        class="text-dim flex w-full items-center gap-2 rounded-lg py-2 text-sm blur-[6px] transition hover:blur-none"
        onclick={() => reveal(c.id)}>
        <Icon name="eye-off" class="h-4 w-4 shrink-0" />
        Spoiler potentiel — cliquer pour afficher
      </button>
    {:else}
      <div class="flex items-start gap-3">
        <a href="/u/{c.author.username}" class="shrink-0">
          <Avatar seed={c.author.username} size={28} />
        </a>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <a
              href="/u/{c.author.username}"
              class="truncate text-sm font-semibold hover:underline">
              {c.author.displayName}
            </a>
            <span class="timecode text-xs">{formatRelative(c.createdAt)}</span>
            {#if c.edited}
              <span class="text-dim text-xs">· modifié</span>
            {/if}
          </div>

          {#if editingId === c.id}
            <textarea
              class="input mt-1 min-h-16 resize-y text-sm"
              maxlength={COMMENT_TEXT_MAX_LENGTH}
              bind:value={editText}></textarea>
            {#if allowSpoilerTag}
              <label class="mt-1 flex items-center gap-1.5 text-xs">
                <input type="checkbox" bind:checked={editSpoilerTag} />
                Contient un spoiler
              </label>
            {/if}
            <div class="mt-1 flex gap-2">
              <button
                class="btn btn-primary btn-sm"
                onclick={() => submitEdit(c.id)}>
                Enregistrer
              </button>
              <button
                class="btn btn-ghost btn-sm"
                onclick={() => (editingId = null)}>
                Annuler
              </button>
            </div>
          {:else}
            <p class="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
              {c.text}
            </p>
          {/if}

          {@render reactionRow(c)}

          <div class="text-dim mt-1.5 flex items-center gap-3 text-xs">
            {#if !isReply}
              <button
                class="hover:text-fg flex items-center gap-1"
                onclick={() => (replyToId = replyToId === c.id ? null : c.id)}>
                <Icon name="reply" class="h-3.5 w-3.5" />
                Répondre
              </button>
            {/if}
            {#if c.author.id === auth.user?.id}
              <button class="hover:text-fg" onclick={() => startEdit(c)}
                >Éditer</button>
              <button class="hover:text-fg" onclick={() => remove(c.id)}
                >Supprimer</button>
            {:else}
              <button
                class="hover:text-fg flex items-center gap-1"
                onclick={() => report(c.id)}>
                <Icon name="flag" class="h-3.5 w-3.5" />
                Signaler
              </button>
            {/if}
          </div>

          {#if replyToId === c.id}
            <div class="mt-2 flex gap-2">
              <textarea
                class="input min-h-12 resize-y text-sm"
                placeholder="Répondre à @{c.author.username}…"
                maxlength={COMMENT_TEXT_MAX_LENGTH}
                bind:value={replyText}></textarea>
            </div>
            <div class="mt-1 flex gap-2">
              <button
                class="btn btn-primary btn-sm"
                onclick={() => submitReply(c.id)}>
                Répondre
              </button>
              <button
                class="btn btn-ghost btn-sm"
                onclick={() => (replyToId = null)}>
                Annuler
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/snippet}

<section class="mt-6">
  <div class="mb-3 flex items-center justify-between gap-2">
    <h2 class="font-display text-xl font-bold">
      <Icon name="message" class="mr-1 inline h-4 w-4" />
      Commentaires
    </h2>
    {#if allowSpoilerTag}
      <button
        class="text-dim hover:text-fg text-xs underline"
        onclick={() => (ignoreSpoilers = !ignoreSpoilers)}>
        {ignoreSpoilers
          ? "Réactiver le flou spoiler"
          : "Ignorer les spoilers pour cette session"}
      </button>
    {/if}
  </div>

  <div class="mb-4">
    <textarea
      class="input min-h-16 resize-y text-sm"
      placeholder="Ajouter un commentaire…"
      maxlength={COMMENT_TEXT_MAX_LENGTH}
      bind:value={newText}></textarea>
    <div class="mt-1 flex items-center justify-between gap-2">
      {#if allowSpoilerTag}
        <label class="text-dim flex items-center gap-1.5 text-xs">
          <input type="checkbox" bind:checked={newSpoilerTag} />
          Contient un spoiler
        </label>
      {:else}
        <span></span>
      {/if}
      <button
        class="btn btn-primary btn-sm"
        disabled={!newText.trim() || createMut.isPending}
        onclick={submitTop}>
        Publier
      </button>
    </div>
  </div>

  {#if query.isPending}
    <p class="text-dim text-sm">Chargement…</p>
  {:else if comments.length === 0}
    <p class="text-dim text-sm">Aucun commentaire pour l'instant.</p>
  {:else}
    <div class="flex flex-col gap-2">
      {#each comments as c (c.id)}
        {@render commentCard(c, false)}
        {#each c.replies as r (r.id)}
          {@render commentCard(r, true)}
        {/each}
      {/each}
    </div>

    {#if query.hasNextPage}
      <button
        class="btn btn-ghost btn-sm mt-3"
        disabled={query.isFetchingNextPage}
        onclick={() => query.fetchNextPage()}>
        Charger la suite
      </button>
    {/if}
  {/if}
</section>
