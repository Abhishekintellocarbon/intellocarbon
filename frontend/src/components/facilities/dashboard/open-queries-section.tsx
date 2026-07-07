"use client";

import { useEffect, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { queriesApi, ApiError } from "@/lib/api";
import type { VerificationQuery } from "@/lib/types";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function RespondForm({ query, onResponded }: { query: VerificationQuery; onResponded: (query: VerificationQuery) => void }) {
  const [responseText, setResponseText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRespond = async () => {
    if (!responseText.trim()) return;
    setError(null);
    setIsSending(true);
    try {
      const { query: updated } = await queriesApi.respond(query.facilityId, query.id, responseText.trim());
      onResponded(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your response.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-3">
      {error && (
        <div className="mb-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      <textarea
        rows={2}
        value={responseText}
        onChange={(e) => setResponseText(e.target.value)}
        className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20"
        placeholder="Respond to this query so your verifier can continue their review."
      />
      <Button size="sm" className="mt-2" onClick={handleRespond} isLoading={isSending} disabled={!responseText.trim()}>
        Send response
      </Button>
    </div>
  );
}

export function OpenQueriesSection({ facilityId }: { facilityId: string }) {
  const [queries, setQueries] = useState<VerificationQuery[] | null>(null);

  useEffect(() => {
    queriesApi.list(facilityId).then(({ queries }) => setQueries(queries));
  }, [facilityId]);

  if (!queries || queries.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <MessageSquareWarning className="h-4 w-4 text-warning" />
        <h2 className="font-medium">Verifier queries</h2>
      </div>
      <div className="mt-4 space-y-3">
        {queries.map((q) => (
          <div key={q.id} className="rounded-lg border border-surface-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span
                className={
                  q.status === "OPEN"
                    ? "rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
                    : "rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-500"
                }
              >
                {q.status}
              </span>
              <span className="text-xs text-muted">{formatDateTime(q.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-foreground/90">{q.queryText}</p>
            {q.responseText ? (
              <div className="mt-2 rounded-lg bg-surface-raised/60 p-2.5">
                <p className="text-xs font-medium text-muted-foreground">Your response</p>
                <p className="mt-0.5 text-sm text-foreground/90">{q.responseText}</p>
              </div>
            ) : (
              <RespondForm query={q} onResponded={(updated) => setQueries((prev) => prev!.map((p) => (p.id === updated.id ? updated : p)))} />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
