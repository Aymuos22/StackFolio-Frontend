import { useEffect, useRef, useState } from "react";
import { initials } from "../lib/utils";

const RECOVERY_LINES = [
  "ACCESSING CLASSIFIED INDEX…",
  "SPOOFING FBI MAINFRAME HANDSHAKE…",
  "DECRYPTING SUBJECT DOSSIER…",
  "RECOVERING FACIAL SCAN FROM ARCHIVE…",
  "STRIPPING REDACTIONS…",
  "CROSS-CHECKING WITNESS PHOTOS…",
  "ASSEMBLING CLEARANCE LEVEL Ω…",
  "ALMOST THERE — DON'T TELL THE FEDS…",
] as const;

type Props = {
  src: string;
  name: string;
  primary?: string;
};

/**
 * Comic "FBI dossier recovery" placeholder while the profile photo loads.
 */
export default function RecoveringProfileImage({ src, name, primary = "#1b3b6f" }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [line, setLine] = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setProgress(8);
    setLine(0);
  }, [src]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setProgress(100);
      setLoaded(true);
    }
  }, [src]);

  useEffect(() => {
    if (loaded || failed) return;
    const lineTimer = window.setInterval(() => {
      setLine((i) => (i + 1) % RECOVERY_LINES.length);
    }, 900);
    const progTimer = window.setInterval(() => {
      setProgress((p) => (p >= 92 ? 88 + Math.random() * 6 : p + 2 + Math.random() * 5));
    }, 280);
    return () => {
      window.clearInterval(lineTimer);
      window.clearInterval(progTimer);
    };
  }, [loaded, failed]);

  if (failed) {
    return (
      <div
        className="flex aspect-[4/5] items-center justify-center text-7xl font-comic text-white sm:text-8xl"
        style={{ background: `linear-gradient(145deg, ${primary}, #1b3b6f)` }}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-comic-ink">
      <img
        ref={imgRef}
        src={src}
        alt={name}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => {
          setProgress(100);
          setLoaded(true);
        }}
        onError={() => setFailed(true)}
      />

      {!loaded ? (
        <div
          className="absolute inset-0 flex flex-col justify-between p-4 sm:p-5"
          style={{
            background: `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(0,255,65,0.03) 2px,
                rgba(0,255,65,0.03) 4px
              ),
              linear-gradient(160deg, #0a0a0a 0%, #12261a 45%, #0a1628 100%)
            `,
          }}
          aria-busy="true"
          aria-label="Recovering classified profile image"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-16 animate-[fbi-scan_2.4s_linear_infinite] opacity-40"
            style={{
              background: "linear-gradient(180deg, transparent, rgba(0,255,100,0.35), transparent)",
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <span className="border-2 border-[#00ff64] bg-comic-ink px-2 py-0.5 font-comic text-xs tracking-widest text-[#00ff64] sm:text-sm">
                FBI // EYES ONLY
              </span>
              <span className="rotate-6 border-2 border-comic-pink bg-comic-pink px-2 py-0.5 font-comic text-xs text-white shadow-comic sm:text-sm">
                CLASSIFIED
              </span>
            </div>

            <p className="font-comic text-lg leading-none text-[#00ff64] sm:text-xl">
              SUBJECT FILE
              <br />
              <span className="text-comic-yellow">{name.toUpperCase()}</span>
            </p>

            <div className="space-y-1.5 pt-1" aria-hidden="true">
              <div className="h-2.5 w-[78%] bg-[#00ff64]/25" />
              <div className="h-2.5 w-[55%] bg-[#00ff64]/15" />
              <div className="h-2.5 w-[88%] bg-comic-ink/80" />
              <div className="h-2.5 w-[40%] bg-[#00ff64]/20" />
            </div>
          </div>

          <div className="relative z-10 mx-auto flex flex-1 items-center justify-center py-4" aria-hidden="true">
            <div
              className="h-28 w-24 rounded-t-full border-2 border-dashed border-[#00ff64]/50 sm:h-36 sm:w-28"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,255,100,0.08), transparent 70%), repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(0,255,100,0.08) 6px, rgba(0,255,100,0.08) 7px)",
              }}
            />
          </div>

          <div className="relative z-10 space-y-2">
            <p className="min-h-[2.5rem] font-comic-body text-xs font-bold uppercase tracking-wide text-[#00ff64] sm:text-sm">
              <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-[#00ff64]" />
              {RECOVERY_LINES[line]}
            </p>
            <div className="h-3 w-full border-2 border-[#00ff64] bg-comic-ink">
              <div
                className="h-full bg-[#00ff64] transition-[width] duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.round(progress))}%` }}
              />
            </div>
            <div className="flex justify-between font-comic-body text-[10px] font-bold uppercase tracking-wider text-[#00ff64]/70 sm:text-xs">
              <span>RECOVERY {Math.min(99, Math.round(progress))}%</span>
              <span>DO NOT SCREENSHOT</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
