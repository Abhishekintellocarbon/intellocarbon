"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError, cbamExecutiveSummaryApi } from "@/lib/api";

/**
 * One-click board pack for the facility's most recent submitted period.
 *
 * No period picker: the summary covers the same period the CBAM cards above
 * are already showing, so the button can't produce a document that disagrees
 * with the screen it was clicked from.
 *
 * Unlike the full Communication Package this is not gated on the CBAM filing
 * window — it's an internal management document, and a board pack that only
 * works a few weeks a year would be useless.
 */
export function ExecutiveSummaryButton({
  facilityId,
  facilityName,
}: {
  facilityId: string;
  facilityName: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      await cbamExecutiveSummaryApi.download(facilityId, facilityName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate the executive summary. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <Button size="sm" variant="secondary" onClick={download} disabled={downloading}>
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {downloading ? "Generating…" : "Board summary PDF"}
      </Button>
      {error && (
        <div className="mt-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </div>
  );
}
