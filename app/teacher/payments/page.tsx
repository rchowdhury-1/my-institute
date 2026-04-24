"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { DollarSign } from "lucide-react";

interface Payment {
  id: string;
  month: string;
  year: number;
  sessions_completed: number;
  rate_per_session: string;
  total_amount: string;
  status: "pending" | "paid";
  created_at: string;
}

const statusStyle: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-primary/10 text-emerald-primary",
};

export default function TeacherPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    api.get("/payments", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setPayments(res.data.payments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const totalEarned = payments.filter(p => p.status === "paid").reduce((s, p) => s + parseFloat(p.total_amount), 0);
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + parseFloat(p.total_amount), 0);

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-display text-3xl font-bold text-charcoal mb-2">My Payments</h1>
        <p className="text-charcoal/50 text-sm mb-8">Monthly payment summary from completed sessions</p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-black/5 p-5 text-center">
            <p className="font-display text-3xl font-bold text-emerald-primary">£{totalEarned.toFixed(2)}</p>
            <p className="text-charcoal/50 text-xs mt-1">Total Paid</p>
          </div>
          <div className="bg-white rounded-2xl border border-black/5 p-5 text-center">
            <p className="font-display text-3xl font-bold text-amber-600">£{totalPending.toFixed(2)}</p>
            <p className="text-charcoal/50 text-xs mt-1">Pending</p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30">
            <DollarSign size={32} className="mx-auto mb-3 text-charcoal/20" />
            <p>No payment records yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-black/5 px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-charcoal text-sm">{p.month} {p.year}</p>
                  <p className="text-xs text-charcoal/40 mt-0.5">
                    {p.sessions_completed} session{p.sessions_completed !== 1 ? "s" : ""} · £{parseFloat(p.rate_per_session).toFixed(2)}/session
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusStyle[p.status]}`}>{p.status}</span>
                  <p className="font-bold text-charcoal">£{parseFloat(p.total_amount).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
