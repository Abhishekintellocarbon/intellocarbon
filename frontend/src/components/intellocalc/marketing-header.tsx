import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { FaqNavLink } from "./faq-nav-link";
import { MobileNav } from "./mobile-nav";
import { IntelloCalcToolsPanel } from "./intellocalc-tools-panel";

export function MarketingHeader() {
  return (
    <>
      <IntelloCalcToolsPanel />
      <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/">
          <Logo size="lg" />
        </Link>
        <MobileNav />
        <nav className="hidden items-center gap-3 md:flex">
          <Link
            href="/esg"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
          >
            ESG
          </Link>
          <Link
            href="/about"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
          >
            About Us
          </Link>
          <FaqNavLink />
          <Link href="/login" style={{ marginLeft: "32px" }}>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto rounded-[8px] border-[1.5px] border-[#00D4AA] bg-transparent px-5 py-2 font-semibold text-[#00D4AA] hover:bg-[#00D4AA]/10 hover:text-[#00D4AA]"
            >
              Log in
            </Button>
          </Link>
          <Link href="/signup" style={{ marginLeft: "12px" }}>
            <Button
              size="sm"
              className="h-auto min-w-[120px] rounded-[8px] bg-none bg-[#00D4AA] px-5 py-2 font-bold text-[#0F1923] shadow-none hover:bg-[#00D4AA] hover:brightness-105"
            >
              Get started
            </Button>
          </Link>
        </nav>
      </header>
    </>
  );
}
