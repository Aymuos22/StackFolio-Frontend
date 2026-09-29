import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Thug = {
  id: number;
  x: number;
  side: 1 | -1;
  w: number;
  h: number;
  speed: number;
  hp: number;
  hitFlash: number;
  kind: 0 | 1;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

/**
 * Batman melee timing game — punch thugs when they enter the strike zone.
 * Totally different from the spider shooter.
 */
export default function BatmanAlleyBrawl({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [combo, setCombo] = useState(0);

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    combo: 0,
    spawnIn: 40,
    punchT: 0,
    punchSide: 1 as 1 | -1,
    thugs: [] as Thug[],
    parts: [] as Particle[],
    id: 1,
    shake: 0,
    missFlash: 0,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_batman") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const cx = () => state.current.w / 2;
    const ground = () => state.current.h * 0.72;
    const zone = () => Math.max(state.current.w < 500 ? 120 : 110, state.current.w * 0.2);

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
    };

    const burst = (x: number, y: number, color: string, n = 12) => {
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
      s.combo = 0;
      s.spawnIn = 70;
      s.punchT = 0;
      s.thugs = [];
      s.parts = [];
      s.shake = 0;
      s.missFlash = 0;
      setAlive(true);
      setScore(0);
      setCombo(0);
    };

    const punch = (side: 1 | -1) => {
      const s = state.current;
      if (!s.alive) return reset();
      s.punchT = 12;
      s.punchSide = side;

      const center = cx();
      const g = ground();
      const reach = zone() + 28;

      // Hit the closest thug on that side inside the (forgiving) strike reach
      let best: Thug | null = null;
      let bestDist = Infinity;
      for (const t of s.thugs) {
        const mid = t.x + t.w / 2;
        const onSide = side === 1 ? mid >= center - 8 : mid <= center + 8;
        const dist = Math.abs(mid - center);
        if (onSide && dist < reach && dist < bestDist) {
          best = t;
          bestDist = dist;
        }
      }

      if (best) {
        best.hp = 0;
        best.hitFlash = 6;
        burst(best.x + best.w / 2, g - 20, "#f5d76e", 12);
        burst(best.x + best.w / 2, g - 24, "#e5e7eb", 14);
        s.combo += 1;
        s.score += 80 + s.combo * 15 + best.kind * 30;
        setCombo(s.combo);
        setScore(s.score);
        s.shake = 5;
        s.thugs = s.thugs.filter((t) => t.hp > 0);
      } else {
        // Misses don't wipe combo hard — just tick it down
        s.combo = Math.max(0, s.combo - 1);
        s.missFlash = 6;
        setCombo(s.combo);
        s.shake = 1;
      }
    };

    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * state.current.w;
      punch(x >= state.current.w / 2 ? 1 : -1);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        punch(-1);
      }
      if (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "Space") {
        e.preventDefault();
        punch(1);
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const drawBatman = (x: number, y: number, punchSide: 1 | -1, punchT: number) => {
      // Cape
      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 8);
      ctx.quadraticCurveTo(x - 28, y + 28, x - 16, y + 58);
      ctx.lineTo(x + 16, y + 58);
      ctx.quadraticCurveTo(x + 28, y + 28, x + 6, y + 8);
      ctx.fill();

      // Legs
      ctx.fillStyle = "#111827";
      ctx.fillRect(x - 10, y + 36, 8, 20);
      ctx.fillRect(x + 2, y + 36, 8, 20);

      // Torso
      const armor = ctx.createLinearGradient(x - 14, y, x + 14, y + 40);
      armor.addColorStop(0, "#1f2937");
      armor.addColorStop(1, "#030712");
      ctx.fillStyle = armor;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2.5;
      roundRect(ctx, x - 14, y + 8, 28, 30, 6);
      ctx.fill();
      ctx.stroke();

      // Emblem
      ctx.fillStyle = "#f5d76e";
      ctx.beginPath();
      ctx.ellipse(x, y + 22, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.moveTo(x - 7, y + 22);
      ctx.lineTo(x - 3, y + 18);
      ctx.lineTo(x, y + 21);
      ctx.lineTo(x + 3, y + 18);
      ctx.lineTo(x + 7, y + 22);
      ctx.lineTo(x + 3, y + 24);
      ctx.lineTo(x, y + 22);
      ctx.lineTo(x - 3, y + 24);
      ctx.closePath();
      ctx.fill();

      // Cowl + ears
      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 12, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 4);
      ctx.lineTo(x - 6, y - 16);
      ctx.lineTo(x - 2, y - 4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 4);
      ctx.lineTo(x + 6, y - 16);
      ctx.lineTo(x + 9, y - 4);
      ctx.fill();
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.ellipse(x - 4, y + 2, 3.5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 4, y + 2, 3.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Punch fist
      if (punchT > 0) {
        const reach = 18 + (10 - punchT) * 3;
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.arc(x + punchSide * reach, y + 18, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f5d76e";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (punchT > 6) {
          ctx.strokeStyle = "#f5d76e";
          ctx.font = "700 16px Bangers, Impact, sans-serif";
          ctx.strokeText("POW", x + punchSide * (reach + 12) - 16, y + 8);
          ctx.fillStyle = "#f5d76e";
          ctx.fillText("POW", x + punchSide * (reach + 12) - 16, y + 8);
        }
      }
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      if (s.punchT > 0) s.punchT--;
      if (s.missFlash > 0) s.missFlash--;
      s.shake *= 0.85;
      const center = cx();
      const gY = ground();

      if (s.alive) {
        if (--s.spawnIn <= 0 && s.thugs.length < 2) {
          const side = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
          // Prefer empty side if one thug already exists
          const preferred =
            s.thugs.length === 1 ? ((s.thugs[0]!.side === 1 ? -1 : 1) as 1 | -1) : side;
          const kind = Math.random() > 0.85 ? 1 : 0;
          const baseSpeed = 0.95 + Math.random() * 0.45 + Math.min(0.55, s.score / 2500);
          s.thugs.push({
            id: s.id++,
            x: preferred === 1 ? s.w + 40 : -50,
            side: preferred,
            w: kind ? 36 : 30,
            h: kind ? 44 : 36,
            speed: baseSpeed * (preferred === 1 ? -1 : 1),
            hp: 1,
            hitFlash: 0,
            kind: kind as 0 | 1,
          });
          s.spawnIn = 55 + Math.random() * 35;
        }

        for (const t of s.thugs) {
          t.x += t.speed;
          if (t.hitFlash > 0) t.hitFlash--;
          // Only lose when they're almost on top of Batman (was 22 — too harsh)
          if (Math.abs(t.x + t.w / 2 - center) < 14) {
            s.alive = false;
            setAlive(false);
            burst(center, gY - 20, "#f5d76e", 20);
            localStorage.setItem(
              "stackfolio_best_batman",
              String(Math.max(Number(localStorage.getItem("stackfolio_best_batman") || 0), s.score)),
            );
            setBest(Math.max(Number(localStorage.getItem("stackfolio_best_batman") || 0), s.score));
          }
        }
        s.thugs = s.thugs.filter((t) => t.x > -80 && t.x < s.w + 80 && t.hp > 0);
      }

      for (const p of s.parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      }
      s.parts = s.parts.filter((p) => p.life > 0);

      ctx.save();
      if (s.shake > 0.5) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      // Alley background
      const bg = ctx.createLinearGradient(0, 0, 0, s.h);
      bg.addColorStop(0, "#020617");
      bg.addColorStop(1, "#111827");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, s.w, s.h);

      // Brick walls
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, 70, s.h);
      ctx.fillRect(s.w - 70, 0, 70, s.h);
      ctx.fillStyle = "#334155";
      for (let y = 0; y < s.h; y += 14) {
        for (let x = 0; x < 70; x += 22) {
          ctx.fillRect(x + (y % 28 === 0 ? 0 : 11), y, 20, 12);
          ctx.fillRect(s.w - 70 + x + (y % 28 === 0 ? 0 : 11), y, 20, 12);
        }
      }

      // Ground
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, gY, s.w, s.h - gY);
      ctx.fillStyle = "#f5d76e";
      ctx.fillRect(0, gY, s.w, 3);

      // Strike zones
      ctx.fillStyle = s.missFlash ? "rgba(239,68,68,0.2)" : "rgba(245,215,110,0.12)";
      ctx.fillRect(center - zone(), gY - 70, zone() * 2, 70);
      ctx.strokeStyle = "rgba(245,215,110,0.45)";
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(center - zone(), gY - 70, zone(), 70);
      ctx.strokeRect(center, gY - 70, zone(), 70);
      ctx.setLineDash([]);
      ctx.fillStyle = "#f5d76e";
      ctx.font = `700 ${Math.round(11 * hudScale(s.w))}px Comic Neue, sans-serif`;
      ctx.fillText("◀ TAP LEFT", center - zone() + 8, gY - 78);
      ctx.fillText("TAP RIGHT ▶", center + 8, gY - 78);

      for (const t of s.thugs) {
        const body = t.hitFlash ? "#fff" : t.kind ? "#7c2d12" : "#365314";
        ctx.fillStyle = body;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2.5;
        roundRect(ctx, t.x, gY - t.h, t.w, t.h, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fde68a";
        ctx.fillRect(t.x + 6, gY - t.h + 8, t.w - 12, 8);
        ctx.fillStyle = "#000";
        ctx.fillRect(t.x + 8, gY - t.h + 10, 4, 4);
        ctx.fillRect(t.x + t.w - 12, gY - t.h + 10, 4, 4);
        for (let i = 0; i < t.hp; i++) {
          ctx.fillStyle = "#f5d76e";
          ctx.fillRect(t.x + 4 + i * 8, gY - 8, 6, 4);
        }
      }

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 16);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
        ctx.globalAlpha = 1;
      }

      drawBatman(center, gY - 56, s.punchSide, s.punchT);

      ctx.fillStyle = "#f5d76e";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      const hs = hudScale(s.w);
      ctx.font = `700 ${Math.round(22 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`JUSTICE ${s.score}`, 14, 28 * hs + 8);
      ctx.fillText(`JUSTICE ${s.score}`, 14, 28 * hs + 8);
      if (s.combo > 1) {
        ctx.fillStyle = "#e5e7eb";
        ctx.font = `700 ${Math.round(16 * hs)}px Bangers, Impact, sans-serif`;
        ctx.fillText(`COMBO x${s.combo}`, 14, 50 * hs + 8);
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#f5d76e";
        ctx.font = `700 ${Math.round(34 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText("AMBUSHED!", s.w / 2 - 90 * hs, s.h / 2);
        ctx.fillText("AMBUSHED!", s.w / 2 - 90 * hs, s.h / 2);
        ctx.fillStyle = "#fff6df";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to retry", s.w / 2 - 40, s.h / 2 + 28);
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    resize();
    reset();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointer, { passive: false });
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <GameShell
      ready={ready}
      onEnter={onEnter}
      title="Alley Brawl"
      tagline="Melee timing — punch left / right when thugs enter the yellow zone"
      mobileTagline="Tap left or right side to punch"
      strip="GOTHAM NIGHT"
      stripHint="Close-quarters combat"
      loadingLabel="Gotham stirring… loading portfolio"
      readyLabel="Streets quiet — open the batcave"
      accent="#f5d76e"
      accent2="#111827"
      score={score}
      secondaryLabel="Combo"
      secondaryValue={combo}
      best={best}
      alive={alive}
      aliveHint="Brawler: punch when thugs enter the wide yellow zone. Click left/right (or A/D)."
      deadHint="Ambushed! Tap to try again — it's more forgiving now."
      canvasRef={canvasRef}
      ariaLabel="Batman alley brawl mini-game"
    />
  );
}
