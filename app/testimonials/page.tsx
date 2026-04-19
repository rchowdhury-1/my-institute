import type { Metadata } from "next";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import TestimonialCard from "@/components/shared/TestimonialCard";
import { TESTIMONIALS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Student Testimonials",
  description:
    "Hear from our students and their families. Real stories from people who have learned Quran, Arabic, and Islamic Studies at My Institute.",
};

export default function TestimonialsPage() {
  return (
    <>
      {/* Hero */}
      <section className="pattern-hero pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="gold" className="mb-4">
            Testimonials
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Student Stories
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Hear directly from the students and families whose lives have been
            enriched through learning at My Institute.
          </p>
        </div>
      </section>

      <Section>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TESTIMONIALS.map((testimonial, i) => (
            <AnimatedSection key={testimonial.id} delay={i * 0.1}>
              <TestimonialCard testimonial={testimonial} />
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="text-center mt-16">
          <h2 className="font-display text-2xl font-bold text-charcoal mb-4">
            Ready to Write Your Own Story?
          </h2>
          <p className="text-charcoal/60 mb-6 max-w-md mx-auto text-sm">
            Join our growing community of students. Book a free trial and take the
            first step on your learning journey.
          </p>
          <Button href="/free-trial" variant="primary">
            Book a Free Trial
          </Button>
        </AnimatedSection>
      </Section>
    </>
  );
}
