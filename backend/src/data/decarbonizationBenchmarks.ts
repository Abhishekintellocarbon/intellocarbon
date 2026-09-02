/**
 * Published reference data for the IntelloAdvisor Decarbonization
 * Recommendation Engine.
 *
 * Everything the engine states about the outside world lives here, and nothing
 * here is a working assumption. Each entry carries the publisher, document and
 * as-of date it came from, so a recommendation can cite its own arithmetic all
 * the way down. The engine reads this table; it never hardcodes a figure.
 *
 * READ THIS BEFORE THE ENGINE GOES IN FRONT OF A CUSTOMER
 * ------------------------------------------------------
 * `verification` records whether a value has been checked against its primary
 * source *by a person*. Values marked NEEDS_COMPLIANCE_REVIEW are structurally
 * correct — right shape, right units, right citation target — but their numbers
 * have not been signed off against the actual tariff order or standard. State
 * open-access rules in particular change with every tariff order, and a
 * regulatory figure that is merely plausible is worse than no figure at all in
 * a compliance product.
 *
 * The engine propagates this status into every recommendation it emits (see
 * `citations` on RecommendationCard) precisely so the Phase 3 UI can badge an
 * unreviewed number rather than presenting it with the same authority as the
 * platform's own calculated data.
 */

export type VerificationStatus =
  /** Checked against the primary source by a person, on the date recorded. */
  | "VERIFIED_AGAINST_PRIMARY_SOURCE"
  /** Structurally right, numerically unconfirmed. Must be reviewed before customer display. */
  | "NEEDS_COMPLIANCE_REVIEW";

export type Citation = {
  /** Body that published the figure — CEA, IPCC, MNRE, a state regulator. */
  publisher: string;
  /** The document, precise enough to find: title, order number, table number. */
  document: string;
  /** What in that document the figure is. */
  reference: string;
  /** The edition/vintage the value is drawn from, not the date we read it. */
  asOf: string;
  url?: string;
  verification: VerificationStatus;
};

// ---------------------------------------------------------------------------
// Solar
// ---------------------------------------------------------------------------

/**
 * Annual specific yield of a grid-connected solar PV plant in India, in kWh
 * generated per kWp installed per year.
 *
 * A range, not a point, because it genuinely varies with latitude, tilt,
 * soiling and module technology — publishing a single number here would invent
 * a precision the underlying data does not have. The engine carries the range
 * through to the recommendation's impact range rather than collapsing it to a
 * midpoint.
 *
 * CITATION UPGRADE OUTSTANDING (the figure itself is not in doubt)
 * ---------------------------------------------------------------
 * 1,400–1,600 kWh/kWp/year is directionally supported by current data —
 * Chhattisgarh plants run at roughly 1,450–1,550 kWh/kWp/year — so the range
 * is left as it stands. What is not yet primary-sourced is the citation: it
 * names MNRE/NISE generically rather than a specific published table. Replace
 * it with a direct pointer to MNRE/NISE benchmark performance data or a PVGIS
 * query for the site's coordinates (publisher, table/query and vintage stated)
 * before this value is quoted as a verified benchmark. Until then it keeps
 * NEEDS_COMPLIANCE_REVIEW, which is why the solar card is still badged.
 */
export const SOLAR_SPECIFIC_YIELD_KWH_PER_KWP_YEAR = {
  low: 1400,
  high: 1600,
  citation: {
    publisher: "Ministry of New and Renewable Energy / National Institute of Solar Energy",
    document: "Grid-connected solar PV performance benchmarks for India",
    reference: "Annual specific yield, 1,400–1,600 kWh/kWp/year (CUF approximately 16–18%)",
    asOf: "FY2024-25",
    verification: "NEEDS_COMPLIANCE_REVIEW",
  } satisfies Citation,
};

/**
 * Share of annual grid consumption a rooftop/open-access solar plant is sized
 * to offset, as the two ends of a design range.
 *
 * This is a *stated basis for the arithmetic*, not a claim about what any
 * particular plant should build. The engine says so in the recommendation
 * text: "sized to offset 15%–30% of your annual grid consumption". A customer
 * targeting a different share scales the result linearly, and the output
 * carries the basis so they can.
 */
export const SOLAR_OFFSET_DESIGN_RANGE = { low: 0.15, high: 0.3 };

// ---------------------------------------------------------------------------
// Open access, by state
// ---------------------------------------------------------------------------

export type StateOpenAccessProfile = {
  stateName: string;
  regulator: string;
  /**
   * Minimum contracted/sanctioned load, in kW, at which open access is
   * available to a consumer in this state.
   */
  openAccessMinimumLoadKw: number;
  /** Upper limit on a net-metered connection, where the state sets one. Null when unknown or not applicable. */
  netMeteringCeilingKw: number | null;
  /** Whether the state permits banking of open-access renewable energy. Null when unconfirmed. */
  bankingPermitted: boolean | null;
  /** Anything a customer in this state needs to know that the numbers don't say. */
  notes: string;
  citation: Citation;
};

/**
 * The national floor, applied to any state not in the table below.
 *
 * The binding threshold for *green energy* open access — the only kind this
 * engine ever recommends — is the 100 kW sanctioned load / contracted demand
 * floor set nationally by the Ministry of Power's Green Energy Open Access
 * Rules, 2022. It is national, and a state commission may be more permissive
 * but not less, so an unlisted state still gets a correct, citable eligibility
 * statement rather than silence or a figure borrowed from a neighbouring
 * state's tariff order.
 *
 * This is deliberately *not* the 1 MW threshold of Section 42(2) of the
 * Electricity Act 2003. That one still governs conventional open access; the
 * 2022 Rules lowered the floor to 100 kW for renewable energy specifically,
 * and quoting 1 MW here told consumers between 100 kW and 1 MW that they were
 * ineligible when the Rules make them eligible.
 *
 * The Rules express the floor as sanctioned load / contracted demand of 100 kW
 * and above, which is why the comparison in the solar rule holds whether the
 * bill prints that load in kW or kVA.
 */
export const NATIONAL_OPEN_ACCESS_FLOOR = {
  openAccessMinimumLoadKw: 100,
  citation: {
    publisher: "Ministry of Power, Government of India",
    document: "Green Energy Open Access Rules, 2022 (Ministry of Power)",
    reference:
      "Rule 4 — green energy open access available to consumers with a sanctioned load / contracted demand of 100 kW and above (aggregated across multiple connections in the same distribution licensee's area), with no load limit for captive consumers",
    asOf: "2022, as amended",
    verification: "VERIFIED_AGAINST_PRIMARY_SOURCE",
  } satisfies Citation,
};

/**
 * Per-state open-access profiles, keyed by the state name as stored on
 * Facility.state.
 *
 * Chhattisgarh is the first entry because it is the first state the product
 * needs, not because the engine is built around it. Adding a state is adding a
 * row here — no rule, threshold or branch in the engine mentions any state by
 * name, and `resolveOpenAccessProfile` below falls back to the national floor
 * for anything unlisted.
 */
export const STATE_OPEN_ACCESS_PROFILES: Record<string, StateOpenAccessProfile> = {
  Chhattisgarh: {
    stateName: "Chhattisgarh",
    regulator: "Chhattisgarh State Electricity Regulatory Commission (CSERC)",
    // The eligibility floor is the national 100 kW one from the Green Energy
    // Open Access Rules, 2022, not a CSERC-set threshold. CSERC's role on this
    // card is the surcharges in `notes`, which genuinely are state-set.
    openAccessMinimumLoadKw: 100,
    netMeteringCeilingKw: null,
    bankingPermitted: null,
    notes:
      "Eligibility is set nationally at 100 kW by the Green Energy Open Access Rules, 2022. What CSERC sets is the cost: open-access supply in Chhattisgarh attracts wheeling charges, a cross-subsidy surcharge and an additional surcharge, each revised by CSERC tariff order. Those charges decide whether open access is economic and are not modelled here — this recommendation addresses the emissions effect only.",
    citation: {
      publisher: "Ministry of Power, Government of India",
      document: "Green Energy Open Access Rules, 2022 (Ministry of Power)",
      reference:
        "Rule 4 — green energy open access threshold of 100 kW sanctioned load / contracted demand, applicable in Chhattisgarh as a national floor. Wheeling, cross-subsidy and additional surcharges are set separately by CSERC tariff order and are not quoted on this card.",
      asOf: "2022, as amended",
      verification: "VERIFIED_AGAINST_PRIMARY_SOURCE",
    },
  },
};

export type ResolvedOpenAccess = {
  stateName: string | null;
  regulator: string | null;
  openAccessMinimumLoadKw: number;
  netMeteringCeilingKw: number | null;
  bankingPermitted: boolean | null;
  notes: string;
  citation: Citation;
  /** False when the state is absent from the table and the national floor was used. */
  stateSpecific: boolean;
};

export const resolveOpenAccessProfile = (state: string | null | undefined): ResolvedOpenAccess => {
  const profile = state ? STATE_OPEN_ACCESS_PROFILES[state] : undefined;
  if (profile) {
    return {
      stateName: profile.stateName,
      regulator: profile.regulator,
      openAccessMinimumLoadKw: profile.openAccessMinimumLoadKw,
      netMeteringCeilingKw: profile.netMeteringCeilingKw,
      bankingPermitted: profile.bankingPermitted,
      notes: profile.notes,
      citation: profile.citation,
      stateSpecific: true,
    };
  }
  return {
    stateName: state ?? null,
    regulator: null,
    openAccessMinimumLoadKw: NATIONAL_OPEN_ACCESS_FLOOR.openAccessMinimumLoadKw,
    netMeteringCeilingKw: null,
    bankingPermitted: null,
    notes: state
      ? `State-specific open-access rules for ${state} are not yet in the reference table, so the national threshold under the Green Energy Open Access Rules, 2022 is shown instead. Wheeling charges, cross-subsidy surcharge and banking rules are set by the state regulator and must be confirmed there.`
      : "No state is recorded for this facility, so the national threshold under the Green Energy Open Access Rules, 2022 is shown. State rules may be more permissive.",
    citation: NATIONAL_OPEN_ACCESS_FLOOR.citation,
    stateSpecific: false,
  };
};

// ---------------------------------------------------------------------------
// Fuel switching
// ---------------------------------------------------------------------------

/**
 * Combustion CO2 emission factors per unit of energy, in tCO2 per TJ.
 *
 * Per-TJ rather than per-tonne because that is the only basis on which two
 * different fuels can be compared: swapping a tonne of coal for a tonne of gas
 * is not a like-for-like substitution, swapping a TJ for a TJ is. These are the
 * same IPCC defaults the platform's own FUEL_LIBRARY is derived from — see the
 * per-unit factors and their NCV working in data/emissionFactors.ts — restated
 * here on the energy basis the fuel-switch arithmetic needs.
 */
export const FUEL_CO2_PER_TJ = {
  bituminousCoal: {
    value: 94.6,
    label: "Bituminous coal / pet coke",
    citation: {
      publisher: "IPCC",
      document: "2006 IPCC Guidelines for National GHG Inventories, Volume 2 (Energy)",
      reference: "Table 2.2 — default CO2 emission factor, other bituminous coal, 94,600 kg CO2/TJ",
      asOf: "2006",
      verification: "VERIFIED_AGAINST_PRIMARY_SOURCE",
    } satisfies Citation,
  },
  naturalGas: {
    value: 56.1,
    label: "Natural gas",
    citation: {
      publisher: "IPCC",
      document: "2006 IPCC Guidelines for National GHG Inventories, Volume 2 (Energy)",
      reference: "Table 2.2 — default CO2 emission factor, natural gas, 56,100 kg CO2/TJ",
      asOf: "2006",
      verification: "VERIFIED_AGAINST_PRIMARY_SOURCE",
    } satisfies Citation,
  },
  /**
   * Biomass zero-rating under CBAM is CONDITIONAL, not automatic.
   *
   * Biogenic CO2 may be counted at zero in the embedded-emissions total only
   * where the biomass meets the sustainability and greenhouse-gas-saving
   * criteria of Article 29 of Directive (EU) 2018/2001 (RED II), evidenced by
   * valid certification covering the fuel *at the time it was consumed*.
   * Biomass that does not meet those criteria, or that meets them but cannot be
   * evidenced for the consumption period, is treated as fossil: the full
   * emission factor applies and none of the substituted share is removed.
   *
   * Both numbers therefore live here. `value` is the certified case; consuming
   * code that quotes it must state the condition alongside it, and must never
   * present zero as the treatment biomass gets by default.
   */
  biomass: {
    /** Certified case only: RED II Article 29 criteria met and evidenced for the consumption period. */
    value: 0,
    /**
     * Uncertified case: RED II criteria not met, or met but not evidenced at
     * the time of consumption. The fuel is then accounted as fossil at its full
     * IPCC default factor — which is *above* bituminous coal per unit of
     * energy, so uncertified biomass blending does not reduce the CBAM number
     * and can increase it.
     */
    uncertifiedValue: 112,
    label: "Biomass (biogenic — zero-rated only where RED II criteria are met and certified)",
    /** Stated verbatim on any card that quotes the zero. */
    zeroRatingCondition:
      "meets the RED II sustainability and greenhouse-gas-saving criteria and holds valid certification covering the fuel at the time of consumption",
    citation: {
      publisher: "European Commission",
      document:
        "Regulation (EU) 2023/956 (CBAM), Implementing Regulation (EU) 2023/1773 and Directive (EU) 2018/2001 (RED II), Article 29",
      reference:
        "Biogenic CO2 counts as zero in embedded emissions only where the biomass meets the RED II Article 29 sustainability and GHG-saving criteria with valid certification at the time of consumption; otherwise the full fossil emission factor applies. Uncertified value is the IPCC 2006 Guidelines Vol. 2 Table 2.2 default for wood/wood waste, 112,000 kg CO2/TJ.",
      asOf: "2023 (CBAM); RED II as amended",
      verification: "VERIFIED_AGAINST_PRIMARY_SOURCE",
    } satisfies Citation,
  },
};

/**
 * The substitution level the fuel-switch impact range is quoted at.
 *
 * Quoting an impact requires quoting a substitution share, and there is no
 * published figure for "how much coal an Indian steel plant will actually
 * displace" — that is a commercial decision, not a benchmark. So the engine
 * states the basis out loud ("per 10% of coal energy substituted") instead of
 * burying an adoption assumption inside a headline number. The effect is
 * linear, and the output says so, so a customer evaluating 25% can scale it.
 */
export const FUEL_SWITCH_QUOTED_SUBSTITUTION_SHARE = 0.1;

/** Fuel keys in the platform's FUEL_LIBRARY that are solid coal or coke. */
export const SOLID_FOSSIL_FUEL_KEYS = ["COKING_COAL", "PCI_COAL", "METALLURGICAL_COKE"] as const;
