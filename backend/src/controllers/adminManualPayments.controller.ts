import { asyncHandler } from "../utils/asyncHandler";
import * as manualPaymentService from "../services/manualPayment.service";

export const list = asyncHandler(async (req, res) => {
  const { companyId, status, from, to } = req.query as Record<string, string | undefined>;
  const payments = await manualPaymentService.listManualPayments({
    companyId,
    status: status === "RECORDED" || status === "REVERSED" ? status : undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  res.status(200).json({ payments });
});

export const record = asyncHandler(async (req, res) => {
  const payment = await manualPaymentService.recordManualPayment(req.body, req.user!.sub);
  res.status(201).json({ payment });
});

export const reverse = asyncHandler(async (req, res) => {
  const payment = await manualPaymentService.reverseManualPayment(req.params.id, req.body.reason, req.user!.sub);
  res.status(200).json({ payment });
});

export const getSubscriptionState = asyncHandler(async (req, res) => {
  const state = await manualPaymentService.getCompanySubscriptionState(req.params.companyId);
  res.status(200).json(state);
});

export const setCustomSubscription = asyncHandler(async (req, res) => {
  const subscription = await manualPaymentService.setCustomSubscription(req.params.companyId, req.body, req.user!.sub);
  res.status(200).json({ subscription });
});
