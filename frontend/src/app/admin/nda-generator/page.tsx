"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { ndaGeneratorApi, ApiError, type NdaGeneratorInput } from "@/lib/api";

function NdaGeneratorContent() {
  const [recipientName, setRecipientName] = useState("");
  const [recipientType, setRecipientType] = useState<"" | NdaGeneratorInput["recipientType"]>("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ blob: Blob; fileName: string; recipientName: string } | null>(null);

  const handleGenerate = async () => {
    if (!recipientName.trim() || !recipientType || !recipientAddress.trim() || !effectiveDate) {
      setError("All fields are required to generate the NDA.");
      return;
    }
    setError(null);
    setGenerated(null);
    setIsGenerating(true);
    try {
      const input: NdaGeneratorInput = {
        recipientName: recipientName.trim(),
        recipientType,
        recipientAddress: recipientAddress.trim(),
        effectiveDate,
      };
      const { blob, fileName } = await ndaGeneratorApi.generate(input);
      setGenerated({ blob, fileName, recipientName: input.recipientName });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate the NDA. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generated) return;
    const objectUrl = URL.createObjectURL(generated.blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = generated.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mt-6 text-2xl font-semibold">NDA Generator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a filled Mutual Non-Disclosure Agreement for a prospective partner, investor, or hire, pre-signed
          on Intellocarbon&apos;s side. No recipient login involved — this is a manual generate-and-download tool.
        </p>

        {error && (
          <div className="mt-6">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <Card className="mt-6 p-6">
          <h2 className="text-sm font-semibold text-foreground">Agreement details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="recipient-name">Recipient name</Label>
              <Input
                id="recipient-name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Jane Doe or Acme Ventures LLP"
              />
            </div>
            <div>
              <Label htmlFor="recipient-type">Recipient type</Label>
              <Select id="recipient-type" value={recipientType} onChange={(e) => setRecipientType(e.target.value as typeof recipientType)}>
                <option value="">Select type</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="COMPANY">Company</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="recipient-address">Recipient address</Label>
              <textarea
                id="recipient-address"
                rows={3}
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Full postal address"
                className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <Label htmlFor="effective-date">Effective date</Label>
              <Input id="effective-date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={handleGenerate} isLoading={isGenerating}>
              <FileText className="h-4 w-4" />
              Generate PDF
            </Button>
            {generated && (
              <Button variant="secondary" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            )}
          </div>

          {generated && (
            <p className="mt-3 text-sm text-teal-500">NDA generated for {generated.recipientName} — ready to download.</p>
          )}
        </Card>
      </main>
  );
}

export default function NdaGeneratorPage() {
  return <NdaGeneratorContent />;
}
