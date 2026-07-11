"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERVICE_LINKS } from "./services-nav-dropdown";

export function MobileNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  const close = () => {
    setOpen(false);
    setServicesOpen(false);
  };

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
              <div>
                <div className="flex items-center">
                  <Link
                    href="/services"
                    onClick={close}
                    className="flex-1 rounded-lg px-3 py-3 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
                  >
                    Services
                  </Link>
                  <button
                    type="button"
                    aria-label={servicesOpen ? "Collapse services menu" : "Expand services menu"}
                    aria-expanded={servicesOpen}
                    onClick={() => setServicesOpen((v) => !v)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#8AA0B4] transition-colors hover:text-teal-500"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-150 ${servicesOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
                {servicesOpen && (
                  <div className="ml-3 flex flex-col gap-1 border-l border-surface-border pl-3">
                    {SERVICE_LINKS.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={close}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-[#8AA0B4] transition-colors hover:text-teal-500"
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-teal-500" />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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

              <div className="mt-6 flex flex-col gap-3 border-t border-surface-border pt-6">
                {isAuthenticated ? (
                  <Link href="/dashboard" onClick={close}>
                    <Button className="h-auto w-full rounded-[8px] bg-[#00D4AA] px-5 py-2.5 font-bold text-[#0F1923] shadow-none hover:bg-[#00D4AA] hover:brightness-105">
                      Dashboard
                    </Button>
                  </Link>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
