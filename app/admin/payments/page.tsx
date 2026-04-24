"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { DollarSign, Check } from "lucide-react";

interface Teacher {
  id: string;
  display_name: string;
  email: string;
}

interface Payment {
  id: string;
  teacher_id: string;
  teacher_name: string;
  month: string;
  year: number;
  sessions_completed: number;
  rate_per_session: string;
  total_amount: string;
  status: "pending" | "paid";
  created_at: string;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const statusStyle: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-primary/10 text-emerald-primary",
};

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);

  const now = new Date();
  const [genForm, setGenForm] = useState({
    teacher_id: "",
    month: MONTHS[now.getMonth()],
    year: now.getFullYear().toString(),
    rate_per_session: "5.00",
  });

  function authHeaders() {
    const token = localStorage.getItem("accessToken");
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const role = localStorage.getItem("userRole");
    if (!token || (role !== "admin" && role !== "supervisor")) { router.push("/login"); return; }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      api.get("/payments", { headers }),
      api.get("/admin/teachers", { headers }),
    ]).then(([payRes, teachRes]) => {
      setPayments(payRes.data.payments);
      setTeachers(teachRes.data.teachers);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  async function handleGenerate() {
    if (!genForm.teacher_id || !genForm.month || !genForm.year) return;
    setGenerating(true);
    try {
      const res = await api.post("/payments/generate", {
        teacher_id: genForm.teacher_id,
        month: genForm.month,
        year: parseInt(genForm.year),
        rate_per_session: parseFloat(genForm.rate_per_session),
      }, { headers: authHeaders() });
      const teacher = teachers.find(t => t.id === genForm.teacher_id);
      setPayments(prev => [{ ...res.data.payment, teacher_name: teacher?.display_name ?? "" }, ...prev]);
    } catch {
      alert("Failed to generate payment.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkPaid(id: string) {
    setMarking(id);
    try {
      await api.patch(`/payments/${id}/mark-paid`, {}, { headers: authHeaders() });
      setPayments(prev => prev.map(p => p.id === id ? { ...p, status: "paid" } : p));
    } catch {
      alert("Failed to mark as paid.");
    } finally {
      setMarking(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-display text-3xl font-bold text-charcoal mb-2">Teacher Payments</h1>
        <p className="text-charcoal/50 text-sm mb-8">Generate and manage monthly teacher payments</p>

        {/* Generate form */}
        <div className="bg-white rounded-2xl border border-black/5 p-6 mb-8">
          <h2 className="font-display text-lg font-bold text-charcoal mb-4">Generate Monthly Payment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select value={genForm.teacher_id} onChange={e => setGenForm(p => ({ ...p, teacher_id: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30">
              <option value="">Select teacher…</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
            </select>
            <select value={genForm.month} onChange={e => setGenForm(p => ({ ...p, month: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30">
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="number" value={genForm.year} onChange={e => setGenForm(p => ({ ...p, year: e.target.value }))}
              placeholder="Year"
              className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
            <input type="number" step="0.01" value={genForm.rate_per_session} onChange={e => setGenForm(p => ({ ...p, rate_per_session: e.target.value }))}
              placeholder="Rate per session (£)"
              className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
          </div>
          <button onClick={handleGenerate} disabled={generating || !genForm.teacher_id}
            className="mt-4 px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
            {generating ? "Generating…" : "Generate Payment"}
          </button>
        </div>

        {/* Payments list */}
        {payments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30">
            <DollarSign size={32} className="mx-auto mb-3 text-charcoal/20" />
            <p>No payments generated yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-black/5 px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-charcoal text-sm">{p.teacher_name}</p>
                  <p className="text-xs text-charcoal/40 mt-0.5">
                    {p.month} {p.year} · {p.sessions_completed} sessions · £{parseFloat(p.rate_per_session).toFixed(2)}/session
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusStyle[p.status]}`}>{p.status}</span>
                  <p className="font-bold text-charcoal">£{parseFloat(p.total_amount).toFixed(2)}</p>
                  {p.status === "pending" && (
                    <button onClick={() => handleMarkPaid(p.id)} disabled={marking === p.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                      <Check size={12} /> {marking === p.id ? "…" : "Mark Paid"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
