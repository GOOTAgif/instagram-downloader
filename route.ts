import { NextRequest, NextResponse } from "next/server";
import { validateInstagramUrl } from "@/lib/validateUrl";

export const runtime = "nodejs";

// --- Minimal in-memory rate limiter -----------------------------------
// Fine for a single instance / demo. Swap for a shared store (e.g. Redis,
// as noted in the project's stack) before running more than one instance,
// or the limit resets per-process and per-deploy.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > MAX_REQUESTS_PER_WINDOW;
}

// --- Provider abstraction ----------------------------------------------
// This is the seam where a real, authorized media-resolution provider
// plugs in. Nothing here fetches instagram.com directly: point it at
// a licensed API or an in-house service you're authorized to call, and
// keep the base URL / key in environment variables, never in the client.
export interface MediaFormat {
  id: string;
  kind: "video" | "audio";
  label: string; // e.g. "1080p", "720p", "Audio only (MP3)"
  ext: string; // e.g. "mp4", "mp3"
  sizeBytes?: number;
  downloadUrl: string;
}

interface ProviderResult {
  type: "video" | "photo" | "carousel";
  thumbnail: string;
  filenameBase: string;
  formats: MediaFormat[];
}

// Expected shape from your provider's /resolve endpoint, e.g.:
// {
//   "type": "video",
//   "thumbnail": "https://.../thumb.jpg",
//   "filenameBase": "instagram-video",
//   "formats": [
//     { "id": "v1080", "kind": "video", "label": "1080p", "ext": "mp4", "downloadUrl": "..." },
//     { "id": "v720",  "kind": "video", "label": "720p",  "ext": "mp4", "downloadUrl": "..." },
//     { "id": "v480",  "kind": "video", "label": "480p",  "ext": "mp4", "downloadUrl": "..." },
//     { "id": "a1",    "kind": "audio", "label": "Audio only (MP3)", "ext": "mp3", "downloadUrl": "..." }
//   ]
// }
// A photo/carousel post's provider response can return a single "original"
// format instead of multiple qualities — the UI adapts to however many
// formats come back.
async function resolveMedia(url: string): Promise<ProviderResult> {
  const providerBaseUrl = process.env.MEDIA_PROVIDER_BASE_URL;
  const providerApiKey = process.env.MEDIA_PROVIDER_API_KEY;

  if (!providerBaseUrl || !providerApiKey) {
    // No provider configured. Fail loudly instead of faking a result —
    // per the project brief, the UI must never claim success without
    // a real backend behind it.
    throw new ProviderNotConfiguredError();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${providerBaseUrl}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${providerApiKey}`,
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    if (response.status === 404) {
      throw new ContentUnavailableError();
    }
    if (response.status === 403) {
      throw new PrivateContentError();
    }
    if (response.status === 429) {
      throw new UpstreamRateLimitError();
    }
    if (!response.ok) {
      throw new UpstreamError();
    }

    const data = (await response.json()) as ProviderResult;
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

class ProviderNotConfiguredError extends Error {}
class ContentUnavailableError extends Error {}
class PrivateContentError extends Error {}
class UpstreamRateLimitError extends Error {}
class UpstreamError extends Error {}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      {
        success: false,
        error: "rate_limited",
        message: "Too many requests. Try again in a minute.",
      },
      { status: 429 }
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_request", message: "Malformed request body." },
      { status: 400 }
    );
  }

  const validation = validateInstagramUrl(body.url ?? "");
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: "invalid_url", message: validation.reason },
      { status: 400 }
    );
  }

  try {
    const result = await resolveMedia(validation.normalizedUrl);

    if (!result.formats?.length) {
      return NextResponse.json(
        {
          success: false,
          error: "content_unavailable",
          message: "No downloadable formats were returned for this link.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      type: result.type,
      thumbnail: result.thumbnail,
      filenameBase: result.filenameBase,
      formats: result.formats,
    });
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      return NextResponse.json(
        {
          success: false,
          error: "not_configured",
          message:
            "No media provider is configured on this server yet. Set MEDIA_PROVIDER_BASE_URL and MEDIA_PROVIDER_API_KEY.",
        },
        { status: 501 }
      );
    }
    if (err instanceof PrivateContentError) {
      return NextResponse.json(
        { success: false, error: "private_content", message: "This account or post is private." },
        { status: 403 }
      );
    }
    if (err instanceof ContentUnavailableError) {
      return NextResponse.json(
        { success: false, error: "content_unavailable", message: "This content is unavailable or was removed." },
        { status: 404 }
      );
    }
    if (err instanceof UpstreamRateLimitError) {
      return NextResponse.json(
        { success: false, error: "upstream_rate_limited", message: "The media provider is rate-limiting requests. Try again shortly." },
        { status: 429 }
      );
    }
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { success: false, error: "timeout", message: "The request took too long. Try again." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { success: false, error: "server_error", message: "Something went wrong on our end." },
      { status: 500 }
    );
  }
}
