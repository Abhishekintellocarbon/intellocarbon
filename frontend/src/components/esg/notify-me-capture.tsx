"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { esgApi, ApiError, type EsgWaitlistFramework } from "@/lib/api";

export function NotifyMeCapture({ framework }: { framework: EsgWaitlistFramework }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      await esgApi.joinWaitlist(framework, email);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Couldn't join the waitlist. Please try again.");
    }
  };

  if (status === "done") {
    return (
      <div className="mt-5 flex items-center gap-2 rounded-[8px] border border-teal-500/30 bg-teal-500/10 px-4 py-2.5 text-sm font-medium text-teal-500">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        You&apos;re on the list — we&apos;ll email you when this launches.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5">
      <div className="flex gap-2">
        <Input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10"
        />
        <Button type="submit" size="sm" className="shrink-0" isLoading={status === "submitting"}>
          Notify me
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </form>
  );
}
