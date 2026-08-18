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

  // Unpadded: "4:39 PM" reads naturally and is ~8px narrower than "04:39 PM",
  // which matters in a header row with no spare width.
  const hour = timeParts.find((p) => p.type === "hour")?.value ?? "12";
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
    <div
      className="whitespace-nowrap font-sans text-[13px] leading-tight text-[#8AA0B4] min-[1400px]:text-[12px]"
      title={display.tzName}
    >
      {/* Below sm: date only. The time is the first thing to go when the row
          is tightest — see the breakpoint reference in marketing-header. */}
      <span className="sm:hidden">{display.dateLabel}</span>

      {/* sm and up, including desktop: one line.
          It was stacked over two lines at desktop to save width, which fitted
          but read as an awkward wrap rather than a deliberate layout. One line
          costs ~37px more, bought back by trimming the nav's item padding and
          giving the clock its own flex slot — see marketing-header. The hour
          is unpadded here ("4:39 PM", not "04:39 PM"), which saves a further
          8px and is the more natural way to write a time anyway. */}
      <span className="hidden sm:inline">
        {display.dateLabel}, {display.timeLabel}
      </span>
    </div>
  );
}
