import Link from "next/link";

export function AnnouncementBar() {
  return (
    <div className="sticky top-0 z-50 border-b border-surface-border bg-surface-raised/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-6 py-2 text-center text-xs text-muted-foreground">
        <span>Already an Intellocarbon client?</span>
        <Link href="/login" className="font-medium text-teal-500 hover:underline">
          Log in
        </Link>
        <span className="text-surface-border">|</span>
        <span>New here?</span>
        <Link href="/signup" className="font-medium text-teal-500 hover:underline">
          Sign up free — takes 2 minutes
        </Link>
      </div>
    </div>
  );
}
