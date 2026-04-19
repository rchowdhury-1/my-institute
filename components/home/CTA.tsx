import AnimatedSection from "@/components/shared/AnimatedSection";
import Button from "@/components/shared/Button";

export default function CTA() {
  return (
    <section className="pattern-hero py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <AnimatedSection>
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-10 bg-gold/60" />
            <span className="text-gold text-xs font-semibold tracking-[0.2em] uppercase">
              Begin Your Journey
            </span>
            <div className="h-px w-10 bg-gold/60" />
          </div>

          <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-6 max-w-2xl mx-auto">
            Ready to Start Your Journey?
          </h2>
          <p className="text-white/70 text-lg max-w-xl mx-auto mb-10">
            Book a free 30-minute trial session with one of our expert teachers.
            No commitment required.
          </p>
          <Button href="/free-trial" variant="gold" className="px-10 py-4 text-base">
            Book Your Free Trial
          </Button>
        </AnimatedSection>
      </div>
    </section>
  );
}
