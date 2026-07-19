import { Domain } from "@tracklore/shared";

type NavIcon =
  | "home"
  | "library"
  | "search"
  | "calendar"
  | "stats"
  | "gamepad"
  | "book"
  | "music"
  | "tv"
  | "bell"
  | "user"
  | "shield";

interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  match(path: string): boolean;
  domain?: Domain;
  // Affiché directement dans la BottomNavigation.
  mobile?: boolean;
  /**
   * Toujours affiché dans le drawer.
   */
  drawer?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    items: [
      {
        href: "/",
        label: "Accueil",
        icon: "home",
        mobile: true,
        match: (p) => p === "/",
      },
      {
        href: "/search",
        label: "Recherche",
        icon: "search",
        mobile: true,
        match: (p) => p.startsWith("/search"),
      },
    ],
  },
  {
    label: "Ma bibliothèque",
    items: [
      {
        href: "/media",
        label: "Vidéo",
        icon: "tv",
        mobile: true,
        domain: Domain.MEDIA,
        match: (p) => p.startsWith("/media"),
      },
      {
        href: "/games",
        label: "Jeux",
        icon: "gamepad",
        domain: Domain.GAMES,
        drawer: true,
        match: (p) => p.startsWith("/games"),
      },
      {
        href: "/books",
        label: "Livres",
        icon: "book",
        domain: Domain.BOOKS,
        drawer: true,
        match: (p) => p.startsWith("/books"),
      },
      {
        href: "/music",
        label: "Musique",
        icon: "music",
        domain: Domain.MUSIC,
        drawer: true,
        match: (p) => p.startsWith("/music"),
      },
    ],
  },
  {
    label: "Suivi",
    items: [
      {
        href: "/calendar",
        label: "Calendrier",
        icon: "calendar",
        mobile: true,
        domain: Domain.MEDIA,
        match: (p) => p.startsWith("/calendar"),
      },
      {
        href: "/stats",
        label: "Statistiques",
        icon: "stats",
        drawer: true,
        match: (p) => p.startsWith("/stats"),
      },
    ],
  },
];

export function getBottomNavigation() {
  return NAVIGATION.flatMap((section) =>
    section.items.filter((item) => item.mobile),
  );
}

export function getDrawerNavigation() {
  return NAVIGATION.flatMap((section) =>
    section.items.filter((item) => item.drawer),
  );
}
