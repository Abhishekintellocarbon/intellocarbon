"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/hooks/use-cookie-consent";
import { CONSENT_OPEN_EVENT, type OptionalPreferences } from "@/lib/cookie-consent";
import { isPublicRoute } from "@/lib/public-routes";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Cookie consent banner for the public marketing site.
 *
 * Non-blocking by design: it is fixed to the bottom of the viewport and never
 * covers or freezes the page underneath, so a visitor can read the site — and
 * the linked privacy policy — before deciding. The "Manage" panel is a real
 * modal dialog, because there the choice is the task.
 */
export function CookieConsentBanner() {
  const pathname = usePathname();
  const { hydrated, hasDecided, consent, save } = useCookieConsent();
  const [managing, setManaging] = useState(false);
  const [chosen, setChosen] = useState<OptionalPreferences>({ analytics: false, performance: false });

  // Nothing renders until the stored decision has been read on the client;
  // rendering the banner during SSR would flash it at visitors who already
  // decided, and would not match the server HTML on hydration.
  const visible = hydrated && !hasDecided && isPublicRoute(pathname);

  // Seed the toggles from any prior decision each time the panel is opened.
  const openManage = useCallback(() => {
    setChosen({
      analytics: consent?.preferences.analytics ?? false,
      performance: consent?.preferences.performance ?? false,
    });
    setManaging(true);
  }, [consent]);

  // The "Cookie settings" footer link reaches the dialog through this event,
  // which is why the dialog below renders independently of the banner: it must
  // still open after a decision has been stored and the banner is gone.
  useEffect(() => {
    window.addEventListener(CONSENT_OPEN_EVENT, openManage);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, openManage);
  }, [openManage]);

  return (
    <>
      {visible && (
      <section
        role="region"
        aria-label="Cookie consent"
        className="fixed inset-x-0 bottom-0 z-50 animate-fade-in border-t border-surface-border bg-[#0F1923]/95 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Cookie className="mt-0.5 hidden h-5 w-5 shrink-0 text-teal-500 sm:block" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-[#8AA0B4]">
              <span className="font-medium text-[#E8F0F7]">We use cookies.</span> Essential cookies run
              automatically — they keep you signed in and the site working. Non-essential ones, which we use
              only for anonymous analytics and error diagnostics, run only if you agree. Read our{" "}
              <Link
                href="/privacy"
                className="rounded-sm font-medium text-teal-500 underline underline-offset-2 transition-colors hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={openManage}>
              Manage
            </Button>
            <Button variant="secondary" size="sm" onClick={() => save("rejected")}>
              Reject non-essential
            </Button>
            <Button variant="primary" size="sm" onClick={() => save("accepted")}>
              Accept all
            </Button>
          </div>
        </div>
      </section>
      )}

      {managing && (
        <CookiePreferencesDialog
          chosen={chosen}
          onChange={setChosen}
          onClose={() => setManaging(false)}
          onSave={() => {
            save("custom", chosen);
            setManaging(false);
          }}
        />
      )}
    </>
  );
}

interface CookiePreferencesDialogProps {
  chosen: OptionalPreferences;
  onChange: (value: OptionalPreferences) => void;
  onClose: () => void;
  onSave: () => void;
}

function CookiePreferencesDialog({ chosen, onChange, onClose, onSave }: CookiePreferencesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();

    // Escape closes without saving; Tab cycles inside the dialog so keyboard
    // focus can't wander onto the page behind it while it's open.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusable.length === 0) return;

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-preferences-title"
        className="w-full max-w-lg rounded-2xl border border-surface-border bg-[#162230] shadow-card"
      >
        <div className="flex items-start justify-between gap-4 border-b border-surface-border px-6 py-5">
          <div>
            <h2 id="cookie-preferences-title" className="text-base font-semibold text-[#E8F0F7]">
              Cookie settings
            </h2>
            <p className="mt-1 text-sm text-[#8AA0B4]">
              Choose which cookies Intellocarbon may use. You can change this at any time.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cookie settings"
            className="rounded-lg p-1.5 text-[#8AA0B4] transition-colors hover:bg-white/5 hover:text-[#E8F0F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#162230]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          <CookieCategory
            title="Essential"
            description="Required for the site to work — signing in, keeping your session active, security, and remembering this cookie choice. These cannot be turned off."
            checked
            disabled
          />
          <CookieCategory
            title="Analytics"
            description="Plausible Analytics: anonymous, cookieless page-view statistics that tell us which pages are useful. No personal data, no cross-site tracking. Turned off means the Plausible script is never loaded."
            checked={chosen.analytics}
            onChange={(analytics) => onChange({ ...chosen, analytics })}
          />
          <CookieCategory
            title="Performance"
            description="Sentry: diagnostic reports when a page errors or runs slowly, so we can fix it. Includes error details and page-load timings, with no personal data attached. Turned off means the Sentry script never starts and nothing is sent."
            checked={chosen.performance}
            onChange={(performance) => onChange({ ...chosen, performance })}
          />
        </div>

        <div className="flex justify-end gap-2.5 border-t border-surface-border px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onSave}>
            Save preferences
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CookieCategoryProps {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}

/**
 * A category row. Not `ui/switch.tsx` because that component's label-wrapped
 * input gives a disabled row no accessible "always on" affordance — Essential
 * needs to read as permanently enabled rather than as a broken toggle.
 */
function CookieCategory({ title, description, checked, disabled, onChange }: CookieCategoryProps) {
  return (
    <div className="rounded-xl border border-surface-border bg-[#0F1923] px-4 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-[#E8F0F7]">{title}</p>
        {disabled ? (
          <span className="shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-xs font-medium text-teal-500">
            Always on
          </span>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={`${title} cookies`}
            onClick={() => onChange?.(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#162230] ${
              checked ? "bg-gradient-teal-blue" : "bg-surface-raised"
            }`}
          >
            <span
              className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                checked ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[#8AA0B4]">{description}</p>
    </div>
  );
}
