/**
 * Explicit Plausible custom events.
 *
 * Plausible's auto-capture ("Form: Submission") is deliberately switched OFF in
 * the dashboard for this site. It fired on a document-level capture-phase
 * `submit` listener, which meant the IntelloCalc "Calculate" forms — which only
 * open the lead modal and never touch the API — counted as conversions, and a
 * modal submission counted even when validation or POST /api/leads failed. The
 * goal was therefore never comparable to the lead_captures table.
 *
 * Everything here is fired manually, after the write has actually succeeded, so
 * one event equals one persisted row.
 */

type PlausibleFn = (event: string, options?: { props?: Record<string, string> }) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

/**
 * Tools that capture a lead. Mirrors the LeadTool values the calculators send
 * to POST /api/leads — the ESG_* waitlist frameworks live on /esg, where
 * Plausible is not loaded at all (see plausible-analytics.tsx), so they are
 * intentionally absent.
 */
export type LeadCapturedTool = "BORDER" | "INDIA" | "COMPLY";

/**
 * Fire a Plausible custom event. A no-op on the server, and a no-op in the
 * browser whenever the loader has not run — which is the normal case for a
 * visitor who declined analytics consent or is on a non-marketing route. The
 * inline stub queues calls made before the script finishes downloading, so an
 * event fired during that window is not lost.
 */
function track(event: string, props?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  window.plausible?.(event, props ? { props } : undefined);
}

/**
 * Call only after the lead has been written — i.e. after the POST /api/leads
 * promise resolves, never before or alongside it.
 */
export function trackLeadCaptured(tool: LeadCapturedTool): void {
  track("Lead Captured", { tool });
}
