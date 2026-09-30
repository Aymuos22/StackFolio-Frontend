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
  kind: 0 | 1 | 2; // goon / bruiser / armed
  stagger: number;
  walk: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  kind: "spark" | "smoke" | "star";
};

type Batarang = {
  x: number;
  y: number;
  vx: number;
  side: 1 | -1;
  life: number;
  spin: number;
};

type GelCharge = {
  x: number;
  y: number;
  side: 1 | -1;
  life: number;
  armed: number;
};

type Impact = { x: number; y: number; life: number; label: string; color: string };

type Move =
  | "jab"
  | "cross"
  | "sweep"
  | "uppercut"
  | "dive"
  | "cape"
  | "shadow"
  | "batarang"
  | "smoke"
  | "gel"
  | "beatdown";

const MOVE_DUR: Record<Move, number> = {
  jab: 11,
  cross: 13,
  sweep: 16,
  uppercut: 17,
  dive: 20,
  cape: 20,
  shadow: 18,
  batarang: 14,
  smoke: 22,
  gel: 16,
  beatdown: 26,
};

/**
 * Batman melee timing — punches, gadgets, and specialty finishers.
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
    move: "jab" as Move,
    thugs: [] as Thug[],
    parts: [] as Particle[],
    bats: [] as Batarang[],
    gels: [] as GelCharge[],
    impacts: [] as Impact[],
    id: 1,
    shake: 0,
    missFlash: 0,
    announce: "",
    announceT: 0,
    capeT: 0,
    smokeT: 0,
    shadowT: 0,
    shadowOff: 0,
    diveT: 0,
    beatT: 0,
    lastTapSide: 0 as 0 | 1 | -1,
    lastTapFrame: 0,
    chain: 0,
    flashWhite: 0,
    moveIdx: 0,
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

    const burst = (x: number, y: number, color: string, n = 12, kind: Particle["kind"] = "spark") => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.2 + Math.random() * (kind === "smoke" ? 2.2 : 5);
        state.current.parts.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (kind === "smoke" ? 1.2 : 0),
          life: kind === "smoke" ? 28 + Math.random() * 12 : 16 + Math.random() * 10,
          color,
          size: kind === "star" ? 4 + Math.random() * 3 : kind === "smoke" ? 6 + Math.random() * 8 : 2 + Math.random() * 2,
          kind,
        });
      }
    };

    const announce = (text: string, frames = 36) => {
      state.current.announce = text;
      state.current.announceT = frames;
    };

    const impact = (x: number, y: number, label: string, color: string) => {
      state.current.impacts.push({ x, y, life: 22, label, color });
    };

    const saveBest = () => {
      const s = state.current;
      const b = Math.max(Number(localStorage.getItem("stackfolio_best_batman") || 0), s.score);
      localStorage.setItem("stackfolio_best_batman", String(b));
      setBest(b);
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.combo = 0;
      s.spawnIn = 70;
      s.punchT = 0;
      s.move = "jab";
      s.thugs = [];
      s.parts = [];
      s.bats = [];
      s.gels = [];
      s.impacts = [];
      s.shake = 0;
      s.missFlash = 0;
      s.announce = "I AM THE NIGHT";
      s.announceT = 48;
      s.capeT = 0;
      s.smokeT = 0;
      s.shadowT = 0;
      s.shadowOff = 0;
      s.diveT = 0;
      s.beatT = 0;
      s.lastTapSide = 0;
      s.lastTapFrame = 0;
      s.chain = 0;
      s.flashWhite = 0;
      s.moveIdx = 0;
      setAlive(true);
      setScore(0);
      setCombo(0);
    };

    const killThug = (t: Thug, g: number, bonus = 0, label = "POW") => {
      const s = state.current;
      const mx = t.x + t.w / 2;
      const my = g - t.h * 0.45;
      t.hp = 0;
      t.hitFlash = 8;
      burst(mx, my, "#f5d76e", 14, "spark");
      burst(mx, my, "#e5e7eb", 10, "star");
      burst(mx, my + 8, "#64748b", 8, "smoke");
      impact(mx, my - 18, label, "#f5d76e");
      s.combo += 1;
      s.chain += 1;
      s.score += 80 + s.combo * 18 + t.kind * 35 + bonus;
      setCombo(s.combo);
      setScore(s.score);
      s.shake = Math.min(14, 4 + s.combo * 0.45);

      if (s.combo === 3) announce("COMBO x3!", 32);
      else if (s.combo === 5) announce("FEAR THE BAT!", 40);
      else if (s.combo === 8) announce("DARK KNIGHT!", 44);
      else if (s.combo === 12) announce("JUSTICE NEVER SLEEPS", 48);
      else if (s.combo >= 16 && s.combo % 4 === 0) announce(`JUSTICE x${s.combo}`, 36);
      else if (s.combo > 1 && s.combo % 5 === 0) announce("UNSTOPPABLE", 30);
    };

    const hitSide = (side: 1 | -1, reach: number, bonus: number, label: string, all = false) => {
      const s = state.current;
      const center = cx();
      const g = ground();
      let hitAny = false;
      const targets = [...s.thugs].sort(
        (a, b) => Math.abs(a.x + a.w / 2 - center) - Math.abs(b.x + b.w / 2 - center),
      );
      for (const t of targets) {
        const mid = t.x + t.w / 2;
        const onSide = side === 1 ? mid >= center - 8 : mid <= center + 8;
        const dist = Math.abs(mid - center);
        if (onSide && dist < reach) {
          killThug(t, g, bonus, label);
          hitAny = true;
          if (!all) break;
        }
      }
      s.thugs = s.thugs.filter((t) => t.hp > 0);
      return hitAny;
    };

    /** Combo ladder — each successful hit advances to a flashier move. */
    const COMBO_LADDER: Move[] = [
      "jab",
      "cross",
      "sweep",
      "uppercut",
      "dive",
      "cape",
      "shadow",
      "gel",
      "smoke",
      "beatdown",
      "batarang",
    ];

    const pickMove = (_side: 1 | -1, doubleTap: boolean, sideSwitch: boolean): Move => {
      const s = state.current;
      if (doubleTap) return "batarang";
      if (sideSwitch && s.combo >= 2) return "shadow";
      if (s.combo >= 10 && s.moveIdx % 7 === 6) return "beatdown";
      if (s.combo >= 7 && s.moveIdx % 5 === 4) return "smoke";
      const idx = Math.min(s.moveIdx, COMBO_LADDER.length - 1);
      return COMBO_LADDER[idx]!;
    };

    const throwBatarang = (side: 1 | -1) => {
      const s = state.current;
      const g = ground();
      s.bats.push({
        x: cx(),
        y: g - 42,
        vx: side * 12,
        side,
        life: 44,
        spin: 0,
      });
      // Twin returner at high combo
      if (s.combo >= 6) {
        s.bats.push({
          x: cx(),
          y: g - 52,
          vx: side * 9.5,
          side,
          life: 50,
          spin: Math.PI / 4,
        });
        announce("DUAL BATARANG!", 36);
      } else {
        announce("BATARANG!", 34);
      }
      burst(cx() + side * 20, g - 42, "#f5d76e", 8, "spark");
    };

    const plantGel = (side: 1 | -1) => {
      const s = state.current;
      const g = ground();
      const reach = zone() * 0.7;
      s.gels.push({
        x: cx() + side * reach,
        y: g - 8,
        side,
        life: 36,
        armed: 18,
      });
      announce("EXPLOSIVE GEL!", 34);
      burst(cx() + side * reach, g - 10, "#86efac", 10, "spark");
    };

    const miss = () => {
      const s = state.current;
      s.combo = Math.max(0, s.combo - 1);
      s.chain = 0;
      s.moveIdx = Math.max(0, s.moveIdx - 1);
      s.missFlash = 6;
      setCombo(s.combo);
      s.shake = 1;
      if (s.combo === 0) announce("MISSED…", 20);
    };

    const punch = (side: 1 | -1) => {
      const s = state.current;
      if (!s.alive) return reset();

      const doubleTap = s.lastTapSide === side && s.frame - s.lastTapFrame < 14;
      const sideSwitch =
        s.lastTapSide !== 0 && s.lastTapSide !== side && s.frame - s.lastTapFrame < 18;
      s.lastTapSide = side;
      s.lastTapFrame = s.frame;

      const move = pickMove(side, doubleTap, sideSwitch);
      s.move = move;
      s.punchSide = side;
      s.punchT = MOVE_DUR[move];

      const center = cx();
      const g = ground();

      if (move === "batarang") {
        throwBatarang(side);
        // Bonus melee if someone is right in face
        hitSide(side, zone() * 0.55, 30, "CLIP!");
        s.moveIdx = Math.min(s.moveIdx + 1, COMBO_LADDER.length - 1);
        return;
      }

      if (move === "gel") {
        plantGel(side);
        s.moveIdx = Math.min(s.moveIdx + 1, COMBO_LADDER.length - 1);
        return;
      }

      if (move === "cape") {
        s.capeT = 20;
        announce("CAPE STUN!", 30);
        const hit = hitSide(side, zone() + 52, 45, "WHAM", true);
        if (!hit) miss();
        else {
          s.flashWhite = 4;
          s.moveIdx = Math.min(s.moveIdx + 1, COMBO_LADDER.length - 1);
        }
        return;
      }

      if (move === "smoke") {
        s.smokeT = 28;
        announce("SMOKE BOMB!", 36);
        burst(center, g - 30, "#64748b", 28, "smoke");
        burst(center, g - 40, "#94a3b8", 16, "smoke");
        // Hits both sides in the strike zone
        let hit = hitSide(1, zone() + 20, 55, "CHOKE!", true);
        hit = hitSide(-1, zone() + 20, 55, "CHOKE!", true) || hit;
        if (!hit) miss();
        else {
          s.flashWhite = 5;
          s.moveIdx = Math.min(s.moveIdx + 1, COMBO_LADDER.length - 1);
        }
        return;
      }

      if (move === "shadow") {
        s.shadowT = 18;
        s.shadowOff = side * 36;
        announce("SHADOW STRIKE!", 34);
        burst(center, g - 28, "#111827", 12, "smoke");
        const hit = hitSide(side, zone() + 40, 70, "VANISH!", true);
        if (!hit) miss();
        else {
          s.flashWhite = 4;
          s.moveIdx = Math.min(s.moveIdx + 1, COMBO_LADDER.length - 1);
        }
        return;
      }

      if (move === "sweep") {
        announce("LEG SWEEP!", 28);
        const hit = hitSide(side, zone() + 44, 35, "TRIP!", true);
        if (!hit) miss();
        else s.moveIdx = Math.min(s.moveIdx + 1, COMBO_LADDER.length - 1);
        return;
      }

      if (move === "dive") {
        s.diveT = 20;
        announce("DIVE KICK!", 32);
        const hit = hitSide(side, zone() + 38, 60, "STOMP!");
        if (!hit) miss();
        else {
          s.shake = 10;
          s.flashWhite = 3;
          s.moveIdx = Math.min(s.moveIdx + 1, COMBO_LADDER.length - 1);
        }
        return;
      }

      if (move === "beatdown") {
        s.beatT = 26;
        announce("BEATDOWN!", 40);
        // Rapid multi-hit on closest + splash
        const hit = hitSide(side, zone() + 36, 90, "FINISHER!", true);
        if (!hit) miss();
        else {
          s.shake = 12;
          s.flashWhite = 6;
          burst(center + side * 40, g - 30, "#f5d76e", 20, "star");
          s.moveIdx = 0; // reset ladder after finisher
        }
        return;
      }

      // jab / cross / uppercut — single target
      const reach = zone() + (move === "uppercut" ? 36 : 28);
      const labels =
        move === "uppercut"
          ? ["UPPER!", "CRACK!"]
          : move === "cross"
            ? ["CROSS!", "BANG!"]
            : ["POW!", "THWACK!"];
      const label = labels[Math.floor(Math.random() * labels.length)]!;
      const bonus = move === "uppercut" ? 50 : move === "cross" ? 22 : 0;
      const hit = hitSide(side, reach, bonus, label);
      if (hit) {
        if (move === "uppercut") {
          announce("UPPERCUT!", 30);
          s.flashWhite = 3;
        } else if (move === "cross") {
          announce("HAYMAKER!", 24);
        }
        s.moveIdx = Math.min(s.moveIdx + 1, COMBO_LADDER.length - 1);
      } else {
        miss();
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
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        punch(1);
      }
      if (e.code === "Space" || e.code === "KeyB") {
        e.preventDefault();
        const s = state.current;
        if (!s.alive) return reset();
        const left = s.thugs.filter((t) => t.x + t.w / 2 < cx()).length;
        const right = s.thugs.length - left;
        const side = (right >= left ? 1 : -1) as 1 | -1;
        s.move = "batarang";
        s.punchSide = side;
        s.punchT = 14;
        throwBatarang(side);
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const drawBatman = (x: number, y: number, punchSide: 1 | -1, punchT: number, move: Move) => {
      const s = state.current;
      const dur = MOVE_DUR[move];
      const punchProg = punchT > 0 ? 1 - punchT / dur : 0;
      const bob = Math.sin(s.frame / 10) * 1.5;
      const capeSwing =
        Math.sin(s.frame / 14) * 6 +
        (s.capeT > 0 ? Math.sin((20 - s.capeT) * 0.5) * 18 : 0) +
        (s.smokeT > 0 ? Math.sin(s.frame / 3) * 4 : 0);

      const ox = s.shadowT > 0 ? s.shadowOff * (s.shadowT / 18) : 0;
      const diveY = s.diveT > 0 ? -Math.sin(((20 - s.diveT) / 20) * Math.PI) * 28 : 0;
      const bx = x + ox;
      const by = y + diveY;

      if (s.shadowT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.ellipse(x - ox * 0.6, by + 28, 16, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.moveTo(bx - 8, by + 6 + bob);
      ctx.quadraticCurveTo(bx - 32 - capeSwing, by + 30 + bob, bx - 20 - capeSwing * 0.5, by + 62 + bob);
      ctx.lineTo(bx + 20 + capeSwing * 0.5, by + 62 + bob);
      ctx.quadraticCurveTo(bx + 32 + capeSwing, by + 30 + bob, bx + 8, by + 6 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.moveTo(bx - 4, by + 10 + bob);
      ctx.quadraticCurveTo(bx - 18, by + 28 + bob, bx - 10, by + 54 + bob);
      ctx.lineTo(bx + 10, by + 54 + bob);
      ctx.quadraticCurveTo(bx + 18, by + 28 + bob, bx + 4, by + 10 + bob);
      ctx.closePath();
      ctx.fill();

      if (s.capeT > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, s.capeT / 12) * 0.55;
        ctx.strokeStyle = "#f5d76e";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(bx, by + 28, 28 + (20 - s.capeT) * 2.2, 36, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (s.smokeT > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.55, s.smokeT / 20);
        for (let i = 0; i < 6; i++) {
          const a = s.frame / 8 + i;
          ctx.fillStyle = i % 2 ? "#64748b" : "#475569";
          ctx.beginPath();
          ctx.arc(bx + Math.cos(a) * (20 + i * 8), by + 20 + Math.sin(a * 1.3) * 12, 14 + i * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const lean = punchT > 0 ? punchSide * punchProg * 4 : 0;
      const sweepKick = move === "sweep" && punchT > 0;
      const diveKick = move === "dive" && punchT > 0;
      ctx.fillStyle = "#0f172a";
      if (sweepKick) {
        ctx.fillRect(bx - 4, by + 38 + bob, 9, 22);
        ctx.save();
        ctx.translate(bx, by + 48 + bob);
        ctx.rotate(punchSide * punchProg * 1.4);
        ctx.fillRect(0, -4, 28 + punchProg * 10, 8);
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(26 + punchProg * 10, -5, 10, 10);
        ctx.restore();
      } else if (diveKick) {
        ctx.save();
        ctx.translate(bx, by + 40 + bob);
        ctx.rotate(punchSide * 0.5);
        ctx.fillRect(-6, 0, 10, 26 + punchProg * 8);
        ctx.fillRect(4, -4, 10, 22);
        ctx.restore();
      } else {
        ctx.fillRect(bx - 11 + lean * 0.3, by + 38 + bob, 9, 22);
        ctx.fillRect(bx + 2 + lean * 0.3, by + 38 + bob, 9, 22);
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(bx - 12 + lean * 0.3, by + 56 + bob, 11, 5);
        ctx.fillRect(bx + 1 + lean * 0.3, by + 56 + bob, 11, 5);
      }

      const armor = ctx.createLinearGradient(bx - 14, by, bx + 14, by + 40);
      armor.addColorStop(0, "#1f2937");
      armor.addColorStop(0.5, "#0b1220");
      armor.addColorStop(1, "#030712");
      ctx.fillStyle = armor;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2.5;
      roundRect(ctx, bx - 14 + lean * 0.2, by + 8 + bob, 28, 32, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f5d76e";
      ctx.fillRect(bx - 13 + lean * 0.2, by + 34 + bob, 26, 4);
      ctx.fillStyle = "#111";
      for (let i = 0; i < 4; i++) ctx.fillRect(bx - 10 + i * 6 + lean * 0.2, by + 34.5 + bob, 3, 3);

      ctx.fillStyle = "#f5d76e";
      ctx.beginPath();
      ctx.ellipse(bx + lean * 0.2, by + 22 + bob, 10, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.moveTo(bx - 7.5 + lean * 0.2, by + 22 + bob);
      ctx.lineTo(bx - 3.5 + lean * 0.2, by + 17.5 + bob);
      ctx.lineTo(bx + lean * 0.2, by + 21 + bob);
      ctx.lineTo(bx + 3.5 + lean * 0.2, by + 17.5 + bob);
      ctx.lineTo(bx + 7.5 + lean * 0.2, by + 22 + bob);
      ctx.lineTo(bx + 3.5 + lean * 0.2, by + 24.5 + bob);
      ctx.lineTo(bx + lean * 0.2, by + 22.5 + bob);
      ctx.lineTo(bx - 3.5 + lean * 0.2, by + 24.5 + bob);
      ctx.closePath();
      ctx.fill();

      if (punchT <= 0) {
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.ellipse(bx - 16, by + 22 + bob, 5, 9, -0.3, 0, Math.PI * 2);
        ctx.ellipse(bx + 16, by + 22 + bob, 5, 9, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.ellipse(bx + lean * 0.15, by + 2 + bob, 12.5, 12.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx - 9.5 + lean * 0.15, by - 4 + bob);
      ctx.lineTo(bx - 6.5 + lean * 0.15, by - 18 + bob);
      ctx.lineTo(bx - 2 + lean * 0.15, by - 4 + bob);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx + 2 + lean * 0.15, by - 4 + bob);
      ctx.lineTo(bx + 6.5 + lean * 0.15, by - 18 + bob);
      ctx.lineTo(bx + 9.5 + lean * 0.15, by - 4 + bob);
      ctx.fill();
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.ellipse(bx - 4.2 + lean * 0.15, by + 2 + bob, 3.6, 3.1, 0, 0, Math.PI * 2);
      ctx.ellipse(bx + 4.2 + lean * 0.15, by + 2 + bob, 3.6, 3.1, 0, 0, Math.PI * 2);
      ctx.fill();
      if (s.combo >= 5) {
        ctx.fillStyle = "#f5d76e";
        ctx.globalAlpha = 0.45 + Math.sin(s.frame / 6) * 0.15;
        ctx.beginPath();
        ctx.ellipse(bx - 4.2 + lean * 0.15, by + 2 + bob, 4.2, 3.6, 0, 0, Math.PI * 2);
        ctx.ellipse(bx + 4.2 + lean * 0.15, by + 2 + bob, 4.2, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (punchT > 0 && move === "beatdown") {
        for (let i = 0; i < 3; i++) {
          const t = (punchProg + i * 0.22) % 1;
          const fx = bx + punchSide * (14 + t * 32) + Math.sin(s.frame / 2 + i) * 4;
          const fy = by + 12 + bob + Math.cos(s.frame / 2 + i * 2) * 10;
          ctx.fillStyle = "#111827";
          ctx.beginPath();
          ctx.arc(fx, fy, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#f5d76e";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        if (punchProg > 0.3) {
          ctx.font = "700 15px Bangers, Impact, sans-serif";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3;
          ctx.strokeText("FINISHER", bx + punchSide * 28 - 20, by - 8);
          ctx.fillStyle = "#fbbf24";
          ctx.fillText("FINISHER", bx + punchSide * 28 - 20, by - 8);
        }
      }

      if (punchT > 0 && (move === "jab" || move === "cross" || move === "uppercut" || move === "shadow")) {
        const reach = move === "uppercut" ? 12 + punchProg * 28 : 16 + punchProg * 34;
        const fy = move === "uppercut" ? by + 28 - punchProg * 36 + bob : by + 18 + bob - punchProg * 4;
        const fx = bx + punchSide * reach + lean;

        ctx.strokeStyle = move === "shadow" ? "rgba(148,163,184,0.5)" : "rgba(245,215,110,0.35)";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(bx + punchSide * 8, by + 20 + bob);
        ctx.lineTo(fx, fy);
        ctx.stroke();

        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.arc(fx, fy, move === "uppercut" ? 9 : 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f5d76e";
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.fillStyle = "#f5d76e";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(fx + punchSide * 6, fy - 4 + i * 4);
          ctx.lineTo(fx + punchSide * 12, fy - 2 + i * 4);
          ctx.lineTo(fx + punchSide * 6, fy + i * 4);
          ctx.fill();
        }

        if (punchProg > 0.45) {
          const word =
            move === "uppercut" ? "UPPER" : move === "cross" ? "BANG" : move === "shadow" ? "SHADOW" : "POW";
          ctx.font = "700 15px Bangers, Impact, sans-serif";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3;
          ctx.strokeText(word, fx + punchSide * 10 - 10, fy - 12);
          ctx.fillStyle = "#f5d76e";
          ctx.fillText(word, fx + punchSide * 10 - 10, fy - 12);
        }
      }

      if (sweepKick && punchProg > 0.2) {
        ctx.strokeStyle = "rgba(245,215,110,0.4)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
          bx,
          by + 48,
          22 + punchProg * 16,
          punchSide > 0 ? -0.4 : Math.PI + 0.4,
          punchSide > 0 ? 0.9 : Math.PI - 0.9,
        );
        ctx.stroke();
      }

      if (punchT > 0 && (move === "batarang" || move === "gel" || move === "smoke")) {
        const reach = 10 + punchProg * 22;
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.arc(bx + punchSide * reach, by + 14 + bob, 7, 0, Math.PI * 2);
        ctx.fill();
        if (move === "gel") {
          ctx.fillStyle = "#86efac";
          ctx.beginPath();
          ctx.arc(bx + punchSide * (reach + 8), by + 10 + bob, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const drawThug = (t: Thug, gY: number) => {
      const bob = Math.sin(t.walk) * 2;
      const body = t.hitFlash ? "#fff" : t.kind === 2 ? "#3f1d1d" : t.kind === 1 ? "#7c2d12" : "#365314";
      const mx = t.x + t.w / 2;

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(mx, gY + 2, t.w * 0.45, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(t.x + 4, gY - 14 + bob * 0.3, 8, 14);
      ctx.fillRect(t.x + t.w - 12, gY - 14 - bob * 0.3, 8, 14);

      // Body
      ctx.fillStyle = body;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2.2;
      roundRect(ctx, t.x, gY - t.h + bob, t.w, t.h - 10, 5);
      ctx.fill();
      ctx.stroke();

      // Jacket detail
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.moveTo(mx, gY - t.h + 12 + bob);
      ctx.lineTo(mx, gY - 16 + bob);
      ctx.stroke();

      // Head
      ctx.fillStyle = t.hitFlash ? "#fff" : "#fde68a";
      ctx.beginPath();
      ctx.arc(mx, gY - t.h + 6 + bob, t.kind ? 9 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Angry eyes
      ctx.fillStyle = "#000";
      ctx.fillRect(mx - 5, gY - t.h + 4 + bob, 3, 2);
      ctx.fillRect(mx + 2, gY - t.h + 4 + bob, 3, 2);

      // Weapon for armed
      if (t.kind === 2) {
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(t.x + (t.side === 1 ? -6 : t.w), gY - t.h * 0.55 + bob, 8, 3);
      }

      // Bruiser shoulders
      if (t.kind >= 1) {
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.ellipse(t.x + 2, gY - t.h * 0.55 + bob, 7, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(t.x + t.w - 2, gY - t.h * 0.55 + bob, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawBatarang = (b: Batarang) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.spin);
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#f5d76e";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      // Bat-wing silhouette
      ctx.moveTo(0, -3);
      ctx.lineTo(-10, -8);
      ctx.lineTo(-14, -2);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 4);
      ctx.lineTo(-6, 6);
      ctx.lineTo(0, 2);
      ctx.lineTo(6, 6);
      ctx.lineTo(14, 4);
      ctx.lineTo(8, 0);
      ctx.lineTo(14, -2);
      ctx.lineTo(10, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      if (s.punchT > 0) s.punchT--;
      if (s.missFlash > 0) s.missFlash--;
      if (s.announceT > 0) s.announceT--;
      if (s.capeT > 0) s.capeT--;
      if (s.smokeT > 0) s.smokeT--;
      if (s.shadowT > 0) s.shadowT--;
      if (s.diveT > 0) s.diveT--;
      if (s.beatT > 0) s.beatT--;
      if (s.flashWhite > 0) s.flashWhite--;
      s.shake *= 0.85;
      const center = cx();
      const gY = ground();

      if (s.alive) {
        if (--s.spawnIn <= 0 && s.thugs.length < 3) {
          const side = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
          const preferred =
            s.thugs.length >= 1 && Math.random() > 0.35
              ? ((s.thugs.filter((t) => t.side === 1).length > s.thugs.filter((t) => t.side === -1).length
                  ? -1
                  : 1) as 1 | -1)
              : side;
          const roll = Math.random();
          const kind = (roll > 0.92 ? 2 : roll > 0.75 ? 1 : 0) as 0 | 1 | 2;
          const baseSpeed = 0.9 + Math.random() * 0.5 + Math.min(0.65, s.score / 2200);
          s.thugs.push({
            id: s.id++,
            x: preferred === 1 ? s.w + 40 : -50,
            side: preferred,
            w: kind === 2 ? 38 : kind === 1 ? 36 : 30,
            h: kind === 2 ? 48 : kind === 1 ? 44 : 36,
            speed: baseSpeed * (preferred === 1 ? -1 : 1) * (kind === 2 ? 0.85 : 1),
            hp: 1,
            hitFlash: 0,
            kind,
            stagger: 0,
            walk: Math.random() * 10,
          });
          s.spawnIn = 48 + Math.random() * 32 - Math.min(12, s.score / 800);
        }

        for (const t of s.thugs) {
          t.walk += 0.18;
          if (t.stagger > 0) {
            t.stagger--;
            t.x += -t.speed * 0.2;
          } else {
            t.x += t.speed;
          }
          if (t.hitFlash > 0) t.hitFlash--;
          if (Math.abs(t.x + t.w / 2 - center) < 14) {
            s.alive = false;
            setAlive(false);
            burst(center, gY - 20, "#f5d76e", 24, "spark");
            burst(center, gY - 10, "#64748b", 16, "smoke");
            announce("AMBUSHED!", 50);
            saveBest();
          }
        }
        s.thugs = s.thugs.filter((t) => t.x > -80 && t.x < s.w + 80 && t.hp > 0);

        // Batarangs
        for (const b of s.bats) {
          b.x += b.vx;
          b.spin += 0.55;
          b.life--;
          for (const t of s.thugs) {
            if (t.hp <= 0) continue;
            const mid = t.x + t.w / 2;
            if (Math.abs(mid - b.x) < t.w * 0.55 && Math.abs(gY - t.h * 0.5 - b.y) < t.h * 0.55) {
              killThug(t, gY, 60, "SLICE!");
              burst(b.x, b.y, "#f5d76e", 10, "star");
              b.life = 0;
            }
          }
        }
        s.bats = s.bats.filter((b) => b.life > 0 && b.x > -40 && b.x < s.w + 40);
        s.thugs = s.thugs.filter((t) => t.hp > 0);

        // Explosive gel arm + detonate
        for (const g of s.gels) {
          g.life--;
          g.armed--;
          if (g.armed === 0) {
            announce("BOOM!", 28);
            burst(g.x, g.y - 20, "#86efac", 18, "spark");
            burst(g.x, g.y - 16, "#fbbf24", 14, "star");
            burst(g.x, g.y - 10, "#64748b", 12, "smoke");
            s.shake = 11;
            s.flashWhite = 5;
            for (const t of s.thugs) {
              if (t.hp <= 0) continue;
              if (Math.abs(t.x + t.w / 2 - g.x) < zone() * 0.85) {
                killThug(t, gY, 75, "BLAST!");
              }
            }
            s.thugs = s.thugs.filter((t) => t.hp > 0);
          }
        }
        s.gels = s.gels.filter((g) => g.life > 0);
      }

      for (const p of s.parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.kind === "smoke") {
          p.vy -= 0.05;
          p.size *= 1.02;
        } else {
          p.vy += 0.12;
        }
        p.life--;
      }
      s.parts = s.parts.filter((p) => p.life > 0);

      for (const im of s.impacts) im.life--;
      s.impacts = s.impacts.filter((im) => im.life > 0);

      ctx.save();
      if (s.shake > 0.5) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      // Alley night sky
      const bg = ctx.createLinearGradient(0, 0, 0, s.h);
      bg.addColorStop(0, "#020617");
      bg.addColorStop(0.55, "#0b1220");
      bg.addColorStop(1, "#111827");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, s.w, s.h);

      // Rain streaks
      ctx.strokeStyle = "rgba(148,163,184,0.18)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 28; i++) {
        const rx = ((s.frame * 3 + i * 47) % (s.w + 40)) - 20;
        const ry = ((s.frame * 8 + i * 73) % (s.h + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + 12);
        ctx.stroke();
      }

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

      // Distant window lights
      ctx.fillStyle = "rgba(245,215,110,0.35)";
      for (let i = 0; i < 5; i++) {
        const wx = 18 + (i % 2) * 28;
        const wy = 40 + i * 48 + Math.sin(s.frame / 40 + i) * 2;
        ctx.fillRect(wx, wy, 10, 14);
        ctx.fillRect(s.w - 28 - (i % 2) * 28, wy + 20, 10, 14);
      }

      // Ground
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, gY, s.w, s.h - gY);
      // Wet reflection strip
      const wet = ctx.createLinearGradient(0, gY, 0, s.h);
      wet.addColorStop(0, "rgba(245,215,110,0.12)");
      wet.addColorStop(1, "transparent");
      ctx.fillStyle = wet;
      ctx.fillRect(0, gY, s.w, 40);
      ctx.fillStyle = "#f5d76e";
      ctx.fillRect(0, gY, s.w, 3);

      // Strike zones
      ctx.fillStyle = s.missFlash ? "rgba(239,68,68,0.22)" : "rgba(245,215,110,0.1)";
      ctx.fillRect(center - zone(), gY - 78, zone() * 2, 78);
      ctx.strokeStyle = s.missFlash ? "rgba(239,68,68,0.7)" : "rgba(245,215,110,0.5)";
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.strokeRect(center - zone(), gY - 78, zone(), 78);
      ctx.strokeRect(center, gY - 78, zone(), 78);
      ctx.setLineDash([]);
      ctx.fillStyle = "#f5d76e";
      ctx.font = `700 ${Math.round(11 * hudScale(s.w))}px Comic Neue, sans-serif`;
      ctx.fillText("◀ LEFT", center - zone() + 10, gY - 86);
      ctx.fillText("RIGHT ▶", center + 10, gY - 86);

      for (const t of s.thugs) drawThug(t, gY);
      for (const b of s.bats) drawBatarang(b);

      // Gel charges
      for (const gel of s.gels) {
        const pulse = 1 + Math.sin(s.frame / 3) * 0.15;
        ctx.fillStyle = gel.armed > 0 ? "#86efac" : "#fbbf24";
        ctx.beginPath();
        ctx.arc(gel.x, gel.y, 5 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#14532d";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (gel.armed > 0 && gel.armed <= 12) {
          ctx.fillStyle = "#fbbf24";
          ctx.font = "700 10px Comic Neue, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(Math.ceil(gel.armed / 6)), gel.x, gel.y - 10);
          ctx.textAlign = "left";
        }
      }

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 18);
        if (p.kind === "smoke") {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "star") {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2 + s.frame * 0.2;
            const r = i % 2 === 0 ? p.size : p.size * 0.4;
            const px = p.x + Math.cos(a) * r;
            const py = p.y + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;
      }

      for (const im of s.impacts) {
        const t = im.life / 22;
        ctx.save();
        ctx.globalAlpha = Math.min(1, t * 1.4);
        ctx.translate(im.x, im.y - (22 - im.life) * 0.8);
        ctx.scale(1 + (1 - t) * 0.35, 1 + (1 - t) * 0.35);
        ctx.font = "800 16px Bangers, Impact, sans-serif";
        ctx.textAlign = "center";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.strokeText(im.label, 0, 0);
        ctx.fillStyle = im.color;
        ctx.fillText(im.label, 0, 0);
        ctx.restore();
      }

      drawBatman(center, gY - 56, s.punchSide, s.punchT, s.move);

      if (s.flashWhite > 0) {
        ctx.fillStyle = `rgba(255,255,255,${s.flashWhite * 0.12})`;
        ctx.fillRect(0, 0, s.w, s.h);
      }

      const hs = hudScale(s.w);
      ctx.fillStyle = "#f5d76e";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(22 * hs)}px Bangers, Impact, sans-serif`;
      ctx.textAlign = "left";
      ctx.strokeText(`JUSTICE ${s.score}`, 14, 28 * hs + 8);
      ctx.fillText(`JUSTICE ${s.score}`, 14, 28 * hs + 8);
      if (s.combo > 1) {
        ctx.fillStyle = s.combo >= 8 ? "#fbbf24" : "#e5e7eb";
        ctx.font = `700 ${Math.round(16 * hs)}px Bangers, Impact, sans-serif`;
        ctx.fillText(`COMBO x${s.combo}`, 14, 50 * hs + 8);
      }

      // Announcements
      if (s.announceT > 0) {
        const pulse = 1 + Math.sin(s.frame / 4) * 0.04;
        ctx.save();
        ctx.translate(s.w / 2, s.h * 0.22);
        ctx.scale(pulse, pulse);
        ctx.globalAlpha = Math.min(1, s.announceT / 10);
        ctx.font = `800 ${Math.round(22 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 5;
        ctx.strokeText(s.announce, 0, 0);
        ctx.fillStyle =
          s.announce.includes("BATARANG") || s.announce.includes("NIGHT") || s.announce.includes("BEATDOWN")
            ? "#f5d76e"
            : s.announce.includes("AMBUSH") || s.announce.includes("MISS")
              ? "#f87171"
              : s.announce.includes("CAPE") || s.announce.includes("SHADOW") || s.announce.includes("SMOKE")
                ? "#94a3b8"
                : s.announce.includes("GEL") || s.announce.includes("BOOM")
                  ? "#86efac"
                  : s.announce.includes("DIVE") || s.announce.includes("SWEEP")
                    ? "#fdba74"
                    : "#fff6df";
        ctx.fillText(s.announce, 0, 0);
        ctx.restore();
      }

      if (s.alive && s.frame < 140 && s.announceT <= 0) {
        ctx.font = `700 ${11 * hs}px Comic Neue, sans-serif`;
        ctx.fillStyle = "rgba(245,215,110,0.85)";
        ctx.textAlign = "center";
        ctx.fillText(
          s.w < 500
            ? "Tap L/R builds combo moves · double-tap = Batarang"
            : "Combo ladder: Jab→Cross→Sweep→Upper→Dive→Cape→Shadow→Gel→Smoke→Beatdown · switch side = Shadow · double-tap = Batarang",
          s.w / 2,
          s.h - 28,
        );
        ctx.textAlign = "left";
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#f5d76e";
        ctx.font = `700 ${Math.round(34 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.strokeText("AMBUSHED!", s.w / 2, s.h / 2);
        ctx.fillText("AMBUSHED!", s.w / 2, s.h / 2);
        ctx.fillStyle = "#fff6df";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to return to the alley", s.w / 2, s.h / 2 + 28);
        ctx.textAlign = "left";
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
      tagline="Combo ladder · Sweep · Dive · Shadow · Gel · Smoke · Beatdown"
      mobileTagline="Tap L/R builds moves · double-tap = Batarang"
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
      aliveHint="Each hit climbs the move ladder: Jab → Cross → Sweep → Uppercut → Dive Kick → Cape → Shadow Strike → Explosive Gel → Smoke Bomb → Beatdown. Switch sides fast for Shadow Strike. Double-tap or Space for Batarang."
      deadHint="Ambushed! Tap to try again."
      canvasRef={canvasRef}
      ariaLabel="Batman alley brawl mini-game"
    />
  );
}
