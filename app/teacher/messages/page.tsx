"use client";

import { useAuthGuard } from "@/lib/useAuthGuard";
import MessagingPage from "@/components/messaging/MessagingPage";

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  admin: "Admin",
  supervisor: "Supervisor",
  teacher: "Teacher",
};

export default function TeacherMessagesPage() {
  const { authChecked } = useAuthGuard();
  return <MessagingPage authChecked={authChecked} logTag="teacher/messages" roleLabel={ROLE_LABEL} />;
}
