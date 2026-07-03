"use client";

import { useEffect, useState } from "react";

export function InactivityBanner({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [show]);

  if (!visible) return null;

  return (
    <div className="relative z-10 border-l-4 border-teal-500 bg-surface px-4 py-3 text-sm text-foreground/90">
      You were logged out automatically due to inactivity. Please log in again.
    </div>
  );
}
