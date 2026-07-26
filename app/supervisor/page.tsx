"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Send, Users, GraduationCap, Newspaper, Heart, Clock, X as XIcon } from "lucide-react";
import Link from "next/link";
import { formatSessionTime } from "@/lib/datetime";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useLogout } from "@/lib/useLogout";
import { getAxiosError } from "@/lib/errors";
import { whatsAppUrl } from "@/lib/labels";
import PageLoading from "@/components/shared/PageLoading";
import PageError from "@/components/shared/PageError";
import { type Session } from "@/components/supervisor/SessionCard";
import ScheduleModal, { type Schedule, type ScheduleGeneration } from "@/components/supervisor/ScheduleModal";
import EditSessionModal, { type EditWaMsg } from "@/components/supervisor/EditSessionModal";
import SchedulesTab from "@/components/supervisor/SchedulesTab";
import SessionsTab, { type RescheduleRequest } from "@/components/supervisor/SessionsTab";

const TOAST_MS = 3000;

export interface User {
  id: string;
  display_name: string;
  email: string;
  role: string;
}

export default function SupervisorPage() {
  const handleLogout = useLogout();
  const { authChecked } = useAuthGuard(["admin", "supervisor"]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const messagingEnabled = process.env.NEXT_PUBLIC_FEATURE_MESSAGING === "true";
  const [activeTab, setActiveTab] = useState<"sessions" | "schedules" | "people" | "message">("sessions");

  // reschedule requests
  const [rescheduleRequests, setRescheduleRequests] = useState<RescheduleRequest[]>([]);

  // edit session modal
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editWaMsg, setEditWaMsg] = useState<EditWaMsg | null>(null);

  // schedules
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [scheduleGenResult, setScheduleGenResult] = useState<ScheduleGeneration | null>(null);
  const [scheduleActioning, setScheduleActioning] = useState<string | null>(null);

  // message form
  const [msgForm, setMsgForm] = useState({ receiver_id: "", content: "" });
  const [sending, setSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  useEffect(() => {
    if (!authChecked) return;

    Promise.all([
      api.get("/admin/sessions"),
      api.get("/admin/students"),
      api.get("/admin/teachers"),
      api.get("/reschedule-requests?status=pending"),
      api.get("/admin/weekly-schedules"),
    ])
      .then(([sessRes, studRes, teachRes, rrRes, schedRes]) => {
        setSessions(sessRes.data.sessions);
        setStudents(studRes.data.students);
        setTeachers(teachRes.data.teachers);
        setRescheduleRequests(rrRes.data.requests ?? []);
        setSchedules(schedRes.data.schedules ?? []);
      })
      .catch(() => setError("Failed to load data. You may not have permission."))
      .finally(() => setLoading(false));
  }, [authChecked]);

  // ─── Schedule handlers ────────────────────────────────────────────────────

  function openScheduleModal(schedule?: Schedule) {
    setEditingSchedule(schedule ?? null);
    setScheduleGenResult(null);
    setShowScheduleModal(true);
  }

  async function handleDeactivateSchedule(id: string) {
    const futureCount = sessions.filter(s => s.schedule_id === id && s.status === "scheduled" && new Date(s.scheduled_at) > new Date()).length;
    if (!confirm(`This will remove ${futureCount} future session${futureCount !== 1 ? "s" : ""}. The schedule will be moved to Archived. You can reactivate it later if needed.`)) return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setScheduleActioning(id);
    try {
      await api.delete(`/admin/weekly-schedules/${id}`);
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: false } : s));
      setSessions(prev => prev.filter(s => !(s.schedule_id === id && s.status === "scheduled" && new Date(s.scheduled_at) > new Date())));
    } catch (err) {
      alert(getAxiosError(err).message);
    } finally {
      setScheduleActioning(null);
    }
  }

  async function handleReactivateSchedule(id: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setScheduleActioning(id);
    try {
      const res = await api.post(`/admin/weekly-schedules/${id}/reactivate`, {});
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: true } : s));
      setScheduleGenResult(res.data.generation);
      const sessRes = await api.get("/admin/sessions");
      setSessions(sessRes.data.sessions);
    } catch (err) {
      alert(getAxiosError(err).message);
    } finally {
      setScheduleActioning(null);
    }
  }

  async function handleGenerateNow(id: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setScheduleActioning(id);
    try {
      const res = await api.post(`/admin/weekly-schedules/${id}/generate`, {});
      setScheduleGenResult(res.data.generation);
      if (res.data.generation.created > 0) {
        const sessRes = await api.get("/admin/sessions");
        setSessions(sessRes.data.sessions);
      }
    } catch (err) {
      alert(getAxiosError(err).message);
    } finally {
      setScheduleActioning(null);
    }
  }

  async function handleSendMessage() {
    if (!msgForm.receiver_id || !msgForm.content.trim()) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSending(true);
    try {
      await api.post("/messages",
        { receiver_id: msgForm.receiver_id, content: msgForm.content.trim() }
      );
      setMsgForm({ receiver_id: "", content: "" });
      setMsgSent(true);
      setTimeout(() => setMsgSent(false), TOAST_MS);
    } catch (err) {
      alert(getAxiosError(err).message);
    } finally {
      setSending(false);
    }
  }

  function openEditModal(s: Session) {
    setEditSession(s);
    setEditWaMsg(null);
  }

  function handleEditSessionSaved(updated: Session, waMsg: EditWaMsg | null) {
    setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    if (waMsg) setEditWaMsg(waMsg);
    setEditSession(null);
  }

  if (loading) {
    return <PageLoading />;
  }
  if (error) {
    return <PageError message={error} />;
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <div className="flex items-start justify-between mb-2">
          <h1 className="font-display text-3xl font-bold text-charcoal">Supervisor Dashboard</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-charcoal/50 hover:text-charcoal transition-colors"
          >
            Sign out
          </button>
        </div>
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
          {(["sessions", "schedules", "people", ...(messagingEnabled ? ["message" as const] : [])] as const).map((tab) => (
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
          <SessionsTab
            sessions={sessions}
            setSessions={setSessions}
            students={students}
            teachers={teachers}
            rescheduleRequests={rescheduleRequests}
            setRescheduleRequests={setRescheduleRequests}
            onEditSession={openEditModal}
          />
        )}

        {/* Schedules tab */}
        {activeTab === "schedules" && (
          <SchedulesTab
            schedules={schedules}
            sessions={sessions}
            scheduleGenResult={scheduleGenResult}
            setScheduleGenResult={setScheduleGenResult}
            scheduleActioning={scheduleActioning}
            onOpenScheduleModal={openScheduleModal}
            onGenerateNow={handleGenerateNow}
            onDeactivate={handleDeactivateSchedule}
            onReactivate={handleReactivateSchedule}
          />
        )}

        {/* People tab */}
        {activeTab === "people" && (
          <div>
          <div className="flex flex-wrap gap-3 mb-6">
            <Link
              href="/admin/teachers"
              data-testid="link-manage-teachers"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
            >
              <Users size={15} /> Manage Teachers →
            </Link>
            <Link
              href="/admin/students"
              data-testid="link-manage-students"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
            >
              <GraduationCap size={15} /> Manage Students →
            </Link>
            <Link
              href="/admin/newsfeed"
              data-testid="link-manage-newsfeed"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
            >
              <Newspaper size={15} /> Manage Community →
            </Link>
            <Link
              href="/admin/salaries"
              data-testid="link-teacher-salaries"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
            >
              <Clock size={15} /> Teacher Salaries →
            </Link>
            <Link
              href="/admin/revert-applications"
              data-testid="link-manage-reverts"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
            >
              <Heart size={15} /> Revert Applications →
            </Link>
          </div>
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
          </div>
        )}

        {/* Message tab */}
        {activeTab === "message" && messagingEnabled && (
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

      {/* Schedule modal */}
      {showScheduleModal && (
        <ScheduleModal
          editingSchedule={editingSchedule}
          students={students}
          teachers={teachers}
          onClose={() => setShowScheduleModal(false)}
          setSchedules={setSchedules}
          setSessions={setSessions}
          scheduleGenResult={scheduleGenResult}
          setScheduleGenResult={setScheduleGenResult}
        />
      )}

      {/* Edit session modal */}
      {editSession && (
        <EditSessionModal
          key={editSession.id}
          session={editSession}
          teachers={teachers}
          onClose={() => setEditSession(null)}
          onSaved={handleEditSessionSaved}
        />
      )}

      {/* WhatsApp follow-up after edit */}
      {editWaMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl border border-black/5 shadow-lg p-4 flex items-center gap-3 max-w-sm">
          <p className="text-charcoal text-sm">Session updated.</p>
          {(() => {
            const msg = `Assalamu alaikum! Your session time has been updated to ${formatSessionTime(editWaMsg.time || "")}. Please note the new time. — My Institute`;
            const url = whatsAppUrl(editWaMsg.phone, msg);
            return url ? (
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors">
                WhatsApp student →
              </a>
            ) : null;
          })()}
          <button onClick={() => setEditWaMsg(null)} className="text-charcoal/30 hover:text-charcoal/60">
            <XIcon size={14} />
          </button>
        </div>
      )}
    </main>
  );
}
