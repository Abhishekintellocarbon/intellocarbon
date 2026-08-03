import { describe, expect, it } from "vitest";
import {
  CONSENT_MAX_AGE_MS,
  CONSENT_VERSION,
  parseStoredConsent,
  preferencesFor,
} from "../cookie-consent";
import { isPublicRoute } from "../public-routes";

const NOW = Date.UTC(2026, 7, 3);

const record = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    version: CONSENT_VERSION,
    decision: "custom",
    preferences: { essential: true, analytics: true },
    timestamp: NOW - 1000,
    ...overrides,
  });

describe("parseStoredConsent", () => {
  it("returns a valid, unexpired decision", () => {
    const parsed = parseStoredConsent(record(), NOW);
    expect(parsed?.decision).toBe("custom");
    expect(parsed?.preferences.analytics).toBe(true);
  });

  it("treats a missing or unparseable value as no decision", () => {
    expect(parseStoredConsent(null, NOW)).toBeNull();
    expect(parseStoredConsent("", NOW)).toBeNull();
    expect(parseStoredConsent("not json", NOW)).toBeNull();
    expect(parseStoredConsent("null", NOW)).toBeNull();
    expect(parseStoredConsent('"a string"', NOW)).toBeNull();
  });

  it("rejects a record written under a different schema version", () => {
    expect(parseStoredConsent(record({ version: CONSENT_VERSION + 1 }), NOW)).toBeNull();
    expect(parseStoredConsent(record({ version: undefined }), NOW)).toBeNull();
  });

  it("rejects unknown decisions and malformed preferences", () => {
    expect(parseStoredConsent(record({ decision: "maybe" }), NOW)).toBeNull();
    expect(parseStoredConsent(record({ preferences: null }), NOW)).toBeNull();
    expect(parseStoredConsent(record({ preferences: { essential: true } }), NOW)).toBeNull();
    expect(
      parseStoredConsent(record({ preferences: { essential: true, analytics: "yes" } }), NOW),
    ).toBeNull();
  });

  it("expires consent after six months so the banner re-asks", () => {
    const justInside = parseStoredConsent(record({ timestamp: NOW - CONSENT_MAX_AGE_MS + 1 }), NOW);
    expect(justInside).not.toBeNull();

    const justOutside = parseStoredConsent(record({ timestamp: NOW - CONSENT_MAX_AGE_MS - 1 }), NOW);
    expect(justOutside).toBeNull();
  });

  it("rejects a future timestamp rather than trusting it", () => {
    expect(parseStoredConsent(record({ timestamp: NOW + 60_000 }), NOW)).toBeNull();
    expect(parseStoredConsent(record({ timestamp: "yesterday" }), NOW)).toBeNull();
  });

  it("always reports essential cookies as on", () => {
    const parsed = parseStoredConsent(
      record({ decision: "rejected", preferences: { essential: false, analytics: false } }),
      NOW,
    );
    expect(parsed?.preferences.essential).toBe(true);
    expect(parsed?.preferences.analytics).toBe(false);
  });
});

describe("preferencesFor", () => {
  it("forces analytics on for accept-all and off for reject", () => {
    expect(preferencesFor("accepted", false).analytics).toBe(true);
    expect(preferencesFor("rejected", true).analytics).toBe(false);
  });

  it("honours the toggle for a custom choice", () => {
    expect(preferencesFor("custom", true).analytics).toBe(true);
    expect(preferencesFor("custom", false).analytics).toBe(false);
  });
});

describe("isPublicRoute", () => {
  it("matches marketing pages", () => {
    for (const path of ["/", "/about", "/faq", "/services", "/esg", "/privacy", "/terms", "/login"]) {
      expect(isPublicRoute(path), path).toBe(true);
    }
  });

  it("matches sub-paths of public sections", () => {
    expect(isPublicRoute("/products")).toBe(true);
    expect(isPublicRoute("/products/cbam-compliance")).toBe(true);
    expect(isPublicRoute("/insights/ccts-timeline")).toBe(true);
    expect(isPublicRoute("/intellocalc/border")).toBe(true);
  });

  it("excludes the authenticated app", () => {
    for (const path of [
      "/dashboard",
      "/facilities",
      "/facilities/abc/data-entry/new",
      "/billing",
      "/company/settings",
      "/onboarding/company",
      "/admin/verifiers",
      "/verifier/dashboard",
      "/internal-data-entry",
      "/pending-approval",
      "/esg/brsr",
      "/esg/issb",
      "/brsr",
    ]) {
      expect(isPublicRoute(path), path).toBe(false);
    }
  });

  it("does not let a prefix match a different route", () => {
    expect(isPublicRoute("/products-internal")).toBe(false);
    expect(isPublicRoute("/esg-admin")).toBe(false);
  });

  it("tolerates a trailing slash and handles no pathname", () => {
    expect(isPublicRoute("/about/")).toBe(true);
    expect(isPublicRoute("/")).toBe(true);
    expect(isPublicRoute(null)).toBe(false);
    expect(isPublicRoute(undefined)).toBe(false);
    expect(isPublicRoute("")).toBe(false);
  });
});
