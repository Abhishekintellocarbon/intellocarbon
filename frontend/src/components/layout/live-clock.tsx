"use client";

import { useEffect, useState } from "react";

const FALLBACK_TIMEZONE = "Asia/Calcutta";

function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

function formatParts(date: Date, timeZone: string) {
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
  }).formatToParts(date);

  const day = dateParts.find((p) => p.type === "day")?.value ?? "";
  const month = dateParts.find((p) => p.type === "month")?.value ?? "";
  const dateLabel = `${day} ${month}`;

  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const hour = (timeParts.find((p) => p.type === "hour")?.value ?? "12").padStart(2, "0");
  const minute = timeParts.find((p) => p.type === "minute")?.value ?? "00";
  const dayPeriod = (timeParts.find((p) => p.type === "dayPeriod")?.value ?? "AM").toUpperCase();

  const tzName =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "IST";

  return { dateLabel, timeLabel: `${hour}:${minute} ${dayPeriod}`, tzName };
}

export function LiveClock() {
  const [display, setDisplay] = useState<{ dateLabel: string; timeLabel: string; tzName: string } | null>(null);

  useEffect(() => {
    const timeZone = getTimeZone();
    const update = () => setDisplay(formatParts(new Date(), timeZone));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!display) return null;

  return (
    <div className="whitespace-nowrap font-sans text-[13px] leading-tight text-[#8AA0B4]" title={display.tzName}>
      {/* Below sm: date only. The time is the first thing to go when the row
          is tightest — see the breakpoint reference in marketing-header. */}
      <span className="sm:hidden">{display.dateLabel}</span>

      {/* sm to 1399: one line, which is what the tablet header has room for. */}
      <span className="hidden sm:inline min-[1400px]:hidden">
        {display.dateLabel}, {display.timeLabel}
      </span>

      {/* 1400 and up: the same information stacked over two lines.
          Not a style choice — a width one. The desktop header is capped at
          max-w-6xl, so its usable width stops growing at 1104px however wide
          the viewport gets, and the row already spends 1013px on the logo,
          nav and CTAs. One-line "18 Aug, 04:17 PM" measures 106px and does
          not fit in the 91px left, at any viewport width. Stacked, the same
          date and time measure 57px, because the width becomes the wider of
          the two lines rather than their sum. Two lines at leading-[1.15] is
          ~30px tall and the header row is ~44px, so it costs no height. */}
      <span className="hidden min-[1400px]:flex min-[1400px]:flex-col min-[1400px]:items-end min-[1400px]:leading-[1.15]">
        <span>{display.dateLabel}</span>
        <span>{display.timeLabel}</span>
      </span>
    </div>
  );
}
