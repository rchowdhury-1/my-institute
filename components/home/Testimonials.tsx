import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import TestimonialCard from "@/components/shared/TestimonialCard";
import { TESTIMONIALS } from "@/lib/content";

export default function Testimonials() {
  return (
    <Section id="testimonials">
      <AnimatedSection className="text-center mb-14">
        <Badge variant="gold" className="mb-4">
          Student Stories
        </Badge>
        <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-4">
          What Our Students Say
        </h2>
        <p className="text-charcoal/60 max-w-xl mx-auto">
          Hear directly from the students and families who have experienced
          learning at My Institute.
        </p>
      </AnimatedSection>

      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TESTIMONIALS.map((testimonial, i) => (
          <AnimatedSection key={testimonial.id} delay={i * 0.1}>
            <TestimonialCard testimonial={testimonial} />
          </AnimatedSection>
        ))}
      </div>
    </Section>
  );
}
