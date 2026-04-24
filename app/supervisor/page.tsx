"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Plus, Trash2, Calendar, Send } from "lucide-react";

interface Session {
  id: string;
  student_name: string;
  teacher_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
}

interface User {
  id: string;
  display_name: string;
  email: string;
  role: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const statusStyle: Record<string, string> = {
  scheduled: "bg-emerald-primary/10 text-emerald-primary",
  completed: "bg-blue-50 text-blue-600",
  cancelled: "bg-red-50 text-red-500",
  rescheduled: "bg-amber-50 text-amber-600",
};

export default function SupervisorPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"sessions" | "people" | "message">("sessions");

  // create session form
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionForm, setSessionForm] = useState({ student_id: "", teacher_id: "", scheduled_at: "", duration_minutes: "30" });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // message form
  const [msgForm, setMsgForm] = useState({ receiver_id: "", content: "" });
  const [sending, setSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      api.get("/admin/sessions", { headers }),
      api.get("/admin/students", { headers }),
      api.get("/admin/teachers", { headers }),
    ])
      .then(([sessRes, studRes, teachRes]) => {
        setSessions(sessRes.data.sessions);
        setStudents(studRes.data.students);
        setTeachers(teachRes.data.teachers);
      })
      .catch(() => setError("Failed to load data. You may not have permission."))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCreateSession() {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setCreating(true);
    try {
      const res = await api.post("/sessions",
        {
          student_id: sessionForm.student_id,
          teacher_id: sessionForm.teacher_id,
          scheduled_at: new Date(sessionForm.scheduled_at).toISOString(),
          duration_minutes: parseInt(sessionForm.duration_minutes) || 30,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const student = students.find((s) => s.id === sessionForm.student_id);
      const teacher = teachers.find((t) => t.id === sessionForm.teacher_id);
      setSessions((prev) => [{
        ...res.data.session,
        student_name: student?.display_name ?? "",
        teacher_name: teacher?.display_name ?? "",
      }, ...prev]);
      setSessionForm({ student_id: "", teacher_id: "", scheduled_at: "", duration_minutes: "30" });
      setShowSessionForm(false);
    } catch {
      alert("Failed to create session.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteSession(id: string) {
    if (!confirm("Delete this session?")) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setDeleting(id);
    try {
      await api.delete(`/sessions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("Failed to delete session.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleSendMessage() {
    if (!msgForm.receiver_id || !msgForm.content.trim()) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSending(true);
    try {
      await api.post("/messages",
        { receiver_id: msgForm.receiver_id, content: msgForm.content.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsgForm({ receiver_id: "", content: "" });
      setMsgSent(true);
      setTimeout(() => setMsgSent(false), 3000);
    } catch {
      alert("Failed to send message.");
    } finally {
      setSending(false);
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
        <p className="text-red-500 text-center">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-display text-3xl font-bold text-charcoal mb-2">Supervisor Dashboard</h1>
        <p className="text-charcoal/50 text-sm mb-8">Manage sessions, students and teachers</p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Sessions", value: sessions.length },
            { label: "Students", value: students.length },
            { label: "Teachers", value: teachers.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-black/5 p-5 text-center">
              <p className="font-display text-3xl font-bold text-emerald-primary">{stat.value}</p>
              <p className="text-charcoal/50 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-full p-1 border border-black/5 mb-6 w-fit">
          {(["sessions", "people", "message"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all capitalize ${
                activeTab === tab
                  ? "bg-emerald-primary text-white"
                  : "text-charcoal/60 hover:text-charcoal"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Sessions tab */}
        {activeTab === "sessions" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-charcoal">All Sessions</h2>
              <button
                onClick={() => setShowSessionForm(!showSessionForm)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
              >
                <Plus size={16} /> Add Session
              </button>
            </div>

            {showSessionForm && (
              <div className="bg-white rounded-2xl border border-black/5 p-5 mb-6">
                <h3 className="font-semibold text-charcoal mb-3">New Session</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={sessionForm.student_id}
                    onChange={(e) => setSessionForm((p) => ({ ...p, student_id: e.target.value }))}
                    className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  >
                    <option value="">Select student…</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                  </select>
                  <select
                    value={sessionForm.teacher_id}
                    onChange={(e) => setSessionForm((p) => ({ ...p, teacher_id: e.target.value }))}
                    className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  >
                    <option value="">Select teacher…</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                  </select>
                  <input
                    type="datetime-local"
                    value={sessionForm.scheduled_at}
                    onChange={(e) => setSessionForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                    className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  />
                  <input
                    type="number"
                    value={sessionForm.duration_minutes}
                    onChange={(e) => setSessionForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                    placeholder="Duration (minutes)"
                    className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleCreateSession}
                    disabled={creating || !sessionForm.student_id || !sessionForm.teacher_id || !sessionForm.scheduled_at}
                    className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                  >
                    {creating ? "Creating…" : "Create Session"}
                  </button>
                  <button
                    onClick={() => setShowSessionForm(false)}
                    className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {sessions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-charcoal/30">
                <Calendar size={32} className="mx-auto mb-3 text-charcoal/20" />
                <p>No sessions yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="bg-white rounded-2xl border border-black/5 p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-charcoal text-sm truncate">
                        {s.student_name} ↔ {s.teacher_name}
                      </p>
                      <p className="text-charcoal/50 text-xs mt-0.5">
                        {formatDate(s.scheduled_at)} · {s.duration_minutes} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusStyle[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {s.status}
                      </span>
                      {s.status === "scheduled" && (
                        <button
                          onClick={() => handleDeleteSession(s.id)}
                          disabled={deleting === s.id}
                          className="p-1.5 rounded-lg text-charcoal/30 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* People tab */}
        {activeTab === "people" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h2 className="font-display text-xl font-bold text-charcoal mb-4">
                Students <span className="text-sm font-normal text-charcoal/40">({students.length})</span>
              </h2>
              <div className="space-y-2">
                {students.map((s) => (
                  <div key={s.id} className="bg-white rounded-2xl border border-black/5 px-4 py-3">
                    <p className="font-semibold text-charcoal text-sm">{s.display_name}</p>
                    <p className="text-charcoal/40 text-xs">{s.email}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-charcoal mb-4">
                Teachers <span className="text-sm font-normal text-charcoal/40">({teachers.length})</span>
              </h2>
              <div className="space-y-2">
                {teachers.map((t) => (
                  <div key={t.id} className="bg-white rounded-2xl border border-black/5 px-4 py-3">
                    <p className="font-semibold text-charcoal text-sm">{t.display_name}</p>
                    <p className="text-charcoal/40 text-xs">{t.email}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message tab */}
        {activeTab === "message" && (
          <div className="max-w-lg">
            <h2 className="font-display text-xl font-bold text-charcoal mb-4">Send Message</h2>
            <div className="bg-white rounded-2xl border border-black/5 p-6 space-y-3">
              <select
                value={msgForm.receiver_id}
                onChange={(e) => setMsgForm((p) => ({ ...p, receiver_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
              >
                <option value="">Select recipient…</option>
                <optgroup label="Students">
                  {students.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </optgroup>
                <optgroup label="Teachers">
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                </optgroup>
              </select>
              <textarea
                value={msgForm.content}
                onChange={(e) => setMsgForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="Your message…"
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 resize-none"
              />
              {msgSent && (
                <p className="text-emerald-primary text-sm font-medium">Message sent successfully!</p>
              )}
              <button
                onClick={handleSendMessage}
                disabled={sending || !msgForm.receiver_id || !msgForm.content.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
              >
                <Send size={14} />
                {sending ? "Sending…" : "Send Message"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
