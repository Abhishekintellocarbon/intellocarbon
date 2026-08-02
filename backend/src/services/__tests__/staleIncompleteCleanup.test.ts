import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SubscriptionStatus, SubscriptionTier } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { deleteStaleIncompleteSubscriptions, STALE_INCOMPLETE_SUBSCRIPTION_HOURS } from "../billing.service";

/**
 * Clears subscriptions left INCOMPLETE by a checkout that never completed.
 * The risk in a scheduled deletion is deleting the wrong thing, so most of
 * these tests assert what it must leave alone.
 */
describe("stale INCOMPLETE subscription cleanup", () => {
  const email = `stale-cleanup-${Date.now()}@example.com`;
  let userId: string;
  let companyId: string;

  const HOUR_MS = 60 * 60 * 1000;
  const agedHours = (h: number) => new Date(Date.now() - h * HOUR_MS);

  const makeSubscription = async (tier: SubscriptionTier, status: SubscriptionStatus, createdAt: Date) =>
    prisma.subscription.create({ data: { companyId, tier, status, createdAt } });

  const survivingIds = async () =>
    (await prisma.subscription.findMany({ where: { companyId }, select: { id: true } })).map((s) => s.id).sort();

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { name: "Stale Cleanup", email, passwordHash: "x", approvalStatus: "APPROVED" },
    });
    userId = user.id;
    const company = await prisma.company.create({
      data: { ownerId: userId, name: "Stale Cleanup Co", sector: "STEEL" },
    });
    companyId = company.id;
  });

  afterEach(async () => {
    await prisma.subscription.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("deletes an INCOMPLETE subscription older than the threshold", async () => {
    await makeSubscription("BRSR_CORE_REPORTING", "INCOMPLETE", agedHours(STALE_INCOMPLETE_SUBSCRIPTION_HOURS + 1));

    const deleted = await deleteStaleIncompleteSubscriptions();

    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await survivingIds()).toEqual([]);
  });

  it("leaves a recent INCOMPLETE alone — a checkout may still be in progress", async () => {
    const fresh = await makeSubscription("BRSR_CORE_REPORTING", "INCOMPLETE", agedHours(1));

    await deleteStaleIncompleteSubscriptions();

    expect(await survivingIds()).toEqual([fresh.id]);
  });

  it("leaves an INCOMPLETE that is only just under the threshold", async () => {
    const borderline = await makeSubscription(
      "CCTS_COMPLIANCE",
      "INCOMPLETE",
      agedHours(STALE_INCOMPLETE_SUBSCRIPTION_HOURS - 1),
    );

    await deleteStaleIncompleteSubscriptions();

    expect(await survivingIds()).toEqual([borderline.id]);
  });

  it("never touches ACTIVE, PAST_DUE or CANCELED, however old", async () => {
    const kept = [
      await makeSubscription("CCTS_COMPLIANCE", "ACTIVE", agedHours(500)),
      await makeSubscription("CBAM_COMPLIANCE", "PAST_DUE", agedHours(500)),
      await makeSubscription("CBAM_PLUS_CCTS", "CANCELED", agedHours(500)),
    ];

    await deleteStaleIncompleteSubscriptions();

    expect(await survivingIds()).toEqual(kept.map((s) => s.id).sort());
  });

  it("removes only the stale row when a company holds a mix", async () => {
    const active = await makeSubscription("CCTS_COMPLIANCE", "ACTIVE", agedHours(500));
    await makeSubscription("BRSR_CORE_REPORTING", "INCOMPLETE", agedHours(48));

    await deleteStaleIncompleteSubscriptions();

    expect(await survivingIds()).toEqual([active.id]);
  });

  it("is a no-op when there is nothing stale", async () => {
    await makeSubscription("CCTS_COMPLIANCE", "ACTIVE", agedHours(500));

    expect(await deleteStaleIncompleteSubscriptions()).toBe(0);
  });

  it("takes any attached payments with it rather than orphaning them", async () => {
    const stale = await makeSubscription("BRSR_CORE_REPORTING", "INCOMPLETE", agedHours(48));
    await prisma.payment.create({
      data: {
        subscriptionId: stale.id,
        razorpayPaymentId: `pay_stale_${Date.now()}`,
        amountInr: 1,
        status: "failed",
      },
    });

    await deleteStaleIncompleteSubscriptions();

    expect(await prisma.payment.count({ where: { subscriptionId: stale.id } })).toBe(0);
  });
});
