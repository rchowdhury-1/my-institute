import { useState } from "react";
import { Plus, X as XIcon, AlertTriangle, Search, Pencil, Play, Archive, ChevronDown, Repeat } from "lucide-react";
import { subjectLabel, LOW_BALANCE_AMBER_HOURS } from "@/lib/labels";
import { formatHours } from "@/lib/datetime";
import type { Schedule, ScheduleGeneration } from "./ScheduleModal";
import type { Session } from "./SessionCard";

const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

interface SchedulesTabProps {
  schedules: Schedule[];
  sessions: Session[];
  scheduleGenResult: ScheduleGeneration | null;
  setScheduleGenResult: React.Dispatch<React.SetStateAction<ScheduleGeneration | null>>;
  scheduleActioning: string | null;
  onOpenScheduleModal: (schedule?: Schedule) => void;
  onGenerateNow: (id: string) => void;
  onDeactivate: (id: string) => void;
  onReactivate: (id: string) => void;
}

export default function SchedulesTab({
  schedules,
  sessions,
  scheduleGenResult,
  setScheduleGenResult,
  scheduleActioning,
  onOpenScheduleModal,
  onGenerateNow,
  onDeactivate,
  onReactivate,
}: SchedulesTabProps) {
  const [scheduleSearchTerm, setScheduleSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const legacySessionCount = sessions.filter((s) => !s.schedule_id && s.status === "scheduled" && new Date(s.scheduled_at) > new Date()).length;
  const activeSchedules = schedules.filter((s) => s.is_active);
  const archivedSchedules = schedules.filter((s) => !s.is_active);
  const scheduleMatchesSearch = (s: Schedule) => s.student_name.toLowerCase().includes(scheduleSearchTerm.toLowerCase());
  const filteredActiveSchedules = activeSchedules.filter(scheduleMatchesSearch);
  const filteredArchivedSchedules = archivedSchedules.filter(scheduleMatchesSearch);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold text-charcoal">Weekly Schedules</h2>
        <button
          onClick={() => onOpenScheduleModal()}
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

      {/* Student name search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30" />
        <input
          type="text"
          data-testid="schedule-search-input"
          value={scheduleSearchTerm}
          onChange={(e) => setScheduleSearchTerm(e.target.value)}
          placeholder="Search by student name…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-black/10 bg-white text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all"
        />
        {scheduleSearchTerm && (
          <button
            onClick={() => setScheduleSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal/60 transition-colors"
            title="Clear search"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>

      {/* Active schedules */}
      {activeSchedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-charcoal/30 mb-6">
          <Repeat size={32} className="mx-auto mb-3 text-charcoal/20" />
          <p>No active schedules. Click &quot;Add Schedule&quot; to create one.</p>
        </div>
      ) : filteredActiveSchedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-charcoal/30 mb-6">
          <Search size={32} className="mx-auto mb-3 text-charcoal/20" />
          <p>No schedules match your search.</p>
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {filteredActiveSchedules.map((sched) => (
            <div key={sched.id} className="bg-white rounded-2xl border border-black/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-charcoal text-sm">
                    {sched.student_name} <span className="text-charcoal/30">↔</span> {sched.teacher_name}
                  </p>
                  <p className="text-charcoal/50 text-xs mt-0.5">
                    {subjectLabel(sched.subject)}
                    {" · "}
                    {sched.slots.map((sl) => `${DAY_LABELS[sl.day] || sl.day} ${sl.time}`).join(", ")}
                    {" · "}
                    {sched.default_duration} min
                  </p>
                  {sched.lessons_remaining != null ? (
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      sched.lessons_remaining <= 0
                        ? "bg-red-100 text-red-700"
                        : sched.lessons_remaining <= LOW_BALANCE_AMBER_HOURS
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {formatHours(sched.lessons_remaining)} hour{sched.lessons_remaining !== 1 ? "s" : ""} remaining
                    </span>
                  ) : (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      No hours limit set
                    </span>
                  )}
                  {sched.zoom_link && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-blue-600 truncate max-w-[200px]" title={sched.zoom_link}>
                        🔗 {sched.zoom_link.replace(/^https?:\/\//, '').slice(0, 30)}{sched.zoom_link.replace(/^https?:\/\//, '').length > 30 ? '…' : ''}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(sched.zoom_link!); }}
                        className="text-[10px] text-charcoal/30 hover:text-charcoal/60 transition-colors"
                        title="Copy link"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onOpenScheduleModal(sched)}
                    disabled={scheduleActioning === sched.id}
                    className="p-1.5 rounded-lg text-charcoal/30 hover:text-emerald-primary hover:bg-emerald-primary/5 transition-colors"
                    title="Edit schedule"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onGenerateNow(sched.id)}
                    disabled={scheduleActioning === sched.id}
                    className="p-1.5 rounded-lg text-charcoal/30 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                    title="Generate sessions now"
                  >
                    <Play size={14} />
                  </button>
                  <button
                    onClick={() => onDeactivate(sched.id)}
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
      {archivedSchedules.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-charcoal/40 text-sm hover:text-charcoal/60 transition-colors mb-2"
          >
            <ChevronDown size={14} className={`transition-transform ${showArchived ? "rotate-180" : ""}`} />
            Archived ({archivedSchedules.length})
          </button>
          {showArchived && (
            filteredArchivedSchedules.length === 0 ? (
              <p className="text-charcoal/30 text-sm px-1">No schedules match your search.</p>
            ) : (
              <div className="space-y-2">
                {filteredArchivedSchedules.map((sched) => (
                  <div key={sched.id} className="bg-white/60 rounded-2xl border border-black/5 p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-charcoal/50 text-sm">
                        {sched.student_name} ↔ {sched.teacher_name}
                      </p>
                      <p className="text-charcoal/30 text-xs mt-0.5">
                        {sched.subject} · {sched.slots.map((sl) => `${DAY_LABELS[sl.day] || sl.day} ${sl.time}`).join(", ")}
                      </p>
                    </div>
                    <button
                      onClick={() => onReactivate(sched.id)}
                      disabled={scheduleActioning === sched.id}
                      className="px-3 py-1.5 rounded-full border border-emerald-primary/30 text-emerald-primary text-xs font-semibold hover:bg-emerald-primary/5 disabled:opacity-60 transition-colors"
                    >
                      {scheduleActioning === sched.id ? "…" : "Reactivate"}
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
