"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Users, ChevronDown, ChevronUp } from "lucide-react";

interface Sponsor {
  id: string;
  sponsor_name: string;
  months_sponsored: number;
  payment_status: string;
  created_at: string;
}

interface Applicant {
  id: string;
  name: string;
  email: string;
  created_at: string;
  sponsors: Sponsor[];
}

export default function AdminScholarshipsPage() {
  const router = useRouter();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const role = localStorage.getItem("userRole");
    if (!token || (role !== "admin" && role !== "supervisor")) { router.push("/login"); return; }
    api.get("/scholarships/applicants", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setApplicants(res.data.applicants))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-display text-3xl font-bold text-charcoal mb-2">Scholarship Applicants</h1>
        <p className="text-charcoal/50 text-sm mb-8">View all applications and their sponsors</p>

        {applicants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30">
            <Users size={32} className="mx-auto mb-3 text-charcoal/20" />
            <p>No scholarship applications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {applicants.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-black/5 overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal text-sm">{a.name}</p>
                    <p className="text-xs text-charcoal/40 mt-0.5">
                      {a.email} · Applied {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-primary/10 text-emerald-primary">
                      {a.sponsors.length} sponsor{a.sponsors.length !== 1 ? "s" : ""}
                    </span>
                    {a.sponsors.length > 0 && (
                      <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        className="p-1 text-charcoal/40 hover:text-charcoal transition-colors">
                        {expanded === a.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                {expanded === a.id && a.sponsors.length > 0 && (
                  <div className="border-t border-black/5 bg-cream/50 p-5 space-y-2">
                    {a.sponsors.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-charcoal">{s.sponsor_name}</p>
                          <p className="text-xs text-charcoal/40">{s.months_sponsored} month{s.months_sponsored !== 1 ? "s" : ""} · {new Date(s.created_at).toLocaleDateString("en-GB")}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.payment_status === "completed" ? "bg-emerald-primary/10 text-emerald-primary" : "bg-amber-50 text-amber-700"}`}>
                          {s.payment_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
