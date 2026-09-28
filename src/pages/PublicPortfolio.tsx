import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Github, Linkedin, Mail, Phone } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicPortfolio } from "../api/portfolio";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { apiErrorMessage, initials, orderByDisplay } from "../lib/utils";
import type { Portfolio } from "../types/portfolio";

function SocialLink({ href, children, icon }: { href?: string; children: ReactNode; icon: ReactNode }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-[var(--pp-ink)] backdrop-blur transition hover:border-black/20 hover:bg-white"
    >
      {icon}
      {children}
    </a>
  );
}

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
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
      <main className="min-h-screen bg-[#fafafa]">
        <Spinner label="Loading portfolio" />
      </main>
    );
  }

  if (error || !portfolio) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
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

  const primary = portfolio.primaryColor || "#2563eb";
  const secondary = portfolio.secondaryColor || "#0f172a";
  const projects = orderByDisplay(portfolio.projects);
  const experiences = orderByDisplay(portfolio.experiences);
  const certifications = orderByDisplay(portfolio.certifications);
  const customLinks = orderByDisplay(portfolio.customLinks);

  return (
    <main
      className="min-h-screen bg-[#fafafa] font-sans text-[var(--pp-ink)] antialiased"
      style={
        {
          "--pp-accent": primary,
          "--pp-ink": secondary,
        } as CSSProperties
      }
    >
      {/* Soft atmospheric background — not flat, not theatrical */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 90% 55% at 10% -10%, ${primary}18, transparent 55%),
            radial-gradient(ellipse 70% 45% at 100% 0%, ${primary}10, transparent 50%),
            linear-gradient(180deg, #ffffff 0%, #fafafa 40%, #f4f4f5 100%)
          `,
        }}
        aria-hidden="true"
      />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <p className="font-display text-sm font-semibold tracking-tight">Stackfolio</p>
        {customLinks[0] ? (
          <a
            href={customLinks[0].url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition hover:text-[var(--pp-ink)]"
          >
            {customLinks[0].label}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-14">
        <motion.div
          className="flex flex-col gap-8 sm:flex-row sm:items-end sm:gap-12"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="shrink-0">
            {portfolio.profileImageUrl ? (
              <motion.img
                src={portfolio.profileImageUrl}
                alt={portfolio.fullName}
                className="h-28 w-28 rounded-2xl object-cover shadow-soft ring-1 ring-black/5 sm:h-36 sm:w-36"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : (
              <div
                className="flex h-28 w-28 items-center justify-center rounded-2xl text-3xl font-bold text-white shadow-soft sm:h-36 sm:w-36 sm:text-4xl"
                style={{ backgroundColor: primary }}
              >
                {initials(portfolio.fullName)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <motion.h1
              className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl"
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              {portfolio.fullName}
            </motion.h1>

            {portfolio.summary ? (
              <motion.p
                className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8"
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
              >
                {portfolio.summary}
              </motion.p>
            ) : null}

            <motion.div
              className="mt-7 flex flex-wrap gap-2.5"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <SocialLink href={portfolio.publicEmail ? `mailto:${portfolio.publicEmail}` : undefined} icon={<Mail className="h-4 w-4" />}>
                Email
              </SocialLink>
              <SocialLink href={portfolio.githubUrl} icon={<Github className="h-4 w-4" />}>
                GitHub
              </SocialLink>
              <SocialLink href={portfolio.linkedinUrl} icon={<Linkedin className="h-4 w-4" />}>
                LinkedIn
              </SocialLink>
              <SocialLink href={portfolio.phone ? `tel:${portfolio.phone}` : undefined} icon={<Phone className="h-4 w-4" />}>
                Call
              </SocialLink>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <div className="mx-auto max-w-5xl space-y-20 px-5 pb-24 sm:px-8 sm:space-y-28">
        {/* Projects */}
        <section>
          <FadeIn>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Projects</h2>
            <p className="mt-2 text-sm text-zinc-500">Selected work and experiments.</p>
          </FadeIn>

          <div className="mt-8 space-y-6">
            {projects.length === 0 ? (
              <EmptyState title="No projects yet" body="Projects will appear here when they are published." />
            ) : (
              projects.map((project, index) => (
                <FadeIn key={project.id} delay={index * 0.04}>
                  <article className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 shadow-sm backdrop-blur transition hover:shadow-soft">
                    <div className={`grid gap-0 ${project.imageUrl ? "md:grid-cols-[1.1fr_1fr]" : ""}`}>
                      {project.imageUrl ? (
                        <div className="overflow-hidden bg-zinc-100">
                          <img
                            src={project.imageUrl}
                            alt=""
                            loading="lazy"
                            className="aspect-[16/10] h-full w-full object-cover transition duration-500 hover:scale-[1.02] md:aspect-auto md:min-h-[220px]"
                          />
                        </div>
                      ) : null}
                      <div className="flex flex-col justify-center p-6 sm:p-8">
                        <h3 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{project.title}</h3>
                        {project.techStack ? <p className="mt-2 text-sm font-medium text-zinc-500">{project.techStack}</p> : null}
                        {project.description ? (
                          <p className="mt-4 text-sm leading-7 text-zinc-600">{project.description}</p>
                        ) : null}
                        <div className="mt-5 flex flex-wrap gap-4">
                          {project.liveUrl ? (
                            <a
                              href={project.liveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm font-semibold"
                              style={{ color: primary }}
                            >
                              Live demo <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                            </a>
                          ) : null}
                          {project.githubUrl ? (
                            <a
                              href={project.githubUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-600 hover:text-[var(--pp-ink)]"
                            >
                              <Github className="h-4 w-4" aria-hidden="true" /> Code
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                </FadeIn>
              ))
            )}
          </div>
        </section>

        {/* Experience */}
        <section>
          <FadeIn>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Experience</h2>
          </FadeIn>

          <div className="mt-8">
            {experiences.length === 0 ? (
              <EmptyState title="No experience yet" body="Experience entries will appear here when they are published." />
            ) : (
              <div className="space-y-0 divide-y divide-zinc-200/80">
                {experiences.map((experience, index) => (
                  <FadeIn key={experience.id} delay={index * 0.04}>
                    <article className="grid gap-3 py-7 sm:grid-cols-[200px_1fr] sm:gap-10">
                      <div>
                        <p className="text-sm font-medium text-zinc-500">
                          {[experience.startDate, experience.currentlyWorking ? "Present" : experience.endDate]
                            .filter(Boolean)
                            .join(" — ")}
                        </p>
                        {experience.location ? <p className="mt-1 text-sm text-zinc-400">{experience.location}</p> : null}
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-bold tracking-tight">{experience.jobTitle}</h3>
                        <p className="mt-1 text-sm font-medium text-zinc-600">
                          {[experience.companyName, experience.employmentType].filter(Boolean).join(" · ")}
                        </p>
                        {experience.description ? (
                          <p className="mt-3 text-sm leading-7 text-zinc-600">{experience.description}</p>
                        ) : null}
                      </div>
                    </article>
                  </FadeIn>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Skills + Certs */}
        <section className="grid gap-14 lg:grid-cols-2">
          <FadeIn>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Skills</h2>
            <div className="mt-6 space-y-6">
              {skillsByCategory.length === 0 ? (
                <p className="text-sm text-zinc-500">No skills published yet.</p>
              ) : (
                skillsByCategory.map(([category, skills]) => (
                  <div key={category}>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{category}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-lg border border-black/[0.06] bg-white px-3 py-1.5 text-sm font-medium text-zinc-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </FadeIn>

          <FadeIn delay={0.08}>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Certifications</h2>
            <div className="mt-6 space-y-5">
              {certifications.length === 0 ? (
                <p className="text-sm text-zinc-500">No certifications published yet.</p>
              ) : (
                certifications.map((certification) => (
                  <article key={certification.id} className="border-t border-zinc-200/80 pt-5 first:border-t-0 first:pt-0">
                    <h3 className="font-display text-base font-bold tracking-tight">{certification.name}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{certification.issuingOrganization}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {[certification.issueDate, certification.expiryDate].filter(Boolean).join(" — ")}
                    </p>
                    {certification.credentialUrl ? (
                      <a
                        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold"
                        style={{ color: primary }}
                        href={certification.credentialUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View credential <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </FadeIn>
        </section>

        {customLinks.length > 0 ? (
          <section>
            <FadeIn>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Links</h2>
              <div className="mt-6 flex flex-wrap gap-3">
                {customLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold transition hover:border-black/20"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </FadeIn>
          </section>
        ) : null}
      </div>

      <footer className="border-t border-zinc-200/80 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 text-sm text-zinc-500">
          <span>{portfolio.fullName}</span>
          <Link to="/" className="hover:text-[var(--pp-ink)]">
            Stackfolio
          </Link>
        </div>
      </footer>
    </main>
  );
}
