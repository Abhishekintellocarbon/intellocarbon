"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminApi, type PendingUser } from "@/lib/api";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function AdminApprovalsContent() {
  const [users, setUsers] = useState<PendingUser[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    adminApi
      .listPendingUsers()
      .then(({ users }) => setUsers(users))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const decide = async (userId: string, action: "approve" | "reject") => {
    setActioningId(userId);
    try {
      await (action === "approve" ? adminApi.approveUser(userId) : adminApi.rejectUser(userId));
      setUsers((prev) => prev?.filter((u) => u.id !== userId) ?? null);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mt-6 text-2xl font-semibold">Pending Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          New signups wait here until you approve or reject them.
        </p>

        <Card className="mt-6 overflow-x-auto p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
            </div>
          ) : !users || users.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No accounts waiting on review.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Signed up</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-surface-border last:border-b-0">
                    <td className="px-5 py-3 font-medium text-foreground">{user.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-5 py-3 text-muted-foreground">{user.companyName ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{user.role}</td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(user.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          isLoading={actioningId === user.id}
                          onClick={() => decide(user.id, "approve")}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          isLoading={actioningId === user.id}
                          onClick={() => decide(user.id, "reject")}
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </main>
  );
}

export default function AdminApprovalsPage() {
  return <AdminApprovalsContent />;
}
