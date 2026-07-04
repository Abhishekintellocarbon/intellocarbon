"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ComplyProgress } from "@/components/intellocalc/comply-progress";
import { LeadCaptureModal } from "@/components/intellocalc/lead-capture-modal";
import { intellocalcApi } from "@/lib/api";
import { CBAM_GOOD_OPTIONS, EU_EXPORT_VOLUME_OPTIONS, CCTS_STATUS_OPTIONS, EPR_PRODUCT_OPTIONS } from "@/lib/intellocalc-constants";
import type { LeadContactValues } from "@/lib/validations/intellocalc";
import type { CbamGood, ComplyInputs, ComplyResults, EprProduct } from "@/lib/intellocalc-types";

type Screen = "q1" | "q1no" | "q2" | "q3" | "q3b" | "q4" | "q5" | "results";

const SCREEN_PERCENT: Record<Screen, number> = {
  q1: 10,
  q1no: 100,
  q2: 28,
  q3: 46,
  q3b: 58,
  q4: 72,
  q5: 90,
  results: 100,
};

interface Answers {
  manufacturesGoods?: boolean;
  exportsToEu?: "YES" | "NO" | "PLANNING";
  euGoods: CbamGood[];
  euExportVolume?: "BELOW_50" | "RANGE_50_500" | "RANGE_500_5000" | "ABOVE_5000";
  cctsStatus?: "NOTIFIED" | "MAYBE" | "NOT_COVERED" | "NOT_SURE";
  eprProducts: EprProduct[];
}

const INITIAL_ANSWERS: Answers = { euGoods: [], eprProducts: [] };

function OptionCard({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-colors",
        selected
          ? "border-teal-500/60 bg-teal-500/10 text-foreground"
          : "border-surface-border bg-surface hover:border-teal-500/30",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-transparent bg-gradient-teal-blue" : "border-surface-border",
        )}
      >
        {selected && <Check className="h-3 w-3 text-[#06120F]" />}
      </span>
    </button>
  );
}

export function ComplyTool() {
  const [screen, setScreen] = useState<Screen>("q1");
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [results, setResults] = useState<ComplyResults | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  const back = (to: Screen) => setScreen(to);

  const submitLead = async (contact: LeadContactValues) => {
    const inputs: ComplyInputs = {
      manufacturesGoods: answers.manufacturesGoods ?? true,
      exportsToEu: answers.exportsToEu ?? "NO",
      euGoods: answers.euGoods,
      euExportVolume: answers.euExportVolume,
      cctsStatus: answers.cctsStatus ?? "NOT_SURE",
      eprProducts: answers.eprProducts,
    };
    const { results, leadId } = await intellocalcApi.submitComply(
      { ...contact, phone: contact.phone || undefined },
      inputs,
    );
    setResults(results);
    setLeadId(leadId ?? null);
    setModalOpen(false);
    setScreen("results");
  };

  const toggleEuGood = (value: CbamGood) => {
    setAnswers((a) => {
      if (value === "NONE") return { ...a, euGoods: a.euGoods.includes("NONE") ? [] : ["NONE"] };
      const withoutNone = a.euGoods.filter((g) => g !== "NONE");
      const has = withoutNone.includes(value);
      return { ...a, euGoods: has ? withoutNone.filter((g) => g !== value) : [...withoutNone, value] };
    });
  };

  const toggleEprProduct = (value: EprProduct) => {
    setAnswers((a) => {
      if (value === "NONE") return { ...a, eprProducts: a.eprProducts.includes("NONE") ? [] : ["NONE"] };
      const withoutNone = a.eprProducts.filter((p) => p !== "NONE");
      const has = withoutNone.includes(value);
      return { ...a, eprProducts: has ? withoutNone.filter((p) => p !== value) : [...withoutNone, value] };
    });
  };

  if (screen === "results" && results) {
    return <ComplyResultsView results={results} leadId={leadId} />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      {screen !== "q1no" && (
        <div className="mb-8">
          <ComplyProgress percent={SCREEN_PERCENT[screen]} />
        </div>
      )}

      <Card className="p-6 sm:p-8">
        {screen === "q1" && (
          <QuestionScreen title="Does your company manufacture any physical goods?">
            <OptionCard
              selected={answers.manufacturesGoods === true}
              label="Yes"
              onClick={() => {
                setAnswers((a) => ({ ...a, manufacturesGoods: true }));
                setScreen("q2");
              }}
            />
            <OptionCard
              selected={answers.manufacturesGoods === false}
              label="No"
              onClick={() => {
                setAnswers((a) => ({ ...a, manufacturesGoods: false }));
                setScreen("q1no");
              }}
            />
          </QuestionScreen>
        )}

        {screen === "q1no" && (
          <div className="text-center">
            <h2 className="text-lg font-semibold">Not a manufacturer</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Most carbon compliance frameworks apply to manufacturers. You may still have EPR obligations if you
              import or sell packaged goods. Contact us to assess.
            </p>
            <a href="mailto:abhishek@intellocarbon.com" className="mt-6 inline-block">
              <Button variant="secondary">
                <Mail className="h-4 w-4" />
                Contact Us to Assess
              </Button>
            </a>
          </div>
        )}

        {screen === "q2" && (
          <QuestionScreen title="Do you export any goods to the European Union?" onBack={() => back("q1")}>
            <OptionCard
              selected={answers.exportsToEu === "YES"}
              label="Yes"
              onClick={() => {
                setAnswers((a) => ({ ...a, exportsToEu: "YES" }));
                setScreen("q3");
              }}
            />
            <OptionCard
              selected={answers.exportsToEu === "NO"}
              label="No"
              onClick={() => {
                setAnswers((a) => ({ ...a, exportsToEu: "NO", euGoods: [] }));
                setScreen("q4");
              }}
            />
            <OptionCard
              selected={answers.exportsToEu === "PLANNING"}
              label="Planning to in next 12 months"
              onClick={() => {
                setAnswers((a) => ({ ...a, exportsToEu: "PLANNING" }));
                setScreen("q3");
              }}
            />
          </QuestionScreen>
        )}

        {screen === "q3" && (
          <QuestionScreen
            title="Which goods do you export or plan to export to the EU?"
            subtitle="Select all that apply."
            onBack={() => back("q2")}
          >
            {CBAM_GOOD_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                selected={answers.euGoods.includes(o.value)}
                label={o.label}
                onClick={() => toggleEuGood(o.value)}
              />
            ))}
            <Button
              type="button"
              className="mt-2 w-full"
              disabled={answers.euGoods.length === 0}
              onClick={() => setScreen(answers.euGoods.includes("NONE") ? "q4" : "q3b")}
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </QuestionScreen>
        )}

        {screen === "q3b" && (
          <QuestionScreen
            title="What is your estimated annual export quantity to the EU in tonnes?"
            onBack={() => back("q3")}
          >
            {EU_EXPORT_VOLUME_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                selected={answers.euExportVolume === o.value}
                label={o.label}
                onClick={() => {
                  setAnswers((a) => ({ ...a, euExportVolume: o.value }));
                  setScreen("q4");
                }}
              />
            ))}
          </QuestionScreen>
        )}

        {screen === "q4" && (
          <QuestionScreen
            title="Is your facility covered under India's CCTS (Carbon Credit Trading Scheme)?"
            subtitle="CCTS covers aluminium, cement, iron and steel, chlor-alkali, fertilizer, paper and pulp, petrochemical, petroleum refinery, and textile sectors with facilities above BEE thresholds."
            onBack={() => back(answers.exportsToEu === "NO" ? "q2" : answers.euGoods.includes("NONE") ? "q3" : "q3b")}
          >
            {CCTS_STATUS_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                selected={answers.cctsStatus === o.value}
                label={o.label}
                onClick={() => {
                  setAnswers((a) => ({ ...a, cctsStatus: o.value }));
                  setScreen("q5");
                }}
              />
            ))}
          </QuestionScreen>
        )}

        {screen === "q5" && (
          <QuestionScreen
            title="Do you manufacture, import, or sell any of these products in India?"
            subtitle="Select all that apply."
            onBack={() => back("q4")}
          >
            {EPR_PRODUCT_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                selected={answers.eprProducts.includes(o.value)}
                label={o.label}
                onClick={() => toggleEprProduct(o.value)}
              />
            ))}
            <Button
              type="button"
              className="mt-2 w-full"
              disabled={answers.eprProducts.length === 0}
              onClick={() => setModalOpen(true)}
            >
              See My Compliance Map
              <ArrowRight className="h-4 w-4" />
            </Button>
          </QuestionScreen>
        )}
      </Card>

      <LeadCaptureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="See your personalised compliance map"
        description="Enter your details to see which frameworks apply to your business."
        ctaLabel="Show My Compliance Map"
        onSubmit={submitLead}
      />
    </div>
  );
}

function QuestionScreen({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-5 space-y-2.5">{children}</div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
      )}
    </div>
  );
}

function ComplyResultsView({ results, leadId }: { results: ComplyResults; leadId: string | null }) {
  if (results.nonManufacturer) {
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <h2 className="text-lg font-semibold">Not a manufacturer</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Most carbon compliance frameworks apply to manufacturers. You may still have EPR obligations if you
          import or sell packaged goods. Contact us to assess.
        </p>
      </Card>
    );
  }

  if (results.noneApplicable) {
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <h2 className="text-lg font-semibold">You&apos;re in good shape — for now</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Great news — based on your answers, you may not have mandatory carbon compliance obligations right
          now. However, UK CBAM starts in 2027 and India CCTS is expanding. Stay ahead with Intellocarbon
          monitoring.
        </p>
        <Link href="/signup" className="mt-6 inline-block">
          <Button>
            Get Started on Intellocarbon
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-xl font-semibold">Your personalised compliance map</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Based on your answers, here&apos;s what applies to you.</p>

      <div className="mt-6 space-y-4">
        {results.frameworks.map((framework) => (
          <div
            key={framework.key}
            className="rounded-2xl border border-surface-border border-l-4 border-l-teal-500 bg-surface p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">{framework.name}</h3>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-bold",
                  framework.status === "MANDATORY"
                    ? "border-danger/30 bg-danger/10 text-danger"
                    : "border-teal-500/30 bg-teal-500/10 text-teal-500",
                )}
              >
                {framework.status}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{framework.deadline}</p>
            <p className="mt-2 text-sm text-foreground/90">{framework.whatWeDo}</p>
          </div>
        ))}
      </div>

      {results.cbamDeMinimisNote && (
        <div className="mt-4 rounded-xl border border-surface-border bg-surface-raised p-4 text-xs text-muted-foreground">
          Your export volume may be below the 50-tonne threshold. CBAM may not apply. We will confirm this for
          you.
        </div>
      )}

      {results.combinedNote && (
        <div className="mt-4 rounded-xl border border-surface-border bg-surface-raised p-4 text-xs text-muted-foreground">
          You qualify for the Article 9 deduction — your CCTS carbon price paid in India reduces your CBAM
          exposure. Only Intellocarbon calculates this automatically.
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/signup" className="flex-1">
          <Button className="w-full">
            Get Started on Intellocarbon
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        {leadId && (
          <a href={intellocalcApi.complianceMapPdfUrl(leadId)} className="flex-1">
            <Button variant="secondary" className="w-full">
              <Download className="h-4 w-4" />
              Download Your Compliance Map as PDF
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
