"use client";

import { useCallback, useRef, useState } from "react";

const AUTOSAVE_DEBOUNCE_MS = 800;
const SAVED_INDICATOR_MS = 2000;

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounces a save call so a rapid sequence of field blurs (e.g. tabbing
 * through several inputs) collapses into one request 800ms after the last
 * one, instead of firing a request per field. `save` reads current form
 * state itself (e.g. via react-hook-form's `getValues()`) when it actually
 * runs, so it always saves what's on screen at that moment rather than a
 * snapshot taken at blur time.
 */
export function useAutosave(save: () => Promise<void>) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const triggerAutosave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);

    timer.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await saveRef.current();
        setStatus("saved");
        savedTimer.current = setTimeout(() => setStatus("idle"), SAVED_INDICATOR_MS);
      } catch {
        setStatus("error");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  return { status, triggerAutosave };
}
