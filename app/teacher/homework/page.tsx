"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Plus, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

interface Student {
  id: string;
  display_name: string;
  email: string;
}

interface Homework {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  status: "assigned" | "submitted" | "graded";
  grade?: string;
  teacher_notes?: string;
  student_name: string;
  student_id: string;
  created_at: string;
  submission_count: number;
}

interface Submission {
  id: string;
  student_name: string;
  notes?: string;
  file_url?: string;
  submitted_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const statusStyle: Record<string, string> = {
  assigned: "bg-amber-50 text-amber-700",
  submitted: "bg-blue-50 text-blue-600",
  graded: "bg-emerald-primary/10 text-emerald-primary",
};

export default function TeacherHomeworkPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // create form
  const [form, setForm] = useState({ student_id: "", title: "", description: "", due_date: "", file_url: "" });
  const [creating, setCreating] = useState(false);

  // grade form
  const [gradeForm, setGradeForm] = useState<Record<string, { grade: string; teacher_notes: string }>>({});
  const [grading, setGrading] = useState<string | null>(null);

  // expanded submissions
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>({});

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      api.get("/homework", { headers }),
      api.get("/teachers/students", { headers }).catch(() => ({ data: { students: [] } })),
    ])
      .then(([hwRes, studentsRes]) => {
        setHomework(hwRes.data.homework);
        setStudents(studentsRes.data.students);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCreate() {
    if (!form.student_id || !form.title) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setCreating(true);
    try {
      const res = await api.post("/homework",
        {
          student_id: form.student_id,
          title: form.title,
          description: form.description || undefined,
          due_date: form.due_date || undefined,
          file_url: form.file_url || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const student = students.find((s) => s.id === form.student_id);
      setHomework((prev) => [{ ...res.data.homework, student_name: student?.display_name ?? "", submission_count: 0 }, ...prev]);
      setForm({ student_id: "", title: "", description: "", due_date: "", file_url: "" });
      setShowForm(false);
    } catch {
      alert("Failed to assign homework.");
    } finally {
      setCreating(false);
    }
  }

  async function loadSubmissions(hwId: string) {
    if (submissions[hwId]) {
      setExpanded(expanded === hwId ? null : hwId);
      return;
    }
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      const res = await api.get(`/homework/${hwId}/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubmissions((prev) => ({ ...prev, [hwId]: res.data.submissions }));
      setExpanded(hwId);
    } catch {
      alert("Failed to load submissions.");
    }
  }

  async function handleGrade(hwId: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setGrading(hwId);
    const gf = gradeForm[hwId] ?? { grade: "", teacher_notes: "" };
    try {
      await api.patch(`/homework/${hwId}/grade`,
        { grade: gf.grade || undefined, teacher_notes: gf.teacher_notes || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHomework((prev) =>
        prev.map((h) => h.id === hwId ? { ...h, status: "graded", grade: gf.grade, teacher_notes: gf.teacher_notes } : h)
      );
    } catch {
      alert("Failed to grade homework.");
    } finally {
      setGrading(null);
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-charcoal">Homework</h1>
            <p className="text-charcoal/50 text-sm mt-1">Assign and review student work</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
          >
            <Plus size={16} /> Assign
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-black/5 p-6 mb-8">
            <h2 className="font-display text-lg font-bold text-charcoal mb-4">New Homework</h2>
            <div className="space-y-3">
              <select
                value={form.student_id}
                onChange={(e) => setForm((p) => ({ ...p, student_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.display_name}</option>
                ))}
              </select>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Title *"
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description / instructions"
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 resize-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-charcoal/50 mb-1">Due date (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.due_date}
                    onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-charcoal/50 mb-1">Resource URL (optional)</label>
                  <input
                    type="url"
                    value={form.file_url}
                    onChange={(e) => setForm((p) => ({ ...p, file_url: e.target.value }))}
                    placeholder="https://…"
                    className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreate}
                  disabled={creating || !form.student_id || !form.title}
                  className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                >
                  {creating ? "Assigning…" : "Assign Homework"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Homework list */}
        {homework.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30">
            <BookOpen size={32} className="mx-auto mb-3 text-charcoal/20" />
            <p>No homework assigned yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {homework.map((hw) => (
              <div key={hw.id} className="bg-white rounded-2xl border border-black/5 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-charcoal">{hw.title}</h3>
                      <p className="text-charcoal/50 text-xs mt-0.5">
                        {hw.student_name} · {formatDate(hw.created_at)}
                        {hw.due_date && <> · Due {formatDate(hw.due_date)}</>}
                      </p>
                      {hw.description && (
                        <p className="text-charcoal/50 text-sm mt-2 leading-relaxed">{hw.description}</p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusStyle[hw.status]}`}>
                      {hw.status}
                    </span>
                  </div>

                  {/* Submissions toggle */}
                  {hw.submission_count > 0 && (
                    <button
                      onClick={() => loadSubmissions(hw.id)}
                      className="mt-3 flex items-center gap-1 text-xs text-emerald-primary font-medium hover:underline"
                    >
                      {expanded === hw.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {hw.submission_count} submission{hw.submission_count !== 1 ? "s" : ""}
                    </button>
                  )}
                </div>

                {/* Submissions */}
                {expanded === hw.id && submissions[hw.id] && (
                  <div className="border-t border-black/5 bg-cream/50 p-5 space-y-4">
                    {submissions[hw.id].map((sub) => (
                      <div key={sub.id}>
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <p className="text-sm font-medium text-charcoal">{sub.student_name}</p>
                            <p className="text-xs text-charcoal/40">Submitted {formatDate(sub.submitted_at)}</p>
                            {sub.notes && <p className="text-sm text-charcoal/60 mt-1">{sub.notes}</p>}
                            {sub.file_url && (
                              <a href={sub.file_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-emerald-primary hover:underline mt-1 block">
                                View file
                              </a>
                            )}
                          </div>
                        </div>
                        {hw.status !== "graded" && (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              value={gradeForm[hw.id]?.grade ?? ""}
                              onChange={(e) => setGradeForm((p) => ({ ...p, [hw.id]: { ...p[hw.id], grade: e.target.value } }))}
                              placeholder="Grade (e.g. A, 85%)"
                              className="w-36 px-3 py-1.5 rounded-xl border border-black/10 bg-white text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                            />
                            <input
                              type="text"
                              value={gradeForm[hw.id]?.teacher_notes ?? ""}
                              onChange={(e) => setGradeForm((p) => ({ ...p, [hw.id]: { ...p[hw.id], teacher_notes: e.target.value } }))}
                              placeholder="Feedback (optional)"
                              className="flex-1 px-3 py-1.5 rounded-xl border border-black/10 bg-white text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                            />
                            <button
                              onClick={() => handleGrade(hw.id)}
                              disabled={grading === hw.id}
                              className="px-4 py-1.5 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                            >
                              {grading === hw.id ? "…" : "Grade"}
                            </button>
                          </div>
                        )}
                        {hw.status === "graded" && hw.grade && (
                          <p className="text-xs text-emerald-primary font-semibold mt-1">
                            Grade: {hw.grade}{hw.teacher_notes && ` · ${hw.teacher_notes}`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
