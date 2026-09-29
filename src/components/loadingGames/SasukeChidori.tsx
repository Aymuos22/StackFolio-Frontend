import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Enemy = {
  x: number;
  y: number;
  vx: number;
  hp: number;
  burn: number;
  w: number;
  h: number;
  hitFlash: number;
  hitToken: number;
};

type Slash = { x: number; y: number; vx: number; life: number; big: boolean; dmg: number; struck: Set<Enemy> };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type Form = "base" | "mangekyo" | "susanoo";

/**
 * Sasuke: Chidori dash melee (not projectile spam like Naruto).
 * Power-ups: Mangekyo Sharingan (Amaterasu burn) · Susanoo avatar smash.
 */
export default function SasukeChidori({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [ocular, setOcular] = useState(0);
  const [form, setForm] = useState<Form>("base");

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    ocular: 0,
    form: "base" as Form,
    x: 100,
    dashT: 0,
    dashVx: 0,
    cooldown: 0,
    spawnIn: 40,
    enemies: [] as Enemy[],
    slashes: [] as Slash[],
    parts: [] as Particle[],
    shake: 0,
    mangekyoT: 0,
    susanooT: 0,
    announce: "",
    announceT: 0,
    specialCd: 0,
    homeX: 100,
    hitToken: 1,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_sasuke") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const ground = () => state.current.h * 0.72;
    const btnM = () => ({ x: state.current.w - 108, y: state.current.h - 52, w: 44, h: 36 });
    const btnS = () => ({ x: state.current.w - 56, y: state.current.h - 52, w: 44, h: 36 });

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
      state.current.homeX = w * 0.18;
      state.current.x = state.current.homeX;
    };

    const burst = (x: number, y: number, color: string, n = 12, size = 3) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 3.5;
        state.current.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 18, color, size });
      }
    };

    const syncForm = () => {
      const s = state.current;
      const next: Form = s.susanooT > 0 ? "susanoo" : s.mangekyoT > 0 ? "mangekyo" : "base";
      s.form = next;
      setForm(next);
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.ocular = 0;
      s.form = "base";
      s.homeX = s.w * 0.18;
      s.x = s.homeX;
      s.dashT = 0;
      s.dashVx = 0;
      s.cooldown = 0;
      s.spawnIn = 20;
      s.enemies = [];
      s.slashes = [];
      s.parts = [];
      s.shake = 0;
      s.mangekyoT = 0;
      s.susanooT = 0;
      s.announce = "CHIDORI!";
      s.announceT = 45;
      s.specialCd = 0;
      s.hitToken = 1;
      setAlive(true);
      setScore(0);
      setOcular(0);
      setForm("base");
    };

    const activateMangekyo = () => {
      const s = state.current;
      if (!s.alive || s.specialCd > 0 || s.mangekyoT > 0 || s.susanooT > 0) return;
      if (s.ocular < 50) {
        s.announce = "NEED 50 OCULAR!";
        s.announceT = 35;
        return;
      }
      s.ocular -= 50;
      setOcular(s.ocular);
      s.mangekyoT = 240;
      s.specialCd = 18;
      s.shake = 6;
      s.announce = "MANGEKYO SHARINGAN!";
      s.announceT = 55;
      burst(s.x, ground() - 24, "#ef4444", 22, 3);
      syncForm();
    };

    const activateSusanoo = () => {
      const s = state.current;
      if (!s.alive || s.specialCd > 0 || s.susanooT > 0) return;
      if (s.ocular < 100) {
        s.announce = "NEED 100 OCULAR!";
        s.announceT = 35;
        return;
      }
      s.ocular = 0;
      setOcular(0);
      s.mangekyoT = 0;
      s.susanooT = 320;
      s.specialCd = 22;
      s.shake = 14;
      s.announce = "PERFECT SUSANOO!";
      s.announceT = 70;
      burst(s.x + 40, ground() - 50, "#a78bfa", 36, 5);
      burst(s.x + 40, ground() - 50, "#ddd6fe", 20, 3);
      syncForm();
    };

    const killEnemy = (e: Enemy, pts: number, ocularGain: number, color: string) => {
      const s = state.current;
      s.score += pts;
      s.ocular = Math.min(100, s.ocular + ocularGain);
      setScore(s.score);
      setOcular(s.ocular);
      burst(e.x, ground() - 20, color, 12, 3);
      e.hp = 0;
    };

    const hurtEnemy = (e: Enemy, dmg: number, applyBurn: boolean) => {
      if (e.hp <= 0) return;
      e.hp -= dmg;
      e.hitFlash = 8;
      if (applyBurn) e.burn = Math.max(e.burn, 100);
      if (e.hp <= 0) killEnemy(e, applyBurn ? 40 : 30, applyBurn ? 22 : 18, applyBurn ? "#ef4444" : "#67e8f9");
    };

    /** Full armored Susanoo avatar behind Sasuke. */
    const drawSusanoo = (x: number, y: number, punching: boolean) => {
      const f = state.current.frame;
      const breath = Math.sin(f / 7) * 3;
      const pulse = 1 + Math.sin(f / 5) * 0.05;
      const lean = punching ? 18 : Math.sin(f / 14) * 3;
      const sx = x + 58;
      const sy = y - 36 + breath * 0.3;

      // Ground pressure rings
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(f / 8) * 0.08;
      ctx.strokeStyle = "#c4b5fd";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const rr = 28 + i * 18 + ((f * 0.8 + i * 12) % 40);
        ctx.beginPath();
        ctx.ellipse(sx, y + 34, rr * pulse, 8 + i, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Soft bloom
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const aura = ctx.createRadialGradient(sx, sy, 6, sx, sy, 115 * pulse);
      aura.addColorStop(0, "rgba(237,233,254,0.45)");
      aura.addColorStop(0.25, "rgba(167,139,250,0.35)");
      aura.addColorStop(0.55, "rgba(109,40,217,0.22)");
      aura.addColorStop(1, "transparent");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 78 * pulse, 110 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();

      // Orbiting chakra motes
      for (let i = 0; i < 8; i++) {
        const a = f / 16 + (i / 8) * Math.PI * 2;
        const ox = sx + Math.cos(a) * (55 + (i % 3) * 8);
        const oy = sy + Math.sin(a * 1.2) * (70 + (i % 2) * 10);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = i % 2 ? "#ddd6fe" : "#a78bfa";
        ctx.beginPath();
        ctx.arc(ox, oy, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.92;

      // Energy cape / wings (behind body)
      ctx.globalAlpha = 0.38;
      const wingFlap = Math.sin(f / 6) * 10;
      ctx.fillStyle = "#a78bfa";
      ctx.beginPath();
      ctx.moveTo(sx - 18, sy - 30);
      ctx.quadraticCurveTo(sx - 95, sy - 70 + wingFlap, sx - 70, sy + 55);
      ctx.quadraticCurveTo(sx - 40, sy + 20, sx - 10, sy + 35);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx + 18, sy - 30);
      ctx.quadraticCurveTo(sx + 100, sy - 80 - wingFlap, sx + 72, sy + 30);
      ctx.quadraticCurveTo(sx + 40, sy + 5, sx + 12, sy + 18);
      ctx.fill();
      ctx.globalAlpha = 0.92;

      // Legs with armor plates
      const legGrad = ctx.createLinearGradient(sx - 40, sy, sx + 40, sy + 100);
      legGrad.addColorStop(0, "#7c3aed");
      legGrad.addColorStop(1, "#4c1d95");
      ctx.fillStyle = legGrad;
      ctx.strokeStyle = "#ede9fe";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sx - 30, sy + 48);
      ctx.lineTo(sx - 44, sy + 102);
      ctx.lineTo(sx - 14, sy + 104);
      ctx.lineTo(sx - 4, sy + 50);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + 4, sy + 50);
      ctx.lineTo(sx + 14, sy + 104);
      ctx.lineTo(sx + 44, sy + 102);
      ctx.lineTo(sx + 30, sy + 48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Knee guards
      ctx.fillStyle = "#8b5cf6";
      ctx.beginPath();
      ctx.arc(sx - 28, sy + 78, 8, 0, Math.PI * 2);
      ctx.arc(sx + 28, sy + 78, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Torso shell
      const bodyGrad = ctx.createLinearGradient(sx, sy - 20, sx, sy + 55);
      bodyGrad.addColorStop(0, "#8b5cf6");
      bodyGrad.addColorStop(0.5, "#6d28d9");
      bodyGrad.addColorStop(1, "#5b21b6");
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(sx - 38, sy - 12);
      ctx.lineTo(sx + 38, sy - 12);
      ctx.lineTo(sx + 46, sy + 55);
      ctx.lineTo(sx - 46, sy + 55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Layered ribs
      ctx.strokeStyle = "#f5f3ff";
      ctx.lineWidth = 2.8;
      for (let i = 0; i < 6; i++) {
        ctx.globalAlpha = 0.55 + i * 0.06;
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2 + i * 9, 34 - i * 2.2, 6.5, 0, 0.1, Math.PI - 0.1);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.92;
      // Sternum
      ctx.strokeStyle = "#ddd6fe";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 6);
      ctx.lineTo(sx, sy + 48);
      ctx.stroke();

      // Heart core
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const coreR = 17 + Math.sin(f / 3.5) * 3;
      const core = ctx.createRadialGradient(sx, sy + 18, 1, sx, sy + 18, coreR + 8);
      core.addColorStop(0, "#fff");
      core.addColorStop(0.25, "#fce7f3");
      core.addColorStop(0.55, "#c4b5fd");
      core.addColorStop(1, "transparent");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(sx, sy + 18, coreR + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "#fae8ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy + 18, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Pauldrons (spiked)
      ctx.fillStyle = "#5b21b6";
      ctx.strokeStyle = "#ede9fe";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(sx - 44, sy - 6, 20, 17, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(sx + 44, sy - 6, 20, 17, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Spikes on shoulders
      ctx.fillStyle = "#a78bfa";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx + side * 44, sy - 18);
        ctx.lineTo(sx + side * 52, sy - 38);
        ctx.lineTo(sx + side * 34, sy - 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Helmet / oni skull
      const helm = ctx.createLinearGradient(sx, sy - 90, sx, sy - 20);
      helm.addColorStop(0, "#a78bfa");
      helm.addColorStop(0.5, "#7c3aed");
      helm.addColorStop(1, "#5b21b6");
      ctx.fillStyle = helm;
      ctx.beginPath();
      ctx.ellipse(sx, sy - 56, 32, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Crest
      ctx.fillStyle = "#c4b5fd";
      ctx.beginPath();
      ctx.moveTo(sx - 6, sy - 88);
      ctx.lineTo(sx, sy - 108);
      ctx.lineTo(sx + 6, sy - 88);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Horns (longer, curved)
      ctx.fillStyle = "#ddd6fe";
      ctx.beginPath();
      ctx.moveTo(sx - 26, sy - 70);
      ctx.quadraticCurveTo(sx - 58, sy - 120, sx - 12, sy - 78);
      ctx.quadraticCurveTo(sx - 30, sy - 85, sx - 26, sy - 70);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + 26, sy - 70);
      ctx.quadraticCurveTo(sx + 58, sy - 120, sx + 12, sy - 78);
      ctx.quadraticCurveTo(sx + 30, sy - 85, sx + 26, sy - 70);
      ctx.fill();
      ctx.stroke();

      // Glowing mangekyo-style visor
      ctx.fillStyle = "#111";
      roundRect(ctx, sx - 22, sy - 62, 44, 16, 4);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#fb7185";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(sx - 16, sy - 54);
      ctx.lineTo(sx - 4, sy - 58);
      ctx.lineTo(sx - 4, sy - 50);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx + 16, sy - 54);
      ctx.lineTo(sx + 4, sy - 58);
      ctx.lineTo(sx + 4, sy - 50);
      ctx.closePath();
      ctx.fill();
      // Tomoe in visor
      ctx.fillStyle = "#7f1d1d";
      ctx.beginPath();
      ctx.arc(sx, sy - 54, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Teeth / jaw plate
      ctx.fillStyle = "#4c1d95";
      ctx.beginPath();
      ctx.moveTo(sx - 18, sy - 38);
      ctx.lineTo(sx, sy - 28);
      ctx.lineTo(sx + 18, sy - 38);
      ctx.lineTo(sx + 14, sy - 42);
      ctx.lineTo(sx - 14, sy - 42);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ede9fe";
      ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + i * 5, sy - 40);
        ctx.lineTo(sx + i * 5, sy - 32);
        ctx.stroke();
      }

      // Left arm: Yasaka magatama beads
      ctx.strokeStyle = "#c4b5fd";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx - 44, sy + 4);
      ctx.quadraticCurveTo(sx - 70, sy + 30, sx - 55, sy + 55);
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const bx = sx - 44 + (sx - 55 - (sx - 44)) * t + Math.sin(t * 3) * -18;
        const by = sy + 4 + t * 50;
        ctx.fillStyle = i % 2 ? "#ef4444" : "#a78bfa";
        ctx.beginPath();
        ctx.ellipse(bx, by, 6, 8, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fde68a";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Right arm: giant fist (punches forward)
      ctx.fillStyle = "#7c3aed";
      ctx.strokeStyle = "#ede9fe";
      ctx.lineWidth = 2.4;
      const fistX = sx + 62 + lean;
      const fistY = sy + 4;
      ctx.beginPath();
      ctx.moveTo(sx + 42, sy);
      ctx.lineTo(fistX - 6, fistY - 12);
      ctx.lineTo(fistX - 6, fistY + 18);
      ctx.lineTo(sx + 42, sy + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Fist with glow when punching
      if (punching) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const fg = ctx.createRadialGradient(fistX + 20, fistY, 2, fistX + 20, fistY, 40);
        fg.addColorStop(0, "rgba(255,255,255,0.8)");
        fg.addColorStop(0.4, "rgba(196,181,253,0.5)");
        fg.addColorStop(1, "transparent");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(fistX + 20, fistY, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      const fistGrad = ctx.createLinearGradient(fistX, fistY - 20, fistX + 50, fistY + 20);
      fistGrad.addColorStop(0, "#c4b5fd");
      fistGrad.addColorStop(0.5, "#8b5cf6");
      fistGrad.addColorStop(1, "#6d28d9");
      ctx.fillStyle = fistGrad;
      roundRect(ctx, fistX - 4, fistY - 18, 50, 40, 10);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#f5f3ff";
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(fistX + 10 + i * 9, fistY - 10);
        ctx.lineTo(fistX + 10 + i * 9, fistY + 14);
        ctx.stroke();
      }

      ctx.restore();
    };

    const dash = (tx: number) => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.cooldown > 0 || s.dashT > 0) return;

      const gY = ground();
      s.hitToken += 1;

      if (s.susanooT > 0) {
        // Triple Susanoo arrows + fist punch pose
        s.slashes.push({ x: s.x + 80, y: gY - 45, vx: 14, life: 42, big: true, dmg: 5, struck: new Set() });
        s.slashes.push({ x: s.x + 95, y: gY - 70, vx: 16, life: 46, big: true, dmg: 5, struck: new Set() });
        s.slashes.push({ x: s.x + 70, y: gY - 95, vx: 13, life: 40, big: true, dmg: 4, struck: new Set() });
        s.dashVx = 0;
        s.dashT = 12;
        s.cooldown = 10;
        s.shake = 12;
        burst(Math.min(tx, s.w - 20), gY - 60, "#c4b5fd", 28, 5);
        burst(s.x + 100, gY - 55, "#7c3aed", 16, 3);
        for (const e of s.enemies) {
          if (e.x > s.x) hurtEnemy(e, 4, false);
        }
        return;
      }

      const boost = s.mangekyoT > 0 ? 1.25 : 1;
      s.dashVx = 14 * boost;
      s.dashT = 16;
      s.cooldown = 10;
      s.slashes.push({
        x: s.x + 24,
        y: gY - 28,
        vx: 11 * boost,
        life: 40,
        big: false,
        dmg: s.mangekyoT > 0 ? 2 : 1,
        struck: new Set(),
      });
      if (s.mangekyoT > 0) {
        s.slashes.push({ x: s.x + 10, y: gY - 40, vx: 9, life: 36, big: false, dmg: 2, struck: new Set() });
      }
      burst(s.x + 20, gY - 24, "#67e8f9", 12, 2);
    };

    const drawSasuke = (x: number, y: number, dashing: boolean) => {
      const s = state.current;
      const mangekyo = s.mangekyoT > 0;
      const susanoo = s.susanooT > 0;

      if (susanoo) drawSusanoo(x, y, dashing);

      // Chidori glow when dashing (not during Susanoo punches)
      if (dashing && !susanoo) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(x + 28, y - 8, 1, x + 28, y - 8, 22);
        g.addColorStop(0, "#e0f2fe");
        g.addColorStop(0.4, "#22d3ee");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + 28, y - 8, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Boots
      ctx.fillStyle = "#0f172a";
      roundRect(ctx, x - 12, y + 28, 11, 8, 2);
      ctx.fill();
      roundRect(ctx, x + 2, y + 28, 11, 8, 2);
      ctx.fill();

      // Pants (dark)
      ctx.fillStyle = "#1e293b";
      roundRect(ctx, x - 11, y + 12, 10, 18, 3);
      ctx.fill();
      roundRect(ctx, x + 1, y + 12, 10, 18, 3);
      ctx.fill();

      // Navy shirt
      ctx.fillStyle = "#1e3a8a";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      roundRect(ctx, x - 13, y - 8, 26, 24, 4);
      ctx.fill();
      ctx.stroke();

      // Arms
      ctx.fillStyle = "#1e3a8a";
      if (dashing) {
        roundRect(ctx, x + 8, y - 10, 24, 9, 3);
        ctx.fill();
      } else {
        roundRect(ctx, x - 20, y - 2, 9, 14, 3);
        ctx.fill();
        roundRect(ctx, x + 11, y - 2, 9, 14, 3);
        ctx.fill();
      }
      ctx.fillStyle = "#f5c89a";
      ctx.beginPath();
      if (dashing) ctx.arc(x + 32, y - 5, 4.5, 0, Math.PI * 2);
      else {
        ctx.arc(x - 16, y + 12, 3.5, 0, Math.PI * 2);
        ctx.arc(x + 16, y + 12, 3.5, 0, Math.PI * 2);
      }
      ctx.fill();

      // Head
      ctx.fillStyle = "#f5c89a";
      ctx.beginPath();
      ctx.ellipse(x, y - 22, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Black spiky hair
      ctx.fillStyle = "#0a0a0a";
      const spikes = [
        [-8, -28, -12, -48, -1, -30],
        [-3, -32, -2, -54, 5, -30],
        [3, -30, 8, -50, 9, -28],
        [6, -26, 16, -40, 10, -24],
        [-10, -22, -16, -34, -5, -24],
      ];
      for (const [a, b, c, d, e, f] of spikes) {
        ctx.beginPath();
        ctx.moveTo(x + a, y + b);
        ctx.lineTo(x + c, y + d);
        ctx.lineTo(x + e, y + f);
        ctx.closePath();
        ctx.fill();
      }

      // Sharingan eyes
      const eye = (ox: number) => {
        ctx.fillStyle = mangekyo || susanoo ? "#7f1d1d" : "#dc2626";
        ctx.beginPath();
        ctx.ellipse(x + ox, y - 22, 3.2, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(x + ox, y - 22, 1.2, 0, Math.PI * 2);
        ctx.fill();
        if (mangekyo || susanoo) {
          // Magatama-ish marks
          ctx.strokeStyle = "#111";
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + s.frame * 0.05;
            ctx.beginPath();
            ctx.arc(x + ox + Math.cos(a) * 2, y - 22 + Math.sin(a) * 2, 0.8, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else {
          // 3 tomoe
          ctx.fillStyle = "#111";
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 - 0.4;
            ctx.beginPath();
            ctx.arc(x + ox + Math.cos(a) * 1.8, y - 22 + Math.sin(a) * 1.8, 0.7, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      };
      eye(-4);
      eye(4);

      // Serious mouth
      ctx.strokeStyle = "#7c2d12";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x - 3, y - 14);
      ctx.lineTo(x + 3, y - 14);
      ctx.stroke();
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
      if (s.mangekyoT > 0) {
        s.mangekyoT--;
        if (s.mangekyoT === 0) syncForm();
      }
      if (s.susanooT > 0) {
        s.susanooT--;
        if (s.susanooT === 0) {
          s.announce = "SUSANOO FADED";
          s.announceT = 35;
          syncForm();
        }
      }
      s.shake *= 0.86;
      const gY = ground();

      // Ease back to home when not dashing
      if (s.dashT <= 0) {
        s.x += (s.homeX - s.x) * 0.12;
      } else {
        s.x += s.dashVx;
        s.x = Math.max(30, Math.min(s.w * 0.72, s.x));
        s.dashT--;
        for (const e of s.enemies) {
          if (e.hitToken === s.hitToken) continue;
          if (e.x > s.x - 20 && e.x < s.x + 50 && e.hp > 0) {
            e.hitToken = s.hitToken;
            hurtEnemy(e, s.mangekyoT > 0 ? 2 : 1, s.mangekyoT > 0);
          }
        }
      }

      // Traveling Chidori / Susanoo bolts
      for (const sl of s.slashes) {
        sl.x += sl.vx;
        sl.life--;
        for (const e of s.enemies) {
          if (e.hp <= 0 || sl.struck.has(e)) continue;
          const reach = sl.big ? 55 : 34;
          if (Math.abs(e.x - sl.x) < reach) {
            sl.struck.add(e);
            hurtEnemy(e, sl.dmg, s.mangekyoT > 0 && !sl.big);
          }
        }
      }
      s.slashes = s.slashes.filter((sl) => sl.life > 0 && sl.x < s.w + 40);

      if (s.alive) {
        if (--s.spawnIn <= 0) {
          s.enemies.push({
            x: s.w * 0.82 + Math.random() * s.w * 0.12,
            y: gY,
            vx: -(1.6 + Math.min(1.8, s.score * 0.0025) + Math.random() * 0.5),
            hp: 2,
            burn: 0,
            w: 22,
            h: 40,
            hitFlash: 0,
            hitToken: 0,
          });
          s.spawnIn = Math.max(28, 55 - Math.min(18, s.score / 70));
        }

        for (const e of s.enemies) {
          e.x += e.vx * (s.susanooT > 0 ? 0.7 : 1);
          if (e.hitFlash > 0) e.hitFlash--;
          if (e.burn > 0) {
            e.burn--;
            if (e.burn % 18 === 0) {
              hurtEnemy(e, 1, false);
              burst(e.x, e.y - e.h / 2, "#111", 4, 2);
            }
          }
        }

        s.enemies = s.enemies.filter((e) => e.hp > 0 && e.x > -40);

        for (const e of s.enemies) {
          const reach = s.susanooT > 0 ? s.x + 55 : s.x + 20;
          if (e.x - e.w / 2 < reach) {
            if (s.susanooT > 0) {
              e.x += 55;
              hurtEnemy(e, 2, false);
              continue;
            }
            s.alive = false;
            setAlive(false);
            burst(s.x, gY - 20, "#ef4444", 20, 3);
            s.shake = 12;
            localStorage.setItem(
              "stackfolio_best_sasuke",
              String(Math.max(Number(localStorage.getItem("stackfolio_best_sasuke") || 0), s.score)),
            );
            setBest(Math.max(Number(localStorage.getItem("stackfolio_best_sasuke") || 0), s.score));
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

      const sky = ctx.createLinearGradient(0, 0, 0, s.h);
      if (s.susanooT > 0) {
        sky.addColorStop(0, "#1e1b4b");
        sky.addColorStop(1, "#4c1d95");
      } else if (s.mangekyoT > 0) {
        sky.addColorStop(0, "#450a0a");
        sky.addColorStop(1, "#1c1917");
      } else {
        sky.addColorStop(0, "#0f172a");
        sky.addColorStop(1, "#1e3a8a");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, gY, s.w, s.h - gY);
      ctx.fillStyle = s.susanooT > 0 ? "#a78bfa" : "#dc2626";
      ctx.fillRect(0, gY, s.w, 3);

      for (const e of s.enemies) {
        ctx.fillStyle = e.hitFlash > 0 ? "#fecaca" : "#334155";
        roundRect(ctx, e.x - e.w / 2, e.y - e.h, e.w, e.h * 0.7, 4);
        ctx.fill();
        ctx.fillStyle = "#f5c89a";
        ctx.beginPath();
        ctx.ellipse(e.x, e.y - e.h - 2, 7, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        if (e.burn > 0) {
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.beginPath();
          ctx.arc(e.x + Math.sin(s.frame / 3) * 4, e.y - e.h / 2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(127,29,29,0.8)";
          ctx.beginPath();
          ctx.arc(e.x - 3, e.y - e.h / 2 - 6, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const sl of s.slashes) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        if (sl.big) {
          // Susanoo arrow / fist wave
          const bolt = ctx.createRadialGradient(sl.x, sl.y, 2, sl.x, sl.y, 42);
          bolt.addColorStop(0, "#fff");
          bolt.addColorStop(0.3, "#ddd6fe");
          bolt.addColorStop(0.65, "#7c3aed");
          bolt.addColorStop(1, "transparent");
          ctx.fillStyle = bolt;
          ctx.beginPath();
          ctx.ellipse(sl.x, sl.y, 38, 22, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#c4b5fd";
          ctx.beginPath();
          ctx.moveTo(sl.x + 28, sl.y);
          ctx.lineTo(sl.x - 10, sl.y - 14);
          ctx.lineTo(sl.x - 4, sl.y);
          ctx.lineTo(sl.x - 10, sl.y + 14);
          ctx.closePath();
          ctx.fill();
        } else {
          const bolt = ctx.createRadialGradient(sl.x, sl.y, 1, sl.x, sl.y, 20);
          bolt.addColorStop(0, "#fff");
          bolt.addColorStop(0.35, "#67e8f9");
          bolt.addColorStop(1, "transparent");
          ctx.fillStyle = bolt;
          ctx.beginPath();
          ctx.arc(sl.x, sl.y, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#e0f2fe";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(sl.x - 18, sl.y);
          ctx.lineTo(sl.x + 22, sl.y - 6);
          ctx.lineTo(sl.x + 10, sl.y);
          ctx.lineTo(sl.x + 22, sl.y + 6);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 16);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      }

      drawSasuke(s.x, gY - 4, s.dashT > 0);

      // Ocular meter
      const meterW = Math.min(s.w - 40, 220);
      const meterX = (s.w - meterW) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, meterX, 12, meterW, 12, 6);
      ctx.fill();
      ctx.fillStyle = s.susanooT > 0 ? "#a78bfa" : s.mangekyoT > 0 ? "#ef4444" : "#dc2626";
      roundRect(ctx, meterX, 12, (s.ocular / 100) * meterW, 12, 6);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      roundRect(ctx, meterX, 12, meterW, 12, 6);
      ctx.stroke();

      drawBtn(btnM(), "MS", s.ocular >= 50 && s.mangekyoT <= 0 && s.susanooT <= 0, "#dc2626");
      drawBtn(btnS(), "SUSAN", s.ocular >= 100 && s.susanooT <= 0, "#7c3aed");

      const hs = hudScale(s.w);
      ctx.fillStyle = "#e2e8f0";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(18 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`XP ${s.score}`, 12, s.h - 36);
      ctx.fillText(`XP ${s.score}`, 12, s.h - 36);
      ctx.fillStyle = s.susanooT > 0 ? "#c4b5fd" : s.mangekyoT > 0 ? "#f87171" : "#fca5a5";
      ctx.font = `700 ${Math.round(13 * hs)}px Bangers, Impact, sans-serif`;
      let label = `OCULAR ${Math.round(s.ocular)}%`;
      if (s.susanooT > 0) label = `SUSANOO ${Math.ceil(s.susanooT / 60)}s`;
      else if (s.mangekyoT > 0) label = `MANGEKYO ${Math.ceil(s.mangekyoT / 60)}s`;
      ctx.strokeText(label, 12, s.h - 16);
      ctx.fillText(label, 12, s.h - 16);

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, s.h * 0.26, s.w, 40);
        ctx.fillStyle = s.susanooT > 0 ? "#c4b5fd" : "#f87171";
        ctx.font = `700 ${Math.round(22 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText(s.announce, s.w / 2 - s.announce.length * 5.5 * hs, s.h * 0.26 + 28);
        ctx.fillText(s.announce, s.w / 2 - s.announce.length * 5.5 * hs, s.h * 0.26 + 28);
      }

      if (s.alive && s.frame < 100 && s.announceT <= 0) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = `700 ${Math.round(12 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText(s.w < 500 ? "Tap = Chidori bolt!" : "Tap to fire Chidori · dash forward · MS / SUSANOO", s.w / 2 - (s.w < 500 ? 60 : 160), s.h * 0.22);
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#ef4444";
        ctx.font = `700 ${Math.round(30 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText("DEFEATED!", s.w / 2 - 70 * hs, s.h / 2);
        ctx.fillText("DEFEATED!", s.w / 2 - 70 * hs, s.h / 2);
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to try again", s.w / 2 - 52, s.h / 2 + 28);
      }

      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * state.current.w, y: ((e.clientY - r.top) / r.height) * state.current.h };
    };
    const hit = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
      p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) dash(state.current.x + 120);
      }
      if (e.code === "KeyC") {
        e.preventDefault();
        activateMangekyo();
      }
      if (e.code === "KeyV") {
        e.preventDefault();
        activateSusanoo();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const p = pos(e);
      if (hit(p, btnM())) return activateMangekyo();
      if (hit(p, btnS())) return activateSusanoo();
      dash(p.x);
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
      title="Chidori Dash"
      tagline="Dash with Chidori · Mangekyo Amaterasu · Susanoo smash"
      mobileTagline="Tap to dash · MS / SUSAN buttons"
      strip="SHARINGAN"
      stripHint={form === "susanoo" ? "Susanoo!" : form === "mangekyo" ? "Mangekyo!" : `Ocular ${ocular}%`}
      loadingLabel="Awakening the eye… loading portfolio"
      readyLabel="Rival cleared — open the scroll"
      accent="#1e3a8a"
      accent2="#7c3aed"
      score={score}
      secondaryLabel="Ocular"
      secondaryValue={ocular}
      best={best}
      alive={alive}
      aliveHint="Tap ahead to Chidori-dash. C/MS (50) Mangekyo · V/SUSAN (100) Susanoo."
      deadHint="Cut down! Tap to try again."
      canvasRef={canvasRef}
      ariaLabel="Sasuke Chidori dash mini-game"
    />
  );
}
