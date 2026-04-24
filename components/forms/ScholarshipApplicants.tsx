"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Users, Heart } from "lucide-react";

interface Sponsor {
  id: string;
  sponsor_name: string;
  months_sponsored: number;
  payment_status: string;
}

interface Applicant {
  id: string;
  name: string;
  email: string;
  created_at: string;
  sponsors: Sponsor[];
}

interface SponsorForm {
  sponsor_name: string;
  sponsor_email: string;
  months_sponsored: string;
}

export default function ScholarshipApplicants() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sponsoring, setSponsoringId] = useState<string | null>(null);
  const [form, setForm] = useState<SponsorForm>({ sponsor_name: "", sponsor_email: "", months_sponsored: "1" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/scholarships/applicants")
      .then(res => setApplicants(res.data.applicants))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSponsor(applicantId: string) {
    if (!form.sponsor_name) { alert("Please enter your name."); return; }
    setSubmitting(true);
    try {
      const res = await api.post("/scholarships/sponsor", {
        sponsor_name: form.sponsor_name,
        sponsor_email: form.sponsor_email || undefined,
        applicant_id: applicantId,
        months_sponsored: parseInt(form.months_sponsored) || 1,
      });
      // open WhatsApp
      window.open(res.data.whatsapp_url, "_blank");
      setSponsoringId(null);
      setForm({ sponsor_name: "", sponsor_email: "", months_sponsored: "1" });
      // update local sponsor count
      setApplicants(prev => prev.map(a =>
        a.id === applicantId
          ? { ...a, sponsors: [...a.sponsors, { id: res.data.sponsor.id, sponsor_name: form.sponsor_name, months_sponsored: parseInt(form.months_sponsored) || 1, payment_status: "pending" }] }
          : a
      ));
    } catch {
      alert("Failed to submit sponsorship.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (applicants.length === 0) return null;

  return (
    <section className="py-16 bg-cream">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl font-bold text-charcoal mb-2">Sponsor a Student</h2>
          <p className="text-charcoal/60 text-sm max-w-lg mx-auto">
            These students have applied for our scholarship programme. Your support directly funds their Islamic education.
          </p>
        </div>

        <div className="space-y-3">
          {applicants.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-black/5 overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-primary/10 flex items-center justify-center text-emerald-primary font-bold text-sm shrink-0">
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-charcoal text-sm">{a.name}</p>
                    {a.sponsors.length > 0 && (
                      <p className="text-xs text-charcoal/40 flex items-center gap-1">
                        <Heart size={10} className="text-gold" />
                        {a.sponsors.length} sponsor{a.sponsors.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setSponsoringId(sponsoring === a.id ? null : a.id); setForm({ sponsor_name: "", sponsor_email: "", months_sponsored: "1" }); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gold text-white text-xs font-semibold hover:opacity-90 transition-colors shrink-0"
                >
                  <Heart size={12} /> Sponsor
                </button>
              </div>

              {sponsoring === a.id && (
                <div className="border-t border-black/5 bg-cream/50 p-5">
                  <p className="text-sm font-semibold text-charcoal mb-3">Your details</p>
                  <div className="space-y-2">
                    <input type="text" value={form.sponsor_name} onChange={e => setForm(p => ({ ...p, sponsor_name: e.target.value }))}
                      placeholder="Your name *"
                      className="w-full px-3 py-2 rounded-xl border border-black/10 bg-white text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
                    <input type="email" value={form.sponsor_email} onChange={e => setForm(p => ({ ...p, sponsor_email: e.target.value }))}
                      placeholder="Your email (optional)"
                      className="w-full px-3 py-2 rounded-xl border border-black/10 bg-white text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-charcoal/50 whitespace-nowrap">Months to sponsor:</label>
                      <input type="number" min={1} value={form.months_sponsored} onChange={e => setForm(p => ({ ...p, months_sponsored: e.target.value }))}
                        className="w-20 px-3 py-2 rounded-xl border border-black/10 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
                    </div>
                    <button onClick={() => handleSponsor(a.id)} disabled={submitting || !form.sponsor_name}
                      className="flex items-center gap-2 px-5 py-2 rounded-full bg-gold text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors">
                      <Users size={14} /> {submitting ? "Opening WhatsApp…" : "Continue via WhatsApp"}
                    </button>
                    <p className="text-xs text-charcoal/40">You&apos;ll be redirected to WhatsApp to confirm with our team.</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
