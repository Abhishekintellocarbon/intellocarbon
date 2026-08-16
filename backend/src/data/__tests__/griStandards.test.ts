import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  GRI_TOPIC_STANDARDS,
  GRI_UNIVERSAL_DISCLOSURES,
  GRI_MATERIAL_TOPICS_DISCLOSURES,
  GRI_3_3_REQUIREMENTS,
  GRI_TOPIC_CODES,
  GRI_OMISSION_REASONS,
  GRI_TOTAL_TOPIC_DISCLOSURE_COUNT,
  getGriTopic,
  isGriTopicCode,
} from "../griStandards";

/**
 * The registry is the backbone of the whole GRI module — materiality gating,
 * the content index and the "in accordance" evaluation all walk it. Its
 * failure mode is silent: a field name that doesn't exist on the backing
 * Prisma model makes `isDisclosureReported` return false forever, so a
 * disclosure the user actually filled in is reported as omitted and the
 * report is quietly downgraded from "in accordance" to "with reference".
 * Nothing throws. These tests are the only thing that catches it.
 */

// Prisma's DMMF is available without a database connection, so this stays a
// pure unit test.
const MODELS = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));

const scalarFieldNames = (modelName: string): Set<string> => {
  const model = MODELS.get(modelName);
  if (!model) throw new Error(`Prisma model ${modelName} not found`);
  return new Set(model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum").map((f) => f.name));
};

/** Resolves a GriReport relation name (e.g. "emissionsDisclosure") to the model it points at. */
const modelForRelation = (relation: string): string => {
  const griReport = MODELS.get("GriReport");
  if (!griReport) throw new Error("GriReport model not found");
  const field = griReport.fields.find((f) => f.name === relation);
  if (!field) throw new Error(`GriReport has no relation named "${relation}"`);
  return field.type;
};

describe("GRI registry — standard versions", () => {
  // GRI 307 and GRI 419 were withdrawn with the 2021 Universal Standards.
  // Reintroducing either as a Topic Standard would make the content index
  // cite a standard that no longer exists — a false compliance claim.
  it("does not implement the withdrawn GRI 307 or GRI 419 as topic standards", () => {
    expect(GRI_TOPIC_CODES).not.toContain("GRI_307");
    expect(GRI_TOPIC_CODES).not.toContain("GRI_419");
  });

  it("reports compliance with laws and regulations under Disclosure 2-27 instead", () => {
    const disclosure = GRI_UNIVERSAL_DISCLOSURES.find((d) => d.number === "2-27");
    expect(disclosure).toBeDefined();
    expect(disclosure!.fields).toContain("significantFinesCount");
    expect(disclosure!.fields).toContain("nonMonetarySanctionsCount");
  });

  // GRI 101: Biodiversity 2024 replaced GRI 304 for reporting published on or
  // after 1 Jan 2026, which has passed.
  it("implements GRI 101: Biodiversity 2024, not the superseded GRI 304", () => {
    expect(GRI_TOPIC_CODES).toContain("GRI_101");
    expect(GRI_TOPIC_CODES).not.toContain("GRI_304");
    expect(getGriTopic("GRI_101")!.edition).toBe("GRI 101: Biodiversity 2024");
  });

  it("covers GRI 101's eight disclosures including the five direct drivers of biodiversity loss", () => {
    const biodiversity = getGriTopic("GRI_101")!;
    expect(biodiversity.disclosures.map((d) => d.number)).toEqual([
      "101-1",
      "101-2",
      "101-3",
      "101-4",
      "101-5",
      "101-6",
      "101-7",
      "101-8",
    ]);
    const drivers = biodiversity.disclosures.find((d) => d.number === "101-6")!.fields;
    for (const driver of [
      "driverLandUseChange",
      "driverResourceExploitation",
      "driverClimateChange",
      "driverPollution",
      "driverInvasiveSpecies",
    ]) {
      expect(drivers).toContain(driver);
    }
  });

  // Still in force for current reporting periods; GRI 103/102 take over for
  // periods beginning on or after 1 Jan 2027.
  it("still implements GRI 302 and GRI 305, which remain current", () => {
    expect(getGriTopic("GRI_302")!.edition).toBe("GRI 302: Energy 2016");
    expect(getGriTopic("GRI_305")!.edition).toBe("GRI 305: Emissions 2016");
  });

  it("cites a dated edition for every topic standard", () => {
    for (const topic of GRI_TOPIC_STANDARDS) {
      expect(topic.edition, `${topic.code} edition`).toMatch(/^GRI \d+: .+ (20\d{2})$/);
    }
  });
});

describe("GRI registry — completeness", () => {
  it("covers all 30 GRI 2 general disclosures, 2-1 through 2-30", () => {
    expect(GRI_UNIVERSAL_DISCLOSURES).toHaveLength(30);
    expect(GRI_UNIVERSAL_DISCLOSURES.map((d) => d.number)).toEqual(
      Array.from({ length: 30 }, (_, i) => `2-${i + 1}`),
    );
  });

  it("covers GRI 3's three disclosures", () => {
    expect(GRI_MATERIAL_TOPICS_DISCLOSURES.map((d) => d.number)).toEqual(["3-1", "3-2", "3-3"]);
  });

  it("covers all six sub-requirements of Disclosure 3-3", () => {
    expect(GRI_3_3_REQUIREMENTS).toHaveLength(6);
  });

  it("has a unique code per topic and a unique disclosure number within each topic", () => {
    expect(new Set(GRI_TOPIC_CODES).size).toBe(GRI_TOPIC_CODES.length);
    for (const topic of GRI_TOPIC_STANDARDS) {
      const numbers = topic.disclosures.map((d) => d.number);
      expect(new Set(numbers).size, `${topic.code} has duplicate disclosure numbers`).toBe(numbers.length);
    }
  });

  it("numbers every disclosure consistently with its own standard", () => {
    for (const topic of GRI_TOPIC_STANDARDS) {
      const prefix = topic.label.replace("GRI ", "");
      for (const disclosure of topic.disclosures) {
        expect(disclosure.number, `${topic.code} disclosure ${disclosure.number}`).toMatch(
          new RegExp(`^${prefix}-\\d+$`),
        );
      }
    }
  });

  it("gives every disclosure at least one backing field", () => {
    // A disclosure with no fields can never be reported — isDisclosureReported
    // returns false on an empty field list by design.
    for (const topic of GRI_TOPIC_STANDARDS) {
      for (const disclosure of topic.disclosures) {
        expect(disclosure.fields.length, `${topic.code} ${disclosure.number} has no fields`).toBeGreaterThan(0);
      }
    }
    for (const disclosure of GRI_UNIVERSAL_DISCLOSURES) {
      expect(disclosure.fields.length, `${disclosure.number} has no fields`).toBeGreaterThan(0);
    }
  });

  it("exposes a topic disclosure count matching the sum across topics", () => {
    expect(GRI_TOTAL_TOPIC_DISCLOSURE_COUNT).toBe(
      GRI_TOPIC_STANDARDS.reduce((sum, t) => sum + t.disclosures.length, 0),
    );
  });

  it("permits exactly the four omission reasons GRI allows", () => {
    expect([...GRI_OMISSION_REASONS].sort()).toEqual(
      [
        "CONFIDENTIALITY_CONSTRAINTS",
        "INFORMATION_UNAVAILABLE_INCOMPLETE",
        "LEGAL_PROHIBITIONS",
        "NOT_APPLICABLE",
      ].sort(),
    );
  });
});

describe("GRI registry — field names resolve against the Prisma schema", () => {
  it("maps every topic standard to a real GriReport relation", () => {
    for (const topic of GRI_TOPIC_STANDARDS) {
      expect(() => modelForRelation(topic.relation), `${topic.code} relation "${topic.relation}"`).not.toThrow();
    }
  });

  // The regression this whole file exists for: a typo'd field name is
  // invisible at runtime and silently downgrades the compliance claim.
  it("references only fields that exist on each topic's disclosure model", () => {
    const missing: string[] = [];
    for (const topic of GRI_TOPIC_STANDARDS) {
      const fields = scalarFieldNames(modelForRelation(topic.relation));
      for (const disclosure of topic.disclosures) {
        for (const field of disclosure.fields) {
          if (!fields.has(field)) missing.push(`${topic.code} ${disclosure.number}: ${field}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("references only fields that exist on GriUniversalDisclosures", () => {
    const fields = scalarFieldNames("GriUniversalDisclosures");
    const missing: string[] = [];
    for (const disclosure of GRI_UNIVERSAL_DISCLOSURES) {
      for (const field of disclosure.fields) {
        if (!fields.has(field)) missing.push(`${disclosure.number}: ${field}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("references only GRI 3-3 fields that exist on GriMaterialTopic", () => {
    const fields = scalarFieldNames("GriMaterialTopic");
    for (const requirement of GRI_3_3_REQUIREMENTS) {
      expect(fields.has(requirement.field), `GriMaterialTopic.${requirement.field}`).toBe(true);
    }
  });
});

describe("getGriTopic / isGriTopicCode", () => {
  it("resolves a known code", () => {
    expect(getGriTopic("GRI_305")?.title).toBe("Emissions");
    expect(isGriTopicCode("GRI_305")).toBe(true);
  });

  it("rejects an unknown code rather than returning a partial object", () => {
    expect(getGriTopic("GRI_999")).toBeUndefined();
    expect(isGriTopicCode("GRI_999")).toBe(false);
    // Specifically the withdrawn ones, which a caller might reasonably try.
    expect(isGriTopicCode("GRI_307")).toBe(false);
    expect(isGriTopicCode("GRI_304")).toBe(false);
  });
});
