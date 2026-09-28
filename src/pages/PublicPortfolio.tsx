import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowUpRight, Github, Linkedin, Mail, Phone } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicPortfolio } from "../api/portfolio";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { apiErrorMessage, initials, orderByDisplay } from "../lib/utils";
import type { Portfolio } from "../types/portfolio";

function ContactLink({
  href,
  children,
  icon,
}: {
  href?: string;
  children: ReactNode;
  icon: ReactNode;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex items-center gap-2 border-b border-current/30 pb-1 text-sm font-medium tracking-wide transition hover:border-current"
    >
      <span className="opacity-70 transition group-hover:opacity-100">{icon}</span>
      {children}
    </a>
  );
}

function SectionHeading({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <div className="mb-10 flex items-end gap-4">
      <h2 className="font-display text-3xl font-bold tracking-tight text-[var(--pp-ink)] sm:text-4xl">{children}</h2>
      <span className="mb-2 h-px flex-1" style={{ backgroundColor: `${accent}55` }} aria-hidden="true" />
    </div>
  );
}

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export default function PublicPortfolio() {
  const { slug } = useParams();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let active = true;

    async function load() {
      if (!slug) return;
      setIsLoading(true);
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

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f5f5f4]">
        <Spinner label="Loading portfolio" />
      </main>
    );
  }

  if (error || !portfolio) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] px-4">
        <section className="w-full max-w-xl">
          <EmptyState
            title="Portfolio unavailable"
            body={error || "This public portfolio could not be found."}
            action={
              <Link className="font-semibold text-slate-950 hover:underline" to="/">
                Go to Stackfolio
              </Link>
            }
          />
        </section>
      </main>
    );
  }

  const primary = portfolio.primaryColor || "#0f766e";
  const secondary = portfolio.secondaryColor || "#121212";
  const projects = orderByDisplay(portfolio.projects);
  const experiences = orderByDisplay(portfolio.experiences);
  const certifications = orderByDisplay(portfolio.certifications);
  const customLinks = orderByDisplay(portfolio.customLinks);

  const heroVariants: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.12, delayChildren: 0.15 },
    },
  };

  const heroItem: Variants = {
    hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[var(--pp-paper)] font-sans text-[var(--pp-ink)] antialiased"
      style={
        {
          "--pp-accent": primary,
          "--pp-ink": secondary,
          "--pp-paper": "#f5f5f4",
          "--pp-muted": "#71717a",
        } as CSSProperties
      }
    >
      {/* Hero — one composition: name, summary, CTAs, portrait */}
      <section className="relative isolate min-h-[100svh] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 70% 55% at 90% 10%, ${primary}40, transparent 50%),
              linear-gradient(160deg, ${secondary} 0%, #1c1c1c 52%, #0a0a0a 100%)
            `,
          }}
        />
        <div className="public-grain pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay" aria-hidden="true" />

        <div className="relative mx-auto grid min-h-[100svh] max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            className="flex flex-col justify-end px-6 pb-14 pt-24 sm:px-10 lg:justify-center lg:pb-20 lg:pt-20 xl:px-16"
            variants={heroVariants}
            initial="hidden"
            animate="show"
          >
            <motion.p
              variants={heroItem}
              className="mb-6 font-display text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-white/55"
            >
              Portfolio
            </motion.p>

            <motion.h1
              variants={heroItem}
              className="font-display text-[clamp(3rem,8.5vw,6.25rem)] font-extrabold leading-[0.94] tracking-tight text-white"
            >
              {portfolio.fullName}
            </motion.h1>

            {portfolio.summary ? (
              <motion.p
                variants={heroItem}
                className="mt-7 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8"
              >
                {portfolio.summary}
              </motion.p>
            ) : null}

            <motion.div variants={heroItem} className="mt-10 flex flex-wrap gap-x-7 gap-y-4 text-white">
              <ContactLink href={portfolio.publicEmail ? `mailto:${portfolio.publicEmail}` : undefined} icon={<Mail className="h-4 w-4" />}>
                Email
              </ContactLink>
              <ContactLink href={portfolio.githubUrl} icon={<Github className="h-4 w-4" />}>
                GitHub
              </ContactLink>
              <ContactLink href={portfolio.linkedinUrl} icon={<Linkedin className="h-4 w-4" />}>
                LinkedIn
              </ContactLink>
              <ContactLink href={portfolio.phone ? `tel:${portfolio.phone}` : undefined} icon={<Phone className="h-4 w-4" />}>
                Call
              </ContactLink>
            </motion.div>
          </motion.div>

          <motion.div
            className="relative min-h-[48vh] lg:min-h-full"
            initial={reduceMotion ? false : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            {portfolio.profileImageUrl ? (
              <img
                src={portfolio.profileImageUrl}
                alt={`${portfolio.fullName}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: `linear-gradient(160deg, ${primary}, ${secondary})` }}
              >
                <span className="font-serif text-[8rem] text-white/25 sm:text-[11rem]">{initials(portfolio.fullName)}</span>
              </div>
            )}
            <div
              className="absolute inset-0 lg:hidden"
              style={{ background: `linear-gradient(to top, ${secondary}ee 0%, transparent 45%)` }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-y-0 left-0 hidden w-32 lg:block"
              style={{ background: `linear-gradient(to right, ${secondary}, transparent)` }}
              aria-hidden="true"
            />
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 lg:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          aria-hidden="true"
        >
          <motion.div
            className="h-10 w-px bg-white/60"
            animate={reduceMotion ? undefined : { scaleY: [0.4, 1, 0.4], originY: 0 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </section>

      {/* Projects */}
      <section className="px-6 py-20 sm:px-10 lg:px-16 xl:px-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading accent={primary}>Selected work</SectionHeading>
          </Reveal>

          {projects.length === 0 ? (
            <EmptyState title="No projects yet" body="Projects will appear here when they are published." />
          ) : (
            <div className="space-y-16 sm:space-y-24">
              {projects.map((project, index) => (
                <Reveal key={project.id} delay={index * 0.05}>
                  <article className="group grid gap-8 lg:grid-cols-12 lg:gap-12">
                    <div className={`lg:col-span-7 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                      <div className="overflow-hidden bg-[var(--pp-ink)]/5">
                        {project.imageUrl ? (
                          <motion.img
                            src={project.imageUrl}
                            alt=""
                            loading="lazy"
                            className="aspect-[16/10] w-full object-cover"
                            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
                            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                          />
                        ) : (
                          <div
                            className="flex aspect-[16/10] items-end p-8"
                            style={{ background: `linear-gradient(135deg, ${primary}33, ${secondary}22)` }}
                          >
                            <span className="font-serif text-5xl text-[var(--pp-ink)]/25">{String(index + 1).padStart(2, "0")}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`flex flex-col justify-center lg:col-span-5 ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                      <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-[var(--pp-muted)]">
                        {String(index + 1).padStart(2, "0")}
                      </p>
                      <h3 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">{project.title}</h3>
                      {project.techStack ? (
                        <p className="mt-3 text-sm font-medium text-[var(--pp-muted)]">{project.techStack}</p>
                      ) : null}
                      {project.description ? (
                        <p className="mt-5 text-[0.95rem] leading-7 text-[var(--pp-ink)]/75">{project.description}</p>
                      ) : null}
                      <div className="mt-7 flex flex-wrap gap-5">
                        {project.liveUrl ? (
                          <a
                            href={project.liveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold"
                            style={{ color: primary }}
                          >
                            View live <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ) : null}
                        {project.githubUrl ? (
                          <a
                            href={project.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--pp-ink)]/70 transition hover:text-[var(--pp-ink)]"
                          >
                            Source <Github className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Experience */}
      <section
        className="px-6 py-20 sm:px-10 lg:px-16 xl:px-24"
        style={{ background: `linear-gradient(180deg, #ebebeb 0%, var(--pp-paper) 100%)` }}
      >
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading accent={primary}>Experience</SectionHeading>
          </Reveal>

          {experiences.length === 0 ? (
            <EmptyState title="No experience yet" body="Experience entries will appear here when they are published." />
          ) : (
            <div className="relative space-y-0">
              <div
                className="absolute bottom-2 left-[0.55rem] top-2 w-px sm:left-[0.7rem]"
                style={{ backgroundColor: `${primary}40` }}
                aria-hidden="true"
              />
              {experiences.map((experience, index) => (
                <Reveal key={experience.id} delay={index * 0.06}>
                  <article className="relative grid gap-3 border-b border-[var(--pp-ink)]/10 py-10 pl-10 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-10 sm:pl-14">
                    <div
                      className="absolute left-0 top-12 h-3 w-3 rounded-full border-2 bg-[var(--pp-paper)]"
                      style={{ borderColor: primary }}
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="font-display text-xl font-bold tracking-tight">{experience.jobTitle}</h3>
                      <p className="mt-2 text-sm font-medium text-[var(--pp-muted)]">
                        {[experience.companyName, experience.employmentType, experience.location].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-2 font-serif text-lg italic text-[var(--pp-ink)]/55">
                        {[experience.startDate, experience.currentlyWorking ? "Present" : experience.endDate]
                          .filter(Boolean)
                          .join(" — ")}
                      </p>
                    </div>
                    {experience.description ? (
                      <p className="text-[0.95rem] leading-7 text-[var(--pp-ink)]/75">{experience.description}</p>
                    ) : (
                      <div />
                    )}
                  </article>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Skills + Certifications */}
      <section className="px-6 py-20 sm:px-10 lg:px-16 xl:px-24">
        <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-2 lg:gap-24">
          <Reveal>
            <SectionHeading accent={primary}>Skills</SectionHeading>
            {skillsByCategory.length === 0 ? (
              <p className="text-sm text-[var(--pp-muted)]">No skills published yet.</p>
            ) : (
              <div className="space-y-8">
                {skillsByCategory.map(([category, skills]) => (
                  <div key={category}>
                    <h3 className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-[var(--pp-muted)]">
                      {category}
                    </h3>
                    <p className="mt-3 font-serif text-2xl leading-relaxed text-[var(--pp-ink)]">
                      {skills.join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Reveal>

          <Reveal delay={0.1}>
            <SectionHeading accent={primary}>Credentials</SectionHeading>
            {certifications.length === 0 ? (
              <p className="text-sm text-[var(--pp-muted)]">No certifications published yet.</p>
            ) : (
              <ul className="space-y-8">
                {certifications.map((certification) => (
                  <li key={certification.id} className="border-t border-[var(--pp-ink)]/10 pt-6 first:border-t-0 first:pt-0">
                    <h3 className="font-display text-lg font-bold tracking-tight">{certification.name}</h3>
                    <p className="mt-1 text-sm text-[var(--pp-muted)]">{certification.issuingOrganization}</p>
                    <p className="mt-1 text-xs tracking-wide text-[var(--pp-ink)]/45">
                      {[certification.issueDate, certification.expiryDate].filter(Boolean).join(" — ")}
                    </p>
                    {certification.credentialUrl ? (
                      <a
                        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold"
                        style={{ color: primary }}
                        href={certification.credentialUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Credential <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </div>
      </section>

      {/* Elsewhere / custom links */}
      {customLinks.length > 0 ? (
        <section className="border-t border-[var(--pp-ink)]/10 px-6 py-16 sm:px-10 lg:px-16 xl:px-24">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <SectionHeading accent={primary}>Elsewhere</SectionHeading>
              <div className="flex flex-wrap gap-x-10 gap-y-5">
                {customLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight transition"
                  >
                    {link.label}
                    <ArrowUpRight
                      className="h-4 w-4 opacity-40 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                      style={{ color: primary }}
                      aria-hidden="true"
                    />
                  </a>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-[var(--pp-ink)]/10 px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-serif text-lg italic text-[var(--pp-ink)]/50">{portfolio.fullName}</p>
          <p className="text-xs tracking-[0.2em] text-[var(--pp-muted)] uppercase">
            Built with{" "}
            <Link to="/" className="underline-offset-4 hover:underline">
              Stackfolio
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
