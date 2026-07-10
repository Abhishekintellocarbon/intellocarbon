import Link from "next/link";
import { ChevronDown, Globe2, MapPinned, Leaf, Calculator } from "lucide-react";

const SERVICE_LINKS = [
  {
    href: "/#pillars",
    icon: Globe2,
    name: "CBAM Compliance",
    blurb: "EU carbon border adjustment reporting",
  },
  {
    href: "/#pillars",
    icon: MapPinned,
    name: "CCTS Compliance",
    blurb: "India's carbon credit trading scheme",
  },
  {
    href: "/esg",
    icon: Leaf,
    name: "BRSR Core / ESG Reporting",
    blurb: "SEBI Business Responsibility & Sustainability Reporting",
  },
  {
    href: "/intellocalc",
    icon: Calculator,
    name: "IntelloCalc (free tools)",
    blurb: "Free CBAM & CCTS calculators",
  },
];

export function ServicesNavDropdown() {
  return (
    <div className="group relative">
      <Link
        href="/services"
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500 group-focus-within:text-teal-500"
      >
        Services
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-150 group-hover:rotate-180 group-focus-within:rotate-180" />
      </Link>

      <div className="invisible absolute left-0 top-full z-40 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="w-64 rounded-[12px] border border-surface-border bg-surface p-2 shadow-card">
          {SERVICE_LINKS.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="group/item flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-[#162230]"
            >
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
              <span>
                <span className="block text-sm font-medium text-foreground group-hover/item:text-teal-500">
                  {item.name}
                </span>
                <span className="block text-xs text-muted-foreground">{item.blurb}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
