"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

export interface RescheduleRequest {
  id: string;
  session_id: string;
  proposed_at: string;
  status: string;
  original_scheduled_at: string;
  duration_minutes: number;
  subject: string;
  student_name: string;
  student_email?: string;
  student_phone: string;
  teacher_name: string;
  rejection_reason?: string;
  created_at: string;
}

interface RescheduleActionResult {
  action: "approved" | "rejected";
  phone?: string;
  proposedAt?: string;
  originalAt?: string;
  reason?: string;
}

interface UseRescheduleRequestsOptions {
  // When provided (supervisor side, already fetched by useSupervisorData),
  // the hook uses these instead of self-fetching. Omit to self-fetch
  // (teacher dashboard).
  requests?: RescheduleRequest[];
  removeRequest?: (id: string) => void;
  onApproved?: (rr: RescheduleRequest, data: { new_session?: unknown }) => void;
}

export function useRescheduleRequests(options: UseRescheduleRequestsOptions = {}) {
  const selfManaged = !options.requests;
  const [localRequests, setLocalRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoading] = useState(selfManaged);
  const requests = options.requests ?? localRequests;
  const removeRequest = options.removeRequest ?? ((id: string) => setLocalRequests((prev) => prev.filter((r) => r.id !== id)));

  useEffect(() => {
    if (!selfManaged) return;
    api.get("/reschedule-requests?status=pending")
      .then((res) => setLocalRequests(res.data.requests ?? []))
      .catch((err) => console.error("[useRescheduleRequests] failed to load:", err))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rrActioning, setRrActioning] = useState<string | null>(null);
  const [rrRejectId, setRrRejectId] = useState<string | null>(null);
  const [rrRejectReason, setRrRejectReason] = useState("");
  const [rrResult, setRrResult] = useState<Record<string, RescheduleActionResult>>({});
  const [rrError, setRrError] = useState<Record<string, string>>({});

  async function handleApprove(rr: RescheduleRequest) {
    setRrActioning(rr.id);
    setRrError((p) => ({ ...p, [rr.id]: "" }));
    try {
      const res = await api.patch(`/reschedule-requests/${rr.id}/approve`, {});
      removeRequest(rr.id);
      setRrResult((p) => ({ ...p, [rr.id]: { action: "approved", phone: rr.student_phone, proposedAt: rr.proposed_at } }));
      options.onApproved?.(rr, res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { code?: string; error?: string } } };
      if (e.response?.data?.code === "TEACHER_CONFLICT") {
        setRrError((p) => ({ ...p, [rr.id]: "Conflict detected — another session has been scheduled at this time. Please reject this request and ask the student to propose a different time." }));
      } else {
        setRrError((p) => ({ ...p, [rr.id]: e.response?.data?.error || "Failed to approve request." }));
      }
    } finally {
      setRrActioning(null);
    }
  }

  async function handleReject(rr: RescheduleRequest) {
    setRrActioning(rr.id);
    setRrError((p) => ({ ...p, [rr.id]: "" }));
    try {
      await api.patch(`/reschedule-requests/${rr.id}/reject`, { rejection_reason: rrRejectReason || undefined });
      removeRequest(rr.id);
      setRrResult((p) => ({ ...p, [rr.id]: { action: "rejected", phone: rr.student_phone, originalAt: rr.original_scheduled_at, reason: rrRejectReason } }));
      setRrRejectId(null);
      setRrRejectReason("");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setRrError((p) => ({ ...p, [rr.id]: e.response?.data?.error || "Failed to reject request." }));
    } finally {
      setRrActioning(null);
    }
  }

  function dismissResult(id: string) {
    setRrResult((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  }

  return {
    requests,
    loading,
    rrActioning,
    rrRejectId, setRrRejectId,
    rrRejectReason, setRrRejectReason,
    rrResult,
    rrError,
    handleApprove,
    handleReject,
    dismissResult,
  };
}
