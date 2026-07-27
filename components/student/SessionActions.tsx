import { X, RefreshCw, MessageCircle } from "lucide-react";
import { formatSessionTime, CANCELLATION_BUFFER_HOURS } from "@/lib/datetime";
import { BRAND } from "@/lib/content";
import { whatsAppUrl } from "@/lib/labels";

interface Session {
  id: string;
  scheduled_at: string;
}

interface RescheduleRequest {
  id: string;
  session_id: string;
  proposed_at: string;
  status: "pending" | "approved" | "rejected" | "cancelled_by_student";
}

interface SessionActionsProps {
  session: Session;
  pendingReq: RescheduleRequest | undefined;
  cancelId: string | null;
  cancelReason: string;
  setCancelReason: (v: string) => void;
  cancelSaving: boolean;
  handleCancel: () => void;
  setCancelId: (id: string | null) => void;
  rescheduleId: string | null;
  proposedDate: string;
  setProposedDate: (v: string) => void;
  proposedTime: string;
  setProposedTime: (v: string) => void;
  rescheduleError: string;
  rescheduleSaving: boolean;
  handleRequestReschedule: () => void;
  setRescheduleId: (id: string | null) => void;
  setRescheduleError: (v: string) => void;
  timeOptions: string[];
}

export default function SessionActions({
  session: s,
  pendingReq,
  cancelId,
  cancelReason,
  setCancelReason,
  cancelSaving,
  handleCancel,
  setCancelId,
  rescheduleId,
  proposedDate,
  setProposedDate,
  proposedTime,
  setProposedTime,
  rescheduleError,
  rescheduleSaving,
  handleRequestReschedule,
  setRescheduleId,
  setRescheduleError,
  timeOptions,
}: SessionActionsProps) {
  const hoursUntil = (new Date(s.scheduled_at).getTime() - Date.now()) / 3600000;
  const withinBuffer = hoursUntil >= 0 && hoursUntil < CANCELLATION_BUFFER_HOURS;
  const waText = `Hi, I need to change my session on ${formatSessionTime(s.scheduled_at)}.`;
  const waUrl = whatsAppUrl(BRAND.whatsapp, waText) ?? undefined;

  if (withinBuffer && !pendingReq) {
    return (
      <div className="border-t border-black/5 pt-3">
        <p className="text-charcoal/60 text-sm mb-2">
          This session starts soon and can no longer be changed online. Please message Mohammad to request changes.
        </p>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors"
        >
          <MessageCircle size={14} />
          WhatsApp Mohammad →
        </a>
      </div>
    );
  }

  if (cancelId === s.id) {
    return (
      <div className="border-t border-black/5 pt-3 space-y-2">
        <textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Reason for cancellation (optional)"
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            disabled={cancelSaving}
            className="px-4 py-1.5 rounded-full bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
          >
            {cancelSaving ? "Cancelling…" : "Confirm Cancel"}
          </button>
          <button
            onClick={() => { setCancelId(null); setCancelReason(""); }}
            className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
          >
            Keep session
          </button>
        </div>
      </div>
    );
  }

  if (rescheduleId === s.id) {
    return (
      <div className="border-t border-black/5 pt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={proposedDate}
            onChange={(e) => setProposedDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
          />
          <select
            value={proposedTime}
            onChange={(e) => setProposedTime(e.target.value)}
            className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
          >
            <option value="">Select time…</option>
            {timeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {rescheduleError && (
          <p className="text-red-500 text-xs">{rescheduleError}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleRequestReschedule}
            disabled={rescheduleSaving || !proposedDate || !proposedTime}
            className="px-4 py-1.5 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
          >
            {rescheduleSaving ? "Submitting…" : "Submit Request"}
          </button>
          <button
            onClick={() => { setRescheduleId(null); setProposedDate(""); setProposedTime(""); setRescheduleError(""); }}
            className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!pendingReq) {
    return (
      <div className="flex gap-2 border-t border-black/5 pt-3">
        <button
          onClick={() => setRescheduleId(s.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-emerald-primary/40 hover:text-emerald-primary transition-colors"
        >
          <RefreshCw size={13} /> Request Reschedule
        </button>
        <button
          onClick={() => setCancelId(s.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-red-300 hover:text-red-500 transition-colors"
        >
          <X size={13} /> Cancel
        </button>
      </div>
    );
  }

  return null;
}
