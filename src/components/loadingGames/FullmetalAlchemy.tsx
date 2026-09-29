import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type AlchemyMode = "spike" | "spear" | "bind";

type Foe = {
  x: number;
  speed: number;
  baseSpeed: number;
  hp: number;
  maxHp: number;
  w: number;
  h: number;
  hitFlash: number;
  kind: "soldier" | "armor" | "chimera" | "homunculus";
  bindT: number;
  regenT: number;
};

type ArrayMark = {
  x: number;
  life: number;
  max: number;
  armed: boolean;
  mode: AlchemyMode;
  stone: boolean;
};

type Spike = {
  x: number;
  h: number;
  life: number;
  max: number;
  stone: boolean;
  mode: AlchemyMode;
};

type Spear = {
  x: number;
  y: number;
  vx: number;
  life: number;
  dmg: number;
  struck: Set<number>;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };

/**
 * Fullmetal Alchemist — multi-alchemy combat:
 * SPIKE (earth) · SPEAR (carbon) · BIND (seal)
 * Place arrays with tap; Space detonates early.
 * ALPH (50) summons Alphonse · STONE (100) Philosopher's Stone chain.
 */
export default function FullmetalAlchemy({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [exchange, setExchange] = useState(0);
  const [mode, setMode] = useState<AlchemyMode>("spike");

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    exchange: 0,
    mode: "spike" as AlchemyMode,
    cooldown: 0,
    clapT: 0,
    punchT: 0,
    spawnIn: 28,
    foes: [] as Foe[],
    arrays: [] as ArrayMark[],
    spikes: [] as Spike[],
    spears: [] as Spear[],
    parts: [] as Particle[],
    shake: 0,
    stoneT: 0,
    alT: 0,
    alX: 0,
    announce: "",
    announceT: 0,
    foeId: 1,
    ids: new WeakMap<Foe, number>(),
    combo: 0,
    comboT: 0,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_fma") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const edX = () => Math.max(42, state.current.w * 0.14);
    const ground = () => state.current.h * 0.72;
    const btnW = () => (state.current.w < 500 ? 40 : 48);
    const btnH = () => 34;
    const btnY = () => state.current.h - 48;
    const modeBtns = () => {
      const w = btnW();
      const y = btnY();
      const gap = 6;
      const start = 10;
      return {
        spike: { x: start, y, w, h: btnH(), id: "spike" as AlchemyMode, label: "SPIKE" },
        spear: { x: start + w + gap, y, w, h: btnH(), id: "spear" as AlchemyMode, label: "SPEAR" },
        bind: { x: start + (w + gap) * 2, y, w, h: btnH(), id: "bind" as AlchemyMode, label: "BIND" },
        alph: { x: state.current.w - w * 2 - gap - 10, y, w, h: btnH(), id: "alph" as const, label: "ALPH" },
        stone: { x: state.current.w - w - 10, y, w, h: btnH(), id: "stone" as const, label: "STONE" },
      };
    };

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
    };

    const foeKey = (f: Foe) => {
      let id = state.current.ids.get(f);
      if (!id) {
        id = state.current.foeId++;
        state.current.ids.set(f, id);
      }
      return id;
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
          max: 18,
          color,
          size,
        });
      }
    };

    const gainExchange = (amt: number) => {
      const s = state.current;
      if (s.stoneT > 0) return;
      s.exchange = Math.min(100, s.exchange + amt);
      setExchange(Math.round(s.exchange));
    };

    const scoreKill = (f: Foe, bonus = 0) => {
      const s = state.current;
      const base = f.kind === "homunculus" ? 55 : f.kind === "chimera" ? 40 : f.kind === "armor" ? 30 : 20;
      s.combo = s.comboT > 0 ? s.combo + 1 : 1;
      s.comboT = 90;
      const mult = 1 + Math.min(0.5, s.combo * 0.08);
      s.score += Math.round((base + bonus) * mult);
      setScore(s.score);
      gainExchange(f.kind === "homunculus" ? 22 : f.kind === "chimera" ? 16 : 12);
      burst(f.x, ground() - 18, "#7dd3fc", 14, 3);
    };

    const die = () => {
      const s = state.current;
      if (!s.alive) return;
      // Alphonse absorbs one lethal hit
      if (s.alT > 0) {
        s.alT = 0;
        s.announce = "ALPHONSE BLOCKED!";
        s.announceT = 40;
        s.shake = 8;
        burst(s.alX, ground() - 30, "#94a3b8", 16, 3);
        for (const f of s.foes) {
          if (f.x < edX() + 80) f.x += 55;
        }
        return;
      }
      s.alive = false;
      setAlive(false);
      s.shake = 14;
      burst(edX(), ground() - 24, "#ef4444", 22, 3);
      localStorage.setItem(
        "stackfolio_best_fma",
        String(Math.max(Number(localStorage.getItem("stackfolio_best_fma") || 0), s.score)),
      );
      setBest(Math.max(Number(localStorage.getItem("stackfolio_best_fma") || 0), s.score));
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.exchange = 0;
      s.mode = "spike";
      s.cooldown = 0;
      s.clapT = 0;
      s.punchT = 0;
      s.spawnIn = 24;
      s.foes = [];
      s.arrays = [];
      s.spikes = [];
      s.spears = [];
      s.parts = [];
      s.shake = 0;
      s.stoneT = 0;
      s.alT = 0;
      s.alX = 0;
      s.announce = "CLAP!";
      s.announceT = 45;
      s.foeId = 1;
      s.ids = new WeakMap();
      s.combo = 0;
      s.comboT = 0;
      setAlive(true);
      setScore(0);
      setExchange(0);
      setMode("spike");
    };

    const hurtFoe = (f: Foe, dmg: number, knock: number, bonus = 0) => {
      f.hp -= dmg;
      f.hitFlash = 10;
      f.x += knock;
      if (f.hp <= 0) scoreKill(f, bonus);
      else gainExchange(3);
    };

    const fireSpear = (x: number, stone: boolean) => {
      const s = state.current;
      const gY = ground();
      s.spears.push({
        x,
        y: gY - 28,
        vx: stone ? 11 : 8,
        life: 50,
        dmg: stone ? 4 : 2,
        struck: new Set(),
      });
      burst(x, gY - 28, "#cbd5e1", 8, 2);
    };

    const eruptSpike = (x: number, stone: boolean, mode: AlchemyMode) => {
      const s = state.current;
      const gY = ground();
      s.spikes.push({
        x,
        h: stone ? 95 : mode === "bind" ? 40 : 60,
        life: stone ? 22 : 16,
        max: stone ? 22 : 16,
        stone,
        mode,
      });
      burst(x, gY - 20, stone ? "#fbbf24" : mode === "bind" ? "#a78bfa" : "#38bdf8", stone ? 18 : 12, 3);
      s.shake = Math.max(s.shake, stone ? 10 : 4);

      const reach = stone ? 44 : mode === "bind" ? 32 : 28;
      for (const f of s.foes) {
        if (f.hp <= 0) continue;
        if (Math.abs(f.x - x) > reach + f.w / 2) continue;
        if (mode === "bind" && !stone) {
          f.bindT = Math.max(f.bindT, 90);
          hurtFoe(f, 1, 6, 5);
          burst(f.x, gY - 20, "#a78bfa", 10, 2);
        } else {
          hurtFoe(f, stone ? 4 : 2, stone ? 16 : 10, stone ? 15 : 0);
        }
      }
    };

    const detonateArray = (a: ArrayMark) => {
      if (!a.armed) return;
      a.armed = false;
      a.life = Math.min(a.life, 4);
      const stone = a.stone || state.current.stoneT > 0;
      if (a.mode === "spear") fireSpear(a.x, stone);
      else eruptSpike(a.x, stone, a.mode);
    };

    const detonateAll = () => {
      const s = state.current;
      s.clapT = 14;
      for (const a of s.arrays) {
        if (a.armed) detonateArray(a);
      }
    };

    const summonAlphonse = () => {
      const s = state.current;
      if (!s.alive) return;
      if (s.exchange < 50 || s.alT > 0) {
        if (s.exchange < 50) {
          s.announce = "NEED 50 EXCHANGE";
          s.announceT = 30;
        }
        return;
      }
      s.exchange -= 50;
      setExchange(Math.round(s.exchange));
      s.alT = 280;
      s.alX = edX() + 55;
      s.announce = "ALPHONSE!";
      s.announceT = 40;
      burst(s.alX, ground() - 30, "#94a3b8", 20, 3);
    };

    const tryStone = () => {
      const s = state.current;
      if (!s.alive) return;
      if (s.exchange < 100 || s.stoneT > 0) {
        if (s.exchange < 100) {
          s.announce = "NEED 100 EXCHANGE";
          s.announceT = 30;
        }
        return;
      }
      s.stoneT = 180;
      s.exchange = 0;
      setExchange(0);
      s.announce = "PHILOSOPHER'S STONE!";
      s.announceT = 55;
      s.shake = 12;
      s.clapT = 16;
      const step = Math.max(48, s.w / 8);
      for (let x = edX() + 36; x < s.w - 16; x += step) {
        s.arrays.push({
          x,
          life: 10 + ((x - edX()) / step) * 3,
          max: 20,
          armed: true,
          mode: s.mode,
          stone: true,
        });
      }
      burst(edX(), ground() - 30, "#fbbf24", 28, 4);
    };

    const automailPunch = () => {
      const s = state.current;
      if (s.punchT > 0) return;
      s.punchT = 16;
      s.clapT = 10;
      const gY = ground();
      const reach = 52;
      let hit = false;
      for (const f of s.foes) {
        if (f.x - edX() < reach + f.w / 2 && f.x > edX()) {
          hurtFoe(f, 2, 28, 8);
          hit = true;
        }
      }
      burst(edX() + 30, gY - 20, hit ? "#e2e8f0" : "#64748b", hit ? 14 : 6, 2);
      s.shake = hit ? 7 : 3;
    };

    /** Place array at x, or automail punch if tapping near Edward. */
    const clap = (x: number) => {
      const s = state.current;
      if (!s.alive) return reset();

      // Close-range automail
      if (x < edX() + 40) {
        automailPunch();
        return;
      }
      if (s.cooldown > 0 && s.stoneT <= 0) return;

      const clamped = Math.max(edX() + 28, Math.min(s.w - 18, x));
      // Max 3 armed arrays at once (resource management)
      const armed = s.arrays.filter((a) => a.armed).length;
      if (armed >= 3 && s.stoneT <= 0) {
        s.announce = "MAX 3 ARRAYS — CLAP!";
        s.announceT = 28;
        detonateAll();
        return;
      }

      s.clapT = 12;
      s.cooldown = s.stoneT > 0 ? 5 : 10;
      const charge = s.mode === "spear" ? 18 : s.mode === "bind" ? 16 : 14;
      s.arrays.push({
        x: clamped,
        life: s.stoneT > 0 ? 8 : charge,
        max: s.stoneT > 0 ? 8 : charge,
        armed: true,
        mode: s.mode,
        stone: s.stoneT > 0,
      });
      burst(clamped, ground(), s.mode === "bind" ? "#a78bfa" : "#38bdf8", 8, 2);
    };

    const hitInBtn = (px: number, py: number, b: { x: number; y: number; w: number; h: number }) =>
      px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;

    const drawArray = (x: number, y: number, r: number, a: number, mode: AlchemyMode, stone: boolean) => {
      ctx.save();
      ctx.globalAlpha = a;
      const col = stone ? "#fbbf24" : mode === "bind" ? "#a78bfa" : mode === "spear" ? "#e2e8f0" : "#38bdf8";
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      if (mode === "spike" || stone) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const px = x + Math.cos(ang) * r * 0.85;
          const py = y + Math.sin(ang) * r * 0.85;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (mode === "spear") {
        ctx.beginPath();
        ctx.moveTo(x - r * 0.7, y);
        ctx.lineTo(x + r * 0.7, y);
        ctx.moveTo(x + r * 0.35, y - r * 0.35);
        ctx.lineTo(x + r * 0.7, y);
        ctx.lineTo(x + r * 0.35, y + r * 0.35);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.7);
        ctx.lineTo(x - r * 0.6, y + r * 0.4);
        ctx.lineTo(x + r * 0.6, y + r * 0.4);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawEdward = (x: number, y: number) => {
      const s = state.current;
      const bob = Math.sin(s.frame / 8) * 1.2;
      const py = y + bob;
      const clapping = s.clapT > 0 || s.punchT > 0;

      ctx.fillStyle = "#b91c1c";
      ctx.strokeStyle = "#7f1d1d";
      ctx.lineWidth = 1.5;
      roundRect(ctx, x - 14, py - 6, 28, 26, 5);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 14, py + 16);
      ctx.lineTo(x - 18, py + 32);
      ctx.lineTo(x - 4, py + 20);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 14, py + 16);
      ctx.lineTo(x + 18, py + 32);
      ctx.lineTo(x + 4, py + 20);
      ctx.fill();

      ctx.fillStyle = "#1e293b";
      roundRect(ctx, x - 10, py + 16, 9, 16, 2);
      ctx.fill();
      roundRect(ctx, x + 1, py + 16, 9, 16, 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      roundRect(ctx, x - 11, py + 28, 10, 7, 2);
      ctx.fill();
      roundRect(ctx, x + 1, py + 28, 10, 7, 2);
      ctx.fill();

      ctx.fillStyle = "#f5c89a";
      if (clapping) {
        roundRect(ctx, x + 6, py - 4, 16, 9, 3);
        ctx.fill();
      } else {
        roundRect(ctx, x + 12, py - 2, 9, 14, 3);
        ctx.fill();
      }

      const autoGrad = ctx.createLinearGradient(x - 28, py, x - 8, py);
      autoGrad.addColorStop(0, "#94a3b8");
      autoGrad.addColorStop(0.5, "#e2e8f0");
      autoGrad.addColorStop(1, "#64748b");
      ctx.fillStyle = autoGrad;
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.2;
      if (s.punchT > 0) {
        roundRect(ctx, x + 8, py - 6, 26, 11, 3);
        ctx.fill();
        ctx.stroke();
      } else if (clapping) {
        roundRect(ctx, x - 22, py - 4, 16, 9, 3);
        ctx.fill();
        ctx.stroke();
      } else {
        roundRect(ctx, x - 22, py - 2, 10, 15, 3);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#475569";
      ctx.fillRect(x - 20, py + 2, 8, 2);

      ctx.fillStyle = "#f5c89a";
      ctx.beginPath();
      ctx.ellipse(x, py - 18, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(x - 11, py - 18);
      ctx.quadraticCurveTo(x - 14, py - 36, x - 2, py - 28);
      ctx.quadraticCurveTo(x, py - 40, x + 4, py - 26);
      ctx.quadraticCurveTo(x + 14, py - 38, x + 11, py - 16);
      ctx.lineTo(x - 11, py - 18);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.ellipse(x - 3.5, py - 18, 1.6, 2, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 3.5, py - 18, 1.6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 8, py - 14);
      ctx.quadraticCurveTo(x + 16, py - 2, x + 10, py + 10);
      ctx.stroke();

      if (clapping) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(56,189,248,0.65)";
        ctx.beginPath();
        ctx.arc(x + (s.punchT > 0 ? 20 : 0), py, 8 + (14 - Math.max(s.clapT, s.punchT)), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (s.stoneT > 0) {
        ctx.strokeStyle = `rgba(251,191,36,${0.4 + (s.frame % 20) / 40})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, py, 34, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const drawAlphonse = (x: number, y: number) => {
      const bob = Math.sin(state.current.frame / 10) * 1.5;
      const py = y + bob;
      ctx.fillStyle = "#94a3b8";
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      roundRect(ctx, x - 16, py - 8, 32, 36, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#64748b";
      roundRect(ctx, x - 14, py - 22, 28, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x - 8, py - 14, 6, 5);
      ctx.fillRect(x + 2, py - 14, 6, 5);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(x - 6, py + 4, 12, 8);
      // Glow
      ctx.strokeStyle = "rgba(148,163,184,0.5)";
      ctx.beginPath();
      ctx.arc(x, py, 28, 0, Math.PI * 2);
      ctx.stroke();
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      if (s.cooldown > 0) s.cooldown--;
      if (s.clapT > 0) s.clapT--;
      if (s.punchT > 0) s.punchT--;
      if (s.announceT > 0) s.announceT--;
      if (s.comboT > 0) {
        s.comboT--;
        if (s.comboT === 0) s.combo = 0;
      }
      if (s.alT > 0) s.alT--;
      if (s.stoneT > 0) {
        s.stoneT--;
        if (s.stoneT === 0) {
          s.announce = "STONE FADED";
          s.announceT = 30;
        }
      }
      s.shake *= 0.86;
      const gY = ground();
      const hero = edX();
      if (s.alT > 0) s.alX = hero + 52;

      for (const a of s.arrays) {
        a.life--;
        if (a.life === Math.floor(a.max * 0.3) && a.armed) detonateArray(a);
      }
      s.arrays = s.arrays.filter((a) => a.life > 0);

      for (const sp of s.spikes) sp.life--;
      s.spikes = s.spikes.filter((sp) => sp.life > 0);

      for (const sp of s.spears) {
        sp.x += sp.vx;
        sp.life--;
        for (const f of s.foes) {
          if (f.hp <= 0) continue;
          const id = foeKey(f);
          if (sp.struck.has(id)) continue;
          if (Math.abs(f.x - sp.x) < f.w / 2 + 8 && Math.abs(gY - 28 - sp.y) < f.h) {
            sp.struck.add(id);
            hurtFoe(f, sp.dmg, 14, 6);
          }
        }
      }
      s.spears = s.spears.filter((sp) => sp.life > 0 && sp.x < s.w + 40);

      if (s.alive) {
        if (--s.spawnIn <= 0) {
          const roll = Math.random();
          let kind: Foe["kind"] = "soldier";
          if (roll > 0.92 && s.score > 80) kind = "homunculus";
          else if (roll > 0.72) kind = "chimera";
          else if (roll > 0.45) kind = "armor";
          const hp = kind === "homunculus" ? 5 : kind === "chimera" ? 3 : kind === "armor" ? 2 : 1;
          const speed = kind === "chimera" ? 1.75 : kind === "homunculus" ? 1.2 : kind === "armor" ? 1.0 : 1.3 + Math.min(0.85, s.score * 0.0014);
          s.foes.push({
            x: s.w + 24,
            speed,
            baseSpeed: speed,
            hp,
            maxHp: hp,
            w: kind === "chimera" ? 28 : kind === "homunculus" ? 26 : kind === "armor" ? 26 : 20,
            h: kind === "homunculus" ? 42 : kind === "armor" ? 44 : kind === "chimera" ? 36 : 38,
            hitFlash: 0,
            kind,
            bindT: 0,
            regenT: 0,
          });
          // Occasional double rush
          if (s.score > 140 && Math.random() < 0.22) {
            s.foes.push({
              x: s.w + 60,
              speed: 1.4,
              baseSpeed: 1.4,
              hp: 1,
              maxHp: 1,
              w: 20,
              h: 38,
              hitFlash: 0,
              kind: "soldier",
              bindT: 0,
              regenT: 0,
            });
          }
          s.spawnIn = Math.max(18, 46 - Math.min(18, s.score / 55));
        }

        for (const f of s.foes) {
          if (f.bindT > 0) {
            f.bindT--;
            f.speed = f.baseSpeed * 0.15;
          } else {
            f.speed = f.baseSpeed;
          }
          f.x -= f.speed * (s.stoneT > 0 ? 0.7 : 1);
          if (f.hitFlash > 0) f.hitFlash--;

          // Homunculus regen unless bound
          if (f.kind === "homunculus" && f.bindT <= 0 && f.hp > 0 && f.hp < f.maxHp) {
            f.regenT++;
            if (f.regenT > 40) {
              f.hp = Math.min(f.maxHp, f.hp + 1);
              f.regenT = 0;
              burst(f.x, gY - 24, "#f87171", 6, 2);
            }
          }

          // Alphonse collision — knock back
          if (s.alT > 0 && Math.abs(f.x - s.alX) < 28) {
            f.x += 40;
            f.hp -= 1;
            f.hitFlash = 8;
            if (f.hp <= 0) scoreKill(f, 10);
          }
        }
        s.foes = s.foes.filter((f) => f.hp > 0 && f.x > -40);

        for (const f of s.foes) {
          if (f.x - f.w / 2 < hero + 14) {
            die();
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
      if (s.stoneT > 0) {
        sky.addColorStop(0, "#1c1917");
        sky.addColorStop(1, "#78350f");
      } else {
        sky.addColorStop(0, "#0f172a");
        sky.addColorStop(1, "#1e3a5f");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      ctx.fillStyle = "#44403c";
      ctx.fillRect(0, gY, s.w, s.h - gY);
      ctx.fillStyle = s.stoneT > 0 ? "#fbbf24" : "#38bdf8";
      ctx.fillRect(0, gY, s.w, 3);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = "rgba(68,64,60,0.45)";
        ctx.fillRect(40 + i * (s.w / 5), gY - 36 - (i % 3) * 10, 16, 36 + (i % 3) * 10);
      }

      for (const a of s.arrays) {
        const pulse = 0.55 + 0.45 * Math.sin(s.frame / 3);
        drawArray(a.x, gY, 15 + (1 - a.life / a.max) * 12, (a.life / a.max) * pulse + 0.3, a.mode, a.stone);
      }

      for (const sp of s.spikes) {
        const grow = 1 - sp.life / sp.max;
        const hh = sp.h * Math.min(1, grow * 2.2);
        ctx.fillStyle = sp.stone ? "#f59e0b" : sp.mode === "bind" ? "#7c3aed" : "#78716c";
        ctx.strokeStyle = sp.stone ? "#fde68a" : sp.mode === "bind" ? "#c4b5fd" : "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sp.x - 10, gY);
        ctx.lineTo(sp.x, gY - hh);
        ctx.lineTo(sp.x + 10, gY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (sp.mode === "bind") {
          ctx.strokeStyle = "rgba(167,139,250,0.6)";
          ctx.beginPath();
          ctx.arc(sp.x, gY - hh * 0.4, 16, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      for (const sp of s.spears) {
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.shadowColor = "#94a3b8";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(sp.x - 18, sp.y);
        ctx.lineTo(sp.x + 10, sp.y);
        ctx.stroke();
        ctx.fillStyle = "#cbd5e1";
        ctx.beginPath();
        ctx.moveTo(sp.x + 10, sp.y);
        ctx.lineTo(sp.x + 2, sp.y - 5);
        ctx.lineTo(sp.x + 2, sp.y + 5);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      for (const f of s.foes) {
        const fy = gY - f.h;
        if (f.bindT > 0) {
          ctx.strokeStyle = "rgba(167,139,250,0.7)";
          ctx.lineWidth = 2;
          ctx.strokeRect(f.x - f.w / 2 - 4, fy - 4, f.w + 8, f.h + 8);
        }
        if (f.kind === "homunculus") {
          ctx.fillStyle = f.hitFlash > 0 ? "#fecaca" : "#450a0a";
          roundRect(ctx, f.x - f.w / 2, fy + 6, f.w, f.h - 6, 4);
          ctx.fill();
          ctx.fillStyle = "#7f1d1d";
          ctx.beginPath();
          ctx.ellipse(f.x, fy + 4, 9, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f87171";
          ctx.font = "700 9px Bangers, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("ouroboros", f.x, fy - 4);
          ctx.textAlign = "left";
        } else if (f.kind === "armor") {
          ctx.fillStyle = f.hitFlash > 0 ? "#fecaca" : "#94a3b8";
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 2;
          roundRect(ctx, f.x - f.w / 2, fy + 8, f.w, f.h - 8, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#64748b";
          roundRect(ctx, f.x - 10, fy, 20, 14, 3);
          ctx.fill();
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(f.x - 6, fy + 4, 5, 4);
          ctx.fillRect(f.x + 1, fy + 4, 5, 4);
        } else if (f.kind === "chimera") {
          ctx.fillStyle = f.hitFlash > 0 ? "#fecaca" : "#57534e";
          roundRect(ctx, f.x - f.w / 2, fy + 10, f.w, f.h - 10, 6);
          ctx.fill();
          ctx.fillStyle = "#a8a29e";
          ctx.beginPath();
          ctx.ellipse(f.x - 8, fy + 8, 8, 6, -0.3, 0, Math.PI * 2);
          ctx.ellipse(f.x + 8, fy + 8, 8, 6, 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f5c89a";
          ctx.beginPath();
          ctx.ellipse(f.x, fy + 6, 7, 7, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = f.hitFlash > 0 ? "#fecaca" : "#334155";
          roundRect(ctx, f.x - f.w / 2, fy + 8, f.w, f.h * 0.7, 3);
          ctx.fill();
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(f.x - f.w / 2, fy + 8, f.w, 6);
          ctx.fillStyle = "#f5c89a";
          ctx.beginPath();
          ctx.ellipse(f.x, fy + 4, 6, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const p of s.parts) {
        ctx.globalAlpha = p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (s.alT > 0) drawAlphonse(s.alX, gY - 8);
      drawEdward(hero, gY - 4);

      // HUD meter
      const meterW = Math.min(s.w - 40, 240);
      const meterX = (s.w - meterW) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, meterX, 10, meterW, 11, 5);
      ctx.fill();
      ctx.fillStyle = s.stoneT > 0 ? "#fbbf24" : "#38bdf8";
      roundRect(ctx, meterX, 10, ((s.stoneT > 0 ? 100 : s.exchange) / 100) * meterW, 11, 5);
      ctx.fill();
      // Alphonse threshold mark at 50
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(meterX + meterW * 0.5 - 1, 8, 2, 15);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      roundRect(ctx, meterX, 10, meterW, 11, 5);
      ctx.stroke();

      // Mode / special buttons
      const btns = modeBtns();
      const drawBtn = (b: { x: number; y: number; w: number; h: number; label: string }, active: boolean, readyBtn: boolean, color: string) => {
        ctx.fillStyle = active ? color : readyBtn ? "rgba(15,23,42,0.85)" : "rgba(15,23,42,0.45)";
        ctx.strokeStyle = active || readyBtn ? "#fff" : "#64748b";
        ctx.lineWidth = 2;
        roundRect(ctx, b.x, b.y, b.w, b.h, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = readyBtn || active ? "#fff" : "#94a3b8";
        ctx.font = `700 ${state.current.w < 500 ? 9 : 10}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 3);
        ctx.textAlign = "left";
      };
      drawBtn(btns.spike, s.mode === "spike", true, "#0369a1");
      drawBtn(btns.spear, s.mode === "spear", true, "#475569");
      drawBtn(btns.bind, s.mode === "bind", true, "#6d28d9");
      drawBtn(btns.alph, s.alT > 0, s.exchange >= 50, "#64748b");
      drawBtn(btns.stone, s.stoneT > 0, s.exchange >= 100, "#b45309");

      const hs = hudScale(s.w);
      ctx.fillStyle = "#7dd3fc";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(17 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`XP ${s.score}`, 12, 36);
      ctx.fillText(`XP ${s.score}`, 12, 36);
      if (s.combo > 1) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = `700 ${Math.round(13 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText(`x${s.combo} COMBO`, 12, 54);
        ctx.fillText(`x${s.combo} COMBO`, 12, 54);
      }
      ctx.fillStyle = s.stoneT > 0 ? "#fbbf24" : "#bae6fd";
      ctx.font = `700 ${Math.round(11 * hs)}px Bangers, Impact, sans-serif`;
      ctx.textAlign = "right";
      const label = s.stoneT > 0 ? `STONE ${Math.ceil(s.stoneT / 60)}s` : `EX ${Math.round(s.exchange)}% · ${s.mode.toUpperCase()}`;
      ctx.strokeText(label, s.w - 12, 36);
      ctx.fillText(label, s.w - 12, 36);
      ctx.textAlign = "left";

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, s.h * 0.22, s.w, 38);
        ctx.fillStyle = s.announce.includes("STONE") ? "#fbbf24" : s.announce.includes("ALPH") ? "#94a3b8" : "#38bdf8";
        ctx.font = `700 ${Math.round(18 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText(s.announce, s.w / 2, s.h * 0.22 + 26);
        ctx.fillText(s.announce, s.w / 2, s.h * 0.22 + 26);
        ctx.textAlign = "left";
      }

      if (s.alive && s.frame < 120 && s.announceT <= 0) {
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = `700 ${Math.round(12 * hs)}px Comic Neue, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(
          s.w < 500 ? "Tap=array · Space=clap · modes below" : "Tap place array · Space detonates · SPIKE/SPEAR/BIND · ALPH/STONE",
          s.w / 2,
          s.h * 0.18,
        );
        ctx.textAlign = "left";
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#38bdf8";
        ctx.font = `700 ${Math.round(26 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText("EQUIVALENT… FAILED", s.w / 2, s.h / 2);
        ctx.fillText("EQUIVALENT… FAILED", s.w / 2, s.h / 2);
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to try again", s.w / 2, s.h / 2 + 28);
        ctx.textAlign = "left";
      }

      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Digit1") {
        state.current.mode = "spike";
        setMode("spike");
      }
      if (e.code === "Digit2") {
        state.current.mode = "spear";
        setMode("spear");
      }
      if (e.code === "Digit3") {
        state.current.mode = "bind";
        setMode("bind");
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        if (!state.current.alive) return reset();
        if (state.current.arrays.some((a) => a.armed)) detonateAll();
        else clap(edX() + 100);
      }
      if (e.code === "KeyD" || e.code === "ArrowRight") {
        e.preventDefault();
        if (e.repeat) return;
        clap(edX() + 100 + Math.random() * 50);
      }
      if (e.code === "KeyA" || e.code === "ArrowLeft") {
        e.preventDefault();
        if (e.repeat) return;
        automailPunch();
      }
      if (e.code === "KeyC") {
        e.preventDefault();
        if (!state.current.alive) return reset();
        summonAlphonse();
      }
      if (e.code === "KeyV") {
        e.preventDefault();
        if (!state.current.alive) return reset();
        tryStone();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      if (!state.current.alive) return reset();
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * state.current.w;
      const y = ((e.clientY - r.top) / r.height) * state.current.h;
      const btns = modeBtns();
      if (hitInBtn(x, y, btns.spike)) {
        state.current.mode = "spike";
        setMode("spike");
        return;
      }
      if (hitInBtn(x, y, btns.spear)) {
        state.current.mode = "spear";
        setMode("spear");
        return;
      }
      if (hitInBtn(x, y, btns.bind)) {
        state.current.mode = "bind";
        setMode("bind");
        return;
      }
      if (hitInBtn(x, y, btns.alph)) {
        summonAlphonse();
        return;
      }
      if (hitInBtn(x, y, btns.stone)) {
        tryStone();
        return;
      }
      clap(x);
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
      title="Equivalent Exchange"
      tagline="SPIKE · SPEAR · BIND arrays · Space claps · ALPH / Philosopher's Stone"
      mobileTagline="Tap arrays · modes · ALPH / STONE"
      strip="ALCHEMY!"
      stripHint={exchange >= 100 ? "Stone ready!" : exchange >= 50 ? `ALPH ready · ${mode}` : `${mode.toUpperCase()} · ${exchange}%`}
      loadingLabel="Transmuting dossier… loading portfolio"
      readyLabel="Gate open — enter the dossier"
      accent="#b91c1c"
      accent2="#38bdf8"
      score={score}
      secondaryLabel="Exchange"
      secondaryValue={exchange}
      best={best}
      alive={alive}
      aliveHint="SPIKE / SPEAR / BIND modes. Tap to place arrays (max 3). Space detonates. Tap near Ed for automail. ALPH (50) · STONE (100). Bind stops Homunculus regen."
      deadHint="Law of Equivalent Exchange… Tap to clap again."
      canvasRef={canvasRef}
      ariaLabel="Fullmetal Alchemist multi-alchemy mini-game"
    />
  );
}
