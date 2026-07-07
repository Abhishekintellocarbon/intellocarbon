import type { Metadata } from "next";
import { PendingApprovalContent } from "@/components/auth/pending-approval-content";

export const metadata: Metadata = { title: "Account under review — Intellocarbon" };

export default function PendingApprovalPage() {
  return <PendingApprovalContent />;
}
