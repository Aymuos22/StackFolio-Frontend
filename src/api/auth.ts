import { api } from "./client";
import type {
  AuthResponse,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  SigninPayload,
  SignupPayload,
} from "../types/auth";

export async function signup(payload: SignupPayload) {
  const { data } = await api.post<AuthResponse>("/api/auth/signup", payload);
  return data;
}

export async function signin(payload: SigninPayload) {
  const { data } = await api.post<AuthResponse>("/api/auth/signin", payload);
  return data;
}

export async function forgotPassword(payload: ForgotPasswordPayload) {
  const { data } = await api.post("/api/auth/forgot-password", payload);
  return data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const { data } = await api.post("/api/auth/reset-password", payload);
  return data;
}
