"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

export function FaqNavLink() {
  const pathname = usePathname();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/billing") {
      e.preventDefault();
      document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <Link
      href="/billing#faq"
      onClick={handleClick}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
    >
      FAQ
    </Link>
  );
}
