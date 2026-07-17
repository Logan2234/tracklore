<script lang="ts">
  import { ApiError, updateMe } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { disablePush, enablePush, isPushSupported } from "$lib/push";

  let notifyError = $state("");

  async function toggleNotify(
    key: "notifyInApp" | "notifyEmail" | "notifyPush",
  ) {
    if (!auth.user) return;
    notifyError = "";
    const value = !auth.user[key];
    try {
      await updateMe(
        key === "notifyInApp"
          ? { notifyInApp: value }
          : key === "notifyEmail"
            ? { notifyEmail: value }
            : { notifyPush: value },
      );
    } catch (err) {
      notifyError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    }
  }

  const pushSupported = isPushSupported();
  let pushBusy = $state(false);

  // Push needs a browser subscription on top of the server flag: subscribe
  // (asks permission) before enabling, unsubscribe after disabling.
  async function togglePush() {
    if (!auth.user || pushBusy) return;
    notifyError = "";
    pushBusy = true;
    try {
      if (auth.user.notifyPush) {
        await disablePush();
        await updateMe({ notifyPush: false });
      } else {
        const ok = await enablePush();
        if (!ok) {
          notifyError =
            "Notifications refusées ou indisponibles sur cet appareil.";
          return;
        }
        await updateMe({ notifyPush: true });
      }
    } catch (err) {
      notifyError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    } finally {
      pushBusy = false;
    }
  }
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="mb-4 font-display text-lg font-bold">Communications</h2>
    <div class="divide-y divide-border">
      <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
        <div>
          <p class="font-semibold">Notifications dans l'app</p>
          <p class="text-sm text-dim">Alerte quand un épisode suivi sort.</p>
        </div>
        <button
          class="chip shrink-0"
          class:chip-on={auth.user.notifyInApp}
          onclick={() => toggleNotify("notifyInApp")}>
          {auth.user.notifyInApp ? "Activé" : "Désactivé"}
        </button>
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <div>
          <p class="font-semibold">Email</p>
          <p class="text-sm text-dim">
            Alerte par email quand un épisode suivi sort.
          </p>
        </div>
        <button
          class="chip shrink-0"
          class:chip-on={auth.user.notifyEmail}
          onclick={() => toggleNotify("notifyEmail")}>
          {auth.user.notifyEmail ? "Activé" : "Désactivé"}
        </button>
      </div>
      <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
        <div>
          <p class="font-semibold">Notifications push</p>
          <p class="text-sm text-dim">
            {#if pushSupported}
              Pour être alerté d’un nouvel épisode même appli fermée.
            {:else}
              Non disponible sur cet appareil ou ce navigateur.
            {/if}
          </p>
        </div>
        <button
          class="chip shrink-0"
          class:chip-on={auth.user.notifyPush}
          disabled={!pushSupported || pushBusy}
          onclick={togglePush}>
          {pushBusy ? "…" : auth.user.notifyPush ? "Activé" : "Désactivé"}
        </button>
      </div>
    </div>
    {#if notifyError}
      <p class="mt-2 text-sm text-danger">{notifyError}</p>
    {/if}
  </section>
{/if}
