"use client";

import { useMemo } from "react";
import { startOfWeek, format, addWeeks } from "date-fns";
import type { Session } from "@/components/supervisor/SessionCard";

export function useSessionGrouping(filteredSessions: Session[]) {
  return useMemo(() => {
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
}
