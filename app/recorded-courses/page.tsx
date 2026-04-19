import type { Metadata } from "next";
import { Check, PlayCircle } from "lucide-react";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import { RECORDED_COURSE, BRAND } from "@/lib/content";

export const metadata: Metadata = {
  title: "Recorded Courses",
  description:
    "Learn Quran at your own pace with our recorded course. 16 lessons, 5–7 minutes each, with access to a professional teacher for questions.",
};

export default function RecordedCoursesPage() {
  const whatsappNumber = BRAND.whatsapp.replace(/\+/g, "");
  const message = encodeURIComponent(
    `Assalamu Alaikum! I'm interested in the ${RECORDED_COURSE.name}. Could you share more details?`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;

  return (
    <>
      {/* Hero */}
      <section className="pattern-hero pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="gold" className="mb-4">
            Self-Paced Learning
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Recorded Courses
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Learn at your own pace, on your own schedule. Our recorded courses
            bring expert teaching to your screen whenever you&apos;re ready.
          </p>
        </div>
      </section>

      <Section>
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Course info */}
            <AnimatedSection direction="left">
              <div>
                <Badge variant="emerald" className="mb-4">
                  Available Now
                </Badge>
                <h2 className="font-display text-3xl font-bold text-charcoal mb-4">
                  {RECORDED_COURSE.name}
                </h2>
                <p className="text-charcoal/65 mb-6 leading-relaxed">
                  {RECORDED_COURSE.description} Start your Quran journey today
                  with clear, structured lessons from a professional teacher —
                  available to watch anywhere, anytime.
                </p>

                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-4xl font-bold text-charcoal">
                    {RECORDED_COURSE.currency}{RECORDED_COURSE.price}
                  </span>
                  <span className="text-charcoal/50 text-sm">one-time payment</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button href="/free-trial" variant="primary">
                    Get Started
                  </Button>
                  <Button href={whatsappUrl} variant="secondary" external>
                    Ask via WhatsApp
                  </Button>
                </div>
              </div>
            </AnimatedSection>

            {/* What's included */}
            <AnimatedSection direction="right">
              <div className="bg-white rounded-2xl p-8 border border-black/5 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-emerald-primary/10 text-emerald-primary flex items-center justify-center mb-6">
                  <PlayCircle size={24} />
                </div>
                <h3 className="font-display text-xl font-bold text-charcoal mb-5">
                  What&apos;s included
                </h3>
                <ul className="space-y-4">
                  {RECORDED_COURSE.includes.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check size={13} className="text-emerald-primary" />
                      </div>
                      <span className="text-charcoal/70 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="pattern-hero py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <h2 className="font-display text-3xl font-bold text-white mb-6">
              Prefer Live Lessons?
            </h2>
            <p className="text-white/70 mb-8 max-w-lg mx-auto">
              Our live one-to-one lessons offer personalised attention and real-time
              feedback from expert teachers.
            </p>
            <Button href="/packages" variant="gold">
              View Live Lesson Packages
            </Button>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
