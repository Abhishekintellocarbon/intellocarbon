import {
  Building2,
  Calculator,
  ClipboardCheck,
  FileSignature,
  Gauge,
  IndianRupee,
  LayoutDashboard,
  ShieldCheck,
  UserCog,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavSection {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Single source of truth for Super Admin panel navigation — add a new admin
 * tool by adding one entry here; both the desktop sidebar and the mobile
 * slide-in nav read from this list. */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/companies", label: "Companies", icon: Building2 },
  { href: "/admin/revenue", label: "Revenue", icon: IndianRupee },
  { href: "/admin/leads", label: "Leads", icon: UserPlus },
  { href: "/admin/approvals", label: "Pending Approvals", icon: ClipboardCheck },
  { href: "/admin/internal-operators", label: "Internal Operators", icon: UserCog },
  { href: "/admin/verifiers", label: "Verifiers", icon: ShieldCheck },
  { href: "/admin/emission-factors", label: "Emission Factors", icon: Gauge },
  { href: "/admin/ghg-runner", label: "GHG Runner", icon: Calculator },
  { href: "/admin/dpa-generator", label: "DPA Generator", icon: FileSignature },
];

/** "/admin" would prefix-match every other section's route too, so it only
 * counts as active on an exact match — the rest still match sub-routes
 * (e.g. /admin/companies/[id] keeps "Companies" highlighted). */
export const isAdminSectionActive = (href: string, pathname: string | null) => {
  if (!pathname) return false;
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
};
