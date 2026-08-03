/**
 * GDPR cookie-consent state.
 *
 * Consent is stored first-party in localStorage under a single key — never in
 * a third-party cookie, and never sent to the server. Auth/session cookies are
 * strictly necessary and are deliberately outside this module's remit: nothing
 * here reads, writes, or clears them.
 */

export const CONSENT_STORAGE_KEY = "intellocarbon.cookie-consent";

/**
 * Bumping this invalidates every stored decision and re-prompts everyone.
 * Bump it whenever a new non-essential category is added, because consent
 * given for the old set of categories is not consent for the new one.
 */
export const CONSENT_VERSION = 2;

/** Six months, after which we re-ask rather than assume the decision stands. */
export const CONSENT_MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000;

/**
 * Fired on `window` whenever consent is written, so components mounted in the
 * same tab (the Plausible loader, the banner) react immediately. The native
 * `storage` event only fires in *other* tabs, so it cannot do this job alone.
 */
export const CONSENT_CHANGE_EVENT = "intellocarbon:cookie-consent-change";

/**
 * Fired on `window` to ask the banner to open its preferences dialog — the
 * "Cookie settings" footer link. Withdrawing or narrowing consent has to be as
 * easy as giving it, so this stays reachable after a decision is stored.
 */
export const CONSENT_OPEN_EVENT = "intellocarbon:cookie-consent-open";

export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

export type ConsentDecision = "accepted" | "rejected" | "custom";

export interface ConsentPreferences {
  /** Essential/functional cookies. Always true — kept explicit for the record. */
  essential: true;
  /** Plausible Analytics. False unless the visitor actively opted in. */
  analytics: boolean;
  /** Sentry monitoring (errors + performance tracing). Opt-in, like analytics. */
  performance: boolean;
}

export interface StoredConsent {
  version: number;
  decision: ConsentDecision;
  preferences: ConsentPreferences;
  /** Epoch ms at which the decision was recorded — the proof-of-consent date. */
  timestamp: number;
}

/** The state assumed before any valid decision exists: nothing optional runs. */
export const DENY_ALL: ConsentPreferences = { essential: true, analytics: false, performance: false };

/** The optional categories, as chosen in the Manage dialog. */
export interface OptionalPreferences {
  analytics: boolean;
  performance: boolean;
}

export const preferencesFor = (
  decision: ConsentDecision,
  chosen: OptionalPreferences,
): ConsentPreferences => {
  if (decision === "accepted") return { essential: true, analytics: true, performance: true };
  if (decision === "rejected") return { essential: true, analytics: false, performance: false };
  return { essential: true, analytics: chosen.analytics, performance: chosen.performance };
};

/**
 * Parses a raw localStorage value into a still-valid decision, or null if there
 * is none. Anything unrecognised — corrupt JSON, an older schema version, an
 * expired or future-dated timestamp — is treated as "no decision yet", which
 * re-shows the banner and keeps analytics off. Failing closed is the only safe
 * direction here.
 */
export function parseStoredConsent(raw: string | null, now: number = Date.now()): StoredConsent | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Partial<StoredConsent>;

  if (candidate.version !== CONSENT_VERSION) return null;

  const { decision, timestamp, preferences } = candidate;
  if (decision !== "accepted" && decision !== "rejected" && decision !== "custom") return null;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;

  // A timestamp in the future means a tampered or clock-skewed record; a
  // timestamp older than the expiry means consent has lapsed. Both re-prompt.
  if (timestamp > now) return null;
  if (now - timestamp > CONSENT_MAX_AGE_MS) return null;

  if (typeof preferences !== "object" || preferences === null) return null;
  if (typeof preferences.analytics !== "boolean") return null;
  if (typeof preferences.performance !== "boolean") return null;

  return {
    version: CONSENT_VERSION,
    decision,
    timestamp,
    preferences: {
      essential: true,
      analytics: preferences.analytics,
      performance: preferences.performance,
    },
  };
}

/** Current decision, or null if the banner still needs to be shown. */
export function readStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    // Private-browsing modes and blocked-storage settings throw on access.
    // No stored consent means no analytics, which is the compliant fallback.
    return null;
  }
}

/**
 * Live consent check for code outside React — specifically Sentry's
 * `beforeSend`, which has to re-check on every event so that withdrawing
 * consent mid-session stops transmission from an already-initialised SDK.
 */
export function isPerformanceConsented(): boolean {
  return readStoredConsent()?.preferences.performance === true;
}

/** Records a decision and notifies listeners in this tab. */
export function writeStoredConsent(
  decision: ConsentDecision,
  chosen: OptionalPreferences,
): StoredConsent {
  const consent: StoredConsent = {
    version: CONSENT_VERSION,
    decision,
    preferences: preferencesFor(decision, chosen),
    timestamp: Date.now(),
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    } catch {
      // Storage unavailable: the choice still applies for this page view via
      // the event below, we just can't remember it on the next visit.
    }
    window.dispatchEvent(new CustomEvent<StoredConsent>(CONSENT_CHANGE_EVENT, { detail: consent }));
  }

  return consent;
}

/**
 * Clears the stored decision so the banner reappears — used by the "Cookie
 * settings" affordance and available for a withdrawal flow. Withdrawal has to
 * be as easy as giving consent.
 */
export function clearStoredConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // Nothing stored to clear.
  }
  window.dispatchEvent(new CustomEvent<StoredConsent | null>(CONSENT_CHANGE_EVENT, { detail: null }));
}
