import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Enemy = {
  x: number;
  y: number;
  vx: number;
  hp: number;
  kind: "genin" | "snake";
  w: number;
  h: number;
  hitFlash: number;
};

type ShotKind = "shuriken" | "rasengan" | "bijuu";

type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  kind: ShotKind;
  dmg: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

type Mode = "base" | "clones" | "kyuubi";

/**
 * Naruto: shuriken → Rasengan, plus Multi Shadow Clone & Nine-Tails specials.
 */
export default function NarutoRasengan({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const aim = useRef({ x: 400, y: 200 });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [chakra, setChakra] = useState(0);
  const [mode, setMode] = useState<Mode>("base");

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    chakra: 0,
    cooldown: 0,
    spawnIn: 40,
    enemies: [] as Enemy[],
    shots: [] as Shot[],
    parts: [] as Particle[],
    shake: 0,
    throwFlash: 0,
    clonesT: 0,
    kyuubiT: 0,
    announce: "",
    announceT: 0,
    specialCd: 0,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_naruto") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const heroX = () => state.current.w * 0.16;
    const ground = () => state.current.h * 0.72;

    const btnClone = () => {
      const s = state.current;
      return { x: s.w - 108, y: s.h - 52, w: 44, h: 36 };
    };
    const btnKyuubi = () => {
      const s = state.current;
      return { x: s.w - 56, y: s.h - 52, w: 44, h: 36 };
    };

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
      aim.current = { x: w * 0.7, y: h * 0.45 };
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
      const next: Mode = s.kyuubiT > 0 ? "kyuubi" : s.clonesT > 0 ? "clones" : "base";
      setMode(next);
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.chakra = 0;
      s.cooldown = 0;
      s.spawnIn = 35;
      s.enemies = [];
      s.shots = [];
      s.parts = [];
      s.shake = 0;
      s.throwFlash = 0;
      s.clonesT = 0;
      s.kyuubiT = 0;
      s.announce = "BELIEVE IT!";
      s.announceT = 50;
      s.specialCd = 0;
      setAlive(true);
      setScore(0);
      setChakra(0);
      setMode("base");
    };

    const fireShot = (ox: number, oy: number, kind: ShotKind) => {
      const s = state.current;
      const dx = aim.current.x - ox;
      const dy = aim.current.y - oy;
      const len = Math.hypot(dx, dy) || 1;
      const speed = kind === "bijuu" ? 6.5 : kind === "rasengan" ? 7.5 : 9.5;
      s.shots.push({
        x: ox,
        y: oy,
        vx: (dx / len) * speed,
        vy: (dy / len) * speed * 0.85,
        r: kind === "bijuu" ? 20 : kind === "rasengan" ? 16 : 6,
        life: kind === "bijuu" ? 100 : kind === "rasengan" ? 90 : 70,
        kind,
        dmg: kind === "bijuu" ? 5 : kind === "rasengan" ? 3 : 1,
      });
    };

    const activateClones = () => {
      const s = state.current;
      if (!s.alive || s.specialCd > 0) return;
      if (s.clonesT > 0 || s.kyuubiT > 0) return;
      if (s.chakra < 50) {
        s.announce = "NEED 50 CHAKRA!";
        s.announceT = 35;
        return;
      }
      s.chakra -= 50;
      setChakra(s.chakra);
      s.clonesT = 220;
      s.specialCd = 20;
      s.shake = 5;
      s.announce = "MULTI SHADOW CLONE!";
      s.announceT = 55;
      const hx = heroX();
      const hy = ground() - 4;
      burst(hx, hy, "#fdba74", 20, 3);
      burst(hx - 28, hy, "#fed7aa", 10, 2);
      burst(hx + 28, hy, "#fed7aa", 10, 2);
      syncMode();
    };

    const activateKyuubi = () => {
      const s = state.current;
      if (!s.alive || s.specialCd > 0) return;
      if (s.kyuubiT > 0) return;
      if (s.chakra < 100) {
        s.announce = "NEED 100 CHAKRA!";
        s.announceT = 35;
        return;
      }
      s.chakra = 0;
      setChakra(0);
      s.clonesT = 0;
      s.kyuubiT = 280;
      s.specialCd = 25;
      s.shake = 10;
      s.announce = "NINE-TAILS MODE!";
      s.announceT = 65;
      const hx = heroX();
      const hy = ground() - 4;
      burst(hx, hy, "#f97316", 28, 4);
      burst(hx, hy, "#7f1d1d", 16, 3);
      syncMode();
    };

    const throwWeapon = () => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.cooldown > 0) return;

      const hx = heroX();
      const hy = ground() - 28;

      if (s.kyuubiT > 0) {
        fireShot(hx + 22, hy, "bijuu");
        s.cooldown = 14;
        s.shake = 5;
        burst(hx + 24, hy, "#fb923c", 14, 3);
      } else if (s.chakra >= 100) {
        fireShot(hx + 20, hy, "rasengan");
        s.chakra = 0;
        setChakra(0);
        s.cooldown = 18;
        s.shake = 6;
        burst(hx + 24, hy, "#67e8f9", 16, 3);
      } else {
        fireShot(hx + 20, hy, "shuriken");
        s.cooldown = s.clonesT > 0 ? 6 : 8;
        burst(hx + 22, hy, "#94a3b8", 4, 2);
        // Multi Shadow Clone: extra throws from clone positions
        if (s.clonesT > 0) {
          fireShot(hx - 26, hy - 6, "shuriken");
          fireShot(hx + 8, hy - 14, "shuriken");
          burst(hx - 26, hy - 6, "#fdba74", 3, 2);
        }
      }
      s.throwFlash = 6;
    };

    const drawNaruto = (x: number, y: number, throwing: boolean, ghost = false, kyuubi = false) => {
      const lean = throwing ? 4 : 0;
      if (ghost) ctx.globalAlpha = 0.45;

      // Aura
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      if (kyuubi) {
        const cloak = ctx.createRadialGradient(x, y - 8, 4, x, y - 8, 42);
        cloak.addColorStop(0, "rgba(254,215,170,0.55)");
        cloak.addColorStop(0.35, "rgba(249,115,22,0.4)");
        cloak.addColorStop(0.7, "rgba(127,29,29,0.25)");
        cloak.addColorStop(1, "transparent");
        ctx.fillStyle = cloak;
        ctx.beginPath();
        ctx.ellipse(x, y - 6, 32, 44, 0, 0, Math.PI * 2);
        ctx.fill();
        // Flamelike cloak wisps
        for (let i = 0; i < 5; i++) {
          const ox = ((i - 2) / 2) * 14;
          const tip = -42 - Math.sin(state.current.frame / 4 + i) * 5;
          ctx.fillStyle = i % 2 ? "rgba(251,146,60,0.35)" : "rgba(234,88,12,0.3)";
          ctx.beginPath();
          ctx.moveTo(x + ox - 4, y + 6);
          ctx.quadraticCurveTo(x + ox, y + tip * 0.4, x + ox, y + tip);
          ctx.quadraticCurveTo(x + ox, y + tip * 0.4, x + ox + 4, y + 6);
          ctx.fill();
        }
      } else if (state.current.chakra >= 100 && !ghost) {
        const g = ctx.createRadialGradient(x, y - 10, 4, x, y - 10, 34);
        g.addColorStop(0, "rgba(103,232,249,0.35)");
        g.addColorStop(0.5, "rgba(14,165,233,0.15)");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y - 8, 26, 36, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Sandals
      ctx.fillStyle = "#0f172a";
      roundRect(ctx, x - 14, y + 30, 12, 6, 2);
      ctx.fill();
      roundRect(ctx, x + 2, y + 30, 12, 6, 2);
      ctx.fill();

      // Pants
      ctx.fillStyle = kyuubi ? "#7f1d1d" : "#1d4ed8";
      roundRect(ctx, x - 12, y + 12, 11, 20, 3);
      ctx.fill();
      roundRect(ctx, x + 1, y + 12, 11, 20, 3);
      ctx.fill();

      // Jacket / cloak body
      ctx.fillStyle = kyuubi ? "#ea580c" : "#ea580c";
      ctx.strokeStyle = kyuubi ? "#7f1d1d" : "#9a3412";
      ctx.lineWidth = 2;
      roundRect(ctx, x - 15, y - 10, 30, 26, 5);
      ctx.fill();
      ctx.stroke();
      if (!kyuubi) {
        ctx.fillStyle = "#1e40af";
        ctx.fillRect(x - 14, y - 10, 28, 4);
        ctx.strokeStyle = "#fdba74";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x, y + 12);
        ctx.stroke();
      } else {
        // Kyuubi chest seal swirl
        ctx.strokeStyle = "#7f1d1d";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y + 2, 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Arms
      ctx.fillStyle = "#ea580c";
      if (throwing) {
        roundRect(ctx, x + 10 + lean, y - 6, 22, 9, 3);
        ctx.fill();
        roundRect(ctx, x - 20, y - 2, 10, 14, 3);
        ctx.fill();
      } else {
        roundRect(ctx, x - 22, y - 4, 10, 16, 3);
        ctx.fill();
        roundRect(ctx, x + 12, y - 4, 10, 16, 3);
        ctx.fill();
      }
      ctx.fillStyle = kyuubi ? "#fb923c" : "#f5c89a";
      ctx.beginPath();
      if (throwing) {
        ctx.arc(x + 32 + lean, y - 1, 4.5, 0, Math.PI * 2);
        ctx.arc(x - 16, y + 12, 4, 0, Math.PI * 2);
      } else {
        ctx.arc(x - 18, y + 14, 4, 0, Math.PI * 2);
        ctx.arc(x + 18, y + 14, 4, 0, Math.PI * 2);
      }
      ctx.fill();

      // Head
      ctx.fillStyle = kyuubi ? "#fb923c" : "#f5c89a";
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y - 22, 11, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hair
      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 1;
      const spikes: Array<[[number, number], [number, number], [number, number]]> = [
        [[-9, -28], [-14, -46], [-2, -30]],
        [[-4, -32], [-6, -52], [4, -32]],
        [[2, -32], [4, -54], [8, -30]],
        [[6, -28], [14, -44], [10, -26]],
        [[-11, -22], [-16, -34], [-6, -24]],
      ];
      for (const [bl, tip, br] of spikes) {
        ctx.beginPath();
        ctx.moveTo(x + bl[0], y + bl[1]);
        ctx.lineTo(x + tip[0], y + tip[1]);
        ctx.lineTo(x + br[0], y + br[1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 30);
      ctx.quadraticCurveTo(x - 4, y - 22, x, y - 28);
      ctx.quadraticCurveTo(x + 5, y - 20, x + 10, y - 29);
      ctx.lineTo(x + 8, y - 34);
      ctx.lineTo(x - 8, y - 34);
      ctx.closePath();
      ctx.fill();

      if (!kyuubi) {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(x - 11, y - 30, 22, 5);
        ctx.fillStyle = "#cbd5e1";
        roundRect(ctx, x - 4, y - 31, 8, 7, 1);
        ctx.fill();
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y - 27.5, 2.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - 29.5);
        ctx.lineTo(x, y - 25.5);
        ctx.stroke();
      }

      // Whiskers (thicker in kyuubi)
      ctx.strokeStyle = kyuubi ? "#7f1d1d" : "#7c2d12";
      ctx.lineWidth = kyuubi ? 2 : 1.3;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(x + side * 4, y - 20 + i * 3);
          ctx.lineTo(x + side * (kyuubi ? 11 : 9), y - 19 + i * 3);
          ctx.stroke();
        }
      }

      // Eyes
      if (kyuubi) {
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.ellipse(x - 4, y - 22, 3, 3.2, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 4, y - 22, 3, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.ellipse(x - 4, y - 22, 1.4, 2.2, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 4, y - 22, 1.4, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.ellipse(x - 4, y - 22, 2.2, 2.8, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 4, y - 22, 2.2, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x - 3.5, y - 23, 0.7, 0, Math.PI * 2);
        ctx.arc(x + 4.5, y - 23, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = "#7c2d12";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y - 15, 3, 0.15, Math.PI - 0.15);
      ctx.stroke();

      // Fox ears in kyuubi cloak
      if (kyuubi) {
        ctx.fillStyle = "#ea580c";
        ctx.strokeStyle = "#7f1d1d";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 12, y - 30);
        ctx.lineTo(x - 18, y - 48);
        ctx.lineTo(x - 4, y - 34);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 12, y - 30);
        ctx.lineTo(x + 18, y - 48);
        ctx.lineTo(x + 4, y - 34);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    };

    const drawEnemy = (e: Enemy) => {
      const flash = e.hitFlash > 0;
      if (e.kind === "snake") {
        ctx.fillStyle = flash ? "#fef08a" : "#4d7c0f";
        ctx.strokeStyle = "#14532d";
        ctx.lineWidth = 2;
        roundRect(ctx, e.x - e.w / 2, e.y - e.h, e.w, e.h, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#a3e635";
        ctx.beginPath();
        ctx.ellipse(e.x, e.y - e.h - 6, 8, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(e.x - 3, e.y - e.h - 7, 1.5, 0, Math.PI * 2);
        ctx.arc(e.x + 3, e.y - e.h - 7, 1.5, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.fillStyle = flash ? "#fecaca" : "#334155";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      roundRect(ctx, e.x - e.w / 2, e.y - e.h, e.w, e.h * 0.65, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f5c89a";
      ctx.beginPath();
      ctx.ellipse(e.x, e.y - e.h - 4, 8, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(e.x - 8, e.y - e.h - 10, 16, 4);
      ctx.fillStyle = "#111";
      ctx.fillRect(e.x - 5, e.y - e.h - 5, 3, 3);
      ctx.fillRect(e.x + 2, e.y - e.h - 5, 3, 3);
    };

    const drawSpecialBtn = (
      b: { x: number; y: number; w: number; h: number },
      label: string,
      readyBtn: boolean,
      accent: string,
    ) => {
      ctx.fillStyle = readyBtn ? accent : "rgba(30,41,59,0.7)";
      ctx.strokeStyle = readyBtn ? "#fff" : "#64748b";
      ctx.lineWidth = 2;
      roundRect(ctx, b.x, b.y, b.w, b.h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "700 9px Comic Neue, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 3);
      ctx.textAlign = "left";
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      if (s.cooldown > 0) s.cooldown--;
      if (s.throwFlash > 0) s.throwFlash--;
      if (s.announceT > 0) s.announceT--;
      if (s.specialCd > 0) s.specialCd--;
      if (s.clonesT > 0) {
        s.clonesT--;
        if (s.clonesT === 0) syncMode();
      }
      if (s.kyuubiT > 0) {
        s.kyuubiT--;
        if (s.kyuubiT === 0) {
          s.announce = "NINE-TAILS FADED";
          s.announceT = 40;
          syncMode();
        }
      }
      s.shake *= 0.86;
      const gY = ground();
      const hx = heroX();

      if (s.alive) {
        if (--s.spawnIn <= 0) {
          const snake = Math.random() < 0.28;
          const speed =
            (1.15 + Math.min(1.6, s.score * 0.002) + Math.random() * 0.5) * (s.kyuubiT > 0 ? 0.85 : 1);
          s.enemies.push({
            x: s.w + 30,
            y: gY,
            vx: -speed,
            hp: snake ? 3 : 2,
            kind: snake ? "snake" : "genin",
            w: snake ? 28 : 22,
            h: snake ? 34 : 40,
            hitFlash: 0,
          });
          s.spawnIn = Math.max(22, 48 - Math.min(20, s.score / 80));
        }

        for (const e of s.enemies) {
          e.x += e.vx;
          if (e.hitFlash > 0) e.hitFlash--;
        }

        for (const sh of s.shots) {
          sh.x += sh.vx;
          sh.y += sh.vy;
          sh.life--;
          if (sh.kind === "rasengan" || sh.kind === "bijuu") {
            sh.vy += sh.kind === "bijuu" ? 0.02 : 0.04;
            let nearest: Enemy | null = null;
            let bestD = 9999;
            for (const e of s.enemies) {
              const d = Math.hypot(e.x - sh.x, e.y - e.h / 2 - sh.y);
              if (d < bestD) {
                bestD = d;
                nearest = e;
              }
            }
            if (nearest && bestD < (sh.kind === "bijuu" ? 200 : 160)) {
              const tx = nearest.x - sh.x;
              const ty = nearest.y - nearest.h / 2 - sh.y;
              const tl = Math.hypot(tx, ty) || 1;
              const pull = sh.kind === "bijuu" ? 0.45 : 0.35;
              sh.vx += (tx / tl) * pull;
              sh.vy += (ty / tl) * (pull * 0.7);
            }
          }
        }

        for (const sh of s.shots) {
          for (const e of s.enemies) {
            if (e.hp <= 0) continue;
            const ey = e.y - e.h / 2;
            if (Math.hypot(sh.x - e.x, sh.y - ey) < sh.r + e.w * 0.45) {
              e.hp -= sh.dmg;
              e.hitFlash = 6;
              if (sh.kind === "shuriken") sh.life = 0;
              else {
                sh.r *= 0.92;
                burst(sh.x, sh.y, sh.kind === "bijuu" ? "#fb923c" : "#67e8f9", 6, 2);
              }
              if (e.hp <= 0) {
                const pts = (e.kind === "snake" ? 40 : 25) * (s.kyuubiT > 0 ? 1.5 : 1);
                s.score += Math.round(pts);
                const gain = e.kind === "snake" ? 28 : 18;
                s.chakra = Math.min(100, s.chakra + gain);
                setScore(s.score);
                setChakra(s.chakra);
                burst(e.x, ey, e.kind === "snake" ? "#a3e635" : "#94a3b8", 14, 3);
              }
            }
          }
        }

        s.enemies = s.enemies.filter((e) => e.hp > 0 && e.x > -40);
        s.shots = s.shots.filter((sh) => sh.life > 0 && sh.x < s.w + 40 && sh.y > -20 && sh.y < s.h + 20);

        for (const e of s.enemies) {
          // Kyuubi cloak pushes enemies back a bit / larger contact buffer
          const reach = s.kyuubiT > 0 ? hx + 8 : hx + 18;
          if (e.x - e.w / 2 < reach) {
            if (s.kyuubiT > 0) {
              // Nine-tails roar knockback instead of instant death
              e.x += 40;
              e.hp -= 1;
              e.hitFlash = 8;
              burst(e.x, e.y - e.h / 2, "#f97316", 8, 2);
              if (e.hp <= 0) {
                s.score += 30;
                setScore(s.score);
              }
              continue;
            }
            s.alive = false;
            setAlive(false);
            burst(hx, gY - 20, "#ef4444", 22, 3);
            s.shake = 12;
            localStorage.setItem(
              "stackfolio_best_naruto",
              String(Math.max(Number(localStorage.getItem("stackfolio_best_naruto") || 0), s.score)),
            );
            setBest(Math.max(Number(localStorage.getItem("stackfolio_best_naruto") || 0), s.score));
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
      if (s.kyuubiT > 0) {
        sky.addColorStop(0, "#450a0a");
        sky.addColorStop(0.5, "#9a3412");
        sky.addColorStop(1, "#1c1917");
      } else {
        sky.addColorStop(0, "#0c4a6e");
        sky.addColorStop(0.55, "#ea580c");
        sky.addColorStop(1, "#431407");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(0, gY - 40);
      ctx.lineTo(s.w * 0.25, gY - 90);
      ctx.lineTo(s.w * 0.45, gY - 50);
      ctx.lineTo(s.w * 0.7, gY - 110);
      ctx.lineTo(s.w, gY - 55);
      ctx.lineTo(s.w, gY);
      ctx.lineTo(0, gY);
      ctx.fill();

      ctx.fillStyle = "#292524";
      ctx.fillRect(0, gY, s.w, s.h - gY);
      ctx.fillStyle = s.kyuubiT > 0 ? "#ef4444" : "#f97316";
      ctx.fillRect(0, gY, s.w, 3);

      if (s.alive) {
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hx + 20, gY - 28);
        ctx.lineTo(aim.current.x, aim.current.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const e of s.enemies) drawEnemy(e);

      for (const sh of s.shots) {
        if (sh.kind === "rasengan" || sh.kind === "bijuu") {
          const c1 = sh.kind === "bijuu" ? "#fb923c" : "#67e8f9";
          const c2 = sh.kind === "bijuu" ? "#ea580c" : "#0ea5e9";
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const rg = ctx.createRadialGradient(sh.x, sh.y, 1, sh.x, sh.y, sh.r + 10);
          rg.addColorStop(0, "#fff");
          rg.addColorStop(0.35, c1);
          rg.addColorStop(0.7, c2);
          rg.addColorStop(1, "transparent");
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(sh.x, sh.y, sh.r + 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = sh.kind === "bijuu" ? "#fed7aa" : "#e0f2fe";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let t = 0; t < 10; t++) {
            const a = t * 0.7 + s.frame * 0.4;
            const rr = (t / 10) * sh.r;
            const px = sh.x + Math.cos(a) * rr;
            const py = sh.y + Math.sin(a) * rr;
            if (t === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        } else {
          ctx.save();
          ctx.translate(sh.x, sh.y);
          ctx.rotate(s.frame * 0.5 + sh.x * 0.05);
          ctx.fillStyle = "#94a3b8";
          ctx.strokeStyle = "#0f172a";
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(2, -sh.r);
            ctx.lineTo(-2, -sh.r);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          ctx.fillStyle = "#1e293b";
          ctx.beginPath();
          ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 16);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      }

      // Shadow clones beside Naruto
      if (s.clonesT > 0 && s.kyuubiT <= 0) {
        const bob = Math.sin(s.frame / 6) * 2;
        drawNaruto(hx - 30, gY - 4 + bob, s.throwFlash > 0, true, false);
        drawNaruto(hx + 26, gY - 4 - bob, s.throwFlash > 0, true, false);
      }

      drawNaruto(hx, gY - 4, s.throwFlash > 0, false, s.kyuubiT > 0);

      // Chakra meter
      const meterW = Math.min(s.w - 40, 220);
      const meterX = (s.w - meterW) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, meterX, 12, meterW, 12, 6);
      ctx.fill();
      const fill = (s.chakra / 100) * meterW;
      ctx.fillStyle = s.kyuubiT > 0 ? "#ef4444" : s.chakra >= 100 ? "#67e8f9" : "#f97316";
      roundRect(ctx, meterX, 12, Math.max(0, fill), 12, 6);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      roundRect(ctx, meterX, 12, meterW, 12, 6);
      ctx.stroke();

      // Special buttons
      drawSpecialBtn(btnClone(), "CLONE", s.chakra >= 50 && s.clonesT <= 0 && s.kyuubiT <= 0, "#f59e0b");
      drawSpecialBtn(btnKyuubi(), "9-TAIL", s.chakra >= 100 && s.kyuubiT <= 0, "#dc2626");

      const hs = hudScale(s.w);
      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(18 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`XP ${s.score}`, 12, s.h - 36);
      ctx.fillText(`XP ${s.score}`, 12, s.h - 36);
      ctx.fillStyle = s.kyuubiT > 0 ? "#f97316" : s.clonesT > 0 ? "#fbbf24" : s.chakra >= 100 ? "#67e8f9" : "#fb923c";
      ctx.font = `700 ${Math.round(13 * hs)}px Bangers, Impact, sans-serif`;
      let label = `CHAKRA ${Math.round(s.chakra)}%`;
      if (s.kyuubiT > 0) label = `KYUUBI ${Math.ceil(s.kyuubiT / 60)}s`;
      else if (s.clonesT > 0) label = `CLONES ${Math.ceil(s.clonesT / 60)}s`;
      else if (s.chakra >= 100) label = "RASENGAN / 9-TAILS!";
      ctx.strokeText(label, 12, s.h - 16);
      ctx.fillText(label, 12, s.h - 16);

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, s.h * 0.26, s.w, 40);
        ctx.fillStyle = s.kyuubiT > 0 ? "#f97316" : "#fbbf24";
        ctx.font = `700 ${Math.round(22 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText(s.announce, s.w / 2 - s.announce.length * 5.5 * hs, s.h * 0.26 + 28);
        ctx.fillText(s.announce, s.w / 2 - s.announce.length * 5.5 * hs, s.h * 0.26 + 28);
      }

      if (s.alive && s.frame < 100 && s.announceT <= 0) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `700 ${Math.round(12 * hs)}px Comic Neue, sans-serif`;
        const tip = s.w < 500 ? "Tap throw · CLONE / 9-TAIL" : "Tap throw · C = clones · V = Nine-Tails";
        ctx.fillText(tip, s.w / 2 - (s.w < 500 ? 70 : 140), s.h * 0.22);
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#f97316";
        ctx.font = `700 ${Math.round(32 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText("OUT OF CHAKRA!", s.w / 2 - 110 * hs, s.h / 2);
        ctx.fillText("OUT OF CHAKRA!", s.w / 2 - 110 * hs, s.h / 2);
        ctx.fillStyle = "#fff7ed";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to try again", s.w / 2 - 52, s.h / 2 + 28);
      }

      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const toCanvas = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * state.current.w,
        y: ((e.clientY - r.top) / r.height) * state.current.h,
      };
    };

    const hitBtn = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
      p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        throwWeapon();
      }
      if (e.code === "KeyC") {
        e.preventDefault();
        activateClones();
      }
      if (e.code === "KeyV") {
        e.preventDefault();
        activateKyuubi();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const p = toCanvas(e);
      aim.current = p;
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const p = toCanvas(e);
      aim.current = p;
      if (hitBtn(p, btnClone())) return activateClones();
      if (hitBtn(p, btnKyuubi())) return activateKyuubi();
      throwWeapon();
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

  const modeHint =
    mode === "kyuubi"
      ? "Nine-Tails cloak active — bijuu bombs + knockback!"
      : mode === "clones"
        ? "Shadow clones active — triple shuriken volleys!"
        : "Throw shuriken. C / CLONE (50) · V / 9-TAIL (100) · Rasengan at 100.";

  return (
    <GameShell
      ready={ready}
      onEnter={onEnter}
      title="Rasengan Rush"
      tagline="Shuriken · Shadow Clone · Rasengan · Nine-Tails"
      mobileTagline="Tap throw · use CLONE / 9-TAIL buttons"
      strip="BELIEVE IT!"
      stripHint={
        mode === "kyuubi" ? "Nine-Tails!" : mode === "clones" ? "Multi Shadow Clone!" : chakra >= 100 ? "Special ready!" : `Chakra ${chakra}%`
      }
      loadingLabel="Gathering chakra… loading portfolio"
      readyLabel="Mission complete — open the scroll"
      accent="#ea580c"
      accent2="#0ea5e9"
      score={score}
      secondaryLabel="Chakra"
      secondaryValue={chakra}
      best={best}
      alive={alive}
      aliveHint={modeHint}
      deadHint="Got hit! Tap to train again."
      canvasRef={canvasRef}
      ariaLabel="Naruto Rasengan rush mini-game"
    />
  );
}
