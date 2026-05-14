"use client";

// TODO: Integrate Paymob for payment processing (Phase 2)

import { Heart, BookOpen, Users, GraduationCap } from "lucide-react";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import Section from "@/components/shared/Section";

const whatsappUrl =
  "https://wa.me/201067827621?text=" +
  encodeURIComponent(
    "Hi, I'd like to sponsor a student. Please let me know how to donate."
  );

export default function DonateClient() {
  return (
    <>
      {/* Hero */}
      <section className="pattern-hero pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="gold" className="mb-4">
            Donate
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Sponsor a Student &mdash; Give the Gift of Quran
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Many students dream of learning Quran but cannot afford lessons.
            Your donation makes that dream a reality.
          </p>
        </div>
      </section>

      <Section>
        <div className="max-w-2xl mx-auto">
          {/* Why donate */}
          <AnimatedSection>
            <div className="text-center mb-12">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-charcoal mb-4">
                Your Sadaqah, Their Education
              </h2>
              <p className="text-charcoal/65 text-sm md:text-base leading-relaxed max-w-xl mx-auto">
                Every donation goes directly towards funding one-to-one Quran,
                Arabic, and Islamic Studies lessons for students who cannot
                afford them. 100% of your contribution covers teaching fees
                &mdash; nothing is taken for admin or overheads.
              </p>
            </div>
          </AnimatedSection>

          {/* Impact cards */}
          <AnimatedSection delay={0.1}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
              {[
                {
                  icon: BookOpen,
                  title: "Fund a Lesson",
                  text: "Cover the cost of a private Quran lesson for a student in need.",
                },
                {
                  icon: Users,
                  title: "Sponsor a Student",
                  text: "Provide ongoing lessons so a student can complete their Quran journey.",
                },
                {
                  icon: GraduationCap,
                  title: "Ongoing Reward",
                  text: "The Prophet \u2E17 said: \u201CThe best of you are those who learn the Quran and teach it.\u201D",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm text-center"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-primary/10 flex items-center justify-center mx-auto mb-3">
                    <card.icon size={18} className="text-emerald-primary" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-charcoal mb-1">
                    {card.title}
                  </h3>
                  <p className="text-xs text-charcoal/60 leading-relaxed">
                    {card.text}
                  </p>
                </div>
              ))}
            </div>
          </AnimatedSection>

          {/* CTA card */}
          <AnimatedSection delay={0.2}>
            <div className="bg-white rounded-2xl p-8 border border-black/5 shadow-sm text-center">
              <Heart
                size={32}
                className="text-gold mx-auto mb-4"
              />
              <h3 className="font-display text-xl font-bold text-charcoal mb-2">
                Ready to Make a Difference?
              </h3>
              <p className="text-charcoal/60 text-sm mb-6 max-w-md mx-auto">
                Get in touch with us on WhatsApp to arrange your donation.
                Our team will guide you through the process.
              </p>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gold text-white font-semibold text-sm hover:bg-gold-dark shadow-sm hover:shadow-md transition-all"
              >
                <Heart size={16} />
                Donate via WhatsApp
              </a>

              <p className="mt-4 text-xs text-charcoal/40">
                Direct online donation coming soon.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.3} className="mt-8 text-center">
            <p className="text-charcoal/60 text-sm leading-relaxed max-w-md mx-auto">
              JazakAllah Khayran for your generosity. Every contribution,
              no matter how small, helps a student on their journey with
              the Quran.
            </p>
          </AnimatedSection>
        </div>
      </Section>
    </>
  );
}
