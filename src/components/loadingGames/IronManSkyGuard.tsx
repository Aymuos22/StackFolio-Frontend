import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Hazard = { x: number; y: number; w: number; h: number; vx: number; kind: "missile" | "drone" };
type Ring = { x: number; y: number; r: number; vx: number; taken: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

/**
 * Iron Man flight dodge — move with mouse/finger, collect rings, avoid missiles.
 * Completely different from shooter / brawler.
 */
export default function IronManSkyGuard({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const targetY = useRef(180);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [rings, setRings] = useState(0);

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    rings: 0,
    y: 180,
    spawnH: 35,
    spawnR: 50,
    hazards: [] as Hazard[],
    collect: [] as Ring[],
    parts: [] as Particle[],
    shake: 0,
    trail: [] as { x: number; y: number; life: number }[],
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_ironman") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
      state.current.y = h * 0.45;
      targetY.current = h * 0.45;
    };

    const burst = (x: number, y: number, color: string, n = 14) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 4;
        state.current.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 20, color });
      }
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.rings = 0;
      s.y = s.h * 0.45;
      targetY.current = s.y;
      s.spawnH = 30;
      s.spawnR = 40;
      s.hazards = [];
      s.collect = [];
      s.parts = [];
      s.trail = [];
      s.shake = 0;
      setAlive(true);
      setScore(0);
      setRings(0);
    };

    const pointer = (e: PointerEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      targetY.current = ((e.clientY - r.top) / r.height) * state.current.h;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        targetY.current -= 28;
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        targetY.current += 28;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!state.current.alive) reset();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const drawIronMan = (x: number, y: number) => {
      // Thruster glow
      const thrust = ctx.createRadialGradient(x - 6, y + 10, 1, x - 6, y + 10, 18);
      thrust.addColorStop(0, "#e0f2fe");
      thrust.addColorStop(0.4, "#38bdf8");
      thrust.addColorStop(1, "rgba(3,105,161,0)");
      ctx.fillStyle = thrust;
      ctx.beginPath();
      ctx.arc(x - 8, y + 10, 16, 0, Math.PI * 2);
      ctx.fill();

      // Legs angled for flight
      ctx.fillStyle = "#b91c1c";
      ctx.strokeStyle = "#7f1d1d";
      ctx.lineWidth = 2;
      roundRect(ctx, x + 2, y + 18, 7, 16, 3);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, x + 14, y + 18, 7, 16, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(x + 3, y + 30, 5, 3);
      ctx.fillRect(x + 15, y + 30, 5, 3);

      // Torso
      const chest = ctx.createLinearGradient(x, y - 6, x + 28, y + 22);
      chest.addColorStop(0, "#f87171");
      chest.addColorStop(1, "#991b1b");
      ctx.fillStyle = chest;
      ctx.strokeStyle = "#450a0a";
      ctx.lineWidth = 2.5;
      roundRect(ctx, x, y - 4, 28, 26, 8);
      ctx.fill();
      ctx.stroke();

      // Arc reactor
      const reactor = ctx.createRadialGradient(x + 14, y + 8, 1, x + 14, y + 8, 7);
      reactor.addColorStop(0, "#f0f9ff");
      reactor.addColorStop(0.5, "#38bdf8");
      reactor.addColorStop(1, "#0369a1");
      ctx.fillStyle = reactor;
      ctx.beginPath();
      ctx.arc(x + 14, y + 8, 6, 0, Math.PI * 2);
      ctx.fill();

      // Helmet
      ctx.fillStyle = "#dc2626";
      roundRect(ctx, x + 2, y - 20, 24, 18, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fbbf24";
      roundRect(ctx, x + 6, y - 15, 16, 10, 3);
      ctx.fill();
      ctx.fillStyle = "#7dd3fc";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 8;
      ctx.fillRect(x + 8, y - 12, 5, 3);
      ctx.fillRect(x + 15, y - 12, 5, 3);
      ctx.shadowBlur = 0;

      // Forward hand repulsor idle glow
      ctx.fillStyle = "#b91c1c";
      roundRect(ctx, x + 24, y + 2, 14, 8, 3);
      ctx.fill();
      ctx.fillStyle = "#7dd3fc";
      ctx.beginPath();
      ctx.arc(x + 38, y + 6, 4, 0, Math.PI * 2);
      ctx.fill();
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      s.shake *= 0.85;

      // Smooth follow mouse Y
      const minY = 36;
      const maxY = s.h - 50;
      targetY.current = Math.max(minY, Math.min(maxY, targetY.current));
      s.y += (targetY.current - s.y) * 0.18;

      if (s.alive) {
        s.score += 1;
        if (s.frame % 8 === 0) setScore(s.score);

        s.trail.push({ x: 90, y: s.y + 8, life: 12 });
        s.trail = s.trail.filter((t) => {
          t.life--;
          t.x -= 4;
          return t.life > 0;
        });

        if (--s.spawnH <= 0) {
          const kind = Math.random() > 0.55 ? "missile" : "drone";
          s.hazards.push({
            x: s.w + 20,
            y: 40 + Math.random() * (s.h - 100),
            w: kind === "missile" ? 34 : 28,
            h: kind === "missile" ? 12 : 24,
            vx: -(3.2 + Math.random() * 2 + Math.min(3, s.score / 900)),
            kind,
          });
          s.spawnH = Math.max(14, 36 - s.score / 400 + Math.random() * 14);
        }

        if (--s.spawnR <= 0) {
          s.collect.push({
            x: s.w + 10,
            y: 50 + Math.random() * (s.h - 120),
            r: 12,
            vx: -2.6,
            taken: false,
          });
          s.spawnR = 35 + Math.random() * 35;
        }

        for (const h of s.hazards) h.x += h.vx;
        for (const r of s.collect) r.x += r.vx;

        const hx = 96;
        const hy = s.y;
        const hw = 34;
        const hh = 28;

        for (const r of s.collect) {
          if (!r.taken && Math.hypot(r.x - (hx + 14), r.y - (hy + 6)) < r.r + 16) {
            r.taken = true;
            s.rings++;
            s.score += 120;
            setRings(s.rings);
            setScore(s.score);
            burst(r.x, r.y, "#fbbf24", 12);
          }
        }

        for (const h of s.hazards) {
          if (hx < h.x + h.w && hx + hw > h.x && hy < h.y + h.h && hy + hh > h.y) {
            s.alive = false;
            setAlive(false);
            burst(hx + 14, hy + 10, "#ef4444", 22);
            localStorage.setItem(
              "stackfolio_best_ironman",
              String(Math.max(Number(localStorage.getItem("stackfolio_best_ironman") || 0), s.score)),
            );
            setBest(Math.max(Number(localStorage.getItem("stackfolio_best_ironman") || 0), s.score));
            s.shake = 10;
          }
        }

        s.hazards = s.hazards.filter((h) => h.x > -60);
        s.collect = s.collect.filter((r) => !r.taken && r.x > -40);
      } else if (s.frame % 30 === 0) {
        // allow idle
      }

      for (const p of s.parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      }
      s.parts = s.parts.filter((p) => p.life > 0);

      ctx.save();
      if (s.shake > 0.5) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      const sky = ctx.createLinearGradient(0, 0, s.w, s.h);
      sky.addColorStop(0, "#0c1b2a");
      sky.addColorStop(0.5, "#1a1030");
      sky.addColorStop(1, "#2a0a12");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      // Clouds / smoke
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 140 - s.frame * 1.2) % (s.w + 120)) - 60;
        ctx.beginPath();
        ctx.ellipse(cx, 40 + i * 28, 50, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // City silhouette bottom
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      for (let i = 0; i < 12; i++) {
        ctx.fillRect(i * 70, s.h - 30 - ((i * 47) % 50), 50, 80);
      }

      // Trail
      for (const t of s.trail) {
        ctx.globalAlpha = t.life / 12;
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Rings
      for (const r of s.collect) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r - 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hazards
      for (const h of s.hazards) {
        if (h.kind === "missile") {
          ctx.fillStyle = "#ef4444";
          ctx.strokeStyle = "#7f1d1d";
          ctx.lineWidth = 2;
          roundRect(ctx, h.x, h.y, h.w, h.h, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.moveTo(h.x + h.w, h.y);
          ctx.lineTo(h.x + h.w + 10, h.y + h.h / 2);
          ctx.lineTo(h.x + h.w, h.y + h.h);
          ctx.fill();
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(h.x - 8, h.y + 2, 8, h.h - 4);
        } else {
          ctx.fillStyle = "#7c3aed";
          ctx.strokeStyle = "#4c1d95";
          ctx.lineWidth = 2;
          roundRect(ctx, h.x, h.y, h.w, h.h, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#f472b6";
          ctx.fillRect(h.x + 6, h.y + 6, h.w - 12, 6);
        }
      }

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 16);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
        ctx.globalAlpha = 1;
      }

      drawIronMan(90, s.y);

      // Guide
      ctx.strokeStyle = "rgba(56,189,248,0.25)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, targetY.current + 10);
      ctx.lineTo(s.w, targetY.current + 10);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      const hs = hudScale(s.w);
      ctx.font = `700 ${Math.round(22 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`POWER ${s.score}`, 14, 28 * hs + 8);
      ctx.fillText(`POWER ${s.score}`, 14, 28 * hs + 8);

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#f87171";
        ctx.font = `700 ${Math.round(30 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText("SYSTEMS DOWN!", s.w / 2 - 110 * hs, s.h / 2);
        ctx.fillText("SYSTEMS DOWN!", s.w / 2 - 110 * hs, s.h / 2);
        ctx.fillStyle = "#e0f2fe";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to reboot", s.w / 2 - 42, s.h / 2 + 28);
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      pointer(e);
      if (!state.current.alive) reset();
    };
    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      pointer(e);
    };

    resize();
    reset();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <GameShell
      ready={ready}
      onEnter={onEnter}
      title="Sky Guard"
      tagline="Flight dodge — move with mouse / W·S, collect rings, avoid missiles"
      mobileTagline="Drag up/down to fly · grab rings · dodge missiles"
      strip="JARVIS ONLINE"
      stripHint="Aerial evasion"
      loadingLabel="Armor assembling… loading portfolio"
      readyLabel="Systems nominal — open the brief"
      accent="#f5a623"
      accent2="#b71c1c"
      score={score}
      secondaryLabel="Rings"
      secondaryValue={rings}
      best={best}
      alive={alive}
      aliveHint="Flyer: move vertically with mouse. Grab gold rings. Dodge red missiles."
      deadHint="Suit down! Tap or Space to reboot."
      canvasRef={canvasRef}
      ariaLabel="Iron Man sky guard flight mini-game"
    />
  );
}
