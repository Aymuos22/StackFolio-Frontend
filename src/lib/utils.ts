import { AxiosError } from "axios";
import clsx, { type ClassValue } from "clsx";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

export function apiErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof AxiosError) {
    const data = error.response?.data as unknown;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object") {
      const maybeMessage = (data as { message?: unknown; error?: unknown }).message ?? (data as { error?: unknown }).error;
      if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;
    }
    if (error.message) return error.message;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function normalizeOptionalFields<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === "" ? undefined : value]),
  ) as T;
}

export function orderByDisplay<T extends { displayOrder?: number }>(items: T[] = []) {
  return [...items].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
