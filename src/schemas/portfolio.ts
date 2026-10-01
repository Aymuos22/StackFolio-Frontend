import { z } from "zod";
import { PORTFOLIO_THEME_IDS } from "../lib/portfolioThemes";

const optionalUrl = z.string().url("Enter a valid URL.").or(z.literal("")).optional();
const optionalEmail = z.string().email("Enter a valid email.").or(z.literal("")).optional();
const optionalText = z.string().optional();
const displayOrder = z.coerce.number().int().min(0, "Display order cannot be negative.").default(0);

export const portfolioBaseSchema = z.object({
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters.")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only."),
  fullName: z.string().min(2, "Full name is required."),
  phone: optionalText,
  publicEmail: optionalEmail,
  linkedinUrl: optionalUrl,
  githubUrl: optionalUrl,
  theme: z.enum(PORTFOLIO_THEME_IDS, { required_error: "Choose a public theme." }),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #2563eb."),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #111827."),
});

export const summarySchema = z.object({
  summary: z.string().min(20, "Write at least 20 characters."),
});

export const projectSchema = z.object({
  title: z.string().min(2, "Project title is required."),
  description: optionalText,
  techStack: optionalText,
  githubUrl: optionalUrl,
  liveUrl: optionalUrl,
  imageUrl: optionalUrl,
  displayOrder,
});

export const experienceSchema = z.object({
  companyName: z.string().min(2, "Company name is required."),
  jobTitle: z.string().min(2, "Job title is required."),
  employmentType: optionalText,
  location: optionalText,
  startDate: optionalText,
  endDate: optionalText,
  currentlyWorking: z.boolean().default(false),
  description: optionalText,
  displayOrder,
});

export const certificationSchema = z.object({
  name: z.string().min(2, "Certification name is required."),
  issuingOrganization: optionalText,
  issueDate: optionalText,
  expiryDate: optionalText,
  credentialId: optionalText,
  credentialUrl: optionalUrl,
  displayOrder,
});

export const technicalSkillSchema = z.object({
  skillName: z.string().min(1, "Skill is required."),
  category: optionalText,
  displayOrder,
});

export const customLinkSchema = z.object({
  label: z.string().min(2, "Label is required."),
  url: z.string().url("Enter a valid URL."),
  icon: optionalText,
  displayOrder,
});

export const suggestPortfolioSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Paste your resume or bio text.")
    .max(50000, "Text must be at most 50,000 characters."),
});

export type PortfolioBaseForm = z.infer<typeof portfolioBaseSchema>;
export type SummaryForm = z.infer<typeof summarySchema>;
export type ProjectForm = z.infer<typeof projectSchema>;
export type ExperienceForm = z.infer<typeof experienceSchema>;
export type CertificationForm = z.infer<typeof certificationSchema>;
export type TechnicalSkillForm = z.infer<typeof technicalSkillSchema>;
export type CustomLinkForm = z.infer<typeof customLinkSchema>;
export type SuggestPortfolioForm = z.infer<typeof suggestPortfolioSchema>;
