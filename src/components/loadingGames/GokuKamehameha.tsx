import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type FormId = "base" | "ssj" | "ssb" | "mui";
type Orb = { x: number; y: number; vy: number; r: number; life: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

const FORM_LABEL: Record<FormId, string> = {
  base: "BASE",
  ssj: "SSJ",
  ssb: "SSB",
  mui: "MUI",
};

const EVOLVE_AT = { ssj: 2, ssb: 4, mui: 7 };

function formStyle(form: FormId) {
  switch (form) {
    case "ssj":
      return { push: 1.25, hair: "#facc15", aura: "#fde047", beam: "#fef08a", glow: "#eab308" };
    case "ssb":
      return { push: 1.55, hair: "#38bdf8", aura: "#38bdf8", beam: "#7dd3fc", glow: "#0ea5e9" };
    case "mui":
      return { push: 1.9, hair: "#f1f5f9", aura: "#e2e8f0", beam: "#e0e7ff", glow: "#a5b4fc" };
    default:
      return { push: 1, hair: "#1a1a1a", aura: "#fb923c", beam: "#38bdf8", glow: "#2563eb" };
  }
}

/**
 * Beam struggle: mash-tap to push the Kamehameha (not hold).
 * Evolve Base → SSJ → SSB → MUI for stronger taps.
 */
export default function GokuKamehameha({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [form, setForm] = useState<FormId>("base");
  const [waves, setWaves] = useState(0);

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    waves: 0,
    form: "base" as FormId,
    clash: 0.5,
    enemyPush: 0.35,
    momentum: 0,
    tapFlash: 0,
    orbs: [] as Orb[],
    parts: [] as Particle[],
    shake: 0,
    announce: "",
    announceT: 0,
    winFlash: 0,
    spawnOrbIn: 50,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_goku") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const gokuX = () => state.current.w * 0.16;
    const enemyX = () => state.current.w * 0.84;
    const beamY = () => state.current.h * 0.55;

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
    };

    const burst = (x: number, y: number, color: string, n = 12, size = 3) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.4 + Math.random() * 3.5;
        state.current.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 18, color, size });
      }
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.waves = 0;
      s.form = "base";
      s.clash = 0.52;
      s.enemyPush = 0.28;
      s.momentum = 0;
      s.tapFlash = 0;
      s.orbs = [];
      s.parts = [];
      s.shake = 0;
      s.announce = "TAP TAP TAP!";
      s.announceT = 55;
      s.winFlash = 0;
      s.spawnOrbIn = 45;
      setAlive(true);
      setScore(0);
      setWaves(0);
      setForm("base");
    };

    const maybeEvolve = () => {
      const s = state.current;
      let next: FormId | null = null;
      if (s.form === "base" && s.waves >= EVOLVE_AT.ssj) next = "ssj";
      else if (s.form === "ssj" && s.waves >= EVOLVE_AT.ssb) next = "ssb";
      else if (s.form === "ssb" && s.waves >= EVOLVE_AT.mui) next = "mui";
      if (!next) return;
      s.form = next;
      setForm(next);
      const st = formStyle(next);
      s.announce = next === "ssj" ? "SUPER SAIYAN!" : next === "ssb" ? "SUPER SAIYAN BLUE!" : "ULTRA INSTINCT!";
      s.announceT = 70;
      s.shake = 10;
      burst(gokuX(), beamY(), st.aura, 28, 4);
      burst(gokuX(), beamY(), st.hair, 16, 3);
    };

    const formBonus = (form: FormId) => (form === "mui" ? 100 : form === "ssb" ? 70 : form === "ssj" ? 40 : 0);

    const winWave = () => {
      const s = state.current;
      s.waves += 1;
      s.score += 180 + s.waves * 40 + formBonus(s.form);
      setWaves(s.waves);
      setScore(s.score);
      s.winFlash = 22;
      s.clash = 0.5;
      s.enemyPush = 0.28 + Math.min(0.25, s.waves * 0.02);
      s.momentum = 0;
      s.announce = "WAVE CLEAR!";
      s.announceT = 35;
      burst(enemyX(), beamY(), "#f97316", 20, 4);
      maybeEvolve();
    };

    const tapPush = () => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.winFlash > 0) return;
      const st = formStyle(s.form);
      // Each tap = strong forward impulse
      s.momentum = Math.min(1.8, s.momentum + 0.55 * st.push);
      s.clash = Math.min(0.96, s.clash + 0.045 * st.push);
      s.tapFlash = 8;
      burst(gokuX() + 34, beamY(), st.beam, 4, 2);
    };

    /** Classic Goku: orange gi, blue boots, tall spikes, both hands on Kamehameha. */
    const drawGoku = (x: number, y: number, formId: FormId, pumping: boolean) => {
      const st = formStyle(formId);
      const f = state.current.frame;
      const push = pumping ? 1 : 0;

      // Soft ki aura (layered glow + sparks — no flame spikes)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pulse = 1 + Math.sin(f / 5) * 0.08 + push * 0.12;
      const aw = 28 * pulse;
      const ah = 46 * pulse;
      // outer soft bloom
      const outer = ctx.createRadialGradient(x, y - 6, 4, x, y - 6, ah);
      outer.addColorStop(0, `${st.aura}00`);
      outer.addColorStop(0.15, `${st.aura}55`);
      outer.addColorStop(0.55, `${st.glow}28`);
      outer.addColorStop(1, "transparent");
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.ellipse(x, y - 4, aw * 1.15, ah, 0, 0, Math.PI * 2);
      ctx.fill();
      // inner bright core around body
      const inner = ctx.createRadialGradient(x, y, 2, x, y, 26 * pulse);
      inner.addColorStop(0, `${st.beam}66`);
      inner.addColorStop(0.4, `${st.aura}44`);
      inner.addColorStop(1, "transparent");
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.ellipse(x, y, 18 * pulse, 28 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      // drifting spark motes
      for (let i = 0; i < 6; i++) {
        const ang = (f / 18 + i * 1.05) % (Math.PI * 2);
        const rr = 16 + (i % 3) * 7;
        const sx = x + Math.cos(ang) * rr * 0.7;
        const sy = y - 8 + Math.sin(ang * 1.3 + i) * rr * 0.9 - (f * 0.4 + i * 7) % 36;
        ctx.globalAlpha = 0.35 + (i % 3) * 0.1;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Boots
      ctx.fillStyle = "#1e3a8a";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      roundRect(ctx, x - 14, y + 30, 12, 10, 3);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, x + 2, y + 30, 12, 10, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x - 14, y + 37, 12, 3);
      ctx.fillRect(x + 2, y + 37, 12, 3);

      // Legs
      ctx.fillStyle = "#2563eb";
      roundRect(ctx, x - 12, y + 14, 11, 18, 3);
      ctx.fill();
      roundRect(ctx, x + 1, y + 14, 11, 18, 3);
      ctx.fill();

      // Gi torso (slightly tapered)
      ctx.fillStyle = "#ea580c";
      ctx.strokeStyle = "#9a3412";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 15, y - 8);
      ctx.lineTo(x + 15, y - 8);
      ctx.lineTo(x + 14, y + 14);
      ctx.lineTo(x - 14, y + 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1d4ed8";
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 8);
      ctx.lineTo(x, y + 3);
      ctx.lineTo(x + 6, y - 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#111827";
      ctx.fillRect(x - 13, y + 10, 26, 5);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 7px sans-serif";
      ctx.fillText("悟", x - 4, y + 14);

      // Both arms forward — clean Kamehameha stance
      const hx = x + 38 + push * 2;
      ctx.fillStyle = "#ea580c";
      ctx.strokeStyle = "#9a3412";
      ctx.lineWidth = 1.5;
      // top arm (shoulder → hand)
      ctx.beginPath();
      ctx.moveTo(x + 10, y - 7);
      ctx.quadraticCurveTo(x + 22, y - 9, hx - 8, y - 6);
      ctx.lineTo(hx - 8, y);
      ctx.quadraticCurveTo(x + 22, y - 2, x + 10, y - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // bottom arm
      ctx.beginPath();
      ctx.moveTo(x + 9, y + 2);
      ctx.quadraticCurveTo(x + 20, y + 1, hx - 8, y + 1);
      ctx.lineTo(hx - 8, y + 7);
      ctx.quadraticCurveTo(x + 20, y + 8, x + 9, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // wristbands
      ctx.fillStyle = "#1e3a8a";
      roundRect(ctx, hx - 12, y - 7, 7, 7, 2);
      ctx.fill();
      roundRect(ctx, hx - 12, y + 1, 7, 7, 2);
      ctx.fill();
      // cupped hands
      ctx.fillStyle = "#f5c89a";
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(hx - 1, y - 2.5, 5, 4, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(hx - 1, y + 4, 5, 4, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hair
      const hairStroke = formId === "base" ? "#0a0a0a" : st.glow;
      const taller = formId === "base" ? 0 : formId === "ssj" ? -5 : formId === "ssb" ? -7 : -9;
      ctx.fillStyle = st.hair;
      ctx.beginPath();
      ctx.ellipse(x, y - 28, 11, 9, -0.1, 0, Math.PI * 2);
      ctx.fill();

      const spikes: Array<[[number, number], [number, number], [number, number]]> =
        formId === "base"
          ? [
              [[-9, -26], [-16, -44], [-2, -28]],
              [[-5, -30], [-10, -56], [3, -30]],
              [[0, -32], [-1, -60], [6, -30]],
              [[4, -28], [9, -52], [10, -26]],
              [[7, -24], [15, -40], [11, -22]],
              [[-11, -20], [-15, -32], [-5, -22]],
            ]
          : [
              [[-10, -28], [-18, -50 + taller], [-2, -30]],
              [[-5, -32], [-10, -64 + taller], [3, -32]],
              [[0, -34], [-1, -68 + taller], [7, -32]],
              [[4, -30], [9, -60 + taller], [11, -28]],
              [[7, -24], [16, -46 + taller], [12, -22]],
              [[-12, -20], [-17, -34 + taller], [-5, -22]],
              [[10, -20], [18, -32 + taller], [13, -18]],
            ];
      for (const [bl, tip, br] of spikes) {
        ctx.fillStyle = st.hair;
        ctx.beginPath();
        ctx.moveTo(x + bl[0], y + bl[1]);
        ctx.lineTo(x + tip[0], y + tip[1]);
        ctx.lineTo(x + br[0], y + br[1]);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hairStroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Head
      ctx.fillStyle = "#f5c89a";
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y - 20, 10.5, 11.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bangs
      ctx.fillStyle = st.hair;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 28);
      ctx.quadraticCurveTo(x - 7, y - 20, x - 3, y - 16);
      ctx.quadraticCurveTo(x, y - 24, x + 2, y - 28);
      ctx.quadraticCurveTo(x + 5, y - 19, x + 7, y - 16);
      ctx.quadraticCurveTo(x + 9, y - 23, x + 11, y - 28);
      ctx.lineTo(x + 9, y - 32);
      ctx.lineTo(x - 9, y - 32);
      ctx.closePath();
      ctx.fill();

      // Face
      if (formId === "mui") {
        ctx.fillStyle = "#a5b4fc";
        ctx.shadowColor = "#c7d2fe";
        ctx.shadowBlur = 5;
      } else {
        ctx.fillStyle = "#111";
      }
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 22);
      ctx.lineTo(x - 2, y - 20);
      ctx.lineTo(x - 7, y - 18);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 20);
      ctx.lineTo(x + 7, y - 22);
      ctx.lineTo(x + 7, y - 18);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#7c2d12";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y - 14, 2.6, 0.2, Math.PI - 0.2);
      ctx.stroke();

      if (formId !== "base") {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(x - 1, y - 34);
        ctx.lineTo(x, y - 50 + taller);
        ctx.lineTo(x + 2, y - 34);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };

    /** Freeza-ish rival: white bio-armor, horns, red eyes, both hands blasting. */
    const drawEnemy = (x: number, y: number) => {
      const pulse = Math.sin(state.current.frame / 5) * 1.5;

      // Soft red aura
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const ap = 1 + Math.sin(state.current.frame / 5) * 0.08;
      const foeAura = ctx.createRadialGradient(x, y - 4, 3, x, y - 4, 40 * ap);
      foeAura.addColorStop(0, "rgba(254,202,202,0.35)");
      foeAura.addColorStop(0.35, "rgba(239,68,68,0.35)");
      foeAura.addColorStop(0.75, "rgba(127,29,29,0.15)");
      foeAura.addColorStop(1, "transparent");
      ctx.fillStyle = foeAura;
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 26 * ap, 40 * ap, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Boots
      ctx.fillStyle = "#7f1d1d";
      roundRect(ctx, x - 14, y + 28, 11, 9, 3);
      ctx.fill();
      roundRect(ctx, x + 3, y + 28, 11, 9, 3);
      ctx.fill();

      // Legs
      ctx.fillStyle = "#e2e8f0";
      roundRect(ctx, x - 13, y + 12, 11, 18, 3);
      ctx.fill();
      roundRect(ctx, x + 2, y + 12, 11, 18, 3);
      ctx.fill();
      ctx.fillStyle = "#a855f7";
      ctx.fillRect(x - 13, y + 20, 11, 4);
      ctx.fillRect(x + 2, y + 20, 11, 4);

      // Torso armor (white with purple chest gem)
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      roundRect(ctx, x - 15, y - 12, 30, 28, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 7, y + 4);
      ctx.lineTo(x, y + 12);
      ctx.lineTo(x - 7, y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#4c1d95";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Shoulder pads
      ctx.fillStyle = "#e2e8f0";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x - 16, y - 8, 7, 6, -0.3, 0, Math.PI * 2);
      ctx.ellipse(x + 16, y - 8, 7, 6, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Both arms forward blasting
      ctx.fillStyle = "#f8fafc";
      roundRect(ctx, x - 36, y - 8, 20, 9, 4);
      ctx.fill();
      roundRect(ctx, x - 36, y + 2, 20, 9, 4);
      ctx.fill();
      ctx.fillStyle = "#a855f7";
      roundRect(ctx, x - 38, y - 9, 8, 10, 2);
      ctx.fill();
      roundRect(ctx, x - 38, y + 1, 8, 10, 2);
      ctx.fill();
      // Hands
      ctx.fillStyle = "#f5d0fe";
      ctx.beginPath();
      ctx.ellipse(x - 42, y - 3, 5, 4.5, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 42, y + 6, 5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head (pale lavender)
      ctx.fillStyle = "#f5d0fe";
      ctx.strokeStyle = "#4c1d95";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y - 26, 11, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Horns
      ctx.fillStyle = "#e2e8f0";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 32);
      ctx.quadraticCurveTo(x - 16, y - 48, x - 6, y - 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 10, y - 32);
      ctx.quadraticCurveTo(x + 16, y - 48, x + 6, y - 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Scouter / visor
      ctx.fillStyle = "#22c55e";
      ctx.strokeStyle = "#14532d";
      ctx.lineWidth = 1;
      roundRect(ctx, x - 2, y - 30, 14, 7, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#86efac";
      ctx.fillRect(x + 2, y - 28, 6, 3);

      // Red glowing eyes
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#f87171";
      ctx.shadowBlur = 4 + pulse;
      ctx.beginPath();
      ctx.ellipse(x - 5, y - 26, 2.5, 2, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 5, y - 26, 2.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Smirk
      ctx.strokeStyle = "#6b21a8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + 1, y - 18, 4, 0.15, Math.PI - 0.4);
      ctx.stroke();

      // Tail curl
      ctx.strokeStyle = "#f5d0fe";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 10);
      ctx.quadraticCurveTo(x + 26, y + 4, x + 22, y - 8);
      ctx.stroke();
      ctx.fillStyle = "#a855f7";
      ctx.beginPath();
      ctx.ellipse(x + 22, y - 10, 4, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      if (s.announceT > 0) s.announceT--;
      if (s.winFlash > 0) s.winFlash--;
      if (s.tapFlash > 0) s.tapFlash--;
      s.shake *= 0.86;
      s.momentum *= 0.88; // tap energy fades — keep tapping!
      const st = formStyle(s.form);
      const gx = gokuX();
      const ex = enemyX();
      const by = beamY();

      if (s.alive && s.winFlash <= 0) {
        // Soft enemy pressure + tap momentum
        const enemyForce = 0.00115 + s.enemyPush * 0.0009 + s.waves * 0.00008;
        const playerForce = s.momentum * 0.0065;
        s.clash += playerForce - enemyForce;
        s.clash = Math.max(0.02, Math.min(0.98, s.clash));

        if (s.tapFlash > 0 && s.frame % 2 === 0) {
          burst(gx + 40 + s.clash * (ex - gx - 50), by, st.beam, 1, 2);
        }

        if (--s.spawnOrbIn <= 0) {
          s.orbs.push({
            x: s.w * (0.28 + Math.random() * 0.44),
            y: -10,
            vy: 1.2 + Math.random(),
            r: 12,
            life: 420,
          });
          s.spawnOrbIn = 55 + Math.random() * 40;
        }
        for (const o of s.orbs) {
          o.y += o.vy;
          o.life--;
        }
        s.orbs = s.orbs.filter((o) => o.life > 0 && o.y < s.h + 20);

        // More forgiving lose line
        if (s.clash <= 0.06) {
          s.alive = false;
          setAlive(false);
          burst(gx, by, "#ef4444", 20, 3);
          localStorage.setItem(
            "stackfolio_best_goku",
            String(Math.max(Number(localStorage.getItem("stackfolio_best_goku") || 0), s.score)),
          );
          setBest(Math.max(Number(localStorage.getItem("stackfolio_best_goku") || 0), s.score));
          s.shake = 12;
        } else if (s.clash >= 0.88) {
          winWave();
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

      const sky = ctx.createLinearGradient(0, 0, s.w, s.h);
      if (s.form === "mui") {
        sky.addColorStop(0, "#0f172a");
        sky.addColorStop(1, "#312e81");
      } else if (s.form === "ssb") {
        sky.addColorStop(0, "#082f49");
        sky.addColorStop(1, "#0c4a6e");
      } else if (s.form === "ssj") {
        sky.addColorStop(0, "#422006");
        sky.addColorStop(1, "#854d0e");
      } else {
        sky.addColorStop(0, "#1c1917");
        sky.addColorStop(1, "#44403c");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      ctx.fillStyle = "#292524";
      ctx.fillRect(0, s.h * 0.74, s.w, s.h * 0.26);
      ctx.fillStyle = st.aura;
      ctx.fillRect(0, s.h * 0.74, s.w, 3);

      const clashX = gx + 40 + s.clash * (ex - gx - 80);
      const formBoost = s.form === "mui" ? 10 : s.form === "ssb" ? 7 : s.form === "ssj" ? 4 : 0;
      const pulse = Math.sin(s.frame / 3) * 2;
      const gokuThick = 10 + formBoost + s.tapFlash * 0.8 + pulse;
      const handX = gx + 42;
      const foeHandX = ex - 44;

      // Soft outer aura bloom behind beams
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const bloom = ctx.createRadialGradient(clashX, by, 4, clashX, by, 55 + formBoost);
      bloom.addColorStop(0, `${st.beam}88`);
      bloom.addColorStop(0.35, `${st.glow}44`);
      bloom.addColorStop(1, "transparent");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(clashX, by, 55 + formBoost, 0, Math.PI * 2);
      ctx.fill();

      // --- Goku Kamehameha: layered glow → color → white core ---
      ctx.lineCap = "round";
      ctx.shadowColor = st.glow;
      ctx.shadowBlur = 18 + formBoost;
      ctx.strokeStyle = `${st.glow}55`;
      ctx.lineWidth = gokuThick + 16;
      ctx.beginPath();
      ctx.moveTo(handX, by);
      ctx.lineTo(clashX, by);
      ctx.stroke();

      const gokuMid = ctx.createLinearGradient(handX, by, clashX, by);
      gokuMid.addColorStop(0, st.glow);
      gokuMid.addColorStop(0.45, st.beam);
      gokuMid.addColorStop(1, "#ffffff");
      ctx.shadowBlur = 10;
      ctx.strokeStyle = gokuMid;
      ctx.lineWidth = gokuThick + 6;
      ctx.beginPath();
      ctx.moveTo(handX, by);
      ctx.lineTo(clashX, by);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(3, gokuThick * 0.35);
      ctx.beginPath();
      ctx.moveTo(handX, by);
      ctx.lineTo(clashX, by);
      ctx.stroke();

      // Energy ripples along Goku's beam
      const beamLen = clashX - handX;
      for (let i = 0; i < 5; i++) {
        const t = ((s.frame * 0.08 + i * 0.2) % 1);
        const rx = handX + beamLen * t;
        const rr = 3 + (1 - Math.abs(t - 0.5) * 2) * 4;
        ctx.globalAlpha = 0.35 + s.tapFlash * 0.04;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(rx, by, rr * 1.6, rr * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // --- Enemy beam (from both hands) ---
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 14;
      ctx.strokeStyle = "rgba(239,68,68,0.4)";
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(foeHandX, by);
      ctx.lineTo(clashX, by);
      ctx.stroke();
      const foeBeam = ctx.createLinearGradient(foeHandX, by, clashX, by);
      foeBeam.addColorStop(0, "#b91c1c");
      foeBeam.addColorStop(0.5, "#ef4444");
      foeBeam.addColorStop(1, "#fecaca");
      ctx.shadowBlur = 8;
      ctx.strokeStyle = foeBeam;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(foeHandX, by);
      ctx.lineTo(clashX, by);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#fff1f2";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(foeHandX, by);
      ctx.lineTo(clashX, by);
      ctx.stroke();

      // Clash star / shockwave
      const clashR = 16 + Math.sin(s.frame / 2) * 4 + formBoost * 0.4;
      const core = ctx.createRadialGradient(clashX, by, 1, clashX, by, clashR + 14);
      core.addColorStop(0, "#fff");
      core.addColorStop(0.25, st.beam);
      core.addColorStop(0.55, `${st.glow}99`);
      core.addColorStop(1, "transparent");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(clashX, by, clashR + 14, 0, Math.PI * 2);
      ctx.fill();
      // Cross sparks at clash
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2 + s.frame * 0.12;
        ctx.beginPath();
        ctx.moveTo(clashX + Math.cos(ang) * 6, by + Math.sin(ang) * 6);
        ctx.lineTo(clashX + Math.cos(ang) * (clashR + 8), by + Math.sin(ang) * (clashR + 8));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      for (const o of s.orbs) {
        const og = ctx.createRadialGradient(o.x, o.y, 1, o.x, o.y, o.r);
        og.addColorStop(0, "#fff");
        og.addColorStop(0.4, "#fde047");
        og.addColorStop(1, "rgba(250,204,21,0)");
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 16);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      }

      drawGoku(gx, by, s.form, s.tapFlash > 0 || s.momentum > 0.3);
      drawEnemy(ex, by);

      // Charge spheres sit in both fighters' cupped hands
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const chargeR = 9 + s.tapFlash * 0.7 + Math.sin(s.frame / 4) * 1.5;
      const charge = ctx.createRadialGradient(handX, by, 1, handX, by, chargeR + 6);
      charge.addColorStop(0, "#fff");
      charge.addColorStop(0.35, st.beam);
      charge.addColorStop(0.7, `${st.glow}88`);
      charge.addColorStop(1, "transparent");
      ctx.fillStyle = charge;
      ctx.beginPath();
      ctx.arc(handX, by, chargeR + 6, 0, Math.PI * 2);
      ctx.fill();
      const foeCharge = ctx.createRadialGradient(foeHandX, by, 1, foeHandX, by, 12);
      foeCharge.addColorStop(0, "#fff");
      foeCharge.addColorStop(0.4, "#f87171");
      foeCharge.addColorStop(1, "transparent");
      ctx.fillStyle = foeCharge;
      ctx.beginPath();
      ctx.arc(foeHandX, by, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const meterW = Math.min(s.w - 40, 280);
      const meterX = (s.w - meterW) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, meterX, 14, meterW, 12, 6);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(meterX, 14, meterW * (1 - s.clash), 12);
      ctx.fillStyle = st.beam;
      ctx.fillRect(meterX + meterW * (1 - s.clash), 14, meterW * s.clash, 12);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      roundRect(ctx, meterX, 14, meterW, 12, 6);
      ctx.stroke();

      const hs = hudScale(s.w);
      ctx.fillStyle = st.hair;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(18 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`KI ${s.score}`, 12, s.h - 36);
      ctx.fillText(`KI ${s.score}`, 12, s.h - 36);
      ctx.fillStyle = st.aura;
      ctx.font = `700 ${Math.round(15 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(FORM_LABEL[s.form], 12, s.h - 16);
      ctx.fillText(FORM_LABEL[s.form], 12, s.h - 16);

      if (s.alive && s.announceT <= 0 && s.momentum < 0.2) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        const tip = s.w < 500 ? "TAP RAPIDLY!" : "KEEP TAPPING TO PUSH THE BEAM";
        ctx.fillText(tip, s.w / 2 - (s.w < 500 ? 48 : 120), s.h * 0.32);
      }

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, s.h * 0.28, s.w, 44);
        ctx.fillStyle = st.aura;
        ctx.font = `700 ${Math.round(26 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText(s.announce, s.w / 2 - s.announce.length * 6.5 * hs, s.h * 0.28 + 32);
        ctx.fillText(s.announce, s.w / 2 - s.announce.length * 6.5 * hs, s.h * 0.28 + 32);
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#f97316";
        ctx.font = `700 ${Math.round(32 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText("OVERPOWERED!", s.w / 2 - 105 * hs, s.h / 2);
        ctx.fillText("OVERPOWERED!", s.w / 2 - 105 * hs, s.h / 2);
        ctx.fillStyle = "#fff7ed";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to try again", s.w / 2 - 52, s.h / 2 + 28);
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const collectAt = (x: number, y: number) => {
      const s = state.current;
      for (const o of s.orbs) {
        if (Math.hypot(o.x - x, o.y - y) < o.r + 24) {
          o.life = 0;
          s.momentum = Math.min(1.8, s.momentum + 0.7);
          s.clash = Math.min(0.92, s.clash + 0.06);
          s.score += 35;
          setScore(s.score);
          burst(o.x, o.y, "#fde047", 10, 3);
        }
      }
      s.orbs = s.orbs.filter((o) => o.life > 0);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return; // each keypress counts once — mash, don't hold
        tapPush();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const pointerPos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * state.current.w,
        y: ((e.clientY - r.top) / r.height) * state.current.h,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const p = pointerPos(e);
      if (!state.current.alive) return reset();
      collectAt(p.x, p.y);
      tapPush();
    };

    resize();
    reset();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <GameShell
      ready={ready}
      onEnter={onEnter}
      title="Beam Struggle"
      tagline="Mash tap / Space to push the Kamehameha · grab yellow ki orbs"
      mobileTagline="Tap rapidly to push the beam"
      strip="CLASH!"
      stripHint={`Form: ${FORM_LABEL[form]}`}
      loadingLabel="Powering up… loading portfolio"
      readyLabel="Limit broken — open the saga"
      accent="#f97316"
      accent2="#2563eb"
      score={score}
      secondaryLabel="Waves"
      secondaryValue={waves}
      best={best}
      alive={alive}
      aliveHint={`Now: ${FORM_LABEL[form]}. Keep tapping! Evolve at waves ${EVOLVE_AT.ssj}/${EVOLVE_AT.ssb}/${EVOLVE_AT.mui}.`}
      deadHint="Overpowered! Tap to struggle again."
      canvasRef={canvasRef}
      ariaLabel="Goku Kamehameha beam struggle mini-game"
    />
  );
}
