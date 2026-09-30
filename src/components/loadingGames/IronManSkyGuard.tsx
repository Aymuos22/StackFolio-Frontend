import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Hazard = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  kind: "missile" | "drone" | "ultron";
  spin?: number;
  shootCd?: number;
  hp?: number;
};
type Ring = { x: number; y: number; r: number; vx: number; taken: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size?: number };
type Beam = { x: number; y: number; life: number; max: number; width: number };
type Shot = { x: number; y: number; vx: number; vy: number; life: number; kind: "repulsor" | "ultron"; w: number };

/**
 * Iron Man sky guard — fly, collect rings, dodge threats.
 * Tap = Repulsor / Unibeam when charged (no buttons).
 */
export default function IronManSkyGuard({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const targetY = useRef(180);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [rings, setRings] = useState(0);

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    rings: 0,
    y: 180,
    spawnH: 35,
    spawnR: 50,
    hazards: [] as Hazard[],
    collect: [] as Ring[],
    parts: [] as Particle[],
    shots: [] as Shot[],
    shake: 0,
    trail: [] as { x: number; y: number; life: number }[],
    power: 0,
    beam: null as Beam | null,
    announce: "",
    announceT: 0,
    flashT: 0,
    invuln: 0,
    specialCool: 0,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_ironman") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
      state.current.y = h * 0.45;
      targetY.current = h * 0.45;
    };

    const burst = (x: number, y: number, color: string, n = 14, size = 3) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 4;
        state.current.parts.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 20,
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
      s.rings = 0;
      s.y = s.h * 0.45;
      targetY.current = s.y;
      s.spawnH = 30;
      s.spawnR = 40;
      s.hazards = [];
      s.collect = [];
      s.parts = [];
      s.shots = [];
      s.trail = [];
      s.shake = 0;
      s.power = 0;
      s.beam = null;
      s.announce = "JARVIS ONLINE";
      s.announceT = 45;
      s.flashT = 0;
      s.invuln = 0;
      s.specialCool = 0;
      setAlive(true);
      setScore(0);
      setRings(0);
    };

    const fireSpecial = () => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.specialCool > 0) return;
      if (s.power >= 100) {
        s.power = 0;
        s.beam = { x: 132, y: s.y + 8, life: 48, max: 48, width: 36 };
        s.announce = "UNIBEAM!";
        s.announceT = 48;
        s.shake = 18;
        s.flashT = 22;
        s.invuln = 50;
        s.specialCool = 36;
        burst(132, s.y + 8, "#e0f2fe", 36, 5);
        burst(132, s.y + 8, "#38bdf8", 24, 4);
        burst(132, s.y + 8, "#fbbf24", 18, 3.5);
        return;
      }
      // Twin repulsor beams
      s.announce = "REPULSORS!";
      s.announceT = 28;
      s.shake = 8;
      s.flashT = 10;
      s.specialCool = 18;
      const hx = 130;
      const hy = s.y + 6;
      for (const dy of [-10, 10]) {
        s.shots.push({
          x: hx,
          y: hy + dy,
          vx: 14,
          vy: dy * 0.08,
          life: 42,
          kind: "repulsor",
          w: 56,
        });
      }
      burst(hx, hy, "#7dd3fc", 14, 2.8);
      burst(hx, hy, "#e0f2fe", 10, 2);
      s.power = Math.min(100, s.power + 10);
    };

    const pointer = (e: PointerEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      targetY.current = ((e.clientY - r.top) / r.height) * state.current.h;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        targetY.current -= 28;
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        targetY.current += 28;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) fireSpecial();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };

    const drawIronMan = (x: number, y: number) => {
      const s = state.current;
      const lean = (targetY.current - s.y) * 0.02;

      // Thruster glow
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const thrust = ctx.createRadialGradient(x - 4, y + 14, 1, x - 8, y + 18, 22);
      thrust.addColorStop(0, "#e0f2fe");
      thrust.addColorStop(0.35, "#38bdf8");
      thrust.addColorStop(1, "transparent");
      ctx.fillStyle = thrust;
      ctx.beginPath();
      ctx.ellipse(x - 6, y + 16, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      // Boot thrusters
      ctx.fillStyle = "rgba(251,191,36,0.55)";
      ctx.beginPath();
      ctx.ellipse(x + 6, y + 36, 4, 8, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 18, y + 36, 4, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x + 14, y + 10);
      ctx.rotate(Math.max(-0.2, Math.min(0.2, lean)));
      ctx.translate(-(x + 14), -(y + 10));

      // Legs
      ctx.fillStyle = "#b91c1c";
      ctx.strokeStyle = "#7f1d1d";
      ctx.lineWidth = 1.8;
      roundRect(ctx, x + 2, y + 18, 8, 18, 3);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, x + 16, y + 18, 8, 18, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f59e0b";
      roundRect(ctx, x + 3, y + 32, 6, 4, 1);
      ctx.fill();
      roundRect(ctx, x + 17, y + 32, 6, 4, 1);
      ctx.fill();

      // Torso armor
      const chest = ctx.createLinearGradient(x, y - 6, x + 30, y + 24);
      chest.addColorStop(0, "#fca5a5");
      chest.addColorStop(0.45, "#dc2626");
      chest.addColorStop(1, "#7f1d1d");
      ctx.fillStyle = chest;
      ctx.strokeStyle = "#450a0a";
      ctx.lineWidth = 2.2;
      roundRect(ctx, x, y - 4, 30, 28, 8);
      ctx.fill();
      ctx.stroke();
      // Gold chest accents
      ctx.fillStyle = "#fbbf24";
      roundRect(ctx, x + 4, y + 2, 22, 4, 1);
      ctx.fill();
      roundRect(ctx, x + 2, y + 16, 8, 6, 2);
      ctx.fill();
      roundRect(ctx, x + 20, y + 16, 8, 6, 2);
      ctx.fill();

      // Arc reactor
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const reactor = ctx.createRadialGradient(x + 15, y + 9, 1, x + 15, y + 9, 10);
      reactor.addColorStop(0, "#f0f9ff");
      reactor.addColorStop(0.4, "#38bdf8");
      reactor.addColorStop(1, "rgba(3,105,161,0)");
      ctx.fillStyle = reactor;
      ctx.beginPath();
      ctx.arc(x + 15, y + 9, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#0ea5e9";
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + 15, y + 9, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f0f9ff";
      ctx.beginPath();
      ctx.arc(x + 15, y + 9, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Helmet
      ctx.fillStyle = "#dc2626";
      ctx.strokeStyle = "#450a0a";
      ctx.lineWidth = 2;
      roundRect(ctx, x + 3, y - 22, 24, 20, 8);
      ctx.fill();
      ctx.stroke();
      // Faceplate gold
      ctx.fillStyle = "#fbbf24";
      roundRect(ctx, x + 7, y - 16, 16, 11, 4);
      ctx.fill();
      // Eye slits
      ctx.fillStyle = "#7dd3fc";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 10;
      roundRect(ctx, x + 9, y - 13, 5, 3.5, 1);
      ctx.fill();
      roundRect(ctx, x + 16, y - 13, 5, 3.5, 1);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Forward arm + repulsor
      ctx.fillStyle = "#b91c1c";
      roundRect(ctx, x + 26, y + 2, 16, 9, 3);
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      roundRect(ctx, x + 36, y + 3, 6, 7, 2);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const rep = ctx.createRadialGradient(x + 44, y + 6, 1, x + 44, y + 6, 10);
      rep.addColorStop(0, "#e0f2fe");
      rep.addColorStop(0.5, "#38bdf8");
      rep.addColorStop(1, "transparent");
      ctx.fillStyle = rep;
      ctx.beginPath();
      ctx.arc(x + 44, y + 6, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();
    };

    const tick = () => {
      if (!running) return;
      const s = state.current;
      s.frame++;
      s.shake *= 0.85;
      if (s.announceT > 0) s.announceT--;
      if (s.flashT > 0) s.flashT--;
      if (s.invuln > 0) s.invuln--;
      if (s.specialCool > 0) s.specialCool--;

      const minY = 36;
      const maxY = s.h - 50;
      targetY.current = Math.max(minY, Math.min(maxY, targetY.current));
      s.y += (targetY.current - s.y) * 0.18;

      // Unibeam — wide chest laser, melts everything in the lane
      if (s.beam) {
        s.beam.y = s.y + 8;
        s.beam.life--;
        const halfW = s.beam.width * (0.55 + 0.45 * (s.beam.life / s.beam.max));
        for (const h of s.hazards) {
          if (h.x > s.beam.x - 10 && Math.abs(h.y + h.h / 2 - s.beam.y) < halfW + h.h * 0.4) {
            burst(h.x + h.w / 2, h.y + h.h / 2, "#e0f2fe", 16, 3.5);
            burst(h.x + h.w / 2, h.y + h.h / 2, "#fbbf24", 12, 3);
            h.x = -80;
            s.score += 160;
            s.rings++;
            setRings(s.rings);
          }
        }
        // Also clear enemy shots
        for (const sh of s.shots) {
          if (sh.kind === "ultron" && sh.x > s.beam.x && Math.abs(sh.y - s.beam.y) < halfW) {
            sh.life = 0;
            burst(sh.x, sh.y, "#7dd3fc", 6, 2);
          }
        }
        if (s.frame % 3 === 0) {
          burst(s.beam.x + 40 + Math.random() * 120, s.beam.y + (Math.random() - 0.5) * halfW, "#e0f2fe", 2, 2);
        }
        if (s.beam.life <= 0) s.beam = null;
        setScore(s.score);
      }

      // Player + enemy beam shots
      for (const sh of s.shots) {
        sh.x += sh.vx;
        sh.y += sh.vy;
        sh.life--;
      }
      // Repulsor hits
      for (const sh of s.shots) {
        if (sh.kind !== "repulsor" || sh.life <= 0) continue;
        for (const h of s.hazards) {
          if (h.x < -40) continue;
          if (sh.x + sh.w > h.x && sh.x < h.x + h.w && Math.abs(sh.y - (h.y + h.h / 2)) < 16 + h.h * 0.35) {
            h.hp = (h.hp ?? 1) - 1;
            sh.life = 0;
            burst(h.x, h.y + h.h / 2, "#7dd3fc", 10, 2.5);
            if ((h.hp ?? 0) <= 0) {
              h.x = -80;
              s.score += h.kind === "ultron" ? 90 : 55;
              setScore(s.score);
              burst(h.x + 40, h.y, "#f87171", 12, 3);
            }
          }
        }
        // Repulsors cancel Ultron beams
        for (const enemy of s.shots) {
          if (enemy.kind !== "ultron" || enemy.life <= 0) continue;
          if (Math.abs(sh.x - enemy.x) < 30 && Math.abs(sh.y - enemy.y) < 14) {
            enemy.life = 0;
            sh.life = Math.max(0, sh.life - 8);
            burst(sh.x, sh.y, "#fbbf24", 8, 2);
          }
        }
      }
      s.shots = s.shots.filter((sh) => sh.life > 0 && sh.x < s.w + 80 && sh.x > -40);

      if (s.alive) {
        s.score += 1;
        if (s.frame % 8 === 0) setScore(s.score);
        if (s.frame % 20 === 0) s.power = Math.min(100, s.power + 2);

        s.trail.push({ x: 90, y: s.y + 8, life: 14 });
        s.trail = s.trail.filter((t) => {
          t.life--;
          t.x -= 4;
          return t.life > 0;
        });

        if (--s.spawnH <= 0) {
          const roll = Math.random();
          const kind: Hazard["kind"] = roll > 0.7 ? "ultron" : roll > 0.38 ? "missile" : "drone";
          s.hazards.push({
            x: s.w + 24,
            y: 40 + Math.random() * (s.h - 100),
            w: kind === "missile" ? 36 : kind === "ultron" ? 34 : 30,
            h: kind === "missile" ? 12 : kind === "ultron" ? 32 : 26,
            vx: -(3.0 + Math.random() * 2 + Math.min(3, s.score / 900) + (kind === "ultron" ? 0.5 : 0)),
            kind,
            spin: 0,
            shootCd: kind === "ultron" ? 40 + Math.random() * 30 : kind === "drone" ? 55 + Math.random() * 40 : 999,
            hp: kind === "ultron" ? 3 : kind === "drone" ? 2 : 1,
          });
          s.spawnH = Math.max(12, 34 - s.score / 400 + Math.random() * 12);
        }

        if (--s.spawnR <= 0) {
          s.collect.push({
            x: s.w + 10,
            y: 50 + Math.random() * (s.h - 120),
            r: 12,
            vx: -2.6,
            taken: false,
          });
          s.spawnR = 32 + Math.random() * 32;
        }

        for (const h of s.hazards) {
          h.x += h.vx;
          h.spin = (h.spin || 0) + (h.kind === "drone" ? 0.35 : 0.08);
          if (h.kind === "ultron") h.y += Math.sin((s.frame + h.x) / 14) * 1.4;
          if (h.kind === "drone") h.y += Math.sin((s.frame + h.x) / 10) * 0.9;
          // Ultron / drone fire red energy beams at Tony
          if (h.shootCd !== undefined) {
            h.shootCd--;
            if (h.shootCd <= 0 && h.x < s.w - 20 && h.x > 140) {
              const ty = s.y + 8;
              const dx = 90 - h.x;
              const dy = ty - (h.y + h.h / 2);
              const len = Math.hypot(dx, dy) || 1;
              const speed = h.kind === "ultron" ? 5.5 : 4.2;
              s.shots.push({
                x: h.x,
                y: h.y + h.h / 2,
                vx: (dx / len) * speed,
                vy: (dy / len) * speed,
                life: 70,
                kind: "ultron",
                w: h.kind === "ultron" ? 48 : 32,
              });
              h.shootCd = h.kind === "ultron" ? 50 + Math.random() * 35 : 70 + Math.random() * 40;
              burst(h.x, h.y + h.h / 2, "#f87171", 6, 2);
            }
          }
        }
        for (const r of s.collect) r.x += r.vx;

        const hx = 96;
        const hy = s.y;
        const hw = 34;
        const hh = 28;

        for (const r of s.collect) {
          if (!r.taken && Math.hypot(r.x - (hx + 14), r.y - (hy + 6)) < r.r + 16) {
            r.taken = true;
            s.rings++;
            s.score += 120;
            s.power = Math.min(100, s.power + 18);
            setRings(s.rings);
            setScore(s.score);
            burst(r.x, r.y, "#fbbf24", 14, 3);
            if (s.power >= 100 && s.announceT <= 0) {
              s.announce = "UNIBEAM CHARGED — TAP!";
              s.announceT = 36;
            } else if (s.announceT <= 0 && s.rings % 5 === 0) {
              s.announce = "POWER RING!";
              s.announceT = 24;
            }
          }
        }

        if (s.invuln <= 0) {
          for (const h of s.hazards) {
            if (hx < h.x + h.w && hx + hw > h.x && hy < h.y + h.h && hy + hh > h.y) {
              s.alive = false;
              setAlive(false);
              burst(hx + 14, hy + 10, "#ef4444", 26, 3.5);
              burst(hx + 14, hy + 10, "#fbbf24", 12, 2.5);
              s.announce = "SYSTEMS DOWN!";
              s.announceT = 50;
              localStorage.setItem(
                "stackfolio_best_ironman",
                String(Math.max(Number(localStorage.getItem("stackfolio_best_ironman") || 0), s.score)),
              );
              setBest(Math.max(Number(localStorage.getItem("stackfolio_best_ironman") || 0), s.score));
              s.shake = 12;
            }
          }
          // Hit by Ultron/drone beams
          for (const sh of s.shots) {
            if (sh.kind !== "ultron" || sh.life <= 0) continue;
            if (sh.x < hx + hw && sh.x + sh.w > hx && Math.abs(sh.y - (hy + hh / 2)) < 14) {
              s.alive = false;
              setAlive(false);
              burst(hx + 14, hy + 10, "#ef4444", 22, 3.5);
              s.announce = "SYSTEMS DOWN!";
              s.announceT = 50;
              localStorage.setItem(
                "stackfolio_best_ironman",
                String(Math.max(Number(localStorage.getItem("stackfolio_best_ironman") || 0), s.score)),
              );
              setBest(Math.max(Number(localStorage.getItem("stackfolio_best_ironman") || 0), s.score));
              s.shake = 12;
              break;
            }
          }
        }

        s.hazards = s.hazards.filter((h) => h.x > -60);
        s.collect = s.collect.filter((r) => !r.taken && r.x > -40);
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
      sky.addColorStop(0, "#0c1b2a");
      sky.addColorStop(0.4, "#1e1b4b");
      sky.addColorStop(0.75, "#3b0a1a");
      sky.addColorStop(1, "#1a0508");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      // Distant lights
      ctx.fillStyle = "rgba(251,191,36,0.25)";
      for (let i = 0; i < 20; i++) {
        ctx.fillRect((i * 73 + s.frame * 0.15) % s.w, 20 + (i * 37) % (s.h * 0.45), 2, 2);
      }

      // Clouds
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 140 - s.frame * 1.4) % (s.w + 120)) - 60;
        ctx.beginPath();
        ctx.ellipse(cx, 40 + i * 28, 50, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // City
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      for (let i = 0; i < 14; i++) {
        const bh = 28 + ((i * 47) % 55);
        ctx.fillRect(i * 60 - ((s.frame * 0.4) % 60), s.h - bh, 48, bh + 10);
        ctx.fillStyle = "rgba(251,191,36,0.2)";
        for (let wy = s.h - bh + 6; wy < s.h - 8; wy += 10) {
          ctx.fillRect(i * 60 - ((s.frame * 0.4) % 60) + 8, wy, 3, 3);
          ctx.fillRect(i * 60 - ((s.frame * 0.4) % 60) + 20, wy, 3, 3);
        }
        ctx.fillStyle = "rgba(0,0,0,0.5)";
      }

      // Trail
      for (const t of s.trail) {
        ctx.globalAlpha = t.life / 14;
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3 + (14 - t.life) * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Unibeam — thick chest cannon
      if (s.beam) {
        const a = s.beam.life / s.beam.max;
        const half = s.beam.width * (0.5 + 0.5 * a);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        // Outer glow
        const outer = ctx.createLinearGradient(s.beam.x, s.beam.y, s.w, s.beam.y);
        outer.addColorStop(0, `rgba(56,189,248,${a * 0.55})`);
        outer.addColorStop(0.4, `rgba(125,211,252,${a * 0.4})`);
        outer.addColorStop(1, "transparent");
        ctx.fillStyle = outer;
        ctx.beginPath();
        ctx.moveTo(s.beam.x, s.beam.y - half * 1.4);
        ctx.lineTo(s.w, s.beam.y - half * 2.2);
        ctx.lineTo(s.w, s.beam.y + half * 2.2);
        ctx.lineTo(s.beam.x, s.beam.y + half * 1.4);
        ctx.closePath();
        ctx.fill();
        // Core white-cyan
        const core = ctx.createLinearGradient(s.beam.x, s.beam.y, s.w * 0.7, s.beam.y);
        core.addColorStop(0, `rgba(255,255,255,${a})`);
        core.addColorStop(0.25, `rgba(224,242,254,${a * 0.95})`);
        core.addColorStop(0.55, `rgba(56,189,248,${a * 0.75})`);
        core.addColorStop(0.85, `rgba(251,191,36,${a * 0.35})`);
        core.addColorStop(1, "transparent");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.moveTo(s.beam.x, s.beam.y - half * 0.45);
        ctx.lineTo(s.w, s.beam.y - half * 0.7);
        ctx.lineTo(s.w, s.beam.y + half * 0.7);
        ctx.lineTo(s.beam.x, s.beam.y + half * 0.45);
        ctx.closePath();
        ctx.fill();
        // Muzzle bloom
        const muzzle = ctx.createRadialGradient(s.beam.x, s.beam.y, 2, s.beam.x, s.beam.y, 28);
        muzzle.addColorStop(0, `rgba(255,255,255,${a})`);
        muzzle.addColorStop(0.4, `rgba(56,189,248,${a * 0.7})`);
        muzzle.addColorStop(1, "transparent");
        ctx.fillStyle = muzzle;
        ctx.beginPath();
        ctx.arc(s.beam.x, s.beam.y, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Beam shots (repulsor cyan / ultron red)
      for (const sh of s.shots) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const ang = Math.atan2(sh.vy, sh.vx);
        ctx.translate(sh.x, sh.y);
        ctx.rotate(ang);
        if (sh.kind === "repulsor") {
          const g = ctx.createLinearGradient(0, 0, sh.w, 0);
          g.addColorStop(0, "rgba(224,242,254,0.95)");
          g.addColorStop(0.4, "rgba(56,189,248,0.85)");
          g.addColorStop(1, "rgba(14,165,233,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(sh.w * 0.45, 0, sh.w * 0.5, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath();
          ctx.ellipse(sh.w * 0.35, 0, sh.w * 0.28, 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const g = ctx.createLinearGradient(0, 0, sh.w, 0);
          g.addColorStop(0, "rgba(254,202,202,0.95)");
          g.addColorStop(0.35, "rgba(239,68,68,0.9)");
          g.addColorStop(1, "rgba(127,29,29,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(sh.w * 0.4, 0, sh.w * 0.45, 4.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(254,240,138,0.8)";
          ctx.beginPath();
          ctx.ellipse(sh.w * 0.25, 0, sh.w * 0.2, 1.8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Rings
      for (const r of s.collect) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const rg = ctx.createRadialGradient(r.x, r.y, 2, r.x, r.y, r.r + 6);
        rg.addColorStop(0, "rgba(251,191,36,0.5)");
        rg.addColorStop(1, "transparent");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r - 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hazards
      for (const h of s.hazards) {
        if (h.kind === "missile") {
          ctx.fillStyle = "#ef4444";
          ctx.strokeStyle = "#7f1d1d";
          ctx.lineWidth = 2;
          roundRect(ctx, h.x, h.y, h.w, h.h, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.moveTo(h.x + h.w, h.y);
          ctx.lineTo(h.x + h.w + 12, h.y + h.h / 2);
          ctx.lineTo(h.x + h.w, h.y + h.h);
          ctx.fill();
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(h.x - 10, h.y + 2, 10, h.h - 4);
        } else if (h.kind === "ultron") {
          // Ultron — chrome body + red eye + charging glow
          const cx = h.x + h.w / 2;
          const cy = h.y + h.h / 2;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const charge = h.shootCd !== undefined && h.shootCd < 18;
          if (charge) {
            const g = ctx.createRadialGradient(cx - 8, cy, 2, cx - 8, cy, 22);
            g.addColorStop(0, "rgba(248,113,113,0.7)");
            g.addColorStop(1, "transparent");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(cx - 8, cy, 22, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          const metal = ctx.createLinearGradient(h.x, h.y, h.x + h.w, h.y + h.h);
          metal.addColorStop(0, "#e4e4e7");
          metal.addColorStop(0.5, "#71717a");
          metal.addColorStop(1, "#3f3f46");
          ctx.fillStyle = metal;
          ctx.strokeStyle = "#18181b";
          ctx.lineWidth = 2;
          roundRect(ctx, h.x, h.y, h.w, h.h, 7);
          ctx.fill();
          ctx.stroke();
          // Crest
          ctx.fillStyle = "#52525b";
          ctx.beginPath();
          ctx.moveTo(cx, h.y - 4);
          ctx.lineTo(cx - 8, h.y + 8);
          ctx.lineTo(cx + 8, h.y + 8);
          ctx.closePath();
          ctx.fill();
          // Eye
          ctx.fillStyle = charge ? "#fef08a" : "#ef4444";
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = charge ? 14 : 8;
          ctx.beginPath();
          ctx.ellipse(cx, h.y + 12, 7, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#450a0a";
          ctx.beginPath();
          ctx.arc(cx, h.y + 12, 2, 0, Math.PI * 2);
          ctx.fill();
          // Mouth grille
          ctx.fillStyle = "#27272a";
          for (let i = 0; i < 4; i++) {
            ctx.fillRect(h.x + 7 + i * 5, h.y + 20, 3, 6);
          }
        } else {
          // Sentinel drone — spinning rotors + scan eye
          const cx = h.x + h.w / 2;
          const cy = h.y + h.h / 2;
          const spin = h.spin || 0;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, 20);
          aura.addColorStop(0, "rgba(167,139,250,0.35)");
          aura.addColorStop(1, "transparent");
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(cx, cy, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          // Rotors
          ctx.strokeStyle = "rgba(196,181,253,0.7)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const a = spin + (i / 3) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * 4, cy - 10 + Math.sin(a) * 3);
            ctx.lineTo(cx + Math.cos(a) * 16, cy - 10 + Math.sin(a) * 8);
            ctx.stroke();
          }
          ctx.fillStyle = "#6d28d9";
          ctx.strokeStyle = "#4c1d95";
          ctx.lineWidth = 2;
          roundRect(ctx, h.x + 2, h.y + 6, h.w - 4, h.h - 8, 8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#f472b6";
          ctx.beginPath();
          ctx.arc(cx, cy + 2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fce7f3";
          ctx.beginPath();
          ctx.arc(cx - 1, cy + 1, 2, 0, Math.PI * 2);
          ctx.fill();
          // Landing struts
          ctx.strokeStyle = "#a78bfa";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(h.x + 6, h.y + h.h - 4);
          ctx.lineTo(h.x + 2, h.y + h.h + 4);
          ctx.moveTo(h.x + h.w - 6, h.y + h.h - 4);
          ctx.lineTo(h.x + h.w - 2, h.y + h.h + 4);
          ctx.stroke();
        }
      }

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 16);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size || 3, p.size || 3);
        ctx.globalAlpha = 1;
      }

      drawIronMan(90, s.y);

      // White/cyan flash on specials
      if (s.flashT > 0) {
        const a = s.flashT / 16;
        ctx.fillStyle = `rgba(224,242,254,${a * 0.35})`;
        ctx.fillRect(0, 0, s.w, s.h);
      }

      // Guide
      ctx.strokeStyle = "rgba(56,189,248,0.2)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, targetY.current + 10);
      ctx.lineTo(s.w, targetY.current + 10);
      ctx.stroke();
      ctx.setLineDash([]);

      // Power meter (charges Unibeam)
      const meterW = Math.min(s.w - 40, 180);
      const meterX = (s.w - meterW) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, meterX, 10, meterW, 10, 5);
      ctx.fill();
      ctx.fillStyle = s.power >= 100 ? "#fbbf24" : "#38bdf8";
      roundRect(ctx, meterX, 10, (s.power / 100) * meterW, 10, 5);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      roundRect(ctx, meterX, 10, meterW, 10, 5);
      ctx.stroke();

      const hs = hudScale(s.w);
      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(20 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`POWER ${s.score}`, 14, 42);
      ctx.fillText(`POWER ${s.score}`, 14, 42);
      ctx.fillStyle = "#7dd3fc";
      ctx.font = `700 ${Math.round(11 * hs)}px Bangers, Impact, sans-serif`;
      ctx.textAlign = "right";
      ctx.strokeText(s.power >= 100 ? "UNIBEAM READY" : `ARC ${Math.round(s.power)}%`, s.w - 12, 42);
      ctx.fillText(s.power >= 100 ? "UNIBEAM READY" : `ARC ${Math.round(s.power)}%`, s.w - 12, 42);
      ctx.textAlign = "left";

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, s.h * 0.26, s.w, 40);
        ctx.fillStyle = s.announce.includes("UNIBEAM") ? "#fbbf24" : s.announce.includes("DOWN") ? "#f87171" : "#7dd3fc";
        ctx.font = `700 ${Math.round(20 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText(s.announce, s.w / 2, s.h * 0.26 + 28);
        ctx.fillText(s.announce, s.w / 2, s.h * 0.26 + 28);
        ctx.textAlign = "left";
      }

      if (s.alive && s.frame < 100 && s.announceT <= 0) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `700 ${Math.round(12 * hs)}px Comic Neue, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(s.w < 500 ? "Drag to fly · tap = Repulsor/Unibeam" : "Fly with mouse · tap for Repulsor · charge Arc for Unibeam", s.w / 2, s.h * 0.2);
        ctx.textAlign = "left";
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#f87171";
        ctx.font = `700 ${Math.round(28 * hs)}px Bangers, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText("SYSTEMS DOWN!", s.w / 2, s.h / 2);
        ctx.fillText("SYSTEMS DOWN!", s.w / 2, s.h / 2);
        ctx.fillStyle = "#e0f2fe";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to reboot", s.w / 2, s.h / 2 + 28);
        ctx.textAlign = "left";
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      pointer(e);
      if (!state.current.alive) reset();
      else fireSpecial();
    };
    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      pointer(e);
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
      title="Sky Guard"
      tagline="Fly · grab rings · tap Repulsor / Unibeam"
      mobileTagline="Drag fly · tap for Unibeam"
      strip="JARVIS ONLINE"
      stripHint="Arc reactor charged"
      loadingLabel="Armor assembling… loading portfolio"
      readyLabel="Systems nominal — open the brief"
      accent="#f5a623"
      accent2="#b71c1c"
      score={score}
      secondaryLabel="Rings"
      secondaryValue={rings}
      best={best}
      alive={alive}
      aliveHint="Drag to fly. Tap = twin Repulsor beams. Fill Arc → tap = Unibeam (melts the lane). Dodge missiles, drones & Ultron eye-beams."
      deadHint="Suit down! Tap to reboot."
      canvasRef={canvasRef}
      ariaLabel="Iron Man sky guard flight mini-game"
    />
  );
}
