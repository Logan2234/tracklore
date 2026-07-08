<script lang="ts">
  import { Domain } from "@tracklore/shared";
  import { goto } from "$app/navigation";
  import {
    ApiError,
    changeEmail,
    changePassword,
    checkUsernameAvailable,
    logout,
    updateMe,
    updateUsername,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { theme } from "$lib/theme.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";

  // Up to two initials from the display name, for the avatar placeholder.
  let initials = $derived(
    (auth.user?.displayName ?? "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join(""),
  );

  // "juillet 2026" — month + year the account was created.
  let memberSince = $derived(
    auth.user
      ? new Intl.DateTimeFormat("fr-FR", {
          month: "long",
          year: "numeric",
        }).format(new Date(auth.user.createdAt))
      : "",
  );

  let displayNameInput = $state(auth.user?.displayName ?? "");
  let displayNameStatus = $state<"idle" | "saving" | "saved" | "error">("idle");
  let displayNameError = $state("");

  async function saveDisplayName() {
    const value = displayNameInput.trim();
    if (!value || value === auth.user?.displayName) return;
    displayNameStatus = "saving";
    displayNameError = "";
    try {
      await updateMe({ displayName: value });
      displayNameStatus = "saved";
      // Clear the "Enregistré." hint after a moment so it doesn't linger.
      setTimeout(() => {
        if (displayNameStatus === "saved") displayNameStatus = "idle";
      }, 2500);
    } catch (err) {
      displayNameStatus = "error";
      displayNameError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    }
  }

  let birthDate = $state(auth.user?.birthDate ?? "");
  let birthDateStatus = $state<"idle" | "saving" | "saved" | "error">("idle");
  let birthDateError = $state("");

  // Today, formatted for the date input's `max` bound (no future birth dates).
  const todayIso = new Date().toISOString().slice(0, 10);

  async function saveBirthDate() {
    birthDateStatus = "saving";
    birthDateError = "";
    try {
      await updateMe({ birthDate: birthDate || null });
      birthDateStatus = "saved";
      setTimeout(() => {
        if (birthDateStatus === "saved") birthDateStatus = "idle";
      }, 2500);
    } catch (err) {
      birthDateStatus = "error";
      birthDateError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    }
  }

  // Mirrors the API's age check, just for enabling/disabling the toggle below.
  function hasTurned18(isoBirthDate: string | null): boolean {
    if (!isoBirthDate) return false;
    const [year, month, day] = isoBirthDate.split("-").map(Number);
    const today = new Date();
    let age = today.getFullYear() - year;
    const hadBirthdayThisYear =
      today.getMonth() + 1 > month ||
      (today.getMonth() + 1 === month && today.getDate() >= day);
    if (!hadBirthdayThisYear) age -= 1;
    return age >= 18;
  }

  let isAdultEligible = $derived(hasTurned18(auth.user?.birthDate ?? null));
  let adultContentError = $state("");

  async function toggleAdultContent() {
    if (!auth.user || !isAdultEligible) return;
    adultContentError = "";
    try {
      await updateMe({ allowAdultContent: !auth.user.allowAdultContent });
    } catch (err) {
      adultContentError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    }
  }

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

  // Content domains the user composes the app from. Games/Books are still
  // placeholders (no screens yet), but the toggle already drives the nav.
  const DOMAINS: { id: Domain; label: string; desc: string; soon: boolean }[] =
    [
      {
        id: Domain.MEDIA,
        label: "Médias",
        desc: "Films, séries et anime.",
        soon: false,
      },
      { id: Domain.GAMES, label: "Jeux", desc: "Jeux vidéo.", soon: true },
      {
        id: Domain.BOOKS,
        label: "Livres",
        desc: "Romans, BD, mangas.",
        soon: true,
      },
    ];

  let domainsError = $state("");

  async function toggleDomain(id: Domain) {
    if (!auth.user) return;
    const current = auth.user.enabledDomains;
    const has = current.includes(id);
    if (has && current.length === 1) return; // keep at least one domain visible
    // Rebuild in canonical order so the stored list stays tidy.
    const next = DOMAINS.map((d) => d.id).filter((d) =>
      d === id ? !has : current.includes(d),
    );
    domainsError = "";
    try {
      await updateMe({ enabledDomains: next });
    } catch (err) {
      domainsError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    }
  }

  async function signOut() {
    await logout();
    await goto("/login");
  }

  // --- Sécurité: username / email / password, each in its own modal. ---
  type SecurityModal = "username" | "email" | "password" | null;
  let openModal = $state<SecurityModal>(null);

  function closeModal() {
    clearTimeout(usernameCheckTimer);
    openModal = null;
  }

  let usernameInput = $state("");
  let usernameError = $state("");
  let usernameSaving = $state(false);
  type UsernameCheck = "idle" | "checking" | "available" | "taken" | "error";
  let usernameCheck = $state<UsernameCheck>("idle");
  let usernameCheckTimer: ReturnType<typeof setTimeout> | undefined;

  function openUsernameModal() {
    usernameInput = auth.user?.username ?? "";
    usernameError = "";
    usernameCheck = "idle";
    openModal = "username";
  }

  // Debounced availability check, keyed on the current input value so a slow
  // response can never clobber the status of a value the user has since edited.
  function onUsernameInput() {
    clearTimeout(usernameCheckTimer);
    const value = usernameInput.trim();
    if (!value || value === auth.user?.username) {
      usernameCheck = "idle";
      return;
    }
    usernameCheck = "checking";
    usernameCheckTimer = setTimeout(async () => {
      try {
        const { available } = await checkUsernameAvailable(value);
        if (usernameInput.trim() === value) {
          usernameCheck = available ? "available" : "taken";
        }
      } catch {
        if (usernameInput.trim() === value) usernameCheck = "error";
      }
    }, 400);
  }

  async function saveUsername() {
    if (usernameCheck !== "available") return;
    usernameError = "";
    usernameSaving = true;
    try {
      await updateUsername({ username: usernameInput.trim() });
      openModal = null;
    } catch (err) {
      usernameError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    } finally {
      usernameSaving = false;
    }
  }

  let emailInput = $state("");
  let emailPasswordInput = $state("");
  let emailError = $state("");
  let emailSaving = $state(false);

  function openEmailModal() {
    emailInput = auth.user?.email ?? "";
    emailPasswordInput = "";
    emailError = "";
    openModal = "email";
  }

  async function saveEmail() {
    emailError = "";
    emailSaving = true;
    try {
      await changeEmail({
        newEmail: emailInput.trim(),
        currentPassword: emailPasswordInput,
      });
      openModal = null;
    } catch (err) {
      emailError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    } finally {
      emailSaving = false;
    }
  }

  let currentPasswordInput = $state("");
  let newPasswordInput = $state("");
  let confirmPasswordInput = $state("");
  let passwordError = $state("");
  let passwordSaving = $state(false);

  function openPasswordModal() {
    currentPasswordInput = "";
    newPasswordInput = "";
    confirmPasswordInput = "";
    passwordError = "";
    openModal = "password";
  }

  async function savePassword() {
    passwordError = "";
    if (newPasswordInput.length < 8) {
      passwordError = "8 caractères minimum.";
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      passwordError = "Les mots de passe ne correspondent pas.";
      return;
    }
    passwordSaving = true;
    try {
      await changePassword({
        currentPassword: currentPasswordInput,
        newPassword: newPasswordInput,
      });
      openModal = null;
    } catch (err) {
      passwordError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    } finally {
      passwordSaving = false;
    }
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
  <h1
    class="mb-6 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
    Compte
  </h1>

  {#if auth.user}
    <!-- En-tête d'identité -->
    <section class="card mb-5 p-5 md:p-6">
      <div class="flex flex-wrap items-center gap-4">
        <div
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/15 font-display text-xl font-bold text-accent">
          {initials}
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-lg font-bold">{auth.user.displayName}</p>
          <p class="timecode truncate text-sm">{auth.user.email}</p>
          <p class="mt-0.5 text-sm text-dim">Membre depuis {memberSince}</p>
        </div>
        <button class="btn btn-danger" onclick={signOut}>Se déconnecter</button>
      </div>
    </section>

    <!-- Sécurité -->
    <section class="card mb-5 p-5 md:p-6">
      <h2 class="mb-4 font-display text-lg font-bold">Sécurité</h2>
      <div class="divide-y divide-border">
        <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
          <div>
            <p class="text-sm text-dim">Nom d'utilisateur</p>
            <p class="font-semibold">{auth.user.username}</p>
          </div>
          <button
            class="text-sm font-semibold text-accent hover:underline"
            onclick={openUsernameModal}>
            Modifier
          </button>
        </div>
        <div class="flex items-center justify-between gap-4 py-3">
          <div>
            <p class="text-sm text-dim">Email</p>
            <p class="font-semibold">{auth.user.email}</p>
          </div>
          <button
            class="text-sm font-semibold text-accent hover:underline"
            onclick={openEmailModal}>
            Modifier
          </button>
        </div>
        <div class="flex items-center justify-between gap-4 py-3">
          <div>
            <p class="text-sm text-dim">Mot de passe</p>
            <p class="font-semibold tracking-widest">••••••••</p>
          </div>
          <button
            class="text-sm font-semibold text-accent hover:underline"
            onclick={openPasswordModal}>
            Modifier
          </button>
        </div>
        <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
          <div>
            <p class="text-sm text-dim">Appareils connectés</p>
            <p class="font-semibold">Sessions ouvertes sur ton compte</p>
          </div>
          <a
            href="/account/sessions"
            class="text-sm font-semibold text-accent hover:underline">
            Gérer
          </a>
        </div>
      </div>
    </section>

    <!-- Profil -->
    <section class="card mb-5 p-5 md:p-6">
      <h2 class="mb-4 font-display text-lg font-bold">Profil</h2>

      <label class="block max-w-xs">
        <span class="mb-1.5 block text-sm font-semibold">Nom affiché</span>
        <input
          type="text"
          class="input"
          maxlength="50"
          bind:value={displayNameInput}
          onchange={saveDisplayName} />
      </label>
      {#if displayNameStatus === "saving"}
        <p class="mt-2 text-sm text-dim">Enregistrement…</p>
      {:else if displayNameStatus === "saved"}
        <p class="mt-2 text-sm text-success">Enregistré.</p>
      {:else if displayNameStatus === "error"}
        <p class="mt-2 text-sm text-danger">{displayNameError}</p>
      {/if}

      <div class="mt-5 border-t border-border pt-5">
        <label class="block max-w-xs">
          <span class="mb-1.5 block text-sm font-semibold">
            Date de naissance
          </span>
          <input
            type="date"
            class="input"
            max={todayIso}
            bind:value={birthDate}
            onchange={saveBirthDate} />
        </label>
        <p class="mt-1.5 text-xs text-dim">
          Utilisée pour adapter certaines recommandations à ton âge.
        </p>
        {#if birthDateStatus === "saving"}
          <p class="mt-2 text-sm text-dim">Enregistrement…</p>
        {:else if birthDateStatus === "saved"}
          <p class="mt-2 text-sm text-success">Enregistré.</p>
        {:else if birthDateStatus === "error"}
          <p class="mt-2 text-sm text-danger">{birthDateError}</p>
        {/if}
      </div>

      <div class="mt-5 border-t border-border pt-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="font-semibold">Contenu pour adultes</p>
            <p class="text-sm text-dim">
              {#if isAdultEligible}
                Inclut les titres 18+ (hentai, films pornographiques) dans les
                recherches.
              {:else}
                Réservé aux comptes de 18 ans ou plus, date de naissance
                renseignée.
              {/if}
            </p>
          </div>
          <button
            class="chip shrink-0 disabled:pointer-events-none disabled:opacity-40"
            class:chip-on={auth.user.allowAdultContent}
            disabled={!isAdultEligible}
            onclick={toggleAdultContent}>
            {auth.user.allowAdultContent ? "Activé" : "Désactivé"}
          </button>
        </div>
        {#if adultContentError}
          <p class="mt-2 text-sm text-danger">{adultContentError}</p>
        {/if}
      </div>
    </section>

    <!-- Domaines -->
    <section class="card mb-5 p-5 md:p-6">
      <h2 class="mb-1 font-display text-lg font-bold">Domaines</h2>
      <p class="mb-4 text-sm text-dim">
        Choisis les univers présents dans ton app. Ce que tu masques disparaît
        de la navigation.
      </p>
      <div class="divide-y divide-border">
        {#each DOMAINS as d (d.id)}
          {@const on = auth.user.enabledDomains.includes(d.id)}
          {@const isLast = on && auth.user.enabledDomains.length === 1}
          <div
            class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div>
              <p class="font-semibold">
                {d.label}
                {#if d.soon}
                  <span
                    class="ml-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim">
                    Bientôt
                  </span>
                {/if}
              </p>
              <p class="text-sm text-dim">{d.desc}</p>
            </div>
            <button
              class="chip shrink-0 disabled:pointer-events-none disabled:opacity-40"
              class:chip-on={on}
              disabled={isLast}
              title={isLast
                ? "Au moins un domaine doit rester actif."
                : undefined}
              onclick={() => toggleDomain(d.id)}>
              {on ? "Activé" : "Désactivé"}
            </button>
          </div>
        {/each}
      </div>
      {#if domainsError}
        <p class="mt-2 text-sm text-danger">{domainsError}</p>
      {/if}
    </section>

    <!-- Communications -->
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
            <p class="font-semibold">
              Email
              <span
                class="ml-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim">
                Bientôt
              </span>
            </p>
            <p class="text-sm text-dim">
              On enverra ces notifications par email dès que ce sera disponible.
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
            <p class="font-semibold">
              Notifications push
              <span
                class="ml-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-dim">
                Bientôt
              </span>
            </p>
            <p class="text-sm text-dim">
              Pour être alerté même appli fermée, une fois disponible.
            </p>
          </div>
          <button
            class="chip shrink-0"
            class:chip-on={auth.user.notifyPush}
            onclick={() => toggleNotify("notifyPush")}>
            {auth.user.notifyPush ? "Activé" : "Désactivé"}
          </button>
        </div>
      </div>
      {#if notifyError}
        <p class="mt-2 text-sm text-danger">{notifyError}</p>
      {/if}
    </section>

    <!-- Apparence -->
    <section class="card mb-5 p-5 md:p-6">
      <h2 class="mb-1 font-display text-lg font-bold">Apparence</h2>
      <p class="mb-4 text-sm text-dim">Thème de l’interface.</p>
      <div class="flex gap-2">
        <button
          class="chip inline-flex items-center gap-2"
          class:chip-on={theme.mode === "light"}
          onclick={() => theme.mode !== "light" && theme.toggle()}>
          <Icon name="sun" class="h-4 w-4" /> Clair
        </button>
        <button
          class="chip inline-flex items-center gap-2"
          class:chip-on={theme.mode === "dark"}
          onclick={() => theme.mode !== "dark" && theme.toggle()}>
          <Icon name="moon" class="h-4 w-4" /> Sombre
        </button>
      </div>
    </section>

    <!-- Import -->
    <section class="card p-5 md:p-6">
      <h2 class="mb-1 font-display text-lg font-bold">Import</h2>
      <p class="mb-4 text-sm text-dim">
        Récupère ton historique depuis d'autres applis — médias, livres, jeux.
      </p>
      <a
        href="/account/import"
        class="flex items-center gap-3 rounded-lg border border-border bg-bg p-4 transition-colors hover:border-accent hover:bg-surface-2">
        <Icon name="download" class="h-6 w-6 text-accent" />
        <span class="flex-1">
          <span class="block font-semibold">Sources disponibles</span>
          <span class="text-sm text-dim">
            TV Time pour les médias ; livres et jeux à venir.
          </span>
        </span>
        <Icon name="chevron-right" class="h-5 w-5 text-dim" />
      </a>
    </section>

    <!-- Données -->
    <section class="card mt-5 p-5 md:p-6">
      <h2 class="mb-1 font-display text-lg font-bold">Mes données</h2>
      <p class="mb-4 text-sm text-dim">
        Exporte une copie de tes données, ou supprime définitivement ton compte.
      </p>
      <a
        href="/account/data"
        class="flex items-center gap-3 rounded-lg border border-border bg-bg p-4 transition-colors hover:border-accent hover:bg-surface-2">
        <Icon name="download" class="h-6 w-6 text-accent" />
        <span class="flex-1">
          <span class="block font-semibold">Export et suppression</span>
          <span class="text-sm text-dim">
            Télécharge tes données au format JSON, ou supprime ton compte.
          </span>
        </span>
        <Icon name="chevron-right" class="h-5 w-5 text-dim" />
      </a>
    </section>

    {#if openModal === "username"}
      <Modal title="Changer le nom d'utilisateur" onclose={closeModal}>
        <form
          class="flex flex-col gap-3"
          onsubmit={(e) => {
            e.preventDefault();
            saveUsername();
          }}>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold">
              Nom d'utilisateur
            </span>
            <input
              type="text"
              class="input"
              maxlength="50"
              bind:value={usernameInput}
              oninput={onUsernameInput} />
          </label>
          {#if usernameCheck === "checking"}
            <p class="text-sm text-dim">Vérification…</p>
          {:else if usernameCheck === "available"}
            <p class="text-sm text-success">Disponible.</p>
          {:else if usernameCheck === "taken"}
            <p class="text-sm text-danger">Déjà pris.</p>
          {:else if usernameCheck === "error"}
            <p class="text-sm text-danger">Vérification impossible.</p>
          {/if}
          {#if usernameError}
            <p class="text-sm text-danger">{usernameError}</p>
          {/if}
          <div class="mt-2 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost" onclick={closeModal}>
              Annuler
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={usernameSaving || usernameCheck !== "available"}>
              {usernameSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </Modal>
    {/if}

    {#if openModal === "email"}
      <Modal title="Changer l'email" onclose={closeModal}>
        <form
          class="flex flex-col gap-3"
          onsubmit={(e) => {
            e.preventDefault();
            saveEmail();
          }}>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold">Nouvel email</span>
            <input type="email" class="input" bind:value={emailInput} />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold">
              Mot de passe actuel
            </span>
            <input
              type="password"
              class="input"
              autocomplete="current-password"
              bind:value={emailPasswordInput} />
          </label>
          {#if emailError}
            <p class="text-sm text-danger">{emailError}</p>
          {/if}
          <div class="mt-2 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost" onclick={closeModal}>
              Annuler
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={emailSaving ||
                !emailInput.trim() ||
                !emailPasswordInput}>
              {emailSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </Modal>
    {/if}

    {#if openModal === "password"}
      <Modal title="Changer le mot de passe" onclose={closeModal}>
        <form
          class="flex flex-col gap-3"
          onsubmit={(e) => {
            e.preventDefault();
            savePassword();
          }}>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold">
              Mot de passe actuel
            </span>
            <input
              type="password"
              class="input"
              autocomplete="current-password"
              bind:value={currentPasswordInput} />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold">
              Nouveau mot de passe
            </span>
            <input
              type="password"
              class="input"
              autocomplete="new-password"
              minlength="8"
              bind:value={newPasswordInput} />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold">
              Confirmer le nouveau mot de passe
            </span>
            <input
              type="password"
              class="input"
              autocomplete="new-password"
              bind:value={confirmPasswordInput} />
          </label>
          {#if passwordError}
            <p class="text-sm text-danger">{passwordError}</p>
          {/if}
          <div class="mt-2 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost" onclick={closeModal}>
              Annuler
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={passwordSaving ||
                !currentPasswordInput ||
                !newPasswordInput ||
                !confirmPasswordInput}>
              {passwordSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </Modal>
    {/if}
  {/if}
</div>
