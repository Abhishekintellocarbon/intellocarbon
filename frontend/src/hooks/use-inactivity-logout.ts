"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"] as const;
const ACTIVITY_THROTTLE_MS = 1000;

export interface UseInactivityLogoutOptions {
  /** Time of inactivity after which the warning modal appears. Defaults to 10 minutes. */
  warningAfterMs?: number;
  /** Time of inactivity after which the user is logged out. Defaults to 15 minutes. */
  logoutAfterMs?: number;
  onLogout: () => void;
}

export function useInactivityLogout({
  warningAfterMs = 10 * 60_000,
  logoutAfterMs = 15 * 60_000,
  onLogout,
}: UseInactivityLogoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();
    warningTimer.current = setTimeout(() => setShowWarning(true), warningAfterMs);
    logoutTimer.current = setTimeout(() => {
      setShowWarning(false);
      onLogout();
    }, logoutAfterMs);
  }, [clearTimers, warningAfterMs, logoutAfterMs, onLogout]);

  const resetTimer = useCallback(() => {
    setShowWarning(false);
    startTimers();
  }, [startTimers]);

  useEffect(() => {
    startTimers();

    let lastReset = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastReset < ACTIVITY_THROTTLE_MS) return;
      lastReset = now;
      resetTimer();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [startTimers, resetTimer, clearTimers]);

  return { showWarning, resetTimer, logoutNow: onLogout };
}
