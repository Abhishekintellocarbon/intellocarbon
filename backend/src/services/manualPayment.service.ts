import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { getPlan } from "../data/plans";
import { activateSubscriptionForTier, markSubscriptionPastDue } from "./billing.service";
import { logCompanyAudit } from "./auditLog.service";
import type { RecordManualPaymentInput, SetCustomSubscriptionInput } from "../validators/manualPayment.validators";

export const recordManualPayment = async (input: RecordManualPaymentInput, recordedByUserId: string) => {
  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw AppError.notFound("Company not found");

  const payment = await prisma.manualPayment.create({
    data: {
      companyId: input.companyId,
      tier: input.tier,
      amount: input.amount,
      paymentMode: input.paymentMode,
      referenceNumber: input.referenceNumber || null,
      paymentDate: input.paymentDate,
      validUntil: input.validUntil,
      notes: input.notes || null,
      recordedByUserId,
    },
  });

  // Same activation path the Razorpay webhook uses — a manual payment is
  // just another way a subscription becomes ACTIVE.
  await activateSubscriptionForTier(input.companyId, input.tier, input.validUntil);

  logCompanyAudit(
    input.companyId,
    "MANUAL_PAYMENT_RECORDED",
    `₹${input.amount} recorded via ${input.paymentMode} for ${getPlan(input.tier).name}, valid until ${input.validUntil.toLocaleDateString("en-IN")}`,
    recordedByUserId,
  );

  return payment;
};

export const reverseManualPayment = async (id: string, reason: string, reversedByUserId: string) => {
  const payment = await prisma.manualPayment.findUnique({ where: { id } });
  if (!payment) throw AppError.notFound("Manual payment not found");
  if (payment.status === "REVERSED") {
    throw AppError.badRequest("This payment has already been reversed", "ALREADY_REVERSED");
  }

  const reversed = await prisma.manualPayment.update({
    where: { id },
    data: {
      status: "REVERSED",
      reversedAt: new Date(),
      reversedByUserId,
      reversalReason: reason,
    },
  });

  // Same PAST_DUE path the Razorpay webhook's payment.failed handler uses.
  const subscription = await prisma.subscription.findUnique({
    where: { companyId_tier: { companyId: payment.companyId, tier: payment.tier } },
  });
  if (subscription) {
    await markSubscriptionPastDue(subscription.id);
  }

  logCompanyAudit(
    payment.companyId,
    "MANUAL_PAYMENT_REVERSED",
    `Payment of ₹${payment.amount} for ${getPlan(payment.tier).name} reversed: ${reason}`,
    reversedByUserId,
  );

  return reversed;
};

export const listManualPayments = async (filters: {
  companyId?: string;
  status?: "RECORDED" | "REVERSED";
  from?: Date;
  to?: Date;
}) => {
  return prisma.manualPayment.findMany({
    where: {
      companyId: filters.companyId,
      status: filters.status,
      paymentDate:
        filters.from || filters.to
          ? {
              gte: filters.from,
              lte: filters.to,
            }
          : undefined,
    },
    include: {
      company: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true, email: true } },
      reversedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const setCustomSubscription = async (
  companyId: string,
  input: SetCustomSubscriptionInput,
  setByUserId: string,
) => {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw AppError.notFound("Company not found");

  const subscription = await prisma.subscription.upsert({
    where: { companyId_tier: { companyId, tier: input.tier } },
    create: {
      companyId,
      tier: input.tier,
      isCustomDeal: input.isCustomDeal,
      customAmount: input.isCustomDeal ? input.customAmount : null,
      customFacilityCount: input.isCustomDeal ? input.customFacilityCount : null,
      customValidFrom: input.isCustomDeal ? input.customValidFrom : null,
      customValidUntil: input.isCustomDeal ? input.customValidUntil : null,
      customSetByUserId: setByUserId,
      customDealNotes: input.isCustomDeal ? input.customDealNotes || null : null,
    },
    update: {
      isCustomDeal: input.isCustomDeal,
      customAmount: input.isCustomDeal ? input.customAmount : null,
      customFacilityCount: input.isCustomDeal ? input.customFacilityCount : null,
      customValidFrom: input.isCustomDeal ? input.customValidFrom : null,
      customValidUntil: input.isCustomDeal ? input.customValidUntil : null,
      customSetByUserId: setByUserId,
      customDealNotes: input.isCustomDeal ? input.customDealNotes || null : null,
    },
  });

  logCompanyAudit(
    companyId,
    input.isCustomDeal ? "CUSTOM_SUBSCRIPTION_SET" : "CUSTOM_SUBSCRIPTION_REVERTED",
    input.isCustomDeal
      ? `Custom deal set for ${getPlan(input.tier).name}${input.customAmount ? ` — ₹${input.customAmount}` : ""}${input.customFacilityCount ? `, ${input.customFacilityCount} facilities` : ""}`
      : `Reverted to standard pricing for ${getPlan(input.tier).name}`,
    setByUserId,
  );

  return subscription;
};

export const getCompanySubscriptionState = async (companyId: string) => {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw AppError.notFound("Company not found");

  const subscriptions = await prisma.subscription.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });

  return { subscriptions };
};
