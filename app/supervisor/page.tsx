"use client";

import { useState } from "react";
import { X as XIcon } from "lucide-react";
import { formatSessionTime } from "@/lib/datetime";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useLogout } from "@/lib/useLogout";
import { whatsAppUrl } from "@/lib/labels";
import { useSupervisorData } from "@/lib/useSupervisorData";
import PageLoading from "@/components/shared/PageLoading";
import PageError from "@/components/shared/PageError";
import { type Session } from "@/components/supervisor/SessionCard";
import ScheduleModal, { type Schedule } from "@/components/supervisor/ScheduleModal";
import EditSessionModal, { type EditWaMsg } from "@/components/supervisor/EditSessionModal";
import SchedulesTab from "@/components/supervisor/SchedulesTab";
import SessionsTab from "@/components/supervisor/SessionsTab";
import PeopleTab from "@/components/supervisor/PeopleTab";
import MessageTab from "@/components/supervisor/MessageTab";

export interface User {
  id: string;
  display_name: string;
  email: string;
  role: string;
}

export default function SupervisorPage() {
  const handleLogout = useLogout();
  const { authChecked } = useAuthGuard(["admin", "supervisor"]);
  const data = useSupervisorData(authChecked);
  const messagingEnabled = process.env.NEXT_PUBLIC_FEATURE_MESSAGING === "true";
  const [activeTab, setActiveTab] = useState<"sessions" | "schedules" | "people" | "message">("sessions");

  // edit session modal
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editWaMsg, setEditWaMsg] = useState<EditWaMsg | null>(null);

  // schedule modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  function openScheduleModal(schedule?: Schedule) {
    setEditingSchedule(schedule ?? null);
    data.setGenerationResult(null);
    setShowScheduleModal(true);
  }

  function openEditModal(s: Session) {
    setEditSession(s);
    setEditWaMsg(null);
  }

  function handleEditSessionSaved(updated: Session, waMsg: EditWaMsg | null) {
    data.updateSession(updated.id, updated);
    if (waMsg) setEditWaMsg(waMsg);
    setEditSession(null);
  }

  if (data.loading) {
    return <PageLoading />;
  }
  if (data.error) {
    return <PageError message={data.error} />;
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <div className="flex items-start justify-between mb-2">
          <h1 className="font-display text-3xl font-bold text-charcoal">Supervisor Dashboard</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-charcoal/50 hover:text-charcoal transition-colors"
          >
            Sign out
          </button>
        </div>
        <p className="text-charcoal/50 text-sm mb-8">Manage sessions, students and teachers</p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Sessions", value: data.sessions.length },
            { label: "Students", value: data.students.length },
            { label: "Teachers", value: data.teachers.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-black/5 p-5 text-center">
              <p className="font-display text-3xl font-bold text-emerald-primary">{stat.value}</p>
              <p className="text-charcoal/50 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-full p-1 border border-black/5 mb-6 w-fit">
          {(["sessions", "schedules", "people", ...(messagingEnabled ? ["message" as const] : [])] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all capitalize ${
                activeTab === tab
                  ? "bg-emerald-primary text-white"
                  : "text-charcoal/60 hover:text-charcoal"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Sessions tab */}
        {activeTab === "sessions" && (
          <SessionsTab
            sessions={data.sessions}
            prependSession={data.prependSession}
            removeSession={data.removeSession}
            updateSession={data.updateSession}
            students={data.students}
            teachers={data.teachers}
            rescheduleRequests={data.rescheduleRequests}
            removeRescheduleRequest={data.removeRescheduleRequest}
            onEditSession={openEditModal}
          />
        )}

        {/* Schedules tab */}
        {activeTab === "schedules" && (
          <SchedulesTab
            schedules={data.schedules}
            sessions={data.sessions}
            scheduleGenResult={data.scheduleGenResult}
            setScheduleGenResult={data.setGenerationResult}
            scheduleActioning={data.scheduleActioning}
            onOpenScheduleModal={openScheduleModal}
            onGenerateNow={data.handleGenerateNow}
            onDeactivate={data.handleDeactivateSchedule}
            onReactivate={data.handleReactivateSchedule}
          />
        )}

        {/* People tab */}
        {activeTab === "people" && (
          <PeopleTab students={data.students} teachers={data.teachers} />
        )}

        {/* Message tab */}
        {activeTab === "message" && messagingEnabled && (
          <MessageTab students={data.students} teachers={data.teachers} />
        )}
      </div>

      {/* Schedule modal */}
      {showScheduleModal && (
        <ScheduleModal
          editingSchedule={editingSchedule}
          students={data.students}
          teachers={data.teachers}
          onClose={() => setShowScheduleModal(false)}
          prependSchedule={data.prependSchedule}
          updateSchedule={data.updateSchedule}
          replaceSessions={data.replaceSessions}
          scheduleGenResult={data.scheduleGenResult}
          setScheduleGenResult={data.setGenerationResult}
        />
      )}

      {/* Edit session modal */}
      {editSession && (
        <EditSessionModal
          key={editSession.id}
          session={editSession}
          teachers={data.teachers}
          onClose={() => setEditSession(null)}
          onSaved={handleEditSessionSaved}
        />
      )}

      {/* WhatsApp follow-up after edit */}
      {editWaMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl border border-black/5 shadow-lg p-4 flex items-center gap-3 max-w-sm">
          <p className="text-charcoal text-sm">Session updated.</p>
          {(() => {
            const msg = `Assalamu alaikum! Your session time has been updated to ${formatSessionTime(editWaMsg.time || "")}. Please note the new time. — My Institute`;
            const url = whatsAppUrl(editWaMsg.phone, msg);
            return url ? (
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors">
                WhatsApp student →
              </a>
            ) : null;
          })()}
          <button onClick={() => setEditWaMsg(null)} className="text-charcoal/30 hover:text-charcoal/60">
            <XIcon size={14} />
          </button>
        </div>
      )}
    </main>
  );
}
