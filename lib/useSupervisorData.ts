"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { getAxiosError } from "@/lib/errors";
import type { Session } from "@/components/supervisor/SessionCard";
import type { Schedule, ScheduleGeneration } from "@/components/supervisor/ScheduleModal";
import type { RescheduleRequest } from "@/components/supervisor/SessionsTab";
import type { User } from "@/app/supervisor/page";

function isFutureScheduledSessionOf(session: Session, scheduleId: string) {
  return session.schedule_id === scheduleId && session.status === "scheduled" && new Date(session.scheduled_at) > new Date();
}

function reportError(err: unknown) {
  alert(getAxiosError(err).message);
}

export function useSupervisorData(authChecked: boolean) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [rescheduleRequests, setRescheduleRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scheduleGenResult, setScheduleGenResult] = useState<ScheduleGeneration | null>(null);
  const [scheduleActioning, setScheduleActioning] = useState<string | null>(null);

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
      .catch((err) => {
        console.error("useSupervisorData: failed to load dashboard data", err);
        setError("Failed to load data. You may not have permission.");
      })
      .finally(() => setLoading(false));
  }, [authChecked]);

  async function handleDeactivateSchedule(id: string) {
    const futureCount = sessions.filter(s => isFutureScheduledSessionOf(s, id)).length;
    if (!confirm(`This will remove ${futureCount} future session${futureCount !== 1 ? "s" : ""}. The schedule will be moved to Archived. You can reactivate it later if needed.`)) return;

    setScheduleActioning(id);
    try {
      await api.delete(`/admin/weekly-schedules/${id}`);
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: false } : s));
      setSessions(prev => prev.filter(s => !isFutureScheduledSessionOf(s, id)));
    } catch (err) {
      reportError(err);
    } finally {
      setScheduleActioning(null);
    }
  }

  async function handleReactivateSchedule(id: string) {
    setScheduleActioning(id);
    try {
      const res = await api.post(`/admin/weekly-schedules/${id}/reactivate`, {});
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: true } : s));
      setScheduleGenResult(res.data.generation);
      const sessRes = await api.get("/admin/sessions");
      setSessions(sessRes.data.sessions);
    } catch (err) {
      reportError(err);
    } finally {
      setScheduleActioning(null);
    }
  }

  async function handleGenerateNow(id: string) {
    setScheduleActioning(id);
    try {
      const res = await api.post(`/admin/weekly-schedules/${id}/generate`, {});
      setScheduleGenResult(res.data.generation);
      if (res.data.generation.created > 0) {
        const sessRes = await api.get("/admin/sessions");
        setSessions(sessRes.data.sessions);
      }
    } catch (err) {
      reportError(err);
    } finally {
      setScheduleActioning(null);
    }
  }

  return {
    sessions, setSessions,
    students, teachers,
    schedules, setSchedules,
    rescheduleRequests, setRescheduleRequests,
    loading, error,
    scheduleGenResult, setScheduleGenResult,
    scheduleActioning,
    handleDeactivateSchedule,
    handleReactivateSchedule,
    handleGenerateNow,
  };
}
