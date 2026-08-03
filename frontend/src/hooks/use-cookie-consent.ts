"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_STORAGE_KEY,
  clearStoredConsent,
  readStoredConsent,
  writeStoredConsent,
  type ConsentDecision,
  type OptionalPreferences,
  type StoredConsent,
} from "@/lib/cookie-consent";

export interface CookieConsentState {
  /**
   * False until the first client-side read has happened. Everything renders
   * identically on the server and on the first client paint — reading
   * localStorage during render would desync hydration — so consumers must
   * treat `!hydrated` as "no consent yet" and render nothing.
   */
  hydrated: boolean;
  consent: StoredConsent | null;
  /** True once a valid, unexpired decision exists. */
  hasDecided: boolean;
  /** Gates the Plausible script tags. */
  analyticsAllowed: boolean;
  /** Gates Sentry browser-SDK initialisation. */
  performanceAllowed: boolean;
  save: (decision: ConsentDecision, chosen?: OptionalPreferences) => void;
  reopen: () => void;
}

const NOTHING_OPTIONAL: OptionalPreferences = { analytics: false, performance: false };

/**
 * Subscribes to the stored consent decision. Updates arrive from three places:
 * the initial read, a choice made in this tab (custom event), and a choice made
 * in another tab (native `storage` event).
 */
export function useCookieConsent(): CookieConsentState {
  const [hydrated, setHydrated] = useState(false);
  const [consent, setConsent] = useState<StoredConsent | null>(null);

  useEffect(() => {
    setConsent(readStoredConsent());
    setHydrated(true);

    const onLocalChange = (event: Event) => {
      setConsent((event as CustomEvent<StoredConsent | null>).detail ?? null);
    };

    const onCrossTabChange = (event: StorageEvent) => {
      if (event.key !== null && event.key !== CONSENT_STORAGE_KEY) return;
      setConsent(readStoredConsent());
    };

    window.addEventListener(CONSENT_CHANGE_EVENT, onLocalChange);
    window.addEventListener("storage", onCrossTabChange);
    return () => {
      window.removeEventListener(CONSENT_CHANGE_EVENT, onLocalChange);
      window.removeEventListener("storage", onCrossTabChange);
    };
  }, []);

  const save = useCallback((decision: ConsentDecision, chosen = NOTHING_OPTIONAL) => {
    setConsent(writeStoredConsent(decision, chosen));
  }, []);

  const reopen = useCallback(() => {
    clearStoredConsent();
    setConsent(null);
  }, []);

  return {
    hydrated,
    consent,
    hasDecided: hydrated && consent !== null,
    analyticsAllowed: hydrated && consent?.preferences.analytics === true,
    performanceAllowed: hydrated && consent?.preferences.performance === true,
    save,
    reopen,
  };
}
