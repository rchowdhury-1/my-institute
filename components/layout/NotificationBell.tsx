"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import api from "@/lib/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  created_at: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setLoggedIn(true);
    fetchNotifications(token);
    const interval = setInterval(() => {
      const t = localStorage.getItem("accessToken");
      if (t) fetchNotifications(t);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function fetchNotifications(token: string) {
    try {
      const res = await api.get("/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data.notifications.slice(0, 10));
      setUnreadCount(res.data.unread_count);
    } catch {
      // silently ignore — user may not be logged in
    }
  }

  async function markAllRead() {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    await api.patch("/notifications/read-all", {}, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  if (!loggedIn) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-charcoal hover:bg-emerald-primary/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gold text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-black/5 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <p className="font-semibold text-charcoal text-sm">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-emerald-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-charcoal/30 text-sm">
                No notifications
              </div>
            ) : (
              notifications.map((notif) => {
                const inner = (
                  <div
                    className={`px-4 py-3 border-b border-black/5 last:border-0 hover:bg-cream transition-colors ${
                      !notif.read ? "bg-emerald-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!notif.read && (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-primary shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className={`text-sm text-charcoal leading-snug ${!notif.read ? "font-semibold" : ""}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-charcoal/50 mt-0.5 leading-relaxed">{notif.message}</p>
                        <p className="text-[10px] text-charcoal/30 mt-1">
                          {new Date(notif.created_at).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );

                return notif.link ? (
                  <Link key={notif.id} href={notif.link} onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={notif.id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
