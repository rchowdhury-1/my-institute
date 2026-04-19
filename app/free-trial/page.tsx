import type { Metadata } from "next";
import { Clock, Users, GraduationCap } from "lucide-react";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import FreeTrialForm from "@/components/forms/FreeTrialForm";

export const metadata: Metadata = {
  title: "Book a Free Trial",
  description:
    "Get a free 30-minute online lesson with an expert teacher. No commitment required. Fill in the form and we'll contact you to arrange your session.",
};

const BENEFITS = [
  { icon: Clock, text: "30-minute session, no obligation" },
  { icon: Users, text: "All ages and levels welcome" },
  { icon: GraduationCap, text: "Expert, qualified teacher" },
];

export default function FreeTrialPage() {
  return (
    <>
      {/* Hero */}
      <section className="pattern-hero pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="gold" className="mb-4">
            Free Trial
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Get a Free Session!
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Fill the form and we will contact you to arrange your free session.
          </p>
        </div>
      </section>

      <Section>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Benefits sidebar */}
            <AnimatedSection direction="left" className="lg:col-span-2">
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-2xl font-bold text-charcoal mb-3">
                    What to expect
                  </h2>
                  <p className="text-charcoal/65 text-sm leading-relaxed">
                    Your free session is a no-pressure opportunity to meet your
                    teacher, discuss your goals, and see if My Institute is the
                    right fit for you.
                  </p>
                </div>

                <div className="space-y-4">
                  {BENEFITS.map((b) => {
                    const Icon = b.icon;
                    return (
                      <div key={b.text} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-primary/10 text-emerald-primary flex items-center justify-center flex-shrink-0">
                          <Icon size={18} />
                        </div>
                        <span className="text-charcoal/75 text-sm font-medium">
                          {b.text}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-cream-dark rounded-2xl p-5 border border-black/5">
                  <p className="text-charcoal/65 text-sm leading-relaxed">
                    After submitting, we&apos;ll reach out via email or WhatsApp within
                    24 hours to confirm your session time.
                  </p>
                </div>
              </div>
            </AnimatedSection>

            {/* Form */}
            <AnimatedSection direction="right" className="lg:col-span-3">
              <div className="bg-white rounded-2xl p-8 border border-black/5 shadow-sm">
                <h2 className="font-display text-xl font-bold text-charcoal mb-6">
                  Your Details
                </h2>
                <FreeTrialForm />
              </div>
            </AnimatedSection>
          </div>
        </div>
      </Section>
    </>
  );
}
