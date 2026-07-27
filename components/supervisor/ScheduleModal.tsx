import { useState } from "react";
import api from "@/lib/api";
import UserSearchInput from "@/components/shared/UserSearchInput";
import { formatHours, otherZoneHint, OPERATIONAL_TZ_LABEL } from "@/lib/datetime";
import { DURATION_OPTIONS, DAY_LABELS, ALL_DAYS } from "@/lib/labels";
import type { Session } from "./SessionCard";
import type { User } from "@/app/supervisor/page";

export interface Schedule {
  id: string;
  student_id: string;
  teacher_id: string;
  student_name: string;
  teacher_name: string;
  subject: string;
  default_duration: number;
  slots: { day: string; time: string; duration?: number }[];
  lessons_remaining: number | null;
  zoom_link?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleGeneration {
  created: number;
  skipped: number;
  conflicts: string[];
}

interface ScheduleModalProps {
  editingSchedule: Schedule | null;
  students: User[];
  teachers: User[];
  onClose: () => void;
  setSchedules: React.Dispatch<React.SetStateAction<Schedule[]>>;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  // Shared with the schedule-list actions (Reactivate/Generate Now), which
  // display the same result outside this modal — must stay lifted, not
  // owned locally, or those two actions lose their result display.
  scheduleGenResult: ScheduleGeneration | null;
  setScheduleGenResult: React.Dispatch<React.SetStateAction<ScheduleGeneration | null>>;
}

export default function ScheduleModal({
  editingSchedule,
  students,
  teachers,
  onClose,
  setSchedules,
  setSessions,
  scheduleGenResult,
  setScheduleGenResult,
}: ScheduleModalProps) {
  const [scheduleForm, setScheduleForm] = useState(() => {
    const slotState: Record<string, { enabled: boolean; time: string; duration: string }> = {};
    ALL_DAYS.forEach((d) => { slotState[d] = { enabled: false, time: "16:00", duration: "" }; });

    if (editingSchedule) {
      for (const slot of editingSchedule.slots) {
        slotState[slot.day] = { enabled: true, time: slot.time, duration: slot.duration ? String(slot.duration) : "" };
      }
      return {
        student_id: editingSchedule.student_id,
        teacher_id: editingSchedule.teacher_id,
        subject: editingSchedule.subject,
        default_duration: String(editingSchedule.default_duration),
        lessons_remaining: editingSchedule.lessons_remaining != null ? String(editingSchedule.lessons_remaining) : "",
        zoom_link: editingSchedule.zoom_link || "",
        slots: slotState,
      };
    }
    return {
      student_id: "", teacher_id: "", subject: "quran", default_duration: "60",
      lessons_remaining: "", zoom_link: "", slots: slotState,
    };
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleConfirm, setScheduleConfirm] = useState(false);

  function validateScheduleForm(): boolean {
    const slots = ALL_DAYS.filter((d) => scheduleForm.slots[d]?.enabled);
    if (slots.length === 0) { setScheduleError("Select at least one day"); return false; }
    if (!editingSchedule && (!scheduleForm.student_id || !scheduleForm.teacher_id)) {
      setScheduleError("Select a student and teacher"); return false;
    }
    const hours = parseFloat(scheduleForm.lessons_remaining);
    if (!scheduleForm.lessons_remaining || isNaN(hours) || hours < 0.5 || !Number.isInteger(hours * 2)) {
      setScheduleError("Enter the hours for this package (steps of 0.5, minimum 0.5)."); return false;
    }
    setScheduleError("");
    return true;
  }

  // Save click: validate, then confirm when the hours balance is being set or changed.
  function handleScheduleSaveClick() {
    if (!validateScheduleForm()) return;
    const hours = parseFloat(scheduleForm.lessons_remaining);
    const hoursChanged = !editingSchedule || hours !== editingSchedule.lessons_remaining;
    if (hoursChanged) { setScheduleConfirm(true); return; }
    handleSaveSchedule();
  }

  async function handleSaveSchedule() {
    setScheduleConfirm(false);

    const slots = ALL_DAYS
      .filter((d) => scheduleForm.slots[d]?.enabled)
      .map((d) => ({
        day: d,
        time: scheduleForm.slots[d].time,
        ...(scheduleForm.slots[d].duration ? { duration: parseInt(scheduleForm.slots[d].duration) } : {}),
      }));

    setScheduleSaving(true);
    setScheduleError("");
    try {
      if (editingSchedule) {
        const res = await api.patch(`/admin/weekly-schedules/${editingSchedule.id}`, {
          subject: scheduleForm.subject,
          default_duration: parseInt(scheduleForm.default_duration),
          slots,
          lessons_remaining: parseFloat(scheduleForm.lessons_remaining),
          teacher_id: scheduleForm.teacher_id !== editingSchedule.teacher_id ? scheduleForm.teacher_id : undefined,
          zoom_link: scheduleForm.zoom_link || null,
        });

        setSchedules((prev) => prev.map((s) => s.id === editingSchedule.id ? { ...s, ...res.data.schedule } : s));
        if (res.data.generation) setScheduleGenResult(res.data.generation);
        // Refresh sessions list
        const sessRes = await api.get("/admin/sessions");
        setSessions(sessRes.data.sessions);
      } else {
        const res = await api.post("/admin/weekly-schedules", {
          student_id: scheduleForm.student_id,
          teacher_id: scheduleForm.teacher_id,
          subject: scheduleForm.subject,
          default_duration: parseInt(scheduleForm.default_duration),
          slots,
          lessons_remaining: parseFloat(scheduleForm.lessons_remaining),
          zoom_link: scheduleForm.zoom_link || null,
        });

        const student = students.find((s) => s.id === scheduleForm.student_id);
        const teacher = teachers.find((t) => t.id === scheduleForm.teacher_id);
        setSchedules((prev) => [{ ...res.data.schedule, student_name: student?.display_name ?? "", teacher_name: teacher?.display_name ?? "" }, ...prev]);
        setScheduleGenResult(res.data.generation);
        // Refresh sessions list
        const sessRes = await api.get("/admin/sessions");
        setSessions(sessRes.data.sessions);
      }
      if (!scheduleGenResult) onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setScheduleError(e.response?.data?.error || "Failed to save schedule.");
    } finally {
      setScheduleSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-black/5 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-charcoal mb-4">
          {editingSchedule ? "Edit Schedule" : "Add Weekly Schedule"}
        </h3>

        <div className="space-y-3">
          {/* Student & Teacher (disabled when editing) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-charcoal/60 mb-1">Student</label>
              <UserSearchInput
                users={students}
                value={scheduleForm.student_id}
                onChange={(id) => setScheduleForm((p) => ({ ...p, student_id: id }))}
                placeholder="Search student…"
                disabled={!!editingSchedule}
              />
            </div>
            <div>
              <label className="block text-xs text-charcoal/60 mb-1">Teacher</label>
              <UserSearchInput
                users={teachers}
                value={scheduleForm.teacher_id}
                onChange={(id) => setScheduleForm((p) => ({ ...p, teacher_id: id }))}
                placeholder="Search teacher…"
              />
            </div>
          </div>

          {/* Subject & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-charcoal/60 mb-1">Subject</label>
              <input
                type="text"
                value={scheduleForm.subject}
                onChange={(e) => setScheduleForm((p) => ({ ...p, subject: e.target.value }))}
                placeholder="e.g. Quran, Arabic, Math"
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs text-charcoal/60 mb-1">Default Duration</label>
              <select
                value={scheduleForm.default_duration}
                onChange={(e) => setScheduleForm((p) => ({ ...p, default_duration: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={String(d)}>{d} min</option>
                ))}
              </select>
            </div>
          </div>

          {/* Zoom Link */}
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">Zoom Link (optional)</label>
            <input
              type="url"
              value={scheduleForm.zoom_link}
              onChange={(e) => setScheduleForm((p) => ({ ...p, zoom_link: e.target.value }))}
              placeholder="e.g. https://zoom.us/j/123456789"
              className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
            />
            <p className="text-[10px] text-charcoal/30 mt-1">Used for all sessions in this schedule. Each session&apos;s link can still be overridden later if needed.</p>
          </div>

          {/* Hours remaining */}
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">Hours Remaining <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              required
              value={scheduleForm.lessons_remaining}
              onChange={(e) => setScheduleForm((p) => ({ ...p, lessons_remaining: e.target.value }))}
              placeholder="e.g. 10"
              className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
            />
            <p className="text-[10px] text-charcoal/30 mt-1">The student&apos;s hours balance. Each attended session subtracts its duration (30 min = 0.5).</p>
          </div>

          {/* Day/Time grid */}
          <div>
            <label className="block text-xs text-charcoal/60 mb-2">Select Days & Times ({OPERATIONAL_TZ_LABEL})</label>
            <div className="space-y-2">
              {ALL_DAYS.map((day) => {
                const slot = scheduleForm.slots[day] || { enabled: false, time: "16:00", duration: "" };
                return (
                  <div key={day} className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${slot.enabled ? "bg-emerald-primary/5" : "bg-black/[0.02]"}`}>
                    <label className="flex items-center gap-2 w-12 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slot.enabled}
                        onChange={(e) => setScheduleForm((p) => ({
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
                          onChange={(e) => setScheduleForm((p) => ({
                            ...p,
                            slots: { ...p.slots, [day]: { ...slot, time: e.target.value } },
                          }))}
                          aria-label={`${DAY_LABELS[day]} time (${OPERATIONAL_TZ_LABEL})`}
                          className="px-2 py-1 rounded-lg border border-black/10 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                        />
                        {slot.time && (
                          <span className="text-[10px] text-charcoal/40 whitespace-nowrap">{otherZoneHint(slot.time)}</span>
                        )}
                        <select
                          value={slot.duration}
                          onChange={(e) => setScheduleForm((p) => ({
                            ...p,
                            slots: { ...p.slots, [day]: { ...slot, duration: e.target.value } },
                          }))}
                          className="px-2 py-1 rounded-lg border border-black/10 bg-white text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                        >
                          <option value="">Default ({scheduleForm.default_duration} min)</option>
                          {DURATION_OPTIONS.map((d) => (
                            <option key={d} value={String(d)}>{d} min</option>
                          ))}
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

        {/* Hours confirmation — the field sets the balance absolutely */}
        {scheduleConfirm ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4">
            <p className="text-charcoal text-sm font-medium mb-3">
              {editingSchedule
                ? <>You&apos;re changing this schedule&apos;s balance from <strong>{editingSchedule.lessons_remaining != null ? `${formatHours(editingSchedule.lessons_remaining)} hours` : "unlimited"}</strong> to <strong>{scheduleForm.lessons_remaining} hours</strong>. Save?</>
                : <>This will set <strong>{students.find((s) => s.id === scheduleForm.student_id)?.display_name ?? "this student"}</strong>&apos;s balance to <strong>{scheduleForm.lessons_remaining} hours</strong> for this schedule. Create it?</>}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSaveSchedule}
                disabled={scheduleSaving}
                className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
              >
                {scheduleSaving ? "Saving…" : "Confirm"}
              </button>
              <button
                onClick={() => setScheduleConfirm(false)}
                disabled={scheduleSaving}
                className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleScheduleSaveClick}
            disabled={scheduleSaving}
            className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
          >
            {scheduleSaving ? "Saving…" : editingSchedule ? "Save Changes" : "Create Schedule"}
          </button>
          <button
            onClick={() => { onClose(); setScheduleGenResult(null); }}
            className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
          >
            {scheduleGenResult ? "Done" : "Cancel"}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
