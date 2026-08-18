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

            >= 1400px             Logo + full nav + clock (one line) +
                                  Log in / Get started, as four flex children
                                  with three equal gaps.

          THE BINDING CONSTRAINT is max-w-6xl, not the viewport. The header
          caps at 1152px, so usable width stops growing at 1104px however wide
          the screen gets — 1440 and 1920 have exactly the same room. Widening
          the cap is NOT the way to buy space: the IntelloCalc panel is fixed
          at the right of the viewport, so a wider header pushes the CTAs
          toward it rather than away.

          The desktop row spends the 1104px as:

            logo 317 + nav 441 + clock 92 + CTAs 207 = 1057

          leaving 47px, which justify-between splits into three ~16px gaps —
          one either side of the clock, one between logo and nav.

          The clock was stacked over two lines here until it was reported as
          looking like an awkward wrap. One line costs ~36px more, bought back
          by trimming nav item padding to px-1.5, nav gap to 0, CTA padding to
          px-4 and the CTA pair gap to 3, plus dropping the leading zero from
          the hour. Every one of those is load-bearing: restore any and the
          gaps fall back toward the ~5px that made this look cramped.

          Header padding is px-6, so the logo's left inset and the CTA's right
          inset are both 24px — they are symmetric, and raising them costs two
          pixels of gap for every one of edge inset.

          Why 1400: the row needs ~1057px plus gaps, and usable is
          viewport - 288 until the cap bites. md (768px) was the original value
          and switched a nav needing 1000px+ into a 720px box, which is what
          clipped it in phone landscape and tablet portrait.

          If you add a nav item or lengthen the CTAs, re-measure — there are
          47px of slack and three gaps competing for them.
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
        <nav className="hidden items-center gap-0 min-[1400px]:flex">
          <Link
            href="/"
            className="whitespace-nowrap rounded-lg px-1.5 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
          >
            Home
          </Link>
          <ServicesNavDropdown />
          <Link
            href="/esg"
            className="whitespace-nowrap rounded-lg px-1.5 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
          >
            ESG
          </Link>
          {/* Sits between ESG and About Us — a free public tool with its own
              page, deliberately not inside the IntelloCalc tools panel,
              since it screens carbon *projects* rather than an entity's own
              compliance position. */}
          <Link
            href="/project-screener"
            className="whitespace-nowrap rounded-lg px-1.5 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
          >
            Project Screener
          </Link>
          <Link
            href="/about"
            className="whitespace-nowrap rounded-lg px-1.5 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
          >
            About Us
          </Link>
          <FaqNavLink />
        </nav>
        {/* Its own flex child at desktop, so justify-between gives it an equal
            gap on BOTH sides rather than welding it to the CTA block — which
            left it with ~11px of clearance and reading as cramped. Below 1400
            it stays inside the group on the right, next to the hamburger,
            where there is no nav to balance against. */}
        <span className="hidden sm:block min-[1400px]:order-none">
          <LiveClock />
        </span>
        <div className="flex items-center gap-4 pl-4 sm:pl-6 min-[1400px]:gap-4 min-[1400px]:pl-0">
          <MobileNav isAuthenticated={isAuthenticated} />
          <div className="hidden items-center gap-3 min-[1400px]:flex">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button
                  size="sm"
                  className="h-auto min-w-[120px] rounded-[8px] bg-none bg-[#00D4AA] px-4 py-2 font-bold text-[#0F1923] shadow-none hover:bg-[#00D4AA] hover:brightness-105"
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
                    className="h-auto rounded-[8px] border-[1.5px] border-[#00D4AA] bg-transparent px-4 py-2 font-semibold text-[#00D4AA] hover:bg-[#00D4AA]/10 hover:text-[#00D4AA]"
                  >
                    Log in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button
                    size="sm"
                    className="h-auto min-w-[120px] rounded-[8px] bg-none bg-[#00D4AA] px-4 py-2 font-bold text-[#0F1923] shadow-none hover:bg-[#00D4AA] hover:brightness-105"
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
