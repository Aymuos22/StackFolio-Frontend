import { BriefcaseBusiness, ExternalLink, Github, Linkedin, Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicPortfolio } from "../api/portfolio";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { apiErrorMessage, orderByDisplay } from "../lib/utils";
import type { Portfolio } from "../types/portfolio";

function PublicLink({
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
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10"
    >
      {icon}
      {children}
    </a>
  );
}

export default function PublicPortfolio() {
  const { slug } = useParams();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
      <main className="min-h-screen bg-slate-50">
        <Spinner label="Loading portfolio" />
      </main>
    );
  }

  if (error || !portfolio) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
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
  const secondary = portfolio.secondaryColor || "#111827";

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="relative overflow-hidden" style={{ backgroundColor: secondary }}>
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_340px] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <div className="mb-6">
              <Avatar
                name={portfolio.fullName}
                imageUrl={portfolio.profileImageUrl}
                backgroundColor={primary}
                sizeClassName="h-20 w-20"
                textClassName="text-2xl"
                className="rounded-lg"
              />
            </div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">{portfolio.fullName}</h1>
            {portfolio.summary ? (
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-200">{portfolio.summary}</p>
            ) : null}
            <div className="mt-7 flex flex-wrap gap-3">
              <PublicLink href={portfolio.publicEmail ? `mailto:${portfolio.publicEmail}` : undefined} icon={<Mail className="h-4 w-4" />}>
                Email
              </PublicLink>
              <PublicLink href={portfolio.githubUrl} icon={<Github className="h-4 w-4" />}>
                GitHub
              </PublicLink>
              <PublicLink href={portfolio.linkedinUrl} icon={<Linkedin className="h-4 w-4" />}>
                LinkedIn
              </PublicLink>
              <PublicLink href={portfolio.phone ? `tel:${portfolio.phone}` : undefined} icon={<Phone className="h-4 w-4" />}>
                Call
              </PublicLink>
            </div>
          </div>

          <aside className="rounded-lg border border-white/15 bg-white/10 p-5 backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Quick links</h2>
            <div className="mt-4 space-y-2">
              {orderByDisplay(portfolio.customLinks).length === 0 ? (
                <p className="text-sm text-slate-300">No custom links published yet.</p>
              ) : (
                orderByDisplay(portfolio.customLinks).map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-md border border-white/15 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <span>{link.label}</span>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ))
              )}
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
        <div className="space-y-10">
          <section>
            <div className="flex items-center gap-3">
              <BriefcaseBusiness className="h-5 w-5" style={{ color: primary }} aria-hidden="true" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">Projects</h2>
            </div>
            <div className="mt-5 grid gap-5">
              {orderByDisplay(portfolio.projects).length === 0 ? (
                <EmptyState title="No projects yet" body="Projects will appear here when they are published." />
              ) : (
                orderByDisplay(portfolio.projects).map((project) => (
                  <article key={project.id} className="rounded-lg border border-line bg-white p-5 shadow-sm">
                    {project.imageUrl ? (
                      <img
                        src={project.imageUrl}
                        alt=""
                        className="mb-4 aspect-video w-full rounded-md object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{project.title}</h3>
                        {project.techStack ? <p className="mt-1 text-sm font-medium text-slate-500">{project.techStack}</p> : null}
                      </div>
                      <div className="flex gap-2">
                        {project.githubUrl ? (
                          <a
                            className="rounded-md border border-line p-2 text-slate-700 hover:bg-slate-50"
                            href={project.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Github className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ) : null}
                        {project.liveUrl ? (
                          <a
                            className="rounded-md border border-line p-2 text-slate-700 hover:bg-slate-50"
                            href={project.liveUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                    {project.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{project.description}</p> : null}
                  </article>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Experience</h2>
            <div className="mt-5 space-y-4">
              {orderByDisplay(portfolio.experiences).length === 0 ? (
                <EmptyState title="No experience yet" body="Experience entries will appear here when they are published." />
              ) : (
                orderByDisplay(portfolio.experiences).map((experience) => (
                  <article key={experience.id} className="rounded-lg border border-line bg-white p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-950">{experience.jobTitle}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-600">
                      {[experience.companyName, experience.employmentType, experience.location].filter(Boolean).join(" - ")}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {[experience.startDate, experience.currentlyWorking ? "Present" : experience.endDate].filter(Boolean).join(" - ")}
                    </p>
                    {experience.description ? (
                      <p className="mt-3 text-sm leading-6 text-slate-600">{experience.description}</p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Technical skills</h2>
            <div className="mt-4 space-y-4">
              {skillsByCategory.length === 0 ? (
                <p className="text-sm text-slate-500">No skills published yet.</p>
              ) : (
                skillsByCategory.map(([category, skills]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-slate-700">{category}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-line px-3 py-1 text-sm font-medium text-slate-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Certifications</h2>
            <div className="mt-4 space-y-4">
              {orderByDisplay(portfolio.certifications).length === 0 ? (
                <p className="text-sm text-slate-500">No certifications published yet.</p>
              ) : (
                orderByDisplay(portfolio.certifications).map((certification) => (
                  <article key={certification.id}>
                    <h3 className="text-sm font-semibold text-slate-950">{certification.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{certification.issuingOrganization}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[certification.issueDate, certification.expiryDate].filter(Boolean).join(" - ")}
                    </p>
                    {certification.credentialUrl ? (
                      <a
                        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 hover:underline"
                        href={certification.credentialUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Credential <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
