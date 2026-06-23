"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { ChevronLeft, ChevronRight, Banknote } from "lucide-react";

interface TeacherSalary {
  teacher_id: string;
  display_name: string;
  pay_rate_per_hour: string | null;
  pay_currency: string;
  completed_sessions: number;
  total_minutes: number;
  total_hours: number;
  salary: number | null;
  no_show_sessions: number;
  teacher_cancelled_sessions: number;
  cancelled_sessions: number;
  rescheduled_sessions: number;
}

function getMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(str: string) {
  const [y, m] = str.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function currencySymbol(c: string) {
  return c === "GBP" ? "£" : c === "USD" ? "$" : c === "EUR" ? "€" : c === "EGP" ? "EGP " : c + " ";
}

export default function SalariesPage() {
  const router = useRouter();
  const [month, setMonth] = useState(getMonthStr(new Date()));
  const [teachers, setTeachers] = useState<TeacherSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState({ rate: "", currency: "GBP" });
  const [rateSaving, setRateSaving] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    if (role !== "admin" && role !== "supervisor") {
      router.push("/login");
      return;
    }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/admin/teacher-hours?month=${month}`)
      .then((res) => {
        setTeachers(res.data.teachers);
        setError("");
      })
      .catch(() => setError("Failed to load salary data"))
      .finally(() => setLoading(false));
  }, [month]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta);
    setMonth(getMonthStr(d));
  };

  function openRateEditor(t: TeacherSalary) {
    setEditingRate(t.teacher_id);
    setRateForm({
      rate: t.pay_rate_per_hour ? String(parseFloat(t.pay_rate_per_hour)) : "",
      currency: t.pay_currency || "GBP",
    });
  }

  async function saveRate(teacherId: string) {
    if (!rateForm.rate || isNaN(parseFloat(rateForm.rate))) return;
    setRateSaving(true);
    try {
      await api.patch(`/admin/teachers/${teacherId}/pay-rate`, {
        pay_rate_per_hour: parseFloat(rateForm.rate),
        pay_currency: rateForm.currency,
      });
      // Refresh data
      const res = await api.get(`/admin/teacher-hours?month=${month}`);
      setTeachers(res.data.teachers);
      setEditingRate(null);
    } catch {
      alert("Failed to update pay rate.");
    } finally {
      setRateSaving(false);
    }
  }

  const totalSalary = teachers.reduce((sum, t) => sum + (t.salary || 0), 0);
  const totalHours = teachers.reduce((sum, t) => sum + t.total_hours, 0);
  const hasActivity = teachers.some(
    (t) => t.completed_sessions > 0 || t.no_show_sessions > 0 || t.teacher_cancelled_sessions > 0
  );

  return (
    <main className="min-h-screen bg-cream pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-charcoal mb-1">Teacher Salaries</h1>
          <p className="text-charcoal/50 text-sm">Monthly teaching hours and salary calculation.</p>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => shiftMonth(-1)}
            className="p-2 rounded-lg border border-black/10 hover:bg-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="font-display text-lg font-semibold text-charcoal min-w-[160px] text-center">
            {formatMonth(month)}
          </span>
          <button onClick={() => shiftMonth(1)}
            className="p-2 rounded-lg border border-black/10 hover:bg-white transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm mb-6">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-20 text-charcoal/40">Loading…</div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-20 text-charcoal/40">
            No active teachers found.
          </div>
        ) : (
          <>
            {/* Summary bar — only when there's teaching activity */}
            {hasActivity && (
            <div className="bg-white rounded-2xl border border-black/5 p-5 mb-6 flex items-center justify-between">
              <div>
                <span className="text-charcoal/50 text-sm">Total across all teachers</span>
                <div className="flex items-baseline gap-4 mt-1">
                  <span className="font-display text-2xl font-bold text-emerald-primary">
                    {totalSalary > 0 ? `£${totalSalary.toFixed(2)}` : `${Math.round(totalHours * 10) / 10}h`}
                  </span>
                  <span className="text-charcoal/40 text-sm">
                    {Math.round(totalHours * 10) / 10} hours · {teachers.reduce((s, t) => s + t.completed_sessions, 0)} sessions
                  </span>
                </div>
              </div>
              <Banknote size={28} className="text-emerald-primary/30" />
            </div>
            )}

            {/* Teacher rows */}
            <div className="space-y-3">
              {teachers.map((t) => (
                <div key={t.teacher_id} className="bg-white rounded-2xl border border-black/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-charcoal">{t.display_name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm flex-wrap">
                        <span className="text-charcoal/50">{t.completed_sessions} attended</span>
                        <span className="text-charcoal/50">{t.total_hours}h</span>
                        {t.no_show_sessions > 0 && (
                          <span className="text-orange-500">{t.no_show_sessions} no-show{t.no_show_sessions !== 1 ? "s" : ""}</span>
                        )}
                        {t.teacher_cancelled_sessions > 0 && (
                          <span className="text-red-400">{t.teacher_cancelled_sessions} teacher cancel</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {t.pay_rate_per_hour ? (
                        <>
                          <p className="font-display text-2xl font-bold text-emerald-primary">
                            {currencySymbol(t.pay_currency)}{t.salary?.toFixed(2) ?? "0.00"}
                          </p>
                          <button
                            onClick={() => openRateEditor(t)}
                            className="text-charcoal/30 text-xs hover:text-charcoal/60 transition-colors"
                          >
                            {currencySymbol(t.pay_currency)}{parseFloat(t.pay_rate_per_hour).toFixed(2)}/hr
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openRateEditor(t)}
                          className="px-3 py-1.5 rounded-full border border-amber-300 text-amber-600 text-xs font-medium hover:bg-amber-50 transition-colors"
                        >
                          Set pay rate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline rate editor */}
                  {editingRate === t.teacher_id && (
                    <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-2">
                      <select
                        value={rateForm.currency}
                        onChange={(e) => setRateForm(p => ({ ...p, currency: e.target.value }))}
                        className="px-2 py-1.5 rounded-lg border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                      >
                        <option value="GBP">GBP (£)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="EGP">EGP</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.50"
                        value={rateForm.rate}
                        onChange={(e) => setRateForm(p => ({ ...p, rate: e.target.value }))}
                        placeholder="Rate per hour"
                        className="w-24 px-2 py-1.5 rounded-lg border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                      />
                      <span className="text-charcoal/40 text-xs">/hr</span>
                      <button
                        onClick={() => saveRate(t.teacher_id)}
                        disabled={rateSaving || !rateForm.rate}
                        className="px-3 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                      >
                        {rateSaving ? "…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingRate(null)}
                        className="px-3 py-1.5 rounded-full border border-black/10 text-charcoal/40 text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-charcoal/30 text-xs mt-6 text-center">
              Salary = hours attended × pay rate. No-shows and teacher cancellations shown for context.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
