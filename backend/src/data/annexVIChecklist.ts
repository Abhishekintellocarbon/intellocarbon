/**
 * Verifier checklist for issuing a CBAM verification statement — modelled on
 * the verification process/report content requirements in Annex VI of
 * Commission Implementing Regulation (EU) 2023/1773 (CBAM transitional
 * registry and reporting). This is a practical, checkable distillation of
 * that process, not a reproduction of the gazetted text — confirm against
 * the current Annex VI wording before relying on this for a regulatory
 * submission, same convention as the EU default SEE values in
 * cbamReferenceData.ts.
 */

export interface AnnexVIChecklistItem {
  id: string;
  label: string;
  description: string;
}

export const ANNEX_VI_CHECKLIST: AnnexVIChecklistItem[] = [
  {
    id: "installation_boundary",
    label: "Installation and reporting boundary confirmed",
    description: "The facility and reporting period covered by this submission match the declarant's own records.",
  },
  {
    id: "source_streams_identified",
    label: "Source streams and emission sources completely identified",
    description: "All fuel, process material, precursor, and indirect (electricity/steam) sources relevant to this activity are accounted for.",
  },
  {
    id: "monitoring_methodology",
    label: "Monitoring methodology assessed",
    description: "The method used to derive activity data is consistent with the applicable tier requirements and is applied consistently across the period.",
  },
  {
    id: "activity_data_cross_checked",
    label: "Activity data cross-checked against source documents",
    description: "Quantities reported are traceable to metering records, invoices, delivery notes, or other supporting evidence.",
  },
  {
    id: "emission_factors_verified",
    label: "Emission factors and calculation parameters verified",
    description: "Default emission factors are correctly applied, and any manual overrides are supported by documented evidence.",
  },
  {
    id: "data_gaps_addressed",
    label: "Data gaps addressed appropriately",
    description: "Any missing data points are estimated using a conservative, documented method rather than left unaccounted for.",
  },
  {
    id: "uncertainty_materiality",
    label: "Uncertainty and materiality assessed",
    description: "The aggregate effect of assumptions, overrides, and estimations on the reported result is acceptable and does not amount to a material misstatement.",
  },
  {
    id: "site_visit_or_justification",
    label: "Site visit performed, or its absence justified",
    description: "A site visit was conducted, or a documented justification is on file for why a remote/desk-based verification was sufficient.",
  },
  {
    id: "supporting_evidence_reviewed",
    label: "Supporting evidence reviewed",
    description: "Bills, invoices, and other uploaded supporting documents for this submission have been reviewed and found sufficient.",
  },
];

export const ANNEX_VI_CHECKLIST_IDS = ANNEX_VI_CHECKLIST.map((item) => item.id);

export const isAnnexVIChecklistComplete = (checklistState: unknown): boolean => {
  if (typeof checklistState !== "object" || checklistState === null) return false;
  const state = checklistState as Record<string, unknown>;
  return ANNEX_VI_CHECKLIST_IDS.every((id) => state[id] === true);
};
