"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { ClipboardList, CheckCircle, XCircle, Clock } from "lucide-react";

interface AssignedExam {
  id: string; // assignment id
  exam_id: string;
  title: string;
  description?: string;
  time_limit_minutes?: number;
  question_count: number;
  max_score: number;
  status: "assigned" | "in_progress" | "completed";
  score?: number;
  assigned_at: string;
  completed_at?: string;
  teacher_name: string;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  points: number;
}

interface ResultRow {
  question_id: string;
  question: string;
  options: string[];
  correct_answer: string;
  answer?: string;
  is_correct?: boolean;
  points: number;
  score: number;
  max_score: number;
}

const OPTION_LABELS = ["A", "B", "C", "D"];
const statusStyle: Record<string, string> = {
  assigned: "bg-amber-50 text-amber-700",
  in_progress: "bg-blue-50 text-blue-600",
  completed: "bg-emerald-primary/10 text-emerald-primary",
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function StudentExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<AssignedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "taking" | "results">("list");
  const [activeExam, setActiveExam] = useState<AssignedExam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [examScore, setExamScore] = useState<{ score: number; max_score: number } | null>(null);
  const submittingRef = useRef(false);

  function authHeaders() {
    const token = localStorage.getItem("accessToken");
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    api.get("/exams", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setExams(res.data.exams))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (view !== "taking" || timeLeft === null) return;
    if (timeLeft <= 0) {
      if (!submittingRef.current) submitExam();
      return;
    }
    const t = setTimeout(() => setTimeLeft(prev => (prev ?? 1) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, timeLeft]);

  async function startExam(exam: AssignedExam) {
    try {
      const res = await api.post(`/exams/${exam.exam_id}/start`, {}, { headers: authHeaders() });
      setActiveExam(exam);
      setQuestions(res.data.questions || []);
      setCurrentQ(0);
      setAnswers({});
      if (exam.time_limit_minutes) setTimeLeft(exam.time_limit_minutes * 60);
      else setTimeLeft(null);
      setView("taking");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || "Failed to start exam.");
    }
  }

  async function submitExam() {
    if (submittingRef.current || !activeExam) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const answersArr = Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer }));
      const res = await api.post(`/exams/${activeExam.exam_id}/submit`, { answers: answersArr }, { headers: authHeaders() });
      setExamScore({ score: res.data.score, max_score: res.data.max_score });
      // fetch detailed results
      const resultRes = await api.get(`/exams/${activeExam.exam_id}/results`, { headers: authHeaders() });
      setResultRows(resultRes.data.results);
      setExams(prev => prev.map(e => e.exam_id === activeExam.exam_id
        ? { ...e, status: "completed", score: res.data.score }
        : e
      ));
      setView("results");
    } catch {
      alert("Failed to submit exam.");
      submittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  async function viewResults(exam: AssignedExam) {
    setActiveExam(exam);
    setExamScore({ score: exam.score ?? 0, max_score: exam.max_score });
    try {
      const res = await api.get(`/exams/${exam.exam_id}/results`, { headers: authHeaders() });
      setResultRows(res.data.results);
    } catch { /* ignore */ }
    setView("results");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </main>
    );
  }

  // ── Taking exam view ──
  if (view === "taking" && activeExam && questions.length > 0) {
    const q = questions[currentQ];
    const progress = Math.round(((currentQ + 1) / questions.length) * 100);
    return (
      <main className="min-h-screen bg-cream">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-xl font-bold text-charcoal">{activeExam.title}</h1>
              <p className="text-xs text-charcoal/40 mt-0.5">Question {currentQ + 1} of {questions.length}</p>
            </div>
            {timeLeft !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${timeLeft < 60 ? "bg-red-50 text-red-500" : "bg-emerald-primary/10 text-emerald-primary"}`}>
                <Clock size={14} />
                {formatTime(timeLeft)}
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-black/5 rounded-full mb-8 overflow-hidden">
            <div className="h-full bg-emerald-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          <div className="bg-white rounded-2xl border border-black/5 p-6 mb-6">
            <p className="font-semibold text-charcoal leading-relaxed mb-6">{q.question}</p>
            <div className="space-y-3">
              {q.options.map((opt, oi) => {
                const label = OPTION_LABELS[oi];
                const selected = answers[q.id] === label;
                return (
                  <button
                    key={oi}
                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: label }))}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      selected
                        ? "border-emerald-primary bg-emerald-primary/5 text-emerald-primary"
                        : "border-black/10 hover:border-emerald-primary/50 text-charcoal"
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected ? "bg-emerald-primary text-white" : "bg-cream text-charcoal"}`}>
                      {label}
                    </span>
                    <span className="text-sm">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <button
              onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
              disabled={currentQ === 0}
              className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 disabled:opacity-30 transition-colors"
            >
              Previous
            </button>
            {currentQ < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQ(prev => prev + 1)}
                className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => { if (confirm("Submit exam? You cannot change your answers after this.")) submitExam(); }}
                disabled={submitting}
                className="px-5 py-2 rounded-full bg-gold text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
              >
                {submitting ? "Submitting…" : "Submit Exam"}
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ── Results view ──
  if (view === "results" && activeExam) {
    const pct = examScore && examScore.max_score > 0 ? Math.round((examScore.score / examScore.max_score) * 100) : 0;
    return (
      <main className="min-h-screen bg-cream">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <button onClick={() => setView("list")} className="text-charcoal/50 hover:text-charcoal text-sm mb-6">← Back to exams</button>
          <h1 className="font-display text-2xl font-bold text-charcoal mb-2">{activeExam.title}</h1>

          {examScore && (
            <div className={`rounded-2xl p-6 mb-6 text-center ${pct >= 70 ? "bg-emerald-primary/10" : "bg-amber-50"}`}>
              <p className={`font-display text-5xl font-bold mb-1 ${pct >= 70 ? "text-emerald-primary" : "text-amber-700"}`}>{pct}%</p>
              <p className="text-charcoal/60 text-sm">{examScore.score} / {examScore.max_score} points</p>
              <p className={`font-semibold mt-2 ${pct >= 70 ? "text-emerald-primary" : "text-amber-700"}`}>
                {pct >= 70 ? "Well done!" : "Keep practising!"}
              </p>
            </div>
          )}

          {resultRows.length > 0 && (
            <div className="space-y-3">
              {resultRows.filter((r, i, arr) => arr.findIndex(x => x.question_id === r.question_id) === i).map((r, i) => (
                <div key={r.question_id} className={`bg-white rounded-2xl border p-5 ${r.is_correct ? "border-emerald-primary/20" : "border-red-100"}`}>
                  <div className="flex items-start gap-3">
                    {r.is_correct
                      ? <CheckCircle size={18} className="text-emerald-primary shrink-0 mt-0.5" />
                      : <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    }
                    <div className="min-w-0">
                      <p className="font-medium text-charcoal text-sm leading-snug mb-2">Q{i + 1}. {r.question}</p>
                      <p className="text-xs text-charcoal/50">
                        Your answer: <span className={r.is_correct ? "text-emerald-primary font-semibold" : "text-red-500 font-semibold"}>{r.answer || "—"}</span>
                        {!r.is_correct && <> · Correct: <span className="text-emerald-primary font-semibold">{r.correct_answer}</span></>}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── List view ──
  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-display text-3xl font-bold text-charcoal mb-2">My Exams</h1>
        <p className="text-charcoal/50 text-sm mb-8">View and complete assigned exams</p>

        {exams.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30">
            <ClipboardList size={32} className="mx-auto mb-3 text-charcoal/20" />
            <p>No exams assigned yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map(exam => (
              <div key={exam.id} className="bg-white rounded-2xl border border-black/5 p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-charcoal">{exam.title}</h3>
                  <p className="text-xs text-charcoal/40 mt-0.5">
                    {exam.teacher_name} · {exam.question_count} question{exam.question_count !== 1 ? "s" : ""}
                    {exam.time_limit_minutes ? ` · ${exam.time_limit_minutes} min` : ""}
                  </p>
                  {exam.status === "completed" && exam.score != null && (
                    <p className="text-xs text-emerald-primary font-semibold mt-1">
                      Score: {exam.score} / {exam.max_score} ({exam.max_score > 0 ? Math.round((exam.score / exam.max_score) * 100) : 0}%)
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusStyle[exam.status]}`}>
                    {exam.status.replace("_", " ")}
                  </span>
                  {exam.status === "assigned" && (
                    <button onClick={() => startExam(exam)}
                      className="px-4 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light transition-colors">
                      Start
                    </button>
                  )}
                  {exam.status === "completed" && (
                    <button onClick={() => viewResults(exam)}
                      className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs font-medium hover:border-emerald-primary hover:text-emerald-primary transition-colors">
                      Results
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
