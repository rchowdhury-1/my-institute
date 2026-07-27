import { useState } from "react";
import api from "@/lib/api";
import { zonedInputToISO, isoToZonedInput, otherZoneHint, OPERATIONAL_TZ_LABEL } from "@/lib/datetime";
import { DURATION_OPTIONS } from "@/lib/labels";
import type { Session } from "./SessionCard";
import type { User } from "@/app/supervisor/page";

export interface EditWaMsg {
  phone?: string;
  time?: string;
}

interface EditSessionModalProps {
  session: Session;
  teachers: User[];
  onClose: () => void;
  onSaved: (updated: Session, waMsg: EditWaMsg | null) => void;
}

export default function EditSessionModal({ session, teachers, onClose, onSaved }: EditSessionModalProps) {
  const [editForm, setEditForm] = useState({
    scheduled_at: isoToZonedInput(session.scheduled_at),
    duration_minutes: String(session.duration_minutes),
    subject: session.subject || "quran",
    teacher_id: session.teacher_id || "",
    zoom_link: session.zoom_link || "",
    notes: session.notes || "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  async function handleEditSession() {
    // Confirmation for teacher change
    if (editForm.teacher_id && editForm.teacher_id !== session.teacher_id) {
      const newTeacher = teachers.find((t) => t.id === editForm.teacher_id);
      if (!confirm(`You are changing the teacher from ${session.teacher_name} to ${newTeacher?.display_name || "unknown"}. The student and both teachers will be notified.`)) return;
    }

    setEditSaving(true);
    setEditError("");
    try {
      const body: Record<string, unknown> = {};
      const orig = session;
      const newDt = zonedInputToISO(editForm.scheduled_at);
      if (newDt !== new Date(orig.scheduled_at).toISOString()) body.scheduled_at = newDt;
      if (parseInt(editForm.duration_minutes) !== orig.duration_minutes) body.duration_minutes = parseInt(editForm.duration_minutes);
      if (editForm.subject !== (orig.subject || "quran")) body.subject = editForm.subject;
      if (editForm.teacher_id !== orig.teacher_id) body.teacher_id = editForm.teacher_id;
      if (editForm.zoom_link !== (orig.zoom_link || "")) body.zoom_link = editForm.zoom_link;
      if (editForm.notes !== (orig.notes || "")) body.notes = editForm.notes;

      if (Object.keys(body).length === 0) { onClose(); return; }

      const res = await api.patch(`/admin/sessions/${session.id}`, body);
      const updated = res.data.session;

      // Show WhatsApp button if time changed
      const waMsg = body.scheduled_at ? { phone: updated.student_phone, time: body.scheduled_at as string } : null;
      onSaved(updated, waMsg);
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

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-black/5 p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-charcoal mb-4">Edit Session</h3>
        <p className="text-charcoal/50 text-xs mb-4">{session.student_name} ↔ {session.teacher_name}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">Date &amp; Time ({OPERATIONAL_TZ_LABEL})</label>
            <input type="datetime-local" value={editForm.scheduled_at}
              onChange={(e) => setEditForm((p) => ({ ...p, scheduled_at: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
            {editForm.scheduled_at && (
              <p className="text-[10px] text-charcoal/40 mt-1">{otherZoneHint(editForm.scheduled_at)}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">Duration</label>
            <select value={editForm.duration_minutes}
              onChange={(e) => setEditForm((p) => ({ ...p, duration_minutes: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30">
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={String(d)}>{d} min</option>
              ))}
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
          <button onClick={onClose}
            className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
