#!/usr/bin/env node
// Fails (exit 1) if `npm audit --json` reports any HIGH/CRITICAL vulnerability
// that isn't listed in the given allowlist file. Known, deliberately-deferred
// findings (e.g. the Next.js 14 pin) are annotated as a GitHub Actions
// warning instead of failing the build — but anything NEW still fails.
//
// Usage: node scripts/check-audit.js <audit.json> [allowlist.json]
// allowlist.json shape: { "acceptedAdvisories": ["https://github.com/advisories/GHSA-..."] }
// If allowlist.json is omitted or doesn't exist, every high/critical finding fails.
const fs = require("fs");

const [, , auditPath, allowlistPath] = process.argv;

if (!auditPath) {
  console.error("Usage: node scripts/check-audit.js <audit.json> [allowlist.json]");
  process.exit(2);
}

const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
const allowlist =
  allowlistPath && fs.existsSync(allowlistPath)
    ? JSON.parse(fs.readFileSync(allowlistPath, "utf8"))
    : { acceptedAdvisories: [] };
const accepted = new Set(allowlist.acceptedAdvisories ?? []);

const vulnerabilities = audit.vulnerabilities ?? {};

// npm audit's `via` array is either advisory objects (this package has its
// own CVE) or plain strings naming another vulnerable package it depends on
// (e.g. eslint-config-next -> "@next/eslint-plugin-next" -> "glob", where
// only "glob" carries an actual advisory URL). Walk that chain so a package
// with no advisory of its own still resolves to the real GHSA IDs it's
// exposed to, instead of being treated as an unrelated "new" finding.
function resolveAdvisoryIds(pkgName, seen = new Set()) {
  if (seen.has(pkgName)) return new Set();
  seen.add(pkgName);
  const vuln = vulnerabilities[pkgName];
  if (!vuln) return new Set();
  const ids = new Set();
  for (const via of vuln.via ?? []) {
    if (typeof via === "object" && via.url) {
      ids.add(via.url);
    } else if (typeof via === "string") {
      for (const id of resolveAdvisoryIds(via, seen)) ids.add(id);
    }
  }
  return ids;
}

const newFindings = [];

for (const [pkgName, vuln] of Object.entries(vulnerabilities)) {
  if (vuln.severity !== "high" && vuln.severity !== "critical") continue;

  const advisoryIds = [...resolveAdvisoryIds(pkgName)];
  const isFullyAccepted = advisoryIds.length > 0 && advisoryIds.every((id) => accepted.has(id));

  if (isFullyAccepted) {
    console.log(
      `::warning::Known/accepted ${vuln.severity} vulnerability in "${pkgName}" (deferred — see ${allowlistPath}): ${advisoryIds.join(", ")}`,
    );
  } else {
    newFindings.push({ pkgName, severity: vuln.severity, advisoryIds });
  }
}

if (newFindings.length > 0) {
  console.error(`Found ${newFindings.length} new high/critical vulnerabilit${newFindings.length === 1 ? "y" : "ies"} not in the accepted allowlist:`);
  for (const f of newFindings) {
    console.error(`  - ${f.pkgName} (${f.severity}): ${f.advisoryIds.join(", ") || "no advisory URL"}`);
  }
  process.exit(1);
}

console.log("No new high/critical vulnerabilities beyond the accepted allowlist.");
process.exit(0);
