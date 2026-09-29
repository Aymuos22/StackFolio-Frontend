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
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };

/**
 * Gojo vs Sukuna — Shinjuku final battle.
 * Gojo: Blue · Red · Hollow Purple · RCT · Domain: Infinity
 * Sukuna AI: Slash / Dismantle · Domain: Malevolent Shrine
 */
export default function GojoVsSukuna({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const keys = useRef({ left: false, right: false });
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
      cast: "" as "" | "blue" | "red" | "purple" | "rct" | "domain" | "melee",
      rctFlash: 0,
    },
    sukuna: {
      x: 480,
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
      cast: "" as "" | "slash" | "domain",
    },
    projs: [] as Projectile[],
    parts: [] as Particle[],
    shake: 0,
    gojoDomainT: 0,
    sukunaDomainT: 0,
    sukunaDomainWind: 0, // telegraph before Malevolent Shrine
    meleeCool: 0,
    meleeT: 0,
    meleeWinner: "" as "" | "gojo" | "sukuna",
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
    const btnH = () => 36;
    const btnY = () => state.current.h - 44;
    const isPhone = () => state.current.w < 560;
    const btns = () => {
      const phone = isPhone();
      const y = btnY();
      const h = btnH();
      const gap = phone ? 3 : 4;
      const aw = phone ? 44 : 0;
      const w = phone ? 36 : 50;
      const dw = phone ? 54 : 68;
      const start = phone ? 6 + aw * 2 + gap * 2 + 6 : 6;
      const out: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
        blue: { x: start, y, w, h, label: phone ? "BLU" : "BLUE" },
        red: { x: start + w + gap, y, w, h, label: "RED" },
        purple: { x: start + (w + gap) * 2, y, w, h, label: phone ? "PRP" : "PURPLE" },
        rct: { x: start + (w + gap) * 3, y, w, h, label: "RCT" },
        domain: { x: state.current.w - dw - 6, y, w: dw, h, label: phone ? "DOM" : "INFINITY" },
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
      };
      s.sukuna = {
        x: Math.min(s.w - 60, s.w * 0.78),
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
      };
      s.projs = [];
      s.parts = [];
      s.shake = 0;
      s.gojoDomainT = 0;
      s.sukunaDomainT = 0;
      s.sukunaDomainWind = 0;
      s.meleeCool = 0;
      s.meleeT = 0;
      s.meleeWinner = "";
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
      // Infinity passive during Gojo domain — blocks non-domain Sukuna hits
      if (who === "gojo" && s.gojoDomainT > 0 && !opts?.fromDomain) {
        burst(f.x, ground() - 30, "#67e8f9", 8, 2);
        s.announce = "INFINITY";
        s.announceT = 18;
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
        if (f.hp <= 0) endFight(true);
      }
    };

    const inAnyDomain = () => state.current.gojoDomainT > 0 || state.current.sukunaDomainT > 0;

    const castBlue = () => {
      const s = state.current;
      const g = s.gojo;
      if (!s.alive || g.cool > 0 || g.stun > 0 || inAnyDomain()) return;
      g.cool = 20;
      g.pose = 16;
      g.cast = "blue";
      g.facing = s.sukuna.x >= g.x ? 1 : -1;
      const gY = ground();
      const hx = g.x + g.facing * 30;
      const hy = gY - 38;
      s.projs.push({
        x: hx,
        y: hy,
        vx: g.facing * 5.2,
        vy: 0,
        life: 52,
        kind: "blue",
        dmg: 9,
        r: 18,
        from: "gojo",
      });
      burst(hx, hy, "#60a5fa", 16, 3);
      burst(hx, hy, "#93c5fd", 10, 2);
      gainEnergy("gojo", 10);
    };

    const castRed = () => {
      const s = state.current;
      const g = s.gojo;
      if (!s.alive || g.cool > 0 || g.stun > 0 || inAnyDomain()) return;
      g.cool = 26;
      g.pose = 18;
      g.cast = "red";
      g.facing = s.sukuna.x >= g.x ? 1 : -1;
      const gY = ground();
      const hx = g.x + g.facing * 32;
      const hy = gY - 36;
      s.projs.push({
        x: hx,
        y: hy,
        vx: g.facing * 9.5,
        vy: 0,
        life: 42,
        kind: "red",
        dmg: 13,
        r: 20,
        from: "gojo",
      });
      burst(hx, hy, "#f87171", 18, 3.5);
      burst(hx, hy, "#fecaca", 10, 2);
      s.shake = Math.max(s.shake, 4);
      gainEnergy("gojo", 12);
    };

    const castPurple = () => {
      const s = state.current;
      const g = s.gojo;
      if (!s.alive || g.cool > 0 || g.stun > 0 || inAnyDomain()) return;
      if (g.energy < 35) {
        s.announce = "NEED 35 CE FOR PURPLE";
        s.announceT = 28;
        return;
      }
      g.energy -= 35;
      setDomain(Math.round(g.energy));
      g.cool = 42;
      g.pose = 24;
      g.cast = "purple";
      g.facing = s.sukuna.x >= g.x ? 1 : -1;
      const gY = ground();
      const hx = g.x + g.facing * 36;
      const hy = gY - 40;
      s.projs.push({
        x: hx,
        y: hy,
        vx: g.facing * 12,
        vy: 0,
        life: 55,
        kind: "purple",
        dmg: 24,
        r: 26,
        from: "gojo",
      });
      burst(hx, hy, "#c084fc", 22, 4);
      burst(hx, hy, "#e879f9", 14, 3);
      burst(hx, hy, "#60a5fa", 8, 2);
      burst(hx, hy, "#f87171", 8, 2);
      s.announce = "HOLLOW PURPLE";
      s.announceT = 32;
      s.shake = 10;
    };

    const castRCT = () => {
      const s = state.current;
      const g = s.gojo;
      if (!s.alive || g.cool > 0 || g.stun > 0) return;
      if (g.hp >= g.maxHp) {
        s.announce = "FULL HP";
        s.announceT = 20;
        return;
      }
      if (g.energy < 20) {
        s.announce = "NEED 20 CE FOR RCT";
        s.announceT = 26;
        return;
      }
      g.energy -= 20;
      setDomain(Math.round(g.energy));
      g.cool = 36;
      g.pose = 20;
      g.cast = "rct";
      g.rctFlash = 28;
      const heal = Math.min(22, g.maxHp - g.hp);
      g.hp = Math.min(g.maxHp, g.hp + heal);
      setGojoHp(Math.round(g.hp));
      burst(g.x, ground() - 30, "#4ade80", 20, 3);
      burst(g.x, ground() - 40, "#86efac", 12, 2);
      s.announce = "REVERSE CURSED TECHNIQUE";
      s.announceT = 30;
    };

    const clashDomains = (opener: "gojo" | "sukuna") => {
      const s = state.current;
      s.gojoDomainT = 0;
      s.sukunaDomainT = 0;
      s.sukunaDomainWind = 0;
      s.gojo.invuln = 0;
      s.gojo.energy = 0;
      s.sukuna.energy = 0;
      setDomain(0);
      s.gojo.stun = Math.max(s.gojo.stun, 18);
      s.sukuna.stun = Math.max(s.sukuna.stun, 18);
      s.announce = opener === "gojo" ? "DOMAIN CLASH! INFINITY" : "DOMAIN CLASH! SHRINE";
      s.announceT = 48;
      s.shake = 16;
      const mx = (s.gojo.x + s.sukuna.x) / 2;
      const my = ground() - 40;
      burst(mx, my, "#fbbf24", 28, 4);
      burst(mx, my - 10, "#67e8f9", 16, 3);
      burst(mx, my - 10, "#f87171", 16, 3);
    };

    const castInfinity = () => {
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
      s.gojoDomainT = 200;
      g.pose = 30;
      g.cast = "domain";
      g.invuln = 200;
      s.sukuna.stun = Math.max(s.sukuna.stun, 90);
      s.announce = "DOMAIN EXPANSION: INFINITY";
      s.announceT = 55;
      s.shake = 12;
      burst(g.x, ground() - 40, "#67e8f9", 30, 4);
    };

    const sukunaSlash = (heavy = false) => {
      const s = state.current;
      const k = s.sukuna;
      if (k.cool > 0 || k.stun > 0 || inAnyDomain() || s.sukunaDomainWind > 0) return;
      k.cool = heavy ? 32 : 20;
      k.pose = 14;
      k.cast = "slash";
      k.facing = s.gojo.x >= k.x ? 1 : -1;
      const gY = ground();
      const count = heavy ? 3 : 1;
      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * 14;
        s.projs.push({
          x: k.x + k.facing * (18 + i * 6),
          y: gY - 28 - Math.random() * 18 + spread,
          vx: k.facing * (heavy ? 11 : 8.5),
          vy: (Math.random() - 0.5) * 1.8 + spread * 0.05,
          life: heavy ? 44 : 36,
          kind: heavy ? "dismantle" : "slash",
          dmg: heavy ? 8 : 7,
          r: heavy ? 20 : 14,
          from: "sukuna",
        });
      }
      burst(k.x + k.facing * 22, gY - 34, "#fecaca", heavy ? 14 : 8, 2.5);
      burst(k.x + k.facing * 30, gY - 30, "#f87171", heavy ? 8 : 4, 2);
      s.shake = Math.max(s.shake, heavy ? 5 : 2);
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

    const hitTest = (p: Projectile) => {
      const s = state.current;
      const gY = ground();
      if (p.from === "gojo") {
        const k = s.sukuna;
        const ky = gY - 30;
        if (Math.hypot(p.x - k.x, p.y - ky) < p.r + 18) {
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
        const gy = gY - 30;
        if (Math.hypot(p.x - g.x, p.y - gy) < p.r + 16) {
          hurt("gojo", p.dmg, s.sukuna.facing * 18, { fromDomain: p.fromDomain });
          p.life = 0;
        }
      }
    };

    const tryMeleeClash = () => {
      const s = state.current;
      if (!s.alive || s.meleeCool > 0 || s.meleeT > 0 || inAnyDomain()) return;
      const g = s.gojo;
      const k = s.sukuna;
      const dist = Math.abs(g.x - k.x);
      if (dist > 46) return;

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
      const gy = ground() - 32;
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
        g.cast === "domain" || g.cast === "rct" || g.cast === "melee";
      const melee = g.cast === "melee" || s.meleeT > 0;
      const lean = melee ? face * 10 : casting ? face * 6 : Math.sin(s.frame / 18) * 1.2;
      const sc = 1.38;

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

      if (g.invuln > 0 || s.gojoDomainT > 0) {
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

      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.ellipse(x, y + 46, 30, 7, 0, 0, Math.PI * 2);
      ctx.fill();

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

      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.ellipse(x, y + 44, 28, 7, 0, 0, Math.PI * 2);
      ctx.fill();

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

      if (s.gojoDomainT > 0) {
        s.gojoDomainT--;
        // Infinity pressure — drains but cannot kill
        if (s.frame % 12 === 0 && k.hp > 1) hurt("sukuna", 2, 0, { fromDomain: true });
        if (s.gojoDomainT === 0) {
          g.invuln = 0;
          s.announce = "INFINITY FADED";
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
        if (s.frame % 8 === 0) {
          const ang = Math.random() * Math.PI * 2;
          s.projs.push({
            x: g.x + Math.cos(ang) * 40,
            y: gY - 30 + Math.sin(ang) * 20,
            vx: Math.cos(ang + Math.PI) * 6,
            vy: Math.sin(ang + Math.PI) * 3,
            life: 20,
            kind: "dismantle",
            dmg: 5,
            r: 12,
            from: "sukuna",
            fromDomain: true,
          });
        }
        if (s.sukunaDomainT === 0) {
          s.announce = "SHRINE CLOSED";
          s.announceT = 30;
        }
      }

      if (s.alive) {
        // Player movement
        if (g.stun <= 0) {
          let mx = 0;
          if (keys.current.left) mx -= 1;
          if (keys.current.right) mx += 1;
          g.vx = mx * 3.2;
          g.x += g.vx;
          g.x = Math.max(28, Math.min(s.w - 28, g.x));
          if (mx !== 0) g.facing = mx > 0 ? 1 : -1;
          else g.facing = k.x >= g.x ? 1 : -1;
        }

        // Sukuna AI
        if (k.stun <= 0) {
          k.facing = g.x >= k.x ? 1 : -1;
          const dist = Math.abs(k.x - g.x);
          if (s.sukunaDomainWind > 0) {
            // Hold still while charging domain
            k.vx *= 0.7;
          } else if (inAnyDomain()) {
            // Domains lock attacks — only domain pressure / clash
            k.vx *= 0.85;
            if (s.gojoDomainT > 0 && k.energy >= 100 && Math.random() < 0.04) {
              castMalevolentShrine(); // clash attempt
            }
          } else if (--k.aiThink <= 0) {
            k.aiThink = 18 + Math.random() * 28;
            if (k.energy >= 100 && Math.random() < 0.55) startSukunaDomainWindup();
            else if (dist > 140 && Math.random() < 0.7) {
              k.vx = k.facing * 2.4;
              if (Math.random() < 0.5) sukunaSlash(Math.random() < 0.35);
            } else if (dist < 90) {
              k.vx = -k.facing * 2.8;
              sukunaSlash(true);
            } else {
              sukunaSlash(Math.random() < 0.4);
              k.vx = k.facing * 1.5;
            }
          }
          k.x += k.vx;
          k.vx *= 0.86;
          k.x = Math.max(28, Math.min(s.w - 28, k.x));
        }

        // Close combat — fists when too close
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
            const dy = gY - 36 - p.y;
            p.vx += Math.sign(dx) * 0.15;
            p.vy += dy * 0.01;
          }
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
          hitTest(p);
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

      if (s.gojoDomainT > 0) drawInfinityDomain(g.x, gY - 36);
      if (s.sukunaDomainT > 0) drawMalevolentShrine(k.x, gY);

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
          const grd = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r * 1.35);
          grd.addColorStop(0, "#ffffff");
          grd.addColorStop(0.25, "#93c5fd");
          grd.addColorStop(0.55, "#2563eb");
          grd.addColorStop(1, "transparent");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 1.35, 0, Math.PI * 2);
          ctx.fill();
          // Gravity spiral rings
          ctx.strokeStyle = "rgba(147,197,253,0.7)";
          ctx.lineWidth = 1.6;
          for (let i = 0; i < 3; i++) {
            const rr = 6 + i * 5 + (s.frame % 10) * 0.3;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, rr, rr * 0.55, s.frame / 8 + i, 0, Math.PI * 2);
            ctx.stroke();
          }
          // Suction trails
          ctx.strokeStyle = "rgba(96,165,250,0.45)";
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 4; i++) {
            const a = s.frame / 6 + i * 1.5;
            ctx.beginPath();
            ctx.moveTo(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 14);
            ctx.lineTo(p.x + Math.cos(a) * 8, p.y + Math.sin(a) * 5);
            ctx.stroke();
          }
          ctx.restore();
        } else if (p.kind === "red") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const grd = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r * 1.4);
          grd.addColorStop(0, "#ffffff");
          grd.addColorStop(0.3, "#fca5a5");
          grd.addColorStop(0.55, "#ef4444");
          grd.addColorStop(1, "transparent");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 1.4, 0, Math.PI * 2);
          ctx.fill();
          // Shockwave rings
          ctx.strokeStyle = "rgba(248,113,113,0.75)";
          ctx.lineWidth = 2.2;
          const pulse = 8 + (s.frame % 12);
          ctx.beginPath();
          ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "rgba(254,202,202,0.45)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, pulse + 8, 0, Math.PI * 2);
          ctx.stroke();
          // Push streaks
          ctx.strokeStyle = "rgba(254,226,226,0.55)";
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(p.x - Math.sign(p.vx || 1) * 6, p.y + i * 7);
            ctx.lineTo(p.x - Math.sign(p.vx || 1) * 22, p.y + i * 10);
            ctx.stroke();
          }
          ctx.restore();
        } else if (p.kind === "purple") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          // Hollow Purple core — blue+red merge
          const grd = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r * 1.5);
          grd.addColorStop(0, "#ffffff");
          grd.addColorStop(0.2, "#e879f9");
          grd.addColorStop(0.45, "#a855f7");
          grd.addColorStop(0.7, "#7c3aed");
          grd.addColorStop(1, "transparent");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 1.5, 0, Math.PI * 2);
          ctx.fill();
          // Dual-color orbit
          ctx.strokeStyle = "#60a5fa";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r * 0.9, p.r * 0.45, s.frame / 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "#f87171";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r * 0.9, p.r * 0.45, -s.frame / 6, 0, Math.PI * 2);
          ctx.stroke();
          // Beam trail
          const dir = Math.sign(p.vx || 1);
          const trail = ctx.createLinearGradient(p.x, p.y, p.x - dir * 50, p.y);
          trail.addColorStop(0, "rgba(232,121,249,0.7)");
          trail.addColorStop(0.5, "rgba(168,85,247,0.35)");
          trail.addColorStop(1, "transparent");
          ctx.fillStyle = trail;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - 10);
          ctx.lineTo(p.x - dir * 50, p.y - 4);
          ctx.lineTo(p.x - dir * 50, p.y + 4);
          ctx.lineTo(p.x, p.y + 10);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          // Cleave / Dismantle — multi-layer slash arcs
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.lineCap = "round";
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = p.kind === "dismantle" ? 16 : 10;
          const dir = Math.sign(p.vx || 1);
          const heavy = p.kind === "dismantle";
          // Outer glow slash
          ctx.strokeStyle = heavy ? "rgba(254,202,202,0.9)" : "rgba(255,255,255,0.85)";
          ctx.lineWidth = heavy ? 5 : 3;
          ctx.beginPath();
          ctx.moveTo(p.x - dir * 28, p.y - 18);
          ctx.quadraticCurveTo(p.x + dir * 4, p.y - 2, p.x + dir * 22, p.y + 16);
          ctx.stroke();
          // Inner white edge
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = heavy ? 2 : 1.2;
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.moveTo(p.x - dir * 22, p.y - 12);
          ctx.quadraticCurveTo(p.x, p.y, p.x + dir * 16, p.y + 10);
          ctx.stroke();
          if (heavy) {
            // Crossing dismantle X
            ctx.strokeStyle = "rgba(248,113,113,0.75)";
            ctx.lineWidth = 3;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(p.x - dir * 20, p.y + 14);
            ctx.quadraticCurveTo(p.x, p.y, p.x + dir * 20, p.y - 14);
            ctx.stroke();
            // Afterimage
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = "#fecaca";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x - dir * 34, p.y - 10);
            ctx.lineTo(p.x + dir * 10, p.y + 8);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          // Sparks
          ctx.fillStyle = "#fecaca";
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(p.x + dir * (8 + i * 6), p.y - 6 + i * 5, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
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

      drawGojo(g.x, gY - 4);
      drawSukuna(k.x, gY - 4);

      // HP bars
      const barW = Math.min(200, s.w * 0.38);
      // Gojo
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, 12, 10, barW, 12, 4);
      ctx.fill();
      ctx.fillStyle = "#22d3ee";
      roundRect(ctx, 12, 10, (g.hp / g.maxHp) * barW, 12, 4);
      ctx.fill();
      ctx.fillStyle = "#67e8f9";
      ctx.font = `700 ${Math.round(11 * hudScale(s.w))}px Bangers, Impact, sans-serif`;
      ctx.fillText("GOJO", 14, 38);
      // Gojo CE
      roundRect(ctx, 12, 42, barW, 7, 3);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fill();
      ctx.fillStyle = s.gojoDomainT > 0 ? "#a5f3fc" : "#3b82f6";
      roundRect(ctx, 12, 42, ((s.gojoDomainT > 0 ? 100 : g.energy) / 100) * barW, 7, 3);
      ctx.fill();

      // Sukuna
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, s.w - 12 - barW, 10, barW, 12, 4);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      roundRect(ctx, s.w - 12 - (k.hp / k.maxHp) * barW, 10, (k.hp / k.maxHp) * barW, 12, 4);
      ctx.fill();
      ctx.fillStyle = "#fecaca";
      ctx.textAlign = "right";
      ctx.fillText("SUKUNA", s.w - 14, 38);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, s.w - 12 - barW, 42, barW, 7, 3);
      ctx.fill();
      ctx.fillStyle = s.sukunaDomainT > 0 ? "#fca5a5" : "#b91c1c";
      roundRect(ctx, s.w - 12 - ((s.sukunaDomainT > 0 ? 100 : k.energy) / 100) * barW, 42, ((s.sukunaDomainT > 0 ? 100 : k.energy) / 100) * barW, 7, 3);
      ctx.fill();

      // Buttons
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
      drawBtn(b.blue, "#1d4ed8", !inAnyDomain());
      drawBtn(b.red, "#b91c1c", !inAnyDomain());
      drawBtn(b.purple, "#7c3aed", !inAnyDomain() && g.energy >= 35);
      drawBtn(b.rct, "#16a34a", g.hp < g.maxHp && g.energy >= 20);
      const domainReady = g.energy >= 100 && s.gojoDomainT <= 0;
      const clashReady = domainReady && (s.sukunaDomainT > 0 || s.sukunaDomainWind > 0);
      drawBtn(
        { ...b.domain, label: clashReady ? "CLASH!" : b.domain.label === "DOM" ? "DOM" : "INFINITY" },
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
          s.announce.includes("INCOMING") || s.announce.includes("SHRINE") || s.announce.includes("CLASH! SHRINE") || s.announce.includes("SUKUNA WINS")
            ? "#f87171"
            : s.announce.includes("PURPLE")
              ? "#e879f9"
              : s.announce.includes("REVERSE") || s.announce.includes("RCT")
                ? "#4ade80"
                : s.announce.includes("GOJO WINS")
                  ? "#67e8f9"
                  : s.announce.includes("INFINITY") || s.announce.includes("DOMAIN") || s.announce.includes("CLASH")
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
          isPhone() ? "◀▶ move · BLU/RED/PRP/RCT/DOM · get close to clash" : "A/D move · J Blue · K Red · U Purple · H RCT · L Infinity · close = melee",
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
      if (e.code === "KeyJ" || e.code === "Digit1") {
        e.preventDefault();
        if (!state.current.alive) return reset();
        castBlue();
      }
      if (e.code === "KeyK" || e.code === "Digit2" || e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        if (!state.current.alive) return reset();
        castRed();
      }
      if (e.code === "KeyU" || e.code === "Digit3") {
        e.preventDefault();
        if (!state.current.alive) return reset();
        castPurple();
      }
      if (e.code === "KeyH" || e.code === "Digit4" || e.code === "KeyR") {
        e.preventDefault();
        if (!state.current.alive) return reset();
        castRCT();
      }
      if (e.code === "KeyL" || e.code === "Digit5" || e.code === "KeyC" || e.code === "KeyV") {
        e.preventDefault();
        if (!state.current.alive) return reset();
        castInfinity();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.current.right = false;
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
      if (hitBtn(x, y, b.blue)) return castBlue();
      if (hitBtn(x, y, b.red)) return castRed();
      if (hitBtn(x, y, b.purple)) return castPurple();
      if (hitBtn(x, y, b.rct)) return castRCT();
      if (hitBtn(x, y, b.domain)) return castInfinity();
      // Desktop fallback: tap half-screen to move when no on-screen arrows
      if (!b.left && y < btnY() - 8) {
        if (x < state.current.w / 2) {
          keys.current.left = true;
          keys.current.right = false;
        } else {
          keys.current.right = true;
          keys.current.left = false;
        }
      }
    };
    const onPointerUp = () => {
      keys.current.left = false;
      keys.current.right = false;
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
      tagline="Shinjuku Showdown — Blue · Red · Hollow Purple · RCT · Infinity"
      mobileTagline="◀▶ move · BLU/RED/PRP/RCT/DOM · close combat clash"
      strip="Jujutsu Kaisen"
      stripHint={domain >= 100 ? "Infinity ready!" : `CE ${domain}% · HP ${gojoHp}`}
      loadingLabel="Opening domain… loading portfolio"
      readyLabel="Fight over — enter the dossier"
      accent="#0891b2"
      accent2="#b91c1c"
      score={score}
      secondaryLabel="CE"
      secondaryValue={domain}
      best={best}
      alive={alive}
      aliveHint="Move with A/D or ◀▶. J Blue · K Red · U Purple · H RCT · L Infinity. Get close for fist clashes. Domains lock attacks — clash domains."
      deadHint="Tap to rematch Gojo vs Sukuna."
      canvasRef={canvasRef}
      ariaLabel="Gojo versus Sukuna domain expansion fighting mini-game"
    />
  );
}
