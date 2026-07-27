"use client";

import { RefreshCw, X as XIcon } from "lucide-react";
import { formatSessionTime, formatRelative } from "@/lib/datetime";
import { subjectLabel, whatsAppUrl } from "@/lib/labels";
import { useRescheduleRequests, type RescheduleRequest } from "@/lib/useRescheduleRequests";
import type { Dispatch, SetStateAction } from "react";

interface RescheduleRequestListProps {
  variant: "compact" | "detailed";
  requests?: RescheduleRequest[];
  setRequests?: Dispatch<SetStateAction<RescheduleRequest[]>>;
  onApproved?: (rr: RescheduleRequest, data: { new_session?: unknown }) => void;
}

export default function RescheduleRequestList({ variant, requests, setRequests, onApproved }: RescheduleRequestListProps) {
  const rr = useRescheduleRequests({ requests, setRequests, onApproved });

  if (rr.requests.length === 0 && Object.keys(rr.rrResult).length === 0) return null;

  const resultEntries = Object.entries(rr.rrResult).map(([id, result]) => {
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
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors">
              Send WhatsApp to student →
            </a>
          )}
          <button onClick={() => rr.dismissResult(id)} className="text-charcoal/30 hover:text-charcoal/60 transition-colors">
            <XIcon size={14} />
          </button>
        </div>
      </div>
    );
  });

  if (variant === "compact") {
    return (
      <section className="mb-10">
        <h2 className="font-display text-xl font-bold text-charcoal mb-4 flex items-center gap-2">
          <RefreshCw size={18} className="text-amber-500" />
          Reschedule Requests
          {rr.requests.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
              {rr.requests.length}
            </span>
          )}
        </h2>
        <div className="space-y-3">
          {rr.requests.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl border border-amber-200 p-5">
              <div className="space-y-1 mb-3">
                <p className="font-semibold text-charcoal text-sm">{req.student_name}</p>
                <p className="text-charcoal/50 text-xs">
                  Current: {formatSessionTime(req.original_scheduled_at)}
                </p>
                <p className="text-emerald-primary text-xs font-medium">
                  Proposed: {formatSessionTime(req.proposed_at)}
                </p>
                <p className="text-charcoal/30 text-xs">{formatRelative(req.created_at)}</p>
              </div>
              {rr.rrRejectId === req.id ? (
                <div className="space-y-2">
                  <textarea
                    value={rr.rrRejectReason}
                    onChange={(e) => rr.setRrRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => rr.handleReject(req)} disabled={rr.rrActioning === req.id}
                      className="px-4 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">
                      {rr.rrActioning === req.id ? "Rejecting…" : "Confirm Reject"}
                    </button>
                    <button onClick={() => { rr.setRrRejectId(null); rr.setRrRejectReason(""); }}
                      className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => rr.handleApprove(req)} disabled={rr.rrActioning === req.id}
                    className="px-3 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                    {rr.rrActioning === req.id ? "…" : "Approve"}
                  </button>
                  <button onClick={() => rr.setRrRejectId(req.id)} disabled={rr.rrActioning === req.id}
                    className="px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs font-semibold hover:border-red-300 hover:text-red-500 disabled:opacity-60 transition-colors">
                    Reject
                  </button>
                </div>
              )}
              {rr.rrError[req.id] && <p className="mt-2 text-red-500 text-xs">{rr.rrError[req.id]}</p>}
            </div>
          ))}
          {resultEntries}
        </div>
      </section>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="font-display text-lg font-bold text-charcoal mb-3 flex items-center gap-2">
        <RefreshCw size={18} className="text-amber-500" />
        Reschedule Requests
        {rr.requests.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
            {rr.requests.length} pending
          </span>
        )}
      </h3>
      <div className="space-y-2">
        {rr.requests.map((req) => (
          <div key={req.id} className="bg-white rounded-2xl border border-amber-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-charcoal text-sm">
                  {req.student_name} <span className="text-charcoal/40 font-normal">· {req.student_email}</span>
                </p>
                <p className="text-charcoal/60 text-xs">Teacher: {req.teacher_name} · {subjectLabel(req.subject)}</p>
                <p className="text-charcoal/50 text-xs">
                  Current: {formatSessionTime(req.original_scheduled_at)}
                </p>
                <p className="text-emerald-primary text-xs font-medium">
                  Proposed: {formatSessionTime(req.proposed_at)}
                </p>
                <p className="text-charcoal/30 text-xs">{formatRelative(req.created_at)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {rr.rrRejectId === req.id ? null : (
                  <>
                    <button
                      onClick={() => rr.handleApprove(req)}
                      disabled={rr.rrActioning === req.id}
                      className="px-3 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                    >
                      {rr.rrActioning === req.id ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => rr.setRrRejectId(req.id)}
                      disabled={rr.rrActioning === req.id}
                      className="px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs font-semibold hover:border-red-300 hover:text-red-500 disabled:opacity-60 transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
            {rr.rrRejectId === req.id && (
              <div className="mt-3 pt-3 border-t border-black/5 space-y-2">
                <textarea
                  value={rr.rrRejectReason}
                  onChange={(e) => rr.setRrRejectReason(e.target.value)}
                  placeholder="Reason for rejection (optional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => rr.handleReject(req)}
                    disabled={rr.rrActioning === req.id}
                    className="px-4 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    {rr.rrActioning === req.id ? "Rejecting…" : "Confirm Reject"}
                  </button>
                  <button
                    onClick={() => { rr.setRrRejectId(null); rr.setRrRejectReason(""); }}
                    className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {rr.rrError[req.id] && (
              <p className="mt-2 text-red-500 text-xs">{rr.rrError[req.id]}</p>
            )}
          </div>
        ))}
        {resultEntries}
      </div>
    </div>
  );
}
