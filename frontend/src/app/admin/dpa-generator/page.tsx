"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { dpaGeneratorApi, ApiError, type DpaGeneratorInput } from "@/lib/api";

function DpaGeneratorContent() {
  const [customerCompanyName, setCustomerCompanyName] = useState("");
  const [signingDate, setSigningDate] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryDesignation, setSignatoryDesignation] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ blob: Blob; fileName: string; companyName: string } | null>(null);

  const handleGenerate = async () => {
    if (!customerCompanyName.trim() || !signingDate || !signatoryName.trim() || !signatoryDesignation.trim()) {
      setError("All fields are required to generate the DPA.");
      return;
    }
    setError(null);
    setGenerated(null);
    setIsGenerating(true);
    try {
      const input: DpaGeneratorInput = {
        customerCompanyName: customerCompanyName.trim(),
        signingDate,
        signatoryName: signatoryName.trim(),
        signatoryDesignation: signatoryDesignation.trim(),
      };
      const { blob, fileName } = await dpaGeneratorApi.generate(input);
      setGenerated({ blob, fileName, companyName: input.customerCompanyName });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate the DPA. Please try again.");
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
        <h1 className="mt-6 text-2xl font-semibold">DPA Generator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a filled Data Processing Agreement for a customer, pre-signed on Intellocarbon&apos;s side. No
          customer login involved — this is a manual generate-and-download tool.
        </p>

        {error && (
          <div className="mt-6">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <Card className="mt-6 p-6">
          <h2 className="text-sm font-semibold text-foreground">Agreement details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="customer-company-name">Customer company name</Label>
              <Input
                id="customer-company-name"
                value={customerCompanyName}
                onChange={(e) => setCustomerCompanyName(e.target.value)}
                placeholder="e.g. Test Steel Pvt Ltd"
              />
            </div>
            <div>
              <Label htmlFor="signing-date">Effective / signing date</Label>
              <Input id="signing-date" type="date" value={signingDate} onChange={(e) => setSigningDate(e.target.value)} />
            </div>
            <div />
            <div>
              <Label htmlFor="signatory-name">Signatory name</Label>
              <Input id="signatory-name" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="Customer's signatory" />
            </div>
            <div>
              <Label htmlFor="signatory-designation">Signatory designation</Label>
              <Input
                id="signatory-designation"
                value={signatoryDesignation}
                onChange={(e) => setSignatoryDesignation(e.target.value)}
                placeholder="e.g. Managing Director"
              />
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
            <p className="mt-3 text-sm text-teal-500">DPA generated for {generated.companyName} — ready to download.</p>
          )}
        </Card>
      </main>
  );
}

export default function DpaGeneratorPage() {
  return <DpaGeneratorContent />;
}
