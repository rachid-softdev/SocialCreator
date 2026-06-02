/**
 * Structured API error responses
 * Standard error format for all REST API routes
 */

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "FEATURE_NOT_AVAILABLE"
  | "LIMIT_REACHED";

export interface ApiErrorBody {
  error: string;
  code: ErrorCode;
  details?: unknown;
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
): NextResponse {
  const body: ApiErrorBody = { error: message, code };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

export const badRequest = (message: string) => errorResponse(400, "VALIDATION_ERROR", message);
export const unauthorized = () => errorResponse(401, "UNAUTHORIZED", "Unauthorized");
export const notFound = (resource = "Resource") =>
  errorResponse(404, "NOT_FOUND", `${resource} not found`);
export const validationError = (message: string, details?: unknown) =>
  errorResponse(400, "VALIDATION_ERROR", message, details);
export const rateLimited = () =>
  errorResponse(429, "RATE_LIMITED", "Too many requests. Please try again later.");
export const forbidden = (message: string) => errorResponse(403, "FORBIDDEN", message);
export const conflict = (message: string) => errorResponse(409, "CONFLICT", message);

export function fromZodError(error: ZodError): NextResponse {
  return validationError(
    error.errors[0]?.message || "Validation failed",
    error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
  );
}
