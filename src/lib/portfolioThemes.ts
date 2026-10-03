import { DEFAULT_PORTFOLIO_THEME, type PortfolioTheme } from "../types/portfolio";

export const PORTFOLIO_THEMES = [
  {
    id: "comic" as const,
    label: "Comic",
    description: "Bold Spider-Verse comic panels — the original Stackfolio look.",
  },
  {
    id: "minimalist" as const,
    label: "Minimalist",
    description: "Quiet typography, open space, and a calm reading layout.",
  },
  {
    id: "dark-tech" as const,
    label: "Dark Tech",
    description: "Dark terminal aesthetic with monospace type and scanlines.",
  },
] satisfies ReadonlyArray<{ id: PortfolioTheme; label: string; description: string }>;

export const PORTFOLIO_THEME_IDS = ["comic", "minimalist", "dark-tech"] as const satisfies readonly PortfolioTheme[];

/** Map older free-text / pre-enum values onto the current enum. */
const LEGACY_THEME_MAP: Record<string, PortfolioTheme> = {
  default: "comic",
  hacker: "dark-tech",
  "dark-hacker": "dark-tech",
  terminal: "dark-tech",
};

export function normalizePortfolioTheme(theme: string | null | undefined): PortfolioTheme {
  const value = theme?.trim().toLowerCase();
  if (!value) return DEFAULT_PORTFOLIO_THEME;
  if ((PORTFOLIO_THEME_IDS as readonly string[]).includes(value)) {
    return value as PortfolioTheme;
  }
  return LEGACY_THEME_MAP[value] ?? DEFAULT_PORTFOLIO_THEME;
}

const themeCacheKey = (slug: string) => `stackfolio_portfolio_theme:${slug}`;

/** Sync read — avoids flashing the wrong game-shell / public theme on repeat visits. */
export function readCachedPortfolioTheme(slug: string | undefined): PortfolioTheme | null {
  if (!slug || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(themeCacheKey(slug));
    if (raw && (PORTFOLIO_THEME_IDS as readonly string[]).includes(raw)) {
      return raw as PortfolioTheme;
    }
  } catch {
    // ignore storage failures
  }
  return null;
}

export function writeCachedPortfolioTheme(slug: string | undefined, theme: PortfolioTheme) {
  if (!slug || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(themeCacheKey(slug), theme);
  } catch {
    // ignore storage failures
  }
}

export function groupSkillsByCategory(skills: { skillName: string; category?: string; displayOrder: number }[]) {
  const grouped = new Map<string, string[]>();
  for (const skill of [...skills].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))) {
    const key = skill.category || "Skills";
    grouped.set(key, [...(grouped.get(key) ?? []), skill.skillName]);
  }
  return Array.from(grouped.entries());
}
