import { describe, it, expect, vi, beforeEach } from "vitest";

const customersAll = vi.fn();

// Credentials must be present before config/razorpay is imported, or the
// check short-circuits as unconfigured.
vi.hoisted(() => {
  process.env.NODE_ENV = "production";
  process.env.RAZORPAY_KEY_ID = "rzp_test_stub";
  process.env.RAZORPAY_KEY_SECRET = "stubsecret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_stub";
  process.env.RAZORPAY_PLAN_ID_CCTS_COMPLIANCE = "plan_1";
  process.env.RAZORPAY_PLAN_ID_CBAM_COMPLIANCE = "plan_2";
  process.env.RAZORPAY_PLAN_ID_CBAM_PLUS_CCTS = "plan_3";
  process.env.RAZORPAY_PLAN_ID_BRSR_CORE = "plan_4";
});

// Stub the SDK itself so no network call is made.
vi.mock("razorpay", () => ({
  default: class {
    customers = { all: (...a: unknown[]) => customersAll(...a) };
  },
}));

import { verifyRazorpayCredentials } from "../../config/razorpay";

/**
 * The check exists to fail a deploy on credentials Razorpay rejects, rather
 * than letting a customer's first checkout discover it. The distinction that
 * matters is between "they said no" and "we couldn't ask" — the second must
 * never block a release, or a Razorpay outage becomes our outage.
 */
describe("Razorpay boot-time credential check (production)", () => {
  beforeEach(() => {
    customersAll.mockReset();
  });

  it("resolves when the API accepts the credentials", async () => {
    customersAll.mockResolvedValue({ entity: "collection", count: 0, items: [] });
    await expect(verifyRazorpayCredentials()).resolves.toBeUndefined();
    expect(customersAll).toHaveBeenCalledOnce();
  });

  it("throws on a 401, so the deploy fails instead of shipping broken billing", async () => {
    customersAll.mockRejectedValue({ statusCode: 401, error: { description: "Authentication failed" } });
    await expect(verifyRazorpayCredentials()).rejects.toThrow(/rejected the configured credentials/i);
  });

  it("does NOT throw when Razorpay is unreachable — their outage must not block our deploys", async () => {
    customersAll.mockRejectedValue(Object.assign(new Error("getaddrinfo ENOTFOUND api.razorpay.com"), { code: "ENOTFOUND" }));
    await expect(verifyRazorpayCredentials()).resolves.toBeUndefined();
  });

  it("does NOT throw on a Razorpay 5xx — that isn't a statement about our credentials", async () => {
    customersAll.mockRejectedValue({ statusCode: 502, error: { description: "Bad gateway" } });
    await expect(verifyRazorpayCredentials()).resolves.toBeUndefined();
  });

  it("does NOT throw on a 429 rate limit", async () => {
    customersAll.mockRejectedValue({ statusCode: 429, error: { description: "Too many requests" } });
    await expect(verifyRazorpayCredentials()).resolves.toBeUndefined();
  });

  it("reads at most one customer and creates nothing", async () => {
    customersAll.mockResolvedValue({ items: [] });
    await verifyRazorpayCredentials();
    expect(customersAll).toHaveBeenCalledWith({ count: 1 });
  });
});
