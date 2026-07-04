import { Check, Pencil } from "lucide-react";

export function DraftBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#F5A623]/40 bg-[#F5A623]/10 px-2 py-0.5 text-[11px] font-semibold text-[#F5A623]">
      <Pencil className="h-2.5 w-2.5" />
      Draft
    </span>
  );
}

export function SubmittedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[11px] font-semibold text-teal-500">
      <Check className="h-2.5 w-2.5" />
      Submitted
    </span>
  );
}
