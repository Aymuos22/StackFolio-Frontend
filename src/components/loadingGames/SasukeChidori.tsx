import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Enemy = {
  x: number;
  y: number; // ground line
  air: number; // height above ground (flyers)
  vx: number;
  hp: number;
  burn: number;
  w: number;
  h: number;
  hitFlash: number;
  hitToken: number;
  kind: "grunt" | "flyer";
};

type Slash = {
  x: number;
  y: number;
  vx: number;
  life: number;
  big: boolean;
  dmg: number;
  struck: Set<Enemy>;
  kind: "chidori" | "fire" | "susanoo";
};
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type Form = "base" | "mangekyo" | "susanoo";

/**
 * Sasuke arena: move · jump · Fire Style · Chidori dash.
 * Power-ups: Mangekyo (Amaterasu) · Susanoo smash.
 */
export default function SasukeChidori({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const keys = useRef({ left: false, right: false, jump: false });
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
    yOff: 0,
    vy: 0,
    dashT: 0,
    dashVx: 0,
    chargeT: 0,
    cooldown: 0,
    fireCool: 0,
    afterimages: [] as { x: number; y: number; life: number }[],
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
    hitToken: 1,
    pose: "" as "" | "fire" | "jump",
    poseT: 0,
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
    const btnH = () => 34;
    const btnY = () => state.current.h - 42;
    const isPhone = () => state.current.w < 560;
    const btns = () => {
      const phone = isPhone();
      const y = btnY();
      const h = btnH();
      const gap = 3;
      const aw = phone ? 40 : 0;
      const w = phone ? 40 : 48;
      const start = phone ? 6 + aw * 2 + gap * 2 + 4 : 6;
      const out: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
        jump: { x: start, y, w, h, label: "JUMP" },
        fire: { x: start + w + gap, y, w, h, label: "FIRE" },
        chidori: { x: start + (w + gap) * 2, y, w: w + 8, h, label: phone ? "CHI" : "CHIDORI" },
        ms: { x: state.current.w - (phone ? 92 : 108), y, w: phone ? 40 : 46, h, label: "MS" },
        susan: { x: state.current.w - (phone ? 48 : 56), y, w: phone ? 42 : 48, h, label: phone ? "SU" : "SUSAN" },
      };
      if (phone) {
        out.left = { x: 6, y, w: aw, h, label: "◀" };
        out.right = { x: 6 + aw + gap, y, w: aw, h, label: "▶" };
      }
      return out;
    };

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
      state.current.x = Math.min(state.current.x, w * 0.55);
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
      s.x = s.w * 0.2;
      s.yOff = 0;
      s.vy = 0;
      s.dashT = 0;
      s.dashVx = 0;
      s.chargeT = 0;
      s.cooldown = 0;
      s.fireCool = 0;
      s.afterimages = [];
      s.pose = "";
      s.poseT = 0;
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

    const drawChidori = (hx: number, hy: number, size: number, intense = false) => {
      const s = state.current;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const core = ctx.createRadialGradient(hx, hy, 1, hx, hy, size);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.25, "#e0f2fe");
      core.addColorStop(0.55, "#22d3ee");
      core.addColorStop(0.8, "#0284c7");
      core.addColorStop(1, "transparent");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(hx, hy, size, 0, Math.PI * 2);
      ctx.fill();

      // Chaotic lightning forks — "a thousand birds"
      ctx.lineCap = "round";
      ctx.shadowColor = "#67e8f9";
      ctx.shadowBlur = intense ? 14 : 8;
      const forks = intense ? 10 : 7;
      for (let i = 0; i < forks; i++) {
        const a = (i / forks) * Math.PI * 2 + s.frame * 0.4 + Math.sin(s.frame * 0.7 + i) * 0.4;
        const len = size * (0.7 + Math.random() * 0.9);
        ctx.strokeStyle = i % 2 === 0 ? "#ffffff" : "#67e8f9";
        ctx.lineWidth = intense ? 2.2 : 1.6;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        let px = hx;
        let py = hy;
        const segs = 3 + (i % 2);
        for (let k = 1; k <= segs; k++) {
          const t = k / segs;
          const jx = (Math.random() - 0.5) * size * 0.55;
          const jy = (Math.random() - 0.5) * size * 0.55;
          const nx = hx + Math.cos(a) * len * t + jx;
          const ny = hy + Math.sin(a) * len * t + jy;
          ctx.lineTo(nx, ny);
          px = nx;
          py = ny;
        }
        ctx.stroke();
        // branch
        if (i % 3 === 0) {
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + (Math.random() - 0.5) * 12, py + (Math.random() - 0.5) * 12);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const startChidoriDash = () => {
      const s = state.current;
      const boost = s.mangekyoT > 0 ? 1.3 : 1;
      const gY = ground();
      s.dashVx = 20 * boost;
      s.dashT = 20;
      s.cooldown = 16;
      s.shake = Math.max(s.shake, 6);
      s.hitToken += 1;
      // Lingering pierce trail stuck to the rush (not a separate fireball)
      s.slashes.push({
        x: s.x + 36,
        y: gY - 22 - s.yOff,
        vx: s.dashVx * 0.95,
        life: 18,
        big: false,
        dmg: s.mangekyoT > 0 ? 2 : 1,
        struck: new Set(),
        kind: "chidori",
      });
      burst(s.x + 30, gY - 20, "#67e8f9", 18, 3);
      burst(s.x + 30, gY - 20, "#ffffff", 10, 2);
      // Ground scorch sparks
      for (let i = 0; i < 8; i++) {
        s.parts.push({
          x: s.x + 10 + i * 4,
          y: gY - 2,
          vx: 2 + Math.random() * 4,
          vy: -1 - Math.random() * 3,
          life: 14,
          color: "#67e8f9",
          size: 2,
        });
      }
    };

    const dash = (tx: number) => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.cooldown > 0 || s.dashT > 0 || s.chargeT > 0) return;

      const gY = ground();

      if (s.susanooT > 0) {
        s.hitToken += 1;
        s.slashes.push({ x: s.x + 80, y: gY - 45, vx: 14, life: 42, big: true, dmg: 5, struck: new Set(), kind: "susanoo" });
        s.slashes.push({ x: s.x + 95, y: gY - 70, vx: 16, life: 46, big: true, dmg: 5, struck: new Set(), kind: "susanoo" });
        s.slashes.push({ x: s.x + 70, y: gY - 95, vx: 13, life: 40, big: true, dmg: 4, struck: new Set(), kind: "susanoo" });
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

      // Charge Chidori in the palm, then dash — classic form
      s.chargeT = 14;
      s.cooldown = 4;
      s.announce = "CHIDORI!";
      s.announceT = 22;
      s.shake = 4;
      burst(s.x + 26, gY - 18, "#67e8f9", 14, 2);
      burst(s.x + 26, gY - 18, "#ffffff", 8, 2);
    };

    const castFire = () => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.fireCool > 0 || s.chargeT > 0 || s.dashT > 0 || s.susanooT > 0) return;
      s.fireCool = 32;
      s.pose = "fire";
      s.poseT = 20;
      const gY = ground();
      const hy = gY - 30 - s.yOff;
      s.slashes.push({
        x: s.x + 32,
        y: hy,
        vx: 8.2,
        life: 60,
        big: false,
        dmg: 2,
        struck: new Set(),
        kind: "fire",
      });
      burst(s.x + 26, hy, "#f97316", 18, 3.5);
      burst(s.x + 26, hy, "#fbbf24", 12, 2.5);
      burst(s.x + 26, hy, "#fff7ed", 8, 2);
      s.shake = Math.max(s.shake, 4);
      s.announce = "KATON: GOUKAKYUU!";
      s.announceT = 28;
    };

    const drawKaton = (fx: number, fy: number) => {
      const s = state.current;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // Outer heat haze
      const haze = ctx.createRadialGradient(fx, fy, 4, fx, fy, 34);
      haze.addColorStop(0, "rgba(255,247,237,0.9)");
      haze.addColorStop(0.25, "rgba(251,191,36,0.75)");
      haze.addColorStop(0.55, "rgba(234,88,12,0.55)");
      haze.addColorStop(0.8, "rgba(153,27,27,0.25)");
      haze.addColorStop(1, "transparent");
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.arc(fx, fy, 34, 0, Math.PI * 2);
      ctx.fill();
      // Core
      const core = ctx.createRadialGradient(fx - 2, fy - 2, 1, fx, fy, 16);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.35, "#fde68a");
      core.addColorStop(0.7, "#f97316");
      core.addColorStop(1, "#9a3412");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(fx, fy, 15, 0, Math.PI * 2);
      ctx.fill();
      // Flame tongues
      ctx.fillStyle = "#fb923c";
      for (let i = 0; i < 6; i++) {
        const a = -0.4 + i * 0.35 + Math.sin(s.frame / 3 + i) * 0.15;
        const len = 18 + (i % 3) * 6 + Math.sin(s.frame / 2 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(fx - 4, fy);
        ctx.quadraticCurveTo(
          fx + Math.cos(a) * len * 0.5,
          fy + Math.sin(a) * len * 0.5 - 4,
          fx + Math.cos(a) * len,
          fy + Math.sin(a) * len,
        );
        ctx.quadraticCurveTo(
          fx + Math.cos(a) * len * 0.5,
          fy + Math.sin(a) * len * 0.5 + 4,
          fx - 4,
          fy,
        );
        ctx.fill();
      }
      // Ember trail
      ctx.fillStyle = "#fdba74";
      for (let i = 0; i < 5; i++) {
        const ox = -10 - i * 7 - (s.frame % 5);
        const oy = Math.sin(s.frame / 4 + i) * 6;
        ctx.globalAlpha = 0.7 - i * 0.1;
        ctx.beginPath();
        ctx.arc(fx + ox, fy + oy, 2.5 - i * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawEnemy = (e: Enemy) => {
      const s = state.current;
      const ey = ground() - e.air;
      const flash = e.hitFlash > 0;
      const skin = flash ? "#fecaca" : "#e8b896";

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(e.x, ground() + 2, 12 - Math.min(5, e.air * 0.08), 4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (e.kind === "flyer") {
        // Crow / hawk scout
        const flap = Math.sin(s.frame / 5 + e.x * 0.05) * 8;
        ctx.fillStyle = flash ? "#fecaca" : "#1c1917";
        // Body
        ctx.beginPath();
        ctx.ellipse(e.x, ey - 14, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.ellipse(e.x - 10, ey - 16, 5, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Beak
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.moveTo(e.x - 14, ey - 16);
        ctx.lineTo(e.x - 22, ey - 15);
        ctx.lineTo(e.x - 14, ey - 13);
        ctx.closePath();
        ctx.fill();
        // Eye
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(e.x - 11, ey - 17, 1.3, 0, Math.PI * 2);
        ctx.fill();
        // Wings
        ctx.fillStyle = flash ? "#fda4af" : "#292524";
        ctx.beginPath();
        ctx.moveTo(e.x - 2, ey - 16);
        ctx.quadraticCurveTo(e.x + 4, ey - 28 - flap, e.x + 18, ey - 20 - flap * 0.5);
        ctx.quadraticCurveTo(e.x + 8, ey - 14, e.x + 2, ey - 12);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(e.x - 2, ey - 12);
        ctx.quadraticCurveTo(e.x + 2, ey - 2 + flap * 0.4, e.x + 16, ey - 6 + flap * 0.3);
        ctx.quadraticCurveTo(e.x + 6, ey - 10, e.x, ey - 12);
        ctx.closePath();
        ctx.fill();
        // Tail
        ctx.fillStyle = flash ? "#fecaca" : "#0a0a0a";
        ctx.beginPath();
        ctx.moveTo(e.x + 8, ey - 14);
        ctx.lineTo(e.x + 18, ey - 20);
        ctx.lineTo(e.x + 16, ey - 12);
        ctx.lineTo(e.x + 18, ey - 8);
        ctx.closePath();
        ctx.fill();
      } else {
        // Hostile shinobi
        // Sandals
        ctx.fillStyle = "#0f172a";
        roundRect(ctx, e.x - 11, ey - 4, 9, 5, 1);
        ctx.fill();
        roundRect(ctx, e.x + 2, ey - 4, 9, 5, 1);
        ctx.fill();
        // Pants
        ctx.fillStyle = flash ? "#fda4af" : "#1e293b";
        roundRect(ctx, e.x - 10, ey - 20, 9, 16, 2);
        ctx.fill();
        roundRect(ctx, e.x + 1, ey - 20, 9, 16, 2);
        ctx.fill();
        // Vest / flak
        ctx.fillStyle = flash ? "#fecaca" : "#334155";
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.2;
        roundRect(ctx, e.x - 11, ey - 36, 22, 18, 3);
        ctx.fill();
        ctx.stroke();
        // Pouches
        ctx.fillStyle = "#78716c";
        roundRect(ctx, e.x - 10, ey - 22, 6, 5, 1);
        ctx.fill();
        roundRect(ctx, e.x + 4, ey - 22, 6, 5, 1);
        ctx.fill();
        // Arms + kunai
        ctx.fillStyle = flash ? "#fecaca" : "#334155";
        roundRect(ctx, e.x - 16, ey - 34, 7, 12, 2);
        ctx.fill();
        roundRect(ctx, e.x + 10, ey - 36, 14, 6, 2);
        ctx.fill();
        // Kunai blade
        ctx.fillStyle = "#94a3b8";
        ctx.beginPath();
        ctx.moveTo(e.x + 24, ey - 33);
        ctx.lineTo(e.x + 34, ey - 30);
        ctx.lineTo(e.x + 24, ey - 27);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(e.x + 22, ey - 30);
        ctx.lineTo(e.x + 26, ey - 30);
        ctx.stroke();
        // Hands
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(e.x - 13, ey - 22, 3, 0, Math.PI * 2);
        ctx.arc(e.x + 22, ey - 33, 3, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.ellipse(e.x, ey - 44, 8, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Spiky dark hair
        ctx.fillStyle = flash ? "#7f1d1d" : "#0a0a0a";
        const hs: Array<[[number, number], [number, number], [number, number]]> = [
          [[-7, -48], [-10, -60], [-1, -50]],
          [[-2, -50], [-2, -64], [4, -50]],
          [[3, -48], [8, -58], [8, -46]],
          [[-8, -44], [-14, -52], [-4, -44]],
        ];
        for (const [a, b, c] of hs) {
          ctx.beginPath();
          ctx.moveTo(e.x + a[0], ey + a[1]);
          ctx.lineTo(e.x + b[0], ey + b[1]);
          ctx.lineTo(e.x + c[0], ey + c[1]);
          ctx.closePath();
          ctx.fill();
        }
        // Forehead protector (enemy village — blank / cracked)
        ctx.fillStyle = "#1e293b";
        roundRect(ctx, e.x - 8, ey - 50, 16, 4, 1);
        ctx.fill();
        ctx.fillStyle = "#94a3b8";
        roundRect(ctx, e.x - 3, ey - 51, 6, 5, 1);
        ctx.fill();
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(e.x - 1.5, ey - 50);
        ctx.lineTo(e.x + 1.5, ey - 47);
        ctx.stroke();
        // Angry eyes
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.ellipse(e.x - 3, ey - 44, 1.8, 2, 0, 0, Math.PI * 2);
        ctx.ellipse(e.x + 3, ey - 44, 1.8, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#7f1d1d";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(e.x - 5, ey - 47);
        ctx.lineTo(e.x - 1, ey - 46);
        ctx.moveTo(e.x + 5, ey - 47);
        ctx.lineTo(e.x + 1, ey - 46);
        ctx.stroke();
      }

      if (e.burn > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 4; i++) {
          const bx = e.x + Math.sin(s.frame / 3 + i) * 6;
          const by = ey - e.h * 0.4 - i * 5 - (s.frame % 8);
          const bg = ctx.createRadialGradient(bx, by, 0.5, bx, by, 6);
          bg.addColorStop(0, "#fff");
          bg.addColorStop(0.4, "#f97316");
          bg.addColorStop(1, "transparent");
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.arc(bx, by, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        // Amaterasu black flames mixed in
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.beginPath();
        ctx.arc(e.x + Math.sin(s.frame / 4) * 5, ey - e.h * 0.55, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };


    const doJump = () => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.yOff > 2 || s.vy < -0.5 || s.dashT > 0 || s.chargeT > 0) return;
      s.vy = -9.2;
      s.pose = "jump";
      s.poseT = 12;
    };

    const drawSasuke = (x: number, y: number, dashing: boolean, charging: boolean) => {
      const s = state.current;
      const mangekyo = s.mangekyoT > 0;
      const susanoo = s.susanooT > 0;
      const firing = s.pose === "fire" && s.poseT > 0;
      const gY = ground();
      const lean = dashing ? 8 : charging ? -2 : firing ? 3 : 0;

      if (susanoo) drawSusanoo(x, y, dashing);

      if (!susanoo) {
        for (const a of s.afterimages) {
          ctx.globalAlpha = (a.life / 10) * 0.28;
          ctx.fillStyle = "#22d3ee";
          ctx.beginPath();
          ctx.ellipse(a.x, a.y - 6, 8, 18, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      if (dashing && !susanoo) {
        ctx.save();
        ctx.strokeStyle = "rgba(103,232,249,0.4)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        for (let i = 0; i < 7; i++) {
          const yy = y - 26 + i * 7;
          ctx.beginPath();
          ctx.moveTo(x - 12 - (26 + (i % 3) * 14), yy);
          ctx.lineTo(x - 14, yy);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x, gY + 2, 20 - Math.min(8, s.yOff * 0.12), 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // ——— Classic Part I Sasuke (absolute coords like Naruto) ———
      const px = x + lean;
      const py = y;
      const skin = "#f0c4a0";

      // Sandals (blue straps)
      ctx.fillStyle = "#0f172a";
      roundRect(ctx, px - 14, py + 30, 12, 7, 2);
      ctx.fill();
      roundRect(ctx, px + 2, py + 30, 12, 7, 2);
      ctx.fill();
      ctx.fillStyle = "#1e3a8a";
      ctx.fillRect(px - 14, py + 30, 12, 2);
      ctx.fillRect(px + 2, py + 30, 12, 2);

      // White pants
      ctx.fillStyle = "#f1f5f9";
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.2;
      if (dashing) {
        roundRect(ctx, px - 14, py + 12, 11, 20, 3);
        ctx.fill();
        ctx.stroke();
        roundRect(ctx, px + 3, py + 8, 11, 20, 3);
        ctx.fill();
        ctx.stroke();
      } else {
        roundRect(ctx, px - 12, py + 12, 11, 20, 3);
        ctx.fill();
        ctx.stroke();
        roundRect(ctx, px + 1, py + 12, 11, 20, 3);
        ctx.fill();
        ctx.stroke();
      }

      // Blue Uchiha shirt
      ctx.fillStyle = "#1d4ed8";
      ctx.strokeStyle = "#1e3a8a";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(px - 15, py - 8);
      ctx.quadraticCurveTo(px - 17, py + 4, px - 13, py + 16);
      ctx.lineTo(px + 13, py + 16);
      ctx.quadraticCurveTo(px + 17, py + 4, px + 15, py - 8);
      ctx.quadraticCurveTo(px, py - 14, px - 15, py - 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Open collar + mesh undershirt
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(px - 5, py - 8);
      ctx.lineTo(px, py - 16);
      ctx.lineTo(px + 5, py - 8);
      ctx.lineTo(px + 4, py + 4);
      ctx.lineTo(px - 4, py + 4);
      ctx.closePath();
      ctx.fill();
      // Mesh dots
      ctx.fillStyle = "#64748b";
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.beginPath();
          ctx.arc(px - 2 + j * 4, py - 4 + i * 3, 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Collar flaps
      ctx.fillStyle = "#1e40af";
      ctx.beginPath();
      ctx.moveTo(px - 12, py - 8);
      ctx.lineTo(px - 10, py - 20);
      ctx.lineTo(px - 2, py - 10);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + 12, py - 8);
      ctx.lineTo(px + 10, py - 20);
      ctx.lineTo(px + 2, py - 10);
      ctx.closePath();
      ctx.fill();

      // Uchiha fan crest on back-left of shirt
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(px - 10, py + 2);
      ctx.lineTo(px - 4, py - 4);
      ctx.lineTo(px - 2, py + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.moveTo(px - 9, py + 1);
      ctx.lineTo(px - 5, py - 2);
      ctx.lineTo(px - 3.5, py + 4);
      ctx.closePath();
      ctx.fill();

      // Purple rope belt
      ctx.fillStyle = "#6d28d9";
      roundRect(ctx, px - 14, py + 12, 28, 5, 1);
      ctx.fill();
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px - 4, py + 12);
      ctx.quadraticCurveTo(px, py + 18, px + 4, py + 12);
      ctx.stroke();

      // Arms — mesh sleeves
      ctx.fillStyle = "#334155";
      if (dashing || charging) {
        roundRect(ctx, px + 8, py - 12, 26, 9, 3);
        ctx.fill();
        ctx.fillStyle = "#1d4ed8";
        roundRect(ctx, px + 8, py - 12, 8, 9, 2);
        ctx.fill();
        ctx.fillStyle = "#334155";
        roundRect(ctx, px - 22, py + 0, 12, 10, 3);
        ctx.fill();
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(px + 36, py - 8, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (firing) {
        roundRect(ctx, px + 10, py - 10, 22, 9, 3);
        ctx.fill();
        ctx.fillStyle = "#1d4ed8";
        roundRect(ctx, px + 10, py - 10, 7, 9, 2);
        ctx.fill();
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(px + 34, py - 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const fg = ctx.createRadialGradient(px + 36, py - 7, 1, px + 36, py - 7, 15);
        fg.addColorStop(0, "#fff");
        fg.addColorStop(0.4, "#fbbf24");
        fg.addColorStop(1, "transparent");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(px + 36, py - 7, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        roundRect(ctx, px - 22, py - 2, 10, 15, 3);
        ctx.fill();
        roundRect(ctx, px + 12, py - 2, 10, 15, 3);
        ctx.fill();
        ctx.fillStyle = "#1d4ed8";
        ctx.fillRect(px - 22, py - 2, 10, 4);
        ctx.fillRect(px + 12, py - 2, 10, 4);
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(px - 17, py + 14, 4, 0, Math.PI * 2);
        ctx.arc(px + 17, py + 14, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Neck
      ctx.fillStyle = skin;
      roundRect(ctx, px - 4, py - 16, 8, 8, 2);
      ctx.fill();

      // Head
      ctx.beginPath();
      ctx.ellipse(px, py - 26, 11, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // ——— Sasuke hair: tall curved spikes + long left bangs ———
      ctx.fillStyle = "#0a0a0a";
      // Soft under-cap
      ctx.beginPath();
      ctx.moveTo(px - 13, py - 28);
      ctx.quadraticCurveTo(px - 14, py - 40, px, py - 42);
      ctx.quadraticCurveTo(px + 14, py - 40, px + 13, py - 26);
      ctx.quadraticCurveTo(px, py - 30, px - 13, py - 28);
      ctx.fill();

      const spike = (
        baseL: [number, number],
        tip: [number, number],
        baseR: [number, number],
        col: string,
      ) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(px + baseL[0], py + baseL[1]);
        ctx.quadraticCurveTo(
          px + (baseL[0] + tip[0]) * 0.5 - 1.5,
          py + (baseL[1] + tip[1]) * 0.55,
          px + tip[0],
          py + tip[1],
        );
        ctx.quadraticCurveTo(
          px + (baseR[0] + tip[0]) * 0.5 + 1.5,
          py + (baseR[1] + tip[1]) * 0.55,
          px + baseR[0],
          py + baseR[1],
        );
        ctx.closePath();
        ctx.fill();
      };

      // Depth row
      spike([-12, -30], [-18, -48], [-4, -34], "#1c1917");
      spike([-4, -34], [-6, -56], [4, -34], "#1c1917");
      spike([4, -32], [8, -52], [12, -28], "#1c1917");
      spike([10, -28], [18, -44], [14, -22], "#1c1917");
      spike([-14, -26], [-22, -40], [-8, -24], "#1c1917");

      // Hero spikes — taller, curved
      spike([-11, -32], [-15, -58], [-2, -36], "#050505");
      spike([-5, -36], [-3, -66], [4, -36], "#000");
      spike([0, -36], [4, -68], [8, -34], "#000");
      spike([5, -34], [12, -60], [11, -30], "#050505");
      spike([9, -30], [17, -50], [13, -24], "#0a0a0a");
      spike([12, -24], [22, -38], [14, -18], "#0a0a0a");
      spike([-13, -28], [-20, -46], [-6, -26], "#000");
      spike([-10, -22], [-17, -34], [-4, -20], "#0a0a0a");

      // Highlight on crown spike
      ctx.strokeStyle = "rgba(71,85,105,0.5)";
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px + 1, py - 60);
      ctx.lineTo(px + 2, py - 42);
      ctx.stroke();

      // Long left bangs past the cheek
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(px - 10, py - 34);
      ctx.quadraticCurveTo(px - 18, py - 20, px - 14, py - 2);
      ctx.quadraticCurveTo(px - 11, py - 10, px - 8, py - 4);
      ctx.quadraticCurveTo(px - 6, py - 16, px - 3, py - 32);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px - 6, py - 36);
      ctx.quadraticCurveTo(px - 12, py - 18, px - 7, py + 2);
      ctx.quadraticCurveTo(px - 4, py - 8, px - 1, py - 2);
      ctx.quadraticCurveTo(px + 1, py - 16, px + 2, py - 34);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px - 2, py - 34);
      ctx.quadraticCurveTo(px - 6, py - 18, px - 3, py - 8);
      ctx.quadraticCurveTo(px, py - 14, px + 2, py - 32);
      ctx.closePath();
      ctx.fill();
      // Short right fringe
      ctx.beginPath();
      ctx.moveTo(px + 4, py - 32);
      ctx.quadraticCurveTo(px + 8, py - 22, px + 7, py - 14);
      ctx.quadraticCurveTo(px + 10, py - 20, px + 9, py - 30);
      ctx.closePath();
      ctx.fill();

      // Forehead protector
      ctx.fillStyle = "#1e293b";
      roundRect(ctx, px - 11, py - 34, 22, 5, 1);
      ctx.fill();
      ctx.fillStyle = "#cbd5e1";
      roundRect(ctx, px - 4.5, py - 35, 9, 7, 1);
      ctx.fill();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(px, py - 31.5, 2.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py - 33.5);
      ctx.lineTo(px, py - 29.5);
      ctx.stroke();
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(px - 12, py - 32, 2, 4);
      ctx.fillRect(px + 10, py - 32, 2, 4);

      // Sharingan — big and readable
      const eye = (ox: number) => {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(px + ox, py - 26, 3.6, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = mangekyo || susanoo ? "#7f1d1d" : "#e11d48";
        ctx.beginPath();
        ctx.ellipse(px + ox, py - 26, 3.1, 3.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0a0a0a";
        ctx.beginPath();
        ctx.arc(px + ox, py - 26, 1.3, 0, Math.PI * 2);
        ctx.fill();
        if (mangekyo || susanoo) {
          ctx.strokeStyle = "#111";
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + s.frame * 0.05;
            ctx.beginPath();
            ctx.arc(px + ox + Math.cos(a) * 2, py - 26 + Math.sin(a) * 2, 0.85, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else {
          // Three tomoe
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 - 0.55;
            ctx.beginPath();
            ctx.ellipse(
              px + ox + Math.cos(a) * 1.85,
              py - 26 + Math.sin(a) * 1.85,
              0.85,
              0.55,
              a,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        }
      };
      eye(-4.2);
      eye(4.2);

      // Chidori in palm
      if (!susanoo && (charging || dashing)) {
        const handX = px + (dashing ? 38 : 32);
        const handY = py + (dashing ? -10 : -8);
        const size = charging ? 10 + (14 - s.chargeT) * 1.1 : 19;
        drawChidori(handX, handY, size, dashing || s.chargeT < 5);
        if (charging) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = `rgba(103,232,249,${0.25 + (14 - s.chargeT) * 0.04})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(handX, handY, 14 + ((s.frame * 3) % 16), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
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
      if (s.fireCool > 0) s.fireCool--;
      if (s.poseT > 0) {
        s.poseT--;
        if (s.poseT === 0) s.pose = "";
      }
      const gY = ground();

      // Gravity / jump
      if (s.dashT <= 0) {
        s.vy += 0.55;
        s.yOff -= s.vy;
        if (s.yOff <= 0) {
          s.yOff = 0;
          s.vy = 0;
        }
      }

      // Charge → then launch dash
      if (s.chargeT > 0) {
        s.chargeT--;
        if (s.frame % 2 === 0) burst(s.x + 28, gY - 16 - s.yOff, "#67e8f9", 3, 2);
        if (s.chargeT === 0) startChidoriDash();
      }

      // Player move (when not locked in dash/charge)
      if (s.alive && s.dashT <= 0 && s.chargeT <= 0) {
        let mx = 0;
        if (keys.current.left) mx -= 1;
        if (keys.current.right) mx += 1;
        s.x += mx * 3.4;
        s.x = Math.max(28, Math.min(s.w * 0.62, s.x));
        if (keys.current.jump) doJump();
      } else if (s.dashT > 0) {
        s.x += s.dashVx;
        s.x = Math.max(30, Math.min(s.w * 0.82, s.x));
        s.dashT--;
        if (s.frame % 2 === 0) s.afterimages.push({ x: s.x, y: gY - 4 - s.yOff, life: 10 });
        if (s.frame % 2 === 0) burst(s.x + 40, gY - 18 - s.yOff, "#e0f2fe", 4, 2);
        for (const e of s.enemies) {
          if (e.hitToken === s.hitToken || e.hp <= 0) continue;
          const eMid = gY - e.air - e.h * 0.45;
          const sMid = gY - s.yOff - 20;
          if (e.x > s.x - 10 && e.x < s.x + 70 && Math.abs(eMid - sMid) < 42) {
            e.hitToken = s.hitToken;
            hurtEnemy(e, s.mangekyoT > 0 ? 2 : 1, s.mangekyoT > 0);
            burst(e.x, eMid, "#67e8f9", 14, 3);
            burst(e.x, eMid, "#fff", 8, 2);
            s.shake = Math.max(s.shake, 8);
          }
        }
      }

      for (const a of s.afterimages) a.life--;
      s.afterimages = s.afterimages.filter((a) => a.life > 0);

      // Projectiles
      for (const sl of s.slashes) {
        sl.x += sl.vx;
        sl.life--;
        for (const e of s.enemies) {
          if (e.hp <= 0 || sl.struck.has(e)) continue;
          const reach = sl.big ? 55 : sl.kind === "fire" ? 36 : 34;
          const eMid = gY - e.air - e.h * 0.45;
          if (Math.abs(e.x - sl.x) < reach && Math.abs(eMid - sl.y) < (sl.kind === "fire" ? 42 : 50)) {
            sl.struck.add(e);
            const burn = sl.kind === "fire" || (s.mangekyoT > 0 && sl.kind === "chidori");
            hurtEnemy(e, sl.dmg, burn);
            if (sl.kind === "fire") burst(e.x, eMid, "#f97316", 10, 3);
          }
        }
      }
      s.slashes = s.slashes.filter((sl) => sl.life > 0 && sl.x < s.w + 40);

      if (s.alive) {
        if (--s.spawnIn <= 0) {
          const flyer = Math.random() < 0.32;
          s.enemies.push({
            x: s.w * 0.82 + Math.random() * s.w * 0.12,
            y: gY,
            air: flyer ? 48 + Math.random() * 36 : 0,
            vx: -(1.5 + Math.min(1.8, s.score * 0.0025) + Math.random() * 0.55),
            hp: flyer ? 1 : 2,
            burn: 0,
            w: flyer ? 28 : 24,
            h: flyer ? 32 : 48,
            hitFlash: 0,
            hitToken: 0,
            kind: flyer ? "flyer" : "grunt",
          });
          s.spawnIn = Math.max(26, 52 - Math.min(18, s.score / 70));
        }

        for (const e of s.enemies) {
          e.x += e.vx * (s.susanooT > 0 ? 0.7 : 1);
          if (e.kind === "flyer") e.air += Math.sin(s.frame / 10 + e.x * 0.02) * 0.6;
          if (e.hitFlash > 0) e.hitFlash--;
          if (e.burn > 0) {
            e.burn--;
            if (e.burn % 18 === 0) {
              hurtEnemy(e, 1, false);
              burst(e.x, gY - e.air - e.h / 2, "#111", 4, 2);
            }
          }
        }

        s.enemies = s.enemies.filter((e) => e.hp > 0 && e.x > -40);

        for (const e of s.enemies) {
          const reach = s.susanooT > 0 ? s.x + 55 : s.x + 22;
          const eMid = gY - e.air - e.h * 0.4;
          const sMid = gY - s.yOff - 18;
          const closeX = e.x - e.w / 2 < reach && e.x + e.w / 2 > s.x - 16;
          const closeY = Math.abs(eMid - sMid) < (e.kind === "flyer" ? 28 : 36);
          if (closeX && closeY) {
            if (s.susanooT > 0) {
              e.x += 55;
              hurtEnemy(e, 2, false);
              continue;
            }
            // Jump over grunts if high enough
            if (e.kind === "grunt" && s.yOff > 28) continue;
            s.alive = false;
            setAlive(false);
            burst(s.x, gY - 20 - s.yOff, "#ef4444", 20, 3);
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

      for (const e of s.enemies) drawEnemy(e);

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
        } else if (sl.kind === "fire") {
          drawKaton(sl.x, sl.y);
          // Spawn trailing embers
          if (s.frame % 2 === 0) {
            s.parts.push({
              x: sl.x - 8,
              y: sl.y + (Math.random() - 0.5) * 10,
              vx: -1 - Math.random(),
              vy: -0.5 - Math.random() * 1.5,
              life: 12,
              color: Math.random() > 0.5 ? "#f97316" : "#fbbf24",
              size: 2 + Math.random() * 2,
            });
          }
        } else {
          drawChidori(sl.x, sl.y, 14, true);
          ctx.strokeStyle = "rgba(224,242,254,0.7)";
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(sl.x - 36, sl.y);
          ctx.lineTo(sl.x + 8, sl.y - 3);
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

      drawSasuke(s.x, gY - 4 - s.yOff, s.dashT > 0, s.chargeT > 0);

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

      const b = btns();
      if (b.left) drawBtn(b.left, "◀", keys.current.left, "#1e293b");
      if (b.right) drawBtn(b.right, "▶", keys.current.right, "#1e293b");
      drawBtn(b.jump, "JUMP", s.yOff <= 2 && s.dashT <= 0, "#334155");
      drawBtn(b.fire, "FIRE", s.fireCool <= 0 && s.susanooT <= 0, "#ea580c");
      drawBtn(b.chidori, b.chidori.label, s.cooldown <= 0 && s.chargeT <= 0 && s.dashT <= 0, "#0284c7");
      drawBtn(b.ms, "MS", s.ocular >= 50 && s.mangekyoT <= 0 && s.susanooT <= 0, "#dc2626");
      drawBtn(b.susan, b.susan.label, s.ocular >= 100 && s.susanooT <= 0, "#7c3aed");

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
        ctx.fillText(isPhone() ? "◀▶ move · JUMP · FIRE · CHI · MS/SU" : "A/D move · W jump · J Chidori · K Fire · C MS · V Susanoo", s.w / 2 - (isPhone() ? 110 : 200), s.h * 0.2);
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        keys.current.left = true;
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        keys.current.right = true;
      }
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        keys.current.jump = true;
        doJump();
      }
      if (e.code === "Space" || e.code === "KeyJ") {
        e.preventDefault();
        if (!e.repeat) dash(state.current.x + 120);
      }
      if (e.code === "KeyK" || e.code === "KeyF") {
        e.preventDefault();
        if (!e.repeat) castFire();
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
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.current.right = false;
      if (e.code === "ArrowUp" || e.code === "KeyW") keys.current.jump = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      if (!state.current.alive) return reset();
      const p = pos(e);
      const b = btns();
      if (b.left && hit(p, b.left)) {
        keys.current.left = true;
        keys.current.right = false;
        return;
      }
      if (b.right && hit(p, b.right)) {
        keys.current.right = true;
        keys.current.left = false;
        return;
      }
      if (hit(p, b.jump)) return doJump();
      if (hit(p, b.fire)) return castFire();
      if (hit(p, b.chidori)) return dash(state.current.x + 120);
      if (hit(p, b.ms)) return activateMangekyo();
      if (hit(p, b.susan)) return activateSusanoo();
    };
    const onPointerUp = () => {
      keys.current.left = false;
      keys.current.right = false;
      keys.current.jump = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons === 0 || !isPhone()) return;
      const p = pos(e);
      const b = btns();
      if (!b.left || !b.right) return;
      if (hit(p, b.left)) {
        keys.current.left = true;
        keys.current.right = false;
      } else if (hit(p, b.right)) {
        keys.current.right = true;
        keys.current.left = false;
      }
    };

    resize();
    reset();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return (
    <GameShell
      ready={ready}
      onEnter={onEnter}
      title="Uchiha Arena"
      tagline="Move · Jump · Katon · Chidori dash · Mangekyo · Susanoo"
      mobileTagline="◀▶ · JUMP · FIRE · CHI · MS/SU"
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
      aliveHint="A/D move, W jump, K fireball, J/Space Chidori. Jump grunts · fire flyers. C MS (50) · V Susanoo (100)."
      deadHint="Cut down! Tap to try again."
      canvasRef={canvasRef}
      ariaLabel="Sasuke Chidori dash mini-game"
    />
  );
}
