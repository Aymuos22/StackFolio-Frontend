import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  kind: "blue" | "red" | "purple" | "slash" | "dismantle";
  dmg: number;
  r: number;
  from: "gojo" | "sukuna";
  fromDomain?: boolean;
  waveH?: number; // vertical slash wall height
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };

/**
 * Gojo vs Sukuna — Shinjuku final battle.
 * Gojo: Blue · Red · Hollow Purple · RCT · Domain: Infinity
 * Sukuna AI: Slash / Dismantle · Mahoraga · Domain: Malevolent Shrine
 */
export default function GojoVsSukuna({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const keys = useRef({ left: false, right: false, up: false, down: false });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [gojoHp, setGojoHp] = useState(100);
  const [domain, setDomain] = useState(0);

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    won: false,
    score: 0,
    gojo: {
      x: 120,
      yOff: 58,
      hp: 100,
      maxHp: 100,
      energy: 0,
      vx: 0,
      facing: 1 as 1 | -1,
      cool: 0,
      hitFlash: 0,
      stun: 0,
      invuln: 0,
      pose: 0, // anim frames for cast
      cast: "" as "" | "blue" | "red" | "purple" | "rct" | "domain" | "melee" | "blackflash",
      rctFlash: 0,
      dashT: 0,
      dashCool: 0,
      bfSpark: 0, // black flash trail / hit spark frames
    },
    sukuna: {
      x: 480,
      yOff: 58,
      hp: 100,
      maxHp: 100,
      energy: 0,
      vx: 0,
      facing: -1 as 1 | -1,
      cool: 0,
      hitFlash: 0,
      stun: 0,
      invuln: 0,
      aiThink: 40,
      pose: 0,
      cast: "" as "" | "slash" | "domain" | "summon",
      flyTarget: 58,
      dashT: 0,
      dashCool: 0,
    },
    mahoraga: {
      active: false,
      used: false, // only once per fight (set when summon fully lands)
      lifeT: 0, // auto-leaves when timer ends
      enterT: 0, // entrance ritual countdown
      enterMax: 0,
      exitT: 0, // vanishing off-frame after one strike
      hasStruck: false, // one hit then leave
      x: 520,
      yOff: 70,
      hp: 80,
      maxHp: 80,
      facing: -1 as 1 | -1,
      cool: 0,
      hitFlash: 0,
      adaptT: 0, // countdown while adapting
      adaptKind: "" as "" | "blue" | "red" | "purple",
      adapted: false,
      swingT: 0,
      wheelSpin: 0,
    },
    camY: 0,
    flashT: 0, // white flash on Infinity release
    bfFlashT: 0, // black flash screen slam
    projs: [] as Projectile[],
    parts: [] as Particle[],
    shake: 0,
    gojoDomainT: 0,
    sukunaDomainT: 0,
    sukunaDomainWind: 0, // telegraph before Malevolent Shrine
    meleeCool: 0,
    meleeT: 0,
    meleeWinner: "" as "" | "gojo" | "sukuna",
    rctAuto: 8 * 60, // auto RCT ↔ Infinity every 8s
    nextAuto: "rct" as "rct" | "infinity",
    infinityT: 0, // Infinity technique (not domain)
    nextOrb: "blue" as "blue" | "red" | "purple",
    orbStep: 0, // 0–3: B,R,B,R then 4: auto Purple
    announce: "",
    announceT: 0,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_jjk") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const ground = () => state.current.h * 0.78;
    const bodyY = (who: "gojo" | "sukuna") => {
      const f = who === "gojo" ? state.current.gojo : state.current.sukuna;
      return ground() - f.yOff;
    };
    const btnH = () => 36;
    const btnY = () => state.current.h - 44;
    const isPhone = () => state.current.w < 560;
    const btns = () => {
      const phone = isPhone();
      const y = btnY();
      const h = btnH();
      const gap = phone ? 3 : 4;
      const aw = phone ? 44 : 0;
      const uw = phone ? 40 : 48;
      const dw = phone ? 54 : 68;
      const start = phone ? 6 + aw * 2 + gap * 2 + 6 : 6;
      const out: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
        up: { x: start, y, w: uw, h, label: "▲" },
        down: {
          x: start + uw + gap,
          y,
          w: uw,
          h,
          label: "▼",
        },
        dash: {
          x: start + uw + gap + uw + gap,
          y,
          w: phone ? 52 : 64,
          h,
          label: phone ? "FLASH" : "B.FLASH",
        },
        domain: { x: state.current.w - dw - 6, y, w: dw, h, label: phone ? "ABS" : "ABS INF" },
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
      state.current.gojo.x = Math.min(state.current.gojo.x, w * 0.4);
      state.current.sukuna.x = Math.max(w * 0.55, Math.min(state.current.sukuna.x, w - 40));
    };

    const burst = (x: number, y: number, color: string, n = 12, size = 3) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 4;
        state.current.parts.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 20,
          max: 20,
          color,
          size,
        });
      }
    };

    const saveBest = () => {
      const s = state.current;
      localStorage.setItem(
        "stackfolio_best_jjk",
        String(Math.max(Number(localStorage.getItem("stackfolio_best_jjk") || 0), s.score)),
      );
      setBest(Math.max(Number(localStorage.getItem("stackfolio_best_jjk") || 0), s.score));
    };

    const endFight = (won: boolean) => {
      const s = state.current;
      if (!s.alive) return;
      s.alive = false;
      s.won = won;
      setAlive(false);
      if (won) {
        s.score += 500 + Math.round(s.gojo.hp * 2);
        setScore(s.score);
        s.announce = "DOMAIN… CLEARED";
      } else {
        s.announce = "YOU DIED";
      }
      s.announceT = 60;
      s.shake = 14;
      saveBest();
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.won = false;
      s.score = 0;
      s.gojo = {
        x: Math.max(60, s.w * 0.22),
        yOff: 58,
        hp: 100,
        maxHp: 100,
        energy: 0,
        vx: 0,
        facing: 1,
        cool: 0,
        hitFlash: 0,
        stun: 0,
        invuln: 0,
        pose: 0,
        cast: "",
        rctFlash: 0,
        dashT: 0,
        dashCool: 0,
        bfSpark: 0,
      };
      s.sukuna = {
        x: Math.min(s.w - 60, s.w * 0.78),
        yOff: 58,
        hp: 100,
        maxHp: 100,
        energy: 20,
        vx: 0,
        facing: -1,
        cool: 0,
        hitFlash: 0,
        stun: 0,
        invuln: 0,
        aiThink: 50,
        pose: 0,
        cast: "",
        flyTarget: 58,
        dashT: 0,
        dashCool: 0,
      };
      s.mahoraga = {
        active: false,
        used: false,
        lifeT: 0,
        enterT: 0,
        enterMax: 0,
        exitT: 0,
        hasStruck: false,
        x: Math.min(s.w - 40, s.w * 0.86),
        yOff: 70,
        hp: 80,
        maxHp: 80,
        facing: -1,
        cool: 0,
        hitFlash: 0,
        adaptT: 0,
        adaptKind: "",
        adapted: false,
        swingT: 0,
        wheelSpin: 0,
      };
      s.camY = 0;
      s.flashT = 0;
      s.bfFlashT = 0;
      s.projs = [];
      s.parts = [];
      s.shake = 0;
      s.gojoDomainT = 0;
      s.sukunaDomainT = 0;
      s.sukunaDomainWind = 0;
      s.meleeCool = 0;
      s.meleeT = 0;
      s.meleeWinner = "";
      s.rctAuto = 8 * 60;
      s.nextAuto = "rct";
      s.infinityT = 0;
      s.nextOrb = "blue";
      s.orbStep = 0;
      s.announce = "GOJO VS SUKUNA";
      s.announceT = 55;
      setAlive(true);
      setScore(0);
      setGojoHp(100);
      setDomain(0);
    };

    const gainEnergy = (who: "gojo" | "sukuna", amt: number) => {
      const s = state.current;
      const f = who === "gojo" ? s.gojo : s.sukuna;
      if ((who === "gojo" && s.gojoDomainT > 0) || (who === "sukuna" && s.sukunaDomainT > 0)) return;
      f.energy = Math.min(100, f.energy + amt);
      if (who === "gojo") setDomain(Math.round(f.energy));
    };

    const hurt = (who: "gojo" | "sukuna", dmg: number, knock: number, opts?: { fromDomain?: boolean }) => {
      const s = state.current;
      const f = who === "gojo" ? s.gojo : s.sukuna;
      if (f.invuln > 0) return;
      // Infinity technique OR Absolute Infinity domain — attacks have no effect
      if (who === "gojo" && (s.gojoDomainT > 0 || s.infinityT > 0)) {
        burst(f.x, bodyY("gojo"), "#67e8f9", 10, 2.5);
        s.announce = s.gojoDomainT > 0 ? "ABSOLUTE INFINITY" : "INFINITY";
        s.announceT = 16;
        return;
      }
      // Domains drain HP but cannot finish the kill
      if (opts?.fromDomain) {
        if (f.hp <= 1) {
          f.hitFlash = 6;
          return;
        }
        f.hp = Math.max(1, f.hp - dmg);
        f.hitFlash = 8;
        f.x += knock * 0.35;
        f.x = Math.max(30, Math.min(s.w - 30, f.x));
        burst(f.x, ground() - 28, who === "gojo" ? "#67e8f9" : "#f87171", 6, 2);
        if (who === "gojo") setGojoHp(Math.round(f.hp));
        else {
          s.score += Math.round(dmg * 2);
          setScore(s.score);
          gainEnergy("gojo", dmg * 0.5);
          if (s.mahoraga.active && s.mahoraga.enterT > 0) s.mahoraga.enterT = -1;
        }
        if (f.hp <= 1 && s.announceT <= 0) {
          s.announce = "DOMAIN CAN'T FINISH!";
          s.announceT = 24;
        }
        return;
      }
      f.hp = Math.max(0, f.hp - dmg);
      f.hitFlash = 10;
      f.stun = Math.max(f.stun, 8);
      f.x += knock;
      f.x = Math.max(30, Math.min(s.w - 30, f.x));
      burst(f.x, ground() - 28, who === "gojo" ? "#67e8f9" : "#f87171", 10, 2);
      if (who === "gojo") {
        setGojoHp(Math.round(f.hp));
        if (f.hp <= 0) endFight(false);
      } else {
        s.score += Math.round(dmg * 3);
        setScore(s.score);
        gainEnergy("gojo", dmg * 0.8);
        // Mid-ritual hit interrupts Mahoraga (handled next frame via stun flag)
        if (s.mahoraga.active && s.mahoraga.enterT > 0) s.mahoraga.enterT = -1; // mark cancel
        if (f.hp <= 0) endFight(true);
      }
    };

    const inAnyDomain = () => state.current.gojoDomainT > 0 || state.current.sukunaDomainT > 0;

    const castBlue = () => {
      const s = state.current;
      const g = s.gojo;
      if (!s.alive || g.cool > 0 || g.stun > 0 || inAnyDomain()) return false;
      g.cool = 20;
      g.pose = 16;
      g.cast = "blue";
      g.facing = s.sukuna.x >= g.x ? 1 : -1;
      const hx = g.x + g.facing * 30;
      const hy = bodyY("gojo") - 8;
      s.projs.push({
        x: hx,
        y: hy,
        vx: g.facing * 5.2,
        vy: 0,
        life: 52,
        kind: "blue",
        dmg: 9,
        r: 22,
        from: "gojo",
      });
      burst(hx, hy, "#60a5fa", 16, 3);
      burst(hx, hy, "#93c5fd", 10, 2);
      gainEnergy("gojo", 10);
      return true;
    };

    const castRed = () => {
      const s = state.current;
      const g = s.gojo;
      if (!s.alive || g.cool > 0 || g.stun > 0 || inAnyDomain()) return false;
      g.cool = 26;
      g.pose = 18;
      g.cast = "red";
      g.facing = s.sukuna.x >= g.x ? 1 : -1;
      const hx = g.x + g.facing * 32;
      const hy = bodyY("gojo") - 6;
      s.projs.push({
        x: hx,
        y: hy,
        vx: g.facing * 9.5,
        vy: 0,
        life: 42,
        kind: "red",
        dmg: 13,
        r: 24,
        from: "gojo",
      });
      burst(hx, hy, "#f87171", 18, 3.5);
      burst(hx, hy, "#fecaca", 10, 2);
      s.shake = Math.max(s.shake, 4);
      gainEnergy("gojo", 12);
      return true;
    };

    /** Tap / J / Space — Blue×2 + Red×2 then auto Hollow Purple (same tap, no purple button). */
    const castOrb = () => {
      const s = state.current;
      if (s.orbStep >= 4) {
        const ok = castPurple();
        if (ok) {
          s.orbStep = 0;
          s.nextOrb = "blue";
        }
        return;
      }
      const kind = s.orbStep % 2 === 0 ? "blue" : "red";
      const ok = kind === "blue" ? castBlue() : castRed();
      if (ok) {
        s.orbStep += 1;
        s.nextOrb = s.orbStep >= 4 ? "purple" : s.orbStep % 2 === 0 ? "blue" : "red";
      }
    };

    const castPurple = () => {
      const s = state.current;
      const g = s.gojo;
      if (!s.alive || g.cool > 0 || g.stun > 0 || inAnyDomain()) return false;
      g.cool = 36;
      g.pose = 26;
      g.cast = "purple";
      g.facing = s.sukuna.x >= g.x ? 1 : -1;
      const hx = g.x + g.facing * 36;
      const hy = bodyY("gojo") - 10;
      s.projs.push({
        x: hx,
        y: hy,
        vx: g.facing * 13,
        vy: 0,
        life: 58,
        kind: "purple",
        dmg: 28,
        r: 32,
        from: "gojo",
      });
      burst(hx, hy, "#c084fc", 26, 4.2);
      burst(hx, hy, "#e879f9", 16, 3.2);
      burst(hx, hy, "#60a5fa", 10, 2.2);
      burst(hx, hy, "#f87171", 10, 2.2);
      s.announce = "HOLLOW PURPLE";
      s.announceT = 36;
      s.shake = 12;
      gainEnergy("gojo", 8);
      return true;
    };

    /** Auto RCT every 8s — heals 25% of current HP only. */
    const autoRCT = () => {
      const s = state.current;
      const g = s.gojo;
      if (!s.alive || g.hp <= 0) return;
      if (g.hp >= g.maxHp) {
        s.announce = "RCT — FULL HP";
        s.announceT = 22;
        return;
      }
      const heal = Math.max(1, Math.round(g.hp * 0.25));
      const applied = Math.min(heal, g.maxHp - g.hp);
      if (applied <= 0) return;
      g.pose = 18;
      g.cast = "rct";
      g.rctFlash = 32;
      g.hp = Math.min(g.maxHp, g.hp + applied);
      setGojoHp(Math.round(g.hp));
      burst(g.x, bodyY("gojo"), "#4ade80", 22, 3.2);
      burst(g.x, bodyY("gojo") - 16, "#86efac", 14, 2.4);
      s.announce = `RCT +${applied} (25%)`;
      s.announceT = 32;
    };

    /** Infinity technique — untouchable; ends in a white flash blast. */
    const releaseInfinity = () => {
      const s = state.current;
      const g = s.gojo;
      const k = s.sukuna;
      const m = s.mahoraga;
      const gy = bodyY("gojo");
      s.flashT = 28;
      s.shake = 20;
      s.announce = "INFINITY — RELEASE";
      s.announceT = 44;
      // Hard white flash burst
      burst(g.x, gy, "#ffffff", 48, 6);
      burst(g.x, gy, "#ffffff", 32, 4.5);
      burst(g.x, gy, "#e0f2fe", 24, 3.5);
      burst(g.x, gy, "#67e8f9", 16, 3);
      // Push + damage everyone nearby
      const pushK = k.x >= g.x ? 1 : -1;
      hurt("sukuna", 20, pushK * 88);
      k.stun = Math.max(k.stun, 28);
      k.x = Math.max(28, Math.min(s.w - 28, k.x + pushK * 52));
      if (m.active) {
        // Infinity release erases Mahoraga
        dismissMahoraga("vanish");
      }
      // Wipe all enemy projectiles
      for (const p of s.projs) {
        if (p.from === "sukuna" && p.life > 0) {
          burst(p.x, p.y, "#ffffff", 8, 2.5);
          p.life = 0;
        }
      }
    };

    const activateInfinity = () => {
      const s = state.current;
      const g = s.gojo;
      if (!s.alive || g.hp <= 0) return;
      if (s.gojoDomainT > 0) return; // domain already stronger
      s.infinityT = 3.5 * 60; // ~3.5s of Infinity
      g.invuln = Math.max(g.invuln, s.infinityT);
      g.pose = 16;
      g.cast = "domain"; // reuse cyan pose cue
      burst(g.x, bodyY("gojo"), "#67e8f9", 20, 3.5);
      burst(g.x, bodyY("gojo"), "#a5f3fc", 12, 2.5);
      burst(g.x, bodyY("gojo"), "#ffffff", 10, 2);
      s.announce = "LIMITLESS TECHNIQUE: INFINITY";
      s.announceT = 40;
      s.shake = Math.max(s.shake, 4);
      // Mahoraga cannot exist inside Infinity
      if (s.mahoraga.active) {
        dismissMahoraga("vanish");
        s.announce = "INFINITY — MAHORAGA DENIED";
        s.announceT = 36;
      }
    };

    const runAutoSupport = () => {
      const s = state.current;
      if (s.nextAuto === "rct") {
        autoRCT();
        s.nextAuto = "infinity";
      } else {
        activateInfinity();
        s.nextAuto = "rct";
      }
    };

    const clashDomains = (opener: "gojo" | "sukuna") => {
      const s = state.current;
      s.gojoDomainT = 0;
      s.sukunaDomainT = 0;
      s.sukunaDomainWind = 0;
      s.infinityT = 0;
      s.gojo.invuln = 0;
      s.gojo.energy = 0;
      s.sukuna.energy = 0;
      setDomain(0);
      s.gojo.stun = Math.max(s.gojo.stun, 18);
      s.sukuna.stun = Math.max(s.sukuna.stun, 18);
      s.announce = opener === "gojo" ? "DOMAIN CLASH! ABSOLUTE INFINITY" : "DOMAIN CLASH! SHRINE";
      s.announceT = 48;
      s.shake = 16;
      const mx = (s.gojo.x + s.sukuna.x) / 2;
      const my = ground() - 40;
      burst(mx, my, "#fbbf24", 28, 4);
      burst(mx, my - 10, "#67e8f9", 16, 3);
      burst(mx, my - 10, "#f87171", 16, 3);
    };

    const castAbsoluteInfinity = () => {
      const s = state.current;
      const g = s.gojo;
      if (!s.alive || g.energy < 100 || s.gojoDomainT > 0 || g.stun > 0) {
        if (g.energy < 100) {
          s.announce = "NEED 100 CE";
          s.announceT = 28;
        }
        return;
      }
      // Clash with Sukuna domain (or his windup) — cancels both
      if (s.sukunaDomainT > 0 || s.sukunaDomainWind > 0) {
        clashDomains("gojo");
        return;
      }
      g.energy = 0;
      setDomain(0);
      s.infinityT = 0; // domain supersedes technique Infinity
      s.gojoDomainT = 220;
      g.pose = 30;
      g.cast = "domain";
      g.invuln = 220;
      s.sukuna.stun = Math.max(s.sukuna.stun, 50);
      s.announce = "DOMAIN EXPANSION: ABSOLUTE INFINITY";
      s.announceT = 60;
      s.shake = 14;
      burst(g.x, bodyY("gojo"), "#67e8f9", 34, 4.5);
      burst(g.x, bodyY("gojo"), "#a5f3fc", 18, 3);
    };

    const sukunaSlash = (heavy = false) => {
      const s = state.current;
      const k = s.sukuna;
      if (k.cool > 0 || k.stun > 0 || inAnyDomain() || s.sukunaDomainWind > 0) return;
      k.cool = heavy ? 34 : 22;
      k.pose = 16;
      k.cast = "slash";
      k.facing = s.gojo.x >= k.x ? 1 : -1;
      const hy = bodyY("sukuna");
      // One big vertical cleave wave
      s.projs.push({
        x: k.x + k.facing * 28,
        y: hy,
        vx: k.facing * (heavy ? 10 : 8.2),
        vy: 0,
        life: heavy ? 52 : 44,
        kind: heavy ? "dismantle" : "slash",
        dmg: heavy ? 12 : 8,
        r: heavy ? 18 : 14,
        from: "sukuna",
        waveH: heavy ? 150 : 120,
      });
      burst(k.x + k.facing * 24, hy, "#fecaca", heavy ? 16 : 10, 3);
      burst(k.x + k.facing * 32, hy, "#f87171", heavy ? 10 : 6, 2.5);
      s.shake = Math.max(s.shake, heavy ? 6 : 3);
      gainEnergy("sukuna", heavy ? 14 : 9);
    };

    const startSukunaDomainWindup = () => {
      const s = state.current;
      const k = s.sukuna;
      if (k.energy < 100 || s.sukunaDomainT > 0 || s.sukunaDomainWind > 0 || k.stun > 0) return;
      s.sukunaDomainWind = 60;
      k.pose = 60;
      k.cast = "domain";
      k.vx = 0;
      s.announce = "⚠ SUKUNA DOMAIN INCOMING!";
      s.announceT = 55;
      s.shake = 8;
      burst(k.x, ground() - 40, "#fca5a5", 18, 3);
    };

    const castMalevolentShrine = () => {
      const s = state.current;
      const k = s.sukuna;
      if (k.energy < 100 || s.sukunaDomainT > 0 || k.stun > 0) return;
      // Clash if Gojo Infinity is already up
      if (s.gojoDomainT > 0) {
        clashDomains("sukuna");
        return;
      }
      k.energy = 0;
      s.sukunaDomainWind = 0;
      s.sukunaDomainT = 180;
      k.pose = 28;
      k.cast = "domain";
      s.announce = "MALEVOLENT SHRINE";
      s.announceT = 55;
      s.shake = 14;
      burst(k.x, ground() - 40, "#f87171", 28, 4);
    };

    /** Opposing techniques cancel each other on contact. */
    const clashAttacks = () => {
      const s = state.current;
      const list = s.projs;
      for (let i = 0; i < list.length; i++) {
        const a = list[i]!;
        if (a.life <= 0) continue;
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j]!;
          if (b.life <= 0 || a.from === b.from) continue;
          const aSlash = a.kind === "slash" || a.kind === "dismantle";
          const bSlash = b.kind === "slash" || b.kind === "dismantle";
          let hit = false;
          if (aSlash || bSlash) {
            // Vertical wave vs orb: horizontal proximity + shared vertical span
            const ah = a.waveH ?? a.r * 2;
            const bh = b.waveH ?? b.r * 2;
            hit =
              Math.abs(a.x - b.x) < a.r + b.r + 16 &&
              Math.abs(a.y - b.y) < (ah + bh) * 0.35;
          } else {
            hit = Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 8;
          }
          if (!hit) continue;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          a.life = 0;
          b.life = 0;
          burst(mx, my, "#fbbf24", 16, 3.5);
          burst(mx, my, "#67e8f9", 10, 2.5);
          burst(mx, my, "#f87171", 10, 2.5);
          s.shake = Math.max(s.shake, 7);
          const label =
            a.from === "gojo"
              ? `${a.kind.toUpperCase()} × ${b.kind.toUpperCase()}`
              : `${b.kind.toUpperCase()} × ${a.kind.toUpperCase()}`;
          s.announce = `CANCEL! ${label}`;
          s.announceT = 26;
        }
      }
    };

    const hitTest = (p: Projectile) => {
      const s = state.current;
      if (p.from === "gojo") {
        const k = s.sukuna;
        const ky = bodyY("sukuna");
        const m = s.mahoraga;
        const my = ground() - m.yOff;
        // Prefer hitting Mahoraga if he's in the way
        if (m.active && Math.hypot(p.x - m.x, p.y - my) < p.r + 28) {
          const kind = p.kind === "blue" || p.kind === "red" || p.kind === "purple" ? p.kind : undefined;
          hurtMahoraga(p.dmg, s.gojo.facing * 22, kind);
          if (p.kind === "purple") {
            s.shake = Math.max(s.shake, 10);
            burst(m.x, my, "#c084fc", 14, 3.5);
          }
          p.life = 0;
          return;
        }
        if (Math.hypot(p.x - k.x, p.y - ky) < p.r + 20) {
          if (p.kind === "blue") {
            const pull = s.gojo.x > k.x ? 18 : -18;
            hurt("sukuna", p.dmg, pull, { fromDomain: p.fromDomain });
            k.x += (s.gojo.x - k.x) * 0.16;
          } else if (p.kind === "purple") {
            hurt("sukuna", p.dmg, s.gojo.facing * 36, { fromDomain: p.fromDomain });
            s.shake = Math.max(s.shake, 12);
            burst(k.x, ky, "#c084fc", 18, 4);
          } else if (p.kind === "red") {
            hurt("sukuna", p.dmg, s.gojo.facing * 28, { fromDomain: p.fromDomain });
          } else {
            hurt("sukuna", p.dmg, s.gojo.facing * 22, { fromDomain: p.fromDomain });
          }
          p.life = 0;
          return;
        }
      } else {
        const g = s.gojo;
        const gy = bodyY("gojo");
        const isSlash = p.kind === "slash" || p.kind === "dismantle";
        let hit = false;
        if (isSlash && p.waveH) {
          // Tall vertical wave: hit if within horizontal band and vertical span
          hit = Math.abs(p.x - g.x) < p.r + 20 && Math.abs(p.y - gy) < p.waveH * 0.5;
        } else {
          hit = Math.hypot(p.x - g.x, p.y - gy) < p.r + 18;
        }
        if (!hit) return;
        // Infinity technique OR Absolute Infinity domain — every attack nullified
        if (s.gojoDomainT > 0 || s.infinityT > 0) {
          burst(g.x, gy, "#67e8f9", 14, 3);
          burst(p.x, p.y, "#a5f3fc", 10, 2.5);
          s.announce = s.gojoDomainT > 0 ? "ABSOLUTE INFINITY" : "INFINITY";
          s.announceT = 18;
          p.life = 0;
          return;
        }
        hurt("gojo", p.dmg, s.sukuna.facing * 18, { fromDomain: p.fromDomain });
        p.life = 0;
      }
    };

    const startBlackFlash = () => {
      const s = state.current;
      const f = s.gojo;
      const k = s.sukuna;
      if (!s.alive || f.hp <= 0 || f.stun > 0 || f.dashCool > 0 || f.dashT > 0) return;
      if (s.gojoDomainT > 0 || s.infinityT > 0) return;
      // Snap toward Sukuna and lunge
      f.facing = k.x >= f.x ? 1 : -1;
      f.dashT = 20;
      f.dashCool = 48;
      f.vx = f.facing * 16;
      f.pose = Math.max(f.pose, 22);
      f.cast = "blackflash";
      f.bfSpark = 28;
      s.announce = "BLACK FLASH!";
      s.announceT = 36;
      s.bfFlashT = 14;
      s.shake = Math.max(s.shake, 8);
      const gy = bodyY("gojo");
      // Distortion ring + black sparks
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        s.parts.push({
          x: f.x,
          y: gy,
          vx: Math.cos(a) * 5,
          vy: Math.sin(a) * 5,
          life: 14,
          max: 14,
          color: i % 2 === 0 ? "#0a0a0a" : "#fbbf24",
          size: 2.8,
        });
      }
      burst(f.x - f.facing * 10, gy, "#0a0a0a", 22, 3.5);
      burst(f.x, gy - 12, "#fbbf24", 14, 2.8);
      burst(f.x - f.facing * 16, gy + 4, "#ef4444", 10, 2.2);
    };

    const tryBlackFlashHit = () => {
      const s = state.current;
      if (!s.alive || s.meleeT > 0 || inAnyDomain() || s.infinityT > 0) return;
      const g = s.gojo;
      const k = s.sukuna;
      if (g.dashT <= 0) return;
      const dist = Math.abs(g.x - k.x);
      const vDist = Math.abs(g.yOff - k.yOff);
      if (dist > 72 || vDist > 56) return;

      s.meleeCool = 36;
      s.meleeT = 22;
      s.meleeWinner = "gojo";
      g.pose = 22;
      k.pose = 22;
      g.cast = "blackflash";
      k.cast = "slash";
      g.facing = k.x >= g.x ? 1 : -1;
      k.facing = g.x >= k.x ? 1 : -1;
      g.dashT = 0;

      const mid = (g.x + k.x) / 2;
      const gy = (bodyY("gojo") + bodyY("sukuna")) / 2;
      // Heavy black-spark impact
      burst(mid, gy, "#0a0a0a", 36, 5);
      burst(mid, gy, "#fbbf24", 28, 4);
      burst(mid, gy, "#ef4444", 18, 3.2);
      burst(mid, gy - 24, "#171717", 16, 3);
      burst(mid, gy + 10, "#ffffff", 8, 2);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        s.parts.push({
          x: mid,
          y: gy,
          vx: Math.cos(a) * (6 + Math.random() * 4),
          vy: Math.sin(a) * (6 + Math.random() * 4),
          life: 18,
          max: 18,
          color: i % 3 === 0 ? "#fbbf24" : "#0a0a0a",
          size: 3.2,
        });
      }
      s.shake = 22;
      s.bfFlashT = 20;
      g.bfSpark = 36;
      hurt("sukuna", 22, g.facing * 90);
      k.stun = Math.max(k.stun, 32);
      g.x -= g.facing * 6;
      // Slight vertical pop for impact feel
      g.yOff = Math.min(g.yOff + 8, s.h * 0.85);
      s.announce = "BLACK FLASH!!";
      s.announceT = 44;
      gainEnergy("gojo", 18);
      g.x = Math.max(28, Math.min(s.w - 28, g.x));
      k.x = Math.max(28, Math.min(s.w - 28, k.x));
    };

    const dismissMahoraga = (reason: "leave" | "fallen" | "vanish") => {
      const s = state.current;
      const m = s.mahoraga;
      if (!m.active) return;
      m.active = false;
      m.lifeT = 0;
      m.enterT = 0;
      m.exitT = 0;
      m.used = true;
      if (reason === "fallen") s.announce = "MAHORAGA FALLEN";
      else if (reason === "vanish") s.announce = "MAHORAGA VANISHES";
      else s.announce = "MAHORAGA RETREATS";
      s.announceT = 36;
      burst(m.x, ground() - m.yOff, "#fbbf24", 24, 4);
      burst(m.x, ground() - m.yOff, "#e7e5e4", 18, 3);
    };

    const cancelMahoragaSummon = () => {
      const s = state.current;
      const m = s.mahoraga;
      const k = s.sukuna;
      if (!m.active || m.enterT === 0) return; // only during ritual (enterT > 0 or -1 mark)
      m.active = false;
      m.lifeT = 0;
      m.enterT = 0;
      m.exitT = 0;
      m.hasStruck = false;
      m.used = false; // interrupted — can attempt again
      k.cast = "";
      k.pose = 0;
      k.stun = Math.max(k.stun, 14);
      s.announce = "SUMMON CANCELLED!";
      s.announceT = 36;
      s.shake = Math.max(s.shake, 10);
      burst(m.x, ground() - m.yOff, "#78716c", 22, 3.5);
      burst(k.x, bodyY("sukuna"), "#f87171", 16, 3);
    };

    const beginMahoragaExit = () => {
      const s = state.current;
      const m = s.mahoraga;
      if (!m.active || m.exitT > 0) return;
      m.exitT = 40;
      m.cool = 999;
      m.facing = -1; // always exit left off-frame
      s.announce = "MAHORAGA DEPARTS";
      s.announceT = 28;
      burst(m.x, ground() - m.yOff, "#e7e5e4", 14, 3);
    };

    const summonMahoraga = () => {
      const s = state.current;
      const k = s.sukuna;
      const m = s.mahoraga;
      if (!s.alive || m.active || m.used || k.stun > 0 || k.energy < 45) return;
      if (s.infinityT > 0 || s.gojoDomainT > 0) return; // can't summon into Infinity
      k.energy -= 45;
      k.pose = 40;
      k.cast = "summon";
      m.active = true;
      m.used = false;
      m.enterMax = 70;
      m.enterT = 70;
      m.exitT = 0;
      m.hasStruck = false;
      m.lifeT = 3 * 60;
      m.hp = m.maxHp;
      // Enter from the right, charge left across the field
      m.x = s.w + 50;
      m.yOff = s.gojo.yOff + 10;
      m.facing = -1;
      m.cool = 6;
      m.hitFlash = 0;
      m.adaptT = 0;
      m.adaptKind = "";
      m.adapted = false;
      m.swingT = 0;
      m.wheelSpin = 0;
      s.announce = "WITH THIS TREASURE I SUMMON…";
      s.announceT = 40;
      s.shake = 10;
      burst(s.w - 20, ground() - m.yOff, "#fbbf24", 18, 3);
      burst(k.x, bodyY("sukuna"), "#f87171", 12, 2.5);
    };

    const hurtMahoraga = (dmg: number, knock: number, kind?: "blue" | "red" | "purple") => {
      const s = state.current;
      const m = s.mahoraga;
      if (!m.active || m.hp <= 0) return;
      // Disrupting the ritual cancels the summon
      if (m.enterT > 0) {
        cancelMahoragaSummon();
        return;
      }
      if (m.exitT > 0) return; // already leaving
      if (m.adapted && kind && m.adaptKind === kind) {
        burst(m.x, ground() - m.yOff, "#fbbf24", 12, 2.8);
        s.announce = "MAHORAGA ADAPTED!";
        s.announceT = 22;
        m.wheelSpin += 0.55;
        return;
      }
      m.hp -= dmg;
      m.hitFlash = 10;
      m.x += knock;
      m.x = Math.max(28, Math.min(s.w - 28, m.x));
      burst(m.x, ground() - m.yOff, "#e7e5e4", 10, 2.5);
      if (kind) {
        if (m.adaptKind !== kind) {
          m.adaptKind = kind;
          m.adapted = false;
          m.adaptT = 150; // adapting…
        }
      }
      s.score += Math.round(dmg * 1.5);
      setScore(s.score);
      if (m.hp <= 0) {
        m.hp = 0;
        dismissMahoraga("fallen");
      }
    };

    const tryMeleeClash = () => {
      const s = state.current;
      if (!s.alive || s.meleeCool > 0 || s.meleeT > 0 || inAnyDomain() || s.infinityT > 0) return;
      const g = s.gojo;
      const k = s.sukuna;
      if (g.dashT > 0) return; // black flash owns this
      const dist = Math.abs(g.x - k.x);
      const vDist = Math.abs(g.yOff - k.yOff);
      if (dist > 50 || vDist > 40) return;

      s.meleeCool = 55;
      s.meleeT = 24;
      g.pose = 24;
      g.cast = "melee";
      k.pose = 24;
      k.cast = "slash";
      g.facing = k.x >= g.x ? 1 : -1;
      k.facing = g.x >= k.x ? 1 : -1;

      // Random close-combat winner — HP & CE nudge the odds
      const gScore = g.hp / g.maxHp * 0.55 + g.energy / 100 * 0.2 + Math.random() * 0.7;
      const kScore = k.hp / k.maxHp * 0.55 + k.energy / 100 * 0.2 + Math.random() * 0.7;
      const gojoWins = gScore >= kScore;
      s.meleeWinner = gojoWins ? "gojo" : "sukuna";

      const mid = (g.x + k.x) / 2;
      const gy = (bodyY("gojo") + bodyY("sukuna")) / 2;
      burst(mid, gy, "#fbbf24", 18, 3.5);
      burst(mid, gy, gojoWins ? "#67e8f9" : "#f87171", 14, 3);
      s.shake = 12;

      if (gojoWins) {
        // Gojo punches Sukuna away
        hurt("sukuna", 9, g.facing * 48);
        k.stun = Math.max(k.stun, 16);
        g.x -= g.facing * 10;
        s.announce = "GOJO WINS CLASH!";
        gainEnergy("gojo", 8);
      } else {
        // Sukuna overpowers Gojo
        hurt("gojo", 9, k.facing * 48);
        g.stun = Math.max(g.stun, 16);
        k.x -= k.facing * 10;
        s.announce = "SUKUNA WINS CLASH!";
        gainEnergy("sukuna", 8);
      }
      s.announceT = 30;
      g.x = Math.max(28, Math.min(s.w - 28, g.x));
      k.x = Math.max(28, Math.min(s.w - 28, k.x));
    };

    const drawGojo = (x: number, y: number) => {
      const s = state.current;
      const g = s.gojo;
      const bob = Math.sin(s.frame / 10) * 1.15;
      const py = y + bob;
      const face = g.facing;
      const flash = g.hitFlash > 0;
      const casting =
        g.cast === "blue" || g.cast === "red" || g.cast === "purple" ||
        g.cast === "domain" || g.cast === "rct" || g.cast === "melee" || g.cast === "blackflash";
      const melee = g.cast === "melee" || g.cast === "blackflash" || s.meleeT > 0;
      const lean = melee ? face * 10 : casting ? face * 6 : Math.sin(s.frame / 18) * 1.2;
      const sc = 1.38;

      if (g.bfSpark > 0 || g.cast === "blackflash") {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const spark = 38 + Math.sin(s.frame / 3) * 8 + g.bfSpark * 0.6;
        const aura = ctx.createRadialGradient(x, py - 6, 2, x, py - 6, spark);
        aura.addColorStop(0, "rgba(251,191,36,0.55)");
        aura.addColorStop(0.25, "rgba(0,0,0,0.85)");
        aura.addColorStop(0.55, "rgba(239,68,68,0.35)");
        aura.addColorStop(1, "transparent");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.ellipse(x, py - 4, spark * 0.75, spark, 0, 0, Math.PI * 2);
        ctx.fill();
        // Distortion sparks
        ctx.strokeStyle = "rgba(251,191,36,0.7)";
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + s.frame * 0.35;
          const r0 = 12 + (i % 2) * 6;
          const r1 = spark * 0.55;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * r0, py - 6 + Math.sin(a) * r0);
          ctx.lineTo(x + Math.cos(a) * r1, py - 6 + Math.sin(a) * r1);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (g.rctFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const pulse = 36 + Math.sin(s.frame / 5) * 5;
        const aura = ctx.createRadialGradient(x, py - 8, 4, x, py - 8, pulse);
        aura.addColorStop(0, "rgba(134,239,172,0.55)");
        aura.addColorStop(0.5, "rgba(74,222,128,0.22)");
        aura.addColorStop(1, "transparent");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.ellipse(x, py - 4, pulse * 0.8, pulse, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (g.invuln > 0 || s.gojoDomainT > 0 || s.infinityT > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const pulse = 42 + Math.sin(s.frame / 8) * 5;
        const aura = ctx.createRadialGradient(x, py - 10, 8, x, py - 10, pulse);
        aura.addColorStop(0, "rgba(165,243,252,0.4)");
        aura.addColorStop(0.55, "rgba(34,211,238,0.18)");
        aura.addColorStop(1, "transparent");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.ellipse(x, py - 6, pulse * 0.85, pulse, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(103,232,249,0.6)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(x, py - 6, pulse * 0.7, pulse * 0.88, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Soft head silhouette glow (blindfold era)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const eg = ctx.createRadialGradient(x, py - 38, 4, x, py - 38, 26);
      eg.addColorStop(0, "rgba(148,163,184,0.12)");
      eg.addColorStop(1, "transparent");
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(x, py - 38, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Ground shadow while flying
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x, ground() + 2, 22 + (ground() - y) * 0.04, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Soft flight aura
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const flyA = ctx.createRadialGradient(x, py + 20, 2, x, py + 20, 28);
      flyA.addColorStop(0, "rgba(165,243,252,0.2)");
      flyA.addColorStop(1, "transparent");
      ctx.fillStyle = flyA;
      ctx.beginPath();
      ctx.ellipse(x, py + 24, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x + lean * 0.4, py);
      ctx.scale(face * sc, sc); // face opponent

      const skin = flash ? "#fca5a5" : "#f0c09a";
      const cloth = flash ? "#fda4af" : "#0b1220";
      const clothHi = flash ? "#fb7185" : "#1e293b";

      // Boots
      ctx.fillStyle = "#020617";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.3;
      roundRect(ctx, -15, 34, 12, 10, 2);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, 3, 34, 12, 10, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#334155";
      ctx.fillRect(-15, 34, 12, 2.5);
      ctx.fillRect(3, 34, 12, 2.5);

      // Legs
      const legG = ctx.createLinearGradient(0, 14, 0, 36);
      legG.addColorStop(0, clothHi);
      legG.addColorStop(1, "#020617");
      ctx.fillStyle = legG;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.4;
      roundRect(ctx, -13, 16, 11, 20, 4);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, 2, 16, 11, 20, 4);
      ctx.fill();
      ctx.stroke();
      // Knee crease
      ctx.strokeStyle = "rgba(148,163,184,0.25)";
      ctx.beginPath();
      ctx.moveTo(-11, 26);
      ctx.lineTo(-4, 26);
      ctx.moveTo(4, 26);
      ctx.lineTo(11, 26);
      ctx.stroke();

      // Torso — slim black Shinjuku jacket
      const body = ctx.createLinearGradient(-18, -18, 16, 18);
      body.addColorStop(0, clothHi);
      body.addColorStop(0.45, cloth);
      body.addColorStop(1, "#000");
      ctx.fillStyle = body;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(-16, -12);
      ctx.quadraticCurveTo(-19, 2, -14, 18);
      ctx.lineTo(14, 18);
      ctx.quadraticCurveTo(19, 2, 16, -12);
      ctx.quadraticCurveTo(0, -18, -16, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Jacket lapels / open collar
      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.moveTo(-11, -12);
      ctx.lineTo(-9, -24);
      ctx.lineTo(-1, -15);
      ctx.lineTo(1, -15);
      ctx.lineTo(9, -24);
      ctx.lineTo(11, -12);
      ctx.lineTo(5, -7);
      ctx.lineTo(0, -13);
      ctx.lineTo(-5, -7);
      ctx.closePath();
      ctx.fill();
      // Chest inner
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.lineTo(0, -16);
      ctx.lineTo(4, -10);
      ctx.lineTo(3, 4);
      ctx.lineTo(-3, 4);
      ctx.closePath();
      ctx.fill();
      // Collar stitch
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-9, -18);
      ctx.lineTo(-3, -12);
      ctx.moveTo(9, -18);
      ctx.lineTo(3, -12);
      ctx.moveTo(-9, -2);
      ctx.lineTo(-7, 14);
      ctx.moveTo(9, -2);
      ctx.lineTo(7, 14);
      ctx.stroke();

      // Belt
      ctx.fillStyle = "#111827";
      roundRect(ctx, -14, 15, 28, 5, 1);
      ctx.fill();
      ctx.fillStyle = "#67e8f9";
      ctx.fillRect(-2, 15.5, 4, 4);

      // Arms
      ctx.fillStyle = cloth;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.35;
      if (melee) {
        // Punching arm forward
        roundRect(ctx, 10, -18, 30, 11, 5);
        ctx.fill();
        ctx.stroke();
        // Fist
        ctx.fillStyle = skin;
        roundRect(ctx, 36, -20, 12, 14, 4);
        ctx.fill();
        ctx.stroke();
        // Back arm
        ctx.fillStyle = cloth;
        roundRect(ctx, -28, 0, 16, 11, 4);
        ctx.fill();
        ctx.stroke();
        // Impact flare
        if (s.meleeT > 8) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const ig = ctx.createRadialGradient(44, -12, 1, 44, -12, 18);
          ig.addColorStop(0, "#fff");
          ig.addColorStop(0.4, s.meleeWinner === "gojo" ? "#67e8f9" : "#f87171");
          ig.addColorStop(1, "transparent");
          ctx.fillStyle = ig;
          ctx.beginPath();
          ctx.arc(44, -12, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (casting) {
        roundRect(ctx, 10, -16, 26, 11, 5);
        ctx.fill();
        ctx.stroke();
        roundRect(ctx, -30, -2, 16, 12, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = skin;
        roundRect(ctx, 32, -18, 10, 12, 3);
        ctx.fill();
        const col =
          g.cast === "blue" ? "#60a5fa" :
          g.cast === "red" ? "#f87171" :
          g.cast === "purple" ? "#e879f9" :
          g.cast === "rct" ? "#4ade80" : "#67e8f9";
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const pg = ctx.createRadialGradient(38, -12, 1, 38, -12, 18);
        pg.addColorStop(0, "#fff");
        pg.addColorStop(0.35, col);
        pg.addColorStop(1, "transparent");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(38, -12, 18, 0, Math.PI * 2);
        ctx.fill();
        if (g.cast === "purple") {
          ctx.strokeStyle = "#c084fc";
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(38, -12, 7 + i * 5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.restore();
      } else {
        roundRect(ctx, -26, -6, 11, 18, 5);
        ctx.fill();
        ctx.stroke();
        roundRect(ctx, 15, -6, 11, 18, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.ellipse(-20, 10, 5, 5.5, 0, 0, Math.PI * 2);
        ctx.ellipse(21, 10, 5, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Neck
      ctx.fillStyle = skin;
      roundRect(ctx, -4, -20, 8, 8, 2);
      ctx.fill();

      // Head — blank face, no features (Six Eyes only)
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(0, -30, 12.5, 13.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // ——— Hair: Gojo white spikes (volume first, then tall spikes) ———
      // Soft under-cap so scalp never shows
      const under = ctx.createLinearGradient(0, -48, 0, -24);
      under.addColorStop(0, "#f8fafc");
      under.addColorStop(1, "#cbd5e1");
      ctx.fillStyle = under;
      ctx.beginPath();
      ctx.ellipse(0, -36, 15, 12, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(14, -28);
      ctx.quadraticCurveTo(0, -26, -14, -28);
      ctx.closePath();
      ctx.fill();

      // Tall back spikes — thick tapered wedges
      const spike = (
        x0: number, y0: number,
        tipX: number, tipY: number,
        x1: number, y1: number,
        col: string,
      ) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo((x0 + tipX) * 0.5 - 1, (y0 + tipY) * 0.5, tipX, tipY);
        ctx.quadraticCurveTo((x1 + tipX) * 0.5 + 1, (y1 + tipY) * 0.5, x1, y1);
        ctx.closePath();
        ctx.fill();
      };
      // Rear row (darker grey-white for depth)
      spike(-14, -34, -18, -52, -6, -36, "#94a3b8");
      spike(-6, -36, -4, -60, 4, -36, "#94a3b8");
      spike(4, -36, 10, -54, 14, -34, "#94a3b8");
      // Mid / hero spikes (bright white)
      spike(-12, -32, -14, -56, -2, -34, "#f1f5f9");
      spike(-4, -34, 0, -64, 6, -34, "#ffffff");
      spike(2, -34, 8, -58, 12, -32, "#f8fafc");
      spike(8, -32, 16, -48, 14, -30, "#e2e8f0");
      // Side tufts
      spike(-15, -30, -22, -42, -10, -28, "#e2e8f0");
      spike(12, -30, 22, -40, 14, -28, "#e2e8f0");

      // Front bangs — soft curved locks over forehead (no jagged zigzags)
      ctx.fillStyle = "#f8fafc";
      // left bang
      ctx.beginPath();
      ctx.moveTo(-11, -34);
      ctx.quadraticCurveTo(-14, -28, -10, -22);
      ctx.quadraticCurveTo(-6, -26, -4, -34);
      ctx.closePath();
      ctx.fill();
      // center-left
      ctx.beginPath();
      ctx.moveTo(-5, -36);
      ctx.quadraticCurveTo(-4, -26, 0, -23);
      ctx.quadraticCurveTo(2, -28, 2, -36);
      ctx.closePath();
      ctx.fill();
      // center-right
      ctx.beginPath();
      ctx.moveTo(1, -36);
      ctx.quadraticCurveTo(3, -26, 6, -24);
      ctx.quadraticCurveTo(8, -30, 7, -36);
      ctx.closePath();
      ctx.fill();
      // right bang
      ctx.beginPath();
      ctx.moveTo(6, -34);
      ctx.quadraticCurveTo(12, -28, 11, -22);
      ctx.quadraticCurveTo(14, -30, 12, -34);
      ctx.closePath();
      ctx.fill();

      // Soft highlight on tallest spike
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-1, -58);
      ctx.lineTo(0, -42);
      ctx.stroke();

      // Black blindfold / eye patch — no eyes
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.moveTo(-13, -34);
      ctx.lineTo(13, -34);
      ctx.lineTo(14, -24);
      ctx.lineTo(-14, -24);
      ctx.closePath();
      ctx.fill();
      // Wrap ties
      ctx.fillRect(-16, -32, 3.5, 7);
      ctx.fillRect(12.5, -32, 3.5, 7);
      // Fabric fold highlight
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-11, -32.5);
      ctx.lineTo(11, -32.5);
      ctx.moveTo(-11, -25.5);
      ctx.lineTo(11, -25.5);
      ctx.stroke();

      ctx.restore();
    };

    const drawSukuna = (x: number, y: number) => {
      const s = state.current;
      const k = s.sukuna;
      const bob = Math.sin(s.frame / 9 + 1) * 1.2;
      const py = y + bob;
      const face = k.facing;
      const flash = k.hitFlash > 0;
      const casting = k.cast === "slash" || k.cast === "domain";
      const lean = casting ? face * 8 : Math.sin(s.frame / 16) * 1.5;
      const sc = 1.28;

      // Curse aura
      if (s.sukunaDomainT > 0 || casting) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const pulse = 36 + Math.sin(s.frame / 7) * 5;
        const aura = ctx.createRadialGradient(x, py - 6, 6, x, py - 6, pulse);
        aura.addColorStop(0, "rgba(248,113,113,0.4)");
        aura.addColorStop(0.5, "rgba(185,28,28,0.2)");
        aura.addColorStop(1, "transparent");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.ellipse(x, py - 2, pulse * 0.8, pulse, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x, ground() + 2, 20 + (ground() - y) * 0.04, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const flyK = ctx.createRadialGradient(x, py + 22, 2, x, py + 22, 26);
      flyK.addColorStop(0, "rgba(248,113,113,0.22)");
      flyK.addColorStop(1, "transparent");
      ctx.fillStyle = flyK;
      ctx.beginPath();
      ctx.ellipse(x, py + 26, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x + lean, py);
      ctx.scale(sc, sc);

      // Feet wraps
      ctx.fillStyle = "#1c1917";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.2;
      roundRect(ctx, -15, 33, 12, 10, 2);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, 3, 33, 12, 10, 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#44403c";
      ctx.beginPath();
      ctx.moveTo(-14, 36);
      ctx.lineTo(-4, 36);
      ctx.moveTo(4, 36);
      ctx.lineTo(14, 36);
      ctx.stroke();

      // Legs
      const legG = ctx.createLinearGradient(0, 12, 0, 34);
      legG.addColorStop(0, flash ? "#fecaca" : "#44403c");
      legG.addColorStop(1, flash ? "#b91c1c" : "#1c1917");
      ctx.fillStyle = legG;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.3;
      roundRect(ctx, -13, 14, 11, 20, 4);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, 2, 14, 11, 20, 4);
      ctx.fill();
      ctx.stroke();

      // Open kimono panels — white with black trim
      ctx.fillStyle = flash ? "#fecaca" : "#fafaf9";
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 2;
      // Left
      ctx.beginPath();
      ctx.moveTo(-3, -14);
      ctx.lineTo(-20, -10);
      ctx.lineTo(-19, 18);
      ctx.lineTo(-1, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Right
      ctx.beginPath();
      ctx.moveTo(3, -14);
      ctx.lineTo(20, -10);
      ctx.lineTo(19, 18);
      ctx.lineTo(1, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Black kimono trim
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-3, -14);
      ctx.lineTo(-19, -10);
      ctx.moveTo(3, -14);
      ctx.lineTo(19, -10);
      ctx.stroke();

      // Bare chest
      const chest = flash ? "#fca5a5" : "#e8b896";
      ctx.fillStyle = chest;
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.lineTo(6, -12);
      ctx.lineTo(7, 14);
      ctx.lineTo(-7, 14);
      ctx.closePath();
      ctx.fill();
      // Abs
      ctx.strokeStyle = "rgba(120,53,15,0.45)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, 12);
      ctx.moveTo(-5, -2);
      ctx.lineTo(5, -2);
      ctx.moveTo(-5, 3);
      ctx.lineTo(5, 3);
      ctx.moveTo(-4, 8);
      ctx.lineTo(4, 8);
      ctx.stroke();
      // Black curse tattoos on torso
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.lineTo(-6, 4);
      ctx.lineTo(-3, 10);
      ctx.moveTo(4, -10);
      ctx.lineTo(6, 4);
      ctx.lineTo(3, 10);
      ctx.moveTo(-5, -4);
      ctx.lineTo(-8, 2);
      ctx.moveTo(5, -4);
      ctx.lineTo(8, 2);
      ctx.stroke();

      // Obi sash
      const obi = ctx.createLinearGradient(0, 12, 0, 20);
      obi.addColorStop(0, "#57534e");
      obi.addColorStop(1, "#1c1917");
      ctx.fillStyle = obi;
      roundRect(ctx, -18, 13, 36, 8, 2);
      ctx.fill();
      ctx.fillStyle = "#0a0a0a";
      roundRect(ctx, -5, 13, 10, 8, 2);
      ctx.fill();

      // Arms — tattooed
      ctx.fillStyle = flash ? "#fca5a5" : "#e8b896";
      ctx.strokeStyle = "#9a3412";
      ctx.lineWidth = 1.2;
      if (casting) {
        const lx = face > 0 ? 10 : -34;
        const tx = face > 0 ? -30 : 12;
        roundRect(ctx, lx, -16, 26, 12, 5);
        ctx.fill();
        ctx.stroke();
        roundRect(ctx, tx, 0, 18, 12, 5);
        ctx.fill();
        ctx.stroke();
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "#fecaca";
        ctx.lineWidth = 2.4;
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 10;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(face * 32, -12 + i * 5);
          ctx.lineTo(face * 58, -4 + i * 10);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        roundRect(ctx, -28, -6, 12, 18, 5);
        ctx.fill();
        ctx.stroke();
        roundRect(ctx, 16, -6, 12, 18, 5);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#1c1917";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-24, -2);
        ctx.lineTo(-20, 8);
        ctx.moveTo(-22, 2);
        ctx.lineTo(-26, 6);
        ctx.moveTo(24, -2);
        ctx.lineTo(20, 8);
        ctx.moveTo(22, 2);
        ctx.lineTo(26, 6);
        ctx.stroke();
      }

      // Neck
      ctx.fillStyle = flash ? "#fca5a5" : "#e8b896";
      roundRect(ctx, -5, -18, 10, 8, 2);
      ctx.fill();

      // Head
      ctx.fillStyle = flash ? "#fca5a5" : "#e8b896";
      ctx.strokeStyle = "#9a3412";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, -28, 13, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pink spiky hair
      const pinkG = ctx.createLinearGradient(0, -54, 0, -22);
      pinkG.addColorStop(0, "#fda4af");
      pinkG.addColorStop(0.5, "#fb7185");
      pinkG.addColorStop(1, "#be123c");
      ctx.fillStyle = pinkG;
      ctx.strokeStyle = "#9f1239";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-14, -24);
      const pink: [number, number][] = [
        [-18, -40],
        [-10, -48],
        [-4, -54],
        [2, -48],
        [8, -56],
        [14, -46],
        [19, -36],
        [15, -26],
      ];
      for (const [px, pty] of pink) ctx.lineTo(px, pty);
      ctx.lineTo(14, -24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Dark under-spikes
      ctx.fillStyle = "#9f1239";
      ctx.beginPath();
      ctx.moveTo(-6, -28);
      ctx.lineTo(-3, -44);
      ctx.lineTo(1, -30);
      ctx.lineTo(5, -46);
      ctx.lineTo(8, -28);
      ctx.fill();

      // Four eyes — signature
      const drawEye = (ex: number, ey: number) => {
        ctx.fillStyle = "#fef2f2";
        ctx.beginPath();
        ctx.ellipse(ex, ey, 3.6, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#7f1d1d";
        ctx.beginPath();
        ctx.ellipse(ex, ey, 1.6, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fef2f2";
        ctx.beginPath();
        ctx.arc(ex - 0.6, ey - 0.6, 0.7, 0, Math.PI * 2);
        ctx.fill();
      };
      drawEye(-5.5, -31);
      drawEye(5.5, -31);
      drawEye(-5.5, -23);
      drawEye(5.5, -23);
      // Black rings around eyes
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(-5.5, -31, 4.4, 3.4, 0, 0, Math.PI * 2);
      ctx.ellipse(5.5, -31, 4.4, 3.4, 0, 0, Math.PI * 2);
      ctx.ellipse(-5.5, -23, 4.4, 3.4, 0, 0, Math.PI * 2);
      ctx.ellipse(5.5, -23, 4.4, 3.4, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Face tattoos — classic bars
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-11, -18);
      ctx.lineTo(-2, -16);
      ctx.moveTo(11, -18);
      ctx.lineTo(2, -16);
      ctx.moveTo(0, -20);
      ctx.lineTo(0, -12);
      ctx.moveTo(-8, -14);
      ctx.lineTo(-8, -9);
      ctx.moveTo(8, -14);
      ctx.lineTo(8, -9);
      ctx.stroke();

      // Wicked grin
      ctx.strokeStyle = "#7f1d1d";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.quadraticCurveTo(0, -6, 6, -12);
      ctx.stroke();
      // Teeth hint
      ctx.strokeStyle = "rgba(254,226,226,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, -10);
      ctx.lineTo(-3, -8);
      ctx.moveTo(0, -9);
      ctx.lineTo(0, -7);
      ctx.moveTo(3, -10);
      ctx.lineTo(3, -8);
      ctx.stroke();

      ctx.restore();
    };


    const drawMahoragaEntrance = (x: number, y: number) => {
      const s = state.current;
      const m = s.mahoraga;
      if (!m.active || m.enterT <= 0) return;
      const t = m.enterT;
      const max = m.enterMax || 96;
      const p = 1 - t / max; // 0 → 1 progress
      const gnd = ground();

      ctx.save();
      // Darkening veil over battlefield
      const veilA = Math.min(0.55, p < 0.35 ? p * 1.4 : (1 - p) * 0.9 + 0.25);
      ctx.fillStyle = `rgba(12,10,9,${veilA * 0.65})`;
      ctx.fillRect(0, 0, s.w, s.h);

      // Ritual ring on ground
      const ringR = 28 + p * 55 + Math.sin(s.frame / 4) * 3;
      ctx.save();
      ctx.translate(x, gnd + 2);
      ctx.globalCompositeOperation = "lighter";
      const ringGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, ringR);
      ringGrad.addColorStop(0, `rgba(251,191,36,${0.45 + p * 0.3})`);
      ringGrad.addColorStop(0.45, `rgba(120,113,108,${0.25})`);
      ringGrad.addColorStop(0.85, `rgba(251,191,36,${0.35})`);
      ringGrad.addColorStop(1, "transparent");
      ctx.fillStyle = ringGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, ringR, ringR * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(251,191,36,${0.5 + p * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, ringR * 0.92, ringR * 0.26, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Runes / ticks around ring
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + s.frame * 0.04;
        const rx = Math.cos(a) * ringR * 0.85;
        const ry = Math.sin(a) * ringR * 0.24;
        ctx.fillStyle = i % 2 === 0 ? "#fbbf24" : "#e7e5e4";
        ctx.beginPath();
        ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Ground cracks radiating outward
      if (p > 0.2) {
        ctx.strokeStyle = `rgba(28,25,23,${0.55 + p * 0.35})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.2;
          const len = 30 + p * 70 + (i % 3) * 10;
          ctx.beginPath();
          ctx.moveTo(x, gnd);
          ctx.lineTo(x + Math.cos(a) * len, gnd + Math.sin(a) * 8 + (i % 2) * 4);
          ctx.stroke();
        }
      }

      // Column of light / curse from sky
      if (p > 0.15) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const colH = 40 + p * (y - 20);
        const col = ctx.createLinearGradient(x, y - colH, x, gnd);
        col.addColorStop(0, "rgba(251,191,36,0)");
        col.addColorStop(0.4, `rgba(231,229,228,${0.15 + p * 0.25})`);
        col.addColorStop(0.85, `rgba(251,191,36,${0.35 + p * 0.3})`);
        col.addColorStop(1, "rgba(120,113,108,0.1)");
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x - 18 - p * 10, y - colH);
        ctx.lineTo(x + 18 + p * 10, y - colH);
        ctx.lineTo(x + 36 + p * 20, gnd);
        ctx.lineTo(x - 36 - p * 20, gnd);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Floating wheel descending before body
      if (p > 0.25 && p < 0.85) {
        const wp = (p - 0.25) / 0.6;
        const wy = (y - 120) + wp * 90;
        const spin = s.frame * 0.18 + wp * 6;
        ctx.save();
        ctx.translate(x, wy);
        ctx.rotate(spin);
        ctx.globalAlpha = Math.min(1, wp * 2);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#e7e5e4";
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
          ctx.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Impact shockwave near end
      if (p > 0.72) {
        const ip = (p - 0.72) / 0.28;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(251,191,36,${1 - ip})`;
        ctx.lineWidth = 4 - ip * 2;
        ctx.beginPath();
        ctx.ellipse(x, gnd, 40 + ip * 120, 10 + ip * 28, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(231,229,228,${0.7 - ip * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, gnd, 20 + ip * 90, 6 + ip * 18, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    };

    const drawMahoraga = (x: number, y: number) => {
      const s = state.current;
      const m = s.mahoraga;
      if (!m.active) return;
      const entering = m.enterT > 0;
      const enterP = entering ? 1 - m.enterT / (m.enterMax || 96) : 1;
      // Body only fully visible in latter half of entrance
      const bodyVis = entering ? Math.max(0, (enterP - 0.45) / 0.55) : 1;
      if (bodyVis <= 0.02) return;

      const bob = entering ? 0 : Math.sin(s.frame / 11) * 1.4;
      const rise = entering ? (1 - bodyVis) * 50 : 0;
      const py = y + bob + rise;
      const face = m.facing;
      const flash = m.hitFlash > 0;
      const swing = m.swingT > 0;
      const sc = 1.45 * (0.55 + bodyVis * 0.45);

      ctx.save();
      ctx.globalAlpha = Math.min(1, bodyVis * 1.15);

      // Shadow
      ctx.fillStyle = `rgba(0,0,0,${0.4 * bodyVis})`;
      ctx.beginPath();
      ctx.ellipse(x, ground() + 2, 26 + (ground() - y) * 0.05, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Curse / adaptation aura
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const auraR = 48 + Math.sin(s.frame / 6) * 6 + (m.adapted ? 10 : 0) + (entering ? 20 : 0);
      const aura = ctx.createRadialGradient(x, py - 10, 8, x, py - 10, auraR);
      aura.addColorStop(0, m.adapted ? "rgba(251,191,36,0.35)" : entering ? "rgba(251,191,36,0.4)" : "rgba(231,229,228,0.25)");
      aura.addColorStop(0.55, "rgba(120,113,108,0.15)");
      aura.addColorStop(1, "transparent");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(x, py - 4, auraR * 0.75, auraR, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x, py);
      ctx.scale(face, 1);
      ctx.scale(sc, sc);

      // Legs — muscular white
      const skin = flash ? "#fecaca" : "#f5f5f4";
      const skinDeep = flash ? "#f87171" : "#d6d3d1";
      ctx.fillStyle = skin;
      ctx.strokeStyle = "#57534e";
      ctx.lineWidth = 1.4;
      roundRect(ctx, -16, 18, 13, 26, 4);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, 3, 18, 13, 26, 4);
      ctx.fill();
      ctx.stroke();
      // Knee wraps
      ctx.fillStyle = "#292524";
      roundRect(ctx, -17, 28, 14, 6, 2);
      ctx.fill();
      roundRect(ctx, 3, 28, 14, 6, 2);
      ctx.fill();
      // Feet
      ctx.fillStyle = "#1c1917";
      roundRect(ctx, -17, 40, 14, 8, 2);
      ctx.fill();
      roundRect(ctx, 3, 40, 14, 8, 2);
      ctx.fill();

      // Torso — hulking white with black markings
      const torso = ctx.createLinearGradient(0, -18, 0, 22);
      torso.addColorStop(0, skin);
      torso.addColorStop(1, skinDeep);
      ctx.fillStyle = torso;
      ctx.strokeStyle = "#44403c";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-18, -16);
      ctx.lineTo(18, -16);
      ctx.lineTo(20, 8);
      ctx.lineTo(14, 22);
      ctx.lineTo(-14, 22);
      ctx.lineTo(-20, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Black tribal marks
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-10, -12);
      ctx.lineTo(-14, 6);
      ctx.lineTo(-8, 16);
      ctx.moveTo(10, -12);
      ctx.lineTo(14, 6);
      ctx.lineTo(8, 16);
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 14);
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.stroke();
      // Abs
      ctx.strokeStyle = "rgba(68,64,60,0.45)";
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-8, 2 + i * 5);
        ctx.lineTo(8, 2 + i * 5);
        ctx.stroke();
      }

      // Belt / loin
      ctx.fillStyle = "#1c1917";
      roundRect(ctx, -16, 18, 32, 8, 2);
      ctx.fill();
      ctx.fillStyle = "#78716c";
      roundRect(ctx, -4, 18, 8, 8, 2);
      ctx.fill();

      // Back arm
      ctx.fillStyle = skin;
      ctx.strokeStyle = "#57534e";
      ctx.lineWidth = 1.3;
      roundRect(ctx, -30, -10, 14, 22, 5);
      ctx.fill();
      ctx.stroke();

      // Sword arm — forward swing
      ctx.save();
      const ang = swing ? -0.9 + (1 - m.swingT / 16) * 1.6 : -0.25;
      ctx.translate(16, -6);
      ctx.rotate(ang);
      // Arm
      ctx.fillStyle = skin;
      roundRect(ctx, 0, -6, 28, 12, 5);
      ctx.fill();
      ctx.stroke();
      // Sword — long curved blade
      ctx.fillStyle = "#e7e5e4";
      ctx.strokeStyle = "#a8a29e";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(26, -2);
      ctx.lineTo(78, -8);
      ctx.lineTo(82, -2);
      ctx.lineTo(78, 4);
      ctx.lineTo(26, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Blade edge glow
      ctx.strokeStyle = m.adapted ? "#fbbf24" : "#fafaf9";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(30, -4);
      ctx.lineTo(80, -5);
      ctx.stroke();
      // Hilt wrap
      ctx.fillStyle = "#292524";
      roundRect(ctx, 20, -5, 10, 10, 2);
      ctx.fill();
      if (swing) {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(251,191,36,0.55)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(40, 0, 36, -1.2, 0.4);
        ctx.stroke();
      }
      ctx.restore();

      // Fingers / fist detail on back hand
      ctx.fillStyle = skinDeep;
      ctx.beginPath();
      ctx.arc(-28, 12, 5, 0, Math.PI * 2);
      ctx.fill();

      // Neck
      ctx.fillStyle = skin;
      roundRect(ctx, -6, -24, 12, 10, 3);
      ctx.fill();

      // Head — jawed, fierce
      ctx.fillStyle = flash ? "#fecaca" : skin;
      ctx.strokeStyle = "#44403c";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, -36, 14, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Jaw
      ctx.beginPath();
      ctx.moveTo(-10, -28);
      ctx.lineTo(-8, -18);
      ctx.lineTo(8, -18);
      ctx.lineTo(10, -28);
      ctx.fill();
      // Mouth fangs
      ctx.fillStyle = "#fafaf9";
      ctx.beginPath();
      ctx.moveTo(-5, -22);
      ctx.lineTo(-3, -16);
      ctx.lineTo(-1, -22);
      ctx.moveTo(1, -22);
      ctx.lineTo(3, -16);
      ctx.lineTo(5, -22);
      ctx.fill();
      // Eyes — glowing gold when adapted
      const eyeCol = m.adapted ? "#fbbf24" : "#0c0a09";
      ctx.fillStyle = "#fafaf9";
      ctx.beginPath();
      ctx.ellipse(-5.5, -38, 4, 3.2, 0, 0, Math.PI * 2);
      ctx.ellipse(5.5, -38, 4, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = eyeCol;
      ctx.beginPath();
      ctx.ellipse(-5.5, -38, 2, 2.4, 0, 0, Math.PI * 2);
      ctx.ellipse(5.5, -38, 2, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Brow marks
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -44);
      ctx.lineTo(-2, -42);
      ctx.moveTo(10, -44);
      ctx.lineTo(2, -42);
      ctx.stroke();

      // ——— THE WHEEL ———
      ctx.save();
      ctx.translate(0, -58);
      ctx.rotate(m.wheelSpin + s.frame * 0.02);
      // Outer rim
      ctx.strokeStyle = "#292524";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = m.adapted ? "#fbbf24" : "#a8a29e";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
      // Inner disc
      ctx.fillStyle = "#44403c";
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = m.adapted ? "#f59e0b" : "#78716c";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      // Eight handles
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x0 = Math.cos(a) * 12;
        const y0 = Math.sin(a) * 12;
        const x1 = Math.cos(a) * 28;
        const y1 = Math.sin(a) * 28;
        ctx.strokeStyle = "#1c1917";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.fillStyle = i % 2 === 0 ? "#e7e5e4" : "#a8a29e";
        ctx.beginPath();
        ctx.arc(x1, y1, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#292524";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      ctx.restore();

      // Nameplate (after fully manifested)
      if (!entering || bodyVis > 0.85) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(ctx, x - 36, py - 92, 72, 14, 3);
        ctx.fill();
        ctx.fillStyle = m.adapted ? "#fbbf24" : "#e7e5e4";
        ctx.font = "700 9px Bangers, Impact, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(m.adapted ? "ADAPTED" : "MAHORAGA", x, py - 82);
        ctx.textAlign = "left";
        // Mini HP
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        roundRect(ctx, x - 30, py - 76, 60, 5, 2);
        ctx.fill();
        ctx.fillStyle = "#a8a29e";
        roundRect(ctx, x - 30, py - 76, 60 * (m.hp / m.maxHp), 5, 2);
        ctx.fill();
      }
      ctx.restore(); // entrance alpha
    };

    const drawInfinityDomain = (cx: number, cy: number) => {
      const s = state.current;
      const t = s.frame;
      ctx.save();

      // Deep void wash
      const veil = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy - 20, Math.max(s.w, s.h) * 0.85);
      veil.addColorStop(0, "rgba(8,47,73,0.1)");
      veil.addColorStop(0.35, "rgba(6,182,212,0.22)");
      veil.addColorStop(0.7, "rgba(8,145,178,0.4)");
      veil.addColorStop(1, "rgba(2,6,23,0.72)");
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, s.w, s.h);

      // Perspective lattice — Unlimited Void grid
      ctx.save();
      ctx.strokeStyle = "rgba(165,243,252,0.14)";
      ctx.lineWidth = 1;
      for (let i = -8; i <= 8; i++) {
        const ox = Math.sin(t / 60 + i) * 8;
        ctx.beginPath();
        ctx.moveTo(cx + i * 42 + ox, 0);
        ctx.lineTo(cx + i * 55 + ox * 2, s.h);
        ctx.stroke();
      }
      for (let i = -6; i <= 10; i++) {
        const yy = cy - 120 + i * 36 + (t % 36);
        ctx.globalAlpha = 0.08 + ((i + 6) % 5) * 0.02;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(s.w, yy + 18);
        ctx.stroke();
      }
      ctx.restore();

      // Floating information cubes — dense cloud
      for (let i = 0; i < 28; i++) {
        const a = t / 35 + i * 0.55;
        const r = 45 + (i % 7) * 32;
        const bx = cx + Math.cos(a) * r * (0.7 + (i % 3) * 0.2);
        const by = cy - 30 + Math.sin(a * 1.4 + i) * (r * 0.5);
        const sz = 3 + (i % 4) * 2.5;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a + i);
        ctx.globalAlpha = 0.3 + (i % 4) * 0.12;
        ctx.strokeStyle = i % 2 === 0 ? "#67e8f9" : "#a5f3fc";
        ctx.fillStyle = "rgba(103,232,249,0.08)";
        ctx.lineWidth = 1.4;
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
        ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
        // Inner diamond
        if (i % 3 === 0) {
          ctx.beginPath();
          ctx.moveTo(0, -sz * 0.6);
          ctx.lineTo(sz * 0.6, 0);
          ctx.lineTo(0, sz * 0.6);
          ctx.lineTo(-sz * 0.6, 0);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }

      // Soft cyan dust motes
      ctx.fillStyle = "rgba(165,243,252,0.45)";
      for (let i = 0; i < 40; i++) {
        const px = ((cx + Math.sin(t / 20 + i * 1.7) * 180 + i * 37) % s.w + s.w) % s.w;
        const py = ((cy + Math.cos(t / 25 + i) * 100 + i * 29) % s.h + s.h) % s.h;
        ctx.globalAlpha = 0.2 + (i % 5) * 0.1;
        ctx.beginPath();
        ctx.arc(px, py, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Core infinity under Gojo
      ctx.save();
      ctx.translate(cx, cy + 8);
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 22;
      ctx.strokeStyle = "rgba(165,243,252,0.85)";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(-18, 0, 18, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(18, 0, 18, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Expanding rings
      for (let i = 0; i < 4; i++) {
        const pulse = 35 + i * 32 + ((t * 1.5) % 48);
        ctx.globalAlpha = Math.max(0, 0.4 - i * 0.08 - (pulse % 48) / 120);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -24, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Domain Expansion label glow at top
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(t / 10) * 0.15;
      ctx.fillStyle = "#67e8f9";
      ctx.font = `700 ${Math.round(14 * hudScale(s.w))}px Bangers, Impact, sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 12;
      ctx.fillText("無量空処  ·  UNLIMITED VOID", s.w / 2, 28);
      ctx.restore();

      ctx.restore();
    };

    const drawMalevolentShrine = (cx: number, cy: number) => {
      const s = state.current;
      const t = s.frame;
      ctx.save();

      // Blood mist veil
      const mist = ctx.createRadialGradient(cx, cy - 50, 8, cx, cy - 50, Math.max(s.w, s.h) * 0.8);
      mist.addColorStop(0, "rgba(127,29,29,0.2)");
      mist.addColorStop(0.4, "rgba(69,10,10,0.45)");
      mist.addColorStop(0.75, "rgba(28,7,7,0.6)");
      mist.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, s.w, s.h);

      // Dismantle range rings
      ctx.strokeStyle = "rgba(248,113,113,0.45)";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 120 + Math.sin(t / 10) * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(254,202,202,0.2)";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 155, 0, Math.PI * 2);
      ctx.stroke();

      // Shrine building — proper layered Japanese roof + horns
      const drawShrine = (sx: number, sy: number, sc = 1, glow = false) => {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(sc, sc);
        if (glow) {
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 18;
        }
        // Platform
        ctx.fillStyle = "#1c0707";
        ctx.fillRect(-34, 28, 68, 12);
        ctx.fillStyle = "#450a0a";
        ctx.fillRect(-30, 26, 60, 4);
        // Pillars
        ctx.fillStyle = "#7f1d1d";
        ctx.fillRect(-24, -6, 9, 34);
        ctx.fillRect(15, -6, 9, 34);
        // Gold bands on pillars
        ctx.fillStyle = "#a16207";
        ctx.fillRect(-24, 4, 9, 3);
        ctx.fillRect(15, 4, 9, 3);
        // Body
        const bodyG = ctx.createLinearGradient(0, -8, 0, 28);
        bodyG.addColorStop(0, "#b91c1c");
        bodyG.addColorStop(1, "#450a0a");
        ctx.fillStyle = bodyG;
        ctx.fillRect(-20, -4, 40, 32);
        // Door void
        ctx.fillStyle = "#0a0000";
        ctx.fillRect(-9, 6, 18, 22);
        // Skull on door
        ctx.fillStyle = "#fafaf9";
        ctx.beginPath();
        ctx.arc(0, 14, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#7f1d1d";
        ctx.beginPath();
        ctx.arc(-2.2, 13, 1.4, 0, Math.PI * 2);
        ctx.arc(2.2, 13, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-1.5, 17, 3, 2);
        // Lower roof
        ctx.fillStyle = "#fafaf9";
        ctx.beginPath();
        ctx.moveTo(-38, -2);
        ctx.lineTo(0, -26);
        ctx.lineTo(38, -2);
        ctx.lineTo(28, 2);
        ctx.lineTo(-28, 2);
        ctx.closePath();
        ctx.fill();
        // Upper roof
        ctx.fillStyle = "#e7e5e4";
        ctx.beginPath();
        ctx.moveTo(-26, -18);
        ctx.lineTo(0, -42);
        ctx.lineTo(26, -18);
        ctx.lineTo(18, -14);
        ctx.lineTo(-18, -14);
        ctx.closePath();
        ctx.fill();
        // Horn tips
        ctx.strokeStyle = "#fafaf9";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-34, -6);
        ctx.lineTo(-46, -22);
        ctx.lineTo(-40, -10);
        ctx.moveTo(34, -6);
        ctx.lineTo(46, -22);
        ctx.lineTo(40, -10);
        ctx.stroke();
        // Roof ridge glow
        ctx.strokeStyle = "rgba(248,113,113,0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-20, -20);
        ctx.lineTo(0, -40);
        ctx.lineTo(20, -20);
        ctx.stroke();
        ctx.restore();
      };

      drawShrine(cx, cy - 62, 1.25, true);
      drawShrine(cx - 100, cy - 28, 0.72, false);
      drawShrine(cx + 100, cy - 28, 0.72, false);
      drawShrine(cx - 55, cy - 8, 0.48, false);
      drawShrine(cx + 55, cy - 8, 0.48, false);

      // Flying cleave marks — Malevolent Shrine signature
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 12;
      for (let i = 0; i < 14; i++) {
        const yy = 40 + ((t * 3 + i * 55) % (s.h - 60));
        const x0 = ((t * 10 + i * 97) % (s.w + 100)) - 50;
        const slant = i % 2 === 0 ? 18 : -18;
        ctx.strokeStyle = i % 3 === 0 ? "rgba(254,226,226,0.7)" : "rgba(248,113,113,0.5)";
        ctx.lineWidth = i % 4 === 0 ? 3.5 : 2;
        ctx.beginPath();
        ctx.moveTo(x0, yy);
        ctx.lineTo(x0 + 80, yy + slant);
        ctx.stroke();
      }
      ctx.restore();

      // Label
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(t / 9) * 0.15;
      ctx.fillStyle = "#fecaca";
      ctx.font = `700 ${Math.round(14 * hudScale(s.w))}px Bangers, Impact, sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 12;
      ctx.fillText("伏魔御廚子  ·  MALEVOLENT SHRINE", s.w / 2, 28);
      ctx.restore();

      ctx.restore();
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      const gY = ground();
      if (s.announceT > 0) s.announceT--;
      s.shake *= 0.86;

      const g = s.gojo;
      const k = s.sukuna;
      if (g.cool > 0) g.cool--;
      if (k.cool > 0) k.cool--;
      if (g.hitFlash > 0) g.hitFlash--;
      if (g.rctFlash > 0) g.rctFlash--;
      if (k.hitFlash > 0) k.hitFlash--;
      if (g.stun > 0) g.stun--;
      if (k.stun > 0) k.stun--;
      if (g.invuln > 0) g.invuln--;
      if (s.meleeCool > 0) s.meleeCool--;
      if (s.meleeT > 0) {
        s.meleeT--;
        if (s.meleeT === 0) s.meleeWinner = "";
      }
      if (g.pose > 0) {
        g.pose--;
        if (g.pose === 0) g.cast = "";
      }
      if (k.pose > 0) {
        k.pose--;
        if (k.pose === 0) k.cast = "";
      }
      if (g.dashCool > 0) g.dashCool--;
      if (g.bfSpark > 0) g.bfSpark--;
      if (s.bfFlashT > 0) s.bfFlashT--;
      if (g.dashT > 0) {
        g.dashT--;
        // Homing lunge toward Sukuna during Black Flash
        const dx = k.x - g.x;
        if (Math.abs(dx) > 8) g.facing = dx > 0 ? 1 : -1;
        g.x += g.facing * 13.5;
        // Mild vertical track so BF connects in the air
        g.yOff += (k.yOff - g.yOff) * 0.18;
        g.x = Math.max(28, Math.min(s.w - 28, g.x));
        if (s.frame % 2 === 0) {
          burst(g.x - g.facing * 14, bodyY("gojo"), "#0a0a0a", 5, 2.6);
          burst(g.x - g.facing * 8, bodyY("gojo") - 10, "#fbbf24", 3, 2);
          burst(g.x - g.facing * 6, bodyY("gojo") + 6, "#ef4444", 2, 1.6);
        }
      }

      if (s.infinityT > 0) {
        s.infinityT--;
        g.invuln = Math.max(g.invuln, 2);
        const gy = bodyY("gojo");
        // Absolute block — erase EVERY Sukuna attack on the field
        for (const p of s.projs) {
          if (p.from !== "sukuna" || p.life <= 0) continue;
          burst(p.x, p.y, "#ffffff", 5, 2);
          burst(p.x, p.y, "#a5f3fc", 4, 1.6);
          p.life = 0;
        }
        // Soft keep-away so bodies don't overlap (no damage)
        if (Math.abs(k.x - g.x) < 58 && Math.abs(k.yOff - g.yOff) < 52) {
          const pushDir = k.x >= g.x ? 1 : -1;
          k.x += pushDir * 2.6;
          k.x = Math.max(28, Math.min(s.w - 28, k.x));
        }
        // Mahoraga cannot exist while Infinity is up
        if (s.mahoraga.active) {
          dismissMahoraga("vanish");
          if (s.announceT <= 8) {
            s.announce = "INFINITY — MAHORAGA DENIED";
            s.announceT = 32;
          }
        }
        if (s.frame % 6 === 0) {
          burst(g.x + (Math.random() - 0.5) * 44, gy + (Math.random() - 0.5) * 44, "#e0f2fe", 3, 1.8);
          burst(g.x + (Math.random() - 0.5) * 30, gy + (Math.random() - 0.5) * 30, "#ffffff", 2, 1.4);
        }
        if (s.infinityT === 0) {
          releaseInfinity();
        }
      }
      if (s.flashT > 0) s.flashT--;

      if (s.gojoDomainT > 0) {
        s.gojoDomainT--;
        // Absolute Infinity domain — field pressure (cannot finish)
        if (s.frame % 12 === 0 && k.hp > 1) hurt("sukuna", 2, 0, { fromDomain: true });
        if (s.gojoDomainT === 0) {
          g.invuln = 0;
          s.announce = "ABSOLUTE INFINITY FADED";
          s.announceT = 30;
        }
      }
      if (s.sukunaDomainWind > 0) {
        s.sukunaDomainWind--;
        // Pulse telegraph while charging
        if (s.frame % 10 === 0) burst(k.x, gY - 40, "#fca5a5", 6, 2);
        if (s.sukunaDomainWind === 30) {
          s.announce = "DOMAIN EXPANSION…";
          s.announceT = 28;
        }
        if (s.sukunaDomainWind === 0) {
          castMalevolentShrine();
        }
      }
      if (s.sukunaDomainT > 0) {
        s.sukunaDomainT--;
        // Malevolent Shrine — omnidirectional slashes (non-lethal)
        if (s.frame % 10 === 0) {
          const side = Math.random() < 0.5 ? -1 : 1;
          s.projs.push({
            x: g.x + side * (70 + Math.random() * 40),
            y: bodyY("gojo"),
            vx: -side * 7,
            vy: 0,
            life: 28,
            kind: "dismantle",
            dmg: 5,
            r: 14,
            from: "sukuna",
            fromDomain: true,
            waveH: 130,
          });
        }
        if (s.sukunaDomainT === 0) {
          s.announce = "SHRINE CLOSED";
          s.announceT = 30;
        }
      }

      // Auto support every 8s — alternates RCT ↔ Infinity
      if (s.alive) {
        s.rctAuto--;
        if (s.rctAuto <= 0) {
          s.rctAuto = 8 * 60;
          runAutoSupport();
        }
      }

      if (s.alive) {
        // Player flight movement
        const maxFly = gY + s.h * 0.85;
        const minFly = 20;
        let gojoFlew = false;
        if (g.stun <= 0) {
          if (g.dashT <= 0) {
            let mx = 0;
            if (keys.current.left) mx -= 1;
            if (keys.current.right) mx += 1;
            g.vx = mx * 3.4;
            g.x += g.vx;
            g.x = Math.max(28, Math.min(s.w - 28, g.x));
            if (mx !== 0) g.facing = mx > 0 ? 1 : -1;
            else g.facing = k.x >= g.x ? 1 : -1;
          }
          // Climb past the top of the screen — into the sky
          if (keys.current.up) {
            g.yOff = Math.min(maxFly, g.yOff + 4.6);
            gojoFlew = true;
          }
          if (keys.current.down) {
            g.yOff = Math.max(minFly, g.yOff - 4.6);
            gojoFlew = true;
          }
          g.yOff += Math.sin(s.frame / 18) * 0.2;
          g.yOff = Math.max(minFly, Math.min(maxFly, g.yOff));
        }

        // Sukuna AI — match Gojo altitude whenever either flies
        if (k.stun <= 0) {
          k.facing = g.x >= k.x ? 1 : -1;
          if (gojoFlew) {
            // Gojo flew → snap Sukuna to same level
            k.flyTarget = g.yOff;
            k.yOff += (g.yOff - k.yOff) * 0.35;
          } else {
            // Sukuna may shift level; Gojo auto-matches when not steering
            if (Math.random() < 0.02) {
              k.flyTarget = Math.max(minFly, Math.min(maxFly, g.yOff + (Math.random() - 0.5) * 40));
            } else {
              k.flyTarget = g.yOff;
            }
            k.yOff += (k.flyTarget - k.yOff) * 0.14;
            if (!keys.current.up && !keys.current.down && Math.abs(k.yOff - g.yOff) > 6) {
              g.yOff += (k.yOff - g.yOff) * 0.22;
              g.yOff = Math.max(minFly, Math.min(maxFly, g.yOff));
            }
          }
          k.yOff += Math.sin(s.frame / 16 + 1) * 0.25;
          k.yOff = Math.max(minFly, Math.min(maxFly, k.yOff));
          const dist = Math.abs(k.x - g.x);
          if (s.sukunaDomainWind > 0) {
            k.vx *= 0.7;
          } else if (inAnyDomain()) {
            k.vx *= 0.85;
            if (s.gojoDomainT > 0 && k.energy >= 100 && Math.random() < 0.04) {
              castMalevolentShrine();
            }
          } else if (--k.aiThink <= 0) {
            k.aiThink = 18 + Math.random() * 28;
            if (!s.mahoraga.active && !s.mahoraga.used && k.energy >= 45 && (k.hp < 65 || Math.random() < 0.28)) {
              summonMahoraga();
            } else if (k.energy >= 100 && Math.random() < 0.5) startSukunaDomainWindup();
            else if (dist > 140 && Math.random() < 0.7) {
              k.vx = k.facing * 2.6;
              if (Math.random() < 0.5) sukunaSlash(Math.random() < 0.35);
            } else if (dist < 90) {
              k.vx = -k.facing * 2.8;
              sukunaSlash(true);
            } else {
              sukunaSlash(Math.random() < 0.4);
              k.vx = k.facing * 1.6;
            }
          }
          k.x += k.vx;
          k.vx *= 0.86;
          k.x = Math.max(28, Math.min(s.w - 28, k.x));
        }

        // Mahoraga — enters from right, charges left, one strike, exits left
        const m = s.mahoraga;
        if (m.active) {
          // Infinity active → vanish immediately
          if (s.infinityT > 0 || s.gojoDomainT > 0) {
            dismissMahoraga("vanish");
            s.announce = "INFINITY — MAHORAGA DENIED";
            s.announceT = 34;
          } else if (m.enterT < 0) {
            cancelMahoragaSummon();
          } else if (m.enterT > 0) {
            m.enterT--;
            m.wheelSpin += 0.28;
            m.facing = -1;
            // Slide in from the right during ritual
            const max = m.enterMax || 70;
            const ep = 1 - m.enterT / max;
            const targetX = s.w * 0.82;
            m.x += (targetX - m.x) * (0.08 + ep * 0.12);
            m.yOff += (g.yOff + 8 - m.yOff) * 0.15;
            if (m.enterT === Math.floor(max * 0.55)) {
              s.announce = "EIGHT-HANDLED SWORD…";
              s.announceT = 32;
              s.shake = Math.max(s.shake, 10);
            }
            if (m.enterT === Math.floor(max * 0.2)) {
              s.announce = "DIVINE GENERAL MAHORAGA!";
              s.announceT = 40;
              s.shake = 18;
              burst(m.x, ground() - m.yOff, "#fbbf24", 30, 4.5);
              burst(m.x, ground() - m.yOff - 30, "#e7e5e4", 20, 3.5);
            }
            if (m.enterT === 0) {
              m.used = true;
              s.announce = "MAHORAGA!";
              s.announceT = 28;
              s.shake = Math.max(s.shake, 12);
              burst(m.x, ground() - m.yOff, "#fbbf24", 18, 3.5);
              m.cool = 4;
              m.hasStruck = false;
              m.facing = -1;
            }
            if (s.frame % 3 === 0) {
              burst(m.x + 20, ground() - 4, Math.random() < 0.5 ? "#fbbf24" : "#e7e5e4", 2, 2);
            }
          } else if (m.exitT > 0) {
            m.exitT--;
            m.facing = -1;
            m.x -= 16; // blast left off-frame
            m.yOff += 0.8;
            m.wheelSpin += 0.4;
            if (s.frame % 2 === 0) burst(m.x + 12, ground() - m.yOff, "#e7e5e4", 3, 2.2);
            if (m.exitT <= 0 || m.x < -70) {
              dismissMahoraga("vanish");
            }
          } else {
            if (m.hitFlash > 0) m.hitFlash--;
            if (m.cool > 0) m.cool--;
            if (m.swingT > 0) m.swingT--;
            m.facing = -1;
            m.yOff += (g.yOff + 6 - m.yOff) * 0.2;
            // Charge right → left across Gojo
            m.x -= m.hasStruck ? 3 : 6.5;
            const md = Math.hypot(m.x - g.x, m.yOff - g.yOff);
            if (!m.hasStruck && m.cool <= 0 && md < 82) {
              m.cool = 999;
              m.swingT = 16;
              m.hasStruck = true;
              hurt("gojo", 14, -40); // knock left with the charge
              s.projs.push({
                x: m.x - 30,
                y: ground() - m.yOff,
                vx: -11,
                vy: 0,
                life: 22,
                kind: "dismantle",
                dmg: 8,
                r: 16,
                from: "sukuna",
                waveH: 110,
              });
              burst(m.x - 24, ground() - m.yOff, "#e7e5e4", 18, 3.5);
              burst(m.x - 24, ground() - m.yOff, "#fbbf24", 12, 2.8);
              s.shake = Math.max(s.shake, 12);
              s.announce = "MAHORAGA STRIKES!";
              s.announceT = 28;
              m.exitT = 28; // continue left and vanish
            }
            // Ran past Gojo without connecting — still exit left
            if (m.x < g.x - 90 && !m.hasStruck) {
              m.hasStruck = true;
              m.exitT = 24;
            }
            if (m.lifeT > 0) m.lifeT--;
            if (m.lifeT <= 0 && !m.hasStruck) beginMahoragaExit();
            if (m.x < -70) dismissMahoraga("vanish");
          }
        }

        // Black Flash then melee clash
        tryBlackFlashHit();
        tryMeleeClash();

        // Passive CE regen
        if (s.frame % 30 === 0) {
          gainEnergy("gojo", 2);
          gainEnergy("sukuna", 3);
        }

        for (const p of s.projs) {
          // Blue seeks / pulls slightly
          if (p.kind === "blue") {
            const dx = k.x - p.x;
            const dy = bodyY("sukuna") - p.y;
            p.vx += Math.sign(dx) * 0.15;
            p.vy += dy * 0.012;
          }
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
        }
        clashAttacks();
        for (const p of s.projs) {
          if (p.life > 0) hitTest(p);
        }
        s.projs = s.projs.filter((p) => p.life > 0 && p.x > -40 && p.x < s.w + 40);

        if (s.frame % 10 === 0) {
          setGojoHp(Math.round(g.hp));
          setDomain(Math.round(g.energy));
          setScore(s.score);
        }
      }

      for (const p of s.parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      }
      s.parts = s.parts.filter((p) => p.life > 0);

      // ——— DRAW ———
      ctx.save();
      if (s.shake > 0.5) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      const sky = ctx.createLinearGradient(0, 0, 0, s.h);
      if (s.gojoDomainT > 0) {
        sky.addColorStop(0, "#042f2e");
        sky.addColorStop(0.4, "#0e7490");
        sky.addColorStop(1, "#083344");
      } else if (s.sukunaDomainT > 0) {
        sky.addColorStop(0, "#1c0707");
        sky.addColorStop(0.45, "#7f1d1d");
        sky.addColorStop(1, "#450a0a");
      } else {
        sky.addColorStop(0, "#0c0a09");
        sky.addColorStop(0.5, "#1c1917");
        sky.addColorStop(1, "#292524");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      // Camera follows fighters when they fly high
      {
        const focusY = Math.min(bodyY("gojo"), bodyY("sukuna"));
        const targetCam = focusY < s.h * 0.28 ? s.h * 0.38 - focusY : 0;
        s.camY += (targetCam - s.camY) * 0.12;
      }
      ctx.save();
      ctx.translate(0, s.camY);

      if (s.gojoDomainT <= 0 && s.sukunaDomainT <= 0) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        for (let i = 0; i < 10; i++) {
          const bx = i * (s.w / 9) - 10;
          const bh = 40 + (i * 37) % 70;
          ctx.fillRect(bx, gY - bh, 36, bh);
        }
        ctx.strokeStyle = "rgba(167,139,250,0.15)";
        for (let i = 0; i < 6; i++) {
          const wx = ((s.frame * 0.7 + i * 100) % (s.w + 40)) - 20;
          ctx.beginPath();
          ctx.moveTo(wx, gY - 20);
          ctx.quadraticCurveTo(wx + 10, gY - 50, wx + 20, gY - 30);
          ctx.stroke();
        }
      }

      if (s.gojoDomainT > 0) drawInfinityDomain(g.x, bodyY("gojo"));
      if (s.sukunaDomainT > 0) drawMalevolentShrine(k.x, bodyY("sukuna") + 20);

      const floor = ctx.createLinearGradient(0, gY, 0, s.h);
      floor.addColorStop(0, s.gojoDomainT > 0 ? "#164e63" : s.sukunaDomainT > 0 ? "#3f0a0a" : "#1c1917");
      floor.addColorStop(1, "#0c0a09");
      ctx.fillStyle = floor;
      ctx.fillRect(0, gY, s.w, s.h - gY);
      ctx.fillStyle = s.gojoDomainT > 0 ? "#22d3ee" : s.sukunaDomainT > 0 ? "#ef4444" : "#78716c";
      ctx.fillRect(0, gY, s.w, 3);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(40 + i * (s.w / 5), gY);
        ctx.lineTo(60 + i * (s.w / 5), gY + 16);
        ctx.stroke();
      }

      // Projectiles
      for (const p of s.projs) {
        if (p.kind === "blue") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          // Deep gravity well
          const outer = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r * 2.1);
          outer.addColorStop(0, "rgba(255,255,255,0.95)");
          outer.addColorStop(0.15, "rgba(147,197,253,0.9)");
          outer.addColorStop(0.4, "rgba(37,99,235,0.75)");
          outer.addColorStop(0.7, "rgba(30,58,138,0.35)");
          outer.addColorStop(1, "transparent");
          ctx.fillStyle = outer;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 2.1, 0, Math.PI * 2);
          ctx.fill();
          // Spinning attraction filaments
          ctx.lineWidth = 2;
          for (let i = 0; i < 6; i++) {
            const a = s.frame / 5 + i * (Math.PI / 3);
            ctx.strokeStyle = i % 2 ? "rgba(191,219,254,0.85)" : "rgba(96,165,250,0.55)";
            ctx.beginPath();
            ctx.moveTo(p.x + Math.cos(a) * p.r * 1.8, p.y + Math.sin(a) * p.r * 1.8);
            ctx.quadraticCurveTo(
              p.x + Math.cos(a + 0.8) * p.r,
              p.y + Math.sin(a + 0.8) * p.r,
              p.x,
              p.y,
            );
            ctx.stroke();
          }
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.kind === "red") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const outer = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r * 2);
          outer.addColorStop(0, "#ffffff");
          outer.addColorStop(0.2, "#fecaca");
          outer.addColorStop(0.45, "#ef4444");
          outer.addColorStop(0.75, "rgba(153,27,27,0.45)");
          outer.addColorStop(1, "transparent");
          ctx.fillStyle = outer;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
          ctx.fill();
          // Explosive shock rings
          const pulse = 10 + (s.frame % 14);
          for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = `rgba(254,202,202,${0.7 - i * 0.2})`;
            ctx.lineWidth = 3 - i * 0.6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, pulse + i * 10, 0, Math.PI * 2);
            ctx.stroke();
          }
          // Forward repulsion blades
          const dir = Math.sign(p.vx || 1);
          ctx.fillStyle = "rgba(254,226,226,0.55)";
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(p.x - dir * 4, p.y + i * 6);
            ctx.lineTo(p.x - dir * (28 + Math.abs(i) * 4), p.y + i * 12);
            ctx.lineTo(p.x - dir * 8, p.y + i * 3);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        } else if (p.kind === "purple") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const grd = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r * 2.2);
          grd.addColorStop(0, "#ffffff");
          grd.addColorStop(0.15, "#f0abfc");
          grd.addColorStop(0.35, "#c026d3");
          grd.addColorStop(0.55, "#7c3aed");
          grd.addColorStop(0.8, "rgba(37,99,235,0.35)");
          grd.addColorStop(1, "transparent");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2);
          ctx.fill();
          // Blue + red orbit braid
          for (let i = 0; i < 2; i++) {
            ctx.strokeStyle = i === 0 ? "#60a5fa" : "#f87171";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.r * 1.1, p.r * 0.5, s.frame / 5 + i * 1.2, 0, Math.PI * 2);
            ctx.stroke();
          }
          // Hollow beam tunnel
          const dir = Math.sign(p.vx || 1);
          const trail = ctx.createLinearGradient(p.x, p.y, p.x - dir * 70, p.y);
          trail.addColorStop(0, "rgba(232,121,249,0.85)");
          trail.addColorStop(0.4, "rgba(168,85,247,0.45)");
          trail.addColorStop(1, "transparent");
          ctx.fillStyle = trail;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - 14);
          ctx.lineTo(p.x - dir * 70, p.y - 5);
          ctx.lineTo(p.x - dir * 70, p.y + 5);
          ctx.lineTo(p.x, p.y + 14);
          ctx.closePath();
          ctx.fill();
          // Core spark
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Grim curved cleave — Malevolent Shrine vibe
          ctx.save();
          const heavy = p.kind === "dismantle";
          const h = p.waveH ?? 120;
          const dir = Math.sign(p.vx || 1);
          const curve = dir * (heavy ? 38 : 30); // strong sickle bend
          const topX = p.x - dir * 18;
          const midX = p.x + curve;
          const botX = p.x - dir * 10;
          const top = p.y - h / 2;
          const bot = p.y + h / 2;
          const pulse = Math.sin(s.frame / 4 + p.x * 0.04) * 2;

          // Dark void bruise behind the cut
          ctx.globalCompositeOperation = "source-over";
          const bruise = ctx.createRadialGradient(midX, p.y, 6, midX, p.y, h * 0.55);
          bruise.addColorStop(0, "rgba(40,0,0,0.55)");
          bruise.addColorStop(0.4, "rgba(20,0,0,0.35)");
          bruise.addColorStop(1, "transparent");
          ctx.fillStyle = bruise;
          ctx.beginPath();
          ctx.ellipse(midX, p.y, 36, h * 0.5, dir * 0.15, 0, Math.PI * 2);
          ctx.fill();

          // Ghost afterimages — darker, more curved
          ctx.globalCompositeOperation = "lighter";
          for (let a = 4; a >= 1; a--) {
            const ox = -dir * a * 10;
            ctx.strokeStyle = `rgba(80,0,0,${0.22 - a * 0.035})`;
            ctx.lineWidth = (heavy ? 9 : 7) - a * 0.8;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(topX + ox, top + 4);
            ctx.bezierCurveTo(
              midX + ox + pulse,
              p.y - h * 0.22,
              midX + ox + pulse * 0.5,
              p.y + h * 0.22,
              botX + ox,
              bot - 4,
            );
            ctx.stroke();
          }

          // Thick grim blade body (dark blood → dull bone edge)
          ctx.globalCompositeOperation = "source-over";
          ctx.beginPath();
          ctx.moveTo(topX - dir * 5, top);
          ctx.bezierCurveTo(
            midX + dir * 8 + pulse,
            p.y - h * 0.25,
            midX + dir * 10,
            p.y + h * 0.25,
            botX - dir * 4,
            bot,
          );
          ctx.bezierCurveTo(
            midX - dir * 14,
            p.y + h * 0.2,
            midX - dir * 12,
            p.y - h * 0.2,
            topX - dir * 8,
            top,
          );
          ctx.closePath();
          const body = ctx.createLinearGradient(topX - 20, p.y, midX + 24, p.y);
          body.addColorStop(0, "rgba(15,0,0,0.15)");
          body.addColorStop(0.35, heavy ? "rgba(60,0,0,0.85)" : "rgba(50,5,5,0.75)");
          body.addColorStop(0.55, heavy ? "rgba(120,15,15,0.9)" : "rgba(90,10,10,0.8)");
          body.addColorStop(0.72, "rgba(180,70,70,0.55)");
          body.addColorStop(0.88, "rgba(220,180,160,0.35)");
          body.addColorStop(1, "transparent");
          ctx.fillStyle = body;
          ctx.fill();

          // Outer black rim
          ctx.strokeStyle = "rgba(0,0,0,0.75)";
          ctx.lineWidth = heavy ? 5 : 3.5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(topX, top);
          ctx.bezierCurveTo(midX + pulse, p.y - h * 0.2, midX, p.y + h * 0.2, botX, bot);
          ctx.stroke();

          // Dull sickly core (not bright white — bone / dried cut)
          ctx.globalCompositeOperation = "lighter";
          ctx.shadowColor = "#450a0a";
          ctx.shadowBlur = heavy ? 16 : 10;
          ctx.strokeStyle = heavy ? "rgba(254,202,202,0.55)" : "rgba(225,200,190,0.4)";
          ctx.lineWidth = heavy ? 2.4 : 1.8;
          ctx.beginPath();
          ctx.moveTo(topX + dir * 2, top + 2);
          ctx.bezierCurveTo(
            midX + dir * 4 + pulse,
            p.y - h * 0.18,
            midX + dir * 3,
            p.y + h * 0.18,
            botX + dir * 2,
            bot - 2,
          );
          ctx.stroke();

          // Deep crimson cutting lip
          ctx.shadowColor = "#7f1d1d";
          ctx.shadowBlur = 14;
          ctx.strokeStyle = heavy ? "rgba(153,27,27,0.95)" : "rgba(127,29,29,0.85)";
          ctx.lineWidth = heavy ? 3.2 : 2.4;
          ctx.beginPath();
          ctx.moveTo(topX + dir * 7, top + 8);
          ctx.bezierCurveTo(
            midX + dir * 16 + pulse,
            p.y - h * 0.1,
            midX + dir * 14,
            p.y + h * 0.1,
            botX + dir * 6,
            bot - 8,
          );
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Blood drip streaks along the curve
          ctx.globalCompositeOperation = "source-over";
          for (let i = 0; i < 8; i++) {
            const t = (i + 0.5) / 8;
            // Approximate point on cubic bezier
            const mt = 1 - t;
            const bx =
              mt * mt * mt * topX +
              3 * mt * mt * t * (midX + pulse) +
              3 * mt * t * t * midX +
              t * t * t * botX;
            const by =
              mt * mt * mt * top +
              3 * mt * mt * t * (p.y - h * 0.2) +
              3 * mt * t * t * (p.y + h * 0.2) +
              t * t * t * bot;
            const drip = 8 + (i % 3) * 6 + Math.sin(s.frame / 5 + i) * 2;
            ctx.strokeStyle = `rgba(80,0,0,${0.55 - i * 0.04})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(bx + dir * 3, by + drip * 0.5, bx - dir * 2, by + drip);
            ctx.stroke();
          }

          // Jagged curse notches on the concave side
          ctx.strokeStyle = "rgba(40,0,0,0.7)";
          ctx.lineWidth = 1.4;
          for (let i = 0; i < 7; i++) {
            const t = (i + 0.4) / 7;
            const mt = 1 - t;
            const bx =
              mt * mt * mt * topX +
              3 * mt * mt * t * midX +
              3 * mt * t * t * midX +
              t * t * t * botX;
            const by = top + t * h;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - dir * (12 + (i % 3) * 4), by + 5);
            ctx.stroke();
          }

          // Somber tip smudges (no bright flares)
          for (const [tx, ty] of [
            [topX, top],
            [botX, bot],
          ] as const) {
            const tip = ctx.createRadialGradient(tx, ty, 1, tx, ty, 14);
            tip.addColorStop(0, "rgba(90,10,10,0.7)");
            tip.addColorStop(0.45, "rgba(40,0,0,0.4)");
            tip.addColorStop(1, "transparent");
            ctx.fillStyle = tip;
            ctx.beginPath();
            ctx.arc(tx, ty, 14, 0, Math.PI * 2);
            ctx.fill();
          }

          // Ash / scab particles
          ctx.fillStyle = "rgba(60,20,20,0.7)";
          for (let i = 0; i < 6; i++) {
            const t = (i / 6 + s.frame * 0.015) % 1;
            const mt = 1 - t;
            const bx =
              mt * mt * mt * topX +
              3 * mt * mt * t * midX +
              3 * mt * t * t * midX +
              t * t * t * botX;
            const by = top + t * h;
            ctx.beginPath();
            ctx.arc(bx - dir * (6 + (i % 3) * 4), by, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      drawGojo(g.x, gY - g.yOff);
      drawSukuna(k.x, gY - k.yOff);
      if (s.mahoraga.active) {
        drawMahoragaEntrance(s.mahoraga.x, gY - s.mahoraga.yOff);
        drawMahoraga(s.mahoraga.x, gY - s.mahoraga.yOff);
      }

      // Floating frames that move with Gojo / Sukuna
      const drawFighterFrame = (
        fx: number,
        fy: number,
        name: string,
        hp: number,
        maxHp: number,
        energy: number,
        color: string,
        ceColor: string,
        align: "left" | "right",
      ) => {
        const fw = 88;
        const fh = 34;
        const fx0 = align === "left" ? fx - 10 : fx - fw + 10;
        const fy0 = fy - 78;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(ctx, fx0, fy0, fw, fh, 5);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        roundRect(ctx, fx0, fy0, fw, fh, 5);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = `700 ${Math.round(10 * hudScale(s.w))}px Bangers, Impact, sans-serif`;
        ctx.textAlign = align === "left" ? "left" : "right";
        ctx.fillText(name, align === "left" ? fx0 + 6 : fx0 + fw - 6, fy0 + 12);
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        roundRect(ctx, fx0 + 6, fy0 + 16, fw - 12, 5, 2);
        ctx.fill();
        ctx.fillStyle = color;
        roundRect(ctx, fx0 + 6, fy0 + 16, (fw - 12) * (hp / maxHp), 5, 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        roundRect(ctx, fx0 + 6, fy0 + 24, fw - 12, 4, 2);
        ctx.fill();
        ctx.fillStyle = ceColor;
        roundRect(ctx, fx0 + 6, fy0 + 24, (fw - 12) * (energy / 100), 4, 2);
        ctx.fill();
      };
      drawFighterFrame(
        g.x,
        gY - g.yOff,
        "GOJO",
        g.hp,
        g.maxHp,
        s.gojoDomainT > 0 ? 100 : g.energy,
        "#67e8f9",
        s.gojoDomainT > 0 ? "#a5f3fc" : "#3b82f6",
        "left",
      );
      drawFighterFrame(
        k.x,
        gY - k.yOff,
        "SUKUNA",
        k.hp,
        k.maxHp,
        s.sukunaDomainT > 0 ? 100 : k.energy,
        "#fecaca",
        s.sukunaDomainT > 0 ? "#fca5a5" : "#b91c1c",
        "right",
      );

      ctx.restore(); // end camera

      // Infinity release — hard white screen flash
      if (s.flashT > 0) {
        const a = Math.min(1, s.flashT / 26);
        ctx.fillStyle = `rgba(255,255,255,${0.35 + a * 0.65})`;
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const cx = g.x;
        const cy = bodyY("gojo") + s.camY;
        const rad = 160 + (28 - s.flashT) * 14;
        const blast = ctx.createRadialGradient(cx, cy, 8, cx, cy, rad);
        blast.addColorStop(0, `rgba(255,255,255,${a})`);
        blast.addColorStop(0.25, `rgba(255,255,255,${a * 0.85})`);
        blast.addColorStop(0.55, `rgba(224,242,254,${a * 0.45})`);
        blast.addColorStop(0.8, `rgba(103,232,249,${a * 0.2})`);
        blast.addColorStop(1, "transparent");
        ctx.fillStyle = blast;
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.restore();
      }

      // Black Flash slam — dark distortion pulse
      if (s.bfFlashT > 0) {
        const a = Math.min(1, s.bfFlashT / 14);
        ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${a * 0.45})`;
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.globalCompositeOperation = "lighter";
        const cx = g.x;
        const cy = bodyY("gojo") + s.camY;
        const rad = 90 + (16 - s.bfFlashT) * 14;
        const blast = ctx.createRadialGradient(cx, cy, 4, cx, cy, rad);
        blast.addColorStop(0, `rgba(251,191,36,${a * 0.9})`);
        blast.addColorStop(0.2, `rgba(0,0,0,${a * 0.8})`);
        blast.addColorStop(0.45, `rgba(239,68,68,${a * 0.45})`);
        blast.addColorStop(1, "transparent");
        ctx.fillStyle = blast;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(251,191,36,${a * 0.8})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + s.frame * 0.1;
          const r = 20 + (16 - s.bfFlashT) * 8;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * 8, cy + Math.sin(ang) * 8);
          ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Buttons (screen-fixed HUD)
      const b = btns();
      const drawBtn = (btn: { x: number; y: number; w: number; h: number; label: string }, color: string, readyBtn: boolean) => {
        ctx.fillStyle = readyBtn ? color : "rgba(15,23,42,0.55)";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${s.w < 500 ? 10 : 12}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 4);
        ctx.textAlign = "left";
      };
      if (b.left) drawBtn(b.left, keys.current.left ? "#334155" : "#1e293b", true);
      if (b.right) drawBtn(b.right, keys.current.right ? "#334155" : "#1e293b", true);
      drawBtn(b.up, keys.current.up ? "#334155" : "#1e293b", true);
      drawBtn(b.down, keys.current.down ? "#334155" : "#1e293b", true);
      drawBtn(b.dash, g.dashCool <= 0 && g.dashT <= 0 ? "#171717" : "rgba(15,23,42,0.55)", g.dashCool <= 0);
      // Auto support chip — next is RCT or Infinity
      const autoLeft = Math.ceil(s.rctAuto / 60);
      const nextLbl = s.nextAuto === "rct" ? "RCT" : "INF";
      ctx.fillStyle = s.nextAuto === "rct" ? "rgba(22,163,74,0.85)" : "rgba(8,145,178,0.9)";
      roundRect(ctx, 12, 54, 78, 16, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 10px Comic Neue, sans-serif";
      ctx.fillText(`${nextLbl} ${autoLeft}s`, 18, 65);
      // Next orb chip — Blue / Red / Purple (auto after B,R,B,R)
      const orbLbl = s.nextOrb === "purple" ? "PRP" : s.nextOrb === "red" ? "RED" : "BLUE";
      const orbCol =
        s.nextOrb === "purple" ? "rgba(124,58,237,0.9)" : s.nextOrb === "red" ? "rgba(220,38,38,0.85)" : "rgba(37,99,235,0.85)";
      ctx.fillStyle = orbCol;
      roundRect(ctx, 96, 54, 52, 16, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(orbLbl, 104, 65);
      if (s.infinityT > 0) {
        ctx.fillStyle = "rgba(103,232,249,0.9)";
        roundRect(ctx, 154, 54, 72, 16, 4);
        ctx.fill();
        ctx.fillStyle = "#083344";
        ctx.fillText(`INF ${Math.ceil(s.infinityT / 60)}s`, 160, 65);
      }
      const domainReady = g.energy >= 100 && s.gojoDomainT <= 0;
      const clashReady = domainReady && (s.sukunaDomainT > 0 || s.sukunaDomainWind > 0);
      drawBtn(
        { ...b.domain, label: clashReady ? "CLASH!" : b.domain.label },
        clashReady ? "#ca8a04" : "#0891b2",
        domainReady || s.gojoDomainT > 0,
      );

      // Windup warning bar
      if (s.sukunaDomainWind > 0) {
        const pct = 1 - s.sukunaDomainWind / 60;
        ctx.fillStyle = "rgba(127,29,29,0.75)";
        roundRect(ctx, s.w * 0.2, 56, s.w * 0.6, 10, 4);
        ctx.fill();
        ctx.fillStyle = "#f87171";
        roundRect(ctx, s.w * 0.2, 56, s.w * 0.6 * pct, 10, 4);
        ctx.fill();
        ctx.fillStyle = "#fecaca";
        ctx.font = `700 ${Math.round(11 * hudScale(s.w))}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("SUKUNA DOMAIN…", s.w / 2, 52);
        ctx.textAlign = "left";
      }

      const hs = hudScale(s.w);
      ctx.fillStyle = "#fde68a";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(16 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`XP ${s.score}`, s.w / 2 - 30, 28);
      ctx.fillText(`XP ${s.score}`, s.w / 2 - 30, 28);

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, s.h * 0.28, s.w, 40);
        ctx.fillStyle =
          s.announce.includes("INCOMING") || s.announce.includes("SHRINE") || s.announce.includes("CLASH! SHRINE") || s.announce.includes("SUKUNA WINS") || s.announce.includes("CANCEL")
            ? s.announce.includes("CANCEL")
              ? "#fbbf24"
              : "#f87171"
            : s.announce.includes("BLACK FLASH")
              ? "#fbbf24"
              : s.announce.includes("MAHORAGA") || s.announce.includes("TREASURE") || s.announce.includes("EIGHT-HANDLED") || s.announce.includes("ADAPTATION")
                ? "#e7e5e4"
                : s.announce.includes("PURPLE")
                  ? "#e879f9"
                  : s.announce.includes("REVERSE") || s.announce.includes("RCT")
                    ? "#4ade80"
                    : s.announce.includes("GOJO WINS")
                      ? "#67e8f9"
                      : s.announce.includes("INFINITY") || s.announce.includes("RELEASE") || s.announce.includes("DOMAIN") || s.announce.includes("CLASH")
                        ? "#67e8f9"
                        : "#fff";
        ctx.font = `700 ${Math.round(16 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText(s.announce, s.w / 2, s.h * 0.28 + 28);
        ctx.fillText(s.announce, s.w / 2, s.h * 0.28 + 28);
        ctx.textAlign = "left";
      }

      if (s.alive && s.frame < 120 && s.announceT <= 0) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `700 ${Math.round(12 * hs)}px Comic Neue, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(
          isPhone() ? "tap B→R→B→R→PURPLE · BLACK FLASH" : "Tap Blue→Red→Blue→Red→Purple · Black Flash · Infinity blocks all",
          s.w / 2,
          s.h * 0.2,
        );
        ctx.textAlign = "left";
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = s.won ? "#67e8f9" : "#f87171";
        ctx.font = `700 ${Math.round(28 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        const msg = s.won ? "NAH, I'D WIN" : "STAND PROUD…";
        ctx.strokeText(msg, s.w / 2, s.h / 2);
        ctx.fillText(msg, s.w / 2, s.h / 2);
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to rematch", s.w / 2, s.h / 2 + 28);
        ctx.textAlign = "left";
      }

      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const hitBtn = (px: number, py: number, b: { x: number; y: number; w: number; h: number }) =>
      px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;

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
        keys.current.up = true;
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        keys.current.down = true;
      }
      if (e.code === "KeyJ" || e.code === "Digit1" || e.code === "KeyK" || e.code === "Digit2" || e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        if (!state.current.alive) return reset();
        castOrb();
      }
      if (e.code === "KeyL" || e.code === "Digit5" || e.code === "KeyC" || e.code === "KeyV") {
        e.preventDefault();
        if (!state.current.alive) return reset();
        castAbsoluteInfinity();
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyE" || e.code === "Digit4") {
        e.preventDefault();
        if (e.repeat) return;
        if (!state.current.alive) return reset();
        startBlackFlash();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.current.right = false;
      if (e.code === "ArrowUp" || e.code === "KeyW") keys.current.up = false;
      if (e.code === "ArrowDown" || e.code === "KeyS") keys.current.down = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      if (!state.current.alive) return reset();
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * state.current.w;
      const y = ((e.clientY - r.top) / r.height) * state.current.h;
      const b = btns();
      if (b.left && hitBtn(x, y, b.left)) {
        keys.current.left = true;
        keys.current.right = false;
        return;
      }
      if (b.right && hitBtn(x, y, b.right)) {
        keys.current.right = true;
        keys.current.left = false;
        return;
      }
      if (hitBtn(x, y, b.up)) {
        keys.current.up = true;
        keys.current.down = false;
        return;
      }
      if (hitBtn(x, y, b.down)) {
        keys.current.down = true;
        keys.current.up = false;
        return;
      }
      if (hitBtn(x, y, b.dash)) return startBlackFlash();
      if (hitBtn(x, y, b.domain)) return castAbsoluteInfinity();
      // Tap anywhere else → Blue / Red / auto Purple
      return castOrb();
    };
    const onPointerUp = () => {
      keys.current.left = false;
      keys.current.right = false;
      keys.current.up = false;
      keys.current.down = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons === 0) return;
      if (!isPhone()) return;
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * state.current.w;
      const y = ((e.clientY - r.top) / r.height) * state.current.h;
      const b = btns();
      if (!b.left || !b.right) return;
      if (hitBtn(x, y, b.left)) {
        keys.current.left = true;
        keys.current.right = false;
      } else if (hitBtn(x, y, b.right)) {
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
      title="Domain Clash"
      tagline="Tap Blue→Red→Blue→Red→Purple · Black Flash · Infinity"
      mobileTagline="Tap B→R→B→R→PRP · BLACK FLASH"
      strip="Jujutsu Kaisen"
      stripHint={domain >= 100 ? "Absolute Infinity ready!" : `CE ${domain}% · HP ${gojoHp}`}
      loadingLabel="Opening domain… loading portfolio"
      readyLabel="Fight over — enter the dossier"
      accent="#0891b2"
      accent2="#b91c1c"
      score={score}
      secondaryLabel="CE"
      secondaryValue={domain}
      best={best}
      alive={alive}
      aliveHint="Tap: Blue→Red→Blue→Red then Hollow Purple (same tap). Black Flash (E/Shift). Infinity blocks everything and ends in a white flash blast. Mahoraga charges R→L once."
      deadHint="Tap to rematch Gojo vs Sukuna."
      canvasRef={canvasRef}
      ariaLabel="Gojo versus Sukuna domain expansion fighting mini-game"
    />
  );
}
