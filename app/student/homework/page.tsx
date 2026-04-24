"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { BookOpen, Star } from "lucide-react";

interface Homework {
  id: string;
  title: string;
  description?: string;
  file_url?: string;
  due_date?: string;
  status: "assigned" | "submitted" | "graded";
  grade?: string;
  teacher_notes?: string;
  teacher_name: string;
  created_at: string;
  submission_notes?: string;
  submission_file?: string;
  submitted_at?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  assigned: { bg: "bg-amber-50", text: "text-amber-700", label: "Assigned" },
  submitted: { bg: "bg-blue-50", text: "text-blue-600", label: "Submitted" },
  graded: { bg: "bg-emerald-primary/10", text: "text-emerald-primary", label: "Graded" },
};

export default function StudentHomeworkPage() {
  const router = useRouter();
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitForms, setSubmitForms] = useState<Record<string, { notes: string; file_url: string }>>({});

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    api.get("/homework", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setHomework(res.data.homework))
      .catch(() => setError("Failed to load homework."))
      .finally(() => setLoading(false));
  }, [router]);

  function updateForm(id: string, field: "notes" | "file_url", value: string) {
    setSubmitForms((prev) => {
      const existing = prev[id] ?? { notes: "", file_url: "" };
      return { ...prev, [id]: { ...existing, [field]: value } };
    });
  }

  async function handleSubmit(hw: Homework) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSubmitting(hw.id);
    try {
      const form = submitForms[hw.id] ?? {};
      await api.post(`/homework/${hw.id}/submit`,
        { notes: form.notes || undefined, file_url: form.file_url || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHomework((prev) =>
        prev.map((h) => h.id === hw.id ? { ...h, status: "submitted", submission_notes: form.notes } : h)
      );
    } catch {
      alert("Failed to submit homework.");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </main>
    );
  }
  if (error) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center px-4">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  const pending = homework.filter((h) => h.status === "assigned");
  const submitted = homework.filter((h) => h.status === "submitted");
  const graded = homework.filter((h) => h.status === "graded");

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-display text-3xl font-bold text-charcoal mb-2">Homework</h1>
        <p className="text-charcoal/50 text-sm mb-8">Complete and track your assignments</p>

        {homework.length === 0 && (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/40">
            <BookOpen size={32} className="mx-auto mb-3 text-charcoal/20" />
            <p>No homework assigned yet.</p>
          </div>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <section className="mb-10">
            <h2 className="font-display text-xl font-bold text-charcoal mb-4">
              To Do
              <span className="ml-2 text-sm font-normal text-charcoal/40">({pending.length})</span>
            </h2>
            <div className="space-y-4">
              {pending.map((hw) => (
                <div key={hw.id} className="bg-white rounded-2xl border border-black/5 p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-semibold text-charcoal">{hw.title}</h3>
                      <p className="text-charcoal/50 text-xs mt-0.5">
                        Set by {hw.teacher_name} · {formatDate(hw.created_at)}
                        {hw.due_date && <> · Due <span className="text-amber-600 font-medium">{formatDate(hw.due_date)}</span></>}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.assigned.bg} ${statusStyle.assigned.text}`}>
                      Assigned
                    </span>
                  </div>
                  {hw.description && (
                    <p className="text-charcoal/60 text-sm mb-4 leading-relaxed">{hw.description}</p>
                  )}
                  <div className="border-t border-black/5 pt-3 space-y-2">
                    <textarea
                      value={submitForms[hw.id]?.notes ?? ""}
                      onChange={(e) => updateForm(hw.id, "notes", e.target.value)}
                      placeholder="Your answer or notes…"
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 resize-none"
                    />
                    <input
                      type="url"
                      value={submitForms[hw.id]?.file_url ?? ""}
                      onChange={(e) => updateForm(hw.id, "file_url", e.target.value)}
                      placeholder="File URL (optional — paste Google Drive / Dropbox link)"
                      className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                    />
                    <button
                      onClick={() => handleSubmit(hw)}
                      disabled={submitting === hw.id}
                      className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                    >
                      {submitting === hw.id ? "Submitting…" : "Submit"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Submitted / awaiting grade */}
        {submitted.length > 0 && (
          <section className="mb-10">
            <h2 className="font-display text-xl font-bold text-charcoal mb-4">Awaiting Feedback</h2>
            <div className="space-y-3">
              {submitted.map((hw) => (
                <div key={hw.id} className="bg-white rounded-2xl border border-black/5 p-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-charcoal">{hw.title}</h3>
                    <p className="text-charcoal/50 text-xs mt-0.5">
                      Submitted {hw.submitted_at ? formatDate(hw.submitted_at) : ""}
                      {hw.submission_notes && <> · <span className="italic">{hw.submission_notes}</span></>}
                    </p>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                    Submitted
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Graded */}
        {graded.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold text-charcoal mb-4">Graded</h2>
            <div className="space-y-3">
              {graded.map((hw) => (
                <div key={hw.id} className="bg-white rounded-2xl border border-black/5 p-5">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="font-semibold text-charcoal">{hw.title}</h3>
                    {hw.grade && (
                      <div className="flex items-center gap-1.5 shrink-0 px-3 py-1 rounded-full bg-emerald-primary/10">
                        <Star size={12} className="text-gold" />
                        <span className="text-xs font-bold text-emerald-primary">{hw.grade}</span>
                      </div>
                    )}
                  </div>
                  {hw.teacher_notes && (
                    <div className="mt-2 p-3 rounded-xl bg-cream border border-black/5">
                      <p className="text-xs text-charcoal/50 mb-1 font-medium uppercase tracking-wider">Teacher feedback</p>
                      <p className="text-sm text-charcoal/70 leading-relaxed">{hw.teacher_notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
