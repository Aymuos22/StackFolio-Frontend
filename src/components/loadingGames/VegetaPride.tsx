import { useEffect, useRef, useState } from "react";
import { fitGameCanvas, GameShell, hudScale, roundRect, type MiniGameProps } from "./shared";

type Enemy = { x: number; y: number; vx: number; vy: number; hp: number; r: number; hitFlash: number };
type Blast = { x: number; y: number; vx: number; vy: number; r: number; life: number; ego: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type Form = "base" | "ssj" | "ultraEgo";

/**
 * Vegeta: fly + Galick barrage (not a mash beam struggle like Goku).
 * Power-ups: Super Saiyan · Ultra Ego.
 */
export default function VegetaPride({ ready, onEnter }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(ready);
  const onEnterRef = useRef(onEnter);
  const target = useRef({ x: 120, y: 180 });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [pride, setPride] = useState(0);
  const [form, setForm] = useState<Form>("base");

  const state = useRef({
    w: 640,
    h: 360,
    frame: 0,
    alive: true,
    score: 0,
    pride: 0,
    form: "base" as Form,
    x: 120,
    y: 180,
    cooldown: 0,
    spawnIn: 35,
    enemies: [] as Enemy[],
    blasts: [] as Blast[],
    parts: [] as Particle[],
    shake: 0,
    ssjT: 0,
    egoT: 0,
    announce: "",
    announceT: 0,
    specialCd: 0,
    fireHeld: false,
  });

  readyRef.current = ready;
  onEnterRef.current = onEnter;

  useEffect(() => {
    setBest(Number(localStorage.getItem("stackfolio_best_vegeta") || 0));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const btnSsj = () => ({ x: state.current.w - 108, y: state.current.h - 52, w: 44, h: 36 });
    const btnEgo = () => ({ x: state.current.w - 56, y: state.current.h - 52, w: 44, h: 36 });

    const resize = () => {
      const { w, h } = fitGameCanvas(canvas);
      state.current.w = w;
      state.current.h = h;
      state.current.x = w * 0.2;
      state.current.y = h * 0.45;
      target.current = { x: w * 0.2, y: h * 0.45 };
    };

    const burst = (x: number, y: number, color: string, n = 12, size = 3) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 3.5;
        state.current.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 18, color, size });
      }
    };

    const syncForm = () => {
      const s = state.current;
      const next: Form = s.egoT > 0 ? "ultraEgo" : s.ssjT > 0 ? "ssj" : "base";
      s.form = next;
      setForm(next);
    };

    const reset = () => {
      const s = state.current;
      s.frame = 0;
      s.alive = true;
      s.score = 0;
      s.pride = 0;
      s.form = "base";
      s.x = s.w * 0.2;
      s.y = s.h * 0.45;
      target.current = { x: s.x, y: s.y };
      s.cooldown = 0;
      s.spawnIn = 30;
      s.enemies = [];
      s.blasts = [];
      s.parts = [];
      s.shake = 0;
      s.ssjT = 0;
      s.egoT = 0;
      s.announce = "PRIDE OF A SAIYAN!";
      s.announceT = 50;
      s.specialCd = 0;
      s.fireHeld = false;
      setAlive(true);
      setScore(0);
      setPride(0);
      setForm("base");
    };

    const activateSsj = () => {
      const s = state.current;
      if (!s.alive || s.specialCd > 0 || s.ssjT > 0 || s.egoT > 0) return;
      if (s.pride < 50) {
        s.announce = "NEED 50 PRIDE!";
        s.announceT = 35;
        return;
      }
      s.pride -= 50;
      setPride(s.pride);
      s.ssjT = 260;
      s.specialCd = 18;
      s.shake = 8;
      s.announce = "SUPER SAIYAN!";
      s.announceT = 55;
      burst(s.x, s.y, "#facc15", 26, 4);
      syncForm();
    };

    const activateEgo = () => {
      const s = state.current;
      if (!s.alive || s.specialCd > 0 || s.egoT > 0) return;
      if (s.pride < 100) {
        s.announce = "NEED 100 PRIDE!";
        s.announceT = 35;
        return;
      }
      s.pride = 0;
      setPride(0);
      s.ssjT = 0;
      s.egoT = 280;
      s.specialCd = 22;
      s.shake = 12;
      s.announce = "ULTRA EGO!";
      s.announceT = 60;
      burst(s.x, s.y, "#e879f9", 28, 4);
      burst(s.x, s.y, "#86198f", 14, 3);
      syncForm();
    };

    const fire = () => {
      const s = state.current;
      if (!s.alive) return reset();
      if (s.cooldown > 0) return;
      const ego = s.egoT > 0;
      const ssj = s.ssjT > 0;
      const speed = ego ? 9 : ssj ? 8.5 : 7.5;
      const spread = ego ? 0.18 : ssj ? 0.1 : 0.05;
      const count = ego ? 3 : ssj ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const ang = (i - (count - 1) / 2) * spread;
        s.blasts.push({
          x: s.x + 22,
          y: s.y + (i - (count - 1) / 2) * 6,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed * 0.6,
          r: ego ? 9 : ssj ? 6 : 4.5,
          life: 70,
          ego,
        });
      }
      s.cooldown = ego ? 7 : ssj ? 6 : 9;
      burst(s.x + 20, s.y, ego ? "#e879f9" : ssj ? "#fde047" : "#a78bfa", 3, 2);
    };

    const hairColor = (f: Form) => (f === "ultraEgo" ? "#fce7f3" : f === "ssj" ? "#facc15" : "#111827");
    const auraColor = (f: Form) => (f === "ultraEgo" ? "#e879f9" : f === "ssj" ? "#fde047" : "#7c3aed");

    const drawVegeta = (x: number, y: number, f: Form) => {
      // Soft aura
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pulse = 1 + Math.sin(state.current.frame / 5) * 0.08;
      const ag = ctx.createRadialGradient(x, y, 4, x, y, 36 * pulse);
      ag.addColorStop(0, `${auraColor(f)}55`);
      ag.addColorStop(0.5, `${auraColor(f)}22`);
      ag.addColorStop(1, "transparent");
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.ellipse(x, y, 24 * pulse, 36 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Boots / legs (blue armor)
      ctx.fillStyle = "#1e3a8a";
      roundRect(ctx, x - 12, y + 14, 10, 16, 3);
      ctx.fill();
      roundRect(ctx, x + 2, y + 14, 10, 16, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      roundRect(ctx, x - 12, y + 26, 10, 6, 2);
      ctx.fill();
      roundRect(ctx, x + 2, y + 26, 10, 6, 2);
      ctx.fill();

      // Armor torso
      ctx.fillStyle = f === "ultraEgo" ? "#4a044e" : "#1d4ed8";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      roundRect(ctx, x - 14, y - 8, 28, 26, 5);
      ctx.fill();
      ctx.stroke();
      // Chest plate
      ctx.fillStyle = f === "ultraEgo" ? "#86198f" : "#64748b";
      roundRect(ctx, x - 10, y - 4, 20, 14, 3);
      ctx.fill();
      // Gloves
      ctx.fillStyle = "#fff";
      roundRect(ctx, x - 22, y + 2, 8, 10, 2);
      ctx.fill();
      roundRect(ctx, x + 14, y + 2, 8, 10, 2);
      ctx.fill();
      // Arms
      ctx.fillStyle = f === "ultraEgo" ? "#4a044e" : "#1d4ed8";
      roundRect(ctx, x - 22, y - 4, 9, 12, 3);
      ctx.fill();
      roundRect(ctx, x + 13, y - 4, 9, 12, 3);
      ctx.fill();

      // Head
      ctx.fillStyle = f === "ultraEgo" ? "#fce7f3" : "#f5c89a";
      ctx.beginPath();
      ctx.ellipse(x, y - 22, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tall widow's-peak hair
      ctx.fillStyle = hairColor(f);
      const spikes =
        f === "base"
          ? [
              [-6, -28, -8, -50, 0, -30],
              [0, -32, 2, -56, 6, -30],
              [4, -28, 12, -48, 10, -26],
              [-10, -24, -14, -38, -4, -26],
            ]
          : [
              [-7, -30, -10, -58, 0, -32],
              [-1, -34, 0, -64, 6, -32],
              [4, -30, 10, -58, 10, -28],
              [8, -26, 18, -46, 12, -24],
              [-12, -24, -18, -42, -5, -26],
            ];
      for (const [a, b, c, d, e, f2] of spikes) {
        ctx.beginPath();
        ctx.moveTo(x + a, y + b);
        ctx.lineTo(x + c, y + d);
        ctx.lineTo(x + e, y + f2);
        ctx.closePath();
        ctx.fill();
      }

      // Eyes
      if (f === "ultraEgo") {
        ctx.fillStyle = "#86198f";
        ctx.shadowColor = "#e879f9";
        ctx.shadowBlur = 6;
      } else if (f === "ssj") {
        ctx.fillStyle = "#38bdf8";
      } else {
        ctx.fillStyle = "#111";
      }
      ctx.beginPath();
      ctx.ellipse(x - 4, y - 22, 2.2, 2.6, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 4, y - 22, 2.2, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Scowl
      ctx.strokeStyle = "#7c2d12";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 14);
      ctx.quadraticCurveTo(x, y - 12, x + 4, y - 14);
      ctx.stroke();

      // Ultra Ego body marks
      if (f === "ultraEgo") {
        ctx.strokeStyle = "#86198f";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x - 2, y + 8);
        ctx.moveTo(x + 6, y);
        ctx.lineTo(x + 2, y + 8);
        ctx.stroke();
      }
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
      if (s.ssjT > 0) {
        s.ssjT--;
        if (s.ssjT === 0) syncForm();
      }
      if (s.egoT > 0) {
        s.egoT--;
        if (s.egoT === 0) {
          s.announce = "ULTRA EGO FADED";
          s.announceT = 35;
          syncForm();
        }
      }
      s.shake *= 0.86;

      // Smooth fly toward pointer
      s.x += (target.current.x - s.x) * 0.18;
      s.y += (target.current.y - s.y) * 0.18;
      s.x = Math.max(40, Math.min(s.w * 0.45, s.x));
      s.y = Math.max(40, Math.min(s.h - 50, s.y));

      if (s.fireHeld && s.alive) fire();

      if (s.alive) {
        if (--s.spawnIn <= 0) {
          const y = 50 + Math.random() * (s.h - 120);
          s.enemies.push({
            x: s.w + 20,
            y,
            vx: -(1.6 + Math.min(2, s.score * 0.003) + Math.random()),
            vy: Math.sin(s.frame / 10) * 0.4,
            hp: s.egoT > 0 ? 2 : 1 + (Math.random() < 0.25 ? 1 : 0),
            r: 14 + Math.random() * 6,
            hitFlash: 0,
          });
          s.spawnIn = Math.max(18, 42 - Math.min(16, s.score / 60));
        }

        for (const e of s.enemies) {
          e.x += e.vx;
          e.y += Math.sin((s.frame + e.x) / 20) * 0.6;
          if (e.hitFlash > 0) e.hitFlash--;
        }

        for (const b of s.blasts) {
          b.x += b.vx;
          b.y += b.vy;
          b.life--;
        }

        for (const b of s.blasts) {
          for (const e of s.enemies) {
            if (e.hp <= 0) continue;
            if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
              e.hp -= b.ego ? 2 : 1;
              e.hitFlash = 5;
              b.life = 0;
              if (e.hp <= 0) {
                const pts = 25 * (s.egoT > 0 ? 1.6 : s.ssjT > 0 ? 1.3 : 1);
                s.score += Math.round(pts);
                s.pride = Math.min(100, s.pride + (s.egoT > 0 ? 8 : 16));
                // Ultra Ego: damage taken as pride? gain on KO already; also small heal pride
                if (s.egoT > 0) s.pride = Math.min(100, s.pride + 4);
                setScore(s.score);
                setPride(s.pride);
                burst(e.x, e.y, b.ego ? "#e879f9" : "#fde047", 12, 3);
              }
            }
          }
        }

        s.enemies = s.enemies.filter((e) => e.hp > 0 && e.x > -40);
        s.blasts = s.blasts.filter((b) => b.life > 0 && b.x < s.w + 40);

        for (const e of s.enemies) {
          if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 16) {
            if (s.egoT > 0) {
              // Ultra Ego: thrives on punishment — knockback + pride
              e.x += 55;
              e.hp -= 1;
              s.pride = Math.min(100, s.pride + 10);
              setPride(s.pride);
              burst(s.x, s.y, "#e879f9", 10, 2);
              s.shake = 5;
              continue;
            }
            s.alive = false;
            setAlive(false);
            burst(s.x, s.y, "#ef4444", 22, 3);
            s.shake = 12;
            localStorage.setItem(
              "stackfolio_best_vegeta",
              String(Math.max(Number(localStorage.getItem("stackfolio_best_vegeta") || 0), s.score)),
            );
            setBest(Math.max(Number(localStorage.getItem("stackfolio_best_vegeta") || 0), s.score));
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

      const sky = ctx.createLinearGradient(0, 0, s.w, s.h);
      if (s.egoT > 0) {
        sky.addColorStop(0, "#3b0764");
        sky.addColorStop(1, "#701a75");
      } else if (s.ssjT > 0) {
        sky.addColorStop(0, "#422006");
        sky.addColorStop(1, "#854d0e");
      } else {
        sky.addColorStop(0, "#0f172a");
        sky.addColorStop(1, "#1e3a8a");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.w, s.h);

      // Stars
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 18; i++) {
        const sx = ((i * 97 + s.frame * 0.3) % s.w);
        const sy = (i * 53) % (s.h * 0.7);
        ctx.fillRect(sx, sy, 2, 2);
      }

      for (const e of s.enemies) {
        ctx.fillStyle = e.hitFlash > 0 ? "#fecaca" : "#94a3b8";
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(e.x - 4, e.y - 2, 2, 0, Math.PI * 2);
        ctx.arc(e.x + 4, e.y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const b of s.blasts) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r + 6);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.4, b.ego ? "#e879f9" : "#c4b5fd");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const p of s.parts) {
        ctx.globalAlpha = Math.min(1, p.life / 16);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      }

      drawVegeta(s.x, s.y, s.form);

      const meterW = Math.min(s.w - 40, 220);
      const meterX = (s.w - meterW) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, meterX, 12, meterW, 12, 6);
      ctx.fill();
      ctx.fillStyle = s.egoT > 0 ? "#e879f9" : s.ssjT > 0 ? "#facc15" : "#a78bfa";
      roundRect(ctx, meterX, 12, (s.pride / 100) * meterW, 12, 6);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      roundRect(ctx, meterX, 12, meterW, 12, 6);
      ctx.stroke();

      drawBtn(btnSsj(), "SSJ", s.pride >= 50 && s.ssjT <= 0 && s.egoT <= 0, "#eab308");
      drawBtn(btnEgo(), "EGO", s.pride >= 100 && s.egoT <= 0, "#c026d3");

      const hs = hudScale(s.w);
      ctx.fillStyle = "#fde047";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(18 * hs)}px Bangers, Impact, sans-serif`;
      ctx.strokeText(`KI ${s.score}`, 12, s.h - 36);
      ctx.fillText(`KI ${s.score}`, 12, s.h - 36);
      ctx.fillStyle = auraColor(s.form);
      ctx.font = `700 ${Math.round(13 * hs)}px Bangers, Impact, sans-serif`;
      let label = `PRIDE ${Math.round(s.pride)}%`;
      if (s.egoT > 0) label = `ULTRA EGO ${Math.ceil(s.egoT / 60)}s`;
      else if (s.ssjT > 0) label = `SSJ ${Math.ceil(s.ssjT / 60)}s`;
      ctx.strokeText(label, 12, s.h - 16);
      ctx.fillText(label, 12, s.h - 16);

      if (s.announceT > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, s.h * 0.26, s.w, 40);
        ctx.fillStyle = s.egoT > 0 ? "#e879f9" : "#facc15";
        ctx.font = `700 ${Math.round(22 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText(s.announce, s.w / 2 - s.announce.length * 5.5 * hs, s.h * 0.26 + 28);
        ctx.fillText(s.announce, s.w / 2 - s.announce.length * 5.5 * hs, s.h * 0.26 + 28);
      }

      if (s.alive && s.frame < 100 && s.announceT <= 0) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = `700 ${Math.round(12 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText(s.w < 500 ? "Drag + hold fire!" : "Move to fly · hold/tap to fire · SSJ / EGO", s.w / 2 - (s.w < 500 ? 55 : 150), s.h * 0.2);
      }

      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = "#e879f9";
        ctx.font = `700 ${Math.round(30 * hs)}px Bangers, Impact, sans-serif`;
        ctx.strokeText("PRIDE BROKEN!", s.w / 2 - 95 * hs, s.h / 2);
        ctx.fillText("PRIDE BROKEN!", s.w / 2 - 95 * hs, s.h / 2);
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${Math.round(14 * hs)}px Comic Neue, sans-serif`;
        ctx.fillText("Tap to try again", s.w / 2 - 52, s.h / 2 + 28);
      }

      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * state.current.w, y: ((e.clientY - r.top) / r.height) * state.current.h };
    };
    const hit = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
      p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        state.current.fireHeld = true;
        fire();
      }
      if (e.code === "KeyC") {
        e.preventDefault();
        activateSsj();
      }
      if (e.code === "KeyV") {
        e.preventDefault();
        activateEgo();
      }
      if (e.code === "Enter" && readyRef.current) onEnterRef.current();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") state.current.fireHeld = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const p = pos(e);
      if (!hit(p, btnSsj()) && !hit(p, btnEgo())) {
        target.current = p;
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const p = pos(e);
      if (hit(p, btnSsj())) return activateSsj();
      if (hit(p, btnEgo())) return activateEgo();
      target.current = p;
      state.current.fireHeld = true;
      fire();
    };
    const onPointerUp = () => {
      state.current.fireHeld = false;
    };

    resize();
    reset();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  return (
    <GameShell
      ready={ready}
      onEnter={onEnter}
      title="Pride Barrage"
      tagline="Fly & fire Galick blasts · Super Saiyan · Ultra Ego"
      mobileTagline="Drag to fly · hold to fire"
      strip="OVER 9000"
      stripHint={form === "ultraEgo" ? "Ultra Ego!" : form === "ssj" ? "Super Saiyan!" : `Pride ${pride}%`}
      loadingLabel="Prince powering up… loading portfolio"
      readyLabel="Pride intact — open the saga"
      accent="#1d4ed8"
      accent2="#c026d3"
      score={score}
      secondaryLabel="Pride"
      secondaryValue={pride}
      best={best}
      alive={alive}
      aliveHint="Fly with pointer, hold to fire. C/SSJ (50) · V/EGO (100)."
      deadHint="Pride broken! Tap to rise again."
      canvasRef={canvasRef}
      ariaLabel="Vegeta pride barrage mini-game"
    />
  );
}
