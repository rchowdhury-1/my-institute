"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Send, MessageCircle } from "lucide-react";

interface Conversation {
  other_id: string;
  other_name: string;
  other_role: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  sender_name: string;
  created_at: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function TeacherMessagesPage() {
  const router = useRouter();
  const [myId, setMyId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const id = localStorage.getItem("userId");
    if (!token || !id) { router.push("/login"); return; }
    setMyId(id);

    api.get("/messages/conversations", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setConversations(res.data.conversations))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function openConversation(conv: Conversation) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setActiveConv(conv);
    const res = await api.get(`/messages/${conv.other_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setMessages(res.data.messages);
    setConversations((prev) =>
      prev.map((c) => c.other_id === conv.other_id ? { ...c, unread_count: 0 } : c)
    );
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!newMessage.trim() || !activeConv) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSending(true);
    try {
      const res = await api.post("/messages",
        { receiver_id: activeConv.other_id, content: newMessage.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((prev) => [...prev, { ...res.data.message, sender_name: "You" }]);
      setNewMessage("");
      setConversations((prev) =>
        prev.map((c) =>
          c.other_id === activeConv.other_id
            ? { ...c, last_message: newMessage.trim(), last_message_at: new Date().toISOString() }
            : c
        )
      );
    } catch {
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  const roleLabel: Record<string, string> = {
    student: "Student",
    admin: "Admin",
    supervisor: "Supervisor",
    teacher: "Teacher",
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-display text-3xl font-bold text-charcoal mb-6">Messages</h1>

        <div className="flex gap-4 h-[600px]">
          {/* Conversation list */}
          <div className="w-72 shrink-0 bg-white rounded-2xl border border-black/5 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-charcoal/30 p-6 text-center">
                <MessageCircle size={32} className="mb-2" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.other_id}
                  onClick={() => openConversation(conv)}
                  className={`w-full text-left px-4 py-3 border-b border-black/5 last:border-0 hover:bg-cream transition-colors ${
                    activeConv?.other_id === conv.other_id ? "bg-emerald-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-semibold text-charcoal text-sm truncate">{conv.other_name}</p>
                    {conv.unread_count > 0 && (
                      <span className="shrink-0 ml-2 w-5 h-5 rounded-full bg-emerald-primary text-white text-[10px] font-bold flex items-center justify-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-charcoal/40">{roleLabel[conv.other_role] ?? conv.other_role}</p>
                  {conv.last_message && (
                    <p className="text-xs text-charcoal/50 truncate mt-1">{conv.last_message}</p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Message thread */}
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-black/5 overflow-hidden">
            {!activeConv ? (
              <div className="flex flex-col items-center justify-center h-full text-charcoal/30">
                <MessageCircle size={40} className="mb-3" />
                <p className="text-sm">Select a conversation</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-black/5">
                  <p className="font-semibold text-charcoal">{activeConv.other_name}</p>
                  <p className="text-xs text-charcoal/40">{roleLabel[activeConv.other_role] ?? activeConv.other_role}</p>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {messages.map((msg) => {
                    const isMe = msg.sender_id === myId;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? "bg-emerald-primary text-white rounded-br-sm"
                            : "bg-cream text-charcoal rounded-bl-sm"
                        }`}>
                          <p>{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-charcoal/40"}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="px-4 py-3 border-t border-black/5 flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message…"
                    className="flex-1 px-4 py-2 rounded-full border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="p-2.5 rounded-full bg-emerald-primary text-white hover:bg-emerald-light disabled:opacity-40 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
