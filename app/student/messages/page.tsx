"use client";

import { useAuthGuard } from "@/lib/useAuthGuard";
import MessagingPage from "@/components/messaging/MessagingPage";

export default function StudentMessagesPage() {
  const { authChecked } = useAuthGuard();
  return <MessagingPage authChecked={authChecked} logTag="student/messages" />;
}
