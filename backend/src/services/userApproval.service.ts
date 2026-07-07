import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { sendAccountApprovedEmail, sendAccountRejectedEmail } from "./email.service";

export const listPendingUsers = () =>
  prisma.user.findMany({
    where: { approvalStatus: "PENDING" },
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

const findPendingUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.approvalStatus !== "PENDING") {
    throw AppError.notFound("Pending user not found");
  }
  return user;
};

export const approveUser = async (userId: string) => {
  const user = await findPendingUser(userId);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { approvalStatus: "APPROVED" },
  });

  await sendAccountApprovedEmail(updated.email, updated.name);

  return updated;
};

export const rejectUser = async (userId: string) => {
  const user = await findPendingUser(userId);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { approvalStatus: "REJECTED" },
  });

  await sendAccountRejectedEmail(updated.email, updated.name);

  return updated;
};
