import { ShieldCheck } from "lucide-react";

// Only claims that are currently true and verifiable belong here — this is a
// credibility badge row, not a features list. DPIIT registration is pending
// (not yet filed), so it must not appear until it's actually granted.
const ITEMS = [{ icon: ShieldCheck, label: "ISO 14064-aligned verification methodology" }];

export function TrustStrip({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {ITEMS.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5 text-xs font-medium">
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
