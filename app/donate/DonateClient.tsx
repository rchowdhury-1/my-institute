"use client";

// TODO: Integrate Stripe for payment processing

import { useState } from "react";
import { Heart } from "lucide-react";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import Section from "@/components/shared/Section";
import { BRAND } from "@/lib/content";

type Frequency = "One time" | "Weekly" | "Monthly" | "Yearly";
const FREQUENCIES: Frequency[] = ["One time", "Weekly", "Monthly", "Yearly"];
const PRESET_AMOUNTS = [5, 10, 20, 50, 100, 200];

export default function DonateClient() {
  const [frequency, setFrequency] = useState<Frequency>("Monthly");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(20);
  const [customAmount, setCustomAmount] = useState("");

  const amount = customAmount ? parseFloat(customAmount) : selectedAmount;

  const whatsappNumber = BRAND.whatsapp.replace(/\+/g, "");
  const freqLabel = frequency === "One time" ? "one-time" : frequency.toLowerCase();
  const message = encodeURIComponent(
    `Assalamu Alaikum! I'd like to make a ${freqLabel} donation of £${amount || "?"} to help students obtain a free scholarship. Please let me know how to proceed.`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;

  return (
    <>
      {/* Hero */}
      <section className="pattern-hero pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="gold" className="mb-4">
            Donate
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Make a Difference
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Change starts with people like you. Your donation helps make a real
            impact, one action at a time. Together, we can do more.
          </p>
        </div>
      </section>

      <Section>
        <div className="max-w-xl mx-auto">
          <AnimatedSection>
            <div className="bg-white rounded-2xl p-8 border border-black/5 shadow-sm">
              {/* Frequency selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-charcoal mb-3">
                  Donation Frequency
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        frequency === f
                          ? "bg-emerald-primary text-white border-emerald-primary"
                          : "bg-transparent text-charcoal/70 border-black/10 hover:border-emerald-primary/40"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-charcoal mb-3">
                  Select Amount{" "}
                  <span className="text-charcoal/40 font-normal text-xs">
                    — Helping students obtain a free scholarship
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {PRESET_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(a);
                        setCustomAmount("");
                      }}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-all ${
                        selectedAmount === a && !customAmount
                          ? "bg-emerald-primary text-white border-emerald-primary"
                          : "bg-transparent text-charcoal border-black/10 hover:border-emerald-primary/40"
                      }`}
                    >
                      £{a}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/50 text-sm font-medium">
                    £
                  </span>
                  <input
                    type="number"
                    min="1"
                    placeholder="Custom amount"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setSelectedAmount(null);
                    }}
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm"
                  />
                </div>
              </div>

              {/* Summary */}
              {amount && amount > 0 && (
                <div className="mb-6 p-4 bg-emerald-primary/5 rounded-xl border border-emerald-primary/15">
                  <p className="text-sm text-charcoal/70">
                    You are donating{" "}
                    <strong className="text-charcoal">
                      £{amount} {freqLabel}
                    </strong>{" "}
                    to help students obtain a free scholarship.
                  </p>
                </div>
              )}

              {/* Donate Button */}
              <a
                href={amount && amount > 0 ? whatsappUrl : "#"}
                target={amount && amount > 0 ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-4 rounded-full font-semibold text-sm transition-all ${
                  amount && amount > 0
                    ? "bg-gold text-white hover:bg-gold-dark shadow-sm hover:shadow-md"
                    : "bg-charcoal/10 text-charcoal/40 cursor-not-allowed pointer-events-none"
                }`}
              >
                <Heart size={16} />
                {amount && amount > 0
                  ? `Donate £${amount} via WhatsApp`
                  : "Select an amount to donate"}
              </a>

              <p className="mt-4 text-center text-xs text-charcoal/40">
                You will be redirected to WhatsApp to complete your donation.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.15} className="mt-8 text-center">
            <p className="text-charcoal/60 text-sm leading-relaxed max-w-md mx-auto">
              All donations go directly towards funding scholarships for students who
              cannot afford lessons. JazakAllah Khayran for your generosity.
            </p>
          </AnimatedSection>
        </div>
      </Section>
    </>
  );
}
