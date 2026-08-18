import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { REGULATORY_WATCH_SEEDS, isWatchEntryStale } from "../data/regulatoryWatch";

/**
 * Super Admin regulatory watch. Internal only — nothing here reaches a
 * customer surface.
 */

export const listWatchEntries = async (now: Date = new Date()) => {
  const entries = await prisma.regulatoryWatchEntry.findMany({
    // Least recently verified first: the list's job is to surface what has
    // gone stale, not to look tidy.
    orderBy: [{ lastVerifiedAt: "asc" }],
  });
  return entries.map((entry) => ({ ...entry, stale: isWatchEntryStale(entry.lastVerifiedAt, now) }));
};

export interface WatchEntryInput {
  regime: "ICVCM" | "ARTICLE_6_PACM" | "DIGITAL_PRODUCT_PASSPORT" | "TNFD" | "OTHER";
  title: string;
  summary: string;
  status?: "MONITORING" | "DRAFT_PUBLISHED" | "ADOPTED" | "IN_FORCE" | "SUPERSEDED";
  sourceUrl?: string | null;
  nextMilestone?: string | null;
  lastVerifiedAt?: Date;
}

const toData = (input: WatchEntryInput) => ({
  regime: input.regime,
  title: input.title,
  summary: input.summary,
  status: input.status ?? ("MONITORING" as const),
  sourceUrl: input.sourceUrl || null,
  nextMilestone: input.nextMilestone || null,
  // Editing an entry is the act of verifying it, so this defaults to now
  // rather than being left for the admin to remember.
  lastVerifiedAt: input.lastVerifiedAt ?? new Date(),
});

export const createWatchEntry = (input: WatchEntryInput) =>
  prisma.regulatoryWatchEntry.create({ data: toData(input) });

export const updateWatchEntry = async (id: string, input: WatchEntryInput) => {
  const existing = await prisma.regulatoryWatchEntry.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Watch entry not found");
  return prisma.regulatoryWatchEntry.update({ where: { id }, data: toData(input) });
};

export const deleteWatchEntry = async (id: string) => {
  const existing = await prisma.regulatoryWatchEntry.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Watch entry not found");
  await prisma.regulatoryWatchEntry.delete({ where: { id } });
};

/**
 * Seeds the starting entries.
 *
 * Idempotent on title, and it never touches an entry that already exists —
 * a Super Admin who has corrected a summary or moved a status must not have
 * that overwritten by a redeploy. Returns how many were created so the caller
 * can tell a fresh seed from a no-op.
 */
export const seedRegulatoryWatch = async (now: Date = new Date()): Promise<number> => {
  let created = 0;
  for (const seed of REGULATORY_WATCH_SEEDS) {
    const existing = await prisma.regulatoryWatchEntry.findFirst({ where: { title: seed.title } });
    if (existing) continue;
    await prisma.regulatoryWatchEntry.create({
      data: {
        regime: seed.regime,
        title: seed.title,
        summary: seed.summary,
        sourceUrl: seed.sourceUrl,
        nextMilestone: seed.nextMilestone,
        status: "MONITORING",
        // Seeded, not verified. Backdated past the staleness window so a fresh
        // seed shows as needing a check rather than as freshly confirmed —
        // nobody has read the source yet.
        lastVerifiedAt: new Date(now.getTime() - 400 * 86_400_000),
      },
    });
    created += 1;
  }
  return created;
};
