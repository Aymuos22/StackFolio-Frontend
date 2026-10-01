import { api } from "./client";
import type {
  CertificationPayload,
  CustomLinkPayload,
  ExperiencePayload,
  Portfolio,
  PortfolioBasePayload,
  PortfolioSuggestPayload,
  PortfolioSuggestResponse,
  ProfileImageUploadResponse,
  ProjectPayload,
  SummaryPayload,
  TechnicalSkillPayload,
} from "../types/portfolio";

export async function getMyPortfolio() {
  const { data } = await api.get<Portfolio>("/api/me/portfolio");
  return data;
}

export async function createPortfolio(payload: PortfolioBasePayload) {
  const { data } = await api.post<Portfolio>("/api/portfolios", payload);
  return data;
}

export async function updatePortfolio(payload: PortfolioBasePayload) {
  const { data } = await api.put<Portfolio>("/api/portfolios", payload);
  return data;
}

export async function getPublicPortfolio(slug: string) {
  const { data } = await api.get<Portfolio>(`/api/portfolios/${encodeURIComponent(slug)}`);
  return data;
}

export async function updateSummary(payload: SummaryPayload) {
  const { data } = await api.put<Portfolio>("/api/me/portfolio/summary", payload);
  return data;
}

export async function uploadProfileImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<ProfileImageUploadResponse>("/api/me/portfolio/image", formData);
  return data;
}

export async function deleteProfileImage() {
  await api.delete("/api/me/portfolio/image");
}

export async function createProject(payload: ProjectPayload) {
  const { data } = await api.post("/api/me/portfolio/projects", payload);
  return data;
}

export async function updateProject(projectId: number, payload: ProjectPayload) {
  const { data } = await api.put(`/api/me/portfolio/projects/${projectId}`, payload);
  return data;
}

export async function deleteProject(projectId: number) {
  await api.delete(`/api/me/portfolio/projects/${projectId}`);
}

export async function createExperience(payload: ExperiencePayload) {
  const { data } = await api.post("/api/me/portfolio/experiences", payload);
  return data;
}

export async function updateExperience(experienceId: number, payload: ExperiencePayload) {
  const { data } = await api.put(`/api/me/portfolio/experiences/${experienceId}`, payload);
  return data;
}

export async function deleteExperience(experienceId: number) {
  await api.delete(`/api/me/portfolio/experiences/${experienceId}`);
}

export async function createCertification(payload: CertificationPayload) {
  const { data } = await api.post("/api/me/portfolio/certifications", payload);
  return data;
}

export async function updateCertification(certificationId: number, payload: CertificationPayload) {
  const { data } = await api.put(`/api/me/portfolio/certifications/${certificationId}`, payload);
  return data;
}

export async function deleteCertification(certificationId: number) {
  await api.delete(`/api/me/portfolio/certifications/${certificationId}`);
}

export async function createTechnicalSkill(payload: TechnicalSkillPayload) {
  const { data } = await api.post("/api/me/portfolio/technical-skills", payload);
  return data;
}

export async function updateTechnicalSkill(technicalSkillId: number, payload: TechnicalSkillPayload) {
  const { data } = await api.put(`/api/me/portfolio/technical-skills/${technicalSkillId}`, payload);
  return data;
}

export async function deleteTechnicalSkill(technicalSkillId: number) {
  await api.delete(`/api/me/portfolio/technical-skills/${technicalSkillId}`);
}

export async function createCustomLink(payload: CustomLinkPayload) {
  const { data } = await api.post("/api/me/portfolio/custom-links", payload);
  return data;
}

export async function updateCustomLink(customLinkId: number, payload: CustomLinkPayload) {
  const { data } = await api.put(`/api/me/portfolio/custom-links/${customLinkId}`, payload);
  return data;
}

export async function deleteCustomLink(customLinkId: number) {
  await api.delete(`/api/me/portfolio/custom-links/${customLinkId}`);
}

export async function suggestPortfolio(payload: PortfolioSuggestPayload) {
  const { data } = await api.post<PortfolioSuggestResponse>("/api/me/portfolio/suggest", payload, {
    timeout: 120_000,
  });
  return data;
}
