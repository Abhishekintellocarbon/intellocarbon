#!/usr/bin/env node
// Re-checks the rate-limit and CORS values fixed during the 2026-07-04
// security audit haven't silently drifted. Reads the source files as text
// (rather than importing the actual TS modules) so this has zero
// dependency on the backend's runtime env (DATABASE_URL, JWT secrets,
// etc.) — it only needs a checkout of the repo.
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const problems = [];

// --- Rate limiters: expect 5 requests / 15 minutes on all three limiters ---
const rateLimitersPath = path.join(repoRoot, "backend/src/middleware/rateLimiters.ts");
const rateLimitersSrc = fs.readFileSync(rateLimitersPath, "utf8");

const expectedLimiters = ["authRateLimiter", "passwordResetRateLimiter", "leadCaptureRateLimiter"];
for (const name of expectedLimiters) {
  const block = rateLimitersSrc.split(`export const ${name}`)[1]?.split("});")[0];
  if (!block) {
    problems.push(`${name} not found in rateLimiters.ts`);
    continue;
  }
  if (!/limit:\s*5\b/.test(block)) {
    problems.push(`${name} does not have limit: 5 — check for drift`);
  }
  if (!/windowMs:\s*15\s*\*\s*60\s*\*\s*1000/.test(block)) {
    problems.push(`${name} does not have windowMs: 15 * 60 * 1000 — check for drift`);
  }
}

// --- CORS: expect exactly the 3 known origins, no wildcard ---
const corsPath = path.join(repoRoot, "backend/src/config/cors.ts");
const corsSrc = fs.readFileSync(corsPath, "utf8");

const expectedOrigins = [
  "https://intellocarbon.com",
  "https://www.intellocarbon.com",
  "https://intellocarbon.vercel.app",
];
for (const origin of expectedOrigins) {
  if (!corsSrc.includes(origin)) {
    problems.push(`Expected CORS origin missing from cors.ts: ${origin}`);
  }
}
if (/origin:\s*["']\*["']|origin:\s*true\b/.test(corsSrc)) {
  problems.push("cors.ts appears to allow a wildcard/blanket origin — this should never happen");
}

if (problems.length > 0) {
  console.error("Configuration drift detected:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log("Rate limits and CORS allowlist match expected values — no drift.");
process.exit(0);
