import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  createCertification,
  createCustomLink,
  createExperience,
  createPortfolio,
  createProject,
  createTechnicalSkill,
  suggestPortfolio,
  updatePortfolio,
  updateSummary,
} from "../api/portfolio";
import { normalizePortfolioTheme } from "../lib/portfolioThemes";
import { apiErrorMessage, cn, normalizeOptionalFields } from "../lib/utils";
import { suggestPortfolioSchema, type SuggestPortfolioForm } from "../schemas/portfolio";
import type {
  Portfolio,
  PortfolioSuggestResponse,
  SuggestedCertification,
  SuggestedCustomLink,
  SuggestedExperience,
  SuggestedProject,
  SuggestedTechnicalSkill,
} from "../types/portfolio";
import { DEFAULT_PORTFOLIO_THEME } from "../types/portfolio";
import Button from "./Button";
import Modal from "./Modal";

const MAX_CHARS = 50_000;

const emptyDraft = (): PortfolioSuggestResponse => ({
  fullName: null,
  phone: null,
  publicEmail: null,
  linkedinUrl: null,
  githubUrl: null,
  summary: null,
  projects: [],
  experiences: [],
  certifications: [],
  technicalSkills: [],
  customLinks: [],
});

function nullableString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toOptional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isoDateOrUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

type SuggestPortfolioPanelProps = {
  portfolio: Portfolio | null;
  onApplied: () => Promise<void>;
};

export default function SuggestPortfolioPanel({ portfolio, onApplied }: SuggestPortfolioPanelProps) {
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [draft, setDraft] = useState<PortfolioSuggestResponse>(emptyDraft);
  const [createSlug, setCreateSlug] = useState("");
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SuggestPortfolioForm>({
    resolver: zodResolver(suggestPortfolioSchema),
    defaultValues: { text: "" },
  });

  const text = watch("text") ?? "";
  const charCount = text.length;
  const canSubmit = text.trim().length > 0 && charCount <= MAX_CHARS && !isSuggesting;

  const sectionCounts = useMemo(
    () => ({
      projects: draft.projects.length,
      experiences: draft.experiences.length,
      certifications: draft.certifications.length,
      skills: draft.technicalSkills.length,
      links: draft.customLinks.length,
    }),
    [draft],
  );

  async function onSuggest(values: SuggestPortfolioForm) {
    setSuggestError(null);
    setIsSuggesting(true);
    try {
      const suggestion = await suggestPortfolio({ text: values.text.trim() });
      setDraft({
        fullName: suggestion.fullName ?? null,
        phone: suggestion.phone ?? null,
        publicEmail: suggestion.publicEmail ?? null,
        linkedinUrl: suggestion.linkedinUrl ?? null,
        githubUrl: suggestion.githubUrl ?? null,
        summary: suggestion.summary ?? null,
        projects: suggestion.projects ?? [],
        experiences: suggestion.experiences ?? [],
        certifications: suggestion.certifications ?? [],
        technicalSkills: suggestion.technicalSkills ?? [],
        customLinks: suggestion.customLinks ?? [],
      });
      setCreateSlug(portfolio?.slug ?? "");
      setReviewOpen(true);
      toast.success("Draft ready — review before applying.");
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 502) {
        const message = "AI suggestion failed. Try again.";
        setSuggestError(message);
        toast.error(message);
      } else {
        const message = apiErrorMessage(error, "Unable to generate suggestions.");
        setSuggestError(message);
        toast.error(message);
      }
    } finally {
      setIsSuggesting(false);
    }
  }

  function updateProfileField<K extends keyof PortfolioSuggestResponse>(key: K, value: PortfolioSuggestResponse[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateProject(index: number, patch: Partial<SuggestedProject>) {
    setDraft((current) => ({
      ...current,
      projects: current.projects.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function updateExperience(index: number, patch: Partial<SuggestedExperience>) {
    setDraft((current) => ({
      ...current,
      experiences: current.experiences.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function updateCertification(index: number, patch: Partial<SuggestedCertification>) {
    setDraft((current) => ({
      ...current,
      certifications: current.certifications.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function updateSkill(index: number, patch: Partial<SuggestedTechnicalSkill>) {
    setDraft((current) => ({
      ...current,
      technicalSkills: current.technicalSkills.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function updateLink(index: number, patch: Partial<SuggestedCustomLink>) {
    setDraft((current) => ({
      ...current,
      customLinks: current.customLinks.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function removeItem(section: keyof Pick<PortfolioSuggestResponse, "projects" | "experiences" | "certifications" | "technicalSkills" | "customLinks">, index: number) {
    setDraft((current) => ({
      ...current,
      [section]: current[section].filter((_, i) => i !== index),
    }));
  }

  async function onApply() {
    if (!portfolio) {
      const slug = createSlug.trim().toLowerCase();
      if (!/^[a-z0-9-]{3,}$/.test(slug)) {
        toast.error("Enter a valid slug (lowercase letters, numbers, hyphens; min 3).");
        return;
      }
    }

    setIsApplying(true);
    try {
      const hasProfileFields = Boolean(
        nullableString(draft.fullName) ||
          nullableString(draft.phone) ||
          nullableString(draft.publicEmail) ||
          nullableString(draft.linkedinUrl) ||
          nullableString(draft.githubUrl),
      );

      if (portfolio) {
        if (hasProfileFields) {
          await updatePortfolio({
            slug: portfolio.slug,
            theme: normalizePortfolioTheme(portfolio.theme),
            primaryColor: portfolio.primaryColor,
            secondaryColor: portfolio.secondaryColor,
            fullName: nullableString(draft.fullName) ?? portfolio.fullName,
            phone: toOptional(draft.phone) ?? portfolio.phone,
            publicEmail: toOptional(draft.publicEmail) ?? portfolio.publicEmail,
            linkedinUrl: toOptional(draft.linkedinUrl) ?? portfolio.linkedinUrl,
            githubUrl: toOptional(draft.githubUrl) ?? portfolio.githubUrl,
          });
        }
      } else {
        await createPortfolio(
          normalizeOptionalFields({
            slug: createSlug.trim().toLowerCase(),
            fullName: nullableString(draft.fullName) || "Portfolio",
            phone: toOptional(draft.phone),
            publicEmail: toOptional(draft.publicEmail),
            linkedinUrl: toOptional(draft.linkedinUrl),
            githubUrl: toOptional(draft.githubUrl),
            theme: DEFAULT_PORTFOLIO_THEME,
            primaryColor: "#2563eb",
            secondaryColor: "#111827",
          }),
        );
      }

      const summary = nullableString(draft.summary);
      if (summary) {
        await updateSummary({ summary });
      }

      for (const project of draft.projects) {
        const title = project.title?.trim();
        if (!title) continue;
        await createProject(
          normalizeOptionalFields({
            title,
            description: toOptional(project.description),
            techStack: toOptional(project.techStack),
            githubUrl: toOptional(project.githubUrl),
            liveUrl: toOptional(project.liveUrl),
            displayOrder: project.displayOrder ?? 0,
          }),
        );
      }

      for (const experience of draft.experiences) {
        const companyName = experience.companyName?.trim();
        const jobTitle = experience.jobTitle?.trim();
        if (!companyName || !jobTitle) continue;
        const currentlyWorking = Boolean(experience.currentlyWorking);
        await createExperience(
          normalizeOptionalFields({
            companyName,
            jobTitle,
            employmentType: toOptional(experience.employmentType),
            location: toOptional(experience.location),
            startDate: isoDateOrUndefined(experience.startDate),
            endDate: currentlyWorking ? undefined : isoDateOrUndefined(experience.endDate),
            currentlyWorking,
            description: toOptional(experience.description),
            displayOrder: experience.displayOrder ?? 0,
          }),
        );
      }

      for (const certification of draft.certifications) {
        const name = certification.name?.trim();
        if (!name) continue;
        await createCertification(
          normalizeOptionalFields({
            name,
            issuingOrganization: toOptional(certification.issuingOrganization),
            issueDate: isoDateOrUndefined(certification.issueDate),
            expiryDate: isoDateOrUndefined(certification.expiryDate),
            credentialId: toOptional(certification.credentialId),
            credentialUrl: toOptional(certification.credentialUrl),
            displayOrder: certification.displayOrder ?? 0,
          }),
        );
      }

      for (const skill of draft.technicalSkills) {
        const skillName = skill.skillName?.trim();
        if (!skillName) continue;
        await createTechnicalSkill(
          normalizeOptionalFields({
            skillName,
            category: toOptional(skill.category),
            displayOrder: skill.displayOrder ?? 0,
          }),
        );
      }

      for (const link of draft.customLinks) {
        const label = link.label?.trim();
        const url = link.url?.trim();
        if (!label || !url) continue;
        await createCustomLink(
          normalizeOptionalFields({
            label,
            url,
            icon: toOptional(link.icon),
            displayOrder: link.displayOrder ?? 0,
          }),
        );
      }

      setReviewOpen(false);
      setDraft(emptyDraft());
      toast.success("AI draft applied to your portfolio.");
      await onApplied();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to apply suggestions."));
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <>
      <section className="panel p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <Wand2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-950">Suggest with AI</h2>
            <p className="mt-1 text-sm text-slate-500">
              Paste a resume or bio. Review the draft before applying — nothing is saved until you confirm.
            </p>
          </div>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSuggest)}>
          <label className="block">
            <span className="label">Resume or bio text</span>
            <textarea
              className="field min-h-36 resize-y"
              rows={8}
              placeholder="Paste your resume, LinkedIn About section, or a short bio…"
              maxLength={MAX_CHARS}
              {...register("text")}
            />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              {errors.text?.message ? <p className="error">{errors.text.message}</p> : <span />}
              <p className={cn("text-xs font-medium", charCount > MAX_CHARS ? "text-red-600" : "text-slate-500")}>
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </p>
            </div>
          </label>

          {suggestError ? <p className="error">{suggestError}</p> : null}

          <Button type="submit" icon={<Sparkles className="h-4 w-4" />} isLoading={isSuggesting} disabled={!canSubmit}>
            Generate with AI
          </Button>
        </form>
      </section>

      <Modal open={reviewOpen} title="Review AI draft" onClose={() => !isApplying && setReviewOpen(false)}>
        <div className="space-y-6">
          <p className="text-sm leading-6 text-slate-600">
            Edit anything below, then apply. Existing portfolio data is only overwritten for fields you keep in this draft.
            Theme, colors, slug{portfolio ? "" : " (except when creating)"}, and profile image are never invented by AI.
          </p>

          <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{sectionCounts.projects} projects</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{sectionCounts.experiences} experiences</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{sectionCounts.certifications} certifications</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{sectionCounts.skills} skills</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{sectionCounts.links} links</span>
          </div>

          {!portfolio ? (
            <label className="block">
              <span className="label">Public slug (required to create portfolio)</span>
              <input
                className="field"
                value={createSlug}
                onChange={(event) => setCreateSlug(event.target.value.toLowerCase())}
                placeholder="john-doe"
              />
            </label>
          ) : null}

          <DraftSection title="Profile">
            <div className="grid gap-3 sm:grid-cols-2">
              <DraftInput label="Full name" value={draft.fullName ?? ""} onChange={(v) => updateProfileField("fullName", nullableString(v))} />
              <DraftInput label="Phone" value={draft.phone ?? ""} onChange={(v) => updateProfileField("phone", nullableString(v))} />
              <DraftInput label="Public email" value={draft.publicEmail ?? ""} onChange={(v) => updateProfileField("publicEmail", nullableString(v))} />
              <DraftInput label="LinkedIn URL" value={draft.linkedinUrl ?? ""} onChange={(v) => updateProfileField("linkedinUrl", nullableString(v))} />
              <DraftInput label="GitHub URL" value={draft.githubUrl ?? ""} onChange={(v) => updateProfileField("githubUrl", nullableString(v))} className="sm:col-span-2" />
            </div>
          </DraftSection>

          <DraftSection title="Summary">
            <textarea
              className="field min-h-28 resize-y"
              rows={4}
              value={draft.summary ?? ""}
              onChange={(event) => updateProfileField("summary", nullableString(event.target.value))}
              placeholder="Professional summary"
            />
          </DraftSection>

          <DraftSection title="Projects">
            {draft.projects.length === 0 ? (
              <EmptyDraft body="No projects in this draft." />
            ) : (
              draft.projects.map((project, index) => (
                <DraftCard key={`project-${index}`} onRemove={() => removeItem("projects", index)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DraftInput label="Title" value={project.title} onChange={(v) => updateProject(index, { title: v })} />
                    <DraftInput
                      label="Display order"
                      type="number"
                      value={String(project.displayOrder ?? 0)}
                      onChange={(v) => updateProject(index, { displayOrder: Number(v) || 0 })}
                    />
                    <DraftInput label="Tech stack" value={project.techStack ?? ""} onChange={(v) => updateProject(index, { techStack: nullableString(v) })} className="sm:col-span-2" />
                    <DraftInput label="GitHub URL" value={project.githubUrl ?? ""} onChange={(v) => updateProject(index, { githubUrl: nullableString(v) })} />
                    <DraftInput label="Live URL" value={project.liveUrl ?? ""} onChange={(v) => updateProject(index, { liveUrl: nullableString(v) })} />
                    <label className="block sm:col-span-2">
                      <span className="label">Description</span>
                      <textarea
                        className="field min-h-20 resize-y"
                        rows={3}
                        value={project.description ?? ""}
                        onChange={(event) => updateProject(index, { description: nullableString(event.target.value) })}
                      />
                    </label>
                  </div>
                </DraftCard>
              ))
            )}
          </DraftSection>

          <DraftSection title="Experiences">
            {draft.experiences.length === 0 ? (
              <EmptyDraft body="No experiences in this draft." />
            ) : (
              draft.experiences.map((experience, index) => (
                <DraftCard key={`experience-${index}`} onRemove={() => removeItem("experiences", index)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DraftInput label="Company" value={experience.companyName} onChange={(v) => updateExperience(index, { companyName: v })} />
                    <DraftInput label="Job title" value={experience.jobTitle} onChange={(v) => updateExperience(index, { jobTitle: v })} />
                    <DraftInput label="Employment type" value={experience.employmentType ?? ""} onChange={(v) => updateExperience(index, { employmentType: nullableString(v) })} />
                    <DraftInput label="Location" value={experience.location ?? ""} onChange={(v) => updateExperience(index, { location: nullableString(v) })} />
                    <DraftInput label="Start date" type="date" value={experience.startDate ?? ""} onChange={(v) => updateExperience(index, { startDate: nullableString(v) })} />
                    <DraftInput
                      label="End date"
                      type="date"
                      value={experience.endDate ?? ""}
                      onChange={(v) => updateExperience(index, { endDate: nullableString(v) })}
                      disabled={experience.currentlyWorking}
                    />
                    <label className="flex items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 sm:col-span-2">
                      <input
                        className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-300"
                        type="checkbox"
                        checked={experience.currentlyWorking}
                        onChange={(event) =>
                          updateExperience(index, {
                            currentlyWorking: event.target.checked,
                            endDate: event.target.checked ? null : experience.endDate,
                          })
                        }
                      />
                      <span>Currently working</span>
                    </label>
                    <DraftInput
                      label="Display order"
                      type="number"
                      value={String(experience.displayOrder ?? 0)}
                      onChange={(v) => updateExperience(index, { displayOrder: Number(v) || 0 })}
                    />
                    <label className="block sm:col-span-2">
                      <span className="label">Description</span>
                      <textarea
                        className="field min-h-20 resize-y"
                        rows={3}
                        value={experience.description ?? ""}
                        onChange={(event) => updateExperience(index, { description: nullableString(event.target.value) })}
                      />
                    </label>
                  </div>
                </DraftCard>
              ))
            )}
          </DraftSection>

          <DraftSection title="Certifications">
            {draft.certifications.length === 0 ? (
              <EmptyDraft body="No certifications in this draft." />
            ) : (
              draft.certifications.map((certification, index) => (
                <DraftCard key={`cert-${index}`} onRemove={() => removeItem("certifications", index)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DraftInput label="Name" value={certification.name} onChange={(v) => updateCertification(index, { name: v })} />
                    <DraftInput
                      label="Issuing organization"
                      value={certification.issuingOrganization ?? ""}
                      onChange={(v) => updateCertification(index, { issuingOrganization: nullableString(v) })}
                    />
                    <DraftInput label="Issue date" type="date" value={certification.issueDate ?? ""} onChange={(v) => updateCertification(index, { issueDate: nullableString(v) })} />
                    <DraftInput label="Expiry date" type="date" value={certification.expiryDate ?? ""} onChange={(v) => updateCertification(index, { expiryDate: nullableString(v) })} />
                    <DraftInput label="Credential ID" value={certification.credentialId ?? ""} onChange={(v) => updateCertification(index, { credentialId: nullableString(v) })} />
                    <DraftInput label="Credential URL" value={certification.credentialUrl ?? ""} onChange={(v) => updateCertification(index, { credentialUrl: nullableString(v) })} />
                    <DraftInput
                      label="Display order"
                      type="number"
                      value={String(certification.displayOrder ?? 0)}
                      onChange={(v) => updateCertification(index, { displayOrder: Number(v) || 0 })}
                    />
                  </div>
                </DraftCard>
              ))
            )}
          </DraftSection>

          <DraftSection title="Technical skills">
            {draft.technicalSkills.length === 0 ? (
              <EmptyDraft body="No skills in this draft." />
            ) : (
              draft.technicalSkills.map((skill, index) => (
                <DraftCard key={`skill-${index}`} onRemove={() => removeItem("technicalSkills", index)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DraftInput label="Skill" value={skill.skillName} onChange={(v) => updateSkill(index, { skillName: v })} />
                    <DraftInput label="Category" value={skill.category ?? ""} onChange={(v) => updateSkill(index, { category: nullableString(v) })} />
                    <DraftInput
                      label="Display order"
                      type="number"
                      value={String(skill.displayOrder ?? 0)}
                      onChange={(v) => updateSkill(index, { displayOrder: Number(v) || 0 })}
                    />
                  </div>
                </DraftCard>
              ))
            )}
          </DraftSection>

          <DraftSection title="Custom links">
            {draft.customLinks.length === 0 ? (
              <EmptyDraft body="No custom links in this draft." />
            ) : (
              draft.customLinks.map((link, index) => (
                <DraftCard key={`link-${index}`} onRemove={() => removeItem("customLinks", index)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DraftInput label="Label" value={link.label} onChange={(v) => updateLink(index, { label: v })} />
                    <DraftInput label="URL" value={link.url} onChange={(v) => updateLink(index, { url: v })} />
                    <DraftInput label="Icon" value={link.icon ?? ""} onChange={(v) => updateLink(index, { icon: nullableString(v) })} />
                    <DraftInput
                      label="Display order"
                      type="number"
                      value={String(link.displayOrder ?? 0)}
                      onChange={(v) => updateLink(index, { displayOrder: Number(v) || 0 })}
                    />
                  </div>
                </DraftCard>
              ))
            )}
          </DraftSection>

          <div className="sticky bottom-0 -mx-5 flex flex-col gap-3 border-t border-line bg-white px-5 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setReviewOpen(false)} disabled={isApplying}>
              Discard draft
            </Button>
            <Button type="button" icon={<Sparkles className="h-4 w-4" />} isLoading={isApplying} onClick={() => void onApply()}>
              Apply to portfolio
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function DraftSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {children}
    </section>
  );
}

function DraftCard({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <article className="rounded-lg border border-line bg-slate-50 p-4">
      <div className="mb-3 flex justify-end">
        <Button type="button" variant="ghost" className="h-8 px-2 text-red-600 hover:bg-red-50" onClick={onRemove}>
          Remove
        </Button>
      </div>
      {children}
    </article>
  );
}

function EmptyDraft({ body }: { body: string }) {
  return <p className="rounded-md border border-dashed border-line bg-slate-50 px-3 py-4 text-sm text-slate-500">{body}</p>;
}

function DraftInput({
  label,
  value,
  onChange,
  type = "text",
  className,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      <input
        className="field"
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
