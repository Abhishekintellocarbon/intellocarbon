import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { IntelloCalcNavDropdown } from "./intellocalc-nav-dropdown";

export function MarketingHeader() {
  return (
    <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/">
        <Logo size="lg" />
      </Link>
      <nav className="flex items-center gap-1 sm:gap-3">
        <IntelloCalcNavDropdown />
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Log in
          </Button>
        </Link>
        <Link href="/signup">
          <Button size="sm">Get started</Button>
        </Link>
      </nav>
    </header>
  );
}
