import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Github, Linkedin, Mail, Phone, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RecoveringProfileImage from "../RecoveringProfileImage";
import { groupSkillsByCategory } from "../../lib/portfolioThemes";
import { initials, orderByDisplay } from "../../lib/utils";
import type { Portfolio } from "../../types/portfolio";

function TypeLine({ text, prefix = ">" }: { text: string; prefix?: string }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? text : "");

  useEffect(() => {
    if (reduceMotion) {
      setShown(text);
      return;
    }
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
  }, [text, reduceMotion]);

  return (
    <p className="font-mono text-sm leading-6 text-hacker-muted sm:text-base">
      <span className="text-hacker-green">{prefix}</span> {shown}
      <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-hacker-green align-middle" aria-hidden="true" />
    </p>
  );
}

export default function DarkTechPortfolioTheme({ portfolio }: { portfolio: Portfolio }) {
  const reduceMotion = useReducedMotion();
  const accent = portfolio.primaryColor || "#33ff99";
  const projects = orderByDisplay(portfolio.projects);
  const experiences = orderByDisplay(portfolio.experiences);
  const certifications = orderByDisplay(portfolio.certifications);
  const customLinks = orderByDisplay(portfolio.customLinks);
  const skillsByCategory = groupSkillsByCategory(portfolio.technicalSkills ?? []);

  return (
    <main className="hacker-page min-h-screen text-hacker-fg">
      <div className="hacker-scanlines pointer-events-none fixed inset-0 z-50" aria-hidden="true" />
      <div className="hacker-grid pointer-events-none fixed inset-0 -z-0 opacity-40" aria-hidden="true" />

      <header className="relative z-10 border-b border-hacker-border/80 bg-hacker-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-hacker-green">
            <Terminal className="h-4 w-4" aria-hidden="true" />
            stackfolio@root:~
          </div>
          <p className="font-mono text-xs text-hacker-muted">session /{portfolio.slug}</p>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: accent }}>
            // identity.dump
          </p>
          <h1 className="mt-4 font-hacker text-[clamp(2.5rem,8vw,4.5rem)] font-bold leading-none tracking-tight text-white">
            {portfolio.fullName}
          </h1>
          {portfolio.summary ? (
            <div className="mt-6 rounded border border-hacker-border bg-black/40 p-4">
              <TypeLine text="cat about.txt" prefix="$" />
              <p className="mt-3 font-mono text-sm leading-6 text-hacker-fg/90 sm:text-base">{portfolio.summary}</p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            {portfolio.publicEmail ? (
              <a className="hacker-chip" href={`mailto:${portfolio.publicEmail}`}>
                <Mail className="h-3.5 w-3.5" /> mail
              </a>
            ) : null}
            {portfolio.githubUrl ? (
              <a className="hacker-chip" href={portfolio.githubUrl} target="_blank" rel="noreferrer">
                <Github className="h-3.5 w-3.5" /> github
              </a>
            ) : null}
            {portfolio.linkedinUrl ? (
              <a className="hacker-chip" href={portfolio.linkedinUrl} target="_blank" rel="noreferrer">
                <Linkedin className="h-3.5 w-3.5" /> linkedin
              </a>
            ) : null}
            {portfolio.phone ? (
              <a className="hacker-chip" href={`tel:${portfolio.phone}`}>
                <Phone className="h-3.5 w-3.5" /> call
              </a>
            ) : null}
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end"
        >
          <div className="hacker-frame overflow-hidden">
            <div className="flex items-center gap-2 border-b border-hacker-border bg-black/50 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-hacker-muted">
              <span className="h-2 w-2 rounded-full bg-red-500/80" />
              <span className="h-2 w-2 rounded-full bg-amber-400/80" />
              <span className="h-2 w-2 rounded-full bg-hacker-green/80" />
              <span className="ml-2">profile.bmp</span>
            </div>
            {portfolio.profileImageUrl ? (
              <RecoveringProfileImage src={portfolio.profileImageUrl} name={portfolio.fullName} primary={accent} />
            ) : (
              <div
                className="flex aspect-[4/5] items-center justify-center font-hacker text-6xl text-black"
                style={{ background: accent }}
              >
                {initials(portfolio.fullName)}
              </div>
            )}
          </div>
        </motion.div>
      </section>

      <div className="relative z-10 mx-auto max-w-6xl space-y-14 px-4 pb-16 sm:px-6 sm:pb-24">
        <section>
          <h2 className="hacker-heading" style={{ color: accent }}>
            ./projects
          </h2>
          {projects.length === 0 ? (
            <p className="mt-4 font-mono text-sm text-hacker-muted"># no entries</p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {projects.map((project, index) => (
                <motion.article
                  key={project.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ delay: index * 0.05 }}
                  className="hacker-frame p-4"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-hacker-muted">
                    module_{String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-2 font-hacker text-xl text-white">{project.title}</h3>
                  {project.techStack ? (
                    <p className="mt-2 font-mono text-xs text-hacker-green">{project.techStack}</p>
                  ) : null}
                  {project.description ? (
                    <p className="mt-3 font-mono text-sm leading-6 text-hacker-muted">{project.description}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3 font-mono text-xs">
                    {project.liveUrl ? (
                      <a className="hacker-link" href={project.liveUrl} target="_blank" rel="noreferrer">
                        live <ArrowUpRight className="h-3 w-3" />
                      </a>
                    ) : null}
                    {project.githubUrl ? (
                      <a className="hacker-link" href={project.githubUrl} target="_blank" rel="noreferrer">
                        src <ArrowUpRight className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="hacker-heading" style={{ color: accent }}>
            ./experience.log
          </h2>
          {experiences.length === 0 ? (
            <p className="mt-4 font-mono text-sm text-hacker-muted"># empty</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {experiences.map((experience) => (
                <li key={experience.id} className="hacker-frame border-l-2 p-4" style={{ borderLeftColor: accent }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-hacker text-lg text-white">{experience.jobTitle}</h3>
                    <span className="font-mono text-[11px] text-hacker-muted">
                      {[experience.startDate, experience.currentlyWorking ? "PRESENT" : experience.endDate]
                        .filter(Boolean)
                        .join(" -> ")}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-hacker-green">
                    {[experience.companyName, experience.location, experience.employmentType].filter(Boolean).join(" | ")}
                  </p>
                  {experience.description ? (
                    <p className="mt-3 font-mono text-sm leading-6 text-hacker-muted">{experience.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="hacker-heading" style={{ color: accent }}>
              ./skills
            </h2>
            {skillsByCategory.length === 0 ? (
              <p className="mt-4 font-mono text-sm text-hacker-muted"># none</p>
            ) : (
              <div className="mt-6 space-y-5">
                {skillsByCategory.map(([category, skills]) => (
                  <div key={category}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-hacker-muted">{category}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <span key={skill} className="hacker-chip !normal-case">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="hacker-heading" style={{ color: accent }}>
              ./certs
            </h2>
            {certifications.length === 0 ? (
              <p className="mt-4 font-mono text-sm text-hacker-muted"># none</p>
            ) : (
              <ul className="mt-6 space-y-3">
                {certifications.map((certification) => (
                  <li key={certification.id} className="hacker-frame p-3">
                    <h3 className="font-hacker text-base text-white">{certification.name}</h3>
                    <p className="mt-1 font-mono text-xs text-hacker-muted">
                      {[certification.issuingOrganization, certification.issueDate].filter(Boolean).join(" · ")}
                    </p>
                    {certification.credentialUrl ? (
                      <a className="hacker-link mt-2 inline-flex" href={certification.credentialUrl} target="_blank" rel="noreferrer">
                        verify <ArrowUpRight className="h-3 w-3" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {customLinks.length > 0 ? (
          <section>
            <h2 className="hacker-heading" style={{ color: accent }}>
              ./links
            </h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {customLinks.map((link) => (
                <a key={link.id} className="hacker-chip" href={link.url} target="_blank" rel="noreferrer">
                  {link.label} <ArrowUpRight className="h-3 w-3" />
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <footer className="relative z-10 border-t border-hacker-border bg-black/50 px-4 py-6 font-mono text-xs text-hacker-muted sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-hacker-green">{portfolio.fullName}@stackfolio</p>
          <p>
            process owned by{" "}
            <Link to="/" className="text-white underline decoration-hacker-green/50 underline-offset-4">
              Stackfolio
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
