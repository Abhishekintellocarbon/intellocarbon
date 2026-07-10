"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#E8F0F7] transition-colors hover:text-teal-500"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 animate-fade-in"
            onClick={close}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-[85%] max-w-sm animate-slide-in-right flex-col overflow-y-auto border-l border-surface-border bg-background p-6">
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-[#E8F0F7]">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={close}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#E8F0F7] transition-colors hover:text-teal-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="mt-6 flex flex-1 flex-col gap-1">
              <Link
                href="/"
                onClick={close}
                className="rounded-lg px-3 py-3 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
              >
                Home
              </Link>
              <Link
                href="/services"
                onClick={close}
                className="rounded-lg px-3 py-3 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
              >
                Services
              </Link>
              <Link
                href="/esg"
                onClick={close}
                className="rounded-lg px-3 py-3 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
              >
                ESG
              </Link>
              <Link
                href="/about"
                onClick={close}
                className="rounded-lg px-3 py-3 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
              >
                About Us
              </Link>
              <Link
                href="/faq"
                onClick={close}
                className="rounded-lg px-3 py-3 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
              >
                FAQ
              </Link>

              <div className="mt-4 flex flex-col gap-3">
                <Link href="/login" onClick={close}>
                  <Button
                    variant="ghost"
                    className="h-auto w-full rounded-[8px] border-[1.5px] border-[#00D4AA] bg-transparent px-5 py-2.5 font-semibold text-[#00D4AA] hover:bg-[#00D4AA]/10 hover:text-[#00D4AA]"
                  >
                    Log in
                  </Button>
                </Link>
                <Link href="/signup" onClick={close}>
                  <Button className="h-auto w-full rounded-[8px] bg-[#00D4AA] px-5 py-2.5 font-bold text-[#0F1923] shadow-none hover:bg-[#00D4AA] hover:brightness-105">
                    Get started
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
