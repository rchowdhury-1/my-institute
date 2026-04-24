import type { Metadata } from "next";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import ScholarshipForm from "@/components/forms/ScholarshipForm";
import ScholarshipApplicants from "@/components/forms/ScholarshipApplicants";

export const metadata: Metadata = {
  title: "Free Scholarship",
  description:
    "Apply for a free scholarship at My Institute. We offer fully-funded Quran, Arabic, and Islamic Studies lessons to eligible students.",
};

export default function ScholarshipPage() {
  return (
    <>
      {/* Hero */}
      <section className="pattern-hero pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="gold" className="mb-4">
            Scholarship
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Apply for a Free Scholarship
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            We believe that access to Islamic education should not be limited by
            financial circumstances. Apply today and we will review your application.
          </p>
        </div>
      </section>

      <Section>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Info sidebar */}
            <AnimatedSection direction="left" className="lg:col-span-2">
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-2xl font-bold text-charcoal mb-3">
                    About the Scholarship
                  </h2>
                  <p className="text-charcoal/65 text-sm leading-relaxed">
                    Our scholarship programme is funded through the generous donations
                    of our community. Successful applicants receive fully-funded
                    one-to-one lessons at no cost.
                  </p>
                </div>

                <div className="bg-cream-dark rounded-2xl p-5 border border-black/5">
                  <h3 className="font-semibold text-charcoal mb-3 text-sm">
                    Eligibility
                  </h3>
                  <ul className="space-y-2 text-sm text-charcoal/65">
                    <li>• Open to all ages</li>
                    <li>• Any level of prior knowledge</li>
                    <li>• Financial need considered</li>
                    <li>• Genuine commitment to learning</li>
                  </ul>
                </div>

                <div className="bg-cream-dark rounded-2xl p-5 border border-black/5">
                  <h3 className="font-semibold text-charcoal mb-2 text-sm">
                    What happens next?
                  </h3>
                  <p className="text-sm text-charcoal/65 leading-relaxed">
                    After submitting your application, our team will review it
                    carefully and reach out to you within a few days.
                  </p>
                </div>
              </div>
            </AnimatedSection>

            {/* Form */}
            <AnimatedSection direction="right" className="lg:col-span-3">
              <div className="bg-white rounded-2xl p-8 border border-black/5 shadow-sm">
                <h2 className="font-display text-xl font-bold text-charcoal mb-6">
                  Scholarship Application
                </h2>
                <ScholarshipForm />
              </div>
            </AnimatedSection>
          </div>
        </div>
      </Section>

      {/* Sponsor a student section — dynamically loaded */}
      <ScholarshipApplicants />
    </>
  );
}
