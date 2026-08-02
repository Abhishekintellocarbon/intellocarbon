import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "../../config/prisma";
import { activateSubscriptionForTier, createCheckout } from "../billing.service";

/**
 * The ESG Disclosure Bundle is sold *alongside* CBAM/CCTS, not instead of it,
 * while CCTS + CBAM genuinely merge into the combined tier. The billing page
 * previously labelled every non-active plan "Switch plan" whenever any
 * subscription was active, which described the merge behaviour for a plan
 * that doesn't merge. These tests pin the actual backend behaviour the label
 * is supposed to describe.
 *
 * Runs against the dev database in dev-bypass mode (no Razorpay credentials
 * locally), which exercises the same findMergeCandidate branch that decides
 * merge-vs-stack before any Razorpay call is made.
 */
describe("subscription stacking vs merging", () => {
  const email = `stacking-test-${Date.now()}@example.com`;
  let userId: string;
  let companyId: string;

  // Sorted in JS, not SQL: Postgres orders an enum by its declaration order,
  // which would make these assertions depend on the order tiers happen to be
  // declared in schema.prisma.
  const activeTiers = async () =>
    (await prisma.subscription.findMany({ where: { companyId, status: "ACTIVE" } })).map((s) => s.tier).sort();

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { name: "Stacking Test", email, passwordHash: "x", approvalStatus: "APPROVED" },
    });
    userId = user.id;
    const company = await prisma.company.create({
      data: { ownerId: userId, name: "Stacking Test Co", sector: "STEEL" },
    });
    companyId = company.id;
  });

  afterEach(async () => {
    await prisma.subscription.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("adds the ESG bundle alongside an active CBAM + CCTS rather than replacing it", async () => {
    await activateSubscriptionForTier(companyId, "CBAM_PLUS_CCTS", new Date(Date.now() + 30 * 864e5));
    expect(await activeTiers()).toEqual(["CBAM_PLUS_CCTS"]);

    await createCheckout(companyId, "BRSR_CORE_REPORTING", 1);

    // Two independent active subscriptions — the compliance plan is untouched.
    expect(await activeTiers()).toEqual(["BRSR_CORE_REPORTING", "CBAM_PLUS_CCTS"]);
  });

  it("adds a compliance plan alongside an active ESG bundle, in either order", async () => {
    await activateSubscriptionForTier(companyId, "BRSR_CORE_REPORTING", new Date(Date.now() + 30 * 864e5));

    await createCheckout(companyId, "CCTS_COMPLIANCE", 1);

    expect(await activeTiers()).toEqual(["BRSR_CORE_REPORTING", "CCTS_COMPLIANCE"]);
  });

  it("still merges CCTS + CBAM into the combined tier, cancelling the originals", async () => {
    await activateSubscriptionForTier(companyId, "CCTS_COMPLIANCE", new Date(Date.now() + 30 * 864e5));

    await createCheckout(companyId, "CBAM_COMPLIANCE", 1);

    // This is the one case where "Switch plan" is the honest label.
    expect(await activeTiers()).toEqual(["CBAM_PLUS_CCTS"]);
    const ccts = await prisma.subscription.findFirst({ where: { companyId, tier: "CCTS_COMPLIANCE" } });
    expect(ccts?.status).toBe("CANCELED");
  });

  it("leaves an active ESG bundle alone while CCTS and CBAM merge around it", async () => {
    await activateSubscriptionForTier(companyId, "BRSR_CORE_REPORTING", new Date(Date.now() + 30 * 864e5));
    await activateSubscriptionForTier(companyId, "CCTS_COMPLIANCE", new Date(Date.now() + 30 * 864e5));

    await createCheckout(companyId, "CBAM_COMPLIANCE", 1);

    expect(await activeTiers()).toEqual(["BRSR_CORE_REPORTING", "CBAM_PLUS_CCTS"]);
  });
});
