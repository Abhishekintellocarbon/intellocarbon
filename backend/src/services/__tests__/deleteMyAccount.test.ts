import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "../../config/prisma";
import { deleteMyAccount } from "../auth.service";
import { hashPassword } from "../../utils/password";

/**
 * Account deletion, exercised against the dev database in the same
 * integration style as scope3Relevance.test.ts.
 *
 * Two behaviours matter here and neither had coverage before:
 *  - the CBAM retention branch (appliesCbam decides whether the company is
 *    erased or kept whole), and
 *  - atomicity: the company delete and the user anonymisation are one unit,
 *    so a failure part-way cannot leave a company erased while its owner
 *    still holds a working password and their real email address.
 */
describe("deleteMyAccount", () => {
  const PASSWORD = "CorrectHorse!42";
  const created: { userIds: string[]; companyIds: string[] } = { userIds: [], companyIds: [] };

  const makeAccount = async (opts: { appliesCbam: boolean; label: string }) => {
    const email = `delete-account-${opts.label}-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        name: "Delete Account Test",
        email,
        passwordHash: await hashPassword(PASSWORD),
        approvalStatus: "APPROVED",
      },
    });
    const company = await prisma.company.create({
      data: {
        ownerId: user.id,
        name: `Delete Account Test Co (${opts.label})`,
        sector: "STEEL",
        appliesCbam: opts.appliesCbam,
        cbamFrameworks: opts.appliesCbam ? ["EU_CBAM"] : [],
      },
    });
    created.userIds.push(user.id);
    created.companyIds.push(company.id);
    return { user, company, email };
  };

  afterEach(async () => {
    // Companies first, then users — never rely on the User -> Company cascade
    // for cleanup here, since this suite is specifically about that boundary.
    await prisma.company.deleteMany({ where: { id: { in: created.companyIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    created.userIds.length = 0;
    created.companyIds.length = 0;
  });

  it("erases a non-CBAM company outright and anonymises the owner", async () => {
    const { user, company, email } = await makeAccount({ appliesCbam: false, label: "nocbam" });

    const result = await deleteMyAccount(user.id, PASSWORD);

    expect(result.companyDataRetainedForCompliance).toBe(false);
    expect(await prisma.company.findUnique({ where: { id: company.id } })).toBeNull();

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after).not.toBeNull();
    expect(after!.email).toBe(`deleted-${user.id}@deleted.intellocarbon.invalid`);
    expect(after!.email).not.toBe(email);
    expect(after!.name).toBe("Deleted user");
    expect(after!.active).toBe(false);
    expect(after!.passwordHash).not.toBe(user.passwordHash);
  });

  it("keeps a CBAM company whole under the 7-year hold, anonymising only the owner", async () => {
    const { user, company } = await makeAccount({ appliesCbam: true, label: "cbam" });

    const result = await deleteMyAccount(user.id, PASSWORD);

    expect(result.companyDataRetainedForCompliance).toBe(true);
    const survivingCompany = await prisma.company.findUnique({ where: { id: company.id } });
    expect(survivingCompany).not.toBeNull();
    expect(survivingCompany!.name).toBe(company.name);

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after!.email).toBe(`deleted-${user.id}@deleted.intellocarbon.invalid`);
    expect(after!.active).toBe(false);
  });

  it("rejects a wrong password without touching the company", async () => {
    const { user, company } = await makeAccount({ appliesCbam: false, label: "badpw" });

    await expect(deleteMyAccount(user.id, "WrongPassword!1")).rejects.toThrow();

    expect(await prisma.company.findUnique({ where: { id: company.id } })).not.toBeNull();
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after!.active).toBe(true);
  });

  it("rolls the company deletion back if the user anonymisation fails", async () => {
    const { user, company, email } = await makeAccount({ appliesCbam: false, label: "atomic" });

    // Force the final step to fail: squat on the exact anonymised address this
    // user is about to be renamed to, so `user.update` hits the unique email
    // constraint. Before company.delete() was moved inside the transaction,
    // this left the company erased and the user still logging in with their
    // real email — precisely the state being guarded against.
    const squatter = await prisma.user.create({
      data: {
        name: "Squatter",
        email: `deleted-${user.id}@deleted.intellocarbon.invalid`,
        passwordHash: await hashPassword(PASSWORD),
        approvalStatus: "APPROVED",
      },
    });
    created.userIds.push(squatter.id);

    await expect(deleteMyAccount(user.id, PASSWORD)).rejects.toThrow();

    expect(await prisma.company.findUnique({ where: { id: company.id } })).not.toBeNull();
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after!.email).toBe(email);
    expect(after!.active).toBe(true);
    expect(after!.passwordHash).toBe(user.passwordHash);
  });
});
