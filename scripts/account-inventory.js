#!/usr/bin/env node
// READ-ONLY production account inventory. Performs no writes, no deletes.
//
// Lists every Company with its creation date, creator, financial activity, and
// data volume, so a human can decide which accounts are pure test data before
// anything is removed. There is deliberately no delete path in this file.
//
// Usage (from repo root, with the PRODUCTION connection string):
//   DATABASE_URL="postgresql://..." node scripts/account-inventory.js
//   DATABASE_URL="postgresql://..." node scripts/account-inventory.js --json > inventory.json
//
// Requires backend/node_modules (the generated Prisma client), so run it after
// `cd backend && npm install && npx prisma generate` at least once.
const path = require("path");

const { PrismaClient } = require(path.join(__dirname, "..", "backend", "node_modules", "@prisma/client"));

const asJson = process.argv.includes("--json");
const prisma = new PrismaClient();

// A payment only counts as real money if it actually settled: Razorpay rows
// carry status/paidAt (an abandoned checkout leaves a row with neither), and
// manual payments count only while RECORDED — a REVERSED one was undone.
const isCapturedRazorpay = (p) => Boolean(p.paidAt) || String(p.status).toLowerCase() === "captured";

// Host/database only — never the credentials.
const dbLabel = () => {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return `${u.host}${u.pathname}`;
  } catch {
    return "unknown database (DATABASE_URL unset or unparseable)";
  }
};

const looksLikeTestEmail = (email) =>
  /(^|[._+-])(test|demo|dummy|sample|qa|staging|temp)([._+-]|@)|@(example|test|localhost|mailinator|yopmail)\./i.test(
    email,
  );

async function main() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      owner: { select: { id: true, name: true, email: true, createdAt: true, approvalStatus: true, active: true } },
      subscriptions: { include: { payments: true } },
      manualPayments: true,
      facilities: { select: { id: true, name: true, isDraft: true, updatedAt: true } },
      _count: {
        select: {
          facilities: true,
          reports: true,
          documents: true,
          verificationRequests: true,
          auditLogs: true,
          brsrCoreReports: true,
          issbS1S2Reports: true,
          griReports: true,
          csrdReports: true,
          cdpReports: true,
        },
      },
    },
  });

  const rows = [];
  for (const c of companies) {
    const facilityIds = c.facilities.map((f) => f.id);
    const activityDataCount = facilityIds.length
      ? await prisma.activityData.count({ where: { facilityId: { in: facilityIds } } })
      : 0;

    const razorpayPayments = c.subscriptions.flatMap((s) => s.payments);
    const capturedRazorpay = razorpayPayments.filter(isCapturedRazorpay);
    const recordedManual = c.manualPayments.filter((m) => m.status === "RECORDED");

    const razorpayInr = capturedRazorpay.reduce((sum, p) => sum + (p.amountInr ?? 0), 0);
    const manualInr = recordedManual.reduce((sum, m) => sum + (m.amount ?? 0), 0);
    const onboardingInr = c.onboardingFeePaidInr ?? 0;
    const totalInr = razorpayInr + manualInr + onboardingInr;

    // Custom deals are Super Admin-negotiated commercial terms. They aren't
    // money received, but they are a commitment to a named customer, so they
    // disqualify an account from "pure test data" even at zero collected.
    const customDeals = c.subscriptions.filter((s) => s.isCustomDeal);

    const lastFacilityActivity = c.facilities.reduce(
      (latest, f) => (!latest || f.updatedAt > latest ? f.updatedAt : latest),
      null,
    );
    const lastActivity = lastFacilityActivity && lastFacilityActivity > c.updatedAt ? lastFacilityActivity : c.updatedAt;

    const financialReasons = [];
    if (capturedRazorpay.length) financialReasons.push(`${capturedRazorpay.length} captured Razorpay payment(s)`);
    if (recordedManual.length) financialReasons.push(`${recordedManual.length} recorded manual payment(s)`);
    if (onboardingInr > 0) financialReasons.push("onboarding fee collected");
    if (customDeals.length) financialReasons.push(`${customDeals.length} custom deal(s) set`);

    rows.push({
      id: c.id,
      name: c.name,
      sector: c.sector,
      gstin: c.gstin ?? null,
      registrationNumber: c.registrationNumber ?? null,
      createdAt: c.createdAt,
      lastActivity,
      creator: {
        userId: c.owner.id,
        name: c.owner.name,
        email: c.owner.email,
        signedUpAt: c.owner.createdAt,
        approvalStatus: c.owner.approvalStatus,
        active: c.owner.active,
        emailLooksLikeTest: looksLikeTestEmail(c.owner.email),
      },
      // The single flag that decides what a deletion actually does — see the
      // 7-year CBAM retention branch in auth.service.ts deleteMyAccount.
      appliesCbam: c.appliesCbam,
      cbamFrameworks: c.cbamFrameworks,
      financial: {
        hasRealActivity: financialReasons.length > 0,
        reasons: financialReasons,
        totalInr,
        razorpayInr,
        manualInr,
        onboardingFeeInr: onboardingInr,
        abandonedRazorpayRows: razorpayPayments.length - capturedRazorpay.length,
        reversedManualPayments: c.manualPayments.length - recordedManual.length,
        subscriptions: c.subscriptions.map((s) => ({
          tier: s.tier,
          status: s.status,
          isCustomDeal: s.isCustomDeal,
          currentPeriodEnd: s.currentPeriodEnd,
        })),
      },
      data: {
        facilities: c._count.facilities,
        draftFacilities: c.facilities.filter((f) => f.isDraft).length,
        activityData: activityDataCount,
        reports: c._count.reports,
        documents: c._count.documents,
        verificationRequests: c._count.verificationRequests,
        auditLogs: c._count.auditLogs,
        phase2Reports:
          c._count.brsrCoreReports +
          c._count.issbS1S2Reports +
          c._count.griReports +
          c._count.csrdReports +
          c._count.cdpReports,
      },
    });
  }

  // Users with no company at all (verifiers, internal operators, super admins,
  // and abandoned signups) never appear above, but they are accounts too.
  const orphanUsers = await prisma.user.findMany({
    where: { company: null },
    select: { id: true, name: true, email: true, role: true, approvalStatus: true, active: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (asJson) {
    console.log(JSON.stringify({ companies: rows, usersWithoutCompany: orphanUsers }, null, 2));
    return;
  }

  const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
  // Print which database this actually read. The whole point of the report is
  // to decide what to delete in production — running it against localhost by
  // accident and acting on the result would be the worst possible outcome.
  console.log(`\nACCOUNT INVENTORY — ${dbLabel()}`);
  console.log(`${rows.length} compan(ies), ${orphanUsers.length} user(s) with no company\n`);

  for (const r of rows) {
    const money = r.financial.hasRealActivity
      ? `YES — ₹${r.financial.totalInr.toLocaleString("en-IN")} (${r.financial.reasons.join("; ")})`
      : "none — no settled payment, no custom deal";
    console.log(`${r.name}  [${r.id}]`);
    console.log(`  created      ${fmtDate(r.createdAt)}   last activity ${fmtDate(r.lastActivity)}`);
    console.log(
      `  creator      ${r.creator.name} <${r.creator.email}>${r.creator.emailLooksLikeTest ? "  (test-looking email)" : ""}`,
    );
    console.log(`  financial    ${money}`);
    console.log(
      `  cbam gate    appliesCbam=${r.appliesCbam}${r.cbamFrameworks.length ? ` [${r.cbamFrameworks.join(", ")}]` : ""}` +
        `  -> ${r.appliesCbam ? "RETAINED on delete (company survives)" : "fully cascade-deleted"}`,
    );
    console.log(
      `  data         ${r.data.facilities} facilities (${r.data.draftFacilities} draft), ${r.data.activityData} activity rows, ` +
        `${r.data.reports} reports, ${r.data.documents} documents, ${r.data.verificationRequests} verification requests, ` +
        `${r.data.phase2Reports} phase-2 reports, ${r.data.auditLogs} audit logs`,
    );
    console.log("");
  }

  if (orphanUsers.length) {
    console.log("USERS WITH NO COMPANY (verifiers / internal operators / super admins / abandoned signups)\n");
    for (const u of orphanUsers) {
      console.log(
        `  ${fmtDate(u.createdAt)}  ${u.role.padEnd(20)} ${u.email}  ${u.approvalStatus}${u.active ? "" : " (deactivated)"}`,
      );
    }
    console.log("");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
