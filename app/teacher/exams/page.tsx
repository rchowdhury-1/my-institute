"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Plus, Trash2, ClipboardList, Users } from "lucide-react";

interface Question {
  question: string;
  options: string[];
  correct_answer: string;
  points: number;
}

interface Exam {
  id: string;
  title: string;
  description?: string;
  time_limit_minutes?: number;
  question_count: number;
  assigned_count: number;
  completed_count: number;
  created_at: string;
}

interface Student {
  id: string;
  display_name: string;
  email: string;
}

interface ExamResult {
  id: string;
  student_name: string;
  score: number;
  max_score: number;
  completed_at: string;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

function emptyQuestion(): Question {
  return { question: "", options: ["", "", "", ""], correct_answer: "A", points: 1 };
}

export default function TeacherExamsPage() {
  const router = useRouter();
  const [view, setView] = useState<"list" | "create" | "results">("list");
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // Create form
  const [form, setForm] = useState({ title: "", description: "", time_limit_minutes: "" });
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()]);
  const [creating, setCreating] = useState(false);

  // Assign
  const [assigningExam, setAssigningExam] = useState<string | null>(null);
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assigning, setAssigning] = useState(false);

  function authHeaders() {
    const token = localStorage.getItem("accessToken");
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      api.get("/exams", { headers }),
      api.get("/admin/students", { headers }).catch(() => ({ data: { students: [] } })),
    ]).then(([examRes, studRes]) => {
      setExams(examRes.data.exams);
      setStudents(studRes.data.students);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  async function handleCreate() {
    if (!form.title || questions.some(q => !q.question || q.options.some(o => !o))) {
      alert("Please fill in all question fields and options.");
      return;
    }
    setCreating(true);
    try {
      const res = await api.post("/exams", {
        title: form.title,
        description: form.description || undefined,
        time_limit_minutes: form.time_limit_minutes ? parseInt(form.time_limit_minutes) : undefined,
        questions,
      }, { headers: authHeaders() });
      setExams(prev => [{ ...res.data.exam, question_count: questions.length, assigned_count: 0, completed_count: 0 }, ...prev]);
      setForm({ title: "", description: "", time_limit_minutes: "" });
      setQuestions([emptyQuestion()]);
      setView("list");
    } catch {
      alert("Failed to create exam.");
    } finally {
      setCreating(false);
    }
  }

  function updateQuestion(i: number, field: keyof Question, value: string | number) {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  }

  function updateOption(qi: number, oi: number, value: string) {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx !== qi) return q;
      const opts = [...q.options];
      opts[oi] = value;
      return { ...q, options: opts };
    }));
  }

  async function handleAssign(examId: string) {
    if (!assignStudentId) return;
    setAssigning(true);
    try {
      await api.post(`/exams/${examId}/assign`, { student_id: assignStudentId }, { headers: authHeaders() });
      setExams(prev => prev.map(e => e.id === examId ? { ...e, assigned_count: e.assigned_count + 1 } : e));
      setAssigningExam(null);
      setAssignStudentId("");
    } catch {
      alert("Failed to assign exam.");
    } finally {
      setAssigning(false);
    }
  }

  async function viewResults(exam: Exam) {
    setSelectedExam(exam);
    setLoadingResults(true);
    setView("results");
    try {
      const res = await api.get(`/exams/${exam.id}/results`, { headers: authHeaders() });
      setResults(res.data.results);
    } catch {
      alert("Failed to load results.");
    } finally {
      setLoadingResults(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </main>
    );
  }

  if (view === "create") {
    return (
      <main className="min-h-screen bg-cream">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView("list")} className="text-charcoal/50 hover:text-charcoal text-sm">← Back</button>
            <h1 className="font-display text-2xl font-bold text-charcoal">Create Exam</h1>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 p-6 mb-6">
            <h2 className="font-semibold text-charcoal mb-4">Exam Details</h2>
            <div className="space-y-3">
              <input
                type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Exam title *"
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
              />
              <textarea
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Description (optional)" rows={2}
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 resize-none"
              />
              <input
                type="number" value={form.time_limit_minutes} onChange={e => setForm(p => ({ ...p, time_limit_minutes: e.target.value }))}
                placeholder="Time limit in minutes (optional)"
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
              />
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {questions.map((q, qi) => (
              <div key={qi} className="bg-white rounded-2xl border border-black/5 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-charcoal text-sm">Question {qi + 1}</p>
                  {questions.length > 1 && (
                    <button onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}
                      className="p-1 text-charcoal/30 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <textarea
                  value={q.question} onChange={e => updateQuestion(qi, "question", e.target.value)}
                  placeholder="Question text *" rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 resize-none mb-3"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {OPTION_LABELS.map((label, oi) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-primary/10 text-emerald-primary text-xs font-bold flex items-center justify-center shrink-0">{label}</span>
                      <input
                        type="text" value={q.options[oi]} onChange={e => updateOption(qi, oi, e.target.value)}
                        placeholder={`Option ${label} *`}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-charcoal/50">Correct answer:</label>
                    <select value={q.correct_answer} onChange={e => updateQuestion(qi, "correct_answer", e.target.value)}
                      className="px-2 py-1 rounded-lg border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30">
                      {OPTION_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-charcoal/50">Points:</label>
                    <input type="number" min={1} value={q.points} onChange={e => updateQuestion(qi, "points", parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 rounded-lg border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setQuestions(prev => [...prev, emptyQuestion()])}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-primary text-emerald-primary text-sm font-semibold hover:bg-emerald-primary/5 transition-colors">
              <Plus size={14} /> Add Question
            </button>
            <button onClick={handleCreate} disabled={creating || !form.title}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
              {creating ? "Creating…" : "Create Exam"}
            </button>
            <button onClick={() => setView("list")}
              className="px-4 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (view === "results" && selectedExam) {
    return (
      <main className="min-h-screen bg-cream">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView("list")} className="text-charcoal/50 hover:text-charcoal text-sm">← Back</button>
            <h1 className="font-display text-2xl font-bold text-charcoal">{selectedExam.title} — Results</h1>
          </div>
          {loadingResults ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30">
              <Users size={32} className="mx-auto mb-3 text-charcoal/20" />
              <p>No students have completed this exam yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map(r => (
                <div key={r.id} className="bg-white rounded-2xl border border-black/5 px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-charcoal text-sm">{r.student_name}</p>
                    <p className="text-xs text-charcoal/40 mt-0.5">{new Date(r.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-primary">{r.score} / {r.max_score}</p>
                    <p className="text-xs text-charcoal/40">{r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-charcoal">Exams</h1>
            <p className="text-charcoal/50 text-sm mt-1">Create and manage student exams</p>
          </div>
          <button onClick={() => setView("create")}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors">
            <Plus size={16} /> Create Exam
          </button>
        </div>

        {exams.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30">
            <ClipboardList size={32} className="mx-auto mb-3 text-charcoal/20" />
            <p>No exams created yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map(exam => (
              <div key={exam.id} className="bg-white rounded-2xl border border-black/5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-charcoal">{exam.title}</h3>
                    <p className="text-xs text-charcoal/40 mt-0.5">
                      {exam.question_count} question{exam.question_count !== 1 ? "s" : ""}
                      {exam.time_limit_minutes ? ` · ${exam.time_limit_minutes} min` : ""}
                      {" · "}
                      {exam.assigned_count} assigned · {exam.completed_count} completed
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => viewResults(exam)}
                      className="px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs font-medium hover:border-emerald-primary hover:text-emerald-primary transition-colors">
                      Results
                    </button>
                    <button onClick={() => { setAssigningExam(assigningExam === exam.id ? null : exam.id); setAssignStudentId(""); }}
                      className="px-3 py-1.5 rounded-full bg-emerald-primary/10 text-emerald-primary text-xs font-medium hover:bg-emerald-primary/20 transition-colors">
                      Assign
                    </button>
                  </div>
                </div>
                {assigningExam === exam.id && (
                  <div className="mt-4 pt-4 border-t border-black/5 flex gap-2">
                    <select value={assignStudentId} onChange={e => setAssignStudentId(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30">
                      <option value="">Select student…</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                    </select>
                    <button onClick={() => handleAssign(exam.id)} disabled={assigning || !assignStudentId}
                      className="px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                      {assigning ? "…" : "Assign"}
                    </button>
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
