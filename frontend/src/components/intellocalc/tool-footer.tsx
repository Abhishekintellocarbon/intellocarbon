import { CookieSettingsLink } from "@/components/layout/cookie-settings-link";

export function ToolFooter() {
  return (
    <footer className="border-t border-surface-border px-6 py-6 text-center text-xs text-muted">
      <p>
        © {new Date().getFullYear()} Intellocarbon Solutions Private Limited | intellocarbon.com | All calculations are estimates.
        Verified reports available on the platform.
      </p>
      <p className="mt-2">
        <CookieSettingsLink />
      </p>
    </footer>
  );
}
