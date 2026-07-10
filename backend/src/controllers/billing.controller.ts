import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import * as billingService from "../services/billing.service";
import * as companyService from "../services/company.service";
import { PLANS, COMBINATION_RULES } from "../data/plans";

export const getPlans = asyncHandler(async (_req, res) => {
  res.status(200).json({ plans: Object.values(PLANS), combinationRules: COMBINATION_RULES });
});

export const getSubscription = asyncHandler(async (req, res) => {
  const company = await companyService.requireMyCompany(req.user!.sub);
  const data = await billingService.getSubscriptions(company.id);
  res.status(200).json(data);
});

export const createCheckout = asyncHandler(async (req, res) => {
  const company = await companyService.requireMyCompany(req.user!.sub);
  const result = await billingService.createCheckout(company.id, req.body.tier);
  res.status(200).json(result);
});

export const cancelSubscription = asyncHandler(async (req, res) => {
  const company = await companyService.requireMyCompany(req.user!.sub);
  const subscription = await billingService.cancelSubscription(company.id, req.body.tier);
  res.status(200).json({ subscription });
});

export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.rawBody ?? "";

  if (typeof signature !== "string" || !billingService.verifyWebhookSignature(rawBody, signature)) {
    throw AppError.unauthorized("Invalid webhook signature", "INVALID_WEBHOOK_SIGNATURE");
  }

  await billingService.handleWebhookEvent(req.body);
  res.status(200).json({ received: true });
});
