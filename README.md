# IG Reels Downloader

A Next.js + Tailwind CSS front end for a public Instagram media downloader,
with an API route stub and provider abstraction for the backend.

## Design

Glassmorphism header and cards over a soft blue/mint/lavender ambient
background, centered downloader input, and a 2-column "Supported content"
grid — collapsing to 1 column on mobile. All original branding, copy, and
assets; no Instagram logos, colors, or code were reused.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

Visit `http://localhost:3000`.

## Project structure

```
app/
  layout.tsx          root layout, fonts, SEO metadata
  page.tsx             assembles the page
  globals.css          background glows, glass utility classes
  api/download/route.ts   POST endpoint, validation, rate limiting
components/
  Header.tsx           glass header + language switcher
  Downloader.tsx        input, request lifecycle, result/error states
  SupportedContent.tsx  content-type card grid
  Footer.tsx
lib/
  validateUrl.ts        shared Instagram URL validation
```

## Why the API doesn't actually download anything yet

`app/api/download/route.ts` validates the URL, rate-limits by IP, and then
calls `resolveMedia()` — a placeholder for a real provider integration. If
`MEDIA_PROVIDER_BASE_URL` and `MEDIA_PROVIDER_API_KEY` aren't set, it
returns a clear `501 not_configured` error rather than pretending to work.

**You need to supply one of:**
1. A licensed third-party media-resolution API, or
2. Your own backend service that you're authorized to operate, respecting
   Instagram's terms of service and not bypassing authentication, private-
   account restrictions, or DRM.

Wire that service's base URL and key into the environment variables, and
`resolveMedia()` will call it. The expected response shape from your
provider is a list of selectable formats, so video posts can offer
multiple qualities plus an audio-only option:

```json
{
  "type": "video",
  "thumbnail": "https://.../thumb.jpg",
  "filenameBase": "instagram-video",
  "formats": [
    { "id": "v1080", "kind": "video", "label": "1080p", "ext": "mp4", "downloadUrl": "https://.../1080.mp4" },
    { "id": "v720",  "kind": "video", "label": "720p",  "ext": "mp4", "downloadUrl": "https://.../720.mp4" },
    { "id": "v480",  "kind": "video", "label": "480p",  "ext": "mp4", "downloadUrl": "https://.../480.mp4" },
    { "id": "a1",    "kind": "audio", "label": "Audio only (MP3)", "ext": "mp3", "downloadUrl": "https://.../audio.mp3" }
  ]
}
```

The frontend (`components/Downloader.tsx`) renders one pill button per
format and defaults to the highest-listed video quality. A photo or
carousel post can return a single format in the array — the quality
picker only appears when there's more than one option.

## Security notes already in place

- URL validation restricts input to `instagram.com` hosts and known path
  shapes, reducing SSRF surface before any server-side fetch.
- The provider key lives only in server-side env vars — never sent to the
  client.
- A 10-second timeout aborts slow upstream calls.
- A basic in-memory rate limiter caps requests per IP per minute. Replace
  with a shared store (Redis, etc.) before scaling past one instance.

## Deployment (Vercel)

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import it in [Vercel](https://vercel.com/new).
3. Add the environment variables from `.env.example` in the project's
   Vercel settings (Production and Preview).
4. Deploy. The API route runs as a serverless function automatically.

## Extending

- Add per-content-type pages (`/video`, `/photo`, `/reels`, etc.) as
  separate routes that share `Downloader.tsx` with a `contentType` prop.
- Add i18n by wrapping strings in a translation function and adding
  locale JSON files; the language switcher in `Header.tsx` is already
  stubbed for this.
- Swap the in-memory rate limiter for Redis (e.g. `@upstash/ratelimit`) if
  deploying more than one instance.
