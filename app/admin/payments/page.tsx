"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { DollarSign, Check, Plus } from "lucide-react";

interface Teacher {
  id: string;
  display_name: string;
  email: string;
}

interface Student {
  id: string;
  display_name: string;
  email: string;
}

interface TeacherPayment {
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

interface StudentPayment {
  id: string;
  student_id: string;
  student_name: string;
  amount: string;
  currency: string;
  payment_method?: string;
  notes?: string;
  logged_by_name?: string;
  created_at: string;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const statusStyle: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-primary/10 text-emerald-primary",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"teacher" | "student">("teacher");

  // teacher payments
  const [teacherPayments, setTeacherPayments] = useState<TeacherPayment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [generating, setGenerating] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);

  // student payments
  const [studentPayments, setStudentPayments] = useState<StudentPayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [studentForm, setStudentForm] = useState({ student_id: "", amount: "", currency: "GBP", payment_method: "", notes: "" });
  const [loggingPayment, setLoggingPayment] = useState(false);

  const [loading, setLoading] = useState(true);

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
      api.get("/admin/payments/student", { headers }),
      api.get("/admin/students", { headers }),
    ]).then(([payRes, teachRes, sPayRes, studRes]) => {
      setTeacherPayments(payRes.data.payments);
      setTeachers(teachRes.data.teachers);
      setStudentPayments(sPayRes.data.payments ?? []);
      setStudents(studRes.data.students ?? []);
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
      setTeacherPayments(prev => [{ ...res.data.payment, teacher_name: teacher?.display_name ?? "" }, ...prev]);
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
      setTeacherPayments(prev => prev.map(p => p.id === id ? { ...p, status: "paid" } : p));
    } catch {
      alert("Failed to mark as paid.");
    } finally {
      setMarking(null);
    }
  }

  async function handleLogStudentPayment() {
    if (!studentForm.student_id || !studentForm.amount) return;
    setLoggingPayment(true);
    try {
      const res = await api.post("/admin/payments/student", {
        student_id: studentForm.student_id,
        amount: parseFloat(studentForm.amount),
        currency: studentForm.currency || "GBP",
        payment_method: studentForm.payment_method || undefined,
        notes: studentForm.notes || undefined,
      }, { headers: authHeaders() });
      const student = students.find(s => s.id === studentForm.student_id);
      setStudentPayments(prev => [{ ...res.data.payment, student_name: student?.display_name ?? "" }, ...prev]);
      setStudentForm({ student_id: "", amount: "", currency: "GBP", payment_method: "", notes: "" });
      setShowStudentForm(false);
    } catch {
      alert("Failed to log payment.");
    } finally {
      setLoggingPayment(false);
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
        <h1 className="font-display text-3xl font-bold text-charcoal mb-2">Payments</h1>
        <p className="text-charcoal/50 text-sm mb-8">Manage teacher and student payments</p>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-full p-1 border border-black/5 mb-8 w-fit">
          {(["teacher", "student"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all capitalize ${
                tab === t ? "bg-emerald-primary text-white" : "text-charcoal/60 hover:text-charcoal"
              }`}
            >
              {t === "teacher" ? "Teacher Payments" : "Student Payments"}
            </button>
          ))}
        </div>

        {/* ── Teacher payments tab ── */}
        {tab === "teacher" && (
          <>
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

            {teacherPayments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30">
                <DollarSign size={32} className="mx-auto mb-3 text-charcoal/20" />
                <p>No payments generated yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {teacherPayments.map(p => (
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
          </>
        )}

        {/* ── Student payments tab ── */}
        {tab === "student" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-charcoal">Student Payments</h2>
              <button
                onClick={() => setShowStudentForm(!showStudentForm)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
              >
                <Plus size={15} /> Log Payment
              </button>
            </div>

            {showStudentForm && (
              <div className="bg-white rounded-2xl border border-black/5 p-6 mb-6">
                <h3 className="font-semibold text-charcoal mb-4">Log Student Payment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={studentForm.student_id}
                    onChange={e => setStudentForm(p => ({ ...p, student_id: e.target.value }))}
                    className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  >
                    <option value="">Select student…</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <select
                      value={studentForm.currency}
                      onChange={e => setStudentForm(p => ({ ...p, currency: e.target.value }))}
                      className="w-24 px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                    >
                      <option>GBP</option>
                      <option>USD</option>
                      <option>EUR</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={studentForm.amount}
                      onChange={e => setStudentForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="Amount"
                      className="flex-1 px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                    />
                  </div>
                  <input
                    type="text"
                    value={studentForm.payment_method}
                    onChange={e => setStudentForm(p => ({ ...p, payment_method: e.target.value }))}
                    placeholder="Payment method (e.g. Bank transfer)"
                    className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  />
                  <input
                    type="text"
                    value={studentForm.notes}
                    onChange={e => setStudentForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Notes (optional)"
                    className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleLogStudentPayment}
                    disabled={loggingPayment || !studentForm.student_id || !studentForm.amount}
                    className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                  >
                    {loggingPayment ? "Logging…" : "Log Payment"}
                  </button>
                  <button
                    onClick={() => setShowStudentForm(false)}
                    className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {studentPayments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30">
                <DollarSign size={32} className="mx-auto mb-3 text-charcoal/20" />
                <p>No student payments logged yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {studentPayments.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl border border-black/5 px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-charcoal text-sm">
                        {p.student_name}
                        {p.payment_method && <span className="font-normal text-charcoal/40"> · {p.payment_method}</span>}
                      </p>
                      {p.notes && <p className="text-xs text-charcoal/50 mt-0.5">{p.notes}</p>}
                      {p.logged_by_name && (
                        <p className="text-xs text-charcoal/30 mt-0.5">Logged by {p.logged_by_name}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-charcoal">{p.currency}{parseFloat(p.amount).toFixed(2)}</p>
                      <p className="text-xs text-charcoal/40 mt-0.5">{formatDate(p.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
