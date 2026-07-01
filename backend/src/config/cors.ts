import { env } from "./env";

/**
 * Exact-match production/known origins. `env.CLIENT_URL` is included so local
 * dev (http://localhost:3000) and any environment-specific override keep
 * working — but production domains are hardcoded here rather than relying on
 * CLIENT_URL alone, since a single env var can't express "primary domain +
 * apex/www + Vercel previews" at once, and getting it wrong silently breaks
 * auth (the browser blocks the response, not the server).
 */
const STATIC_ALLOWED_ORIGINS = new Set(
  [
    "https://intellocarbon.com",
    "https://www.intellocarbon.com",
    "https://intellocarbon.vercel.app",
    env.CLIENT_URL,
  ].filter(Boolean),
);

/**
 * Vercel preview deployment URLs for this project. Vercel's actual preview
 * URL format is `<project>-<hash-or-branch>-<team>.vercel.app`; a
 * subdomain-style `*.intellocarbon.vercel.app` is matched too in case a
 * custom preview domain alias is ever configured.
 */
const VERCEL_PREVIEW_PATTERNS = [
  /^https:\/\/intellocarbon(-[a-z0-9-]+)?\.vercel\.app$/,
  /^https:\/\/[a-z0-9-]+\.intellocarbon\.vercel\.app$/,
];

export const isOriginAllowed = (origin: string): boolean => {
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  return VERCEL_PREVIEW_PATTERNS.some((pattern) => pattern.test(origin));
};
