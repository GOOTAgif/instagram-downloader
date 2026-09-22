// Matches public Instagram post/Reel/TV/story/profile URLs.
// Deliberately conservative: rejects anything that isn't instagram.com
// or www.instagram.com, to reduce SSRF surface on the backend.
const INSTAGRAM_HOST_PATTERN = /^(www\.)?instagram\.com$/i;

const SUPPORTED_PATH_PATTERN =
  /^\/(?:p|reel|reels|tv|stories)\/[^/]+\/?$|^\/[a-zA-Z0-9._]+\/?$/;

export type UrlValidationResult =
  | { valid: true; normalizedUrl: string }
  | { valid: false; reason: string };

export function validateInstagramUrl(rawUrl: string): UrlValidationResult {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return { valid: false, reason: "Paste an Instagram link to continue." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: "That doesn't look like a valid URL." };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "Use a secure (https://) Instagram link." };
  }

  if (!INSTAGRAM_HOST_PATTERN.test(parsed.hostname)) {
    return {
      valid: false,
      reason: "Only instagram.com links are supported.",
    };
  }

  if (!SUPPORTED_PATH_PATTERN.test(parsed.pathname)) {
    return {
      valid: false,
      reason: "This link format isn't supported yet.",
    };
  }

  return { valid: true, normalizedUrl: `https://www.instagram.com${parsed.pathname}` };
}
