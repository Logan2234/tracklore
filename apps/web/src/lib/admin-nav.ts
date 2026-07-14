import type { ComponentProps } from "svelte";
import type Icon from "$lib/components/Icon.svelte";

type IconName = ComponentProps<typeof Icon>["name"];

/** One admin destination, shared by the admin rail and the /admin home cards. */
export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: IconName;
  match: (path: string) => boolean;
  /** Not built yet: shown dimmed with a "Bientôt" badge, not navigable. */
  soon?: boolean;
};

// Full list per the admin-panel-idea memory: Logan's requested features plus
// Claude's suggestions. Only Services is built; the rest are placeholders
// ("soon") so the destination and its rationale aren't lost between sessions.
export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/admin/status",
    label: "Services",
    description: "Santé des dépendances externes (clés, disponibilité).",
    icon: "monitor",
    match: (p) => p.startsWith("/admin/status"),
  },
  {
    href: "/admin/users",
    label: "Utilisateurs",
    description: "Comptes enregistrés et sessions actives.",
    icon: "user",
    match: (p) => p.startsWith("/admin/users"),
    soon: true,
  },
  {
    href: "/admin/emails",
    label: "Emails",
    description: "Gabarits rendus en aperçu, envoi de test.",
    icon: "mail",
    match: (p) => p.startsWith("/admin/emails"),
  },
  {
    href: "/admin/stats",
    label: "Statistiques",
    description: "Usage global et tailles des bibliothèques.",
    icon: "stats",
    match: (p) => p.startsWith("/admin/stats"),
    soon: true,
  },
  {
    href: "/admin/push",
    label: "Notifications push",
    description: "Envoi d'un push de test à un utilisateur.",
    icon: "bell",
    match: (p) => p.startsWith("/admin/push"),
  },
  {
    href: "/admin/jobs",
    label: "Jobs & tâches",
    description: "Visibilité des scans/refresh planifiés (cron).",
    icon: "calendar",
    match: (p) => p.startsWith("/admin/jobs"),
    soon: true,
  },
  {
    href: "/admin/entitlements",
    label: "Fonctionnalités",
    description: "Éditeur des entitlements (feature-flags).",
    icon: "star",
    match: (p) => p.startsWith("/admin/entitlements"),
    soon: true,
  },
  {
    href: "/admin/imports",
    label: "Imports",
    description: "Journal des imports (Steam, StoryGraph, TV Time…).",
    icon: "download",
    match: (p) => p.startsWith("/admin/imports"),
    soon: true,
  },
  {
    href: "/admin/quotas",
    label: "Quotas",
    description: "Usage vs. limites des APIs externes mesurées.",
    icon: "gauge",
    match: (p) => p.startsWith("/admin/quotas"),
    soon: true,
  },
  {
    href: "/admin/cache",
    label: "Cache & synchronisation",
    description: "Explorateur du cache DB, re-sync manuel par item.",
    icon: "database",
    match: (p) => p.startsWith("/admin/cache"),
    soon: true,
  },
  {
    href: "/admin/schema",
    label: "Schéma",
    description: "Graphe du schéma DB et des modules de l'app.",
    icon: "library",
    match: (p) => p.startsWith("/admin/schema"),
    soon: true,
  },
  {
    href: "/admin/security",
    label: "Sécurité",
    description: "Journal des actions sensibles (reset, changement d'email).",
    icon: "shield",
    match: (p) => p.startsWith("/admin/security"),
    soon: true,
  },
];
