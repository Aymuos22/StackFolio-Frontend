import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Github, Linkedin, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import RecoveringProfileImage from "../RecoveringProfileImage";
import { groupSkillsByCategory } from "../../lib/portfolioThemes";
import { initials, orderByDisplay } from "../../lib/utils";
import type { Portfolio } from "../../types/portfolio";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const, delay },
  };
}

export default function MinimalistPortfolioTheme({ portfolio }: { portfolio: Portfolio }) {
  const reduceMotion = useReducedMotion();
  const primary = portfolio.primaryColor || "#1c1917";
  const secondary = portfolio.secondaryColor || "#57534e";
  const projects = orderByDisplay(portfolio.projects);
  const experiences = orderByDisplay(portfolio.experiences);
  const certifications = orderByDisplay(portfolio.certifications);
  const customLinks = orderByDisplay(portfolio.customLinks);
  const skillsByCategory = groupSkillsByCategory(portfolio.technicalSkills ?? []);

  const motionProps = reduceMotion ? {} : fadeUp();

  return (
    <main className="minimal-page min-h-screen text-stone-900">
      <div className="minimal-atmosphere pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 sm:px-8">
        <Link to="/" className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-stone-500">
          Stackfolio
        </Link>
        <p className="font-mono text-xs tracking-widest text-stone-400">/{portfolio.slug}</p>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-16">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-end"
        >
          <div>
            <p className="mb-6 text-xs font-medium uppercase tracking-[0.28em]" style={{ color: secondary }}>
              Portfolio
            </p>
            <h1 className="font-serif text-[clamp(3rem,10vw,5.75rem)] leading-[0.95] tracking-tight text-stone-950">
              {portfolio.fullName}
            </h1>
            {portfolio.summary ? (
              <p className="mt-8 max-w-xl text-lg leading-8 text-stone-600 sm:text-xl sm:leading-9">{portfolio.summary}</p>
            ) : null}
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-stone-800">
              {portfolio.publicEmail ? (
                <a className="minimal-link" href={`mailto:${portfolio.publicEmail}`}>
                  <Mail className="h-4 w-4" aria-hidden="true" /> Email
                </a>
              ) : null}
              {portfolio.githubUrl ? (
                <a className="minimal-link" href={portfolio.githubUrl} target="_blank" rel="noreferrer">
                  <Github className="h-4 w-4" aria-hidden="true" /> GitHub
                </a>
              ) : null}
              {portfolio.linkedinUrl ? (
                <a className="minimal-link" href={portfolio.linkedinUrl} target="_blank" rel="noreferrer">
                  <Linkedin className="h-4 w-4" aria-hidden="true" /> LinkedIn
                </a>
              ) : null}
              {portfolio.phone ? (
                <a className="minimal-link" href={`tel:${portfolio.phone}`}>
                  <Phone className="h-4 w-4" aria-hidden="true" /> Call
                </a>
              ) : null}
            </div>
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end"
          >
            <div className="aspect-[4/5] overflow-hidden bg-stone-200">
              {portfolio.profileImageUrl ? (
                <RecoveringProfileImage src={portfolio.profileImageUrl} name={portfolio.fullName} primary={primary} />
              ) : (
                <div
                  className="flex h-full items-center justify-center font-serif text-6xl text-white"
                  style={{ background: `linear-gradient(160deg, ${primary}, ${secondary})` }}
                >
                  {initials(portfolio.fullName)}
                </div>
              )}
            </div>
            <div className="absolute -bottom-3 -left-3 h-full w-full border border-stone-300 -z-10" aria-hidden="true" />
          </motion.div>
        </motion.div>
      </section>

      <div className="mx-auto max-w-5xl space-y-24 px-6 pb-24 sm:px-8 sm:pb-32">
        <motion.section {...motionProps}>
          <h2 className="minimal-heading">Work</h2>
          {projects.length === 0 ? (
            <p className="mt-6 text-stone-500">No projects published yet.</p>
          ) : (
            <ul className="mt-10 divide-y divide-stone-200 border-y border-stone-200">
              {projects.map((project, index) => (
                <motion.li
                  key={project.id}
                  {...(reduceMotion ? {} : fadeUp(index * 0.05))}
                  className="grid gap-4 py-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-400">{String(index + 1).padStart(2, "0")}</p>
                    <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-stone-950">{project.title}</h3>
                    {project.techStack ? <p className="mt-2 text-sm text-stone-500">{project.techStack}</p> : null}
                    {project.description ? <p className="mt-3 max-w-2xl leading-7 text-stone-600">{project.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm font-medium">
                    {project.liveUrl ? (
                      <a className="minimal-link" href={project.liveUrl} target="_blank" rel="noreferrer">
                        Live <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                    {project.githubUrl ? (
                      <a className="minimal-link" href={project.githubUrl} target="_blank" rel="noreferrer">
                        Code <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section {...(reduceMotion ? {} : fadeUp(0.05))}>
          <h2 className="minimal-heading">Experience</h2>
          {experiences.length === 0 ? (
            <p className="mt-6 text-stone-500">No experience published yet.</p>
          ) : (
            <ul className="mt-10 space-y-10">
              {experiences.map((experience) => (
                <li key={experience.id} className="grid gap-2 sm:grid-cols-[140px_1fr]">
                  <p className="text-sm text-stone-400">
                    {[experience.startDate, experience.currentlyWorking ? "Present" : experience.endDate]
                      .filter(Boolean)
                      .join(" – ")}
                  </p>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-stone-950">{experience.jobTitle}</h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {[experience.companyName, experience.location, experience.employmentType].filter(Boolean).join(" · ")}
                    </p>
                    {experience.description ? (
                      <p className="mt-3 max-w-2xl leading-7 text-stone-600">{experience.description}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        <div className="grid gap-16 lg:grid-cols-2">
          <motion.section {...(reduceMotion ? {} : fadeUp())}>
            <h2 className="minimal-heading">Skills</h2>
            {skillsByCategory.length === 0 ? (
              <p className="mt-6 text-stone-500">No skills published yet.</p>
            ) : (
              <div className="mt-8 space-y-6">
                {skillsByCategory.map(([category, skills]) => (
                  <div key={category}>
                    <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-stone-400">{category}</h3>
                    <p className="mt-2 text-base leading-8 text-stone-700">{skills.join("  ·  ")}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          <motion.section {...(reduceMotion ? {} : fadeUp(0.08))}>
            <h2 className="minimal-heading">Certifications</h2>
            {certifications.length === 0 ? (
              <p className="mt-6 text-stone-500">No certifications published yet.</p>
            ) : (
              <ul className="mt-8 space-y-5">
                {certifications.map((certification) => (
                  <li key={certification.id}>
                    <h3 className="font-display text-lg font-semibold text-stone-950">{certification.name}</h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {[certification.issuingOrganization, certification.issueDate].filter(Boolean).join(" · ")}
                    </p>
                    {certification.credentialUrl ? (
                      <a className="minimal-link mt-2 inline-flex" href={certification.credentialUrl} target="_blank" rel="noreferrer">
                        Credential <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        </div>

        {customLinks.length > 0 ? (
          <motion.section {...(reduceMotion ? {} : fadeUp())}>
            <h2 className="minimal-heading">Links</h2>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {customLinks.map((link) => (
                <a key={link.id} className="minimal-link text-base" href={link.url} target="_blank" rel="noreferrer">
                  {link.label} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ))}
            </div>
          </motion.section>
        ) : null}
      </div>

      <footer className="border-t border-stone-200">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-serif text-lg text-stone-800">{portfolio.fullName}</p>
          <p>
            Built with{" "}
            <Link to="/" className="underline decoration-stone-300 underline-offset-4 hover:text-stone-800">
              Stackfolio
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
