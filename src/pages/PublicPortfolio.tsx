import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Github, Linkedin, Mail, Phone, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicPortfolio } from "../api/portfolio";
import EmptyState from "../components/EmptyState";
import LoadingGame from "../components/LoadingGame";
import { apiErrorMessage, initials, orderByDisplay } from "../lib/utils";
import type { Portfolio } from "../types/portfolio";

const slam = {
  hidden: { opacity: 0, scale: 1.12, rotate: -2, y: 40 },
  show: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 18 },
  },
};

const slideSkew = {
  hidden: { opacity: 0, x: -60, skewX: -8 },
  show: {
    opacity: 1,
    x: 0,
    skewX: 0,
    transition: { type: "spring" as const, stiffness: 200, damping: 20 },
  },
};

const COMIC_MISSION_ART = [
  "/comic/comic-mission-01.png",
  "/comic/comic-mission-02.png",
  "/comic/comic-mission-03.png",
  "/comic/comic-mission-04.png",
] as const;

function comicCoverFor(index: number) {
  return COMIC_MISSION_ART[index % COMIC_MISSION_ART.length];
}

function ActionChip({ href, children, icon }: { href?: string; children: ReactNode; icon: ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="comic-burst inline-flex items-center gap-2 px-4 py-2 font-comic-body text-sm font-bold uppercase tracking-wide">
      {icon}
      {children}
    </a>
  );
}

function PanelIn({
  children,
  className,
  delay = 0,
  from = "up",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  from?: "up" | "left" | "right" | "slam";
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;

  const initial =
    from === "slam"
      ? { opacity: 0, scale: 1.2, rotate: -3 }
      : from === "left"
        ? { opacity: 0, x: -80, rotate: -2 }
        : from === "right"
          ? { opacity: 0, x: 80, rotate: 2 }
          : { opacity: 0, y: 50, rotate: -1 };

  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ type: "spring", stiffness: 220, damping: 18, delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionStamp({ label, tone = "pink" }: { label: string; tone?: "pink" | "cyan" | "yellow" }) {
  const bg =
    tone === "cyan" ? "bg-comic-cyan" : tone === "yellow" ? "bg-comic-yellow" : "bg-comic-pink text-white";
  return (
    <div className="mb-8 flex items-center gap-4">
      <span className={`comic-section inline-block -rotate-2 border-4 border-comic-ink px-4 py-2 text-2xl sm:text-3xl ${bg} shadow-comic`}>
        {label}
      </span>
      <span className="hidden h-1 flex-1 bg-comic-ink sm:block" aria-hidden="true" />
      <Zap className="hidden h-7 w-7 fill-comic-yellow text-comic-ink sm:block" aria-hidden="true" />
    </div>
  );
}

type SummaryChunk = {
  label: string;
  text: string;
  tone: "speech" | "caption" | "cyan" | "pink" | "cream";
  items?: string[];
};

function extractLabeledSection(source: string, label: RegExp): { value: string; rest: string } {
  const match = source.match(label);
  if (!match || match.index === undefined) return { value: "", rest: source };
  return {
    value: match[1].trim(),
    rest: `${source.slice(0, match.index).trim()} ${source.slice(match.index + match[0].length).trim()}`.trim(),
  };
}

function splitRoleAndBio(text: string): { role: string; bioParts: string[] } {
  const trimmed = text.trim();
  if (!trimmed) return { role: "", bioParts: [] };

  const roleBioMatch = trimmed.match(
    /^(.+?)\s+((?:AI\s+)?(?:Full[- ]?stack|Software|Senior|Junior|Backend|Frontend|Platform)?\s*(?:Engineer|Developer|Designer|Architect|Builder|Specialist)\b[\s\S]*)$/i,
  );

  let role = "";
  let bio = trimmed;
  if (roleBioMatch && (roleBioMatch[1].includes("·") || roleBioMatch[1].includes("—") || roleBioMatch[1].length < 100)) {
    role = roleBioMatch[1].trim();
    bio = roleBioMatch[2].trim();
  }

  const sentences = bio.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [bio];
  if (sentences.length <= 2) return { role, bioParts: sentences.length ? [sentences.join(" ")] : [] };

  const mid = Math.ceil(sentences.length / 2);
  return {
    role,
    bioParts: [sentences.slice(0, mid).join(" "), sentences.slice(mid).join(" ")].filter(Boolean),
  };
}

function splitSummaryChunks(summary: string): SummaryChunk[] {
  let rest = summary.replace(/\s+/g, " ").trim();
  if (!rest) return [];

  const achievements = extractLabeledSection(rest, /\bAchievements?:\s*([\s\S]+)$/i);
  rest = achievements.rest;
  const education = extractLabeledSection(rest, /\bEducation:\s*([\s\S]+)$/i);
  rest = education.rest;

  const { role, bioParts } = splitRoleAndBio(rest);
  const chunks: SummaryChunk[] = [];

  if (role) {
    chunks.push({ label: "Class", text: role, tone: "cyan" });
  }

  bioParts.forEach((part, index) => {
    chunks.push({
      label: index === 0 ? "Origin" : "Plot",
      text: part,
      tone: index === 0 ? "speech" : "cream",
    });
  });

  if (education.value) {
    chunks.push({ label: "School", text: education.value, tone: "caption" });
  }

  if (achievements.value) {
    const items = achievements.value
      .split(/\s*;\s*/)
      .map((item) => item.trim())
      .filter(Boolean);
    chunks.push({
      label: "Wins",
      text: achievements.value,
      tone: "pink",
      items: items.length > 1 ? items : undefined,
    });
  }

  // Fallback: if nothing structured, keep short sentence panels
  if (chunks.length === 0) {
    const sentences = rest.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [rest];
    for (const [index, sentence] of sentences.entries()) {
      chunks.push({
        label: index === 0 ? "Origin" : `Panel ${index + 1}`,
        text: sentence,
        tone: index % 2 === 0 ? "speech" : "caption",
      });
    }
  }

  return chunks;
}

const chunkToneClass: Record<SummaryChunk["tone"], string> = {
  speech: "comic-speech bg-white",
  caption: "comic-caption",
  cyan: "border-4 border-comic-ink bg-comic-cyan shadow-comic",
  pink: "border-4 border-comic-ink bg-comic-pink text-white shadow-comic",
  cream: "border-4 border-comic-ink bg-comic-cream shadow-comic",
};

function SummaryPanels({ summary }: { summary: string }) {
  const chunks = useMemo(() => splitSummaryChunks(summary), [summary]);
  if (chunks.length === 0) return null;

  return (
    <motion.div variants={slideSkew} className="mt-8 flex max-w-xl flex-col gap-3">
      {chunks.map((chunk, index) => (
        <motion.div
          key={`${chunk.label}-${index}`}
          initial={{ opacity: 0, y: 18, rotate: index % 2 === 0 ? -1.5 : 1.5 }}
          animate={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -1 : 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.12 + index * 0.08 }}
          className={`relative p-4 font-comic-body text-sm leading-6 sm:text-base sm:leading-7 ${chunkToneClass[chunk.tone]} ${
            chunk.tone === "speech" ? "rounded-2xl" : ""
          }`}
        >
          <span
            className={`mb-2 inline-block border-2 border-comic-ink px-2 py-0.5 font-comic text-sm tracking-wide ${
              chunk.tone === "pink" ? "bg-comic-ink text-comic-yellow" : "bg-comic-ink text-comic-cream"
            }`}
          >
            {chunk.label}
          </span>
          {chunk.items ? (
            <ul className="space-y-1.5 pl-1">
              {chunk.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true">★</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{chunk.text}</p>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

export default function PublicPortfolio() {
  const { slug } = useParams();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLoadingGame, setShowLoadingGame] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let active = true;

    async function load() {
      if (!slug) return;
      setIsLoading(true);
      setShowLoadingGame(true);
      setError("");
      try {
        const data = await getPublicPortfolio(slug);
        if (!active) return;
        setPortfolio({
          ...data,
          projects: data.projects ?? [],
          experiences: data.experiences ?? [],
          certifications: data.certifications ?? [],
          technicalSkills: data.technicalSkills ?? [],
          customLinks: data.customLinks ?? [],
        });
      } catch (requestError) {
        if (!active) return;
        setError(apiErrorMessage(requestError, "Unable to load public portfolio."));
        setShowLoadingGame(false);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  const skillsByCategory = useMemo(() => {
    const grouped = new Map<string, string[]>();
    for (const skill of orderByDisplay(portfolio?.technicalSkills ?? [])) {
      const key = skill.category || "Skills";
      grouped.set(key, [...(grouped.get(key) ?? []), skill.skillName]);
    }
    return Array.from(grouped.entries());
  }, [portfolio?.technicalSkills]);

  if (isLoading || (showLoadingGame && portfolio && !error)) {
    return (
      <LoadingGame
        ready={!isLoading && Boolean(portfolio)}
        onEnter={() => setShowLoadingGame(false)}
      />
    );
  }

  if (error || !portfolio) {
    return (
      <main className="comic-page flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-xl">
          <EmptyState
            title="Portfolio unavailable"
            body={error || "This public portfolio could not be found."}
            action={
              <Link className="font-comic text-2xl text-comic-pink underline" to="/">
                Back to Stackfolio
              </Link>
            }
          />
        </section>
      </main>
    );
  }

  const primary = portfolio.primaryColor || "#ff2a6d";
  const projects = orderByDisplay(portfolio.projects);
  const experiences = orderByDisplay(portfolio.experiences);
  const certifications = orderByDisplay(portfolio.certifications);
  const customLinks = orderByDisplay(portfolio.customLinks);
  const firstName = portfolio.fullName.split(" ")[0] ?? portfolio.fullName;

  return (
    <main className="comic-page comic-ink-bleed min-h-screen">
      <div className="comic-speedlines pointer-events-none fixed inset-0 -z-0 opacity-60" aria-hidden="true" />

      {/* Masthead */}
      <header className="relative z-10 border-b-4 border-comic-ink bg-comic-ink text-comic-cream">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="font-comic text-xl tracking-wider text-comic-yellow sm:text-2xl">STACKFOLIO COMICS</p>
          <p className="font-comic-body text-xs font-bold uppercase tracking-[0.25em] text-comic-cyan">
            Issue · {slug} · Vol. 1
          </p>
        </div>
      </header>

      {/* Splash page hero */}
      <section className="relative z-10 overflow-hidden border-b-4 border-comic-ink">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background: `
              linear-gradient(125deg, #1b3b6f 0%, #0a0a0a 42%, #7b2cbf 100%),
              radial-gradient(circle at 80% 20%, ${primary}88, transparent 40%)
            `,
          }}
          aria-hidden="true"
        />
        <div className="comic-halftone-overlay absolute inset-0 opacity-50" aria-hidden="true" />

        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10 lg:py-16">
          <motion.div
            className="order-2 lg:order-1"
            variants={reduceMotion ? undefined : { hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={slideSkew} className="comic-caption mb-5 inline-block -rotate-2 px-3 py-1 text-sm font-bold uppercase">
              <span className="mr-2 inline-block rounded bg-comic-ink px-2 py-0.5 font-comic text-comic-yellow">NEW</span>
              Origin story online
            </motion.div>

            <motion.h1 variants={slam} className="comic-title comic-glitch text-[clamp(3.5rem,12vw,7.5rem)] text-white">
              {portfolio.fullName}
            </motion.h1>

            {portfolio.summary ? <SummaryPanels summary={portfolio.summary} /> : null}

            <motion.div variants={slideSkew} className="mt-8 flex flex-wrap gap-3">
              <ActionChip href={portfolio.publicEmail ? `mailto:${portfolio.publicEmail}` : undefined} icon={<Mail className="h-4 w-4" />}>
                Email
              </ActionChip>
              <ActionChip href={portfolio.githubUrl} icon={<Github className="h-4 w-4" />}>
                GitHub
              </ActionChip>
              <ActionChip href={portfolio.linkedinUrl} icon={<Linkedin className="h-4 w-4" />}>
                LinkedIn
              </ActionChip>
              <ActionChip href={portfolio.phone ? `tel:${portfolio.phone}` : undefined} icon={<Phone className="h-4 w-4" />}>
                Call
              </ActionChip>
            </motion.div>
          </motion.div>

          <motion.div
            className="order-1 mx-auto w-full max-w-md lg:order-2 lg:mx-0 lg:justify-self-end"
            initial={reduceMotion ? false : { opacity: 0, rotate: 8, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, rotate: 3, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.15 }}
          >
            <div className="comic-panel comic-panel-pink comic-jagged relative overflow-hidden">
              {portfolio.profileImageUrl ? (
                <img src={portfolio.profileImageUrl} alt={portfolio.fullName} className="aspect-[4/5] w-full object-cover" />
              ) : (
                <div
                  className="flex aspect-[4/5] items-center justify-center text-7xl font-comic text-white sm:text-8xl"
                  style={{ background: `linear-gradient(145deg, ${primary}, #1b3b6f)` }}
                >
                  {initials(portfolio.fullName)}
                </div>
              )}
              <div className="comic-halftone-overlay absolute inset-0" aria-hidden="true" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="comic-caption px-3 py-2 text-center text-sm font-bold uppercase tracking-wide">
                  starring {firstName}
                </div>
              </div>
              <motion.span
                className="absolute -left-3 -top-3 rotate-[-12deg] border-4 border-comic-ink bg-comic-cyan px-3 py-1 font-comic text-2xl shadow-comic"
                animate={reduceMotion ? undefined : { rotate: [-12, -8, -12], y: [0, -4, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                POW!
              </motion.span>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
        {/* Projects as comic panels */}
        <section>
          <PanelIn from="left">
            <SectionStamp label="Selected Missions" tone="pink" />
          </PanelIn>

          {projects.length === 0 ? (
            <EmptyState title="No projects yet" body="Projects will appear here when they are published." />
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {projects.map((project, index) => (
                <PanelIn key={project.id} delay={index * 0.06} from={index % 2 === 0 ? "left" : "right"}>
                  <article
                    className={`comic-panel overflow-hidden ${index % 3 === 0 ? "comic-panel-cyan" : index % 3 === 1 ? "comic-panel-pink" : ""} ${
                      index % 2 === 0 ? "-rotate-1" : "rotate-1"
                    } transition hover:rotate-0`}
                  >
                    <div className="relative border-b-4 border-comic-ink bg-comic-ink">
                      <img
                        src={project.imageUrl || comicCoverFor(index)}
                        alt=""
                        loading="lazy"
                        className="aspect-[16/10] w-full object-cover opacity-95"
                      />
                      <div className="comic-halftone-overlay absolute inset-0 opacity-40" aria-hidden="true" />
                      <span className="absolute left-3 top-3 border-2 border-comic-ink bg-comic-yellow px-2 py-0.5 font-comic text-lg shadow-comic">
                        #{String(index + 1).padStart(2, "0")}
                      </span>
                      {!project.imageUrl ? (
                        <span className="absolute bottom-3 right-3 rotate-[-6deg] border-2 border-comic-ink bg-comic-pink px-2 py-0.5 font-comic text-sm text-white shadow-comic">
                          ZAP!
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-3 p-5">
                      <h3 className="comic-title-sm text-3xl text-comic-ink">{project.title}</h3>
                      {project.techStack ? (
                        <p className="font-comic-body text-sm font-bold uppercase tracking-wide text-comic-ink/70">{project.techStack}</p>
                      ) : null}
                      {project.description ? (
                        <p className="font-comic-body text-base leading-6 text-comic-ink/85">{project.description}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-3 pt-1">
                        {project.liveUrl ? (
                          <a
                            href={project.liveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="comic-burst inline-flex items-center gap-1 bg-comic-pink px-3 py-1.5 font-comic-body text-sm font-bold uppercase text-white"
                          >
                            Live <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ) : null}
                        {project.githubUrl ? (
                          <a
                            href={project.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="comic-burst inline-flex items-center gap-1 px-3 py-1.5 font-comic-body text-sm font-bold uppercase"
                          >
                            <Github className="h-4 w-4" aria-hidden="true" /> Code
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
                </PanelIn>
              ))}
            </div>
          )}
        </section>

        {/* Experience timeline as comic captions */}
        <section>
          <PanelIn from="slam">
            <SectionStamp label="Timeline" tone="cyan" />
          </PanelIn>

          {experiences.length === 0 ? (
            <EmptyState title="No experience yet" body="Experience entries will appear here when they are published." />
          ) : (
            <div className="relative space-y-5 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-1 before:bg-comic-ink sm:before:left-5">
              {experiences.map((experience, index) => (
                <PanelIn key={experience.id} delay={index * 0.05} from="left">
                  <article className="relative ml-10 border-4 border-comic-ink bg-white p-5 shadow-comic sm:ml-14 sm:p-6">
                    <span className="absolute -left-[2.15rem] top-6 flex h-6 w-6 items-center justify-center border-4 border-comic-ink bg-comic-yellow font-comic text-xs sm:-left-[2.4rem] sm:h-7 sm:w-7">
                      {index + 1}
                    </span>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-comic-black text-xl uppercase sm:text-2xl">{experience.jobTitle}</h3>
                        <p className="mt-1 font-comic-body text-sm font-bold text-comic-ink/70">
                          {[experience.companyName, experience.employmentType, experience.location].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="comic-caption px-2 py-1 text-xs font-bold uppercase">
                        {[experience.startDate, experience.currentlyWorking ? "Present" : experience.endDate]
                          .filter(Boolean)
                          .join(" → ")}
                      </span>
                    </div>
                    {experience.description ? (
                      <p className="mt-4 font-comic-body text-base leading-7 text-comic-ink/80">{experience.description}</p>
                    ) : null}
                  </article>
                </PanelIn>
              ))}
            </div>
          )}
        </section>

        {/* Skills + Certs */}
        <section className="grid gap-10 lg:grid-cols-2">
          <PanelIn from="left">
            <SectionStamp label="Power Set" tone="yellow" />
            {skillsByCategory.length === 0 ? (
              <p className="font-comic-body text-sm">No skills published yet.</p>
            ) : (
              <div className="space-y-6">
                {skillsByCategory.map(([category, skills]) => (
                  <div key={category}>
                    <h3 className="mb-3 font-comic text-2xl text-comic-pink">{category}</h3>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill, i) => (
                        <motion.span
                          key={skill}
                          className="comic-sticker px-3 py-1.5 text-sm"
                          style={{ rotate: i % 2 === 0 ? -2 : 2 }}
                          whileHover={reduceMotion ? undefined : { scale: 1.08, rotate: 0 }}
                        >
                          {skill}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelIn>

          <PanelIn from="right" delay={0.08}>
            <SectionStamp label="Badges" tone="pink" />
            {certifications.length === 0 ? (
              <p className="font-comic-body text-sm">No certifications published yet.</p>
            ) : (
              <div className="space-y-4">
                {certifications.map((certification, index) => (
                  <article
                    key={certification.id}
                    className={`border-4 border-comic-ink bg-comic-cream p-4 shadow-comic ${index % 2 === 0 ? "-rotate-1" : "rotate-1"}`}
                  >
                    <h3 className="font-comic-black text-lg uppercase">{certification.name}</h3>
                    <p className="mt-1 font-comic-body text-sm font-bold text-comic-ink/70">{certification.issuingOrganization}</p>
                    <p className="mt-1 font-comic-body text-xs uppercase tracking-wide text-comic-ink/50">
                      {[certification.issueDate, certification.expiryDate].filter(Boolean).join(" — ")}
                    </p>
                    {certification.credentialUrl ? (
                      <a
                        className="mt-3 inline-flex items-center gap-1 font-comic text-xl text-comic-pink"
                        href={certification.credentialUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Credential <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </PanelIn>
        </section>

        {customLinks.length > 0 ? (
          <section>
            <PanelIn>
              <SectionStamp label="Multiverse Links" tone="cyan" />
              <div className="flex flex-wrap gap-3">
                {customLinks.map((link, index) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`comic-burst inline-flex items-center gap-2 px-4 py-2 font-comic text-xl ${
                      index % 3 === 0 ? "bg-comic-pink text-white" : index % 3 === 1 ? "bg-comic-cyan" : "bg-comic-yellow"
                    }`}
                  >
                    {link.label}
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </PanelIn>
          </section>
        ) : null}
      </div>

      <footer className="relative z-10 border-t-4 border-comic-ink bg-comic-ink px-4 py-6 text-comic-cream sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-comic text-2xl text-comic-yellow">{portfolio.fullName}</p>
          <p className="font-comic-body text-sm font-bold uppercase tracking-widest text-comic-cyan">
            Printed by{" "}
            <Link to="/" className="underline decoration-comic-pink decoration-2 underline-offset-4">
              Stackfolio
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
