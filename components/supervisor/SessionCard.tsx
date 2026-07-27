import { Repeat, Pencil, Trash2 } from "lucide-react";
import { formatSessionTime } from "@/lib/datetime";
import { SESSION_STATUS_STYLE, SESSION_STATUS_LABEL } from "@/lib/labels";

export interface Session {
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

interface SessionCardProps {
  session: Session;
  isPast: boolean;
  needsAttendance: boolean;
  deleting: string | null;
  attendanceId: string | null;
  attendanceStep: "teacher" | "student" | null;
  attendanceSaving: boolean;
  onEdit: (session: Session) => void;
  onDelete: (id: string) => void;
  onStartAttendance: (id: string) => void;
  onCancelAttendance: () => void;
  onAdvanceToStudentStep: () => void;
  onAttendanceStepBack: () => void;
  onAdminAttendance: (sessionId: string, teacherAttended: boolean, studentAttended: boolean) => void;
}

export default function SessionCard({
  session,
  isPast,
  needsAttendance,
  deleting,
  attendanceId,
  attendanceStep,
  attendanceSaving,
  onEdit,
  onDelete,
  onStartAttendance,
  onCancelAttendance,
  onAdvanceToStudentStep,
  onAttendanceStepBack,
  onAdminAttendance,
}: SessionCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-charcoal text-sm truncate">
            {session.student_name} ↔ {session.teacher_name}
          </p>
          <p className="text-charcoal/50 text-xs mt-0.5">
            {formatSessionTime(session.scheduled_at)} · {session.duration_minutes} min
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {session.schedule_id && (
            <Repeat size={12} className="text-emerald-primary/40" />
          )}
          {session.teacher_attended != null && (
            <span className="text-xs text-charcoal/30 flex items-center gap-0.5">
              {session.teacher_attended ? "T✓" : "T✗"}
              {session.student_attended != null && (session.student_attended ? " S✓" : " S✗")}
            </span>
          )}
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${SESSION_STATUS_STYLE[session.status] ? `${SESSION_STATUS_STYLE[session.status].bg} ${SESSION_STATUS_STYLE[session.status].text}` : "bg-gray-100 text-gray-600"}`}>
            {SESSION_STATUS_LABEL[session.status] ?? session.status}
          </span>
          {session.status === "scheduled" && !isPast && (
            <>
              <button
                onClick={() => onEdit(session)}
                className="p-1.5 rounded-lg text-charcoal/30 hover:text-emerald-primary hover:bg-emerald-primary/5 transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(session.id)}
                disabled={deleting === session.id}
                className="p-1.5 rounded-lg text-charcoal/30 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          {needsAttendance && (
            <button
              onClick={() => onStartAttendance(session.id)}
              className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium hover:bg-amber-200 transition-colors"
            >
              Mark Attendance
            </button>
          )}
        </div>
      </div>
      {attendanceId === session.id && (
        <div className="mt-3 pt-3 border-t border-black/5">
          {attendanceStep === "teacher" && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-charcoal">Did the teacher attend?</p>
              <div className="flex gap-2">
                <button onClick={onAdvanceToStudentStep} disabled={attendanceSaving}
                  className="px-3 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                  Yes
                </button>
                <button onClick={() => onAdminAttendance(session.id, false, false)} disabled={attendanceSaving}
                  className="px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">
                  No (Teacher Cancelled)
                </button>
                <button onClick={onCancelAttendance}
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
                <button onClick={() => onAdminAttendance(session.id, true, true)} disabled={attendanceSaving}
                  className="px-3 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                  Yes (Completed)
                </button>
                <button onClick={() => onAdminAttendance(session.id, true, false)} disabled={attendanceSaving}
                  className="px-3 py-1.5 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors">
                  No (No-Show)
                </button>
                <button onClick={onAttendanceStepBack}
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
}
