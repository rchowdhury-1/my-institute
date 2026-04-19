"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface Lesson {
  id: string;
  subject: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  student_name: string;
  notes?: string;
}

interface Teacher {
  display_name: string;
  email: string;
}

function subjectLabel(s: string) {
  return s === "quran" ? "Quran" : s === "arabic" ? "Arabic" : "Islamic Studies";
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      api.get("/teachers/me", { headers }),
      api.get("/teachers/lessons", { headers }),
    ])
      .then(([meRes, lessonsRes]) => {
        setTeacher(meRes.data.user);
        setLessons(lessonsRes.data.lessons);
      })
      .catch(() => setError("Failed to load dashboard. Please sign in again."))
      .finally(() => setLoading(false));
  }, [router]);

  const updateLesson = async (lessonId: string, status: string, notes?: string) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSaving(lessonId);
    try {
      const res = await api.patch(
        `/teachers/lessons/${lessonId}`,
        { status, notes: notes ?? noteInputs[lessonId] ?? undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLessons((prev) => prev.map((l) => l.id === lessonId ? res.data.lesson : l));
    } catch {
      alert("Failed to update lesson.");
    } finally {
      setSaving(null);
    }
  };

  const handleLogout = async () => {
    await api.post("/auth/logout", {}).catch(() => {});
    localStorage.clear();
    document.cookie = "userRole=; path=/; max-age=0";
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </main>
    );
  }

  if (error || !teacher) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Something went wrong."}</p>
          <a href="/login" className="text-emerald-primary font-medium hover:underline">Back to login</a>
        </div>
      </main>
    );
  }

  const todayLessons = lessons.filter((l) => isToday(l.scheduled_at));
  const upcomingLessons = lessons.filter(
    (l) => l.status === "scheduled" && new Date(l.scheduled_at) > new Date()
  );

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="font-display text-3xl font-bold text-charcoal">
              Assalamu Alaikum, {teacher.display_name.split(" ")[0]}
            </h1>
            <p className="text-charcoal/55 mt-1 text-sm">{teacher.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-charcoal/50 hover:text-charcoal transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Today's schedule */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-bold text-charcoal mb-4">
            Today&apos;s Schedule
            <span className="ml-2 text-sm font-normal text-charcoal/40">
              {todayLessons.length} lesson{todayLessons.length !== 1 ? "s" : ""}
            </span>
          </h2>
          {todayLessons.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-6 text-charcoal/50 text-sm">
              No lessons scheduled for today.
            </div>
          ) : (
            <div className="space-y-3">
              {todayLessons.map((l) => (
                <LessonCard
                  key={l.id}
                  lesson={l}
                  noteInput={noteInputs[l.id] ?? l.notes ?? ""}
                  saving={saving === l.id}
                  onNoteChange={(val) => setNoteInputs((p) => ({ ...p, [l.id]: val }))}
                  onComplete={() => updateLesson(l.id, "completed")}
                  onCancel={() => updateLesson(l.id, "cancelled")}
                />
              ))}
            </div>
          )}
        </section>

        {/* Upcoming */}
        <section>
          <h2 className="font-display text-xl font-bold text-charcoal mb-4">Upcoming Lessons</h2>
          {upcomingLessons.filter((l) => !isToday(l.scheduled_at)).length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-6 text-charcoal/50 text-sm">
              No upcoming lessons.
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingLessons
                .filter((l) => !isToday(l.scheduled_at))
                .map((l) => (
                  <div key={l.id} className="bg-white rounded-2xl border border-black/5 p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-charcoal">{subjectLabel(l.subject)}</p>
                      <p className="text-charcoal/55 text-sm mt-0.5">with {l.student_name} · {l.duration_minutes} min</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-charcoal">{formatDate(l.scheduled_at)}</p>
                      <p className="text-charcoal/55 text-sm">{formatTime(l.scheduled_at)}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function LessonCard({
  lesson, noteInput, saving, onNoteChange, onComplete, onCancel,
}: {
  lesson: Lesson;
  noteInput: string;
  saving: boolean;
  onNoteChange: (v: string) => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const done = lesson.status !== "scheduled";

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-semibold text-charcoal">{subjectLabel(lesson.subject)}</p>
          <p className="text-charcoal/55 text-sm mt-0.5">
            with {lesson.student_name} · {lesson.duration_minutes} min · {formatTime(lesson.scheduled_at)}
          </p>
        </div>
        {done ? (
          <span className={`shrink-0 inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
            lesson.status === "completed"
              ? "bg-emerald-primary/10 text-emerald-primary"
              : "bg-red-50 text-red-500"
          }`}>
            {lesson.status}
          </span>
        ) : null}
      </div>

      {!done && (
        <>
          <textarea
            value={noteInput}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Add lesson notes (optional)…"
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm resize-none mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={onComplete}
              disabled={saving}
              className="flex-1 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Mark Completed"}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {done && lesson.notes && (
        <p className="text-charcoal/50 text-sm italic border-t border-black/5 pt-3">{lesson.notes}</p>
      )}
    </div>
  );
}
