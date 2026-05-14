"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Users } from "lucide-react";

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string | null;
  story: string | null;
  status: string;
  created_at: string;
}

const STATUS_OPTIONS = ["new", "contacted", "enrolled", "archived"];

const STATUS_STYLE: Record<string, string> = {
  new: "bg-blue-50 text-blue-600",
  contacted: "bg-amber-50 text-amber-700",
  enrolled: "bg-emerald-primary/10 text-emerald-primary",
  archived: "bg-charcoal/10 text-charcoal/50",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminRevertApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("accessToken");
    const role = localStorage.getItem("userRole");
    if (!t || (role !== "admin" && role !== "supervisor")) {
      router.push("/login");
      return;
    }
    setToken(t);
    api
      .get("/admin/revert-applications", {
        headers: { Authorization: `Bearer ${t}` },
      })
      .then((res) => setApplications(res.data.applications))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await api.patch(
        `/admin/revert-applications/${id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? res.data.application : a))
      );
    } catch {
      // silent
    }
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-charcoal">
            Revert Applications
          </h1>
          <p className="text-charcoal/60 text-sm mt-1">
            Manage applications from new Muslims seeking support.
          </p>
        </div>

        {applications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30">
            <Users size={32} className="mx-auto mb-3 text-charcoal/20" />
            <p>No applications yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div
                key={app.id}
                data-testid={`app-card-${app.id}`}
                className="bg-white rounded-2xl border border-black/5 p-5"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-charcoal text-sm">
                      {app.name}
                    </h3>
                    <p className="text-xs text-charcoal/50 mt-0.5">
                      {app.email} &middot; {app.phone}
                      {app.country && ` · ${app.country}`}
                    </p>
                    {app.story && (
                      <p className="text-xs text-charcoal/40 mt-1.5 line-clamp-2">
                        {app.story.length > 150
                          ? app.story.slice(0, 150) + "…"
                          : app.story}
                      </p>
                    )}
                    <p className="text-xs text-charcoal/30 mt-1.5">
                      Received {formatDate(app.created_at)}
                    </p>
                  </div>

                  <select
                    value={app.status}
                    onChange={(e) =>
                      handleStatusChange(app.id, e.target.value)
                    }
                    data-testid="status-select"
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border-0 cursor-pointer ${STATUS_STYLE[app.status]} focus:outline-none focus:ring-2 focus:ring-emerald-primary/30`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
