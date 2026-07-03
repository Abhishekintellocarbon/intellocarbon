import { ShieldCheck, Award, ScrollText, LockKeyhole } from "lucide-react";

const ITEMS = [
  { icon: ShieldCheck, label: "ISO 14064 Lead Verifier Founded" },
  { icon: Award, label: "DPIIT Recognised Startup" },
  { icon: ScrollText, label: "Regulatory Basis: EU 2023/956 & S.O. 2825(E) 2023" },
  { icon: LockKeyhole, label: "Data Secured in India" },
];

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
