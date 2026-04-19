import type { Metadata } from "next";
import { Check, PlayCircle } from "lucide-react";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import { PACKAGES, RECORDED_COURSE, FAQS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Packages & Pricing",
  description:
    "View My Institute's lesson packages — Simple (4 lessons), Pro (8 lessons), and Elite (20 lessons). One-to-one 30-minute sessions from £16/month.",
};

export default function PackagesPage() {
  return (
    <>
      {/* Hero */}
      <section className="pattern-hero pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="gold" className="mb-4">
            Pricing
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Packages & Pricing
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Transparent pricing, no hidden fees. All packages include one-to-one
            lessons with an experienced teacher.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <Section variant="alt">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PACKAGES.map((pkg, i) => (
            <AnimatedSection key={pkg.name} delay={i * 0.1}>
              <div
                className={`relative rounded-2xl p-8 flex flex-col h-full transition-all ${
                  pkg.featured
                    ? "bg-emerald-primary text-white shadow-2xl shadow-emerald-primary/30 scale-105 border-2 border-emerald-primary"
                    : "bg-white border border-black/5 shadow-sm hover:shadow-md"
                }`}
              >
                {pkg.featured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge variant="gold" className="shadow-md">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <h3
                  className={`font-display text-2xl font-bold mb-1 ${
                    pkg.featured ? "text-white" : "text-charcoal"
                  }`}
                >
                  {pkg.name}
                </h3>
                <div className="flex items-baseline gap-1 mt-3 mb-6">
                  <span
                    className={`text-4xl font-bold ${
                      pkg.featured ? "text-white" : "text-charcoal"
                    }`}
                  >
                    {pkg.currency}{pkg.price}
                  </span>
                  <span
                    className={`text-sm ${
                      pkg.featured ? "text-white/70" : "text-charcoal/50"
                    }`}
                  >
                    / month
                  </span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    `${pkg.lessons} lessons per month`,
                    pkg.duration,
                    "One-to-one private lessons",
                    "Flexible scheduling",
                    "Progress tracking",
                    "Expert teacher support",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          pkg.featured ? "bg-white/20" : "bg-emerald-primary/10"
                        }`}
                      >
                        <Check
                          size={12}
                          className={pkg.featured ? "text-white" : "text-emerald-primary"}
                        />
                      </div>
                      <span
                        className={`text-sm ${
                          pkg.featured ? "text-white/85" : "text-charcoal/70"
                        }`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  href="/free-trial"
                  variant={pkg.featured ? "gold" : "secondary"}
                  className="w-full"
                >
                  Get Started
                </Button>
              </div>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="text-center mt-10">
          <p className="text-charcoal/50 text-sm">
            All prices in GBP. Packages renew monthly.{" "}
            <a href="/free-trial" className="text-emerald-primary font-medium hover:underline">
              Try a free session first →
            </a>
          </p>
        </AnimatedSection>
      </Section>

      {/* Recorded Course */}
      <Section>
        <AnimatedSection className="text-center mb-12">
          <Badge variant="gold" className="mb-4">
            Self-Paced
          </Badge>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-4">
            Recorded Course
          </h2>
          <p className="text-charcoal/60 max-w-xl mx-auto">
            Prefer to learn at your own pace? Our recorded Quran course lets you
            study whenever works for you.
          </p>
        </AnimatedSection>

        <AnimatedSection>
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="bg-emerald-primary p-8 text-white text-center">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <PlayCircle size={32} />
              </div>
              <h3 className="font-display text-2xl font-bold mb-2">
                {RECORDED_COURSE.name}
              </h3>
              <p className="text-white/75">{RECORDED_COURSE.description}</p>
              <div className="mt-4 text-3xl font-bold">
                {RECORDED_COURSE.currency}{RECORDED_COURSE.price}
                <span className="text-sm font-normal text-white/60 ml-1">one-time</span>
              </div>
            </div>

            <div className="p-8">
              <h4 className="font-semibold text-charcoal mb-4">What&apos;s included:</h4>
              <ul className="space-y-3 mb-8">
                {RECORDED_COURSE.includes.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-emerald-primary" />
                    </div>
                    <span className="text-charcoal/70 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <Button href="/recorded-courses" variant="primary" className="w-full">
                Learn More
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* FAQ */}
      <Section variant="alt">
        <AnimatedSection className="text-center mb-12">
          <Badge variant="emerald" className="mb-4">
            FAQ
          </Badge>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-4">
            Frequently Asked Questions
          </h2>
        </AnimatedSection>

        <div className="max-w-3xl mx-auto space-y-4">
          {FAQS.map((faq, i) => (
            <AnimatedSection key={i} delay={i * 0.06}>
              <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm">
                <h3 className="font-semibold text-charcoal mb-3">{faq.question}</h3>
                <p className="text-charcoal/65 text-sm leading-relaxed">{faq.answer}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="text-center mt-12">
          <p className="text-charcoal/60 mb-4">Still have questions?</p>
          <Button href="/free-trial" variant="primary">
            Book a Free Trial
          </Button>
        </AnimatedSection>
      </Section>
    </>
  );
}
