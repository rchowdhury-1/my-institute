import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import PricingCard from "@/components/shared/PricingCard";
import { PACKAGES } from "@/lib/content";

export default function Pricing() {
  return (
    <Section variant="alt" id="pricing">
      <AnimatedSection className="text-center mb-14">
        <Badge variant="emerald" className="mb-4">
          Pricing
        </Badge>
        <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-4">
          Simple, Transparent Packages
        </h2>
        <p className="text-charcoal/60 max-w-xl mx-auto">
          Choose the plan that works for you. All packages include one-to-one
          lessons with an expert teacher.
        </p>
      </AnimatedSection>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {PACKAGES.map((pkg, i) => (
          <PricingCard
            key={pkg.name}
            pkg={pkg}
            delay={i * 0.1}
            popularBadgeStyle="inline"
            features={[
              `${pkg.lessons} lessons per month`,
              pkg.duration,
              "One-to-one with expert teacher",
              "Flexible scheduling",
            ]}
          />
        ))}
      </div>

      <AnimatedSection className="text-center mt-10">
        <p className="text-charcoal/50 text-sm">
          Not sure which plan is right for you?{" "}
          <a
            href="/free-trial"
            className="text-emerald-primary font-medium hover:underline"
          >
            Book a free trial first
          </a>
        </p>
      </AnimatedSection>
    </Section>
  );
}
