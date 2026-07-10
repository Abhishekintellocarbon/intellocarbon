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
      <span className="sm:hidden">{display.dateLabel}</span>
      <span className="hidden sm:inline">
        {display.dateLabel}, {display.timeLabel}
      </span>
    </div>
  );
}
