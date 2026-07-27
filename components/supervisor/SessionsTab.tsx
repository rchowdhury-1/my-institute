import { useState, useEffect, useMemo, useCallback } from "react";
import api from "@/lib/api";
import { startOfWeek, format, addWeeks } from "date-fns";
import { Plus, Calendar, ChevronDown, List } from "lucide-react";
import UserSearchInput from "@/components/shared/UserSearchInput";
import SessionCalendar from "@/components/shared/SessionCalendar";
import RescheduleRequestList from "@/components/shared/RescheduleRequestList";
import { isSessionStillUpcoming, zonedInputToISO, otherZoneHint, OPERATIONAL_TZ_LABEL } from "@/lib/datetime";
import { getAxiosError } from "@/lib/errors";
import { SESSION_STATUS_LABEL, DURATION_OPTIONS } from "@/lib/labels";
import SessionCard, { type Session } from "./SessionCard";
import type { User } from "@/app/supervisor/page";
import type { RescheduleRequest } from "@/lib/useRescheduleRequests";

export type { RescheduleRequest };

const ALL_STATUSES = Object.keys(SESSION_STATUS_LABEL);

interface SessionsTabProps {
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  students: User[];
  teachers: User[];
  rescheduleRequests: RescheduleRequest[];
  setRescheduleRequests: React.Dispatch<React.SetStateAction<RescheduleRequest[]>>;
  onEditSession: (session: Session) => void;
}

export default function SessionsTab({
  sessions,
  setSessions,
  students,
  teachers,
  rescheduleRequests,
  setRescheduleRequests,
  onEditSession,
}: SessionsTabProps) {
  // create session form
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionForm, setSessionForm] = useState({ student_id: "", teacher_id: "", scheduled_at: "", duration_minutes: "60", subject: "quran", zoom_link: "" });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // calendar view
  const [sessionsView, setSessionsView] = useState<"list" | "calendar">("list");
  const [calendarMode, setCalendarMode] = useState<"week" | "month">("week");
  const [calendarTeacherId, setCalendarTeacherId] = useState<string>("");

  // session filters (read from URL on mount)
  const [filterTeacherId, setFilterTeacherId] = useState<string>("");
  const [filterStudentId, setFilterStudentId] = useState<string>("");
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set(ALL_STATUSES));

  // Restore filters from URL params on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("teacher")) setFilterTeacherId(params.get("teacher")!);
    if (params.get("student")) setFilterStudentId(params.get("student")!);
    if (params.get("status")) setFilterStatuses(new Set(params.get("status")!.split(",")));
  }, []);
  const [showPast, setShowPast] = useState(false);

  // attendance override
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [attendanceStep, setAttendanceStep] = useState<"teacher" | "student" | null>(null);
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  // URL param sync for filters
  const updateFilterParams = useCallback((teacher: string, student: string, statuses: Set<string>) => {
    const params = new URLSearchParams();
    if (teacher) params.set("teacher", teacher);
    if (student) params.set("student", student);
    if (statuses.size < ALL_STATUSES.length) params.set("status", Array.from(statuses).join(","));
    const qs = params.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, []);

  function handleFilterTeacher(id: string) { setFilterTeacherId(id); updateFilterParams(id, filterStudentId, filterStatuses); }
  function handleFilterStudent(id: string) { setFilterStudentId(id); updateFilterParams(filterTeacherId, id, filterStatuses); }
  function toggleFilterStatus(status: string) {
    setFilterStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      updateFilterParams(filterTeacherId, filterStudentId, next);
      return next;
    });
  }
  function clearFilters() {
    setFilterTeacherId(""); setFilterStudentId(""); setFilterStatuses(new Set(ALL_STATUSES));
    updateFilterParams("", "", new Set(ALL_STATUSES));
  }

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (filterTeacherId && s.teacher_id !== filterTeacherId) return false;
      if (filterStudentId && s.student_id !== filterStudentId) return false;
      if (!filterStatuses.has(s.status)) return false;
      return true;
    });
  }, [sessions, filterTeacherId, filterStudentId, filterStatuses]);

  // Group by week
  const sessionWeeks = useMemo(() => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const groups = new Map<string, { label: string; sessions: typeof filteredSessions; isPast: boolean }>();
    const pastSessions: typeof filteredSessions = [];

    for (const s of filteredSessions) {
      const d = new Date(s.scheduled_at);
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      const weekEnd = addWeeks(weekStart, 1);
      weekEnd.setMilliseconds(weekEnd.getMilliseconds() - 1);

      if (weekStart < currentWeekStart) {
        pastSessions.push(s);
        continue;
      }

      const key = format(weekStart, "yyyy-MM-dd");
      if (!groups.has(key)) {
        const label = `Week of ${format(weekStart, "EEE d MMM")} – ${format(weekEnd, "EEE d MMM")}`;
        groups.set(key, { label, sessions: [], isPast: false });
      }
      groups.get(key)!.sessions.push(s);
    }

    // Sort weeks chronologically
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

    return { weeks: sorted, pastSessions, currentWeekKey: format(currentWeekStart, "yyyy-MM-dd") };
  }, [filteredSessions]);

  const hasActiveFilters = filterTeacherId || filterStudentId || filterStatuses.size < ALL_STATUSES.length;

  async function handleAdminAttendance(sessionId: string, teacherAttended: boolean, studentAttended: boolean) {
    setAttendanceSaving(true);
    try {
      const res = await api.patch(`/sessions/${sessionId}/attendance`,
        { teacher_attended: teacherAttended, student_attended: studentAttended }
      );
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...res.data.session } : s));
      setAttendanceId(null);
      setAttendanceStep(null);
    } catch (err) {
      alert(getAxiosError(err).message);
    } finally {
      setAttendanceSaving(false);
    }
  }

  async function handleCreateSession() {
    setCreating(true);
    try {
      const res = await api.post("/sessions",
        {
          student_id: sessionForm.student_id,
          teacher_id: sessionForm.teacher_id,
          scheduled_at: zonedInputToISO(sessionForm.scheduled_at),
          duration_minutes: parseInt(sessionForm.duration_minutes) || 30,
          subject: sessionForm.subject,
          zoom_link: sessionForm.zoom_link || undefined,
        }
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
    } catch (err) {
      alert(getAxiosError(err).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteSession(id: string) {
    if (!confirm("Delete this session?")) return;
    setDeleting(id);
    try {
      await api.delete(`/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(getAxiosError(err).message);
    } finally {
      setDeleting(null);
    }
  }

  function handleRescheduleApproved(rr: RescheduleRequest, data: { new_session?: unknown }) {
    // Add the new session to the list
    const newSess = data.new_session as (Session & { student_id: string; teacher_id: string }) | undefined;
    if (newSess) {
      const student = students.find((s) => s.id === newSess.student_id);
      const teacher = teachers.find((t) => t.id === newSess.teacher_id);
      setSessions((prev) => [{ ...newSess, student_name: student?.display_name ?? rr.student_name, teacher_name: teacher?.display_name ?? rr.teacher_name }, ...prev]);
    }
    // Mark original session as rescheduled in local state
    setSessions((prev) => prev.map((s) => s.id === rr.session_id ? { ...s, status: "rescheduled" } : s));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-xl font-bold text-charcoal">All Sessions</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-black/10 overflow-hidden">
            <button
              onClick={() => setSessionsView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                sessionsView === "list" ? "bg-emerald-primary text-white" : "text-charcoal/60 hover:bg-black/5"
              }`}
            >
              <List size={13} /> List
            </button>
            <button
              onClick={() => setSessionsView("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                sessionsView === "calendar" ? "bg-emerald-primary text-white" : "text-charcoal/60 hover:bg-black/5"
              }`}
            >
              <Calendar size={13} /> Calendar
            </button>
          </div>
          <button
            onClick={() => setShowSessionForm(!showSessionForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
          >
            <Plus size={16} /> Add Session
          </button>
        </div>
      </div>

      {/* Calendar view with teacher filter */}
      {sessionsView === "calendar" && (
        <div className="mb-6">
          <div className="mb-3">
            <label className="text-xs font-medium text-charcoal/60 mb-1 block">Filter by teacher</label>
            <select
              value={calendarTeacherId}
              onChange={(e) => setCalendarTeacherId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 w-full max-w-xs"
            >
              <option value="">All teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.display_name}</option>
              ))}
            </select>
          </div>
          <SessionCalendar
            sessions={calendarTeacherId ? filteredSessions.filter(s => s.teacher_id === calendarTeacherId) : filteredSessions}
            mode={calendarMode}
            onModeChange={setCalendarMode}
            nameField="student_name"
          />
        </div>
      )}

      {sessionsView === "list" && <>
      {showSessionForm && (
        <div className="bg-white rounded-2xl border border-black/5 p-5 mb-6">
          <h3 className="font-semibold text-charcoal mb-3">New Session</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UserSearchInput
              users={students}
              value={sessionForm.student_id}
              onChange={(id) => setSessionForm((p) => ({ ...p, student_id: id }))}
              placeholder="Search student…"
            />
            <UserSearchInput
              users={teachers}
              value={sessionForm.teacher_id}
              onChange={(id) => setSessionForm((p) => ({ ...p, teacher_id: id }))}
              placeholder="Search teacher…"
            />
            <div>
              <input
                type="datetime-local"
                value={sessionForm.scheduled_at}
                onChange={(e) => setSessionForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                aria-label={`Date and time (${OPERATIONAL_TZ_LABEL})`}
                className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
              />
              <p className="text-[10px] text-charcoal/40 mt-1">
                {OPERATIONAL_TZ_LABEL}{sessionForm.scheduled_at ? ` · ${otherZoneHint(sessionForm.scheduled_at)}` : ""}
              </p>
            </div>
            <select
              value={sessionForm.duration_minutes}
              onChange={(e) => setSessionForm((p) => ({ ...p, duration_minutes: e.target.value }))}
              data-testid="select-duration"
              className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
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
      <RescheduleRequestList
        variant="detailed"
        requests={rescheduleRequests}
        setRequests={setRescheduleRequests}
        onApproved={handleRescheduleApproved}
      />

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-black/5 p-3 mb-4 flex flex-wrap items-center gap-2">
        <select
          value={filterTeacherId}
          onChange={(e) => handleFilterTeacher(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-black/10 bg-cream text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
        >
          <option value="">All teachers</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
        </select>
        <div className="w-48">
          <UserSearchInput
            users={students}
            value={filterStudentId}
            onChange={handleFilterStudent}
            placeholder="Filter student…"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {ALL_STATUSES.map(st => (
            <button
              key={st}
              onClick={() => toggleFilterStatus(st)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                filterStatuses.has(st)
                  ? "bg-emerald-primary/10 border-emerald-primary/30 text-emerald-primary"
                  : "bg-gray-50 border-gray-200 text-gray-400"
              }`}
            >
              {SESSION_STATUS_LABEL[st]}
            </button>
          ))}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-2.5 py-1 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors"
          >
            Clear
          </button>
        )}
        <span className="text-[10px] text-charcoal/30 ml-auto">
          {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-charcoal/30">
          <Calendar size={32} className="mx-auto mb-3 text-charcoal/20" />
          {hasActiveFilters ? (
            <>
              <p>No sessions match your filters</p>
              <button onClick={clearFilters} className="mt-2 text-xs text-emerald-primary hover:underline">Clear filters</button>
            </>
          ) : (
            <p>No sessions yet.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Past sessions toggle */}
          {sessionWeeks.pastSessions.length > 0 && (
            <div>
              <button
                onClick={() => setShowPast(!showPast)}
                className="flex items-center gap-2 text-sm font-medium text-charcoal/50 hover:text-charcoal transition-colors mb-2"
              >
                <ChevronDown size={14} className={`transition-transform ${showPast ? "rotate-0" : "-rotate-90"}`} />
                Past sessions ({sessionWeeks.pastSessions.length})
              </button>
              {showPast && (
                <div className="space-y-2 mb-4">
                  {sessionWeeks.pastSessions.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()).map((s) => {
                    const isPast = true;
                    const needsAttendance = s.status === "scheduled" && isPast && s.teacher_attended == null;
                    return (
                      <SessionCard
                        key={s.id}
                        session={s}
                        isPast={isPast}
                        needsAttendance={needsAttendance}
                        deleting={deleting}
                        attendanceId={attendanceId}
                        attendanceStep={attendanceStep}
                        attendanceSaving={attendanceSaving}
                        onEdit={onEditSession}
                        onDelete={handleDeleteSession}
                        onStartAttendance={(id) => { setAttendanceId(id); setAttendanceStep("teacher"); }}
                        onCancelAttendance={() => { setAttendanceId(null); setAttendanceStep(null); }}
                        onAdvanceToStudentStep={() => setAttendanceStep("student")}
                        onAttendanceStepBack={() => setAttendanceStep("teacher")}
                        onAdminAttendance={handleAdminAttendance}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Week groups */}
          {sessionWeeks.weeks.map(([weekKey, group]) => {
            const isCurrent = weekKey === sessionWeeks.currentWeekKey;
            return (
              <div key={weekKey}>
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2 ${
                  isCurrent ? "text-emerald-primary" : "text-charcoal/40"
                }`}>
                  {isCurrent && <span className="w-2 h-2 rounded-full bg-emerald-primary inline-block" />}
                  {group.label}
                  <span className="text-charcoal/20 font-normal normal-case">({group.sessions.length})</span>
                </h3>
                <div className="space-y-2">
                  {group.sessions.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).map((s) => {
                    const isPast = !isSessionStillUpcoming(s.scheduled_at, s.duration_minutes);
                    const needsAttendance = s.status === "scheduled" && isPast && s.teacher_attended == null;
                    return (
                      <SessionCard
                        key={s.id}
                        session={s}
                        isPast={isPast}
                        needsAttendance={needsAttendance}
                        deleting={deleting}
                        attendanceId={attendanceId}
                        attendanceStep={attendanceStep}
                        attendanceSaving={attendanceSaving}
                        onEdit={onEditSession}
                        onDelete={handleDeleteSession}
                        onStartAttendance={(id) => { setAttendanceId(id); setAttendanceStep("teacher"); }}
                        onCancelAttendance={() => { setAttendanceId(null); setAttendanceStep(null); }}
                        onAdvanceToStudentStep={() => setAttendanceStep("student")}
                        onAttendanceStepBack={() => setAttendanceStep("teacher")}
                        onAdminAttendance={handleAdminAttendance}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>}
    </div>
  );
}
