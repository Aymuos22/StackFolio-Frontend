export type PortfolioTheme = "comic" | "minimalist" | "dark-tech";

export const DEFAULT_PORTFOLIO_THEME: PortfolioTheme = "comic";

export type PortfolioBasePayload = {
  slug: string;
  fullName: string;
  phone?: string;
  publicEmail?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  theme: PortfolioTheme;
  primaryColor: string;
  secondaryColor: string;
};

export type Project = {
  id: number;
  title: string;
  description?: string;
  techStack?: string;
  githubUrl?: string;
  liveUrl?: string;
  imageUrl?: string;
  displayOrder: number;
};

export type Experience = {
  id: number;
  companyName: string;
  jobTitle: string;
  employmentType?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  currentlyWorking: boolean;
  description?: string;
  displayOrder: number;
};

export type Certification = {
  id: number;
  name: string;
  issuingOrganization?: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  displayOrder: number;
};

export type TechnicalSkill = {
  id: number;
  skillName: string;
  category?: string;
  displayOrder: number;
};

export type CustomLink = {
  id: number;
  label: string;
  url: string;
  icon?: string;
  displayOrder: number;
};

export type Portfolio = PortfolioBasePayload & {
  id: number;
  summary?: string;
  profileImageUrl?: string | null;
  projects: Project[];
  experiences: Experience[];
  certifications: Certification[];
  technicalSkills: TechnicalSkill[];
  customLinks: CustomLink[];
};

/** Create/update portfolio response shape from the API. */
export type PortfolioSaveResponse = {
  id: number;
  slug: string;
  theme: PortfolioTheme;
  message?: string;
};

export type ProfileImageUploadResponse = {
  imageUrl: string;
  message: string;
};

export type SummaryPayload = {
  summary: string;
};

export type ProjectPayload = Omit<Project, "id">;
export type ExperiencePayload = Omit<Experience, "id">;
export type CertificationPayload = Omit<Certification, "id">;
export type TechnicalSkillPayload = Omit<TechnicalSkill, "id">;
export type CustomLinkPayload = Omit<CustomLink, "id">;

export type PortfolioSuggestPayload = {
  text: string;
};

export type SuggestedProject = {
  title: string;
  description: string | null;
  techStack: string | null;
  githubUrl: string | null;
  liveUrl: string | null;
  displayOrder: number;
};

export type SuggestedExperience = {
  companyName: string;
  jobTitle: string;
  employmentType: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  currentlyWorking: boolean;
  description: string | null;
  displayOrder: number;
};

export type SuggestedCertification = {
  name: string;
  issuingOrganization: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  credentialId: string | null;
  credentialUrl: string | null;
  displayOrder: number;
};

export type SuggestedTechnicalSkill = {
  skillName: string;
  category: string | null;
  displayOrder: number;
};

export type SuggestedCustomLink = {
  label: string;
  url: string;
  icon: string | null;
  displayOrder: number;
};

export type PortfolioSuggestResponse = {
  fullName: string | null;
  phone: string | null;
  publicEmail: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  summary: string | null;
  projects: SuggestedProject[];
  experiences: SuggestedExperience[];
  certifications: SuggestedCertification[];
  technicalSkills: SuggestedTechnicalSkill[];
  customLinks: SuggestedCustomLink[];
};

export type ApiErrorResponse = {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  fieldErrors: Record<string, string> | null;
};
