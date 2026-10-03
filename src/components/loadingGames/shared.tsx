import { createContext, useContext, useEffect, useState, type ReactNode, type RefObject } from "react";
import { cn } from "../../lib/utils";
import type { PortfolioTheme } from "../../types/portfolio";

export type ThemeId =
  | "spider"
  | "batman"
  | "ironman"
  | "goku"
  | "naruto"
  | "sasuke"
  | "obito"
  | "vegeta"
  | "lantern"
  | "superman"
  | "wolverine"
  | "fma"
  | "jjk";

export type GameShellProps = {
  ready: boolean;
  onEnter: () => void;
  title: string;
  tagline: string;
  mobileTagline?: string;
  strip: string;
  stripHint: string;
  loadingLabel: string;
  readyLabel: string;
  accent: string;
  accent2: string;
  score: number;
  secondaryLabel: string;
  secondaryValue: number;
  best: number;
  alive: boolean;
  aliveHint: string;
  deadHint: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  ariaLabel: string;
};

export type MiniGameProps = {
  ready: boolean;
  onEnter: () => void;
};

const LoadingGamePortfolioThemeContext = createContext<PortfolioTheme | null>(null);

export function LoadingGamePortfolioThemeProvider({
  theme,
  children,
}: {
  theme: PortfolioTheme | null;
  children: ReactNode;
}) {
  return (
    <LoadingGamePortfolioThemeContext.Provider value={theme}>{children}</LoadingGamePortfolioThemeContext.Provider>
  );
}

function useLoadingGamePortfolioTheme() {
  return useContext(LoadingGamePortfolioThemeContext);
}

type ShellChrome = {
  page: string;
  atmosphere: string;
  toast: string;
  toastText: string;
  toastDismiss: string;
  overlay: string;
  modal: string;
  modalEyebrow: string;
  modalTitle: string;
  modalBody: string;
  secondaryBtn: string;
  primaryBtn: string;
  statusCaption: string;
  title: string;
  tagline: string;
  hudBox: string;
  hudLabel: string;
  hudValue: string;
  bestBox: string;
  panel: string;
  stripBar: string;
  stripTitle: string;
  stripHint: string;
  footerHint: string;
  loadingChip: string;
};

/** Neutral shell used until the portfolio theme is known — never flash comic as a default. */
const PENDING_CHROME: ShellChrome = {
  page: "relative flex min-h-[100svh] flex-col items-center justify-start bg-stone-100 px-3 py-4 text-stone-800 sm:justify-center sm:px-4 sm:py-8",
  atmosphere: "pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.9),transparent_55%)]",
  toast: "fixed bottom-4 left-1/2 z-40 w-[min(92vw,28rem)] -translate-x-1/2 border border-stone-300 bg-white px-3 py-3 shadow-soft sm:bottom-6 sm:px-4",
  toastText: "flex-1 text-xs leading-snug text-stone-600 sm:text-sm",
  toastDismiss: "shrink-0 text-lg leading-none text-stone-400 hover:text-stone-800",
  overlay: "fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-4 backdrop-blur-[2px]",
  modal: "w-full max-w-md border border-stone-200 bg-white p-5 shadow-soft sm:p-6",
  modalEyebrow: "text-[10px] font-medium uppercase tracking-[0.28em] text-stone-400",
  modalTitle: "mt-3 font-display text-3xl leading-none tracking-tight text-stone-950 sm:text-4xl",
  modalBody: "mt-3 text-sm leading-relaxed text-stone-600 sm:text-base",
  secondaryBtn: "flex-1 border border-stone-300 bg-white px-4 py-3 text-sm font-semibold tracking-wide text-stone-800",
  primaryBtn: "flex-1 px-4 py-3 text-sm font-semibold tracking-wide text-white",
  statusCaption: "inline-block max-w-full truncate text-[10px] font-medium uppercase tracking-[0.28em] text-stone-400 sm:text-xs",
  title: "mt-2 font-display text-[2rem] leading-none tracking-tight text-stone-950 sm:text-5xl",
  tagline: "mt-1 text-xs text-stone-500 sm:text-sm",
  hudBox: "border border-stone-300 bg-white px-2 py-1.5 text-stone-900 sm:px-3 sm:py-2",
  hudLabel: "text-[9px] font-medium uppercase tracking-[0.18em] text-stone-400 sm:text-[10px]",
  hudValue: "font-display text-xl font-semibold leading-none sm:text-2xl",
  bestBox: "border border-stone-300 bg-stone-200 px-2 py-1.5 text-stone-900 sm:px-3 sm:py-2",
  panel: "overflow-hidden border border-stone-300 bg-white shadow-soft",
  stripBar: "flex items-center justify-between gap-2 border-b border-stone-200 bg-stone-900 px-2 py-1.5 text-stone-100 sm:px-3",
  stripTitle: "text-xs font-semibold tracking-[0.18em] uppercase sm:text-sm",
  stripHint: "truncate text-[10px] uppercase tracking-[0.16em] text-stone-400 sm:text-xs",
  footerHint: "text-[11px] uppercase leading-snug tracking-[0.16em] text-stone-400 sm:text-xs",
  loadingChip: "flex w-full items-center justify-center gap-2 border border-stone-300 bg-white px-3 py-2 text-sm text-stone-600 sm:w-auto",
};

const SHELL_CHROME: Record<PortfolioTheme, ShellChrome> = {
  comic: {
    page: "comic-page relative flex min-h-[100svh] flex-col items-center justify-start px-3 py-4 sm:justify-center sm:px-4 sm:py-8",
    atmosphere: "comic-speedlines pointer-events-none fixed inset-0 opacity-50",
    toast: "fixed bottom-4 left-1/2 z-40 w-[min(92vw,28rem)] -translate-x-1/2 border-4 border-comic-ink bg-comic-cream px-3 py-3 shadow-comic sm:bottom-6 sm:px-4",
    toastText: "flex-1 font-comic-body text-xs font-bold leading-snug text-comic-ink sm:text-sm",
    toastDismiss: "shrink-0 font-comic text-lg leading-none text-comic-ink/50 hover:text-comic-ink",
    overlay: "fixed inset-0 z-50 flex items-center justify-center bg-comic-ink/55 px-4 backdrop-blur-[2px]",
    modal: "w-full max-w-md border-4 border-comic-ink bg-comic-cream p-5 shadow-comic-pink sm:p-6",
    modalEyebrow: "comic-caption inline-block -rotate-1 px-2 py-1 text-[10px] font-bold uppercase",
    modalTitle: "comic-title mt-3 text-3xl leading-none text-comic-ink sm:text-4xl",
    modalBody: "mt-3 font-comic-body text-sm font-bold leading-snug text-comic-ink/75 sm:text-base",
    secondaryBtn: "flex-1 border-4 border-comic-ink bg-white px-4 py-3 font-comic text-lg tracking-wide text-comic-ink shadow-comic",
    primaryBtn: "comic-burst flex-1 px-4 py-3 font-comic text-lg tracking-wide text-white",
    statusCaption: "comic-caption inline-block max-w-full -rotate-1 truncate px-2 py-1 text-[10px] font-bold uppercase sm:px-3 sm:text-xs",
    title: "comic-title mt-2 text-[2rem] leading-none text-comic-ink sm:text-5xl",
    tagline: "mt-1 font-comic-body text-xs font-bold text-comic-ink/70 sm:text-sm",
    hudBox: "border-4 border-comic-ink px-2 py-1.5 text-white shadow-comic sm:px-3 sm:py-2",
    hudLabel: "font-comic-body text-[9px] font-bold uppercase opacity-80 sm:text-[10px]",
    hudValue: "font-comic text-xl leading-none sm:text-2xl",
    bestBox: "border-4 border-comic-ink bg-comic-yellow px-2 py-1.5 shadow-comic sm:px-3 sm:py-2",
    panel: "comic-panel overflow-hidden shadow-comic-pink",
    stripBar: "flex items-center justify-between gap-2 border-b-4 border-comic-ink bg-comic-ink px-2 py-1 text-comic-cream sm:px-3 sm:py-1.5",
    stripTitle: "font-comic text-sm tracking-wide text-comic-cyan sm:text-lg",
    stripHint: "truncate font-comic-body text-[10px] font-bold uppercase text-comic-pink sm:text-xs",
    footerHint: "font-comic-body text-[11px] font-bold uppercase leading-snug tracking-wide text-comic-ink/60 sm:text-xs",
    loadingChip: "comic-caption flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-bold sm:w-auto",
  },
  minimalist: {
    page: "minimal-page relative flex min-h-[100svh] flex-col items-center justify-start px-3 py-4 text-stone-900 sm:justify-center sm:px-4 sm:py-8",
    atmosphere: "minimal-atmosphere pointer-events-none fixed inset-0",
    toast: "fixed bottom-4 left-1/2 z-40 w-[min(92vw,28rem)] -translate-x-1/2 border border-stone-300 bg-white/95 px-3 py-3 shadow-soft backdrop-blur sm:bottom-6 sm:px-4",
    toastText: "flex-1 text-xs leading-snug text-stone-600 sm:text-sm",
    toastDismiss: "shrink-0 text-lg leading-none text-stone-400 hover:text-stone-800",
    overlay: "fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-4 backdrop-blur-[2px]",
    modal: "w-full max-w-md border border-stone-200 bg-white p-5 shadow-soft sm:p-6",
    modalEyebrow: "text-[10px] font-medium uppercase tracking-[0.28em] text-stone-400",
    modalTitle: "mt-3 font-serif text-3xl leading-none tracking-tight text-stone-950 sm:text-4xl",
    modalBody: "mt-3 text-sm leading-relaxed text-stone-600 sm:text-base",
    secondaryBtn: "flex-1 border border-stone-300 bg-white px-4 py-3 font-display text-sm font-semibold tracking-wide text-stone-800 transition hover:border-stone-500",
    primaryBtn: "flex-1 px-4 py-3 font-display text-sm font-semibold tracking-wide text-white transition hover:opacity-90",
    statusCaption: "inline-block max-w-full truncate text-[10px] font-medium uppercase tracking-[0.28em] text-stone-400 sm:text-xs",
    title: "mt-2 font-serif text-[2rem] leading-none tracking-tight text-stone-950 sm:text-5xl",
    tagline: "mt-1 text-xs text-stone-500 sm:text-sm",
    hudBox: "border border-stone-300 bg-stone-950 px-2 py-1.5 text-white sm:px-3 sm:py-2",
    hudLabel: "font-display text-[9px] font-medium uppercase tracking-[0.18em] opacity-70 sm:text-[10px]",
    hudValue: "font-display text-xl font-semibold leading-none sm:text-2xl",
    bestBox: "border border-stone-300 bg-stone-100 px-2 py-1.5 text-stone-900 sm:px-3 sm:py-2",
    panel: "overflow-hidden border border-stone-300 bg-white",
    stripBar: "flex items-center justify-between gap-2 border-b border-stone-200 bg-stone-950 px-2 py-1.5 text-stone-100 sm:px-3",
    stripTitle: "font-display text-xs font-semibold tracking-[0.18em] uppercase sm:text-sm",
    stripHint: "truncate text-[10px] uppercase tracking-[0.16em] text-stone-400 sm:text-xs",
    footerHint: "text-[11px] uppercase leading-snug tracking-[0.16em] text-stone-400 sm:text-xs",
    loadingChip: "flex w-full items-center justify-center gap-2 border border-stone-300 bg-white px-3 py-2 text-sm text-stone-600 sm:w-auto",
  },
  "dark-tech": {
    page: "hacker-page relative flex min-h-[100svh] flex-col items-center justify-start px-3 py-4 sm:justify-center sm:px-4 sm:py-8",
    atmosphere: "hacker-scanlines pointer-events-none fixed inset-0 z-0 opacity-40",
    toast: "fixed bottom-4 left-1/2 z-40 w-[min(92vw,28rem)] -translate-x-1/2 border border-hacker-border bg-black/85 px-3 py-3 shadow-[0_0_24px_rgba(51,255,153,0.08)] sm:bottom-6 sm:px-4",
    toastText: "flex-1 font-mono text-xs leading-snug text-hacker-muted sm:text-sm",
    toastDismiss: "shrink-0 font-mono text-lg leading-none text-hacker-muted hover:text-hacker-green",
    overlay: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-[2px]",
    modal: "hacker-frame w-full max-w-md p-5 sm:p-6",
    modalEyebrow: "font-mono text-[10px] uppercase tracking-[0.28em] text-hacker-green",
    modalTitle: "mt-3 font-hacker text-3xl leading-none text-white sm:text-4xl",
    modalBody: "mt-3 font-mono text-sm leading-relaxed text-hacker-muted sm:text-base",
    secondaryBtn: "hacker-chip flex-1 !normal-case justify-center px-4 py-3 text-sm",
    primaryBtn: "flex-1 border border-hacker-green bg-hacker-green/15 px-4 py-3 font-mono text-sm uppercase tracking-wider text-hacker-green transition hover:bg-hacker-green/25",
    statusCaption: "inline-block max-w-full truncate font-mono text-[10px] uppercase tracking-[0.28em] text-hacker-green sm:text-xs",
    title: "mt-2 font-hacker text-[2rem] leading-none text-white sm:text-5xl",
    tagline: "mt-1 font-mono text-xs text-hacker-muted sm:text-sm",
    hudBox: "hacker-frame px-2 py-1.5 text-hacker-fg sm:px-3 sm:py-2",
    hudLabel: "font-mono text-[9px] uppercase tracking-[0.18em] text-hacker-muted sm:text-[10px]",
    hudValue: "font-mono text-xl leading-none text-hacker-green sm:text-2xl",
    bestBox: "hacker-frame border-hacker-green/40 px-2 py-1.5 text-hacker-fg sm:px-3 sm:py-2",
    panel: "hacker-frame overflow-hidden",
    stripBar: "flex items-center justify-between gap-2 border-b border-hacker-border bg-black/60 px-2 py-1.5 sm:px-3",
    stripTitle: "font-mono text-xs uppercase tracking-[0.2em] text-hacker-green sm:text-sm",
    stripHint: "truncate font-mono text-[10px] uppercase tracking-wider text-hacker-muted sm:text-xs",
    footerHint: "font-mono text-[11px] uppercase leading-snug tracking-wider text-hacker-muted sm:text-xs",
    loadingChip: "flex w-full items-center justify-center gap-2 border border-hacker-border bg-black/50 px-3 py-2 font-mono text-sm text-hacker-muted sm:w-auto",
  },
};

export function pickTheme(): ThemeId {
  const themes: ThemeId[] = [
    "spider",
    "batman",
    "ironman",
    "goku",
    "naruto",
    "sasuke",
    "obito",
    "vegeta",
    "lantern",
    "superman",
    "wolverine",
    "fma",
    "jjk",
  ];
  // Dev override: ?game=jjk (or any ThemeId) on the portfolio URL
  if (typeof window !== "undefined") {
    const forced = new URLSearchParams(window.location.search).get("game");
    if (forced && (themes as string[]).includes(forced)) return forced as ThemeId;
  }
  return themes[Math.floor(Math.random() * themes.length)]!;
}

export function isCompactScreen() {
  return typeof window !== "undefined" && window.innerWidth < 640;
}

/** Size the game canvas for phone vs desktop and keep it sharp on retina. */
export function fitGameCanvas(canvas: HTMLCanvasElement) {
  const parent = canvas.parentElement;
  const cssW = Math.min(760, parent?.clientWidth ?? Math.min(760, window.innerWidth - 24));
  const compact = window.innerWidth < 640;
  // Taller playfield on phones so thumbs have room
  const ratio = compact ? 0.78 : 0.56;
  const maxH = compact ? Math.min(window.innerHeight * 0.52, 420) : Math.min(window.innerHeight * 0.55, 460);
  const cssH = Math.min(Math.round(cssW * ratio), maxH);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return { w: cssW, h: cssH, compact };
}

export function hudScale(w: number) {
  return Math.max(0.75, Math.min(1.15, w / 640));
}

export function GameShell({
  ready,
  onEnter,
  title,
  tagline,
  mobileTagline,
  strip,
  stripHint,
  loadingLabel,
  readyLabel,
  accent,
  accent2,
  score,
  secondaryLabel,
  secondaryValue,
  best,
  alive,
  aliveHint,
  deadHint,
  canvasRef,
  ariaLabel,
}: GameShellProps) {
  const portfolioTheme = useLoadingGamePortfolioTheme();
  const chrome = portfolioTheme ? SHELL_CHROME[portfolioTheme] : PENDING_CHROME;
  const [showToast, setShowToast] = useState(true);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [keptPlaying, setKeptPlaying] = useState(false);

  // Free-tier toast — auto-dismiss
  useEffect(() => {
    if (!showToast) return;
    const t = window.setTimeout(() => setShowToast(false), 7000);
    return () => window.clearTimeout(t);
  }, [showToast]);

  // When portfolio finishes loading, ask keep playing vs enter
  useEffect(() => {
    if (ready && !keptPlaying) {
      setShowReadyModal(true);
      setShowToast(false);
    }
  }, [ready, keptPlaying]);

  const keepPlaying = () => {
    setShowReadyModal(false);
    setKeptPlaying(true);
  };

  const enterBtnClass =
    portfolioTheme === "comic"
      ? cn(chrome.primaryBtn, "w-full px-5 py-3 text-xl sm:w-auto sm:text-2xl")
      : portfolioTheme === "dark-tech"
        ? cn(chrome.primaryBtn, "w-full justify-center px-5 py-3 sm:w-auto")
        : cn(chrome.primaryBtn, "w-full px-5 py-3 sm:w-auto");

  return (
    <main className={chrome.page}>
      <div className={chrome.atmosphere} aria-hidden="true" />
      {portfolioTheme === "dark-tech" ? (
        <div className="hacker-grid pointer-events-none fixed inset-0 -z-0 opacity-30" aria-hidden="true" />
      ) : null}

      {/* Free-tier toast */}
      {showToast && !showReadyModal && (
        <div role="status" className={chrome.toast}>
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            />
            <p className={chrome.toastText}>
              This app is deployed on free tier so it may take some time — but enjoy the game!
            </p>
            <button
              type="button"
              onClick={() => setShowToast(false)}
              className={chrome.toastDismiss}
              aria-label="Dismiss notice"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Portfolio ready modal */}
      {showReadyModal && (
        <div className={chrome.overlay} role="dialog" aria-modal="true" aria-labelledby="portfolio-ready-title">
          <div className={chrome.modal}>
            <p className={chrome.modalEyebrow}>Portfolio ready</p>
            <h2 id="portfolio-ready-title" className={chrome.modalTitle}>
              {portfolioTheme === "dark-tech"
                ? "Access granted"
                : portfolioTheme === "comic"
                  ? "Dossier unlocked!"
                  : "Portfolio ready"}
            </h2>
            <p className={chrome.modalBody}>
              Your portfolio finished loading. Keep playing this mini-game, or head in now — if you leave, you&apos;ll
              go straight to the portfolio.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button type="button" onClick={keepPlaying} className={chrome.secondaryBtn}>
                Keep playing
              </button>
              <button
                type="button"
                onClick={onEnter}
                className={chrome.primaryBtn}
                style={
                  portfolioTheme === "dark-tech"
                    ? { borderColor: accent, color: accent }
                    : { backgroundColor: accent }
                }
              >
                Open portfolio →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-3xl">
        <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className={chrome.statusCaption}>{ready ? readyLabel : loadingLabel}</p>
            <h1 className={chrome.title}>{title}</h1>
            <p className={cn(chrome.tagline, "hidden sm:block")}>{tagline}</p>
            <p className={cn(chrome.tagline, "sm:hidden")}>{mobileTagline ?? tagline}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <div
              className={chrome.hudBox}
              style={portfolioTheme === "comic" ? { backgroundColor: accent } : undefined}
            >
              <p className={chrome.hudLabel}>Score</p>
              <p className={chrome.hudValue} style={portfolioTheme !== "comic" ? { color: accent } : undefined}>
                {score}
              </p>
            </div>
            <div
              className={chrome.hudBox}
              style={portfolioTheme === "comic" ? { backgroundColor: accent2 } : undefined}
            >
              <p className={chrome.hudLabel}>{secondaryLabel}</p>
              <p className={chrome.hudValue} style={portfolioTheme !== "comic" ? { color: accent2 } : undefined}>
                {secondaryValue}
              </p>
            </div>
            <div className={chrome.bestBox}>
              <p className={chrome.hudLabel}>Best</p>
              <p className={chrome.hudValue}>{best}</p>
            </div>
          </div>
        </div>

        <div className={chrome.panel}>
          <div className={chrome.stripBar}>
            <span className={chrome.stripTitle}>{strip}</span>
            <span className={chrome.stripHint}>{stripHint}</span>
          </div>
          <canvas
            ref={canvasRef as RefObject<HTMLCanvasElement>}
            className="block w-full touch-none select-none"
            style={{ touchAction: "none" }}
            role="img"
            aria-label={ariaLabel}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className={chrome.footerHint}>{alive ? aliveHint : deadHint}</p>

          {ready ? (
            <button
              type="button"
              onClick={onEnter}
              className={enterBtnClass}
              style={
                portfolioTheme === "dark-tech"
                  ? { borderColor: accent, color: accent }
                  : { backgroundColor: accent }
              }
            >
              Enter portfolio →
            </button>
          ) : (
            <div className={chrome.loadingChip}>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: accent }} />
              Loading portfolio…
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  // Normalize negative sizes so callers can't crash the canvas with invalid arc radii
  if (w < 0) {
    x += w;
    w = -w;
  }
  if (h < 0) {
    y += h;
    h = -h;
  }
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
