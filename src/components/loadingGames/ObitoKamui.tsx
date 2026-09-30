import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  r: number;
  kind: "orb" | "blade" | "beast";
  hitFlash: number;
  dieT: number; // >0 death anim
  dieKind: "" | "wood" | "juubi";
};

type Vine = {
  tx: number;
  ty: number;
  life: number;
  max: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

type Form = "tobi" | "juubi";

/**
 * Kamui Dimension — float in the void.
 * Tap: Kamui (8s intangible) or Wood Style (vines from Obito wipe all).
 * Ten-Tails: 4s invincible + mass kill + scream.
 */
export default function ObitoKamui({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const pointer = useRef({ x: 0, y: 0, down: false, id: -1 });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [chakra, setChakra] = useState(0);
  const [form, setForm] = useState<Form>("tobi");
  const [status, setStatus] = useState("Ready");

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    chakra: 0,
    x: 320,
    y: 180,
    cooldown: 0,
    spawnIn: 28,
    enemies: [] as Enemy[],
    vines: [] as Vine[],
    parts: [] as Particle[],
    shake: 0,
    lastKind: "" as "" | "kamui" | "wood",
    kamuiT: 0, // intangible frames (~8s)
    kamuiCd: 0, // long recharge — cannot refresh Kamui easily
    juubiT: 0, // invincible + form (~4s)
    form: "tobi" as Form,
    announce: "",
    announceT: 0,
    quoteLines: [] as string[],
    quoteT: 0,
    swirl: 0,
    juubiBurstT: 0, // cool mass-kill FX timer
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_obito") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const FPS = 60;
    const KAMUI_FRAMES = 8 * FPS; // 8s intangible
    const KAMUI_RECHARGE = 16 * FPS; // 16s after it ends before Kamui can proc again
    const JUUBI_FRAMES = 4 * FPS; // 4s invincible

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      const s = state.current;
      const wasW = s.w;
      const wasH = s.h;
      s.w = w;
      s.h = h;
      if (wasW > 0) {
        s.x = (s.x / wasW) * w;
        s.y = (s.y / wasH) * h;
      } else {
        s.x = w / 2;
        s.y = h / 2;
      }
    };

    const burst = (x: number, y: number, color: string, n: number, speed: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = Math.random() * speed;
        state.current.parts.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 14 + Math.random() * 18,
          color,
          size: 1.2 + Math.random() * 3.2,
        });
      }
    };

    const syncForm = () => {
      const s = state.current;
      const next: Form = s.juubiT > 0 ? "juubi" : "tobi";
      if (next !== s.form) {
        s.form = next;
        setForm(next);
      }
    };

    const syncStatus = () => {
      const s = state.current;
      if (s.juubiT > 0) setStatus(`Jūbi ${Math.ceil(s.juubiT / FPS)}s`);
      else if (s.kamuiT > 0) setStatus(`Kamui ${Math.ceil(s.kamuiT / FPS)}s`);
      else if (s.kamuiCd > 0) setStatus(`Kamui CD ${Math.ceil(s.kamuiCd / FPS)}s`);
      else if (s.chakra >= 100) setStatus("10-Tail ready");
      else setStatus("Ready");
    };

    const gain = (n: number) => {
      const s = state.current;
      if (s.juubiT > 0) return;
      s.chakra = Math.min(100, s.chakra + n);
      setChakra(Math.round(s.chakra));
      syncStatus();
    };

    const saveBest = () => {
      const s = state.current;
      try {
        const next = Math.max(Number(localStorage.getItem("stackfolio_best_obito") || 0), s.score);
        localStorage.setItem("stackfolio_best_obito", String(next));
        setBest(next);
      } catch {
        /* ignore */
      }
    };

    const wipeEnemies = (dieKind: "wood" | "juubi", ptsEach: number) => {
      const s = state.current;
      let n = 0;
      for (const e of s.enemies) {
        if (e.dieT > 0) continue;
        e.dieT = dieKind === "juubi" ? 36 : 28;
        e.dieKind = dieKind;
        e.hp = 0;
        n++;
        s.score += ptsEach;
        if (dieKind === "wood") {
          s.vines.push({
            tx: e.x,
            ty: e.y,
            life: 32,
            max: 32,
          });
          burst(e.x, e.y, "#4d7c0f", 8, 2.5);
          burst(e.x, e.y, "#854d0e", 6, 2);
        } else {
          burst(e.x, e.y, "#e9d5ff", 14, 4);
          burst(e.x, e.y, "#fafaf9", 10, 3);
        }
      }
      if (n > 0) {
        setScore(s.score);
        gain(Math.min(50, n * 8));
      }
      return n;
    };

    const reset = () => {
      const s = state.current;
      s.alive = true;
      s.score = 0;
      s.chakra = 0;
      s.x = s.w / 2;
      s.y = s.h / 2;
      s.cooldown = 0;
      s.spawnIn = 24;
      s.enemies = [];
      s.vines = [];
      s.parts = [];
      s.shake = 0;
      s.lastKind = "";
      s.kamuiT = 0;
      s.kamuiCd = 0;
      s.juubiT = 0;
      s.juubiBurstT = 0;
      s.form = "tobi";
      s.announce = "WELCOME TO MY DIMENSION";
      s.announceT = 55;
      s.quoteLines = [];
      s.quoteT = 0;
      s.swirl = 0;
      setAlive(true);
      setScore(0);
      setChakra(0);
      setForm("tobi");
      setStatus("Ready");
    };

    /** Tap: Kamui (8s) only when recharged — otherwise Wood Style wipe. */
    const castJutsu = () => {
      const s = state.current;
      if (!s.alive) {
        reset();
        return;
      }
      if (s.cooldown > 0 || s.juubiT > 0 || s.kamuiT > 0) return;

      // Kamui is rare: only eligible off a long recharge, and even then 45% chance
      const canKamui = s.kamuiCd <= 0;
      const kind = canKamui && Math.random() < 0.45 ? "kamui" : "wood";
      s.lastKind = kind;
      s.cooldown = kind === "wood" ? 36 : 24;

      if (kind === "kamui") {
        s.kamuiT = KAMUI_FRAMES;
        // Lock Kamui for duration + long recharge so it cannot be topped up
        s.kamuiCd = KAMUI_FRAMES + KAMUI_RECHARGE;
        burst(s.x, s.y, "#7c3aed", 22, 4);
        burst(s.x, s.y, "#1e1b4b", 12, 3);
        s.announce = "KAMUI — INTANGIBLE!";
        s.announceT = 40;
        s.shake = 5;
        syncStatus();
      } else {
        const n = wipeEnemies("wood", 30);
        burst(s.x, s.y, "#854d0e", 18, 4);
        burst(s.x, s.y, "#4d7c0f", 14, 3.5);
        s.announce = n > 0 ? `MOKUTON! ×${n}` : "MOKUTON!";
        s.announceT = 40;
        s.shake = 10;
      }
    };

    const activateJuubi = () => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.juubiT > 0) return;
      if (s.chakra < 100) {
        s.announce = "NEED 100 CHAKRA!";
        s.announceT = 32;
        return;
      }
      s.chakra = 0;
      setChakra(0);
      s.kamuiT = 0;
      s.juubiT = JUUBI_FRAMES;
      s.juubiBurstT = 50;
      s.shake = 18;
      s.quoteLines = ["Look at me...", "there's nothing", "in my heart!"];
      s.quoteT = 120;
      s.announce = "TEN-TAILS JINCHŪRIKI!";
      s.announceT = 45;
      // Cool mass kill — spiral disintegration
      wipeEnemies("juubi", 55);
      burst(s.x, s.y, "#fafaf9", 40, 7);
      burst(s.x, s.y, "#a78bfa", 28, 5.5);
      burst(s.x, s.y, "#111", 16, 4);
      syncForm();
      syncStatus();
    };

    // ——— Draw ———

    const drawCloud = (cx: number, cy: number, sc: number) => {
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 6.5 * sc, 3.8 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - 3.5 * sc, cy - 1.2 * sc, 2.8 * sc, 0, Math.PI * 2);
      ctx.arc(cx + 3 * sc, cy - 1.8 * sc, 3.1 * sc, 0, Math.PI * 2);
      ctx.arc(cx, cy - 3 * sc, 2.6 * sc, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawTobi = (px: number, py: number) => {
      const s = state.current;
      const bob = Math.sin(s.frame / 10) * 2;
      const juubi = s.juubiT > 0;
      const phased = s.kamuiT > 0;

      ctx.save();
      if (phased) {
        ctx.globalAlpha = 0.4 + Math.sin(s.frame / 4) * 0.15;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const ag = ctx.createRadialGradient(px, py + bob, 6, px, py + bob, 48);
        ag.addColorStop(0, "rgba(167,139,250,0.6)");
        ag.addColorStop(0.5, "rgba(76,29,149,0.3)");
        ag.addColorStop(1, "transparent");
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.arc(px, py + bob, 48, 0, Math.PI * 2);
        ctx.fill();
        // Spiral phase rings
        ctx.strokeStyle = "rgba(196,181,253,0.55)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(px, py + bob, 18 + i * 10 + (s.frame % 20) * 0.3, s.swirl + i, s.swirl + i + Math.PI * 1.2);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.fillStyle = phased ? "rgba(124,58,237,0.25)" : "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(px, py + 28 + bob, juubi ? 26 : 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (juubi) {
        // ——— Ten-Tails jinchūriki (War Arc Obito) ———
        const pulse = 1 + Math.sin(s.frame / 8) * 0.04;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const shroud = ctx.createRadialGradient(px, py + bob, 10, px, py + bob, 78 * pulse);
        shroud.addColorStop(0, "rgba(255,255,255,0.55)");
        shroud.addColorStop(0.25, "rgba(233,213,255,0.4)");
        shroud.addColorStop(0.55, "rgba(88,28,135,0.35)");
        shroud.addColorStop(1, "transparent");
        ctx.fillStyle = shroud;
        ctx.beginPath();
        ctx.arc(px, py + bob, 78 * pulse, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 6; i++) {
          const a = s.frame * 0.05 + (i / 6) * Math.PI * 2;
          const rr = 42 + Math.sin(s.frame / 10 + i) * 4;
          ctx.fillStyle = i % 2 === 0 ? "rgba(250,250,249,0.85)" : "rgba(167,139,250,0.75)";
          ctx.beginPath();
          ctx.ellipse(
            px + Math.cos(a) * rr,
            py + bob + Math.sin(a) * rr * 0.7,
            5,
            8,
            a,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.restore();

        // Flowing white robe panels
        ctx.fillStyle = "#f5f5f4";
        ctx.strokeStyle = "#d6d3d1";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(px - 22, py + 2 + bob);
        ctx.quadraticCurveTo(px - 32, py + 38 + bob, px - 14, py + 42 + bob);
        ctx.lineTo(px - 4, py + 28 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + 22, py + 2 + bob);
        ctx.quadraticCurveTo(px + 32, py + 38 + bob, px + 14, py + 42 + bob);
        ctx.lineTo(px + 4, py + 28 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px - 18, py - 8 + bob);
        ctx.lineTo(px - 24, py + 30 + bob);
        ctx.quadraticCurveTo(px, py + 38 + bob, px + 24, py + 30 + bob);
        ctx.lineTo(px + 18, py - 8 + bob);
        ctx.quadraticCurveTo(px, py - 16 + bob, px - 18, py - 8 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#1c1917";
        roundRect(ctx, px - 16, py + 10 + bob, 32, 6, 2);
        ctx.fill();

        // Triple chest magatama
        for (let i = 0; i < 3; i++) {
          const mx = px - 10 + i * 10;
          const rot = (i - 1) * 0.4;
          ctx.fillStyle = "#0a0a0a";
          ctx.beginPath();
          ctx.ellipse(mx, py + bob, 4, 6.5, rot, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fafaf9";
          ctx.beginPath();
          ctx.arc(mx + Math.cos(rot) * 1.5, py + bob - 1.5, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "#fafaf9";
        ctx.strokeStyle = "#a8a29e";
        ctx.lineWidth = 1.4;
        roundRect(ctx, px - 34, py - 4 + bob, 14, 22, 5);
        ctx.fill();
        ctx.stroke();
        roundRect(ctx, px + 20, py - 4 + bob, 14, 22, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e7e5e4";
        ctx.beginPath();
        ctx.arc(px - 27, py + 20 + bob, 5, 0, Math.PI * 2);
        ctx.arc(px + 27, py + 20 + bob, 5, 0, Math.PI * 2);
        ctx.fill();

        roundRect(ctx, px - 5, py - 18 + bob, 10, 10, 2);
        ctx.fill();

        ctx.fillStyle = "#f5f5f4";
        ctx.strokeStyle = "#a8a29e";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(px, py - 32 + bob, 15, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Face ripple markings
        ctx.strokeStyle = "#292524";
        ctx.lineWidth = 1.3;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(px + side * 4, py - 22 + bob);
          ctx.quadraticCurveTo(px + side * 12, py - 28 + bob, px + side * 13, py - 38 + bob);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px + side * 5, py - 20 + bob);
          ctx.quadraticCurveTo(px + side * 14, py - 24 + bob, px + side * 14, py - 34 + bob);
          ctx.stroke();
        }

        // Ash-white spikes
        ctx.fillStyle = "#fafaf9";
        ctx.strokeStyle = "#d6d3d1";
        ctx.lineWidth = 1;
        const hair: Array<[[number, number], [number, number], [number, number]]> = [
          [[-14, -38], [-22, -62], [-4, -44]],
          [[-6, -44], [-8, -72], [4, -44]],
          [[2, -44], [6, -74], [12, -42]],
          [[8, -40], [18, -64], [16, -36]],
          [[-16, -32], [-26, -50], [-8, -34]],
          [[14, -30], [26, -48], [16, -28]],
        ];
        for (const [a, b, c] of hair) {
          ctx.beginPath();
          ctx.moveTo(px + a[0], py + a[1] + bob);
          ctx.lineTo(px + b[0], py + b[1] + bob);
          ctx.lineTo(px + c[0], py + c[1] + bob);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Curved horns
        ctx.fillStyle = "#e7e5e4";
        ctx.strokeStyle = "#78716c";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(px - 12, py - 42 + bob);
        ctx.quadraticCurveTo(px - 28, py - 58 + bob, px - 22, py - 78 + bob);
        ctx.quadraticCurveTo(px - 14, py - 62 + bob, px - 4, py - 46 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + 12, py - 42 + bob);
        ctx.quadraticCurveTo(px + 28, py - 58 + bob, px + 22, py - 78 + bob);
        ctx.quadraticCurveTo(px + 14, py - 62 + bob, px + 4, py - 46 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#a8a29e";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - 14, py - 50 + bob);
        ctx.quadraticCurveTo(px - 20, py - 60 + bob, px - 18, py - 70 + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + 14, py - 50 + bob);
        ctx.quadraticCurveTo(px + 20, py - 60 + bob, px + 18, py - 70 + bob);
        ctx.stroke();

        // Dual Rinnegan on black sclera
        for (const ox of [-6, 6]) {
          ctx.fillStyle = "#0a0a0a";
          ctx.beginPath();
          ctx.ellipse(px + ox, py - 33 + bob, 5, 5.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#7c3aed";
          ctx.beginPath();
          ctx.ellipse(px + ox, py - 33 + bob, 3.8, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#4c1d95";
          ctx.lineWidth = 0.9;
          for (let ring = 1; ring <= 3; ring++) {
            ctx.beginPath();
            ctx.ellipse(px + ox, py - 33 + bob, 1.1 * ring, 1.15 * ring, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = "#1e1b4b";
          ctx.beginPath();
          ctx.arc(px + ox, py - 33 + bob, 1, 0, Math.PI * 2);
          ctx.fill();
        }

        if (s.quoteT > 0) {
          ctx.fillStyle = "#1c1917";
          ctx.beginPath();
          ctx.ellipse(px, py - 20 + bob, 4.5, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#57534e";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px - 3, py - 22 + bob);
          ctx.lineTo(px - 3, py - 18 + bob);
          ctx.moveTo(px, py - 23 + bob);
          ctx.lineTo(px, py - 17 + bob);
          ctx.moveTo(px + 3, py - 22 + bob);
          ctx.lineTo(px + 3, py - 18 + bob);
          ctx.stroke();
        } else {
          ctx.strokeStyle = "#57534e";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(px, py - 21 + bob, 3.5, 0.15, Math.PI - 0.15);
          ctx.stroke();
        }

        // Chakra tendrils
        ctx.strokeStyle = "rgba(233,213,255,0.55)";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        for (let i = 0; i < 5; i++) {
          const a = -0.9 + i * 0.45 + Math.sin(s.frame / 12 + i) * 0.15;
          const len = 36 + (i % 3) * 8 + Math.sin(s.frame / 9 + i) * 5;
          ctx.beginPath();
          ctx.moveTo(px, py + 8 + bob);
          ctx.quadraticCurveTo(
            px + Math.cos(a) * len * 0.5,
            py + bob + 8 + Math.sin(a) * len * 0.4,
            px + Math.cos(a) * len,
            py + bob + Math.sin(a) * len * 0.85,
          );
          ctx.stroke();
        }

        ctx.restore();
        return;
      }

      // Akatsuki cloak
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.moveTo(px - 16, py - 4 + bob);
      ctx.quadraticCurveTo(px - 22, py + 22 + bob, px - 10, py + 26 + bob);
      ctx.quadraticCurveTo(px, py + 30 + bob, px + 10, py + 26 + bob);
      ctx.quadraticCurveTo(px + 22, py + 22 + bob, px + 16, py - 4 + bob);
      ctx.quadraticCurveTo(px, py - 10 + bob, px - 16, py - 4 + bob);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.moveTo(px - 11, py - 2 + bob);
      ctx.quadraticCurveTo(px - 14, py - 16 + bob, px - 3, py - 10 + bob);
      ctx.lineTo(px + 3, py - 10 + bob);
      ctx.quadraticCurveTo(px + 14, py - 16 + bob, px + 11, py - 2 + bob);
      ctx.closePath();
      ctx.fill();

      drawCloud(px - 6, py + 8 + bob, 0.9);
      drawCloud(px + 8, py + 14 + bob, 0.75);

      ctx.fillStyle = "#050505";
      const spikes: Array<[[number, number], [number, number], [number, number]]> = [
        [[-11, -20], [-17, -42], [-3, -24]],
        [[-3, -26], [-2, -50], [5, -26]],
        [[4, -24], [8, -52], [11, -22]],
        [[9, -18], [18, -40], [13, -16]],
        [[-13, -14], [-20, -32], [-6, -14]],
      ];
      for (const [a, b, c] of spikes) {
        ctx.beginPath();
        ctx.moveTo(px + a[0], py + a[1] + bob);
        ctx.lineTo(px + b[0], py + b[1] + bob);
        ctx.lineTo(px + c[0], py + c[1] + bob);
        ctx.closePath();
        ctx.fill();
      }

      // Orange spiral Tobi mask
      ctx.fillStyle = "#ea580c";
      ctx.strokeStyle = "#9a3412";
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.ellipse(px, py - 16 + bob, 13, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "#c2410c";
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let t = 0; t < 24; t++) {
        const a = t * 0.52;
        const r = 1.2 + t * 0.48;
        const mx = px + Math.cos(a) * r;
        const my = py - 16 + bob + Math.sin(a) * r * 0.95;
        if (t === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      }
      ctx.stroke();

      ctx.fillStyle = "#1c1917";
      ctx.beginPath();
      ctx.ellipse(px + 4.8, py - 17 + bob, 4.4, 4.8, 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fecaca";
      ctx.beginPath();
      ctx.ellipse(px + 4.8, py - 17 + bob, 3.3, 3.6, 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.ellipse(px + 4.8, py - 17 + bob, 2.7, 2.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(px + 4.8, py - 17 + bob, 1.05, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(px + 4.8 + Math.cos(a) * 1.45, py - 17 + bob + Math.sin(a) * 1.45, 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    /** Vines growing out of Obito toward targets. */
    const drawVines = () => {
      const s = state.current;
      for (const v of s.vines) {
        const t = 1 - v.life / v.max;
        const grow = Math.min(1, t * 2.2);
        const sx = s.x;
        const sy = s.y;
        const ex = sx + (v.tx - sx) * grow;
        const ey = sy + (v.ty - sy) * grow;

        // Thick vine body with wobble
        ctx.strokeStyle = "#3f2a14";
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        const mx = (sx + ex) / 2 + Math.sin(s.frame / 5 + v.tx) * 18;
        const my = (sy + ey) / 2 + Math.cos(s.frame / 6 + v.ty) * 14;
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();

        ctx.strokeStyle = "#854d0e";
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();

        ctx.strokeStyle = "#a16207";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx - 4, my + 3, ex, ey);
        ctx.stroke();

        // Leaves along vine
        if (grow > 0.35) {
          ctx.fillStyle = "#4d7c0f";
          for (let i = 1; i <= 3; i++) {
            const u = i / 4;
            const lx = sx + (ex - sx) * u + Math.sin(u * 8) * 6;
            const ly = sy + (ey - sy) * u + Math.cos(u * 7) * 5;
            ctx.beginPath();
            ctx.ellipse(lx, ly, 6, 3.5, u * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Crush bloom at tip when fully grown
        if (grow > 0.85) {
          ctx.fillStyle = "#365314";
          ctx.beginPath();
          ctx.arc(ex, ey, 10 * (v.life / v.max + 0.4), 0, Math.PI * 2);
          ctx.fill();
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + s.frame * 0.1;
            ctx.strokeStyle = "#78350f";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + Math.cos(a) * 14, ey + Math.sin(a) * 14);
            ctx.stroke();
          }
        }
      }
    };

    const drawEnemy = (e: Enemy) => {
      const flash = e.hitFlash > 0;
      let scale = 1;
      let alpha = 1;
      if (e.dieT > 0) {
        const t = e.dieT / (e.dieKind === "juubi" ? 36 : 28);
        if (e.dieKind === "wood") {
          scale = 0.3 + t * 0.7;
          alpha = t;
        } else {
          // Spiral shrink into white void
          scale = t;
          alpha = t;
        }
      }
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;

      if (e.dieKind === "juubi" && e.dieT > 0) {
        ctx.rotate(state.current.frame * 0.3 + e.x);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, e.r * 2);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.4, "#e9d5ff");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (e.kind === "blade") {
        ctx.rotate(Math.atan2(e.vy, e.vx));
        ctx.fillStyle = flash ? "#fecaca" : "#94a3b8";
        ctx.beginPath();
        ctx.moveTo(e.r + 4, 0);
        ctx.lineTo(-e.r, -5);
        ctx.lineTo(-e.r, 5);
        ctx.closePath();
        ctx.fill();
      } else if (e.kind === "beast") {
        ctx.fillStyle = flash ? "#fecaca" : "#44403c";
        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#78716c";
        ctx.beginPath();
        ctx.moveTo(-6, -e.r);
        ctx.lineTo(-10, -e.r - 10);
        ctx.lineTo(-1, -e.r + 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(6, -e.r);
        ctx.lineTo(10, -e.r - 10);
        ctx.lineTo(1, -e.r + 2);
        ctx.fill();
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(-4, -2, 2, 0, Math.PI * 2);
        ctx.arc(4, -2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, e.r);
        g.addColorStop(0, flash ? "#fecaca" : "#86efac");
        g.addColorStop(0.6, flash ? "#f87171" : "#166534");
        g.addColorStop(1, "#052e16");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const btnJuubi = () => {
      const s = state.current;
      return { x: s.w - 64, y: s.h - 44, w: 54, h: 34 };
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      s.swirl += 0.012;
      if (s.cooldown > 0) s.cooldown--;
      if (s.announceT > 0) s.announceT--;
      if (s.quoteT > 0) s.quoteT--;
      if (s.juubiBurstT > 0) s.juubiBurstT--;

      if (s.kamuiT > 0) {
        s.kamuiT--;
        if (s.kamuiT === 0) {
          s.announce = "KAMUI ENDED — RECHARGING";
          s.announceT = 36;
          syncStatus();
        } else if (s.kamuiT % FPS === 0) syncStatus();
      }
      if (s.kamuiCd > 0) {
        s.kamuiCd--;
        if (s.kamuiCd === 0) {
          s.announce = "KAMUI READY";
          s.announceT = 28;
          syncStatus();
        } else if (s.kamuiT <= 0 && s.kamuiCd % FPS === 0) syncStatus();
      }

      if (s.juubiT > 0) {
        s.juubiT--;
        // Keep wiping anything that spawned during invincibility window
        if (s.frame % 8 === 0) {
          for (const e of s.enemies) {
            if (e.dieT <= 0) {
              e.dieT = 30;
              e.dieKind = "juubi";
              e.hp = 0;
              s.score += 40;
              burst(e.x, e.y, "#e9d5ff", 10, 3.5);
              setScore(s.score);
            }
          }
        }
        if (s.juubiT === 0) {
          s.announce = "MASK RETURNS…";
          s.announceT = 40;
          syncForm();
          syncStatus();
        } else if (s.juubiT % FPS === 0) syncStatus();
      }

      s.shake *= 0.88;

      // Drag move
      if (s.alive && pointer.current.down) {
        const tx = pointer.current.x;
        const ty = pointer.current.y;
        const bj = btnJuubi();
        const onBtn = tx >= bj.x && tx <= bj.x + bj.w && ty >= bj.y && ty <= bj.y + bj.h;
        if (!onBtn) {
          s.x += (tx - s.x) * 0.18;
          s.y += (ty - s.y) * 0.18;
        }
      }
      s.x = Math.max(30, Math.min(s.w - 30, s.x));
      s.y = Math.max(36, Math.min(s.h - 52, s.y));

      if (s.alive) {
        if (--s.spawnIn <= 0) {
          const roll = Math.random();
          const kind: Enemy["kind"] = roll < 0.2 ? "beast" : roll < 0.45 ? "blade" : "orb";
          const edge = Math.floor(Math.random() * 4);
          let x = 0;
          let y = 0;
          if (edge === 0) {
            x = Math.random() * s.w;
            y = -20;
          } else if (edge === 1) {
            x = s.w + 20;
            y = Math.random() * s.h;
          } else if (edge === 2) {
            x = Math.random() * s.w;
            y = s.h + 20;
          } else {
            x = -20;
            y = Math.random() * s.h;
          }
          const speed = 1.15 + Math.min(2, s.score * 0.0025) + Math.random() * 0.6;
          const dx = s.x - x;
          const dy = s.y - y;
          const len = Math.hypot(dx, dy) || 1;
          s.enemies.push({
            x,
            y,
            vx: (dx / len) * speed,
            vy: (dy / len) * speed,
            hp: kind === "beast" ? 3 : 1,
            r: kind === "beast" ? 16 : kind === "blade" ? 10 : 12,
            kind,
            hitFlash: 0,
            dieT: 0,
            dieKind: "",
          });
          s.spawnIn = Math.max(14, 34 - Math.min(18, s.score / 70));
        }

        for (const e of s.enemies) {
          if (e.hitFlash > 0) e.hitFlash--;
          if (e.dieT > 0) {
            e.dieT--;
            if (e.dieKind === "juubi") {
              // Spiral inward toward Obito while dying
              e.x += (s.x - e.x) * 0.08;
              e.y += (s.y - e.y) * 0.08;
            }
            continue;
          }
          const dx = s.x - e.x;
          const dy = s.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          const steer = e.kind === "blade" ? 0.085 : 0.05;
          e.vx += (dx / len) * steer;
          e.vy += (dy / len) * steer;
          const sp = Math.hypot(e.vx, e.vy) || 1;
          const maxSp = e.kind === "blade" ? 3.9 : e.kind === "beast" ? 2.3 : 2.9;
          if (sp > maxSp) {
            e.vx = (e.vx / sp) * maxSp;
            e.vy = (e.vy / sp) * maxSp;
          }
          e.x += e.vx;
          e.y += e.vy;
        }

        for (const v of s.vines) v.life--;
        s.vines = s.vines.filter((v) => v.life > 0);
        s.enemies = s.enemies.filter((e) => e.dieT > 0 || e.hp > 0);
        // Remove finished death anims
        s.enemies = s.enemies.filter((e) => !(e.dieT <= 0 && e.hp <= 0));

        // Contact — kamui intangible / juubi invincible
        const safe = s.kamuiT > 0 || s.juubiT > 0;
        if (!safe) {
          for (const e of s.enemies) {
            if (e.dieT > 0) continue;
            if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 16) {
              s.alive = false;
              setAlive(false);
              burst(s.x, s.y, "#ef4444", 28, 4);
              s.shake = 14;
              saveBest();
              break;
            }
          }
        }
      }

      for (const p of s.parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      }
      s.parts = s.parts.filter((p) => p.life > 0);

      // ——— Draw ———
      const hs = hudScale(s.w);
      ctx.save();
      ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      const bg = ctx.createRadialGradient(s.w / 2, s.h / 2, 20, s.w / 2, s.h / 2, Math.max(s.w, s.h) * 0.7);
      if (s.juubiT > 0) {
        bg.addColorStop(0, "#5b21b6");
        bg.addColorStop(0.4, "#1e1b4b");
        bg.addColorStop(1, "#0a0a0a");
      } else if (s.kamuiT > 0) {
        bg.addColorStop(0, "#312e81");
        bg.addColorStop(0.45, "#1e1b4b");
        bg.addColorStop(1, "#0a0a0a");
      } else {
        bg.addColorStop(0, "#1e1030");
        bg.addColorStop(0.45, "#0f0a18");
        bg.addColorStop(1, "#050508");
      }
      ctx.fillStyle = bg;
      ctx.fillRect(-10, -10, s.w + 20, s.h + 20);

      // Background spiral
      ctx.save();
      ctx.translate(s.w / 2, s.h / 2);
      ctx.rotate(s.swirl);
      ctx.strokeStyle = s.kamuiT > 0 ? "rgba(167,139,250,0.14)" : "rgba(234,88,12,0.1)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      for (let t = 0; t < 80; t++) {
        const a = t * 0.35;
        const r = 10 + t * 4.2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Ten-Tails nova ring
      if (s.juubiBurstT > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const t = 1 - s.juubiBurstT / 50;
        const R = 40 + t * Math.max(s.w, s.h);
        const g = ctx.createRadialGradient(s.x, s.y, R * 0.2, s.x, s.y, R);
        g.addColorStop(0, `rgba(255,255,255,${0.55 * (1 - t)})`);
        g.addColorStop(0.35, `rgba(233,213,255,${0.4 * (1 - t)})`);
        g.addColorStop(0.7, `rgba(124,58,237,${0.25 * (1 - t)})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, R, 0, Math.PI * 2);
        ctx.fill();
        // Magatama shards flying out
        ctx.fillStyle = `rgba(250,250,249,${0.8 * (1 - t)})`;
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + t * 2;
          const rr = 30 + t * 180;
          ctx.beginPath();
          ctx.ellipse(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, 8, 12, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.fillStyle = "rgba(253,186,116,0.22)";
      for (let i = 0; i < 16; i++) {
        const ax = ((i * 73 + s.frame * 0.4) % (s.w + 20)) - 10;
        const ay = ((i * 97 + s.frame * 0.25) % (s.h + 20)) - 10;
        ctx.beginPath();
        ctx.arc(ax, ay, 1.2 + (i % 3) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      drawVines();

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 12);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const e of s.enemies) drawEnemy(e);
      drawTobi(s.x, s.y);

      // HUD
      const barW = Math.min(140, s.w * 0.24);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, 12, 10, barW, 9, 4);
      ctx.fill();
      ctx.fillStyle = s.chakra >= 100 ? "#ea580c" : "#7c3aed";
      roundRect(ctx, 12, 10, (s.chakra / 100) * barW, 9, 4);
      ctx.fill();

      // Kamui active / recharge bar
      if (s.juubiT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        roundRect(ctx, 12, 24, barW, 6, 3);
        ctx.fill();
        ctx.fillStyle = "#fafaf9";
        roundRect(ctx, 12, 24, (s.juubiT / JUUBI_FRAMES) * barW, 6, 3);
        ctx.fill();
      } else if (s.kamuiT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        roundRect(ctx, 12, 24, barW, 6, 3);
        ctx.fill();
        ctx.fillStyle = "#a78bfa";
        roundRect(ctx, 12, 24, (s.kamuiT / KAMUI_FRAMES) * barW, 6, 3);
        ctx.fill();
      } else if (s.kamuiCd > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        roundRect(ctx, 12, 24, barW, 6, 3);
        ctx.fill();
        const total = KAMUI_FRAMES + KAMUI_RECHARGE;
        const done = 1 - s.kamuiCd / total;
        ctx.fillStyle = "#4c1d95";
        roundRect(ctx, 12, 24, done * barW, 6, 3);
        ctx.fill();
      }

      ctx.font = `700 ${11 * hs}px Comic Neue, sans-serif`;
      ctx.fillStyle = s.juubiT > 0 ? "#e9d5ff" : s.kamuiT > 0 ? "#c4b5fd" : s.kamuiCd > 0 ? "#a78bfa" : "#fdba74";
      let label = "TOBI";
      if (s.juubiT > 0) label = `INVINCIBLE ${Math.ceil(s.juubiT / FPS)}s`;
      else if (s.kamuiT > 0) label = `INTANGIBLE ${Math.ceil(s.kamuiT / FPS)}s`;
      else if (s.kamuiCd > 0) label = `KAMUI CD ${Math.ceil(s.kamuiCd / FPS)}s`;
      else if (s.chakra >= 100) label = "TEN-TAILS READY";
      const showBar = s.kamuiT > 0 || s.juubiT > 0 || s.kamuiCd > 0;
      ctx.fillText(label, 12, showBar ? 44 : 36);

      // 10-Tail button
      const bj = btnJuubi();
      const readyJ = s.chakra >= 100 && s.juubiT <= 0;
      ctx.fillStyle = readyJ ? "#dc2626" : "rgba(15,23,42,0.7)";
      ctx.strokeStyle = readyJ ? "#fafaf9" : "#64748b";
      ctx.lineWidth = 2;
      roundRect(ctx, bj.x, bj.y, bj.w, bj.h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "700 9px Comic Neue, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("10TAIL", bj.x + bj.w / 2, bj.y + bj.h / 2 + 3);
      ctx.textAlign = "left";

      if (s.quoteT > 0 && s.quoteLines.length) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.globalAlpha = Math.min(1, s.quoteT / 18);
        ctx.font = `800 ${Math.round(16 * hs)}px Comic Neue, sans-serif`;
        s.quoteLines.forEach((line, i) => {
          const yy = 56 + i * 22 * hs;
          ctx.strokeStyle = "#1e1b4b";
          ctx.lineWidth = 4;
          ctx.strokeText(line, s.w / 2, yy);
          ctx.fillStyle = "#fafaf9";
          ctx.fillText(line, s.w / 2, yy);
        });
        ctx.restore();
      }

      if (s.announceT > 0 && s.quoteT <= 0) {
        ctx.font = `800 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = s.lastKind === "wood" ? "#a3e635" : "#c4b5fd";
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 3;
        ctx.strokeText(s.announce, s.w / 2, 52);
        ctx.fillText(s.announce, s.w / 2, 52);
        ctx.textAlign = "left";
      }

      if (s.alive && s.frame < 130 && s.announceT <= 0 && s.quoteT <= 0) {
        ctx.font = `700 ${11 * hs}px Comic Neue, sans-serif`;
        ctx.fillStyle = "rgba(253,186,116,0.85)";
        ctx.textAlign = "center";
        ctx.fillText("Drag · Tap = Kamui 8s OR Wood wipe · 10TAIL invincible wipe", s.w / 2, s.h - 56);
        ctx.textAlign = "left";
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.textAlign = "center";
        ctx.font = `800 ${20 * hs}px Comic Neue, sans-serif`;
        ctx.fillStyle = "#ea580c";
        ctx.fillText("LOST IN THE SPIRAL", s.w / 2, s.h * 0.42);
        ctx.font = `700 ${12 * hs}px Comic Neue, sans-serif`;
        ctx.fillStyle = "#c4b5fd";
        ctx.fillText("Tap to re-enter Kamui", s.w / 2, s.h * 0.42 + 26);
        ctx.textAlign = "left";
      }

      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const canvasPos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * state.current.w,
        y: ((e.clientY - r.top) / r.height) * state.current.h,
      };
    };

    let downAt = { x: 0, y: 0, t: 0 };
    let moved = false;

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const p = canvasPos(e);
      pointer.current = { x: p.x, y: p.y, down: true, id: e.pointerId };
      downAt = { x: p.x, y: p.y, t: performance.now() };
      moved = false;

      if (!state.current.alive) {
        reset();
        return;
      }

      const bj = btnJuubi();
      if (p.x >= bj.x && p.x <= bj.x + bj.w && p.y >= bj.y && p.y <= bj.y + bj.h) {
        activateJuubi();
        pointer.current.down = false;
        return;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointer.current.id !== e.pointerId && pointer.current.down) return;
      const p = canvasPos(e);
      pointer.current.x = p.x;
      pointer.current.y = p.y;
      if (pointer.current.down && Math.hypot(p.x - downAt.x, p.y - downAt.y) > 10) moved = true;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (pointer.current.id !== -1 && pointer.current.id !== e.pointerId) return;
      const dt = performance.now() - downAt.t;
      if (state.current.alive && !moved && dt < 280) castJutsu();
      pointer.current.down = false;
      pointer.current.id = -1;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "KeyJ") {
        e.preventDefault();
        castJutsu();
      }
      if (e.code === "KeyV" || e.code === "KeyC") {
        e.preventDefault();
        activateJuubi();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    resize();
    reset();
    pointer.current.x = state.current.w / 2;
    pointer.current.y = state.current.h / 2;
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
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
      title="Kamui Dimension"
      tagline="Kamui phase 8s · Wood vines wipe · Ten-Tails invincible wipe"
      mobileTagline="Tap jutsu · 10TAIL"
      strip="TOBI"
      stripHint={status}
      loadingLabel="Opening the other dimension…"
      readyLabel="Spiral sealed — enter portfolio"
      accent="#ea580c"
      accent2="#4c1d95"
      score={score}
      secondaryLabel="Chakra"
      secondaryValue={chakra}
      best={best}
      alive={alive}
      aliveHint="Drag to float. Tap = Wood wipe, or Kamui (8s) when recharged (~24s lockout). V = Ten-Tails."
      deadHint="The spiral took you. Tap to return."
      canvasRef={canvasRef}
      ariaLabel="Obito Kamui dimension mini-game"
    />
  );
}
