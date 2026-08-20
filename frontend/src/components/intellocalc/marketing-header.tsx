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

            640px - 1399px        Logo, then clock + hamburger together on the
              (sm .. <1400)       right (`sm:ml-auto` on the clock). The clock
                                  used to sit mid-row here because
                                  justify-between gave it an equal gap either
                                  side; it now hugs the hamburger at 12px, the
                                  same gap the desktop cluster uses.

            >= 1400px             Logo + full nav + clock (one line) +
                                  Log in / Get started, as four flex children
                                  with three equal gaps.

          THE HEADER IS FULL-BLEED, and deliberately escapes two constraints
          that apply to the page content below it. Both were measured, and
          re-adding either is what put ~288px of dead space to the right of
          "Get started" at 1440 (528px at 1920, 848px at 2560):

            1. The page root carries `lg:pr-[240px]` to reserve a column for
               the IntelloCalc panel. That panel is `position: fixed` AND
               vertically centred (`top-[40%]`) — measured at 242px..478px in
               a 900px-tall viewport, while the header band ends at 103px. It
               therefore never occupies the header's row, so the header pays
               240px for clearance it does not need. `lg:-mr-[240px]` cancels
               the reservation for this element only; the content below still
               gets it.

            2. `mx-auto max-w-6xl` capped the header at 1152px and centred it
               inside that already-narrowed column, so every pixel of extra
               viewport was split into two growing gaps — which is why the
               logo sat 288px from the left edge at 1920.

          Note that adjusting px-* here can never fix that gap: the loss came
          from the parent's padding and the centring cap, not from the
          header's own inset. Both edges are now px-6, so the logo's left
          inset and the CTA's right inset are both 24px at every width.

          KNOWN BOUND: because the header now reaches the viewport edge, it
          would collide with the fixed panel if the panel's band ever rose
          into the header's. Panel top is `0.4 * vh - 118`, so that needs a
          viewport shorter than ~553px at lg+ widths. The panel is z-40 and
          the header z-30, so the panel would win. Re-check this if the
          panel's height or `top-[40%]` changes.

          The desktop row's content is:

            logo 317 + nav 441 + clock 92 + CTAs 207 = 1057

          justify-between spreads the remaining width into three gaps — one
          either side of the clock, one between logo and nav. Those gaps now
          grow with the viewport instead of being fixed at ~16px.

          NAV SPACING is px-3 + gap-1 on every item, giving 28px between
          adjacent labels. It used to be px-1.5 + gap-0 (12px) on the plain
          links while Services and FAQ already carried px-3 — so the gaps were
          not merely tight, they were uneven, which is what made the row hard
          to scan. All six items now share one padding scale; change them
          together or the unevenness comes back.

          Those trims existed to buy width back when the header was capped at
          1152px. Full-bleed removed that pressure: at 1400 the row needs
          ~1245px of 1352px usable, so the spacing is affordable at the
          tightest desktop width, not just the widest.

          Why 1400: the row needs ~1057px plus gaps. That budget is unchanged
          by the full-bleed fix — at 1400 the header is now 1400 wide rather
          than 1112, so the switch point has margin it did not have before.
          md (768px) was the original value and switched a nav needing 1000px+
          into a 720px box, which is what clipped it in phone landscape and
          tablet portrait.

          MOBILE IS UNAFFECTED by the full-bleed change: `lg:-mr-[240px]` does
          nothing below 1024, and the removed `max-w-6xl` never bound below
          1152 anyway. Below lg this file renders exactly what it did before.
          =================================================================== */}
      <header className="relative z-30 flex items-center justify-between px-6 py-6 lg:-mr-[240px]">
        <Link href="/">
          <Logo size="lg" dimensional />
        </Link>
        {/* `mx-auto` at desktop is what groups the right-hand cluster.
            Auto margins consume free space BEFORE justify-between gets to
            distribute any, so all the slack collects on the two sides of the
            nav and none is left to push the clock away from the CTAs — the
            clock ends up sitting directly against "Log in" as one cluster,
            which is the composition asked for. Previously the clock was a
            third gap-taking flex child and read as its own island.

            Below 1400 the nav is `display: none`, so it is not a flex item
            and `mx-auto` cannot apply. justify-between then governs the
            logo / clock / hamburger row exactly as before — this file's
            sub-1400 layout is deliberately untouched. */}
        <nav className="hidden items-center gap-1 min-[1400px]:mx-auto min-[1400px]:flex">
          <Link
            href="/"
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[15px] font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
          >
            Home
          </Link>
          <ServicesNavDropdown />
          <Link
            href="/esg"
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[15px] font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
          >
            ESG
          </Link>
          {/* Sits between ESG and About Us — a free public tool with its own
              page, deliberately not inside the IntelloCalc tools panel,
              since it screens carbon *projects* rather than an entity's own
              compliance position. */}
          <Link
            href="/project-screener"
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[15px] font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
          >
            Project Screener
          </Link>
          <Link
            href="/about"
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[15px] font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
          >
            About Us
          </Link>
          <FaqNavLink />
        </nav>
        {/* `sm:ml-auto` is the landscape/tablet counterpart of the nav's
            `mx-auto`, and does the same job by the same mechanism. Between
            640 and 1400 the nav is hidden, so the row is logo / clock /
            hamburger and justify-between handed the clock an equal share on
            both sides — it drifted to mid-row, 84px off the hamburger at 640
            and 166px at 812, growing with the viewport. The auto margin takes
            all the free space to the clock's LEFT instead, so the clock and
            the hamburger settle against each other as one right-hand group.

            `min-[1400px]:ml-0` is load-bearing. At desktop the nav already
            carries `mx-auto`, and flexbox splits free space equally among ALL
            auto margins — a third one here would take a third of it, pulling
            the clock back off the CTAs and undoing the desktop grouping. */}
        <span className="hidden sm:ml-auto sm:block min-[1400px]:ml-0">
          <LiveClock />
        </span>
        {/* pl is the clock-to-cluster gap once the auto margin has pulled them
            together, so 640-up and desktop share one value (12px) and read as
            the same group. Below 640 the clock is `display: none`, so pl-4 is
            only the logo/hamburger separation on mobile portrait — left at 16
            deliberately, since that row is confirmed correct. */}
        <div className="flex items-center gap-4 pl-4 sm:pl-3 min-[1400px]:gap-4">
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
