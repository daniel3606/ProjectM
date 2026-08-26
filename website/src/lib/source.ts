const MAX_SOURCE_LENGTH = 64;
const SOURCE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/** Normalize a ?ref= value into a safe waitlist source string. */
export function sanitizeSource(raw: string | null | undefined): string {
  if (!raw) return "website";

  const cleaned = raw
    .trim()
    .toLowerCase()
    .slice(0, MAX_SOURCE_LENGTH)
    .replace(/[^a-z0-9_-]/g, "");

  if (!cleaned || !SOURCE_PATTERN.test(cleaned)) {
    return "website";
  }

  return cleaned;
}
