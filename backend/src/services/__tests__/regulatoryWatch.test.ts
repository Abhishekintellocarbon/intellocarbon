import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../../config/prisma";
import { seedRegulatoryWatch, listWatchEntries } from "../regulatoryWatch.service";
import { REGULATORY_WATCH_SEEDS, isWatchEntryStale, WATCH_STALE_AFTER_DAYS } from "../../data/regulatoryWatch";

/**
 * A regulatory watch list nobody has checked is worse than no list, because it
 * looks current. The properties worth protecting are therefore about staleness
 * and about not clobbering a Super Admin's own edits on redeploy — not about
 * the seed content, which is explicitly a starting point.
 */

const seedTitles = REGULATORY_WATCH_SEEDS.map((s) => s.title);

afterAll(async () => {
  await prisma.regulatoryWatchEntry.deleteMany({ where: { title: { in: seedTitles } } });
  await prisma.regulatoryWatchEntry.deleteMany({ where: { title: "Edited by a human" } });
});

describe("staleness", () => {
  it("flags an entry older than the window", () => {
    const old = new Date(Date.now() - (WATCH_STALE_AFTER_DAYS + 1) * 86_400_000);
    expect(isWatchEntryStale(old)).toBe(true);
  });

  it("does not flag a recently verified entry", () => {
    expect(isWatchEntryStale(new Date())).toBe(false);
  });

  /**
   * The point of separating lastVerifiedAt from updatedAt: a seeded entry has
   * been written but never checked, so it must present as needing a look
   * rather than as freshly confirmed.
   */
  it("seeds entries already past the staleness window", async () => {
    await prisma.regulatoryWatchEntry.deleteMany({ where: { title: { in: seedTitles } } });
    await seedRegulatoryWatch();
    const entries = await listWatchEntries();
    const seeded = entries.filter((e) => seedTitles.includes(e.title));
    expect(seeded).toHaveLength(REGULATORY_WATCH_SEEDS.length);
    expect(seeded.every((e) => e.stale)).toBe(true);
  });
});

describe("seeding", () => {
  it("is idempotent", async () => {
    await prisma.regulatoryWatchEntry.deleteMany({ where: { title: { in: seedTitles } } });
    const first = await seedRegulatoryWatch();
    const second = await seedRegulatoryWatch();
    expect(first).toBe(REGULATORY_WATCH_SEEDS.length);
    expect(second).toBe(0);
  });

  /**
   * A Super Admin who corrects a summary or moves a status must not have that
   * overwritten by the next deploy running the seed again.
   */
  it("never overwrites an entry that already exists", async () => {
    await prisma.regulatoryWatchEntry.deleteMany({ where: { title: { in: seedTitles } } });
    await seedRegulatoryWatch();

    const target = await prisma.regulatoryWatchEntry.findFirstOrThrow({ where: { title: seedTitles[0] } });
    await prisma.regulatoryWatchEntry.update({
      where: { id: target.id },
      data: { summary: "Corrected by a Super Admin", status: "IN_FORCE", lastVerifiedAt: new Date() },
    });

    await seedRegulatoryWatch();

    const after = await prisma.regulatoryWatchEntry.findFirstOrThrow({ where: { id: target.id } });
    expect(after.summary).toBe("Corrected by a Super Admin");
    expect(after.status).toBe("IN_FORCE");
  });

  it("covers the four regimes asked for", () => {
    expect(REGULATORY_WATCH_SEEDS.map((s) => s.regime).sort()).toEqual([
      "ARTICLE_6_PACM",
      "DIGITAL_PRODUCT_PASSPORT",
      "ICVCM",
      "TNFD",
    ]);
  });

  /**
   * Seed summaries describe what a regime IS, not what it requires by when.
   * Deadlines and thresholds move, and none of these has been checked against
   * the source — so each says so rather than presenting as verified.
   */
  it("marks every seed as needing confirmation and cites a source", () => {
    expect(REGULATORY_WATCH_SEEDS.every((s) => /confirm the current position against the source/i.test(s.summary))).toBe(true);
    expect(REGULATORY_WATCH_SEEDS.every((s) => s.sourceUrl.startsWith("https://"))).toBe(true);
  });
});

describe("listing", () => {
  it("puts the least recently verified first", async () => {
    await prisma.regulatoryWatchEntry.deleteMany({ where: { title: { in: seedTitles } } });
    await seedRegulatoryWatch();
    await prisma.regulatoryWatchEntry.create({
      data: {
        regime: "OTHER",
        title: "Edited by a human",
        summary: "Checked today.",
        status: "MONITORING",
        lastVerifiedAt: new Date(),
      },
    });

    const entries = await listWatchEntries();
    const titles = entries.map((e) => e.title);
    // The freshly verified entry sorts last; stale seeds surface at the top.
    expect(titles.at(-1)).toBe("Edited by a human");
    expect(entries.at(-1)?.stale).toBe(false);
  });
});
