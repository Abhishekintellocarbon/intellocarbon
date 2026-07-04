import Link from "next/link";

export function FaqNavLink() {
  return (
    <Link
      href="/faq"
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
    >
      FAQ
    </Link>
  );
}
