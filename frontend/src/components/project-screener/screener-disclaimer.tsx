import { AlertTriangle } from "lucide-react";
import { SCREENER_DISCLAIMER } from "@/lib/project-screener-constants";

/**
 * The screening disclaimer, rendered both before the questionnaire and again
 * with the results — a reader who scrolls straight to the answer must meet it
 * on the way in and on the way out, not only once at the top where it can be
 * skipped.
 */
export function ScreenerDisclaimer() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/5 p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <p className="text-sm text-[#8AA0B4]">{SCREENER_DISCLAIMER}</p>
    </div>
  );
}
