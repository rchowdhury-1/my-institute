"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Plus, Trash2, Calendar, Send, Users, GraduationCap, Newspaper, Heart, Clock, RefreshCw, X as XIcon, Pencil, Repeat, ChevronDown, Archive, Play, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { formatSessionTime, formatRelative } from "@/lib/datetime";

interface Session {
  id: string;
  student_id: string;
  teacher_id: string;
  student_name: string;
  teacher_name: string;
  student_phone?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  subject?: string;
  zoom_link?: string;
  notes?: string;
  schedule_id?: string | null;
  teacher_attended?: boolean | null;
  student_attended?: boolean | null;
}

interface Schedule {
  id: string;
  student_id: string;
  teacher_id: string;
  student_name: string;
  teacher_name: string;
  subject: string;
  default_duration: number;
  slots: { day: string; time: string; duration?: number }[];
  lessons_remaining: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ScheduleGeneration {
  created: number;
  skipped: number;
  conflicts: string[];
}

interface User {
  id: string;
  display_name: string;
  email: string;
  role: string;
}

interface RescheduleRequest {
  id: string;
  session_id: string;
  proposed_at: string;
  status: string;
  original_scheduled_at: string;
  duration_minutes: number;
  subject: string;
  student_name: string;
  student_email: string;
  student_phone: string;
  teacher_name: string;
  rejection_reason?: string;
  created_at: string;
}

const statusStyle: Record<string, string> = {
  scheduled: "bg-emerald-primary/10 text-emerald-primary",
  completed: "bg-blue-50 text-blue-600",
  cancelled: "bg-red-50 text-red-500",
  rescheduled: "bg-amber-50 text-amber-600",
  no_show: "bg-orange-50 text-orange-600",
  cancelled_teacher: "bg-red-50 text-red-500",
};

const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export default function SupervisorPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const messagingEnabled = process.env.NEXT_PUBLIC_FEATURE_MESSAGING === "true";
  const [activeTab, setActiveTab] = useState<"sessions" | "schedules" | "people" | "message">("sessions");

  // create session form
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionForm, setSessionForm] = useState({ student_id: "", teacher_id: "", scheduled_at: "", duration_minutes: "60", subject: "quran", zoom_link: "" });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // reschedule requests
  const [rescheduleRequests, setRescheduleRequests] = useState<RescheduleRequest[]>([]);
  const [rrActioning, setRrActioning] = useState<string | null>(null);
  const [rrRejectId, setRrRejectId] = useState<string | null>(null);
  const [rrRejectReason, setRrRejectReason] = useState("");
  const [rrResult, setRrResult] = useState<Record<string, { action: "approved" | "rejected"; phone?: string; proposedAt?: string; originalAt?: string; reason?: string }>>({});
  const [rrError, setRrError] = useState<Record<string, string>>({});

  // edit session modal
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState({ scheduled_at: "", duration_minutes: "", subject: "", teacher_id: "", zoom_link: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editWaMsg, setEditWaMsg] = useState<{ phone?: string; time?: string } | null>(null);

  // attendance override
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [attendanceStep, setAttendanceStep] = useState<"teacher" | "student" | null>(null);
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  async function handleAdminAttendance(sessionId: string, teacherAttended: boolean, studentAttended: boolean) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setAttendanceSaving(true);
    try {
      const res = await api.patch(`/sessions/${sessionId}/attendance`,
        { teacher_attended: teacherAttended, student_attended: studentAttended },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...res.data.session } : s));
      setAttendanceId(null);
      setAttendanceStep(null);
    } catch {
      alert("Failed to mark attendance.");
    } finally {
      setAttendanceSaving(false);
    }
  }

  // schedules
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    student_id: "", teacher_id: "", subject: "quran", default_duration: "60",
    lessons_remaining: "",
    slots: {} as Record<string, { enabled: boolean; time: string; duration: string }>,
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleGenResult, setScheduleGenResult] = useState<ScheduleGeneration | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [scheduleActioning, setScheduleActioning] = useState<string | null>(null);
  const legacySessionCount = sessions.filter(s => !s.schedule_id && s.status === "scheduled" && new Date(s.scheduled_at) > new Date()).length;

  // message form
  const [msgForm, setMsgForm] = useState({ receiver_id: "", content: "" });
  const [sending, setSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  const handleLogout = async () => {
    await api.post("/auth/logout", {}).catch(() => {});
    localStorage.clear();
    document.cookie = "userRole=; path=/; max-age=0";
    router.push("/login");
  };

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/login"); return; }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      api.get("/admin/sessions", { headers }),
      api.get("/admin/students", { headers }),
      api.get("/admin/teachers", { headers }),
      api.get("/reschedule-requests?status=pending", { headers }),
      api.get("/admin/weekly-schedules", { headers }),
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
  }, [router]);

  // ─── Schedule handlers ────────────────────────────────────────────────────

  function openScheduleModal(schedule?: Schedule) {
    const slotState: Record<string, { enabled: boolean; time: string; duration: string }> = {};
    ALL_DAYS.forEach(d => { slotState[d] = { enabled: false, time: "16:00", duration: "" }; });

    if (schedule) {
      setEditingSchedule(schedule);
      for (const slot of schedule.slots) {
        slotState[slot.day] = { enabled: true, time: slot.time, duration: slot.duration ? String(slot.duration) : "" };
      }
      setScheduleForm({
        student_id: schedule.student_id,
        teacher_id: schedule.teacher_id,
        subject: schedule.subject,
        default_duration: String(schedule.default_duration),
        lessons_remaining: schedule.lessons_remaining != null ? String(schedule.lessons_remaining) : "",
        slots: slotState,
      });
    } else {
      setEditingSchedule(null);
      setScheduleForm({
        student_id: "", teacher_id: "", subject: "quran", default_duration: "60",
        lessons_remaining: "", slots: slotState,
      });
    }
    setScheduleError("");
    setScheduleGenResult(null);
    setShowScheduleModal(true);
  }

  async function handleSaveSchedule() {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const slots = ALL_DAYS
      .filter(d => scheduleForm.slots[d]?.enabled)
      .map(d => ({
        day: d,
        time: scheduleForm.slots[d].time,
        ...(scheduleForm.slots[d].duration ? { duration: parseInt(scheduleForm.slots[d].duration) } : {}),
      }));

    if (slots.length === 0) { setScheduleError("Select at least one day"); return; }
    if (!editingSchedule && (!scheduleForm.student_id || !scheduleForm.teacher_id)) {
      setScheduleError("Select a student and teacher"); return;
    }

    setScheduleSaving(true);
    setScheduleError("");
    try {
      if (editingSchedule) {
        const res = await api.patch(`/admin/weekly-schedules/${editingSchedule.id}`, {
          subject: scheduleForm.subject,
          default_duration: parseInt(scheduleForm.default_duration),
          slots,
          lessons_remaining: scheduleForm.lessons_remaining ? parseInt(scheduleForm.lessons_remaining) : null,
          teacher_id: scheduleForm.teacher_id !== editingSchedule.teacher_id ? scheduleForm.teacher_id : undefined,
        }, { headers: { Authorization: `Bearer ${token}` } });

        setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? { ...s, ...res.data.schedule } : s));
        if (res.data.generation) setScheduleGenResult(res.data.generation);
        // Refresh sessions list
        const sessRes = await api.get("/admin/sessions", { headers: { Authorization: `Bearer ${token}` } });
        setSessions(sessRes.data.sessions);
      } else {
        const res = await api.post("/admin/weekly-schedules", {
          student_id: scheduleForm.student_id,
          teacher_id: scheduleForm.teacher_id,
          subject: scheduleForm.subject,
          default_duration: parseInt(scheduleForm.default_duration),
          slots,
          lessons_remaining: scheduleForm.lessons_remaining ? parseInt(scheduleForm.lessons_remaining) : null,
        }, { headers: { Authorization: `Bearer ${token}` } });

        const student = students.find(s => s.id === scheduleForm.student_id);
        const teacher = teachers.find(t => t.id === scheduleForm.teacher_id);
        setSchedules(prev => [{ ...res.data.schedule, student_name: student?.display_name ?? "", teacher_name: teacher?.display_name ?? "" }, ...prev]);
        setScheduleGenResult(res.data.generation);
        // Refresh sessions list
        const sessRes = await api.get("/admin/sessions", { headers: { Authorization: `Bearer ${token}` } });
        setSessions(sessRes.data.sessions);
      }
      if (!scheduleGenResult) setShowScheduleModal(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setScheduleError(e.response?.data?.error || "Failed to save schedule.");
    } finally {
      setScheduleSaving(false);
    }
  }

  async function handleDeactivateSchedule(id: string) {
    const futureCount = sessions.filter(s => s.schedule_id === id && s.status === "scheduled" && new Date(s.scheduled_at) > new Date()).length;
    if (!confirm(`This will remove ${futureCount} future session${futureCount !== 1 ? "s" : ""}. The schedule will be moved to Archived. You can reactivate it later if needed.`)) return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setScheduleActioning(id);
    try {
      await api.delete(`/admin/weekly-schedules/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: false } : s));
      setSessions(prev => prev.filter(s => !(s.schedule_id === id && s.status === "scheduled" && new Date(s.scheduled_at) > new Date())));
    } catch {
      alert("Failed to deactivate schedule.");
    } finally {
      setScheduleActioning(null);
    }
  }

  async function handleReactivateSchedule(id: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setScheduleActioning(id);
    try {
      const res = await api.post(`/admin/weekly-schedules/${id}/reactivate`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: true } : s));
      setScheduleGenResult(res.data.generation);
      const sessRes = await api.get("/admin/sessions", { headers: { Authorization: `Bearer ${token}` } });
      setSessions(sessRes.data.sessions);
    } catch {
      alert("Failed to reactivate schedule.");
    } finally {
      setScheduleActioning(null);
    }
  }

  async function handleGenerateNow(id: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setScheduleActioning(id);
    try {
      const res = await api.post(`/admin/weekly-schedules/${id}/generate`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setScheduleGenResult(res.data.generation);
      if (res.data.generation.created > 0) {
        const sessRes = await api.get("/admin/sessions", { headers: { Authorization: `Bearer ${token}` } });
        setSessions(sessRes.data.sessions);
      }
    } catch {
      alert("Failed to generate sessions.");
    } finally {
      setScheduleActioning(null);
    }
  }

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
          subject: sessionForm.subject,
          zoom_link: sessionForm.zoom_link || undefined,
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
      setSessionForm({ student_id: "", teacher_id: "", scheduled_at: "", duration_minutes: "60", subject: "quran", zoom_link: "" });
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

  async function handleApproveRequest(rr: RescheduleRequest) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setRrActioning(rr.id);
    setRrError((p) => ({ ...p, [rr.id]: "" }));
    try {
      const res = await api.patch(`/reschedule-requests/${rr.id}/approve`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRescheduleRequests((prev) => prev.filter((r) => r.id !== rr.id));
      setRrResult((p) => ({ ...p, [rr.id]: { action: "approved", phone: rr.student_phone, proposedAt: rr.proposed_at } }));
      // Add the new session to the list
      const newSess = res.data.new_session;
      if (newSess) {
        const student = students.find((s) => s.id === newSess.student_id);
        const teacher = teachers.find((t) => t.id === newSess.teacher_id);
        setSessions((prev) => [{ ...newSess, student_name: student?.display_name ?? rr.student_name, teacher_name: teacher?.display_name ?? rr.teacher_name }, ...prev]);
      }
      // Mark original session as rescheduled in local state
      setSessions((prev) => prev.map((s) => s.id === rr.session_id ? { ...s, status: "rescheduled" } : s));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { code?: string; error?: string } } };
      if (e.response?.data?.code === "TEACHER_CONFLICT") {
        setRrError((p) => ({ ...p, [rr.id]: "Conflict detected — another session has been scheduled at this time. Please reject this request and ask the student to propose a different time." }));
      } else {
        setRrError((p) => ({ ...p, [rr.id]: e.response?.data?.error || "Failed to approve request." }));
      }
    } finally {
      setRrActioning(null);
    }
  }

  async function handleRejectRequest(rr: RescheduleRequest) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setRrActioning(rr.id);
    setRrError((p) => ({ ...p, [rr.id]: "" }));
    try {
      await api.patch(`/reschedule-requests/${rr.id}/reject`,
        { rejection_reason: rrRejectReason || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRescheduleRequests((prev) => prev.filter((r) => r.id !== rr.id));
      setRrResult((p) => ({ ...p, [rr.id]: { action: "rejected", phone: rr.student_phone, originalAt: rr.original_scheduled_at, reason: rrRejectReason } }));
      setRrRejectId(null);
      setRrRejectReason("");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setRrError((p) => ({ ...p, [rr.id]: e.response?.data?.error || "Failed to reject request." }));
    } finally {
      setRrActioning(null);
    }
  }

  function whatsAppUrl(phone: string | undefined, message: string) {
    const num = (phone || "").replace(/[^0-9]/g, "");
    if (!num) return null;
    return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
  }

  function openEditModal(s: Session) {
    setEditSession(s);
    const dt = new Date(s.scheduled_at);
    const dateStr = dt.toISOString().slice(0, 10);
    const timeStr = dt.toISOString().slice(11, 16);
    setEditForm({
      scheduled_at: `${dateStr}T${timeStr}`,
      duration_minutes: String(s.duration_minutes),
      subject: s.subject || "quran",
      teacher_id: s.teacher_id || "",
      zoom_link: s.zoom_link || "",
      notes: s.notes || "",
    });
    setEditError("");
    setEditWaMsg(null);
  }

  async function handleEditSession() {
    if (!editSession) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    // Confirmation for teacher change
    if (editForm.teacher_id && editForm.teacher_id !== editSession.teacher_id) {
      const newTeacher = teachers.find((t) => t.id === editForm.teacher_id);
      if (!confirm(`You are changing the teacher from ${editSession.teacher_name} to ${newTeacher?.display_name || "unknown"}. The student and both teachers will be notified.`)) return;
    }

    setEditSaving(true);
    setEditError("");
    try {
      const body: Record<string, unknown> = {};
      const orig = editSession;
      const newDt = new Date(editForm.scheduled_at).toISOString();
      if (newDt !== new Date(orig.scheduled_at).toISOString()) body.scheduled_at = newDt;
      if (parseInt(editForm.duration_minutes) !== orig.duration_minutes) body.duration_minutes = parseInt(editForm.duration_minutes);
      if (editForm.subject !== (orig.subject || "quran")) body.subject = editForm.subject;
      if (editForm.teacher_id !== orig.teacher_id) body.teacher_id = editForm.teacher_id;
      if (editForm.zoom_link !== (orig.zoom_link || "")) body.zoom_link = editForm.zoom_link;
      if (editForm.notes !== (orig.notes || "")) body.notes = editForm.notes;

      if (Object.keys(body).length === 0) { setEditSession(null); return; }

      const res = await api.patch(`/admin/sessions/${editSession.id}`, body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updated = res.data.session;
      setSessions((prev) => prev.map((s) => s.id === editSession.id ? updated : s));

      // Show WhatsApp button if time changed
      if (body.scheduled_at) {
        setEditWaMsg({ phone: updated.student_phone, time: body.scheduled_at as string });
      }
      setEditSession(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { code?: string; error?: string } } };
      if (e.response?.data?.code === "TEACHER_CONFLICT") {
        setEditError("The chosen teacher already has a session overlapping this time. Please pick a different time or teacher.");
      } else {
        setEditError(e.response?.data?.error || "Couldn't save changes. Please try again.");
      }
    } finally {
      setEditSaving(false);
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
                    data-testid="select-student"
                    className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  >
                    <option value="">Select student…</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                  </select>
                  <select
                    value={sessionForm.teacher_id}
                    onChange={(e) => setSessionForm((p) => ({ ...p, teacher_id: e.target.value }))}
                    data-testid="select-teacher"
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
                  <select
                    value={sessionForm.duration_minutes}
                    onChange={(e) => setSessionForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                    data-testid="select-duration"
                    className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  >
                    <option value={30}>30 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                  </select>
                  <select
                    value={sessionForm.subject}
                    onChange={(e) => setSessionForm((p) => ({ ...p, subject: e.target.value }))}
                    className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  >
                    <option value="quran">Quran</option>
                    <option value="arabic">Arabic</option>
                    <option value="islamic_studies">Islamic Studies</option>
                  </select>
                  <input
                    type="url"
                    value={sessionForm.zoom_link}
                    onChange={(e) => setSessionForm((p) => ({ ...p, zoom_link: e.target.value }))}
                    placeholder="Zoom link (optional)"
                    className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
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

            {/* Reschedule Requests */}
            {(rescheduleRequests.length > 0 || Object.keys(rrResult).length > 0) && (
              <div className="mb-6">
                <h3 className="font-display text-lg font-bold text-charcoal mb-3 flex items-center gap-2">
                  <RefreshCw size={18} className="text-amber-500" />
                  Reschedule Requests
                  {rescheduleRequests.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                      {rescheduleRequests.length} pending
                    </span>
                  )}
                </h3>
                <div className="space-y-2">
                  {rescheduleRequests.map((rr) => (
                    <div key={rr.id} className="bg-white rounded-2xl border border-amber-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <p className="font-semibold text-charcoal text-sm">
                            {rr.student_name} <span className="text-charcoal/40 font-normal">· {rr.student_email}</span>
                          </p>
                          <p className="text-charcoal/60 text-xs">Teacher: {rr.teacher_name} · {rr.subject ? (rr.subject === "quran" ? "Quran" : rr.subject === "arabic" ? "Arabic" : "Islamic Studies") : ""}</p>
                          <p className="text-charcoal/50 text-xs">
                            Current: {formatSessionTime(rr.original_scheduled_at)}
                          </p>
                          <p className="text-emerald-primary text-xs font-medium">
                            Proposed: {formatSessionTime(rr.proposed_at)}
                          </p>
                          <p className="text-charcoal/30 text-xs">{formatRelative(rr.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {rrRejectId === rr.id ? null : (
                            <>
                              <button
                                onClick={() => handleApproveRequest(rr)}
                                disabled={rrActioning === rr.id}
                                className="px-3 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                              >
                                {rrActioning === rr.id ? "…" : "Approve"}
                              </button>
                              <button
                                onClick={() => setRrRejectId(rr.id)}
                                disabled={rrActioning === rr.id}
                                className="px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs font-semibold hover:border-red-300 hover:text-red-500 disabled:opacity-60 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {rrRejectId === rr.id && (
                        <div className="mt-3 pt-3 border-t border-black/5 space-y-2">
                          <textarea
                            value={rrRejectReason}
                            onChange={(e) => setRrRejectReason(e.target.value)}
                            placeholder="Reason for rejection (optional)"
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRejectRequest(rr)}
                              disabled={rrActioning === rr.id}
                              className="px-4 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                            >
                              {rrActioning === rr.id ? "Rejecting…" : "Confirm Reject"}
                            </button>
                            <button
                              onClick={() => { setRrRejectId(null); setRrRejectReason(""); }}
                              className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {rrError[rr.id] && (
                        <p className="mt-2 text-red-500 text-xs">{rrError[rr.id]}</p>
                      )}
                    </div>
                  ))}
                  {/* Completed action results with wa.me buttons */}
                  {Object.entries(rrResult).map(([id, result]) => {
                    const waMsg = result.action === "approved"
                      ? `Assalamu alaikum! Your session has been rescheduled to ${formatSessionTime(result.proposedAt || "")}. See you then insha'Allah! — My Institute`
                      : `Assalamu alaikum, unfortunately your reschedule request for ${formatSessionTime(result.originalAt || "")} could not be approved.${result.reason ? ` ${result.reason}` : ""} Please contact us to arrange an alternative. — My Institute`;
                    const url = whatsAppUrl(result.phone, waMsg);
                    return (
                      <div key={id} className="bg-white rounded-2xl border border-black/5 p-4 flex items-center justify-between gap-4">
                        <p className={`text-sm font-medium ${result.action === "approved" ? "text-emerald-primary" : "text-charcoal/60"}`}>
                          {result.action === "approved" ? "Approved ✓" : "Rejected"}
                        </p>
                        <div className="flex items-center gap-2">
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors"
                            >
                              Send WhatsApp to student →
                            </a>
                          )}
                          <button
                            onClick={() => setRrResult((p) => { const n = { ...p }; delete n[id]; return n; })}
                            className="text-charcoal/30 hover:text-charcoal/60 transition-colors"
                          >
                            <XIcon size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
                {sessions.map((s) => {
                  const isPast = new Date(s.scheduled_at) < new Date();
                  const needsAttendance = s.status === "scheduled" && isPast && s.teacher_attended == null;
                  return (
                  <div key={s.id} className="bg-white rounded-2xl border border-black/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-charcoal text-sm truncate">
                          {s.student_name} ↔ {s.teacher_name}
                        </p>
                        <p className="text-charcoal/50 text-xs mt-0.5">
                          {formatSessionTime(s.scheduled_at)} · {s.duration_minutes} min
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.schedule_id && (
                          <Repeat size={12} className="text-emerald-primary/40" />
                        )}
                        {s.teacher_attended != null && (
                          <span className="text-xs text-charcoal/30 flex items-center gap-0.5">
                            {s.teacher_attended ? "T✓" : "T✗"}
                            {s.student_attended != null && (s.student_attended ? " S✓" : " S✗")}
                          </span>
                        )}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusStyle[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {s.status === "cancelled_teacher" ? "teacher cancelled" : s.status === "no_show" ? "no show" : s.status}
                        </span>
                        {s.status === "scheduled" && !isPast && (
                          <>
                            <button
                              onClick={() => openEditModal(s)}
                              className="p-1.5 rounded-lg text-charcoal/30 hover:text-emerald-primary hover:bg-emerald-primary/5 transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteSession(s.id)}
                              disabled={deleting === s.id}
                              className="p-1.5 rounded-lg text-charcoal/30 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {needsAttendance && (
                          <button
                            onClick={() => { setAttendanceId(s.id); setAttendanceStep("teacher"); }}
                            className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium hover:bg-amber-200 transition-colors"
                          >
                            Mark Attendance
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Inline attendance override */}
                    {attendanceId === s.id && (
                      <div className="mt-3 pt-3 border-t border-black/5">
                        {attendanceStep === "teacher" && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-charcoal">Did the teacher attend?</p>
                            <div className="flex gap-2">
                              <button onClick={() => setAttendanceStep("student")} disabled={attendanceSaving}
                                className="px-3 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                                Yes
                              </button>
                              <button onClick={() => handleAdminAttendance(s.id, false, false)} disabled={attendanceSaving}
                                className="px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">
                                No (Teacher Cancelled)
                              </button>
                              <button onClick={() => { setAttendanceId(null); setAttendanceStep(null); }}
                                className="px-3 py-1.5 rounded-full border border-black/10 text-charcoal/40 text-xs transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {attendanceStep === "student" && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-charcoal">Did the student attend?</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleAdminAttendance(s.id, true, true)} disabled={attendanceSaving}
                                className="px-3 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                                Yes (Completed)
                              </button>
                              <button onClick={() => handleAdminAttendance(s.id, true, false)} disabled={attendanceSaving}
                                className="px-3 py-1.5 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors">
                                No (No-Show)
                              </button>
                              <button onClick={() => setAttendanceStep("teacher")}
                                className="px-3 py-1.5 rounded-full border border-black/10 text-charcoal/40 text-xs transition-colors">
                                Back
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Schedules tab */}
        {activeTab === "schedules" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-charcoal">Weekly Schedules</h2>
              <button
                onClick={() => openScheduleModal()}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
              >
                <Plus size={16} /> Add Schedule
              </button>
            </div>

            {/* Generation result banner */}
            {scheduleGenResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4 flex items-center justify-between">
                <p className="text-emerald-primary text-sm">
                  {scheduleGenResult.created > 0 ? `${scheduleGenResult.created} sessions generated.` : "No new sessions needed."}
                  {scheduleGenResult.skipped > 0 && ` ${scheduleGenResult.skipped} skipped.`}
                  {scheduleGenResult.conflicts.length > 0 && ` ${scheduleGenResult.conflicts.length} conflict(s).`}
                </p>
                <button onClick={() => setScheduleGenResult(null)} className="text-emerald-primary/40 hover:text-emerald-primary">
                  <XIcon size={14} />
                </button>
              </div>
            )}

            {/* Legacy session warning banner */}
            {legacySessionCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
                <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                <p className="text-amber-700 text-sm">
                  <strong>{legacySessionCount} legacy session{legacySessionCount !== 1 ? "s" : ""}</strong> exist that aren&apos;t linked to a schedule. These were created before the schedule system. They will continue to work normally.
                </p>
              </div>
            )}

            {/* Active schedules */}
            {schedules.filter(s => s.is_active).length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-charcoal/30 mb-6">
                <Repeat size={32} className="mx-auto mb-3 text-charcoal/20" />
                <p>No active schedules. Click &quot;Add Schedule&quot; to create one.</p>
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {schedules.filter(s => s.is_active).map(sched => (
                  <div key={sched.id} className="bg-white rounded-2xl border border-black/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-charcoal text-sm">
                          {sched.student_name} <span className="text-charcoal/30">↔</span> {sched.teacher_name}
                        </p>
                        <p className="text-charcoal/50 text-xs mt-0.5">
                          {sched.subject === "quran" ? "Quran" : sched.subject === "arabic" ? "Arabic" : sched.subject === "islamic_studies" ? "Islamic Studies" : sched.subject}
                          {" · "}
                          {sched.slots.map(sl => `${DAY_LABELS[sl.day] || sl.day} ${sl.time}`).join(", ")}
                          {" · "}
                          {sched.default_duration} min
                        </p>
                        {sched.lessons_remaining != null && (
                          <p className={`text-xs mt-0.5 font-medium ${sched.lessons_remaining <= 2 ? "text-amber-600" : "text-charcoal/40"}`}>
                            {sched.lessons_remaining} lesson{sched.lessons_remaining !== 1 ? "s" : ""} remaining
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openScheduleModal(sched)}
                          disabled={scheduleActioning === sched.id}
                          className="p-1.5 rounded-lg text-charcoal/30 hover:text-emerald-primary hover:bg-emerald-primary/5 transition-colors"
                          title="Edit schedule"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleGenerateNow(sched.id)}
                          disabled={scheduleActioning === sched.id}
                          className="p-1.5 rounded-lg text-charcoal/30 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                          title="Generate sessions now"
                        >
                          <Play size={14} />
                        </button>
                        <button
                          onClick={() => handleDeactivateSchedule(sched.id)}
                          disabled={scheduleActioning === sched.id}
                          className="p-1.5 rounded-lg text-charcoal/30 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Deactivate"
                        >
                          <Archive size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Archived schedules */}
            {schedules.filter(s => !s.is_active).length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="flex items-center gap-2 text-charcoal/40 text-sm hover:text-charcoal/60 transition-colors mb-2"
                >
                  <ChevronDown size={14} className={`transition-transform ${showArchived ? "rotate-180" : ""}`} />
                  Archived ({schedules.filter(s => !s.is_active).length})
                </button>
                {showArchived && (
                  <div className="space-y-2">
                    {schedules.filter(s => !s.is_active).map(sched => (
                      <div key={sched.id} className="bg-white/60 rounded-2xl border border-black/5 p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-charcoal/50 text-sm">
                            {sched.student_name} ↔ {sched.teacher_name}
                          </p>
                          <p className="text-charcoal/30 text-xs mt-0.5">
                            {sched.subject} · {sched.slots.map(sl => `${DAY_LABELS[sl.day] || sl.day} ${sl.time}`).join(", ")}
                          </p>
                        </div>
                        <button
                          onClick={() => handleReactivateSchedule(sched.id)}
                          disabled={scheduleActioning === sched.id}
                          className="px-3 py-1.5 rounded-full border border-emerald-primary/30 text-emerald-primary text-xs font-semibold hover:bg-emerald-primary/5 disabled:opacity-60 transition-colors"
                        >
                          {scheduleActioning === sched.id ? "…" : "Reactivate"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-white rounded-2xl border border-black/5 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-charcoal mb-4">
              {editingSchedule ? "Edit Schedule" : "Add Weekly Schedule"}
            </h3>

            <div className="space-y-3">
              {/* Student & Teacher (disabled when editing) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-charcoal/60 mb-1">Student</label>
                  <select
                    value={scheduleForm.student_id}
                    onChange={(e) => setScheduleForm(p => ({ ...p, student_id: e.target.value }))}
                    disabled={!!editingSchedule}
                    className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 disabled:opacity-50"
                  >
                    <option value="">Select student…</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-charcoal/60 mb-1">Teacher</label>
                  <select
                    value={scheduleForm.teacher_id}
                    onChange={(e) => setScheduleForm(p => ({ ...p, teacher_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  >
                    <option value="">Select teacher…</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                  </select>
                </div>
              </div>

              {/* Subject & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-charcoal/60 mb-1">Subject</label>
                  <input
                    type="text"
                    value={scheduleForm.subject}
                    onChange={(e) => setScheduleForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder="e.g. Quran, Arabic, Math"
                    className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-charcoal/60 mb-1">Default Duration</label>
                  <select
                    value={scheduleForm.default_duration}
                    onChange={(e) => setScheduleForm(p => ({ ...p, default_duration: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  >
                    <option value="30">30 min</option>
                    <option value="60">60 min</option>
                    <option value="90">90 min</option>
                    <option value="120">120 min</option>
                  </select>
                </div>
              </div>

              {/* Lessons remaining */}
              <div>
                <label className="block text-xs text-charcoal/60 mb-1">Lessons Remaining (optional)</label>
                <input
                  type="number"
                  min="0"
                  value={scheduleForm.lessons_remaining}
                  onChange={(e) => setScheduleForm(p => ({ ...p, lessons_remaining: e.target.value }))}
                  placeholder="Leave blank for unlimited"
                  className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                />
              </div>

              {/* Day/Time grid */}
              <div>
                <label className="block text-xs text-charcoal/60 mb-2">Select Days & Times</label>
                <div className="space-y-2">
                  {ALL_DAYS.map(day => {
                    const slot = scheduleForm.slots[day] || { enabled: false, time: "16:00", duration: "" };
                    return (
                      <div key={day} className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${slot.enabled ? "bg-emerald-primary/5" : "bg-black/[0.02]"}`}>
                        <label className="flex items-center gap-2 w-12 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={slot.enabled}
                            onChange={(e) => setScheduleForm(p => ({
                              ...p,
                              slots: { ...p.slots, [day]: { ...slot, enabled: e.target.checked } },
                            }))}
                            className="rounded border-black/20 text-emerald-primary focus:ring-emerald-primary/30"
                          />
                          <span className="text-sm font-medium text-charcoal">{DAY_LABELS[day]}</span>
                        </label>
                        {slot.enabled && (
                          <>
                            <input
                              type="time"
                              value={slot.time}
                              onChange={(e) => setScheduleForm(p => ({
                                ...p,
                                slots: { ...p.slots, [day]: { ...slot, time: e.target.value } },
                              }))}
                              className="px-2 py-1 rounded-lg border border-black/10 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                            />
                            <select
                              value={slot.duration}
                              onChange={(e) => setScheduleForm(p => ({
                                ...p,
                                slots: { ...p.slots, [day]: { ...slot, duration: e.target.value } },
                              }))}
                              className="px-2 py-1 rounded-lg border border-black/10 bg-white text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                            >
                              <option value="">Default ({scheduleForm.default_duration} min)</option>
                              <option value="30">30 min</option>
                              <option value="60">60 min</option>
                              <option value="90">90 min</option>
                              <option value="120">120 min</option>
                            </select>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {scheduleError && <p className="text-red-500 text-xs mt-3">{scheduleError}</p>}

            {scheduleGenResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-3">
                <p className="text-emerald-primary text-xs font-medium">
                  {scheduleGenResult.created} session{scheduleGenResult.created !== 1 ? "s" : ""} generated
                  {scheduleGenResult.conflicts.length > 0 && ` (${scheduleGenResult.conflicts.length} conflict${scheduleGenResult.conflicts.length !== 1 ? "s" : ""} skipped)`}
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveSchedule}
                disabled={scheduleSaving}
                className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
              >
                {scheduleSaving ? "Saving…" : editingSchedule ? "Save Changes" : "Create Schedule"}
              </button>
              <button
                onClick={() => { setShowScheduleModal(false); setScheduleGenResult(null); }}
                className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
              >
                {scheduleGenResult ? "Done" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit session modal */}
      {editSession && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditSession(null)}>
          <div className="bg-white rounded-2xl border border-black/5 p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-charcoal mb-4">Edit Session</h3>
            <p className="text-charcoal/50 text-xs mb-4">{editSession.student_name} ↔ {editSession.teacher_name}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-charcoal/60 mb-1">Date &amp; Time</label>
                <input type="datetime-local" value={editForm.scheduled_at}
                  onChange={(e) => setEditForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
              </div>
              <div>
                <label className="block text-xs text-charcoal/60 mb-1">Duration</label>
                <select value={editForm.duration_minutes}
                  onChange={(e) => setEditForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30">
                  <option value="30">30 min</option><option value="60">60 min</option>
                  <option value="90">90 min</option><option value="120">120 min</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-charcoal/60 mb-1">Subject</label>
                <select value={editForm.subject}
                  onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30">
                  <option value="quran">Quran</option><option value="arabic">Arabic</option>
                  <option value="islamic_studies">Islamic Studies</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-charcoal/60 mb-1">Teacher</label>
                <select value={editForm.teacher_id}
                  onChange={(e) => setEditForm((p) => ({ ...p, teacher_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30">
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-charcoal/60 mb-1">Zoom Link</label>
                <input type="url" value={editForm.zoom_link} placeholder="https://zoom.us/..."
                  onChange={(e) => setEditForm((p) => ({ ...p, zoom_link: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-charcoal/60 mb-1">Notes</label>
                <textarea value={editForm.notes} rows={2} placeholder="Admin notes..."
                  onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 resize-none" />
              </div>
            </div>
            {editError && <p className="text-red-500 text-xs mt-3">{editError}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={handleEditSession} disabled={editSaving}
                className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => setEditSession(null)}
                className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
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
