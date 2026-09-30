import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Bolt = {
  x: number;
  y: number;
  vx: number;
  r: number;
  dmg: number;
  life: number;
};

type Barrier = {
  x: number;
  life: number;
  maxLife: number;
  hp: number;
  kind: "wall" | "fist";
  fistHit?: boolean;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

/**
 * Green Lantern vs Sinestro — place hard-light barriers to stop yellow fear bolts.
 * Sinestro stands on the far side and shoots; deplete his HP (fist / blocked rebound).
 * Power-ups: Shield Ring · Giant Construct Fist.
 */
export default function GreenLanternConstructs({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [will, setWill] = useState(0);
  const [mode, setMode] = useState<"base" | "shield" | "fist">("base");
  const [sinestroHp, setSinestroHp] = useState(100);

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    won: false,
    score: 0,
    will: 0,
    cooldown: 0,
    bolts: [] as Bolt[],
    barriers: [] as Barrier[],
    parts: [] as Particle[],
    shake: 0,
    shieldT: 0,
    fistT: 0,
    announce: "",
    announceT: 0,
    specialCd: 0,
    ringPulse: 0,
    sinestro: {
      hp: 100,
      maxHp: 100,
      shootCd: 50,
      hitFlash: 0,
      pose: 0,
    },
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_lantern") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const heroX = () => state.current.w * 0.14;
    const sinX = () => state.current.w * 0.88;
    const ground = () => state.current.h * 0.72;
    const btnShield = () => ({ x: state.current.w - 108, y: state.current.h - 52, w: 44, h: 36 });
    const btnFist = () => ({ x: state.current.w - 56, y: state.current.h - 52, w: 44, h: 36 });

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
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
      const next = s.fistT > 0 ? "fist" : s.shieldT > 0 ? "shield" : "base";
      setMode(next);
    };

    const saveBest = () => {
      const s = state.current;
      localStorage.setItem(
        "stackfolio_best_lantern",
        String(Math.max(Number(localStorage.getItem("stackfolio_best_lantern") || 0), s.score)),
      );
      setBest(Math.max(Number(localStorage.getItem("stackfolio_best_lantern") || 0), s.score));
    };

    const hurtSinestro = (dmg: number) => {
      const s = state.current;
      const si = s.sinestro;
      if (!s.alive || si.hp <= 0) return;
      si.hp = Math.max(0, si.hp - dmg);
      si.hitFlash = 10;
      setSinestroHp(Math.round(si.hp));
      burst(sinX(), ground() - 30, "#facc15", 10, 2.5);
      burst(sinX(), ground() - 30, "#fef08a", 6, 2);
      s.score += Math.round(dmg * 4);
      setScore(s.score);
      if (si.hp <= 0) {
        s.alive = false;
        s.won = true;
        setAlive(false);
        s.announce = "SINESTRO DEFEATED!";
        s.announceT = 70;
        s.shake = 16;
        s.score += 400;
        setScore(s.score);
        burst(sinX(), ground() - 40, "#facc15", 36, 5);
        burst(sinX(), ground() - 40, "#86efac", 24, 4);
        saveBest();
      }
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.won = false;
      s.score = 0;
      s.will = 0;
      s.cooldown = 0;
      s.bolts = [];
      s.barriers = [];
      s.parts = [];
      s.shake = 0;
      s.shieldT = 0;
      s.fistT = 0;
      s.announce = "FEAR VS WILL!";
      s.announceT = 50;
      s.specialCd = 0;
      s.ringPulse = 0;
      s.sinestro = {
        hp: 100,
        maxHp: 100,
        shootCd: 40,
        hitFlash: 0,
        pose: 0,
      };
      setAlive(true);
      setScore(0);
      setWill(0);
      setSinestroHp(100);
      setMode("base");
    };

    const placeWall = (px: number) => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.cooldown > 0) return;

      if (s.fistT > 0) {
        const gY = ground();
        s.barriers.push({ x: s.w * 0.35, life: 40, maxLife: 40, hp: 99, kind: "fist", fistHit: false });
        s.cooldown = 16;
        s.shake = 10;
        s.ringPulse = 12;
        burst(heroX() + 60, gY - 40, "#86efac", 20, 4);
        return;
      }

      const minX = heroX() + 50;
      const maxX = s.w * 0.78;
      const x = Math.max(minX, Math.min(maxX, px));

      s.barriers = s.barriers.filter((b) => b.kind === "wall" || b.life > 0);
      const walls = s.barriers.filter((b) => b.kind === "wall");
      if (walls.length >= 4) {
        const oldest = walls.reduce((a, b) => (a.life < b.life ? a : b));
        oldest.life = 0;
      }

      s.barriers.push({
        x,
        life: 150,
        maxLife: 150,
        hp: 4,
        kind: "wall",
      });
      s.cooldown = 8;
      s.ringPulse = 8;
      burst(x, ground() - 30, "#4ade80", 10, 2);
    };

    const activateShield = () => {
      const s = state.current;
      if (!s.alive || s.specialCd > 0 || s.shieldT > 0 || s.fistT > 0) return;
      if (s.will < 50) {
        s.announce = "NEED 50 WILL!";
        s.announceT = 35;
        return;
      }
      s.will -= 50;
      setWill(s.will);
      s.shieldT = 200;
      s.specialCd = 18;
      s.shake = 6;
      s.announce = "SHIELD RING!";
      s.announceT = 50;
      burst(heroX(), ground() - 20, "#86efac", 22, 3);
      syncMode();
    };

    const activateFist = () => {
      const s = state.current;
      if (!s.alive || s.specialCd > 0 || s.fistT > 0) return;
      if (s.will < 100) {
        s.announce = "NEED 100 WILL!";
        s.announceT = 35;
        return;
      }
      s.will = 0;
      setWill(0);
      s.shieldT = 0;
      s.fistT = 260;
      s.specialCd = 22;
      s.shake = 12;
      s.announce = "GIANT CONSTRUCT!";
      s.announceT = 60;
      burst(heroX() + 40, ground() - 40, "#22c55e", 30, 4);
      syncMode();
    };

    const fireBolt = () => {
      const s = state.current;
      const si = s.sinestro;
      if (si.hp <= 0) return;
      const speed = -(3.2 + Math.min(2.2, s.score * 0.0015));
      const yOff = -18 - Math.random() * 36;
      s.bolts.push({
        x: sinX() - 28,
        y: ground() + yOff,
        vx: speed,
        r: 9 + (Math.random() < 0.25 ? 4 : 0),
        dmg: 1,
        life: 160,
      });
      si.pose = 14;
      si.shootCd = Math.max(22, 48 - Math.min(20, s.score / 80));
      burst(sinX() - 20, ground() - 28, "#facc15", 8, 2.2);
      s.shake = Math.max(s.shake, 3);
    };

    const drawLantern = (x: number, y: number) => {
      const s = state.current;
      const f = s.frame;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const auraR = 32 + (s.shieldT > 0 ? 18 : 0) + Math.sin(f / 5) * 3 + s.ringPulse;
      const aura = ctx.createRadialGradient(x, y - 8, 4, x, y - 8, auraR);
      aura.addColorStop(0, "rgba(134,239,172,0.45)");
      aura.addColorStop(0.45, "rgba(34,197,94,0.25)");
      aura.addColorStop(1, "transparent");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(x, y - 6, auraR * 0.7, auraR, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (s.shieldT > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(74,222,128,${0.55 + Math.sin(f / 4) * 0.2})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y - 4, 36 + Math.sin(f / 3) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(187,247,208,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - 4, 42, f / 10, f / 10 + Math.PI * 1.2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = "#14532d";
      roundRect(ctx, x - 12, y + 28, 11, 8, 2);
      ctx.fill();
      roundRect(ctx, x + 1, y + 28, 11, 8, 2);
      ctx.fill();

      ctx.fillStyle = "#16a34a";
      ctx.strokeStyle = "#14532d";
      ctx.lineWidth = 1.5;
      roundRect(ctx, x - 13, y - 8, 26, 40, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x - 13, y + 4, 26, 8);
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(x, y - 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14532d";
      ctx.fillRect(x - 5, y - 5, 10, 2);
      ctx.fillRect(x - 5, y + 1, 10, 2);
      ctx.fillRect(x - 2, y - 5, 4, 8);

      ctx.fillStyle = "#16a34a";
      roundRect(ctx, x - 20, y - 2, 9, 14, 3);
      ctx.fill();
      roundRect(ctx, x + 11, y - 4, 16, 9, 3);
      ctx.fill();
      ctx.fillStyle = "#f5c89a";
      ctx.beginPath();
      ctx.arc(x - 16, y + 12, 3.5, 0, Math.PI * 2);
      ctx.arc(x + 28, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 28, y, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(x + 28, y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f5c89a";
      ctx.beginPath();
      ctx.ellipse(x, y - 22, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.ellipse(x, y - 28, 10, 6, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14532d";
      roundRect(ctx, x - 9, y - 26, 18, 8, 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(x - 3.5, y - 22, 2.2, 2.5, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 3.5, y - 22, 2.2, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(x - 3.5, y - 22, 1, 0, Math.PI * 2);
      ctx.arc(x + 3.5, y - 22, 1, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawSinestro = (x: number, y: number) => {
      const s = state.current;
      const si = s.sinestro;
      if (si.hp <= 0) return;
      const flash = si.hitFlash > 0;
      const lean = si.pose > 0 ? -8 : Math.sin(s.frame / 16) * 1.5;

      // Yellow fear aura
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const auraR = 36 + Math.sin(s.frame / 6) * 4 + (si.pose > 0 ? 10 : 0);
      const aura = ctx.createRadialGradient(x, y - 10, 4, x, y - 10, auraR);
      aura.addColorStop(0, flash ? "rgba(254,240,138,0.55)" : "rgba(250,204,21,0.4)");
      aura.addColorStop(0.5, "rgba(202,138,4,0.22)");
      aura.addColorStop(1, "transparent");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(x, y - 6, auraR * 0.7, auraR, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1); // face left toward Lantern
      ctx.translate(lean, 0);

      // Boots
      ctx.fillStyle = "#422006";
      roundRect(ctx, -12, 28, 11, 8, 2);
      ctx.fill();
      roundRect(ctx, 1, 28, 11, 8, 2);
      ctx.fill();

      // Yellow suit
      ctx.fillStyle = flash ? "#fef08a" : "#ca8a04";
      ctx.strokeStyle = "#713f12";
      ctx.lineWidth = 1.5;
      roundRect(ctx, -13, -8, 26, 40, 5);
      ctx.fill();
      ctx.stroke();

      // Black accents
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-13, 4, 26, 8);
      // Sinestro Corps emblem (diamond/point)
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, -1);
      ctx.lineTo(0, 6);
      ctx.lineTo(-6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(3, -1);
      ctx.lineTo(0, 2);
      ctx.lineTo(-3, -1);
      ctx.closePath();
      ctx.fill();

      // Arms — shooting arm forward
      ctx.fillStyle = flash ? "#fef08a" : "#ca8a04";
      roundRect(ctx, -20, -2, 9, 14, 3);
      ctx.fill();
      const armExt = si.pose > 0 ? 22 : 16;
      roundRect(ctx, 11, -4, armExt, 9, 3);
      ctx.fill();
      ctx.fillStyle = "#f5c89a";
      ctx.beginPath();
      ctx.arc(-16, 12, 3.5, 0, Math.PI * 2);
      ctx.arc(11 + armExt, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // Yellow power ring
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(11 + armExt, 0, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(11 + armExt, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Muzzle glow while shooting
      if (si.pose > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const glow = ctx.createRadialGradient(11 + armExt + 8, 0, 1, 11 + armExt + 8, 0, 18);
        glow.addColorStop(0, "rgba(254,249,195,0.9)");
        glow.addColorStop(0.4, "rgba(250,204,21,0.5)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(11 + armExt + 8, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Head
      ctx.fillStyle = flash ? "#fef3c7" : "#f5c89a";
      ctx.beginPath();
      ctx.ellipse(0, -22, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bald / high forehead
      ctx.fillStyle = flash ? "#fef3c7" : "#e8b88a";
      ctx.beginPath();
      ctx.ellipse(0, -28, 9, 5, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Stern brows
      ctx.strokeStyle = "#422006";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, -26);
      ctx.lineTo(-2, -24);
      ctx.moveTo(7, -26);
      ctx.lineTo(2, -24);
      ctx.stroke();
      // Eyes — yellow glow
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.ellipse(-3.5, -22, 2.4, 2.2, 0, 0, Math.PI * 2);
      ctx.ellipse(3.5, -22, 2.4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-3.5, -22, 1, 0, Math.PI * 2);
      ctx.arc(3.5, -22, 1, 0, Math.PI * 2);
      ctx.fill();
      // Mustache
      ctx.strokeStyle = "#292524";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-5, -16);
      ctx.quadraticCurveTo(0, -13, 5, -16);
      ctx.stroke();

      ctx.restore();

      // Nameplate + HP bar
      const barW = 70;
      const barX = x - barW / 2;
      const barY = y - 78;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, barX - 4, barY - 14, barW + 8, 28, 5);
      ctx.fill();
      ctx.fillStyle = "#facc15";
      ctx.font = "700 9px Bangers, Impact, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SINESTRO", x, barY - 2);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, barX, barY + 4, barW, 6, 2);
      ctx.fill();
      const pct = si.hp / si.maxHp;
      ctx.fillStyle = pct > 0.4 ? "#eab308" : "#ef4444";
      roundRect(ctx, barX, barY + 4, barW * pct, 6, 2);
      ctx.fill();
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 1;
      roundRect(ctx, barX, barY + 4, barW, 6, 2);
      ctx.stroke();
    };

    const drawBarrier = (b: Barrier) => {
      const gY = ground();
      const alpha = Math.min(1, b.life / 40);
      ctx.save();
      ctx.globalAlpha = 0.35 + alpha * 0.55;
      ctx.globalCompositeOperation = "lighter";

      if (b.kind === "fist") {
        const progress = 1 - b.life / b.maxLife;
        const fx = b.x + progress * (state.current.w * 0.72);
        const glow = ctx.createRadialGradient(fx, gY - 40, 4, fx, gY - 40, 50);
        glow.addColorStop(0, "#fff");
        glow.addColorStop(0.35, "#86efac");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(fx, gY - 40, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#22c55e";
        ctx.strokeStyle = "#bbf7d0";
        ctx.lineWidth = 2.5;
        roundRect(ctx, fx - 28, gY - 70, 70, 55, 12);
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          ctx.strokeRect(fx - 16 + i * 14, gY - 62, 10, 28);
        }
        ctx.restore();
        return;
      }

      const h = 55 + Math.sin(state.current.frame / 6 + b.x) * 3;
      const glow = ctx.createLinearGradient(b.x, gY - h, b.x, gY);
      glow.addColorStop(0, "rgba(187,247,208,0.9)");
      glow.addColorStop(0.5, "rgba(74,222,128,0.7)");
      glow.addColorStop(1, "rgba(21,128,61,0.3)");
      ctx.fillStyle = glow;
      ctx.strokeStyle = "#bbf7d0";
      ctx.lineWidth = 2.5;
      const hw = 14;
      ctx.beginPath();
      ctx.moveTo(b.x, gY - h);
      ctx.lineTo(b.x + hw, gY - h + 8);
      ctx.lineTo(b.x + hw, gY - 8);
      ctx.lineTo(b.x, gY);
      ctx.lineTo(b.x - hw, gY - 8);
      ctx.lineTo(b.x - hw, gY - h + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#14532d";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, gY - h / 2, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#14532d";
      ctx.fillRect(b.x - 4, gY - h / 2 - 1, 8, 2);
      ctx.restore();
    };

    const drawBolt = (b: Bolt) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r * 2.4);
      glow.addColorStop(0, "rgba(254,249,195,0.95)");
      glow.addColorStop(0.35, "rgba(250,204,21,0.7)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 1.5;
      // Fear diamond bolt
      ctx.beginPath();
      ctx.moveTo(b.x - b.r * 1.4, b.y);
      ctx.lineTo(b.x, b.y - b.r);
      ctx.lineTo(b.x + b.r * 0.8, b.y);
      ctx.lineTo(b.x, b.y + b.r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
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
      if (s.ringPulse > 0) s.ringPulse--;
      if (s.sinestro.hitFlash > 0) s.sinestro.hitFlash--;
      if (s.sinestro.pose > 0) s.sinestro.pose--;
      if (s.shieldT > 0) {
        s.shieldT--;
        if (s.shieldT === 0) syncMode();
      }
      if (s.fistT > 0) {
        s.fistT--;
        if (s.fistT === 0) {
          s.announce = "CONSTRUCT FADED";
          s.announceT = 35;
          syncMode();
        }
      }
      s.shake *= 0.86;
      const gY = ground();
      const hx = heroX();
      const sx = sinX();

      // Barriers age + fist vs Sinestro
      for (const b of s.barriers) {
        b.life--;
        if (b.kind === "fist") {
          const progress = 1 - b.life / b.maxLife;
          const fx = b.x + progress * (s.w * 0.72);
          // Punch through bolts
          for (const bolt of s.bolts) {
            if (bolt.life <= 0) continue;
            if (Math.abs(bolt.x - fx) < 42 && Math.abs(bolt.y - (gY - 40)) < 50) {
              bolt.life = 0;
              burst(bolt.x, bolt.y, "#86efac", 8, 2.5);
            }
          }
          // Hit Sinestro once when fist reaches him
          if (!b.fistHit && Math.abs(fx - sx) < 52 && s.sinestro.hp > 0) {
            b.fistHit = true;
            hurtSinestro(28);
            burst(sx, gY - 40, "#86efac", 18, 4);
            s.shake = Math.max(s.shake, 12);
            s.announce = "WILL SMASH!";
            s.announceT = 28;
          }
        }
      }
      s.barriers = s.barriers.filter((b) => b.life > 0 && b.hp > 0);

      if (s.alive && s.sinestro.hp > 0) {
        if (--s.sinestro.shootCd <= 0) fireBolt();

        for (const bolt of s.bolts) {
          bolt.x += bolt.vx * (s.fistT > 0 ? 0.7 : 1);
          bolt.life--;

          // Walls block yellow fear
          for (const b of s.barriers) {
            if (b.kind !== "wall" || bolt.life <= 0) continue;
            if (Math.abs(bolt.x - b.x) < 16 + bolt.r * 0.4) {
              bolt.life = 0;
              b.hp -= 1;
              b.life -= 18;
              burst(b.x, bolt.y, "#4ade80", 8, 2.2);
              burst(b.x, bolt.y, "#facc15", 5, 1.8);
              s.will = Math.min(100, s.will + 10);
              setWill(s.will);
              // Will rebound chips Sinestro
              hurtSinestro(1.5);
              s.score += 12;
              setScore(s.score);
              break;
            }
          }

          if (bolt.life <= 0) continue;

          // Shield ring
          const reach = s.shieldT > 0 ? hx + 40 : hx + 20;
          if (bolt.x < reach) {
            if (s.shieldT > 0) {
              bolt.life = 0;
              burst(hx + 28, bolt.y, "#86efac", 10, 2.5);
              burst(hx + 28, bolt.y, "#facc15", 6, 2);
              s.will = Math.min(100, s.will + 6);
              setWill(s.will);
              hurtSinestro(2);
              s.score += 15;
              setScore(s.score);
              continue;
            }
            // Hit Green Lantern — lose
            s.alive = false;
            s.won = false;
            setAlive(false);
            burst(hx, gY - 20, "#ef4444", 22, 3.5);
            burst(hx, gY - 20, "#facc15", 14, 3);
            s.shake = 14;
            s.announce = "FEAR WINS…";
            s.announceT = 50;
            saveBest();
            break;
          }
        }

        s.bolts = s.bolts.filter((b) => b.life > 0 && b.x > -30);
        s.barriers = s.barriers.filter((b) => b.life > 0 && b.hp > 0);
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
      if (s.fistT > 0) {
        sky.addColorStop(0, "#052e16");
        sky.addColorStop(1, "#14532d");
      } else {
        sky.addColorStop(0, "#0f172a");
        sky.addColorStop(0.45, "#1c1917");
        sky.addColorStop(0.7, "#422006");
        sky.addColorStop(1, "#1a1005");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      // Stars / fear sparks
      ctx.fillStyle = "rgba(250,204,21,0.28)";
      for (let i = 0; i < 16; i++) {
        ctx.fillRect((i * 89 + s.frame * 0.25) % s.w, (i * 41) % (gY - 20), 2, 2);
      }

      ctx.fillStyle = "#1c1917";
      ctx.fillRect(0, gY, s.w, s.h - gY);
      // Split ground glow — green left, yellow right
      const gLine = ctx.createLinearGradient(0, gY, s.w, gY);
      gLine.addColorStop(0, "#4ade80");
      gLine.addColorStop(0.5, "#a3a3a3");
      gLine.addColorStop(1, "#facc15");
      ctx.fillStyle = gLine;
      ctx.fillRect(0, gY, s.w, 3);

      if (s.alive && s.fistT <= 0) {
        ctx.fillStyle = "rgba(74,222,128,0.06)";
        ctx.fillRect(hx + 50, gY - 60, s.w * 0.55, 60);
      }

      for (const b of s.barriers) drawBarrier(b);
      for (const bolt of s.bolts) drawBolt(bolt);

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 16);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      }

      drawLantern(hx, gY - 4);
      drawSinestro(sx, gY - 4);

      // Top HUD — Sinestro HP (full width accent)
      const si = s.sinestro;
      const topBarW = Math.min(s.w - 24, 280);
      const topBarX = (s.w - topBarW) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, topBarX, 8, topBarW, 22, 6);
      ctx.fill();
      ctx.fillStyle = "#facc15";
      ctx.font = "700 10px Bangers, Impact, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SINESTRO", s.w / 2, 18);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, topBarX + 8, 20, topBarW - 16, 6, 2);
      ctx.fill();
      ctx.fillStyle = si.hp / si.maxHp > 0.35 ? "#eab308" : "#ef4444";
      roundRect(ctx, topBarX + 8, 20, (topBarW - 16) * (si.hp / si.maxHp), 6, 2);
      ctx.fill();

      // Will meter
      const meterW = Math.min(s.w - 40, 200);
      const meterX = (s.w - meterW) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, meterX, 36, meterW, 10, 5);
      ctx.fill();
      ctx.fillStyle = s.fistT > 0 ? "#4ade80" : s.shieldT > 0 ? "#86efac" : "#22c55e";
      roundRect(ctx, meterX, 36, (s.will / 100) * meterW, 10, 5);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      roundRect(ctx, meterX, 36, meterW, 10, 5);
      ctx.stroke();

      drawBtn(btnShield(), "SHIELD", s.will >= 50 && s.shieldT <= 0 && s.fistT <= 0, "#16a34a");
      drawBtn(btnFist(), "FIST", s.will >= 100 && s.fistT <= 0, "#15803d");

      const hs = hudScale(s.w);
      ctx.fillStyle = "#86efac";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(18 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`XP ${s.score}`, 12, s.h - 36);
      ctx.fillText(`XP ${s.score}`, 12, s.h - 36);
      ctx.fillStyle = "#4ade80";
      ctx.font = `700 ${Math.round(13 * hs)}px Bangers, Impact, sans-serif`;
      let label = `WILL ${Math.round(s.will)}%`;
      if (s.fistT > 0) label = `GIANT FIST ${Math.ceil(s.fistT / 60)}s`;
      else if (s.shieldT > 0) label = `SHIELD ${Math.ceil(s.shieldT / 60)}s`;
      ctx.strokeText(label, 12, s.h - 16);
      ctx.fillText(label, 12, s.h - 16);

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, s.h * 0.28, s.w, 40);
        ctx.fillStyle = s.announce.includes("SINESTRO") || s.announce.includes("FEAR") ? "#facc15" : "#86efac";
        ctx.font = `700 ${Math.round(20 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText(s.announce, s.w / 2, s.h * 0.28 + 28);
        ctx.fillText(s.announce, s.w / 2, s.h * 0.28 + 28);
        ctx.textAlign = "left";
      }

      if (s.alive && s.frame < 110 && s.announceT <= 0) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `700 ${Math.round(12 * hs)}px Comic Neue, sans-serif`;
        ctx.textAlign = "center";
        const tip = s.w < 500 ? "Block Sinestro's bolts!" : "Place walls to block Sinestro · Fist to finish him";
        ctx.fillText(tip, s.w / 2, s.h * 0.22);
        ctx.textAlign = "left";
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = s.won ? "#86efac" : "#ef4444";
        ctx.font = `700 ${Math.round(26 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        const endMsg = s.won ? "IN BRIGHTEST DAY!" : "WILL BROKEN!";
        ctx.strokeText(endMsg, s.w / 2, s.h / 2);
        ctx.fillText(endMsg, s.w / 2, s.h / 2);
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to try again", s.w / 2, s.h / 2 + 28);
        ctx.textAlign = "left";
      }

      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * state.current.w,
        y: ((e.clientY - r.top) / r.height) * state.current.h,
      };
    };
    const hit = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
      p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) placeWall(state.current.w * 0.45);
      }
      if (e.code === "KeyC") {
        e.preventDefault();
        activateShield();
      }
      if (e.code === "KeyV") {
        e.preventDefault();
        activateFist();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const p = pos(e);
      if (hit(p, btnShield())) return activateShield();
      if (hit(p, btnFist())) return activateFist();
      placeWall(p.x);
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
      title="Fear vs Will"
      tagline="Block Sinestro's yellow bolts · Shield · Giant Fist"
      mobileTagline="Block Sinestro · place walls"
      strip="IN BRIGHTEST DAY"
      stripHint={
        mode === "fist"
          ? "Giant Construct!"
          : mode === "shield"
            ? "Shield Ring!"
            : `Sinestro ${sinestroHp} HP · Will ${will}%`
      }
      loadingLabel="Charging the ring… loading portfolio"
      readyLabel="Sector secure — open the dossier"
      accent="#16a34a"
      accent2="#ca8a04"
      score={score}
      secondaryLabel="Will"
      secondaryValue={will}
      best={best}
      alive={alive}
      aliveHint="Sinestro shoots yellow fear from the right. Tap to place walls. Block bolts for Will · Fist (100) to smash him."
      deadHint="Tap to rematch Sinestro."
      canvasRef={canvasRef}
      ariaLabel="Green Lantern versus Sinestro construct defense mini-game"
    />
  );
}
