// Shared validation utilities for edge functions

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate URL format and constraints
 */
export function validateUrl(url: unknown, fieldName = "URL"): ValidationResult {
  if (!url || typeof url !== "string") {
    return { valid: false, error: `${fieldName} is required` };
  }
  if (url.length > 2048) {
    return { valid: false, error: `${fieldName} exceeds maximum length of 2048 characters` };
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: `${fieldName} must use HTTP or HTTPS protocol` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: `Invalid ${fieldName} format` };
  }
}

/**
 * Validate string with length constraints
 */
export function validateString(
  value: unknown,
  maxLength: number,
  fieldName: string,
  required = false
): ValidationResult {
  if (value === undefined || value === null || value === "") {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true };
  }
  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength} characters` };
  }
  return { valid: true };
}

/**
 * Validate array with length constraints
 */
export function validateArray(
  value: unknown,
  maxLength: number,
  fieldName: string,
  required = false
): ValidationResult {
  if (value === undefined || value === null) {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true };
  }
  if (!Array.isArray(value)) {
    return { valid: false, error: `${fieldName} must be an array` };
  }
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength} items` };
  }
  return { valid: true };
}

/**
 * Validate integer with range constraints
 */
export function validateInteger(
  value: unknown,
  min: number,
  max: number,
  fieldName: string,
  required = false
): ValidationResult {
  if (value === undefined || value === null) {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true };
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { valid: false, error: `${fieldName} must be an integer` };
  }
  if (value < min || value > max) {
    return { valid: false, error: `${fieldName} must be between ${min} and ${max}` };
  }
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: unknown): ValidationResult {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email is required" };
  }
  if (email.length > 255) {
    return { valid: false, error: "Email exceeds maximum length of 255 characters" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Invalid email format" };
  }
  return { valid: true };
}

/**
 * Validate password strength
 * Requirements: min 8 chars, at least one uppercase, one lowercase, one number
 */
export function validatePassword(password: unknown): ValidationResult {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required" };
  }
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (password.length > 128) {
    return { valid: false, error: "Password exceeds maximum length of 128 characters" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  return { valid: true };
}

/**
 * Validate domain format (for SEO/scraping purposes)
 */
export function validateDomain(domain: unknown): ValidationResult {
  if (!domain || typeof domain !== "string") {
    return { valid: false, error: "Domain is required" };
  }
  if (domain.length > 253) {
    return { valid: false, error: "Domain exceeds maximum length of 253 characters" };
  }
  // Remove protocol and path for validation
  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  // Basic domain format check
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
  if (!domainRegex.test(cleanDomain)) {
    return { valid: false, error: "Invalid domain format" };
  }
  return { valid: true };
}

/**
 * Create error response helper
 */
export function createValidationErrorResponse(
  error: string,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ success: false, error }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
