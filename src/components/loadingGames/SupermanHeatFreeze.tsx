import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Rock = {
  x: number;
  y: number;
  vy: number;
  r: number;
  alive: boolean;
  frozen: boolean;
  rot: number;
  spin: number;
  shatter: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
};

/**
 * Simple Superman: slide under kryptonite.
 * Tap alternates freeze breath ↔ red heat vision.
 */
export default function SupermanHeatFreeze({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const targetX = useRef(320);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [cleared, setCleared] = useState(0);

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    cleared: 0,
    x: 320,
    spawnIn: 30,
    rocks: [] as Rock[],
    parts: [] as Particle[],
    shake: 0,
    heatT: 0,
    freezeT: 0,
    actionCd: 0,
    nextAction: "freeze" as "freeze" | "heat",
    announce: "",
    announceT: 0,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_superman") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const ground = () => state.current.h * 0.8;
    const beamW = () => Math.max(70, state.current.w * 0.16);

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
      state.current.x = w / 2;
      targetX.current = w / 2;
    };

    const burst = (x: number, y: number, color: string, n = 14, size = 3) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.2 + Math.random() * 4;
        state.current.parts.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1,
          life: 22,
          max: 22,
          color,
          size: size + Math.random() * 2,
        });
      }
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.cleared = 0;
      s.x = s.w / 2;
      targetX.current = s.x;
      s.spawnIn = 25;
      s.rocks = [];
      s.parts = [];
      s.shake = 0;
      s.heatT = 0;
      s.freezeT = 0;
      s.actionCd = 0;
      s.nextAction = "freeze";
      s.announce = "TAP: FREEZE → HEAT → FREEZE…";
      s.announceT = 70;
      setAlive(true);
      setScore(0);
      setCleared(0);
    };

    const die = () => {
      const s = state.current;
      if (!s.alive) return;
      s.alive = false;
      setAlive(false);
      s.shake = 14;
      burst(s.x, ground() - 24, "#4ade80", 28, 4);
      localStorage.setItem(
        "stackfolio_best_superman",
        String(Math.max(Number(localStorage.getItem("stackfolio_best_superman") || 0), s.score)),
      );
      setBest(Math.max(Number(localStorage.getItem("stackfolio_best_superman") || 0), s.score));
    };

    const fireHeat = () => {
      const s = state.current;
      if (!s.alive) return;
      s.heatT = 22;
      s.shake = 8;
      s.announce = "HEAT VISION!";
      s.announceT = 30;
      const half = beamW() / 2;
      let hits = 0;

      for (const rock of s.rocks) {
        if (!rock.alive || rock.shatter > 0) continue;
        if (Math.abs(rock.x - s.x) <= half + rock.r) {
          rock.shatter = 16;
          rock.alive = false;
          hits += 1;
          const pts = rock.frozen ? 35 : 18;
          s.score += pts;
          s.cleared += 1;
          burst(rock.x, rock.y, "#ef4444", 10, 3);
          if (rock.frozen) burst(rock.x, rock.y, "#e0f2fe", 8, 2);
        }
      }
      setScore(s.score);
      setCleared(s.cleared);
      burst(s.x, ground() - 50, "#f87171", 12 + hits, 3);
    };

    const fireFreeze = () => {
      const s = state.current;
      if (!s.alive) return;
      s.freezeT = 26;
      s.shake = 4;
      s.announce = "FREEZE BREATH!";
      s.announceT = 28;
      const range = Math.max(130, s.w * 0.32);
      burst(s.x, ground() - 60, "#7dd3fc", 16, 3);

      for (const rock of s.rocks) {
        if (!rock.alive || rock.shatter > 0) continue;
        if (Math.abs(rock.x - s.x) < range) {
          rock.frozen = true;
          rock.vy = 0;
          burst(rock.x, rock.y, "#bae6fd", 6, 2);
        }
      }
    };

    /** Tap cycles: freeze → heat → freeze → … */
    const tapAction = () => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.actionCd > 0 || s.heatT > 0 || s.freezeT > 0) return;

      if (s.nextAction === "freeze") {
        fireFreeze();
        s.nextAction = "heat";
      } else {
        fireHeat();
        s.nextAction = "freeze";
      }
      s.actionCd = 12;
    };

    const drawSuperman = (x: number, y: number) => {
      const s = state.current;
      const bob = Math.sin(s.frame / 8) * 2;
      const py = y + bob;
      const lean = s.heatT > 0 ? 2 : s.freezeT > 0 ? -1 : 0;
      const capeWave = Math.sin(s.frame / 5) * 6;

      // Soft ground shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(x, ground() + 2, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cape (animated)
      ctx.fillStyle = "#b91c1c";
      ctx.beginPath();
      ctx.moveTo(x - 4 + lean, py - 10);
      ctx.quadraticCurveTo(x - 28 + capeWave, py + 8, x - 24 + capeWave * 0.5, py + 38);
      ctx.quadraticCurveTo(x - 10, py + 28, x - 2, py + 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.moveTo(x - 4 + lean, py - 10);
      ctx.quadraticCurveTo(x - 22 + capeWave * 0.7, py + 4, x - 16, py + 32);
      ctx.lineTo(x - 2, py + 12);
      ctx.fill();

      // Legs / boots
      ctx.fillStyle = "#1d4ed8";
      roundRect(ctx, x - 11, py + 14, 9, 16, 3);
      ctx.fill();
      roundRect(ctx, x + 2, py + 14, 9, 16, 3);
      ctx.fill();
      ctx.fillStyle = "#dc2626";
      roundRect(ctx, x - 12, py + 26, 10, 8, 2);
      ctx.fill();
      roundRect(ctx, x + 2, py + 26, 10, 8, 2);
      ctx.fill();

      // Body
      ctx.fillStyle = "#2563eb";
      ctx.strokeStyle = "#1e3a8a";
      ctx.lineWidth = 1.5;
      roundRect(ctx, x - 12 + lean, py - 10, 24, 28, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(x - 12 + lean, py + 10, 24, 7);
      ctx.fillStyle = "#eab308";
      ctx.fillRect(x - 12 + lean, py + 9, 24, 2);

      // S emblem
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.moveTo(x + lean, py - 10);
      ctx.lineTo(x + 8 + lean, py - 5);
      ctx.lineTo(x + 6 + lean, py + 4);
      ctx.lineTo(x + lean, py + 7);
      ctx.lineTo(x - 6 + lean, py + 4);
      ctx.lineTo(x - 8 + lean, py - 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 9px Bangers, Impact, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("S", x + lean, py + 2);
      ctx.textAlign = "left";

      // Arms
      ctx.fillStyle = "#2563eb";
      if (s.heatT > 0) {
        // Arms forward for heat vision
        roundRect(ctx, x + 8, py - 8, 20, 8, 3);
        ctx.fill();
        roundRect(ctx, x - 16, py - 2, 8, 12, 3);
        ctx.fill();
      } else if (s.freezeT > 0) {
        roundRect(ctx, x + 6, py - 4, 16, 8, 3);
        ctx.fill();
        roundRect(ctx, x - 18, py - 4, 10, 10, 3);
        ctx.fill();
      } else {
        roundRect(ctx, x - 18, py - 2, 8, 13, 3);
        ctx.fill();
        roundRect(ctx, x + 10, py - 2, 8, 13, 3);
        ctx.fill();
      }
      ctx.fillStyle = "#f5c89a";
      ctx.beginPath();
      if (s.heatT > 0) {
        ctx.arc(x + 28, py - 4, 4, 0, Math.PI * 2);
        ctx.arc(x - 12, py + 10, 3.5, 0, Math.PI * 2);
      } else {
        ctx.arc(x - 14, py + 11, 3.5, 0, Math.PI * 2);
        ctx.arc(x + 14, py + 11, 3.5, 0, Math.PI * 2);
      }
      ctx.fill();

      // Head
      ctx.fillStyle = "#f5c89a";
      ctx.beginPath();
      ctx.ellipse(x + lean, py - 24, 9.5, 10.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Hair + curl
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.ellipse(x + lean, py - 30, 9.5, 6.5, 0, Math.PI * 1.05, Math.PI * 2.05);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 1 + lean, py - 32);
      ctx.quadraticCurveTo(x + 3 + lean, py - 42, x + 7 + lean, py - 30);
      ctx.quadraticCurveTo(x + 2 + lean, py - 34, x - 1 + lean, py - 32);
      ctx.fill();

      // Eyes
      if (s.heatT > 0) {
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(x - 3.5 + lean, py - 24, 3, 2.8, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 3.5 + lean, py - 24, 3, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.ellipse(x - 3.5 + lean, py - 24, 2, 2, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 3.5 + lean, py - 24, 2, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.freezeT > 0) {
        ctx.fillStyle = "#e0f2fe";
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(x - 3.5 + lean, py - 24, 2.4, 2.6, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 3.5 + lean, py - 24, 2.4, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.ellipse(x - 3.5 + lean, py - 24, 2, 2.3, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 3.5 + lean, py - 24, 2, 2.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const drawRock = (rock: Rock) => {
      if (rock.shatter > 0) {
        // Shatter pieces
        const t = 1 - rock.shatter / 16;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = rock.frozen ? "#7dd3fc" : "#22c55e";
          ctx.beginPath();
          ctx.moveTo(rock.x + Math.cos(a) * t * 20, rock.y + Math.sin(a) * t * 20);
          ctx.lineTo(rock.x + Math.cos(a + 0.5) * (rock.r * (1 - t)), rock.y + Math.sin(a + 0.4) * rock.r * (1 - t));
          ctx.lineTo(rock.x + Math.cos(a - 0.5) * rock.r * 0.4, rock.y + Math.sin(a - 0.3) * rock.r * 0.4);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        return;
      }

      ctx.save();
      ctx.translate(rock.x, rock.y);
      ctx.rotate(rock.rot);
      if (rock.frozen) {
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#67e8f9";
        ctx.strokeStyle = "#e0f2fe";
      } else {
        ctx.shadowColor = "#4ade80";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#22c55e";
        ctx.strokeStyle = "#14532d";
      }
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -rock.r);
      ctx.lineTo(rock.r * 0.75, -rock.r * 0.15);
      ctx.lineTo(rock.r * 0.5, rock.r);
      ctx.lineTo(-rock.r * 0.55, rock.r * 0.8);
      ctx.lineTo(-rock.r * 0.8, -rock.r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.moveTo(-3, -rock.r * 0.45);
      ctx.lineTo(2, -rock.r * 0.05);
      ctx.lineTo(-2, rock.r * 0.15);
      ctx.fill();
      ctx.restore();
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      if (s.announceT > 0) s.announceT--;
      if (s.actionCd > 0) s.actionCd--;
      if (s.heatT > 0) s.heatT--;
      if (s.freezeT > 0) s.freezeT--;
      s.shake *= 0.88;

      const gY = ground();
      s.x += (targetX.current - s.x) * 0.25;
      s.x = Math.max(40, Math.min(s.w - 40, s.x));

      if (s.alive) {
        if (--s.spawnIn <= 0) {
          s.rocks.push({
            x: 50 + Math.random() * (s.w - 100),
            y: -24,
            vy: 1.55 + Math.min(1.8, s.score * 0.0025) + Math.random() * 0.6,
            r: 13 + Math.random() * 7,
            alive: true,
            frozen: false,
            rot: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 0.1,
            shatter: 0,
          });
          s.spawnIn = Math.max(18, 38 - Math.min(14, s.score / 60));
        }

        for (const rock of s.rocks) {
          if (rock.shatter > 0) {
            rock.shatter--;
            continue;
          }
          if (!rock.alive) continue;
          if (rock.frozen) {
            rock.y += 0.2;
            rock.rot += rock.spin * 0.15;
          } else {
            rock.y += rock.vy;
            rock.rot += rock.spin;
          }

          if (rock.y + rock.r >= gY - 4) {
            if (Math.abs(rock.x - s.x) < 30 + rock.r) die();
            rock.alive = false;
            rock.shatter = 10;
            burst(rock.x, gY - 4, "#166534", 8, 2);
          } else if (!rock.frozen && Math.hypot(rock.x - s.x, rock.y - (gY - 22)) < rock.r + 18) {
            die();
          }
        }

        s.rocks = s.rocks.filter((r) => r.shatter > 0 || (r.alive && r.y < s.h + 30));
        if (s.frame % 15 === 0) setScore(s.score);
      }

      for (const p of s.parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life--;
      }
      s.parts = s.parts.filter((p) => p.life > 0);

      // --- DRAW ---
      ctx.save();
      if (s.shake > 0.4) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      const sky = ctx.createLinearGradient(0, 0, 0, s.h);
      sky.addColorStop(0, "#0f172a");
      sky.addColorStop(0.5, "#1e3a8a");
      sky.addColorStop(1, "#312e81");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      // Subtle green kryptonite tint in air
      ctx.fillStyle = "rgba(34,197,94,0.06)";
      ctx.fillRect(0, 0, s.w, gY);

      ctx.fillStyle = "#292524";
      ctx.fillRect(0, gY, s.w, s.h - gY);
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(0, gY, s.w, 3);

      // Freeze breath mist
      if (s.freezeT > 0) {
        const t = s.freezeT / 26;
        const range = Math.max(130, s.w * 0.32);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const mist = ctx.createRadialGradient(s.x, gY - 40, 8, s.x, gY - 100, range);
        mist.addColorStop(0, `rgba(224,242,254,${0.55 * t})`);
        mist.addColorStop(0.45, `rgba(56,189,248,${0.28 * t})`);
        mist.addColorStop(1, "transparent");
        ctx.fillStyle = mist;
        ctx.beginPath();
        ctx.moveTo(s.x - 8, gY - 24);
        ctx.lineTo(s.x - range, 0);
        ctx.lineTo(s.x + range, 0);
        ctx.lineTo(s.x + 8, gY - 24);
        ctx.fill();
        // Rising ice particles
        for (let i = 0; i < 8; i++) {
          const px = s.x + Math.sin(s.frame / 4 + i) * (range * 0.5);
          const py = gY - 40 - ((s.frame * 3 + i * 20) % (gY - 20));
          ctx.fillStyle = `rgba(186,230,253,${0.5 * t})`;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Heat vision — bold red column
      if (s.heatT > 0) {
        const t = Math.min(1, s.heatT / 12);
        const half = beamW() / 2;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        const outer = ctx.createLinearGradient(s.x - half, 0, s.x + half, 0);
        outer.addColorStop(0, "transparent");
        outer.addColorStop(0.25, `rgba(220,38,38,${0.45 * t})`);
        outer.addColorStop(0.5, `rgba(254,202,202,${0.9 * t})`);
        outer.addColorStop(0.75, `rgba(220,38,38,${0.45 * t})`);
        outer.addColorStop(1, "transparent");
        ctx.fillStyle = outer;
        ctx.fillRect(s.x - half, 0, half * 2, gY - 18);

        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 24;
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * t})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(s.x, gY - 30);
        ctx.lineTo(s.x, 4);
        ctx.stroke();
        ctx.strokeStyle = `rgba(239,68,68,${0.95 * t})`;
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(s.x, gY - 30);
        ctx.lineTo(s.x, 4);
        ctx.stroke();

        // Eye origin glow
        const eye = ctx.createRadialGradient(s.x, gY - 32, 1, s.x, gY - 32, 28);
        eye.addColorStop(0, "#fff");
        eye.addColorStop(0.3, "#f87171");
        eye.addColorStop(1, "transparent");
        ctx.fillStyle = eye;
        ctx.beginPath();
        ctx.arc(s.x, gY - 32, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const rock of s.rocks) drawRock(rock);

      for (const p of s.parts) {
        ctx.globalAlpha = p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      drawSuperman(s.x, gY - 8);

      // Next-action pill
      const nextFreeze = s.nextAction === "freeze";
      const pillW = 120;
      const pillX = s.w - pillW - 12;
      const pillY = s.h - 48;
      ctx.fillStyle = nextFreeze ? "#0284c7" : "#dc2626";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      roundRect(ctx, pillX, pillY, pillW, 34, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "700 12px Comic Neue, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(nextFreeze ? "TAP: FREEZE" : "TAP: HEAT", pillX + pillW / 2, pillY + 22);
      ctx.textAlign = "left";

      const hs = hudScale(s.w);
      ctx.fillStyle = "#fde047";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(20 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`${s.score}`, 14, s.h - 40);
      ctx.fillText(`${s.score}`, 14, s.h - 40);
      ctx.fillStyle = "#86efac";
      ctx.font = `700 ${Math.round(13 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`CLEARED ${s.cleared}`, 14, s.h - 20);
      ctx.fillText(`CLEARED ${s.cleared}`, 14, s.h - 20);

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, s.h * 0.2, s.w, 36);
        ctx.fillStyle = s.heatT > 0 ? "#f87171" : "#7dd3fc";
        ctx.font = `700 ${Math.round(20 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText(s.announce, s.w / 2, s.h * 0.2 + 26);
        ctx.fillText(s.announce, s.w / 2, s.h * 0.2 + 26);
        ctx.textAlign = "left";
      }

      if (s.alive && s.frame < 90 && s.announceT <= 0) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `700 ${Math.round(13 * hs)}px Comic Neue, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("Slide to move  ·  Tap alternates FREEZE / HEAT", s.w / 2, s.h * 0.16);
        ctx.textAlign = "left";
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#4ade80";
        ctx.font = `700 ${Math.round(32 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText("KRYPTONITE!", s.w / 2, s.h / 2);
        ctx.fillText("KRYPTONITE!", s.w / 2, s.h / 2);
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to try again", s.w / 2, s.h / 2 + 28);
        ctx.textAlign = "left";
      }

      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * state.current.w,
        y: ((e.clientY - r.top) / r.height) * state.current.h,
      };
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        targetX.current = Math.max(40, targetX.current - 48);
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        targetX.current = Math.min(state.current.w - 40, targetX.current + 48);
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) tapAction();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      targetX.current = pos(e).x;
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const p = pos(e);
      if (!state.current.alive) return reset();
      targetX.current = p.x;
      tapAction();
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
      title="Kryptonite Rain"
      tagline="Slide under kryptonite · tap alternates freeze breath and heat vision"
      mobileTagline="Slide · tap FREEZE / HEAT alternately"
      strip="MAN OF STEEL"
      stripHint={`Cleared ${cleared}`}
      loadingLabel="Solar charge rising… loading portfolio"
      readyLabel="Sky clear — open the issue"
      accent="#1d4ed8"
      accent2="#dc2626"
      score={score}
      secondaryLabel="Cleared"
      secondaryValue={cleared}
      best={best}
      alive={alive}
      aliveHint="Move to dodge. Each tap switches: FREEZE locks rocks, then HEAT clears the red column."
      deadHint="Kryptonite hit! Tap to try again."
      canvasRef={canvasRef}
      ariaLabel="Superman kryptonite rain mini-game"
    />
  );
}
