/**
 * Which routes are the public marketing site, as opposed to the authenticated
 * app behind login.
 *
 * This drives where the cookie banner appears. It is an allowlist rather than a
 * denylist of authenticated paths on purpose: a new authenticated route added
 * later must never start showing a consent banner to a logged-in user just
 * because nobody remembered to exclude it. The cost of the opposite mistake —
 * a new marketing page missing from this list — is a banner that doesn't show,
 * which is caught the moment the page is opened, so keep this list current when
 * adding public pages.
 */

/** Public routes matched exactly. `/esg` is public; `/esg/brsr` is not. */
const PUBLIC_EXACT_ROUTES = new Set([
  "/",
  "/about",
  "/faq",
  "/services",
  "/esg",
  "/ccts-obligated-entities",
  "/privacy",
  "/terms",
  // Pre-auth screens. A visitor can land on these first, so consent has to be
  // obtainable here too — these are not "inside the authenticated app".
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

/** Public routes where every sub-path is also public. */
const PUBLIC_ROUTE_PREFIXES = ["/products", "/insights", "/intellocalc"];

/**
 * Deliberately absent, all of them authenticated: /dashboard, /facilities,
 * /company, /billing, /onboarding, /admin, /verifier, /internal-data-entry,
 * /pending-approval, /esg/brsr, /esg/issb, /brsr.
 */
export function isPublicRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;

  // Normalise a trailing slash so "/about/" behaves like "/about". The root
  // path is the one case where the slash is the path.
  const normalised = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (PUBLIC_EXACT_ROUTES.has(normalised)) return true;
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => normalised === prefix || normalised.startsWith(`${prefix}/`),
  );
}
