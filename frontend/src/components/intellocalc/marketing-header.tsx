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

            640px - 1399px        Logo + clock (one line) + hamburger.
              (sm .. <1400)

            >= 1400px             Logo + full nav + clock (stacked) +
                                  Log in / Get started. Only the hamburger
                                  drops away; the clock is present from sm
                                  all the way up.

          THE BINDING CONSTRAINT is max-w-6xl, not the viewport. The header
          caps at 1152px, so usable width stops growing at 1104px however wide
          the screen gets — 1440 and 1920 have exactly the same room. The
          desktop row spends it as: logo 317 + nav 477 + (clock 57 + CTAs 219)
          = 1086, leaving 18px, which justify-between splits into two 10px
          gaps once the nav is a direct flex child.

          That is why the clock is stacked over two lines at this breakpoint.
          One-line "18 Aug, 04:17 PM" measures 106px; there has never been
          106px free, at any viewport width. Stacked it measures 57px and
          costs no height. See live-clock.tsx.

          Why 1400: the row needs 1086px, and usable = viewport - 288 until
          the cap bites, so it needs viewport >= 1374 to fit at all and
          >= 1394 to keep a 10px gap. 1400 is the first round number clear of
          both. It was 1360 before the clock was added to this row, and 1360
          now leaves usable 1072 against a 1086 requirement — 14px short,
          which flex silently absorbs by compressing the nav. md (768px) was
          the original value and switched a nav needing 1000px+ into a 720px
          box, which is what clipped it in phone landscape and tablet
          portrait.

          If you add a nav item or lengthen the CTAs, re-measure: there are
          only 18px spare, and anything larger must move this breakpoint up
          rather than let flex quietly shrink the row.
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
            `display: none` below 1400 it stops being a flex item, so the
            two-child logo/hamburger layout is unchanged. */}
        <nav className="hidden items-center gap-1 min-[1400px]:flex">
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
        {/* pl-4/sm:pl-10 keeps the hamburger clear of the clock while both
            are on screen. Both are dropped at 1400: the hamburger is gone by
            then, and the padding would otherwise widen the nav-to-CTA gap
            only, tilting the two gaps justify-between is balancing. The
            internal gap tightens to gap-3 there because the row has just 18px
            spare — see the budget above. */}
        <div className="flex items-center gap-4 pl-4 sm:pl-10 min-[1400px]:gap-3 min-[1400px]:pl-0">
          {/* Present from sm upward, including desktop. It sits immediately
              before the CTAs so the row reads logo / nav / time / actions,
              and it is inside this group rather than being a fourth flex
              child of the header — as a separate child, justify-between would
              have given it its own share of the leftover width and pushed the
              nav back toward the logo, which is the lopsided spacing that was
              just fixed. Grouped with the CTAs it moves as one block.
              See LiveClock for why the desktop form is stacked. */}
          <span className="hidden sm:block">
            <LiveClock />
          </span>
          <MobileNav isAuthenticated={isAuthenticated} />
          <div className="hidden items-center gap-4 min-[1400px]:flex">
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
