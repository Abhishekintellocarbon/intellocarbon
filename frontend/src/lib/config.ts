export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// NEXT_PUBLIC_ vars are baked in at build time — if this was left unset for
// a production build, every API call silently targets localhost and the
// whole app breaks. Not a security issue (nothing insecure runs), but it
// should be loud rather than a silent wall of failed fetches with no clue why.
if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_API_URL && window.location.hostname !== "localhost") {
  console.error(
    "NEXT_PUBLIC_API_URL was not set at build time — API calls are targeting localhost:4000 and will fail. Rebuild with NEXT_PUBLIC_API_URL set to the real backend origin.",
  );
}
