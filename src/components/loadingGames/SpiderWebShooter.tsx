import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Villain = { id: number; x: number; y: number; w: number; h: number; vx: number; hp: number; kind: 0 | 1 | 2; hitFlash: number };
type Shot = { x: number; y: number; vx: number; vy: number; life: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

const PX = 58;
const PY = 0.58;

/** Aim + shoot webs at incoming villains. */
export default function SpiderWebShooter({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const aimRef = useRef({ x: 400, y: 180 });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [kills, setKills] = useState(0);
  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    kills: 0,
    spawnIn: 32,
    cool: 0,
    villains: [] as Villain[],
    shots: [] as Shot[],
    parts: [] as Particle[],
    id: 1,
    shake: 0,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_spider") || 0));
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
      aimRef.current = { x: w * 0.72, y: h * 0.42 };
    };

    const burst = (x: number, y: number, color: string, n = 10) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 3.5;
        state.current.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 18, color, size: 3 });
      }
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.kills = 0;
      s.spawnIn = 30;
      s.cool = 0;
      s.villains = [];
      s.shots = [];
      s.parts = [];
      s.shake = 0;
      setAlive(true);
      setScore(0);
      setKills(0);
    };

    const fire = () => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.cool > 0) return;
      const oy = s.h * PY + 18;
      const ox = PX + 44;
      const dx = aimRef.current.x - ox;
      const dy = aimRef.current.y - oy;
      const len = Math.hypot(dx, dy) || 1;
      s.shots.push({ x: ox, y: oy, vx: (dx / len) * 11.5, vy: (dy / len) * 11.5, life: 55 });
      s.cool = 13;
      burst(ox, oy, "#f8fafc", 5);
    };

    const toCanvas = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      aimRef.current = {
        x: ((e.clientX - r.left) / r.width) * state.current.w,
        y: ((e.clientY - r.top) / r.height) * state.current.h,
      };
    };

    const drawHero = (x: number, y: number) => {
      ctx.strokeStyle = "#1e3a8a";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 44);
      ctx.lineTo(x + 4, y + 62);
      ctx.moveTo(x + 22, y + 44);
      ctx.lineTo(x + 30, y + 62);
      ctx.stroke();

      const torso = ctx.createLinearGradient(x, y + 16, x + 34, y + 50);
      torso.addColorStop(0, "#ff1a1a");
      torso.addColorStop(1, "#9b0000");
      ctx.fillStyle = torso;
      ctx.strokeStyle = "#070707";
      ctx.lineWidth = 2.5;
      roundRect(ctx, x + 4, y + 18, 28, 28, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1d4ed8";
      roundRect(ctx, x + 10, y + 22, 16, 14, 4);
      ctx.fill();

      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x + 18, y + 30, 4 + i * 4, -0.8, 0.8);
        ctx.stroke();
      }
      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.ellipse(x + 18, y + 29, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      const head = ctx.createRadialGradient(x + 16, y + 8, 2, x + 18, y + 10, 14);
      head.addColorStop(0, "#ff4444");
      head.addColorStop(1, "#c40000");
      ctx.fillStyle = head;
      ctx.beginPath();
      ctx.ellipse(x + 18, y + 11, 14, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#070707";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.ellipse(x + 12, y + 10, 5.5, 7, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 24, y + 10, 5.5, 7, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#070707";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(x + 12, y + 10, 5.5, 7, -0.25, 0, Math.PI * 2);
      ctx.ellipse(x + 24, y + 10, 5.5, 7, 0.25, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "#c40000";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x + 30, y + 26);
      ctx.lineTo(x + 42, y + 18);
      ctx.stroke();
      ctx.fillStyle = "#1d4ed8";
      ctx.beginPath();
      ctx.arc(x + 44, y + 17, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#070707";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      if (s.cool > 0) s.cool--;
      s.shake *= 0.85;

      if (s.alive) {
        if (--s.spawnIn <= 0) {
          const kind = Math.floor(Math.random() * 3) as 0 | 1 | 2;
          s.villains.push({
            id: s.id++,
            x: s.w + 20,
            y: 36 + Math.random() * s.h * 0.5,
            w: kind === 2 ? 38 : 30,
            h: kind === 2 ? 46 : 34,
            vx: -(2.1 + Math.random() * 1.5) * (1 + Math.min(2, s.kills * 0.08)),
            hp: kind + 1,
            kind,
            hitFlash: 0,
          });
          s.spawnIn = Math.max(16, 46 - s.kills + Math.random() * 16);
        }

        for (const shot of s.shots) {
          shot.x += shot.vx;
          shot.y += shot.vy;
          shot.life--;
        }
        s.shots = s.shots.filter((shot) => shot.life > 0);

        for (const v of s.villains) {
          v.x += v.vx;
          v.y += Math.sin((s.frame + v.id) / 18) * 0.4;
          if (v.hitFlash > 0) v.hitFlash--;
          for (const shot of s.shots) {
            if (shot.x > v.x && shot.x < v.x + v.w && shot.y > v.y && shot.y < v.y + v.h) {
              shot.life = 0;
              v.hp--;
              v.hitFlash = 6;
              burst(shot.x, shot.y, "#fff", 6);
              if (v.hp <= 0) {
                burst(v.x + v.w / 2, v.y + v.h / 2, "#e10600", 14);
                s.kills++;
                s.score += 100 + v.kind * 50;
                s.shake = 6;
                setKills(s.kills);
                setScore(s.score);
              }
            }
          }
          if (v.x < PX + 38 && v.x + v.w > PX && Math.abs(v.y - s.h * PY) < 44) {
            s.alive = false;
            setAlive(false);
            const next = Math.max(best, s.score);
            localStorage.setItem("stackfolio_best_spider", String(Math.max(Number(localStorage.getItem("stackfolio_best_spider") || 0), s.score)));
            setBest(next);
          }
        }
        s.villains = s.villains.filter((v) => v.hp > 0 && v.x + v.w > 0);
      }

      for (const p of s.parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      }
      s.parts = s.parts.filter((p) => p.life > 0);

      ctx.save();
      if (s.shake > 0.5) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      const g = ctx.createLinearGradient(0, 0, s.w, s.h);
      g.addColorStop(0, "#14081f");
      g.addColorStop(0.5, "#0b1630");
      g.addColorStop(1, "#1a0820");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s.w, s.h);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      for (let i = 0; i < 14; i++) {
        const bx = (i * 70 + s.frame * 0.3) % (s.w + 40) - 20;
        ctx.fillRect(bx, s.h - (40 + (i * 37) % 90) - 22, 36, 40 + (i * 37) % 90);
      }
      ctx.fillStyle = "#141018";
      ctx.fillRect(0, s.h - 26, s.w, 26);
      ctx.fillStyle = "#e10600";
      ctx.fillRect(0, s.h - 26, s.w, 4);

      // aim
      const handX = PX + 44;
      const handY = s.h * PY + 18;
      ctx.strokeStyle = "rgba(5,217,232,0.35)";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(aimRef.current.x, aimRef.current.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#ff2a6d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(aimRef.current.x, aimRef.current.y, 10, 0, Math.PI * 2);
      ctx.stroke();

      for (const v of s.villains) {
        const body = v.hitFlash ? "#fff" : ["#7b2cbf", "#0f766e", "#b45309"][v.kind]!;
        ctx.fillStyle = body;
        ctx.strokeStyle = "#050505";
        ctx.lineWidth = 2.5;
        roundRect(ctx, v.x, v.y, v.w, v.h, 7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffe66d";
        for (let i = 0; i < v.hp; i++) ctx.fillRect(v.x + 4 + i * 8, v.y + v.h - 9, 6, 4);
      }

      for (const shot of s.shots) {
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(shot.x, shot.y);
        ctx.lineTo(shot.x - shot.vx * 1.6, shot.y - shot.vy * 1.6);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 16);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      }

      drawHero(PX, s.h * PY);

      ctx.fillStyle = "#ffe66d";
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 3;
      const hs = hudScale(s.w);
      ctx.font = `700 ${Math.round(22 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`THWIP ${s.score}`, 14, 28 * hs + 8);
      ctx.fillText(`THWIP ${s.score}`, 14, 28 * hs + 8);

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#e10600";
        ctx.font = `700 ${Math.round(36 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText("GOTCHA!", s.w / 2 - 70 * hs, s.h / 2);
        ctx.fillText("GOTCHA!", s.w / 2 - 70 * hs, s.h / 2);
        ctx.fillStyle = "#fff6df";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to retry", s.w / 2 - 40, s.h / 2 + 28);
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        fire();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      toCanvas(e);
    };
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      toCanvas(e);
      fire();
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
      title="Web Shooter"
      tagline="Aim and thwip webs — classic spider combat"
      mobileTagline="Tap where you want to shoot"
      strip="THWIP MODE"
      stripHint="Ranged web combat"
      loadingLabel="Villains inbound… loading portfolio"
      readyLabel="City clear — open the issue"
      accent="#e10600"
      accent2="#1e3a8a"
      score={score}
      secondaryLabel="KOs"
      secondaryValue={kills}
      best={best}
      alive={alive}
      aliveHint="Shooter: aim with mouse, click / Space to fire webs."
      deadHint="Webbed out! Tap to fight again."
      canvasRef={canvasRef}
      ariaLabel="Spider-Man web shooter mini-game"
    />
  );
}
