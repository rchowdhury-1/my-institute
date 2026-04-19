import { Check } from "lucide-react";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
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

              <div className="mb-6">
                <h3
                  className={`font-display text-2xl font-bold mb-1 ${
                    pkg.featured ? "text-white" : "text-charcoal"
                  }`}
                >
                  {pkg.name}
                </h3>
                <div className="flex items-baseline gap-1 mt-3">
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
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-3">
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
                    {pkg.lessons} lessons per month
                  </span>
                </li>
                <li className="flex items-center gap-3">
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
                    {pkg.duration}
                  </span>
                </li>
                <li className="flex items-center gap-3">
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
                    One-to-one with expert teacher
                  </span>
                </li>
                <li className="flex items-center gap-3">
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
                    Flexible scheduling
                  </span>
                </li>
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
