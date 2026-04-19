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
  teacher_name: string;
  notes?: string;
}

interface Package {
  package_name: string;
  total_lessons: number;
  used_lessons: number;
  expires_at?: string;
}

interface Me {
  display_name: string;
  email: string;
  phone?: string;
}

interface DashboardData {
  user: Me;
  package: Package | null;
  upcoming_lessons: Lesson[];
}

function subjectLabel(s: string) {
  return s === "quran" ? "Quran" : s === "arabic" ? "Arabic" : "Islamic Studies";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [history, setHistory] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      api.get("/students/me", { headers }),
      api.get("/students/lessons", { headers }),
    ])
      .then(([meRes, lessonsRes]) => {
        setData(meRes.data);
        setHistory(lessonsRes.data.lessons);
      })
      .catch(() => setError("Failed to load dashboard. Please sign in again."))
      .finally(() => setLoading(false));
  }, [router]);

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

  if (error || !data) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Something went wrong."}</p>
          <a href="/login" className="text-emerald-primary font-medium hover:underline">Back to login</a>
        </div>
      </main>
    );
  }

  const { user, package: pkg, upcoming_lessons } = data;
  const lessonsRemaining = pkg ? pkg.total_lessons - pkg.used_lessons : null;
  const pastLessons = history.filter((l) => l.status !== "scheduled");

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="font-display text-3xl font-bold text-charcoal">
              Assalamu Alaikum, {user.display_name.split(" ")[0]} 👋
            </h1>
            <p className="text-charcoal/55 mt-1 text-sm">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-charcoal/50 hover:text-charcoal transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Package card */}
        <div className="bg-emerald-primary text-white rounded-2xl p-6 mb-8">
          <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Current Package</p>
          {pkg ? (
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold capitalize">{pkg.package_name}</h2>
                <p className="text-white/80 text-sm mt-1">
                  {lessonsRemaining} lesson{lessonsRemaining !== 1 ? "s" : ""} remaining of {pkg.total_lessons}
                </p>
              </div>
              {pkg.expires_at && (
                <p className="text-white/60 text-xs">Expires {formatDate(pkg.expires_at)}</p>
              )}
            </div>
          ) : (
            <p className="text-white/80">No active package. Contact us to enrol.</p>
          )}
        </div>

        {/* Upcoming lessons */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-bold text-charcoal mb-4">Upcoming Lessons</h2>
          {upcoming_lessons.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-6 text-charcoal/50 text-sm">
              No upcoming lessons scheduled.
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming_lessons.map((l) => (
                <div key={l.id} className="bg-white rounded-2xl border border-black/5 p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-charcoal">{subjectLabel(l.subject)}</p>
                    <p className="text-charcoal/55 text-sm mt-0.5">
                      with {l.teacher_name} · {l.duration_minutes} min
                    </p>
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

        {/* Lesson history */}
        <section>
          <h2 className="font-display text-xl font-bold text-charcoal mb-4">Lesson History</h2>
          {pastLessons.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 p-6 text-charcoal/50 text-sm">
              No completed lessons yet.
            </div>
          ) : (
            <div className="space-y-3">
              {pastLessons.map((l) => (
                <div key={l.id} className="bg-white rounded-2xl border border-black/5 p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-charcoal">{subjectLabel(l.subject)}</p>
                    <p className="text-charcoal/55 text-sm mt-0.5">
                      with {l.teacher_name}
                      {l.notes && <> · <span className="italic">{l.notes}</span></>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                      l.status === "completed"
                        ? "bg-emerald-primary/10 text-emerald-primary"
                        : "bg-red-50 text-red-500"
                    }`}>
                      {l.status}
                    </span>
                    <p className="text-charcoal/40 text-xs mt-1">{formatDate(l.scheduled_at)}</p>
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
