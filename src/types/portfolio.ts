export type PortfolioBasePayload = {
  slug: string;
  fullName: string;
  phone?: string;
  publicEmail?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  theme: string;
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
