import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Enemy = {
  x: number;
  y: number;
  vx: number;
  hp: number;
  w: number;
  h: number;
  hitFlash: number;
};

type Barrier = {
  x: number;
  life: number;
  maxLife: number;
  hp: number;
  kind: "wall" | "fist";
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

/**
 * Green Lantern: place hard-light barriers (tower-defense constructs).
 * Different from shooters / dash / fly-and-fire — you build will into walls.
 * Power-ups: Shield Ring · Giant Construct Fist.
 */
export default function GreenLanternConstructs({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [will, setWill] = useState(0);
  const [mode, setMode] = useState<"base" | "shield" | "fist">("base");

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    will: 0,
    cooldown: 0,
    spawnIn: 35,
    enemies: [] as Enemy[],
    barriers: [] as Barrier[],
    parts: [] as Particle[],
    shake: 0,
    shieldT: 0,
    fistT: 0,
    announce: "",
    announceT: 0,
    specialCd: 0,
    ringPulse: 0,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_lantern") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const heroX = () => state.current.w * 0.14;
    const ground = () => state.current.h * 0.72;
    const btnShield = () => ({ x: state.current.w - 108, y: state.current.h - 52, w: 44, h: 36 });
    const btnFist = () => ({ x: state.current.w - 56, y: state.current.h - 52, w: 44, h: 36 });

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
    };

    const burst = (x: number, y: number, color: string, n = 12, size = 3) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.4 + Math.random() * 3.5;
        state.current.parts.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 18,
          color,
          size,
        });
      }
    };

    const syncMode = () => {
      const s = state.current;
      const next = s.fistT > 0 ? "fist" : s.shieldT > 0 ? "shield" : "base";
      setMode(next);
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.will = 0;
      s.cooldown = 0;
      s.spawnIn = 25;
      s.enemies = [];
      s.barriers = [];
      s.parts = [];
      s.shake = 0;
      s.shieldT = 0;
      s.fistT = 0;
      s.announce = "WILLPOWER!";
      s.announceT = 50;
      s.specialCd = 0;
      s.ringPulse = 0;
      setAlive(true);
      setScore(0);
      setWill(0);
      setMode("base");
    };

    const placeWall = (px: number) => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.cooldown > 0) return;

      // During giant fist mode, tap fires a sweeping fist construct instead
      if (s.fistT > 0) {
        const gY = ground();
        s.barriers.push({ x: s.w * 0.35, life: 40, maxLife: 40, hp: 99, kind: "fist" });
        s.cooldown = 16;
        s.shake = 10;
        s.ringPulse = 12;
        burst(heroX() + 60, gY - 40, "#86efac", 20, 4);
        return;
      }

      const minX = heroX() + 50;
      const maxX = s.w * 0.85;
      const x = Math.max(minX, Math.min(maxX, px));

      // Cap active walls
      s.barriers = s.barriers.filter((b) => b.kind === "wall" || b.life > 0);
      const walls = s.barriers.filter((b) => b.kind === "wall");
      if (walls.length >= 4) {
        // Remove oldest wall
        const oldest = walls.reduce((a, b) => (a.life < b.life ? a : b));
        oldest.life = 0;
      }

      s.barriers.push({
        x,
        life: 150,
        maxLife: 150,
        hp: 4,
        kind: "wall",
      });
      s.cooldown = 8;
      s.ringPulse = 8;
      burst(x, ground() - 30, "#4ade80", 10, 2);
    };

    const activateShield = () => {
      const s = state.current;
      if (!s.alive || s.specialCd > 0 || s.shieldT > 0 || s.fistT > 0) return;
      if (s.will < 50) {
        s.announce = "NEED 50 WILL!";
        s.announceT = 35;
        return;
      }
      s.will -= 50;
      setWill(s.will);
      s.shieldT = 200;
      s.specialCd = 18;
      s.shake = 6;
      s.announce = "SHIELD RING!";
      s.announceT = 50;
      burst(heroX(), ground() - 20, "#86efac", 22, 3);
      syncMode();
    };

    const activateFist = () => {
      const s = state.current;
      if (!s.alive || s.specialCd > 0 || s.fistT > 0) return;
      if (s.will < 100) {
        s.announce = "NEED 100 WILL!";
        s.announceT = 35;
        return;
      }
      s.will = 0;
      setWill(0);
      s.shieldT = 0;
      s.fistT = 260;
      s.specialCd = 22;
      s.shake = 12;
      s.announce = "GIANT CONSTRUCT!";
      s.announceT = 60;
      burst(heroX() + 40, ground() - 40, "#22c55e", 30, 4);
      syncMode();
    };

    const drawLantern = (x: number, y: number) => {
      const s = state.current;
      const f = s.frame;

      // Green will aura
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const auraR = 32 + (s.shieldT > 0 ? 18 : 0) + Math.sin(f / 5) * 3 + s.ringPulse;
      const aura = ctx.createRadialGradient(x, y - 8, 4, x, y - 8, auraR);
      aura.addColorStop(0, "rgba(134,239,172,0.45)");
      aura.addColorStop(0.45, "rgba(34,197,94,0.25)");
      aura.addColorStop(1, "transparent");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(x, y - 6, auraR * 0.7, auraR, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Shield ring special
      if (s.shieldT > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(74,222,128,${0.55 + Math.sin(f / 4) * 0.2})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y - 4, 36 + Math.sin(f / 3) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(187,247,208,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - 4, 42, f / 10, f / 10 + Math.PI * 1.2);
        ctx.stroke();
        ctx.restore();
      }

      // Boots
      ctx.fillStyle = "#14532d";
      roundRect(ctx, x - 12, y + 28, 11, 8, 2);
      ctx.fill();
      roundRect(ctx, x + 1, y + 28, 11, 8, 2);
      ctx.fill();

      // Green suit
      ctx.fillStyle = "#16a34a";
      ctx.strokeStyle = "#14532d";
      ctx.lineWidth = 1.5;
      roundRect(ctx, x - 13, y - 8, 26, 40, 5);
      ctx.fill();
      ctx.stroke();

      // Black torso accents
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x - 13, y + 4, 26, 8);
      // Chest lantern emblem
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(x, y - 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14532d";
      ctx.fillRect(x - 5, y - 5, 10, 2);
      ctx.fillRect(x - 5, y + 1, 10, 2);
      ctx.fillRect(x - 2, y - 5, 4, 8);

      // Arms + glowing ring hand
      ctx.fillStyle = "#16a34a";
      roundRect(ctx, x - 20, y - 2, 9, 14, 3);
      ctx.fill();
      roundRect(ctx, x + 11, y - 4, 16, 9, 3);
      ctx.fill();
      ctx.fillStyle = "#f5c89a";
      ctx.beginPath();
      ctx.arc(x - 16, y + 12, 3.5, 0, Math.PI * 2);
      ctx.arc(x + 28, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // Power ring
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 28, y, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(x + 28, y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Head + mask
      ctx.fillStyle = "#f5c89a";
      ctx.beginPath();
      ctx.ellipse(x, y - 22, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      // Hair
      ctx.beginPath();
      ctx.ellipse(x, y - 28, 10, 6, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Mask
      ctx.fillStyle = "#14532d";
      roundRect(ctx, x - 9, y - 26, 18, 8, 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(x - 3.5, y - 22, 2.2, 2.5, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 3.5, y - 22, 2.2, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(x - 3.5, y - 22, 1, 0, Math.PI * 2);
      ctx.arc(x + 3.5, y - 22, 1, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawBarrier = (b: Barrier) => {
      const gY = ground();
      const alpha = Math.min(1, b.life / 40);
      ctx.save();
      ctx.globalAlpha = 0.35 + alpha * 0.55;
      ctx.globalCompositeOperation = "lighter";

      if (b.kind === "fist") {
        const progress = 1 - b.life / b.maxLife;
        const fx = b.x + progress * (state.current.w * 0.7);
        const glow = ctx.createRadialGradient(fx, gY - 40, 4, fx, gY - 40, 50);
        glow.addColorStop(0, "#fff");
        glow.addColorStop(0.35, "#86efac");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(fx, gY - 40, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#22c55e";
        ctx.strokeStyle = "#bbf7d0";
        ctx.lineWidth = 2.5;
        roundRect(ctx, fx - 28, gY - 70, 70, 55, 12);
        ctx.fill();
        ctx.stroke();
        // Knuckles
        for (let i = 0; i < 4; i++) {
          ctx.strokeRect(fx - 16 + i * 14, gY - 62, 10, 28);
        }
        ctx.restore();
        return;
      }

      const h = 55 + Math.sin(state.current.frame / 6 + b.x) * 3;
      const glow = ctx.createLinearGradient(b.x, gY - h, b.x, gY);
      glow.addColorStop(0, "rgba(187,247,208,0.9)");
      glow.addColorStop(0.5, "rgba(74,222,128,0.7)");
      glow.addColorStop(1, "rgba(21,128,61,0.3)");
      ctx.fillStyle = glow;
      ctx.strokeStyle = "#bbf7d0";
      ctx.lineWidth = 2.5;
      // Hexagonal hard-light pillar
      const hw = 14;
      ctx.beginPath();
      ctx.moveTo(b.x, gY - h);
      ctx.lineTo(b.x + hw, gY - h + 8);
      ctx.lineTo(b.x + hw, gY - 8);
      ctx.lineTo(b.x, gY);
      ctx.lineTo(b.x - hw, gY - 8);
      ctx.lineTo(b.x - hw, gY - h + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Lantern glyph
      ctx.strokeStyle = "#14532d";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, gY - h / 2, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#14532d";
      ctx.fillRect(b.x - 4, gY - h / 2 - 1, 8, 2);
      ctx.restore();
    };

    const drawBtn = (b: { x: number; y: number; w: number; h: number }, label: string, on: boolean, color: string) => {
      ctx.fillStyle = on ? color : "rgba(30,41,59,0.7)";
      ctx.strokeStyle = on ? "#fff" : "#64748b";
      ctx.lineWidth = 2;
      roundRect(ctx, b.x, b.y, b.w, b.h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "700 8px Comic Neue, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 3);
      ctx.textAlign = "left";
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      if (s.cooldown > 0) s.cooldown--;
      if (s.announceT > 0) s.announceT--;
      if (s.specialCd > 0) s.specialCd--;
      if (s.ringPulse > 0) s.ringPulse--;
      if (s.shieldT > 0) {
        s.shieldT--;
        if (s.shieldT === 0) syncMode();
      }
      if (s.fistT > 0) {
        s.fistT--;
        if (s.fistT === 0) {
          s.announce = "CONSTRUCT FADED";
          s.announceT = 35;
          syncMode();
        }
      }
      s.shake *= 0.86;
      const gY = ground();
      const hx = heroX();

      // Barriers age
      for (const b of s.barriers) {
        b.life--;
        if (b.kind === "fist") {
          // Fist sweeps and damages
          const progress = 1 - b.life / b.maxLife;
          const fx = b.x + progress * (s.w * 0.7);
          for (const e of s.enemies) {
            if (e.hp <= 0) continue;
            if (Math.abs(e.x - fx) < 45) {
              e.hp -= 3;
              e.hitFlash = 6;
              if (e.hp <= 0) {
                s.score += 40;
                s.will = Math.min(100, s.will + 12);
                setScore(s.score);
                setWill(s.will);
                burst(e.x, gY - 20, "#86efac", 12, 3);
              }
            }
          }
        }
      }
      s.barriers = s.barriers.filter((b) => b.life > 0 && b.hp > 0);

      if (s.alive) {
        if (--s.spawnIn <= 0) {
          s.enemies.push({
            x: s.w + 20,
            y: gY,
            vx: -(1.35 + Math.min(1.5, s.score * 0.002) + Math.random() * 0.45),
            hp: 2 + (Math.random() < 0.35 ? 1 : 0),
            w: 22,
            h: 40,
            hitFlash: 0,
          });
          s.spawnIn = Math.max(26, 52 - Math.min(18, s.score / 70));
        }

        for (const e of s.enemies) {
          let blocked = false;
          for (const b of s.barriers) {
            if (b.kind !== "wall") continue;
            if (Math.abs(e.x - b.x) < 18) {
              blocked = true;
              e.x = b.x + 18;
              e.hp -= 1;
              e.hitFlash = 6;
              b.hp -= 1;
              b.life -= 20;
              burst(b.x, gY - 30, "#4ade80", 6, 2);
              if (e.hp <= 0) {
                s.score += 30;
                s.will = Math.min(100, s.will + 18);
                setScore(s.score);
                setWill(s.will);
                burst(e.x, gY - 20, "#86efac", 12, 3);
              }
              break;
            }
          }
          if (!blocked) e.x += e.vx * (s.fistT > 0 ? 0.75 : 1);
          if (e.hitFlash > 0) e.hitFlash--;
        }

        s.enemies = s.enemies.filter((e) => e.hp > 0 && e.x > -40);
        s.barriers = s.barriers.filter((b) => b.life > 0 && b.hp > 0);

        for (const e of s.enemies) {
          const reach = s.shieldT > 0 ? hx + 38 : hx + 18;
          if (e.x - e.w / 2 < reach) {
            if (s.shieldT > 0) {
              e.x += 50;
              e.hp -= 2;
              e.hitFlash = 8;
              burst(hx + 30, gY - 20, "#86efac", 8, 2);
              if (e.hp <= 0) {
                s.score += 25;
                s.will = Math.min(100, s.will + 10);
                setScore(s.score);
                setWill(s.will);
              }
              continue;
            }
            s.alive = false;
            setAlive(false);
            burst(hx, gY - 20, "#ef4444", 20, 3);
            s.shake = 12;
            localStorage.setItem(
              "stackfolio_best_lantern",
              String(Math.max(Number(localStorage.getItem("stackfolio_best_lantern") || 0), s.score)),
            );
            setBest(Math.max(Number(localStorage.getItem("stackfolio_best_lantern") || 0), s.score));
            break;
          }
        }
        if (s.frame % 12 === 0) setScore(s.score);
      }

      for (const p of s.parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      }
      s.parts = s.parts.filter((p) => p.life > 0);

      ctx.save();
      if (s.shake > 0.5) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      // Space / Oa dusk
      const sky = ctx.createLinearGradient(0, 0, 0, s.h);
      if (s.fistT > 0) {
        sky.addColorStop(0, "#052e16");
        sky.addColorStop(1, "#14532d");
      } else {
        sky.addColorStop(0, "#0f172a");
        sky.addColorStop(0.55, "#064e3b");
        sky.addColorStop(1, "#022c22");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      // Stars
      ctx.fillStyle = "rgba(187,247,208,0.35)";
      for (let i = 0; i < 16; i++) {
        ctx.fillRect((i * 89 + s.frame * 0.2) % s.w, (i * 41) % (gY - 20), 2, 2);
      }

      ctx.fillStyle = "#1c1917";
      ctx.fillRect(0, gY, s.w, s.h - gY);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(0, gY, s.w, 3);

      // Placement hint lane
      if (s.alive && s.fistT <= 0) {
        ctx.fillStyle = "rgba(74,222,128,0.06)";
        ctx.fillRect(hx + 50, gY - 60, s.w * 0.7, 60);
      }

      for (const b of s.barriers) drawBarrier(b);

      for (const e of s.enemies) {
        // Yellow fear corps vibe
        ctx.fillStyle = e.hitFlash > 0 ? "#fef08a" : "#a16207";
        ctx.strokeStyle = "#422006";
        ctx.lineWidth = 2;
        roundRect(ctx, e.x - e.w / 2, e.y - e.h, e.w, e.h * 0.7, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f5c89a";
        ctx.beginPath();
        ctx.ellipse(e.x, e.y - e.h - 2, 7, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(e.x, e.y - e.h - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 16);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      }

      drawLantern(hx, gY - 4);

      // Will meter
      const meterW = Math.min(s.w - 40, 220);
      const meterX = (s.w - meterW) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, meterX, 12, meterW, 12, 6);
      ctx.fill();
      ctx.fillStyle = s.fistT > 0 ? "#4ade80" : s.shieldT > 0 ? "#86efac" : "#22c55e";
      roundRect(ctx, meterX, 12, (s.will / 100) * meterW, 12, 6);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      roundRect(ctx, meterX, 12, meterW, 12, 6);
      ctx.stroke();

      drawBtn(btnShield(), "SHIELD", s.will >= 50 && s.shieldT <= 0 && s.fistT <= 0, "#16a34a");
      drawBtn(btnFist(), "FIST", s.will >= 100 && s.fistT <= 0, "#15803d");

      const hs = hudScale(s.w);
      ctx.fillStyle = "#86efac";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(18 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`XP ${s.score}`, 12, s.h - 36);
      ctx.fillText(`XP ${s.score}`, 12, s.h - 36);
      ctx.fillStyle = "#4ade80";
      ctx.font = `700 ${Math.round(13 * hs)}px Bangers, Impact, sans-serif`;
      let label = `WILL ${Math.round(s.will)}%`;
      if (s.fistT > 0) label = `GIANT FIST ${Math.ceil(s.fistT / 60)}s`;
      else if (s.shieldT > 0) label = `SHIELD ${Math.ceil(s.shieldT / 60)}s`;
      ctx.strokeText(label, 12, s.h - 16);
      ctx.fillText(label, 12, s.h - 16);

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, s.h * 0.26, s.w, 40);
        ctx.fillStyle = "#86efac";
        ctx.font = `700 ${Math.round(22 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText(s.announce, s.w / 2 - s.announce.length * 5.5 * hs, s.h * 0.26 + 28);
        ctx.fillText(s.announce, s.w / 2 - s.announce.length * 5.5 * hs, s.h * 0.26 + 28);
      }

      if (s.alive && s.frame < 110 && s.announceT <= 0) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `700 ${Math.round(12 * hs)}px Comic Neue, sans-serif`;
        const tip = s.w < 500 ? "Tap to place constructs!" : "Tap to place hard-light walls · SHIELD / FIST";
        ctx.fillText(tip, s.w / 2 - (s.w < 500 ? 70 : 150), s.h * 0.22);
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#ef4444";
        ctx.font = `700 ${Math.round(28 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText("WILL BROKEN!", s.w / 2 - 90 * hs, s.h / 2);
        ctx.fillText("WILL BROKEN!", s.w / 2 - 90 * hs, s.h / 2);
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to try again", s.w / 2 - 52, s.h / 2 + 28);
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
    const hit = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
      p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) placeWall(state.current.w * 0.45);
      }
      if (e.code === "KeyC") {
        e.preventDefault();
        activateShield();
      }
      if (e.code === "KeyV") {
        e.preventDefault();
        activateFist();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const p = pos(e);
      if (hit(p, btnShield())) return activateShield();
      if (hit(p, btnFist())) return activateFist();
      placeWall(p.x);
    };

    resize();
    reset();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <GameShell
      ready={ready}
      onEnter={onEnter}
      title="Will Constructs"
      tagline="Place hard-light walls · Shield Ring · Giant Fist"
      mobileTagline="Tap to place constructs"
      strip="IN BRIGHTEST DAY"
      stripHint={mode === "fist" ? "Giant Construct!" : mode === "shield" ? "Shield Ring!" : `Will ${will}%`}
      loadingLabel="Charging the ring… loading portfolio"
      readyLabel="Sector secure — open the dossier"
      accent="#16a34a"
      accent2="#0f172a"
      score={score}
      secondaryLabel="Will"
      secondaryValue={will}
      best={best}
      alive={alive}
      aliveHint="Tap to place green walls that block enemies. C/SHIELD (50) · V/FIST (100)."
      deadHint="Will broken! Tap to try again."
      canvasRef={canvasRef}
      ariaLabel="Green Lantern construct defense mini-game"
    />
  );
}
