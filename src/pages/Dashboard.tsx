import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import {
  BriefcaseBusiness,
  ExternalLink,
  FileBadge,
  Github,
  Link as LinkIcon,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm, type FieldErrors, type UseFormRegisterReturn } from "react-hook-form";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import type { ZodTypeAny } from "zod";
import {
  createCertification,
  createCustomLink,
  createExperience,
  createPortfolio,
  createProject,
  createTechnicalSkill,
  deleteCertification,
  deleteCustomLink,
  deleteExperience,
  deleteProject,
  deleteTechnicalSkill,
  getMyPortfolio,
  updateCertification,
  updateCustomLink,
  updateExperience,
  updatePortfolio,
  updateProject,
  updateSummary,
  updateTechnicalSkill,
} from "../api/portfolio";
import Avatar from "../components/Avatar";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import Modal from "../components/Modal";
import ProfileImageUploader from "../components/ProfileImageUploader";
import Spinner from "../components/Spinner";
import SuggestPortfolioPanel from "../components/SuggestPortfolioPanel";
import TextareaField from "../components/TextareaField";
import { useAuth } from "../context/AuthContext";
import { PORTFOLIO_THEMES, normalizePortfolioTheme } from "../lib/portfolioThemes";
import { apiErrorMessage, cn, normalizeOptionalFields, orderByDisplay } from "../lib/utils";
import {
  certificationSchema,
  customLinkSchema,
  experienceSchema,
  portfolioBaseSchema,
  projectSchema,
  summarySchema,
  technicalSkillSchema,
  type CertificationForm,
  type CustomLinkForm,
  type ExperienceForm,
  type PortfolioBaseForm,
  type ProjectForm,
  type SummaryForm,
  type TechnicalSkillForm,
} from "../schemas/portfolio";
import type {
  Certification,
  CustomLink,
  Experience,
  Portfolio,
  Project,
  TechnicalSkill,
} from "../types/portfolio";
import { DEFAULT_PORTFOLIO_THEME } from "../types/portfolio";

const portfolioDefaults: PortfolioBaseForm = {
  slug: "",
  fullName: "",
  phone: "",
  publicEmail: "",
  linkedinUrl: "",
  githubUrl: "",
  theme: DEFAULT_PORTFOLIO_THEME,
  primaryColor: "#2563eb",
  secondaryColor: "#111827",
};

type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "url" | "number" | "date" | "textarea" | "checkbox";
  placeholder?: string;
};

type SectionEditorProps<TItem extends { id: number; displayOrder: number }, TForm extends object> = {
  title: string;
  icon: ReactNode;
  items: TItem[];
  schema: ZodTypeAny;
  fields: FieldConfig[];
  defaultValues: TForm;
  emptyText: string;
  getTitle: (item: TItem) => string;
  getMeta?: (item: TItem) => string;
  getDetails?: (item: TItem) => string;
  createItem: (payload: TForm) => Promise<unknown>;
  updateItem: (id: number, payload: TForm) => Promise<unknown>;
  deleteItem: (id: number) => Promise<unknown>;
  onChanged: () => Promise<void>;
  disabled?: boolean;
};

function fieldError(errors: FieldErrors<Record<string, unknown>>, name: string) {
  const error = errors[name];
  return typeof error === "object" && error && "message" in error ? String(error.message ?? "") : "";
}

function GenericInput({
  field,
  registration,
  error,
}: {
  field: FieldConfig;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  if (field.type === "textarea") {
    return (
      <label className="block md:col-span-2">
        <span className="label">{field.label}</span>
        <textarea className="field min-h-28 resize-y" placeholder={field.placeholder} {...registration} />
        {error ? <p className="error">{error}</p> : null}
      </label>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        <input className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-300" type="checkbox" {...registration} />
        <span>{field.label}</span>
      </label>
    );
  }

  return (
    <label className="block">
      <span className="label">{field.label}</span>
      <input className="field" type={field.type ?? "text"} placeholder={field.placeholder} {...registration} />
      {error ? <p className="error">{error}</p> : null}
    </label>
  );
}

function SectionEditor<TItem extends { id: number; displayOrder: number }, TForm extends object>({
  title,
  icon,
  items,
  schema,
  fields,
  defaultValues,
  emptyText,
  getTitle,
  getMeta,
  getDetails,
  createItem,
  updateItem,
  deleteItem,
  onChanged,
  disabled,
}: SectionEditorProps<TItem, TForm>) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TItem | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as Record<string, unknown>,
  });

  function startCreate() {
    setEditing(null);
    reset(defaultValues);
    setOpen(true);
  }

  function startEdit(item: TItem) {
    setEditing(item);
    reset({ ...defaultValues, ...item });
    setOpen(true);
  }

  async function onSubmit(values: Record<string, unknown>) {
    setIsSubmitting(true);
    try {
      const payload = normalizeOptionalFields(values) as TForm;
      if (editing) {
        await updateItem(editing.id, payload);
        toast.success(`${title} updated.`);
      } else {
        await createItem(payload);
        toast.success(`${title} added.`);
      }
      setOpen(false);
      await onChanged();
    } catch (error) {
      toast.error(apiErrorMessage(error, `Unable to save ${title.toLowerCase()}.`));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function remove(item: TItem) {
    const ok = window.confirm(`Delete "${getTitle(item)}"?`);
    if (!ok) return;

    setBusyId(item.id);
    try {
      await deleteItem(item.id);
      toast.success(`${title} deleted.`);
      await onChanged();
    } catch (error) {
      toast.error(apiErrorMessage(error, `Unable to delete ${title.toLowerCase()}.`));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">{icon}</div>
          <div>
            <h2 className="font-semibold text-slate-950">{title}</h2>
            <p className="text-sm text-slate-500">{items.length} saved</p>
          </div>
        </div>
        <Button type="button" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={startCreate} disabled={disabled}>
          Add
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <EmptyState title={`No ${title.toLowerCase()} yet`} body={emptyText} />
        ) : (
          orderByDisplay(items).map((item) => (
            <article key={item.id} className="rounded-lg border border-line bg-white p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-950">{getTitle(item)}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      #{item.displayOrder ?? 0}
                    </span>
                  </div>
                  {getMeta ? <p className="mt-1 text-sm text-slate-600">{getMeta(item)}</p> : null}
                  {getDetails ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{getDetails(item)}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="ghost" className="h-9 w-9 px-0" onClick={() => startEdit(item)} aria-label="Edit">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-9 px-0 text-red-600 hover:bg-red-50"
                    onClick={() => remove(item)}
                    isLoading={busyId === item.id}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <Modal open={open} title={`${editing ? "Edit" : "Add"} ${title}`} onClose={() => setOpen(false)}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          {fields.map((field) => (
            <GenericInput
              key={field.name}
              field={field}
              registration={register(field.name)}
              error={fieldError(errors, field.name)}
            />
          ))}
          <div className="flex justify-end gap-3 md:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" icon={<Save className="h-4 w-4" />} isLoading={isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

function PortfolioDetailsForm({
  portfolio,
  onSaved,
}: {
  portfolio: Portfolio | null;
  onSaved: () => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PortfolioBaseForm>({
    resolver: zodResolver(portfolioBaseSchema),
    defaultValues: portfolioDefaults,
  });

  const selectedTheme = watch("theme");

  useEffect(() => {
    reset(
      portfolio
        ? { ...portfolioDefaults, ...portfolio, theme: normalizePortfolioTheme(portfolio.theme) }
        : portfolioDefaults,
    );
  }, [portfolio, reset]);

  async function onSubmit(values: PortfolioBaseForm) {
    setIsSubmitting(true);
    try {
      const payload = normalizeOptionalFields(values);
      if (portfolio) {
        await updatePortfolio(payload);
        toast.success("Portfolio details updated.");
      } else {
        await createPortfolio(payload);
        toast.success("Portfolio created.");
      }
      await onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to save portfolio details."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-950">Portfolio details</h2>
          <p className="mt-1 text-sm text-slate-500">These fields drive the public URL, identity, contacts, and colors.</p>
        </div>
      </div>
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Slug" registration={register("slug")} error={errors.slug} placeholder="john-doe" />
        <Field label="Full name" registration={register("fullName")} error={errors.fullName} placeholder="John Doe" />
        <Field label="Phone" registration={register("phone")} error={errors.phone} placeholder="+1 555 123 4567" />
        <Field label="Public email" type="email" registration={register("publicEmail")} error={errors.publicEmail} />
        <Field label="LinkedIn URL" type="url" registration={register("linkedinUrl")} error={errors.linkedinUrl} />
        <Field label="GitHub URL" type="url" registration={register("githubUrl")} error={errors.githubUrl} />
        <div className="lg:col-span-2">
          <span className="label">Public theme</span>
          <p className="mt-1 text-sm text-slate-500">Choose how your public portfolio page looks. Saved via portfolio details.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {PORTFOLIO_THEMES.map((themeOption) => {
              const selected = selectedTheme === themeOption.id;
              return (
                <label
                  key={themeOption.id}
                  className={cn(
                    "cursor-pointer rounded-lg border p-4 transition",
                    selected
                      ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                      : "border-line bg-white text-slate-800 hover:border-slate-400",
                  )}
                >
                  <input type="radio" value={themeOption.id} className="sr-only" {...register("theme")} />
                  <span className="block text-sm font-semibold">{themeOption.label}</span>
                  <span className={cn("mt-1 block text-xs leading-5", selected ? "text-slate-300" : "text-slate-500")}>
                    {themeOption.description}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.theme?.message ? <p className="error">{errors.theme.message}</p> : null}
        </div>
        <Field label="Primary" type="color" registration={register("primaryColor")} error={errors.primaryColor} />
        <Field label="Secondary" type="color" registration={register("secondaryColor")} error={errors.secondaryColor} />
        <div className="flex flex-col gap-3 sm:flex-row lg:col-span-2">
          <Button type="submit" icon={<Save className="h-4 w-4" />} isLoading={isSubmitting}>
            {portfolio ? "Update details" : "Create portfolio"}
          </Button>
          {portfolio?.slug ? (
            <Link
              to={`/p/${portfolio.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View public portfolio
            </Link>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function SummaryEditor({ portfolio, onSaved }: { portfolio: Portfolio | null; onSaved: () => Promise<void> }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SummaryForm>({
    resolver: zodResolver(summarySchema),
    defaultValues: { summary: "" },
  });

  useEffect(() => {
    reset({ summary: portfolio?.summary ?? "" });
  }, [portfolio?.summary, reset]);

  async function onSubmit(values: SummaryForm) {
    if (!portfolio) return;
    setIsSubmitting(true);
    try {
      await updateSummary(values);
      toast.success("Summary saved.");
      await onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to save summary."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={cn("panel p-5", !portfolio && "opacity-60")}>
      <h2 className="font-semibold text-slate-950">Summary</h2>
      <p className="mt-1 text-sm text-slate-500">A concise introduction for the top of your public page.</p>
      <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <TextareaField
          label="Professional summary"
          registration={register("summary")}
          error={errors.summary}
          rows={5}
          placeholder="Full-stack developer focused on..."
        />
        <Button type="submit" icon={<Save className="h-4 w-4" />} isLoading={isSubmitting} disabled={!portfolio}>
          Save summary
        </Button>
      </form>
    </section>
  );
}

export default function Dashboard() {
  const { signout } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasPortfolio = Boolean(portfolio);

  const stats = useMemo(
    () => [
      { label: "Projects", value: portfolio?.projects?.length ?? 0 },
      { label: "Experience", value: portfolio?.experiences?.length ?? 0 },
      { label: "Skills", value: portfolio?.technicalSkills?.length ?? 0 },
      { label: "Links", value: portfolio?.customLinks?.length ?? 0 },
    ],
    [portfolio],
  );

  async function refreshPortfolio(showToast = false) {
    setIsRefreshing(true);
    try {
      const data = await getMyPortfolio();
      setPortfolio(data);
      if (showToast) toast.success("Portfolio refreshed.");
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        setPortfolio(null);
      } else {
        toast.error(apiErrorMessage(error, "Unable to load portfolio."));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshPortfolio();
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Spinner label="Loading dashboard" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <Link to="/" className="text-xl font-bold tracking-tight text-slate-950">
              Stackfolio
            </Link>
            <p className="mt-1 text-sm text-slate-500">
              {hasPortfolio ? `Editing ${portfolio?.fullName}` : "Create your public portfolio to unlock section editing."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              icon={<RefreshCw className="h-4 w-4" />}
              isLoading={isRefreshing}
              onClick={() => void refreshPortfolio(true)}
            >
              Refresh
            </Button>
            <Button type="button" variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={signout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="space-y-4">
          <section className="panel p-5">
            <div className="flex items-center gap-3">
              <Avatar
                name={portfolio?.fullName ?? "SF"}
                imageUrl={portfolio?.profileImageUrl}
                backgroundColor={portfolio?.primaryColor ?? "#2563eb"}
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-950">{portfolio?.fullName ?? "Draft portfolio"}</p>
                <p className="truncate text-sm text-slate-500">{portfolio?.slug ? `/p/${portfolio.slug}` : "No public slug yet"}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-md border border-line bg-slate-50 p-3">
                  <p className="text-xl font-bold text-slate-950">{stat.value}</p>
                  <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold text-slate-950">Publish status</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {portfolio?.slug
                ? "Your public page is live through the slug saved in portfolio details."
                : "Save portfolio details first, then section editing and public preview become useful."}
            </p>
            {portfolio?.slug ? (
              <Link
                to={`/p/${portfolio.slug}`}
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                View public portfolio
              </Link>
            ) : null}
          </section>
        </aside>

        <div className="space-y-6">
          {!hasPortfolio ? (
            <EmptyState
              title="Create your portfolio"
              body="The API returned no portfolio for this user. Fill in the details below to create the base record, or generate a draft with AI."
            />
          ) : null}

          <SuggestPortfolioPanel portfolio={portfolio} onApplied={() => refreshPortfolio()} />

          <PortfolioDetailsForm portfolio={portfolio} onSaved={() => refreshPortfolio()} />

          <ProfileImageUploader
            imageUrl={portfolio?.profileImageUrl}
            fullName={portfolio?.fullName}
            primaryColor={portfolio?.primaryColor}
            disabled={!portfolio}
            onImageChange={(imageUrl) => {
              setPortfolio((current) => (current ? { ...current, profileImageUrl: imageUrl } : current));
            }}
          />

          <SummaryEditor portfolio={portfolio} onSaved={() => refreshPortfolio()} />

          <SectionEditor<Project, ProjectForm>
            title="Projects"
            icon={<Github className="h-5 w-5" />}
            items={portfolio?.projects ?? []}
            schema={projectSchema}
            defaultValues={{
              title: "",
              description: "",
              techStack: "",
              githubUrl: "",
              liveUrl: "",
              imageUrl: "",
              displayOrder: 0,
            }}
            fields={[
              { name: "title", label: "Title" },
              { name: "displayOrder", label: "Display order", type: "number" },
              { name: "techStack", label: "Tech stack" },
              { name: "githubUrl", label: "GitHub URL", type: "url" },
              { name: "liveUrl", label: "Live URL", type: "url" },
              { name: "imageUrl", label: "Image URL", type: "url" },
              { name: "description", label: "Description", type: "textarea" },
            ]}
            emptyText="Add shipped work, case studies, or experiments with links to code and live demos."
            getTitle={(item) => item.title}
            getMeta={(item) => item.techStack ?? ""}
            getDetails={(item) => item.description ?? ""}
            createItem={createProject}
            updateItem={updateProject}
            deleteItem={deleteProject}
            onChanged={() => refreshPortfolio()}
            disabled={!portfolio}
          />

          <SectionEditor<Experience, ExperienceForm>
            title="Experiences"
            icon={<BriefcaseBusiness className="h-5 w-5" />}
            items={portfolio?.experiences ?? []}
            schema={experienceSchema}
            defaultValues={{
              companyName: "",
              jobTitle: "",
              employmentType: "",
              location: "",
              startDate: "",
              endDate: "",
              currentlyWorking: false,
              description: "",
              displayOrder: 0,
            }}
            fields={[
              { name: "companyName", label: "Company" },
              { name: "jobTitle", label: "Job title" },
              { name: "employmentType", label: "Employment type" },
              { name: "location", label: "Location" },
              { name: "startDate", label: "Start date", type: "date" },
              { name: "endDate", label: "End date", type: "date" },
              { name: "currentlyWorking", label: "Currently working", type: "checkbox" },
              { name: "displayOrder", label: "Display order", type: "number" },
              { name: "description", label: "Description", type: "textarea" },
            ]}
            emptyText="Add roles, internships, freelance work, or relevant client engagements."
            getTitle={(item) => item.jobTitle}
            getMeta={(item) =>
              [item.companyName, item.location, item.currentlyWorking ? "Present" : item.endDate].filter(Boolean).join(" - ")
            }
            getDetails={(item) => item.description ?? ""}
            createItem={createExperience}
            updateItem={updateExperience}
            deleteItem={deleteExperience}
            onChanged={() => refreshPortfolio()}
            disabled={!portfolio}
          />

          <SectionEditor<Certification, CertificationForm>
            title="Certifications"
            icon={<FileBadge className="h-5 w-5" />}
            items={portfolio?.certifications ?? []}
            schema={certificationSchema}
            defaultValues={{
              name: "",
              issuingOrganization: "",
              issueDate: "",
              expiryDate: "",
              credentialId: "",
              credentialUrl: "",
              displayOrder: 0,
            }}
            fields={[
              { name: "name", label: "Name" },
              { name: "issuingOrganization", label: "Issuing organization" },
              { name: "issueDate", label: "Issue date", type: "date" },
              { name: "expiryDate", label: "Expiry date", type: "date" },
              { name: "credentialId", label: "Credential ID" },
              { name: "credentialUrl", label: "Credential URL", type: "url" },
              { name: "displayOrder", label: "Display order", type: "number" },
            ]}
            emptyText="Add credentials that strengthen the story behind your skills."
            getTitle={(item) => item.name}
            getMeta={(item) => [item.issuingOrganization, item.issueDate].filter(Boolean).join(" - ")}
            createItem={createCertification}
            updateItem={updateCertification}
            deleteItem={deleteCertification}
            onChanged={() => refreshPortfolio()}
            disabled={!portfolio}
          />

          <SectionEditor<TechnicalSkill, TechnicalSkillForm>
            title="Technical skills"
            icon={<Sparkles className="h-5 w-5" />}
            items={portfolio?.technicalSkills ?? []}
            schema={technicalSkillSchema}
            defaultValues={{ skillName: "", category: "", displayOrder: 0 }}
            fields={[
              { name: "skillName", label: "Skill" },
              { name: "category", label: "Category" },
              { name: "displayOrder", label: "Display order", type: "number" },
            ]}
            emptyText="Group languages, frameworks, tools, platforms, and practices by category."
            getTitle={(item) => item.skillName}
            getMeta={(item) => item.category ?? ""}
            createItem={createTechnicalSkill}
            updateItem={updateTechnicalSkill}
            deleteItem={deleteTechnicalSkill}
            onChanged={() => refreshPortfolio()}
            disabled={!portfolio}
          />

          <SectionEditor<CustomLink, CustomLinkForm>
            title="Custom links"
            icon={<LinkIcon className="h-5 w-5" />}
            items={portfolio?.customLinks ?? []}
            schema={customLinkSchema}
            defaultValues={{ label: "", url: "", icon: "", displayOrder: 0 }}
            fields={[
              { name: "label", label: "Label" },
              { name: "url", label: "URL", type: "url" },
              { name: "icon", label: "Icon" },
              { name: "displayOrder", label: "Display order", type: "number" },
            ]}
            emptyText="Add profiles, writing, resumes, calendars, or other destinations."
            getTitle={(item) => item.label}
            getMeta={(item) => item.url}
            createItem={createCustomLink}
            updateItem={updateCustomLink}
            deleteItem={deleteCustomLink}
            onChanged={() => refreshPortfolio()}
            disabled={!portfolio}
          />
        </div>
      </div>
    </main>
  );
}
