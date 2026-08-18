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
      {/* ===================================================================
          BREAKPOINT REFERENCE — read before changing any width class here.

          Three layouts, two switch points. The awkward numbers are measured,
          not chosen: the IntelloCalc panel is `position: fixed` and the page
          root reserves it with `lg:pr-[240px]`, so from lg up the header's
          usable width is (viewport - 240), not the viewport. Every budget
          below is in usable width.

            < 640px  (below sm)   Logo + hamburger. No clock: at 375px the
                                  lockup, clock and menu button do not fit on
                                  one row, and the clock is the only one of
                                  the three that is not navigation.

            640px - 1359px        Logo + clock + hamburger. The clock has this
              (sm .. <1360)       whole range to itself.

            >= 1360px             Logo + full nav + Log in / Get started.
                                  Hamburger and clock both drop away.

          Why 1360 and not a Tailwind stop: the full row needs ~1053px of
          usable width (logo 293 + nav 517 + CTAs 243). At 1360 the usable
          width is 1360-240-48(px-6) = 1072, so it fits with ~19px to spare.
          At 1280 it is 992 and the row is ~61px short — which is why 1280
          still shows the hamburger despite being a desktop width. md (768px)
          was the original value and switched a nav needing 1000px+ into a
          720px box, which is what clipped it in phone landscape and tablet
          portrait.

          From 1392px up the header hits its max-w-6xl cap (1152px) and the
          usable width stops growing at 1104px, so every width >= 1392
          renders identically. 1440 and 1920 are the same layout.

          If you add a nav item, re-measure: the 1360 switch has only ~19px
          of headroom, and anything wider than that must move the breakpoint
          up rather than let the row overflow.
          =================================================================== */}
      <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/">
          <Logo size="lg" dimensional />
        </Link>
        {/* A direct child of the header, not nested with the logo. With three
            flex children, `justify-between` splits the leftover width into two
            equal gaps, so the nav sits evenly between the logo and the CTAs.
            Nested inside the logo's div it was glued to the logo and dumped
            all ~90px of slack into a single void before "Log in", which read
            as three separate clusters rather than one row. When the nav is
            `display: none` below 1360 it stops being a flex item, so the
            two-child logo/hamburger layout is unchanged. */}
        <nav className="hidden items-center gap-3 min-[1360px]:flex">
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
        {/* pl-4/sm:pl-10 keeps the hamburger clear of the clock while both are
            on screen. It is dropped at 1360 because the clock is gone by then
            and the padding would otherwise widen the nav-to-CTA gap only,
            tilting the two gaps that justify-between is balancing. */}
        <div className="flex items-center gap-4 pl-4 sm:pl-10 min-[1360px]:pl-0">
          {/* See the breakpoint reference above: the clock owns 640-1359. It is
              the only element here that is not navigation, so it is the one
              that yields at both ends — to the menu button at 375px, and to
              the full nav at 1360px. */}
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
