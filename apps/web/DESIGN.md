# Visual identity — "Séance"

Validated 2026-07-02. Applies to the whole `apps/web` front.

**Concept:** the two themes mean something — dark = "la salle" (lights off,
poster glows), light = "le programme" (paper). Signature devices: metadata as
a **timecode in a mono font** (year, `S01E04`, `2:46:00`, `12 / 24`), thin
**letterbox** hairline rules, rating shown as an **amber "marquee" cartouche**.

**Typography** (self-hosted via `@fontsource`, no runtime external calls):

- Display / titles: **Bricolage Grotesque** (chosen over Fraunces).
- Body / UI: **Hanken Grotesk** (replaces the old Inter).
- Data / timecodes: **Space Mono**.

**Palette** — single ownable accent = **projector amber**.

| | Dark ("la salle") | Light ("le programme") |
|---|---|---|
| bg | `#0C0D10` | `#EDECE8` (warm manila, deliberately not the cream cliché) |
| surface | `#15171C` | `#FBFAF7` |
| border | `#2A2E38` | `#DAD8D0` |
| text | `#ECECEA` | `#17181C` |
| accent | `#F5B841` | `#A56A15` (deeper, for contrast on light) |

Primary button is asymmetric: amber fill in dark, ink fill in light.
Green/red are semantic only (success/danger), never decoration.

**Themes:** both light and dark shipped (toggle + system pref).

**Navigation:** collapsible icon **rail** on desktop (toggle button at top
expands it to a labelled sidebar; user avatar at bottom) + fixed **bottom tab
bar** on mobile. No horizontal top nav.

Implementation: Tailwind v4 (`@tailwindcss/vite`), semantic light/dark tokens
in `src/app.css`, shared component classes (`.btn`, `.input`, `.card`,
`.chip`, `.timecode`).
