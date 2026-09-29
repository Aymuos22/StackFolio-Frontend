import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Foe = {
  x: number;
  y: number; // offset above ground (0 = ground, negative = leaping)
  side: 1 | -1;
  speed: number;
  hp: number;
  maxHp: number;
  w: number;
  h: number;
  hitFlash: number;
  kind: "thug" | "brute" | "leaper";
  leapT: number;
};

type SlashTrail = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  life: number;
  max: number;
  rage: boolean;
  struck: Set<number>;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };

/**
 * Wolverine — unique vs Batman punch-timing:
 * Swipe / drag to draw claw trails (Fruit-Ninja style snikt).
 * Healing factor regenerates HP; contact damages instead of one-hit death.
 * Rage → Berserker: bigger trails, faster heal, claw both sides.
 */
export default function WolverineClaws({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [hp, setHp] = useState(100);
  const [rage, setRage] = useState(0);

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    hp: 100,
    maxHp: 100,
    rage: 0,
    facing: 1 as 1 | -1,
    slashT: 0,
    spawnIn: 30,
    foes: [] as Foe[],
    trails: [] as SlashTrail[],
    parts: [] as Particle[],
    shake: 0,
    berserkT: 0,
    announce: "",
    announceT: 0,
    healFlash: 0,
    hurtFlash: 0,
    regenPause: 0,
    invuln: 0,
    drag: null as null | { x: number; y: number; lastX: number; lastY: number },
    foeId: 1,
    ids: new WeakMap<Foe, number>(),
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_wolverine") || 0));
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

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
    };

    const burst = (x: number, y: number, color: string, n = 12, size = 3) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 3.5;
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

    const foeKey = (f: Foe) => {
      let id = state.current.ids.get(f);
      if (!id) {
        id = state.current.foeId++;
        state.current.ids.set(f, id);
      }
      return id;
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.hp = 100;
      s.maxHp = 100;
      s.rage = 0;
      s.facing = 1;
      s.slashT = 0;
      s.spawnIn = 26;
      s.foes = [];
      s.trails = [];
      s.parts = [];
      s.shake = 0;
      s.berserkT = 0;
      s.announce = "SNIKT!";
      s.announceT = 50;
      s.healFlash = 0;
      s.hurtFlash = 0;
      s.regenPause = 0;
      s.invuln = 0;
      s.drag = null;
      s.foeId = 1;
      s.ids = new WeakMap();
      setAlive(true);
      setScore(0);
      setHp(100);
      setRage(0);
    };

    const tryBerserk = () => {
      const s = state.current;
      if (s.rage < 100 || s.berserkT > 0) return false;
      s.berserkT = 220;
      s.rage = 0;
      setRage(0);
      s.announce = "BERSERKER RAGE!";
      s.announceT = 55;
      s.healFlash = 24;
      s.hp = Math.min(s.maxHp, s.hp + 35);
      setHp(Math.round(s.hp));
      s.shake = 12;
      burst(cx(), ground() - 20, "#f97316", 28, 4);
      return true;
    };

    const hitTestTrail = (trail: SlashTrail) => {
      const s = state.current;
      const gY = ground();
      const thick = trail.rage ? 48 : 34;
      const dx = trail.x1 - trail.x0;
      const dy = trail.y1 - trail.y0;
      const len2 = dx * dx + dy * dy || 1;

      for (const f of s.foes) {
        if (f.hp <= 0) continue;
        const id = foeKey(f);
        if (trail.struck.has(id)) continue;
        const fx = f.x;
        const fy = gY - f.h / 2 + f.y;
        let t = ((fx - trail.x0) * dx + (fy - trail.y0) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = trail.x0 + t * dx;
        const py = trail.y0 + t * dy;
        const dist = Math.hypot(fx - px, fy - py);
        if (dist > thick + f.w / 2) continue;

        trail.struck.add(id);
        const dmg = trail.rage ? 4 : 2;
        f.hp -= dmg;
        f.hitFlash = 8;
        f.x += (fx > cx() ? 1 : -1) * (trail.rage ? 22 : 12);
        burst(fx, fy, "#f87171", 10, 2);

        if (f.hp <= 0) {
          const pts = f.kind === "brute" ? 45 : f.kind === "leaper" ? 35 : 22;
          s.score += trail.rage ? pts + 15 : pts;
          if (s.berserkT <= 0) {
            s.rage = Math.min(100, s.rage + (f.kind === "brute" ? 22 : 14));
            setRage(Math.round(s.rage));
          }
          setScore(s.score);
          burst(fx, fy, "#fb923c", 16, 3);
        } else if (s.berserkT <= 0) {
          s.rage = Math.min(100, s.rage + 5);
          setRage(Math.round(s.rage));
        }
      }
    };

    /** Draw a claw trail from (x0,y0) → (x1,y1). Hits foes near the segment. */
    const clawSlash = (x0: number, y0: number, x1: number, y1: number) => {
      const s = state.current;
      if (!s.alive) return;

      let ax = x0;
      let ay = y0;
      let bx = x1;
      let by = y1;
      let dx = bx - ax;
      let dy = by - ay;
      let len = Math.hypot(dx, dy);

      // Tiny tap → short directional snikt toward that side of Wolverine
      if (len < 12) {
        const dir: 1 | -1 = x1 < cx() ? -1 : 1;
        s.facing = dir;
        const gY = ground();
        const reach = s.berserkT > 0 ? 110 : 72;
        ax = cx();
        ay = gY - 28;
        bx = cx() + dir * reach;
        by = gY - 20 + (Math.random() * 10 - 5);
        dx = bx - ax;
        dy = by - ay;
        len = Math.hypot(dx, dy);
      }

      tryBerserk();
      const rage = s.berserkT > 0;
      s.facing = dx >= 0 ? 1 : -1;
      s.slashT = 14;
      s.trails.push({
        x0: ax,
        y0: ay,
        x1: bx,
        y1: by,
        life: rage ? 16 : 12,
        max: rage ? 16 : 12,
        rage,
        struck: new Set(),
      });
      burst(bx, by, rage ? "#fdba74" : "#e2e8f0", rage ? 14 : 8, 2);
      sniktBurst(bx, by, s.facing, rage);
      hitTestTrail(s.trails[s.trails.length - 1]!);

      // Dual-claw in berserk: mirror trail the other way
      if (rage) {
        const mx = cx() * 2 - ax;
        const mx1 = cx() * 2 - bx;
        s.trails.push({
          x0: mx,
          y0: ay,
          x1: mx1,
          y1: by,
          life: 14,
          max: 14,
          rage: true,
          struck: new Set(),
        });
        hitTestTrail(s.trails[s.trails.length - 1]!);
      }
    };

    const sniktBurst = (x: number, y: number, dir: 1 | -1, rage: boolean) => {
      for (let i = 0; i < (rage ? 16 : 10); i++) {
        state.current.parts.push({
          x,
          y: y + (Math.random() - 0.5) * 16,
          vx: dir * (2 + Math.random() * 5),
          vy: (Math.random() - 0.5) * 3,
          life: 14 + Math.random() * 8,
          max: 22,
          color: rage ? "#fdba74" : i % 2 ? "#e2e8f0" : "#94a3b8",
          size: 1.5 + Math.random() * 2.5,
        });
      }
    };

    const drawAdamantiumClaws = (
      baseX: number,
      baseY: number,
      dir: 1 | -1,
      length: number,
      rage: boolean,
      spread = 1,
      angle = 0,
    ) => {
      ctx.save();
      ctx.translate(baseX, baseY);
      ctx.rotate(angle);
      for (let i = -1; i <= 1; i++) {
        const oy = i * 6.2 * spread;
        const len = length - Math.abs(i) * 2;
        const tipX = dir * len;
        const blade = ctx.createLinearGradient(0, oy, tipX, oy);
        if (rage) {
          blade.addColorStop(0, "#9a3412");
          blade.addColorStop(0.25, "#fb923c");
          blade.addColorStop(0.6, "#fdba74");
          blade.addColorStop(1, "#fffbeb");
        } else {
          blade.addColorStop(0, "#334155");
          blade.addColorStop(0.3, "#94a3b8");
          blade.addColorStop(0.55, "#f1f5f9");
          blade.addColorStop(0.8, "#cbd5e1");
          blade.addColorStop(1, "#64748b");
        }
        ctx.fillStyle = blade;
        ctx.shadowColor = rage ? "#f97316" : "rgba(248,250,252,0.7)";
        ctx.shadowBlur = rage ? 10 : 5;
        ctx.beginPath();
        ctx.moveTo(dir * 2, oy - 2.8);
        ctx.lineTo(tipX, oy - 0.4);
        ctx.lineTo(tipX + dir * 2, oy);
        ctx.lineTo(tipX, oy + 0.4);
        ctx.lineTo(dir * 2, oy + 2.8);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dir * 4, oy - 1.6);
        ctx.lineTo(tipX * 0.75, oy - 0.6);
        ctx.stroke();
      }
      ctx.fillStyle = rage ? "#7c2d12" : "#1e3a8a";
      ctx.strokeStyle = rage ? "#fb923c" : "#93c5fd";
      ctx.lineWidth = 1.3;
      roundRect(ctx, -7, -11, 14, 22, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rage ? "#fdba74" : "#64748b";
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(dir * 3, i * 5.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawWolverine = (x: number, y: number) => {
      const s = state.current;
      const bob = Math.sin(s.frame / 8) * 1.2;
      const py = y + bob;
      const face = s.facing;
      const slashing = s.slashT > 0;
      const raging = s.berserkT > 0;
      const lean = slashing ? face * 8 : Math.sin(s.frame / 20) * 1.5;
      const sc = 1.18;

      if (raging) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const aura = ctx.createRadialGradient(x, py, 4, x, py, 62);
        aura.addColorStop(0, "rgba(249,115,22,0.7)");
        aura.addColorStop(0.4, "rgba(220,38,38,0.35)");
        aura.addColorStop(1, "transparent");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.ellipse(x, py, 44, 56, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(x, y + 40, 26, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(x + lean, py);
      ctx.scale(sc, sc);

      // Boots
      ctx.fillStyle = "#0a0a0a";
      roundRect(ctx, -16, 32, 14, 10, 2);
      ctx.fill();
      roundRect(ctx, 2, 32, 14, 10, 2);
      ctx.fill();
      ctx.fillStyle = "#334155";
      ctx.fillRect(-16, 32, 14, 3);
      ctx.fillRect(2, 32, 14, 3);

      // Legs
      const legG = ctx.createLinearGradient(0, 12, 0, 34);
      legG.addColorStop(0, "#fde047");
      legG.addColorStop(1, "#ca8a04");
      ctx.fillStyle = legG;
      roundRect(ctx, -14, 14, 13, 20, 4);
      ctx.fill();
      roundRect(ctx, 1, 14, 13, 20, 4);
      ctx.fill();
      ctx.fillStyle = "#1e40af";
      ctx.fillRect(-14, 20, 13, 6);
      ctx.fillRect(1, 20, 13, 6);
      ctx.fillStyle = "#1e3a8a";
      roundRect(ctx, -13, 26, 11, 5, 2);
      ctx.fill();
      roundRect(ctx, 2, 26, 11, 5, 2);
      ctx.fill();

      // Torso V
      const torsoG = ctx.createLinearGradient(-16, -14, 16, 16);
      torsoG.addColorStop(0, "#fef08a");
      torsoG.addColorStop(0.45, "#eab308");
      torsoG.addColorStop(1, "#a16207");
      ctx.fillStyle = torsoG;
      ctx.strokeStyle = "#713f12";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-16, -8);
      ctx.quadraticCurveTo(-18, 4, -14, 14);
      ctx.lineTo(14, 14);
      ctx.quadraticCurveTo(18, 4, 16, -8);
      ctx.quadraticCurveTo(0, -14, -16, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(113,63,12,0.55)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-10, -2);
      ctx.quadraticCurveTo(-5, 2, 0, -1);
      ctx.quadraticCurveTo(5, 2, 10, -2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 10);
      ctx.moveTo(-7, 5);
      ctx.lineTo(7, 5);
      ctx.moveTo(-6, 9);
      ctx.lineTo(6, 9);
      ctx.stroke();

      // Blue shoulder yoke
      ctx.fillStyle = "#1d4ed8";
      ctx.strokeStyle = "#1e3a8a";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-17, -10);
      ctx.lineTo(-18, -2);
      ctx.lineTo(-6, -8);
      ctx.lineTo(0, -11);
      ctx.lineTo(6, -8);
      ctx.lineTo(18, -2);
      ctx.lineTo(17, -10);
      ctx.quadraticCurveTo(0, -16, -17, -10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.ellipse(-15, -6, 7, 5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(15, -6, 7, 5, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Belt + X
      ctx.fillStyle = "#0f172a";
      roundRect(ctx, -15, 12, 30, 7, 2);
      ctx.fill();
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 13);
      ctx.lineTo(6, 18);
      ctx.moveTo(6, 13);
      ctx.lineTo(-6, 18);
      ctx.stroke();
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.arc(0, 15.5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#713f12";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Arms
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#a16207";
      ctx.lineWidth = 1.3;
      if (slashing) {
        const lx = face > 0 ? 12 : -38;
        const tx = face > 0 ? -34 : 16;
        roundRect(ctx, lx, -16, 28, 13, 5);
        ctx.fill();
        ctx.stroke();
        roundRect(ctx, tx, -2, 20, 12, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#1d4ed8";
        ctx.fillRect(face > 0 ? lx + 20 : lx, -16, 8, 13);
        ctx.fillRect(face > 0 ? tx : tx + 12, -2, 8, 12);
        ctx.fillStyle = "#eab308";
        ctx.beginPath();
        ctx.ellipse(face > 0 ? lx + 8 : lx + 20, -10, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        roundRect(ctx, -28, -6, 13, 18, 5);
        ctx.fill();
        ctx.stroke();
        roundRect(ctx, 15, -6, 13, 18, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#1d4ed8";
        ctx.fillRect(-28, 8, 13, 5);
        ctx.fillRect(15, 8, 13, 5);
        ctx.fillStyle = "#eab308";
        ctx.beginPath();
        ctx.ellipse(-22, 0, 5, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(22, 0, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Claws
      if (slashing) {
        drawAdamantiumClaws(face * 38, -10, face, raging ? 36 : 30, raging, 1.2, face * -0.15);
        drawAdamantiumClaws(face * -30, 4, (-face) as 1 | -1, raging ? 24 : 18, raging, 0.95, face * 0.2);
      } else {
        drawAdamantiumClaws(-26, 12, -1, 16, raging, 0.9, 0.35);
        drawAdamantiumClaws(26, 12, 1, 16, raging, 0.9, -0.35);
      }

      // Head / classic cowl
      const hy = -28;
      ctx.fillStyle = "#eab308";
      roundRect(ctx, -5, hy + 10, 10, 8, 2);
      ctx.fill();

      const maskG = ctx.createLinearGradient(0, hy - 8, 0, hy + 14);
      maskG.addColorStop(0, "#fde047");
      maskG.addColorStop(1, "#ca8a04");
      ctx.fillStyle = maskG;
      ctx.strokeStyle = "#854d0e";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, hy + 2, 13, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const drawHorn = (side: 1 | -1) => {
        const tip = ctx.createLinearGradient(side * 8, hy - 4, side * 14, hy - 32);
        tip.addColorStop(0, "#eab308");
        tip.addColorStop(0.35, "#1e293b");
        tip.addColorStop(1, "#020617");
        ctx.fillStyle = tip;
        ctx.beginPath();
        ctx.moveTo(side * 6, hy - 2);
        ctx.quadraticCurveTo(side * 10, hy - 18, side * 13, hy - 30);
        ctx.quadraticCurveTo(side * 16, hy - 18, side * 11, hy - 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(250,204,21,0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(side * 8, hy - 4);
        ctx.quadraticCurveTo(side * 11, hy - 16, side * 12, hy - 26);
        ctx.stroke();
      };
      drawHorn(-1);
      drawHorn(1);

      // Black eye mask
      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.moveTo(-13, hy - 4);
      ctx.quadraticCurveTo(0, hy - 9, 13, hy - 4);
      ctx.lineTo(12, hy + 4);
      ctx.quadraticCurveTo(0, hy + 7, -12, hy + 4);
      ctx.closePath();
      ctx.fill();

      const eyeCol = raging ? "#fb923c" : "#ffffff";
      ctx.fillStyle = eyeCol;
      ctx.beginPath();
      ctx.moveTo(-8, hy);
      ctx.quadraticCurveTo(-5, hy - 4, -2, hy - 1);
      ctx.quadraticCurveTo(-5, hy + 3, -8, hy + 1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(8, hy);
      ctx.quadraticCurveTo(5, hy - 4, 2, hy - 1);
      ctx.quadraticCurveTo(5, hy + 3, 8, hy + 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = raging ? "#7c2d12" : "#0f172a";
      ctx.beginPath();
      ctx.ellipse(-5, hy, 1.2, 1.8, 0, 0, Math.PI * 2);
      ctx.ellipse(5, hy, 1.2, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.moveTo(-11, hy + 4);
      ctx.quadraticCurveTo(0, hy + 16, 11, hy + 4);
      ctx.quadraticCurveTo(0, hy + 8, -11, hy + 4);
      ctx.fill();

      ctx.strokeStyle = "#7c2d12";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-5, hy + 10);
      ctx.quadraticCurveTo(0, hy + 13, 5, hy + 10);
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.moveTo(-13, hy + 2);
      ctx.lineTo(-15, hy + 14);
      ctx.lineTo(-10, hy + 8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(13, hy + 2);
      ctx.lineTo(15, hy + 14);
      ctx.lineTo(10, hy + 8);
      ctx.fill();

      ctx.restore();

      if (s.healFlash > 0) {
        ctx.strokeStyle = `rgba(74,222,128,${s.healFlash / 24})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, py, 36 + (24 - s.healFlash), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(134,239,172,${s.healFlash / 28})`;
        for (let i = 0; i < 6; i++) {
          const a = (s.frame / 8 + i) * 1.1;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * 30, py + Math.sin(a) * 36, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (s.hurtFlash > 0) {
        ctx.fillStyle = `rgba(239,68,68,${s.hurtFlash / 32})`;
        ctx.beginPath();
        ctx.arc(x, py, 30, 0, Math.PI * 2);
        ctx.fill();
      }

      if (slashing && s.slashT > 6) {
        ctx.fillStyle = raging ? "#fb923c" : "#f8fafc";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.font = "700 16px Bangers, Impact, sans-serif";
        ctx.textAlign = "center";
        ctx.strokeText("SNIKT!", x + face * 48, py - 48);
        ctx.fillText("SNIKT!", x + face * 48, py - 48);
        ctx.textAlign = "left";
      }
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      if (s.slashT > 0) s.slashT--;
      if (s.announceT > 0) s.announceT--;
      if (s.healFlash > 0) s.healFlash--;
      if (s.hurtFlash > 0) s.hurtFlash--;
      if (s.regenPause > 0) s.regenPause--;
      if (s.invuln > 0) s.invuln--;
      if (s.berserkT > 0) {
        s.berserkT--;
        if (s.berserkT === 0) {
          s.announce = "RAGE FADED";
          s.announceT = 35;
        }
      }
      s.shake *= 0.86;
      const gY = ground();
      const mid = cx();

      // Healing factor — core unique mechanic
      if (s.alive && s.hp < s.maxHp && s.regenPause <= 0) {
        const rate = s.berserkT > 0 ? 0.55 : 0.22;
        s.hp = Math.min(s.maxHp, s.hp + rate);
        if (s.frame % 8 === 0) {
          setHp(Math.round(s.hp));
          if (rate > 0.3) s.healFlash = Math.max(s.healFlash, 6);
        }
      }

      for (const t of s.trails) {
        t.life--;
        hitTestTrail(t);
      }
      s.trails = s.trails.filter((t) => t.life > 0);

      if (s.alive) {
        if (--s.spawnIn <= 0) {
          const side: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
          const roll = Math.random();
          let kind: Foe["kind"] = "thug";
          if (roll > 0.78) kind = "brute";
          else if (roll > 0.55) kind = "leaper";
          const hpAmt = kind === "brute" ? 3 : 1;
          s.foes.push({
            x: side === 1 ? s.w + 24 : -24,
            y: 0,
            side,
            speed: kind === "brute" ? 0.95 : kind === "leaper" ? 1.45 : 1.15 + Math.min(1.0, s.score * 0.0018),
            hp: hpAmt,
            maxHp: hpAmt,
            w: kind === "brute" ? 30 : 20,
            h: kind === "brute" ? 48 : 38,
            hitFlash: 0,
            kind,
            leapT: kind === "leaper" ? 50 + Math.random() * 60 : 0,
          });
          // Dual rush later
          if (s.score > 150 && Math.random() < 0.22) {
            const other: 1 | -1 = side === 1 ? -1 : 1;
            s.foes.push({
              x: other === 1 ? s.w + 24 : -24,
              y: 0,
              side: other,
              speed: 1.2,
              hp: 2,
              maxHp: 2,
              w: 20,
              h: 38,
              hitFlash: 0,
              kind: "thug",
              leapT: 0,
            });
          }
          s.spawnIn = Math.max(22, 50 - Math.min(18, s.score / 70));
        }

        for (const f of s.foes) {
          f.x += -f.side * f.speed * (s.berserkT > 0 ? 0.8 : 1);
          if (f.hitFlash > 0) f.hitFlash--;
          if (f.kind === "leaper") {
            if (f.leapT > 0) f.leapT--;
            // Arc leap when closing in
            const dist = Math.abs(f.x - mid);
            if (dist < 160 && dist > 50 && f.leapT <= 0) {
              f.leapT = -36;
            }
            if (f.leapT < 0) {
              const t = -f.leapT;
              f.y = -Math.sin((t / 36) * Math.PI) * 55;
              f.leapT--;
              if (f.leapT < -36) {
                f.leapT = 80;
                f.y = 0;
              }
            }
          }
        }

        s.foes = s.foes.filter((f) => f.hp > 0 && f.x > -60 && f.x < s.w + 60);

        // Contact damage (not instant death) — healing factor is the survival loop
        for (const f of s.foes) {
          const fy = gY - f.h / 2 + f.y;
          const wolY = gY - 28;
          if (Math.abs(f.x - mid) < 18 + f.w / 4 && Math.abs(fy - wolY) < 32) {
            if (s.berserkT > 0) {
              f.x += f.side * 52;
              f.hp -= 2;
              f.hitFlash = 8;
              s.healFlash = 12;
              burst(mid, gY - 20, "#86efac", 10, 2);
              if (f.hp <= 0) {
                s.score += 30;
                setScore(s.score);
              }
              continue;
            }
            if (s.invuln > 0) {
              f.x += f.side * 28;
              continue;
            }
            const dmg = f.kind === "brute" ? 14 : f.kind === "leaper" ? 11 : 9;
            s.hp -= dmg;
            s.regenPause = 40;
            s.hurtFlash = 18;
            s.invuln = 36;
            s.shake = 8;
            f.x += f.side * 44;
            setHp(Math.max(0, Math.round(s.hp)));
            burst(mid, gY - 20, "#ef4444", 14, 3);
            if (s.berserkT <= 0) {
              s.rage = Math.min(100, s.rage + 12);
              setRage(Math.round(s.rage));
            }
            if (s.hp <= 0) {
              s.hp = 0;
              s.alive = false;
              setAlive(false);
              setHp(0);
              s.shake = 14;
              localStorage.setItem(
                "stackfolio_best_wolverine",
                String(Math.max(Number(localStorage.getItem("stackfolio_best_wolverine") || 0), s.score)),
              );
              setBest(Math.max(Number(localStorage.getItem("stackfolio_best_wolverine") || 0), s.score));
              break;
            }
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
      if (s.berserkT > 0) {
        sky.addColorStop(0, "#1a0505");
        sky.addColorStop(0.45, "#7f1d1d");
        sky.addColorStop(1, "#431407");
      } else {
        sky.addColorStop(0, "#0c0a09");
        sky.addColorStop(0.4, "#1c1917");
        sky.addColorStop(1, "#292524");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      // Far alley depth + neon spill
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, s.w * 0.18, gY);
      ctx.fillRect(s.w * 0.82, 0, s.w * 0.18, gY);
      const neon = ctx.createLinearGradient(0, 0, s.w, 0);
      neon.addColorStop(0, "rgba(234,179,8,0.08)");
      neon.addColorStop(0.5, "transparent");
      neon.addColorStop(1, "rgba(37,99,235,0.1)");
      ctx.fillStyle = neon;
      ctx.fillRect(0, 0, s.w, gY);

      // Brick walls
      for (let row = 0; row < gY; row += 16) {
        const off = (row / 16) % 2 === 0 ? 0 : 14;
        for (let bx = -14 + off; bx < s.w; bx += 28) {
          ctx.fillStyle = row % 32 === 0 ? "#1c1917" : "#292524";
          ctx.fillRect(bx, row, 26, 14);
          ctx.strokeStyle = "rgba(0,0,0,0.4)";
          ctx.strokeRect(bx, row, 26, 14);
        }
      }
      // Wet asphalt
      const road = ctx.createLinearGradient(0, gY, 0, s.h);
      road.addColorStop(0, "#1c1917");
      road.addColorStop(1, "#0c0a09");
      ctx.fillStyle = road;
      ctx.fillRect(0, gY, s.w, s.h - gY);
      ctx.fillStyle = s.berserkT > 0 ? "#f97316" : "#eab308";
      ctx.fillRect(0, gY, s.w, 2);
      // Puddle reflections
      ctx.fillStyle = "rgba(234,179,8,0.12)";
      ctx.beginPath();
      ctx.ellipse(s.w * 0.3, gY + 18, 40, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(59,130,246,0.1)";
      ctx.beginPath();
      ctx.ellipse(s.w * 0.7, gY + 22, 50, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rain streaks
      ctx.strokeStyle = "rgba(226,232,240,0.12)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 28; i++) {
        const rx = ((i * 97 + s.frame * 3) % (s.w + 40)) - 20;
        const ry = ((i * 53 + s.frame * 8) % (gY + 20));
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + 10);
        ctx.stroke();
      }

      // Live drag preview
      if (s.drag) {
        ctx.strokeStyle = "rgba(226,232,240,0.55)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(s.drag.x, s.drag.y);
        ctx.lineTo(s.drag.lastX, s.drag.lastY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Claw trails — metallic triple blades
      for (const t of s.trails) {
        const a = t.life / t.max;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a;
        const nx = -(t.y1 - t.y0);
        const ny = t.x1 - t.x0;
        const nl = Math.hypot(nx, ny) || 1;
        const ox = (nx / nl) * 6;
        const oy = (ny / nl) * 6;
        for (let k = -1; k <= 1; k++) {
          ctx.strokeStyle = t.rage ? "#fdba74" : k === 0 ? "#f8fafc" : "#cbd5e1";
          ctx.lineWidth = t.rage ? (k === 0 ? 5 : 2.5) : k === 0 ? 3.5 : 2;
          ctx.shadowColor = t.rage ? "#f97316" : "#e2e8f0";
          ctx.shadowBlur = t.rage ? 14 : 8;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(t.x0 + ox * k, t.y0 + oy * k);
          ctx.lineTo(t.x1 + ox * k, t.y1 + oy * k);
          ctx.stroke();
        }
        ctx.restore();
      }

      for (const f of s.foes) {
        const fy = gY - f.h + f.y;
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(f.x, gY + 3, f.w * 0.55, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        const flash = f.hitFlash > 0;
        if (f.kind === "brute") {
          ctx.fillStyle = flash ? "#fecaca" : "#44403c";
          roundRect(ctx, f.x - f.w / 2, fy + 10, f.w, f.h - 10, 4);
          ctx.fill();
          ctx.fillStyle = "#1c1917";
          roundRect(ctx, f.x - 12, fy, 24, 16, 3);
          ctx.fill();
          ctx.fillStyle = "#57534e";
          ctx.fillRect(f.x - f.w / 2, fy + 18, f.w, 8);
          ctx.fillStyle = "#f5c89a";
          ctx.beginPath();
          ctx.ellipse(f.x, fy + 8, 8, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(f.x - 7, fy + 6, 14, 3);
        } else if (f.kind === "leaper") {
          ctx.fillStyle = flash ? "#fecaca" : "#57534e";
          roundRect(ctx, f.x - f.w / 2, fy + 8, f.w, f.h - 8, 5);
          ctx.fill();
          ctx.fillStyle = "#292524";
          ctx.fillRect(f.x - f.w / 2, fy + 8, f.w, 6);
          ctx.fillStyle = "#f5c89a";
          ctx.beginPath();
          ctx.ellipse(f.x, fy + 5, 7, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          if (f.y < -5) {
            ctx.fillStyle = "rgba(234,179,8,0.3)";
            ctx.beginPath();
            ctx.ellipse(f.x, gY + 4, 16, 4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = flash ? "#fecaca" : "#3f3f46";
          roundRect(ctx, f.x - f.w / 2, fy + 8, f.w, f.h * 0.72, 3);
          ctx.fill();
          ctx.fillStyle = "#18181b";
          ctx.fillRect(f.x - f.w / 2, fy + 8, f.w, 5);
          ctx.fillStyle = "#f5c89a";
          ctx.beginPath();
          ctx.ellipse(f.x, fy + 4, 6.5, 6.5, 0, 0, Math.PI * 2);
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

      if (s.invuln > 0 && s.frame % 4 < 2) ctx.globalAlpha = 0.55;
      drawWolverine(mid, gY - 4);
      ctx.globalAlpha = 1;

      // HP (healing factor) + Rage meters
      const meterW = Math.min(s.w - 40, 240);
      const meterX = (s.w - meterW) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, meterX, 10, meterW, 10, 5);
      ctx.fill();
      ctx.fillStyle = s.hp < 30 ? "#ef4444" : "#4ade80";
      roundRect(ctx, meterX, 10, (s.hp / s.maxHp) * meterW, 10, 5);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      roundRect(ctx, meterX, 10, meterW, 10, 5);
      ctx.stroke();

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, meterX, 24, meterW, 8, 4);
      ctx.fill();
      ctx.fillStyle = s.berserkT > 0 ? "#f97316" : "#eab308";
      roundRect(ctx, meterX, 24, ((s.berserkT > 0 ? 100 : s.rage) / 100) * meterW, 8, 4);
      ctx.fill();

      const hs = hudScale(s.w);
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(18 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`XP ${s.score}`, 12, s.h - 36);
      ctx.fillText(`XP ${s.score}`, 12, s.h - 36);
      ctx.fillStyle = "#86efac";
      ctx.font = `700 ${Math.round(12 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`HEAL ${Math.round(s.hp)}`, 12, s.h - 16);
      ctx.fillText(`HEAL ${Math.round(s.hp)}`, 12, s.h - 16);
      ctx.fillStyle = s.berserkT > 0 ? "#fb923c" : "#fde047";
      const label = s.berserkT > 0 ? `BERSERK ${Math.ceil(s.berserkT / 60)}s` : `RAGE ${Math.round(s.rage)}%`;
      ctx.textAlign = "right";
      ctx.strokeText(label, s.w - 12, s.h - 16);
      ctx.fillText(label, s.w - 12, s.h - 16);
      ctx.textAlign = "left";

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, s.h * 0.26, s.w, 40);
        ctx.fillStyle = "#f97316";
        ctx.font = `700 ${Math.round(22 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText(s.announce, s.w / 2, s.h * 0.26 + 28);
        ctx.fillText(s.announce, s.w / 2, s.h * 0.26 + 28);
        ctx.textAlign = "left";
      }

      if (s.alive && s.frame < 110 && s.announceT <= 0) {
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = `700 ${Math.round(13 * hs)}px Comic Neue, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(
          s.w < 500 ? "Swipe to claw! HP regenerates" : "Swipe across foes to snikt · healing factor regenerates HP",
          s.w / 2,
          s.h * 0.2,
        );
        ctx.textAlign = "left";
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#f97316";
        ctx.font = `700 ${Math.round(30 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText("BUB!", s.w / 2, s.h / 2);
        ctx.fillText("BUB!", s.w / 2, s.h / 2);
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to try again", s.w / 2, s.h / 2 + 28);
        ctx.textAlign = "left";
      }

      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const pointerPos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * state.current.w,
        y: ((e.clientY - r.top) / r.height) * state.current.h,
      };
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        if (!state.current.alive) return reset();
        const gY = ground();
        clawSlash(cx(), gY - 28, cx() - (state.current.berserkT > 0 ? 120 : 75), gY - 22);
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        if (!state.current.alive) return reset();
        const gY = ground();
        clawSlash(cx(), gY - 28, cx() + (state.current.berserkT > 0 ? 120 : 75), gY - 22);
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!state.current.alive) return reset();
        if (e.repeat) return;
        // Space = full-alley adamantium rake
        const gY = ground();
        clawSlash(8, gY - 34, state.current.w - 8, gY - 16);
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      if (!state.current.alive) return reset();
      const p = pointerPos(e);
      state.current.drag = { x: p.x, y: p.y, lastX: p.x, lastY: p.y };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = state.current.drag;
      if (!d) return;
      const p = pointerPos(e);
      d.lastX = p.x;
      d.lastY = p.y;
      state.current.facing = p.x >= d.x ? 1 : -1;
      // Auto-cut long swipes mid-drag for fluid multi-slash
      const dist = Math.hypot(p.x - d.x, p.y - d.y);
      if (dist > 68) {
        clawSlash(d.x, d.y, p.x, p.y);
        state.current.drag = { x: p.x, y: p.y, lastX: p.x, lastY: p.y };
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const d = state.current.drag;
      if (!d) return;
      const p = pointerPos(e);
      clawSlash(d.x, d.y, p.x, p.y);
      state.current.drag = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      state.current.drag = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    resize();
    reset();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
    };
  }, []);

  return (
    <GameShell
      ready={ready}
      onEnter={onEnter}
      title="Adamantium Frenzy"
      tagline="Swipe to claw · healing factor regenerates HP · rage = berserk dual slash"
      mobileTagline="Swipe to snikt · HP regenerates"
      strip="SNIKT!"
      stripHint={rage >= 100 ? "Rage ready — swipe!" : `Heal ${hp} · Rage ${rage}%`}
      loadingLabel="Healing factor online… loading portfolio"
      readyLabel="Fight over — open the dossier"
      accent="#eab308"
      accent2="#1d4ed8"
      score={score}
      secondaryLabel="Heal"
      secondaryValue={hp}
      best={best}
      alive={alive}
      aliveHint="Swipe across enemies to claw them. Your HP regenerates — don't get swarmed. Fill rage for Berserker dual-claws."
      deadHint="Healing factor failed! Tap to snikt again."
      canvasRef={canvasRef}
      ariaLabel="Wolverine swipe claw mini-game with healing factor"
    />
  );
}
