import type { Metadata } from "next";
import { BookOpen, Heart, Users, Star } from "lucide-react";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import { ABOUT, BRAND } from "@/lib/content";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about My Institute — our mission, values, and the dedicated teachers behind our online Quran, Arabic, and Islamic studies lessons.",
};

const VALUES = [
  {
    icon: BookOpen,
    title: "Knowledge",
    description:
      "We are committed to providing authentic, high-quality Islamic education grounded in traditional scholarship.",
  },
  {
    icon: Heart,
    title: "Compassion",
    description:
      "Every student is welcomed with warmth and patience. We believe learning flourishes in a caring environment.",
  },
  {
    icon: Users,
    title: "Community",
    description:
      "We build meaningful connections between students, teachers, and families united by a love of learning.",
  },
  {
    icon: Star,
    title: "Excellence",
    description:
      "We hold ourselves to the highest standards in teaching quality, communication, and student progress.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="pattern-hero pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="gold" className="mb-4">
            Our Story
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            About {BRAND.name}
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            A dedicated centre for Quran, Arabic, and Islamic education — serving students of all ages around the world.
          </p>
        </div>
      </section>

      {/* About Content */}
      <Section>
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <Badge variant="emerald" className="mb-6">
              {ABOUT.heading}
            </Badge>
            <p className="text-charcoal/75 text-lg leading-loose">{ABOUT.content}</p>
          </AnimatedSection>
        </div>
      </Section>

      {/* Values */}
      <Section variant="alt">
        <AnimatedSection className="text-center mb-14">
          <Badge variant="gold" className="mb-4">
            Our Values
          </Badge>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-4">
            What We Stand For
          </h2>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {VALUES.map((value, i) => {
            const Icon = value.icon;
            return (
              <AnimatedSection key={value.title} delay={i * 0.1}>
                <div className="bg-white rounded-2xl p-7 border border-black/5 shadow-sm flex gap-5 h-full">
                  <div className="w-12 h-12 rounded-xl bg-emerald-primary/10 text-emerald-primary flex items-center justify-center flex-shrink-0">
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-charcoal mb-2">
                      {value.title}
                    </h3>
                    <p className="text-charcoal/60 text-sm leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </Section>

      {/* CTA */}
      <section className="pattern-hero py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Begin?
            </h2>
            <p className="text-white/70 mb-8 max-w-lg mx-auto">
              Book a free trial session and experience the My Institute difference for yourself.
            </p>
            <Button href="/free-trial" variant="gold">
              Book Your Free Trial
            </Button>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
