// The password-reset link (/reset-password?token=...) puts a live,
// single-use credential in the URL. Sentry's browser/server/edge SDKs
// capture the current request/page URL by default (event.request.url,
// breadcrumb navigation/fetch entries) — this strips that token before any
// event leaves the app, since Sentry never needs it to debug an error.
const SENSITIVE_QUERY_PARAMS = ["token"];

const redactUrl = (url: string): string => {
  try {
    const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
    const parsed = new URL(url, isAbsolute ? undefined : "http://placeholder.local");
    let touched = false;
    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, "[REDACTED]");
        touched = true;
      }
    }
    if (!touched) return url;
    return isAbsolute ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
};

export const scrubSentryEvent = <T extends { request?: { url?: string }; breadcrumbs?: { data?: Record<string, unknown> }[] }>(
  event: T,
): T => {
  if (event.request?.url) {
    event.request.url = redactUrl(event.request.url);
  }
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      const url = crumb.data?.url;
      if (typeof url === "string" && crumb.data) {
        crumb.data.url = redactUrl(url);
      }
    }
  }
  return event;
};
