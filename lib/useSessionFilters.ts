"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Session } from "@/components/supervisor/SessionCard";

export function useSessionFilters(sessions: Session[], allStatuses: string[]) {
  const [filterTeacherId, setFilterTeacherId] = useState<string>("");
  const [filterStudentId, setFilterStudentId] = useState<string>("");
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set(allStatuses));

  // Restore filters from URL params on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("teacher")) setFilterTeacherId(params.get("teacher")!);
    if (params.get("student")) setFilterStudentId(params.get("student")!);
    if (params.get("status")) setFilterStatuses(new Set(params.get("status")!.split(",")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFilterParams = useCallback((teacher: string, student: string, statuses: Set<string>) => {
    const params = new URLSearchParams();
    if (teacher) params.set("teacher", teacher);
    if (student) params.set("student", student);
    if (statuses.size < allStatuses.length) params.set("status", Array.from(statuses).join(","));
    const qs = params.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setFilterTeacherId(""); setFilterStudentId(""); setFilterStatuses(new Set(allStatuses));
    updateFilterParams("", "", new Set(allStatuses));
  }

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (filterTeacherId && s.teacher_id !== filterTeacherId) return false;
      if (filterStudentId && s.student_id !== filterStudentId) return false;
      if (!filterStatuses.has(s.status)) return false;
      return true;
    });
  }, [sessions, filterTeacherId, filterStudentId, filterStatuses]);

  const hasActiveFilters = Boolean(filterTeacherId || filterStudentId || filterStatuses.size < allStatuses.length);

  return {
    filterTeacherId,
    filterStudentId,
    filterStatuses,
    handleFilterTeacher,
    handleFilterStudent,
    toggleFilterStatus,
    clearFilters,
    filteredSessions,
    hasActiveFilters,
  };
}
