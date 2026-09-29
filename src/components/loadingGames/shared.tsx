import type { RefObject } from "react";

export type ThemeId = "spider" | "batman" | "ironman" | "goku" | "naruto" | "sasuke" | "vegeta" | "lantern";

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

export function pickTheme(): ThemeId {
  const themes: ThemeId[] = ["spider", "batman", "ironman", "goku", "naruto", "sasuke", "vegeta", "lantern"];
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
  return (
    <main className="comic-page flex min-h-[100svh] flex-col items-center justify-start px-3 py-4 sm:justify-center sm:px-4 sm:py-8">
      <div className="comic-speedlines pointer-events-none fixed inset-0 opacity-50" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-3xl">
        <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="comic-caption inline-block max-w-full -rotate-1 truncate px-2 py-1 text-[10px] font-bold uppercase sm:px-3 sm:text-xs">
              {ready ? readyLabel : loadingLabel}
            </p>
            <h1 className="comic-title mt-2 text-[2rem] leading-none text-comic-ink sm:text-5xl">{title}</h1>
            <p className="mt-1 hidden font-comic-body text-sm font-bold text-comic-ink/70 sm:block">{tagline}</p>
            <p className="mt-1 font-comic-body text-xs font-bold text-comic-ink/70 sm:hidden">{mobileTagline ?? tagline}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <div className="border-4 border-comic-ink px-2 py-1.5 text-white shadow-comic sm:px-3 sm:py-2" style={{ backgroundColor: accent }}>
              <p className="font-comic-body text-[9px] font-bold uppercase opacity-80 sm:text-[10px]">Score</p>
              <p className="font-comic text-xl leading-none sm:text-2xl">{score}</p>
            </div>
            <div className="border-4 border-comic-ink px-2 py-1.5 text-white shadow-comic sm:px-3 sm:py-2" style={{ backgroundColor: accent2 }}>
              <p className="font-comic-body text-[9px] font-bold uppercase opacity-80 sm:text-[10px]">{secondaryLabel}</p>
              <p className="font-comic text-xl leading-none sm:text-2xl">{secondaryValue}</p>
            </div>
            <div className="border-4 border-comic-ink bg-comic-yellow px-2 py-1.5 shadow-comic sm:px-3 sm:py-2">
              <p className="font-comic-body text-[9px] font-bold uppercase sm:text-[10px]">Best</p>
              <p className="font-comic text-xl leading-none sm:text-2xl">{best}</p>
            </div>
          </div>
        </div>

        <div className="comic-panel overflow-hidden shadow-comic-pink">
          <div className="flex items-center justify-between gap-2 border-b-4 border-comic-ink bg-comic-ink px-2 py-1 text-comic-cream sm:px-3 sm:py-1.5">
            <span className="font-comic text-sm tracking-wide text-comic-cyan sm:text-lg">{strip}</span>
            <span className="truncate font-comic-body text-[10px] font-bold uppercase text-comic-pink sm:text-xs">{stripHint}</span>
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
          <p className="font-comic-body text-[11px] font-bold uppercase leading-snug tracking-wide text-comic-ink/60 sm:text-xs">
            {alive ? aliveHint : deadHint}
          </p>

          {ready ? (
            <button
              type="button"
              onClick={onEnter}
              className="comic-burst w-full px-5 py-3 font-comic text-xl tracking-wide text-white sm:w-auto sm:text-2xl"
              style={{ backgroundColor: accent }}
            >
              Enter portfolio →
            </button>
          ) : (
            <div className="comic-caption flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-bold sm:w-auto">
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
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
