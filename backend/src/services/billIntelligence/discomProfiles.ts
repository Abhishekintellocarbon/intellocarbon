/**
 * Registry of Indian electricity distribution utilities, used to read the
 * discom and its state off a bill by exact alias lookup.
 *
 * This is a lookup table, not an inference. A bill whose text contains none of
 * these aliases yields a null discom and a null state, which the UI surfaces
 * as "enter manually" — it never falls back to guessing a state from an
 * address, a consumer-number prefix, or anything else that would put a value
 * on screen that isn't printed on the document.
 *
 * `state` is the state the utility distributes in, which is a property of the
 * utility itself and therefore safe to read off a confirmed match. It is not
 * derived from the bill's address block.
 */

export type DiscomProfile = {
  /** Stable registry key, stored on BillExtraction.discomCode. */
  code: string;
  /** Display name, stored on BillExtraction.discomName. */
  name: string;
  state: string;
  /**
   * Uppercase alias strings matched as whole words against the normalised bill
   * text. Longest match across the whole registry wins, so "MADHYA GUJARAT
   * VIJ" beats a bare "GUJARAT" belonging to a different utility.
   */
  aliases: string[];
  /**
   * Aliases short enough to appear by coincidence ("BEST", "CESC", "APDCL").
   * When set, a match only counts if a utility word appears within
   * AMBIGUOUS_CONTEXT_WINDOW characters of it — see matchDiscom.
   */
  ambiguousAliases?: string[];
};

export const DISCOM_PROFILES: DiscomProfile[] = [
  // --- Maharashtra ---
  {
    code: "MSEDCL",
    name: "Maharashtra State Electricity Distribution Co. Ltd. (MSEDCL)",
    state: "Maharashtra",
    aliases: ["MSEDCL", "MAHAVITARAN", "MAHARASHTRA STATE ELECTRICITY DISTRIBUTION"],
  },
  { code: "TATA_POWER_MUMBAI", name: "Tata Power Company Ltd. (Mumbai)", state: "Maharashtra", aliases: ["TATA POWER COMPANY", "TATA POWER MUMBAI"] },
  { code: "ADANI_MUMBAI", name: "Adani Electricity Mumbai Ltd.", state: "Maharashtra", aliases: ["ADANI ELECTRICITY MUMBAI", "ADANI ELECTRICITY"] },
  { code: "BEST", name: "Brihanmumbai Electric Supply & Transport (BEST)", state: "Maharashtra", aliases: ["BRIHANMUMBAI ELECTRIC SUPPLY"], ambiguousAliases: ["BEST"] },

  // --- Tamil Nadu ---
  {
    code: "TANGEDCO",
    name: "Tamil Nadu Generation and Distribution Corporation (TANGEDCO)",
    state: "Tamil Nadu",
    aliases: ["TANGEDCO", "TAMIL NADU GENERATION AND DISTRIBUTION", "TAMILNADU ELECTRICITY BOARD"],
    ambiguousAliases: ["TNEB"],
  },

  // --- Karnataka ---
  { code: "BESCOM", name: "Bangalore Electricity Supply Company (BESCOM)", state: "Karnataka", aliases: ["BESCOM", "BANGALORE ELECTRICITY SUPPLY"] },
  { code: "MESCOM", name: "Mangalore Electricity Supply Company (MESCOM)", state: "Karnataka", aliases: ["MESCOM", "MANGALORE ELECTRICITY SUPPLY"] },
  { code: "HESCOM", name: "Hubli Electricity Supply Company (HESCOM)", state: "Karnataka", aliases: ["HESCOM", "HUBLI ELECTRICITY SUPPLY"] },
  { code: "GESCOM", name: "Gulbarga Electricity Supply Company (GESCOM)", state: "Karnataka", aliases: ["GESCOM", "GULBARGA ELECTRICITY SUPPLY"] },
  { code: "CESC_MYSORE", name: "Chamundeshwari Electricity Supply Corporation (CESC Mysore)", state: "Karnataka", aliases: ["CHAMUNDESHWARI ELECTRICITY SUPPLY"] },

  // --- Gujarat ---
  { code: "DGVCL", name: "Dakshin Gujarat Vij Company Ltd. (DGVCL)", state: "Gujarat", aliases: ["DGVCL", "DAKSHIN GUJARAT VIJ"] },
  { code: "MGVCL", name: "Madhya Gujarat Vij Company Ltd. (MGVCL)", state: "Gujarat", aliases: ["MGVCL", "MADHYA GUJARAT VIJ"] },
  { code: "PGVCL", name: "Paschim Gujarat Vij Company Ltd. (PGVCL)", state: "Gujarat", aliases: ["PGVCL", "PASCHIM GUJARAT VIJ"] },
  { code: "UGVCL", name: "Uttar Gujarat Vij Company Ltd. (UGVCL)", state: "Gujarat", aliases: ["UGVCL", "UTTAR GUJARAT VIJ"] },
  { code: "TORRENT_POWER", name: "Torrent Power Ltd.", state: "Gujarat", aliases: ["TORRENT POWER"] },

  // --- Uttar Pradesh ---
  { code: "UPPCL", name: "Uttar Pradesh Power Corporation Ltd. (UPPCL)", state: "Uttar Pradesh", aliases: ["UPPCL", "UTTAR PRADESH POWER CORPORATION"] },
  { code: "PVVNL", name: "Paschimanchal Vidyut Vitran Nigam (PVVNL)", state: "Uttar Pradesh", aliases: ["PVVNL", "PASCHIMANCHAL VIDYUT VITRAN"] },
  { code: "MVVNL", name: "Madhyanchal Vidyut Vitran Nigam (MVVNL)", state: "Uttar Pradesh", aliases: ["MVVNL", "MADHYANCHAL VIDYUT VITRAN"] },
  { code: "DVVNL", name: "Dakshinanchal Vidyut Vitran Nigam (DVVNL)", state: "Uttar Pradesh", aliases: ["DVVNL", "DAKSHINANCHAL VIDYUT VITRAN"] },
  { code: "PUVVNL", name: "Purvanchal Vidyut Vitran Nigam (PuVVNL)", state: "Uttar Pradesh", aliases: ["PUVVNL", "PURVANCHAL VIDYUT VITRAN"] },

  // --- Rajasthan ---
  { code: "JVVNL", name: "Jaipur Vidyut Vitran Nigam (JVVNL)", state: "Rajasthan", aliases: ["JVVNL", "JAIPUR VIDYUT VITRAN"] },
  { code: "AVVNL", name: "Ajmer Vidyut Vitran Nigam (AVVNL)", state: "Rajasthan", aliases: ["AVVNL", "AJMER VIDYUT VITRAN"] },
  { code: "JDVVNL", name: "Jodhpur Vidyut Vitran Nigam (JdVVNL)", state: "Rajasthan", aliases: ["JDVVNL", "JODHPUR VIDYUT VITRAN"] },

  // --- Delhi ---
  { code: "TPDDL", name: "Tata Power Delhi Distribution Ltd. (TPDDL)", state: "Delhi", aliases: ["TPDDL", "TATA POWER DELHI DISTRIBUTION", "NORTH DELHI POWER"] },
  { code: "BRPL", name: "BSES Rajdhani Power Ltd. (BRPL)", state: "Delhi", aliases: ["BSES RAJDHANI", "BRPL"] },
  { code: "BYPL", name: "BSES Yamuna Power Ltd. (BYPL)", state: "Delhi", aliases: ["BSES YAMUNA", "BYPL"] },

  // --- Telangana / Andhra Pradesh ---
  { code: "TGSPDCL", name: "Southern Power Distribution Company of Telangana (TGSPDCL)", state: "Telangana", aliases: ["TGSPDCL", "TSSPDCL", "SOUTHERN POWER DISTRIBUTION COMPANY OF TELANGANA"] },
  { code: "TGNPDCL", name: "Northern Power Distribution Company of Telangana (TGNPDCL)", state: "Telangana", aliases: ["TGNPDCL", "TSNPDCL", "NORTHERN POWER DISTRIBUTION COMPANY OF TELANGANA"] },
  { code: "APSPDCL", name: "Southern Power Distribution Company of Andhra Pradesh (APSPDCL)", state: "Andhra Pradesh", aliases: ["APSPDCL", "SOUTHERN POWER DISTRIBUTION COMPANY OF ANDHRA"] },
  { code: "APEPDCL", name: "Eastern Power Distribution Company of Andhra Pradesh (APEPDCL)", state: "Andhra Pradesh", aliases: ["APEPDCL", "EASTERN POWER DISTRIBUTION COMPANY OF ANDHRA"] },

  // --- Punjab / Haryana / Himachal / Uttarakhand / J&K ---
  { code: "PSPCL", name: "Punjab State Power Corporation Ltd. (PSPCL)", state: "Punjab", aliases: ["PSPCL", "PUNJAB STATE POWER CORPORATION"] },
  { code: "UHBVN", name: "Uttar Haryana Bijli Vitran Nigam (UHBVN)", state: "Haryana", aliases: ["UHBVN", "UTTAR HARYANA BIJLI VITRAN"] },
  { code: "DHBVN", name: "Dakshin Haryana Bijli Vitran Nigam (DHBVN)", state: "Haryana", aliases: ["DHBVN", "DAKSHIN HARYANA BIJLI VITRAN"] },
  { code: "HPSEBL", name: "Himachal Pradesh State Electricity Board Ltd. (HPSEBL)", state: "Himachal Pradesh", aliases: ["HPSEBL", "HIMACHAL PRADESH STATE ELECTRICITY BOARD"] },
  { code: "UPCL", name: "Uttarakhand Power Corporation Ltd. (UPCL)", state: "Uttarakhand", aliases: ["UTTARAKHAND POWER CORPORATION"] },
  { code: "JKPDD", name: "Jammu & Kashmir Power Development Department (JKPDD)", state: "Jammu & Kashmir", aliases: ["JKPDD", "JAMMU AND KASHMIR POWER DEVELOPMENT", "KASHMIR POWER DISTRIBUTION"] },

  // --- East / Central ---
  { code: "WBSEDCL", name: "West Bengal State Electricity Distribution Co. Ltd. (WBSEDCL)", state: "West Bengal", aliases: ["WBSEDCL", "WEST BENGAL STATE ELECTRICITY DISTRIBUTION"] },
  { code: "CESC_KOLKATA", name: "CESC Ltd. (Kolkata)", state: "West Bengal", aliases: ["CESC LIMITED", "CESC KOLKATA"], ambiguousAliases: ["CESC"] },
  { code: "KSEB", name: "Kerala State Electricity Board (KSEB)", state: "Kerala", aliases: ["KSEB", "KERALA STATE ELECTRICITY BOARD"] },
  { code: "MPPKVVCL", name: "Madhya Pradesh Poorv/Madhya/Paschim Kshetra Vidyut Vitaran", state: "Madhya Pradesh", aliases: ["MPPKVVCL", "MPMKVVCL", "MPPKVVCL", "KSHETRA VIDYUT VITARAN", "MADHYA PRADESH PASCHIM KSHETRA", "MADHYA PRADESH POORV KSHETRA", "MADHYA PRADESH MADHYA KSHETRA"] },
  { code: "CSPDCL", name: "Chhattisgarh State Power Distribution Co. Ltd. (CSPDCL)", state: "Chhattisgarh", aliases: ["CSPDCL", "CHHATTISGARH STATE POWER DISTRIBUTION"] },
  { code: "JBVNL", name: "Jharkhand Bijli Vitran Nigam Ltd. (JBVNL)", state: "Jharkhand", aliases: ["JBVNL", "JHARKHAND BIJLI VITRAN"] },
  { code: "NBPDCL", name: "North Bihar Power Distribution Co. Ltd. (NBPDCL)", state: "Bihar", aliases: ["NBPDCL", "NORTH BIHAR POWER DISTRIBUTION"] },
  { code: "SBPDCL", name: "South Bihar Power Distribution Co. Ltd. (SBPDCL)", state: "Bihar", aliases: ["SBPDCL", "SOUTH BIHAR POWER DISTRIBUTION"] },
  { code: "TPCODL", name: "TP Central Odisha Distribution Ltd. (TPCODL)", state: "Odisha", aliases: ["TPCODL", "TP CENTRAL ODISHA DISTRIBUTION"] },
  { code: "TPWODL", name: "TP Western Odisha Distribution Ltd. (TPWODL)", state: "Odisha", aliases: ["TPWODL", "TP WESTERN ODISHA DISTRIBUTION"] },
  { code: "TPNODL", name: "TP Northern Odisha Distribution Ltd. (TPNODL)", state: "Odisha", aliases: ["TPNODL", "TP NORTHERN ODISHA DISTRIBUTION"] },
  { code: "TPSODL", name: "TP Southern Odisha Distribution Ltd. (TPSODL)", state: "Odisha", aliases: ["TPSODL", "TP SOUTHERN ODISHA DISTRIBUTION"] },
  { code: "APDCL", name: "Assam Power Distribution Company Ltd. (APDCL)", state: "Assam", aliases: ["ASSAM POWER DISTRIBUTION"], ambiguousAliases: ["APDCL"] },
];

/** Characters either side of an ambiguous alias that are searched for a utility word. */
const AMBIGUOUS_CONTEXT_WINDOW = 60;
const UTILITY_CONTEXT = /\b(ELECTRIC|ELECTRICITY|POWER|SUPPLY|UNDERTAKING|VIDYUT|VIJ|BIJLI|DISCOM|DISTRIBUTION)\b/;

/** Whole-word index of `needle` in `haystack`, or -1. Both must already be uppercase. */
const wholeWordIndexOf = (haystack: string, needle: string): number => {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return -1;
    const before = at === 0 ? " " : haystack[at - 1];
    const after = at + needle.length >= haystack.length ? " " : haystack[at + needle.length];
    if (!/[A-Z0-9]/.test(before) && !/[A-Z0-9]/.test(after)) return at;
    from = at + 1;
  }
};

export type DiscomMatch = {
  profile: DiscomProfile;
  /** The alias that actually matched, for the provenance trail. */
  matchedAlias: string;
  /** Ambiguous aliases only count with nearby utility context, so they rank lower. */
  confidence: "HIGH" | "MEDIUM";
};

/**
 * Longest-alias-wins lookup over the whole registry.
 *
 * Longest rather than first because several utilities share a state prefix —
 * a bill naming "MADHYA GUJARAT VIJ COMPANY" must resolve to MGVCL and not to
 * whichever Gujarat utility happens to sit earlier in the array.
 *
 * Returns null when nothing matches, and null is a first-class outcome here:
 * a discom this registry has never seen is a manual-entry case, not a reason
 * to pick the closest-looking name.
 */
export const matchDiscom = (normalisedUpperText: string): DiscomMatch | null => {
  const candidates: Array<DiscomMatch & { length: number }> = [];

  for (const profile of DISCOM_PROFILES) {
    for (const alias of profile.aliases) {
      if (wholeWordIndexOf(normalisedUpperText, alias) !== -1) {
        candidates.push({ profile, matchedAlias: alias, confidence: "HIGH", length: alias.length });
      }
    }
    for (const alias of profile.ambiguousAliases ?? []) {
      const at = wholeWordIndexOf(normalisedUpperText, alias);
      if (at === -1) continue;
      const window = normalisedUpperText.slice(
        Math.max(0, at - AMBIGUOUS_CONTEXT_WINDOW),
        at + alias.length + AMBIGUOUS_CONTEXT_WINDOW,
      );
      // Strip the alias itself before looking for context, so "TATA POWER" style
      // aliases can't satisfy their own context requirement.
      const withoutAlias = window.replace(alias, " ");
      if (UTILITY_CONTEXT.test(withoutAlias)) {
        candidates.push({ profile, matchedAlias: alias, confidence: "MEDIUM", length: alias.length });
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.length - a.length);
  const best = candidates[0];

  // Two different utilities matched aliases of the same length — there is no
  // principled way to choose, so report nothing rather than pick one.
  const tied = candidates.filter((c) => c.length === best.length);
  if (new Set(tied.map((c) => c.profile.code)).size > 1) return null;

  return { profile: best.profile, matchedAlias: best.matchedAlias, confidence: best.confidence };
};
