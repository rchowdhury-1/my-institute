import { useState } from "react";
import { Send } from "lucide-react";
import api from "@/lib/api";
import { getAxiosError } from "@/lib/errors";
import type { User } from "@/app/supervisor/page";

const TOAST_MS = 3000;

interface MessageTabProps {
  students: User[];
  teachers: User[];
}

export default function MessageTab({ students, teachers }: MessageTabProps) {
  const [msgForm, setMsgForm] = useState({ receiver_id: "", content: "" });
  const [sending, setSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  async function handleSendMessage() {
    if (!msgForm.receiver_id || !msgForm.content.trim()) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSending(true);
    try {
      await api.post("/messages",
        { receiver_id: msgForm.receiver_id, content: msgForm.content.trim() }
      );
      setMsgForm({ receiver_id: "", content: "" });
      setMsgSent(true);
      setTimeout(() => setMsgSent(false), TOAST_MS);
    } catch (err) {
      alert(getAxiosError(err).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="font-display text-xl font-bold text-charcoal mb-4">Send Message</h2>
      <div className="bg-white rounded-2xl border border-black/5 p-6 space-y-3">
        <select
          value={msgForm.receiver_id}
          onChange={(e) => setMsgForm((p) => ({ ...p, receiver_id: e.target.value }))}
          className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
        >
          <option value="">Select recipient…</option>
          <optgroup label="Students">
            {students.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
          </optgroup>
          <optgroup label="Teachers">
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
          </optgroup>
        </select>
        <textarea
          value={msgForm.content}
          onChange={(e) => setMsgForm((p) => ({ ...p, content: e.target.value }))}
          placeholder="Your message…"
          rows={4}
          className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 resize-none"
        />
        {msgSent && (
          <p className="text-emerald-primary text-sm font-medium">Message sent successfully!</p>
        )}
        <button
          onClick={handleSendMessage}
          disabled={sending || !msgForm.receiver_id || !msgForm.content.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
        >
          <Send size={14} />
          {sending ? "Sending…" : "Send Message"}
        </button>
      </div>
    </div>
  );
}
