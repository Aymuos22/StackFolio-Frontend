import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Villain = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  kind: 0 | 1 | 2;
  hitFlash: number;
  webbed: number;
};

type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  big: boolean;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };

const PX = 52;

/**
 * Spider-Man web shooter — aim + thwip.
 * Improved sprite, web VFX, villain silhouettes, combo + Web-Sense burst.
 */
export default function SpiderWebShooter({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const aimRef = useRef({ x: 400, y: 180 });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [kills, setKills] = useState(0);
  const [sense, setSense] = useState(0);

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    kills: 0,
    sense: 0,
    spawnIn: 32,
    cool: 0,
    shootT: 0,
    senseT: 0,
    combo: 0,
    comboT: 0,
    villains: [] as Villain[],
    shots: [] as Shot[],
    parts: [] as Particle[],
    id: 1,
    shake: 0,
    announce: "",
    announceT: 0,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_spider") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const heroY = () => state.current.h * 0.55;

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
      aimRef.current = { x: w * 0.72, y: h * 0.42 };
    };

    const burst = (x: number, y: number, color: string, n = 10, size = 3) => {
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

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.kills = 0;
      s.sense = 0;
      s.spawnIn = 28;
      s.cool = 0;
      s.shootT = 0;
      s.senseT = 0;
      s.combo = 0;
      s.comboT = 0;
      s.villains = [];
      s.shots = [];
      s.parts = [];
      s.shake = 0;
      s.announce = "THWIP!";
      s.announceT = 40;
      setAlive(true);
      setScore(0);
      setKills(0);
      setSense(0);
    };

    const handPos = () => {
      const s = state.current;
      const hy = heroY();
      const aim = aimRef.current;
      const ang = Math.atan2(aim.y - (hy + 22), aim.x - (PX + 28));
      return {
        x: PX + 28 + Math.cos(ang) * 26,
        y: hy + 22 + Math.sin(ang) * 18,
        ang,
      };
    };

    const fire = (burstShot = false) => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.cool > 0 && !burstShot) return;
      const hand = handPos();
      const dx = aimRef.current.x - hand.x;
      const dy = aimRef.current.y - hand.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = s.senseT > 0 ? 14 : 11.5;
      const count = burstShot || s.senseT > 0 ? 3 : 1;
      for (let i = 0; i < count; i++) {
        const spread = count > 1 ? (i - 1) * 0.12 : 0;
        const c = Math.cos(spread);
        const sn = Math.sin(spread);
        const vx = ((dx / len) * c - (dy / len) * sn) * speed;
        const vy = ((dx / len) * sn + (dy / len) * c) * speed;
        s.shots.push({ x: hand.x, y: hand.y, vx, vy, life: 55, big: burstShot || s.senseT > 0 });
      }
      s.cool = s.senseT > 0 ? 7 : 12;
      s.shootT = 10;
      burst(hand.x, hand.y, "#f8fafc", burstShot ? 10 : 5, 2);
    };

    const trySense = () => {
      const s = state.current;
      if (s.sense < 100 || s.senseT > 0) return;
      s.sense = 0;
      setSense(0);
      s.senseT = 200;
      s.announce = "SPIDER-SENSE!";
      s.announceT = 45;
      s.shake = 8;
      fire(true);
    };

    const toCanvas = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      aimRef.current = {
        x: ((e.clientX - r.left) / r.width) * state.current.w,
        y: ((e.clientY - r.top) / r.height) * state.current.h,
      };
    };

    const drawWebPattern = (cx: number, cy: number, r: number, a = 0.35) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * (0.3 * i), 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawSpider = (x: number, y: number) => {
      const s = state.current;
      const aim = aimRef.current;
      const ang = Math.atan2(aim.y - (y + 22), aim.x - (x + 28));
      const face = ang > -Math.PI / 2 && ang < Math.PI / 2 ? 1 : -1;
      const bob = Math.sin(s.frame / 9) * 1.3;
      const py = y + bob;
      const shooting = s.shootT > 0;
      const sensing = s.senseT > 0;

      if (sensing) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const aura = ctx.createRadialGradient(x + 20, py + 20, 4, x + 20, py + 20, 50);
        aura.addColorStop(0, "rgba(56,189,248,0.45)");
        aura.addColorStop(1, "transparent");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.ellipse(x + 20, py + 20, 40, 48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x + 20, y + 68, 22, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(x + 20, py + 28);
      // Slight lean toward aim
      ctx.rotate(Math.max(-0.25, Math.min(0.25, ang * 0.15)));

      // Legs (red with blue boots)
      ctx.strokeStyle = "#b91c1c";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-8, 12);
      ctx.lineTo(-12, 32);
      ctx.moveTo(8, 12);
      ctx.lineTo(14, 32);
      ctx.stroke();
      ctx.strokeStyle = "#1e3a8a";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-12, 30);
      ctx.lineTo(-14, 38);
      ctx.moveTo(14, 30);
      ctx.lineTo(16, 38);
      ctx.stroke();

      // Torso — red suit with blue mid
      const torso = ctx.createLinearGradient(-16, -18, 16, 20);
      torso.addColorStop(0, "#ef4444");
      torso.addColorStop(0.5, "#dc2626");
      torso.addColorStop(1, "#991b1b");
      ctx.fillStyle = torso;
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-15, -12);
      ctx.quadraticCurveTo(-18, 2, -13, 16);
      ctx.lineTo(13, 16);
      ctx.quadraticCurveTo(18, 2, 15, -12);
      ctx.quadraticCurveTo(0, -18, -15, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Blue chest spider-area
      ctx.fillStyle = "#1d4ed8";
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      drawWebPattern(0, 0, 12, 0.45);

      // Black spider emblem
      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.ellipse(0, -1, 4.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#050505";
      ctx.lineWidth = 1.4;
      for (let i = -1; i <= 1; i++) {
        if (i === 0) continue;
        ctx.beginPath();
        ctx.moveTo(0, -1);
        ctx.quadraticCurveTo(i * 8, -6, i * 10, -10);
        ctx.moveTo(0, 1);
        ctx.quadraticCurveTo(i * 8, 6, i * 10, 10);
        ctx.stroke();
      }

      // Arms
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      // Back arm
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(-22, 6);
      ctx.stroke();
      // Aiming arm toward hand
      const armLen = shooting ? 28 : 24;
      ctx.beginPath();
      ctx.moveTo(8, -2);
      ctx.lineTo(Math.cos(ang) * armLen, Math.sin(ang) * armLen * 0.85 - 2);
      ctx.stroke();
      // Blue gloves
      ctx.fillStyle = "#1e40af";
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-22, 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * armLen, Math.sin(ang) * armLen * 0.85 - 2, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Web shooter detail on aiming wrist
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * armLen, Math.sin(ang) * armLen * 0.85 - 2, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Head — classic lenses
      const hx = face * 2;
      const hy = -26;
      const headG = ctx.createRadialGradient(hx - 2, hy - 2, 2, hx, hy, 16);
      headG.addColorStop(0, "#f87171");
      headG.addColorStop(1, "#b91c1c");
      ctx.fillStyle = headG;
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(hx, hy, 15, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawWebPattern(hx, hy, 13, 0.3);

      // Large white eye lenses (iconic)
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(hx - 6, hy - 1, 6.5, 8.5, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(hx + 6, hy - 1, 6.5, 8.5, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Lens shine
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(hx - 7.5, hy - 4, 2, 2.5, -0.35, 0, Math.PI * 2);
      ctx.ellipse(hx + 4.5, hy - 4, 2, 2.5, 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Web-sense rings when danger / special
      if (sensing || s.announce.includes("SENSE")) {
        ctx.strokeStyle = `rgba(56,189,248,${0.35 + (s.frame % 20) / 50})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hx, hy, 20 + (s.frame % 12), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawVillain = (v: Villain) => {
      const flash = v.hitFlash > 0;
      const webbed = v.webbed > 0;
      ctx.save();
      if (webbed) ctx.globalAlpha = 0.85;

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(v.x + v.w / 2, v.y + v.h + 4, v.w * 0.45, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (v.kind === 0) {
        // Goblin-ish — purple + green glider hint
        ctx.fillStyle = flash ? "#fff" : "#6b21a8";
        roundRect(ctx, v.x, v.y + 8, v.w, v.h - 8, 6);
        ctx.fill();
        ctx.fillStyle = flash ? "#fff" : "#16a34a";
        ctx.beginPath();
        ctx.ellipse(v.x + v.w / 2, v.y + 8, 10, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.ellipse(v.x + v.w / 2 - 4, v.y + 7, 2.5, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(v.x + v.w / 2 + 4, v.y + 7, 2.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#15803d";
        ctx.beginPath();
        ctx.moveTo(v.x - 4, v.y + v.h - 4);
        ctx.lineTo(v.x + v.w + 4, v.y + v.h - 4);
        ctx.lineTo(v.x + v.w / 2, v.y + v.h + 6);
        ctx.closePath();
        ctx.fill();
      } else if (v.kind === 1) {
        // Doc Ock-ish — coat + tentacle hooks
        ctx.fillStyle = flash ? "#fff" : "#0f766e";
        roundRect(ctx, v.x + 4, v.y + 10, v.w - 8, v.h - 10, 5);
        ctx.fill();
        ctx.fillStyle = "#f5c89a";
        ctx.beginPath();
        ctx.ellipse(v.x + v.w / 2, v.y + 8, 8, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#134e4a";
        ctx.fillRect(v.x + 2, v.y + 4, v.w - 4, 5);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        const t = state.current.frame / 10;
        for (let i = 0; i < 4; i++) {
          const side = i < 2 ? -1 : 1;
          const yy = v.y + 18 + (i % 2) * 10;
          ctx.beginPath();
          ctx.moveTo(v.x + v.w / 2, v.y + 22);
          ctx.quadraticCurveTo(
            v.x + v.w / 2 + side * (18 + Math.sin(t + i) * 4),
            yy,
            v.x + v.w / 2 + side * 28,
            yy + Math.cos(t + i) * 6,
          );
          ctx.stroke();
        }
      } else {
        // Symbiote-ish — black/white teeth
        ctx.fillStyle = flash ? "#fff" : "#18181b";
        roundRect(ctx, v.x, v.y + 6, v.w, v.h - 6, 8);
        ctx.fill();
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.ellipse(v.x + v.w / 2, v.y + 14, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(v.x + 8 + i * 5, v.y + 14);
          ctx.lineTo(v.x + 10 + i * 5, v.y + 22);
          ctx.lineTo(v.x + 12 + i * 5, v.y + 14);
          ctx.fill();
        }
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(v.x + v.w / 2 - 6, v.y + 8, 3, 4, 0, 0, Math.PI * 2);
        ctx.ellipse(v.x + v.w / 2 + 6, v.y + 8, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // HP pips
      for (let i = 0; i < v.maxHp; i++) {
        ctx.fillStyle = i < v.hp ? "#fbbf24" : "#44403c";
        ctx.fillRect(v.x + 3 + i * 8, v.y + v.h - 7, 6, 3);
      }

      if (webbed) {
        ctx.strokeStyle = "rgba(248,250,252,0.8)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(v.x, v.y + 6 + i * 8);
          ctx.lineTo(v.x + v.w, v.y + 10 + i * 8);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      if (s.cool > 0) s.cool--;
      if (s.shootT > 0) s.shootT--;
      if (s.announceT > 0) s.announceT--;
      if (s.comboT > 0) {
        s.comboT--;
        if (s.comboT === 0) s.combo = 0;
      }
      if (s.senseT > 0) s.senseT--;
      s.shake *= 0.85;

      if (s.alive) {
        if (--s.spawnIn <= 0) {
          const kind = Math.floor(Math.random() * 3) as 0 | 1 | 2;
          const hp = kind + 1;
          s.villains.push({
            id: s.id++,
            x: s.w + 24,
            y: 40 + Math.random() * s.h * 0.48,
            w: kind === 2 ? 40 : kind === 1 ? 34 : 32,
            h: kind === 2 ? 48 : kind === 1 ? 40 : 38,
            vx: -(1.9 + Math.random() * 1.4) * (1 + Math.min(1.8, s.kills * 0.06)),
            vy: (Math.random() - 0.5) * 0.6,
            hp,
            maxHp: hp,
            kind,
            hitFlash: 0,
            webbed: 0,
          });
          s.spawnIn = Math.max(14, 44 - Math.min(22, s.kills) + Math.random() * 12);
        }

        for (const shot of s.shots) {
          shot.x += shot.vx;
          shot.y += shot.vy;
          shot.life--;
        }
        s.shots = s.shots.filter((shot) => shot.life > 0 && shot.x < s.w + 40 && shot.y > -20 && shot.y < s.h + 20);

        for (const v of s.villains) {
          const slow = v.webbed > 0 ? 0.35 : s.senseT > 0 ? 0.7 : 1;
          if (v.webbed > 0) v.webbed--;
          v.x += v.vx * slow;
          v.y += v.vy * slow + Math.sin((s.frame + v.id) / 16) * 0.35;
          v.y = Math.max(24, Math.min(s.h - 60, v.y));
          if (v.hitFlash > 0) v.hitFlash--;

          for (const shot of s.shots) {
            if (shot.x > v.x - 4 && shot.x < v.x + v.w + 4 && shot.y > v.y - 4 && shot.y < v.y + v.h + 4) {
              shot.life = 0;
              v.hp -= shot.big ? 2 : 1;
              v.hitFlash = 7;
              v.webbed = Math.max(v.webbed, shot.big ? 40 : 22);
              v.vx *= 0.7;
              burst(shot.x, shot.y, "#f8fafc", 8, 2);
              if (v.hp <= 0) {
                burst(v.x + v.w / 2, v.y + v.h / 2, "#ef4444", 16, 3);
                s.kills++;
                s.combo = s.comboT > 0 ? s.combo + 1 : 1;
                s.comboT = 100;
                const pts = (100 + v.kind * 50) * (1 + Math.min(0.6, s.combo * 0.1));
                s.score += Math.round(pts);
                s.sense = Math.min(100, s.sense + 14 + v.kind * 4);
                setSense(Math.round(s.sense));
                s.shake = 6;
                setKills(s.kills);
                setScore(s.score);
                if (s.sense >= 100 && s.senseT <= 0) {
                  s.announce = "SENSE READY!";
                  s.announceT = 35;
                }
              }
            }
          }

          // Spider-sense warning when close
          if (v.x < PX + 100 && v.x > PX + 40 && s.announceT <= 0 && s.frame % 40 === 0) {
            s.announce = "SPIDER-SENSE…";
            s.announceT = 20;
          }

          if (v.x < PX + 36 && v.x + v.w > PX && Math.abs(v.y + v.h / 2 - (heroY() + 24)) < 48) {
            s.alive = false;
            setAlive(false);
            s.shake = 12;
            localStorage.setItem(
              "stackfolio_best_spider",
              String(Math.max(Number(localStorage.getItem("stackfolio_best_spider") || 0), s.score)),
            );
            setBest(Math.max(Number(localStorage.getItem("stackfolio_best_spider") || 0), s.score));
          }
        }
        s.villains = s.villains.filter((v) => v.hp > 0 && v.x + v.w > -20);
      }

      for (const p of s.parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      }
      s.parts = s.parts.filter((p) => p.life > 0);

      ctx.save();
      if (s.shake > 0.5) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      // Night NYC sky
      const sky = ctx.createLinearGradient(0, 0, 0, s.h);
      sky.addColorStop(0, "#0f172a");
      sky.addColorStop(0.45, "#1e1b4b");
      sky.addColorStop(1, "#312e81");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      // Moon
      ctx.fillStyle = "rgba(248,250,252,0.15)";
      ctx.beginPath();
      ctx.arc(s.w * 0.82, s.h * 0.16, 28, 0, Math.PI * 2);
      ctx.fill();

      // Buildings
      for (let i = 0; i < 16; i++) {
        const bx = ((i * 78 + s.frame * 0.25) % (s.w + 60)) - 30;
        const bh = 50 + ((i * 47) % 100);
        ctx.fillStyle = i % 3 === 0 ? "#1e293b" : "#0f172a";
        ctx.fillRect(bx, s.h - bh - 28, 42, bh);
        // Windows
        ctx.fillStyle = "rgba(250,204,21,0.35)";
        for (let wy = s.h - bh - 20; wy < s.h - 36; wy += 10) {
          for (let wx = bx + 6; wx < bx + 36; wx += 10) {
            if ((wx + wy + i) % 3 !== 0) ctx.fillRect(wx, wy, 4, 4);
          }
        }
      }
      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(0, s.h - 28, s.w, 28);
      ctx.fillStyle = "#e11d48";
      ctx.fillRect(0, s.h - 28, s.w, 3);

      // Aim laser + crosshair
      const hand = handPos();
      ctx.strokeStyle = s.senseT > 0 ? "rgba(56,189,248,0.5)" : "rgba(244,63,94,0.4)";
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hand.x, hand.y);
      ctx.lineTo(aimRef.current.x, aimRef.current.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(aimRef.current.x, aimRef.current.y, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(aimRef.current.x - 16, aimRef.current.y);
      ctx.lineTo(aimRef.current.x - 6, aimRef.current.y);
      ctx.moveTo(aimRef.current.x + 6, aimRef.current.y);
      ctx.lineTo(aimRef.current.x + 16, aimRef.current.y);
      ctx.moveTo(aimRef.current.x, aimRef.current.y - 16);
      ctx.lineTo(aimRef.current.x, aimRef.current.y - 6);
      ctx.moveTo(aimRef.current.x, aimRef.current.y + 6);
      ctx.lineTo(aimRef.current.x, aimRef.current.y + 16);
      ctx.stroke();

      for (const v of s.villains) drawVillain(v);

      // Web shots
      for (const shot of s.shots) {
        ctx.strokeStyle = shot.big ? "#e0f2fe" : "#f8fafc";
        ctx.lineWidth = shot.big ? 3 : 2.2;
        ctx.lineCap = "round";
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(shot.x, shot.y);
        ctx.lineTo(shot.x - shot.vx * 2, shot.y - shot.vy * 2);
        ctx.stroke();
        // Web splat tip
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, shot.big ? 4.5 : 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Tiny web strands
        ctx.strokeStyle = "rgba(248,250,252,0.5)";
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(shot.x, shot.y);
          ctx.lineTo(shot.x - shot.vx + i * 4, shot.y - shot.vy - i * 3);
          ctx.stroke();
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

      drawSpider(PX, heroY());

      // Sense meter
      const meterW = Math.min(s.w - 40, 200);
      const meterX = (s.w - meterW) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, meterX, 10, meterW, 10, 5);
      ctx.fill();
      ctx.fillStyle = s.senseT > 0 ? "#38bdf8" : "#e11d48";
      roundRect(ctx, meterX, 10, ((s.senseT > 0 ? 100 : s.sense) / 100) * meterW, 10, 5);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      roundRect(ctx, meterX, 10, meterW, 10, 5);
      ctx.stroke();

      const hs = hudScale(s.w);
      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(20 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`THWIP ${s.score}`, 12, 40);
      ctx.fillText(`THWIP ${s.score}`, 12, 40);
      if (s.combo > 1) {
        ctx.fillStyle = "#fb7185";
        ctx.font = `700 ${Math.round(13 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText(`x${s.combo} COMBO`, 12, 58);
        ctx.fillText(`x${s.combo} COMBO`, 12, 58);
      }
      ctx.fillStyle = s.senseT > 0 ? "#38bdf8" : "#fda4af";
      ctx.font = `700 ${Math.round(11 * hs)}px Bangers, Impact, sans-serif`;
      ctx.textAlign = "right";
      ctx.strokeText(s.senseT > 0 ? `SENSE ${Math.ceil(s.senseT / 60)}s` : `SENSE ${Math.round(s.sense)}%`, s.w - 12, 40);
      ctx.fillText(s.senseT > 0 ? `SENSE ${Math.ceil(s.senseT / 60)}s` : `SENSE ${Math.round(s.sense)}%`, s.w - 12, 40);
      ctx.textAlign = "left";

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, s.h * 0.22, s.w, 36);
        ctx.fillStyle = s.announce.includes("SENSE") ? "#38bdf8" : "#fb7185";
        ctx.font = `700 ${Math.round(20 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText(s.announce, s.w / 2, s.h * 0.22 + 26);
        ctx.fillText(s.announce, s.w / 2, s.h * 0.22 + 26);
        ctx.textAlign = "left";
      }

      if (s.alive && s.frame < 100 && s.announceT <= 0) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `700 ${Math.round(12 * hs)}px Comic Neue, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(s.w < 500 ? "Aim + tap to thwip! C = Sense" : "Aim with mouse · click/Space to fire · C for Spider-Sense", s.w / 2, s.h * 0.18);
        ctx.textAlign = "left";
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#e11d48";
        ctx.font = `700 ${Math.round(34 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText("GOTCHA!", s.w / 2, s.h / 2);
        ctx.fillText("GOTCHA!", s.w / 2, s.h / 2);
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to try again", s.w / 2, s.h / 2 + 28);
        ctx.textAlign = "left";
      }

      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        fire();
      }
      if (e.code === "KeyC" || e.code === "KeyV") {
        e.preventDefault();
        if (!state.current.alive) return reset();
        trySense();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      toCanvas(e);
    };
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      toCanvas(e);
      // Tap sense meter area on mobile
      const r = canvas.getBoundingClientRect();
      const y = ((e.clientY - r.top) / r.height) * state.current.h;
      const x = ((e.clientX - r.left) / r.width) * state.current.w;
      const meterW = Math.min(state.current.w - 40, 200);
      const meterX = (state.current.w - meterW) / 2;
      if (y < 28 && x >= meterX && x <= meterX + meterW && state.current.sense >= 100) {
        trySense();
        return;
      }
      fire();
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

  return (
    <GameShell
      ready={ready}
      onEnter={onEnter}
      title="Web Shooter"
      tagline="Aim and thwip · combos · fill Spider-Sense for a web burst"
      mobileTagline="Tap to shoot · fill Sense meter"
      strip="THWIP MODE"
      stripHint={sense >= 100 ? "Sense ready — tap meter / C!" : `Sense ${sense}%`}
      loadingLabel="Villains inbound… loading portfolio"
      readyLabel="City clear — open the issue"
      accent="#e10600"
      accent2="#1e3a8a"
      score={score}
      secondaryLabel="KOs"
      secondaryValue={kills}
      best={best}
      alive={alive}
      aliveHint="Aim with mouse, click / Space to fire. Webs slow foes. Fill Sense (C or tap meter) for a triple burst."
      deadHint="Webbed out! Tap to fight again."
      canvasRef={canvasRef}
      ariaLabel="Spider-Man web shooter mini-game"
    />
  );
}
