import React from "react";

export function getErrorMessage(error: unknown, fallback = "Erro desconhecido"): string {
  if (error == null) return fallback;
  if (typeof error === "string") return error;
  if (typeof error === "number" || typeof error === "boolean") return String(error);

  // Standard Error
  if (error instanceof Error && typeof error.message === "string") {
    return error.message || fallback;
  }

  // Supabase/Postgrest-ish shapes
  if (typeof error === "object") {
    const anyErr = error as any;
    if (typeof anyErr.message === "string" && anyErr.message) return anyErr.message;
    if (typeof anyErr.error_description === "string" && anyErr.error_description) return anyErr.error_description;
    if (typeof anyErr.details === "string" && anyErr.details) return anyErr.details;
    if (typeof anyErr.hint === "string" && anyErr.hint) return anyErr.hint;
    try {
      return JSON.stringify(anyErr);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export function toSafeReactNode(value: unknown): React.ReactNode {
  if (value == null) return null;
  if (React.isValidElement(value)) return value;
  if (typeof value === "string" || typeof value === "number") return value;

  // Avoid "Objects are not valid as a React child" (#310)
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
