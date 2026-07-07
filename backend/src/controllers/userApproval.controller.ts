import { asyncHandler } from "../utils/asyncHandler";
import * as userApprovalService from "../services/userApproval.service";

export const listPendingUsers = asyncHandler(async (_req, res) => {
  const users = await userApprovalService.listPendingUsers();
  res.status(200).json({ users });
});

export const approveUser = asyncHandler(async (req, res) => {
  const user = await userApprovalService.approveUser(req.params.userId);
  res.status(200).json({ user });
});

export const rejectUser = asyncHandler(async (req, res) => {
  const user = await userApprovalService.rejectUser(req.params.userId);
  res.status(200).json({ user });
});
