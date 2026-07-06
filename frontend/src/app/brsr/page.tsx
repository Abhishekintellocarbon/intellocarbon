import { redirect } from "next/navigation";

// Shorter alias for /esg/brsr.
export default function BrsrShortUrlRedirect() {
  redirect("/esg/brsr");
}
