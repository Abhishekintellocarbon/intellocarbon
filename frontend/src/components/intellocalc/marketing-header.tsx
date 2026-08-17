"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { LiveClock } from "@/components/layout/live-clock";
import { FaqNavLink } from "./faq-nav-link";
import { MobileNav } from "./mobile-nav";
import { IntelloCalcToolsPanel } from "./intellocalc-tools-panel";
import { ServicesNavDropdown } from "./services-nav-dropdown";
import { useAuth } from "@/context/auth-context";

export function MarketingHeader() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <IntelloCalcToolsPanel />
      <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-6">
          <Link href="/">
            <Logo size="lg" dimensional />
          </Link>
          {/* 1360px, not a Tailwind stop. The nav needs 1085px of header, and
              at lg and up the IntelloCalc panel takes a fixed 240px gutter out
              of the viewport first, so the row only fits from ~1330px. md
              (768px) switched a nav that needs 1085px into a 720px box, which
              is what cut it off in phone landscape and tablet portrait. */}
          <nav className="hidden items-center gap-1 min-[1360px]:flex">
            <Link
              href="/"
              className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
            >
              Home
            </Link>
            <ServicesNavDropdown />
            <Link
              href="/esg"
              className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
            >
              ESG
            </Link>
            {/* Sits between ESG and About Us — a free public tool with its own
                page, deliberately not inside the IntelloCalc tools panel,
                since it screens carbon *projects* rather than an entity's own
                compliance position. */}
            <Link
              href="/project-screener"
              className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
            >
              Project Screener
            </Link>
            <Link
              href="/about"
              className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
            >
              About Us
            </Link>
            <FaqNavLink />
          </nav>
        </div>
        <div className="flex items-center gap-4 pl-4 sm:pl-10 min-[1360px]:pl-6">
          {/* Visible only between sm and xl. At 375px the lockup, the clock and
              the menu button do not all fit on one row, and the clock is the
              only one of the three that is not navigation — below sm it was
              already degraded to a bare date with no time, so little is lost.
              At 1360px the full nav arrives and the same argument applies from
              the other end: the row is 126px over budget with the clock in it,
              and the clock is still the only part that is not navigation. It
              has the whole tablet range to itself. */}
          <span className="hidden sm:block min-[1360px]:hidden">
            <LiveClock />
          </span>
          <MobileNav isAuthenticated={isAuthenticated} />
          <div className="hidden items-center gap-4 min-[1360px]:flex">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button
                  size="sm"
                  className="h-auto min-w-[120px] rounded-[8px] bg-none bg-[#00D4AA] px-5 py-2 font-bold text-[#0F1923] shadow-none hover:bg-[#00D4AA] hover:brightness-105"
                >
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto rounded-[8px] border-[1.5px] border-[#00D4AA] bg-transparent px-5 py-2 font-semibold text-[#00D4AA] hover:bg-[#00D4AA]/10 hover:text-[#00D4AA]"
                  >
                    Log in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button
                    size="sm"
                    className="h-auto min-w-[120px] rounded-[8px] bg-none bg-[#00D4AA] px-5 py-2 font-bold text-[#0F1923] shadow-none hover:bg-[#00D4AA] hover:brightness-105"
                  >
                    Get started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
