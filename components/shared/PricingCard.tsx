import { Check } from "lucide-react";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";

interface Package {
  name: string;
  price: number | string;
  currency: string;
  duration: string;
  lessons: number;
  featured?: boolean;
}

interface PricingCardProps {
  pkg: Package;
  features: string[];
  /** "inline" = centered pill above the card body (home page); "floating" = badge overlapping the card's top edge (packages page). */
  popularBadgeStyle: "inline" | "floating";
  delay?: number;
}

/** Shared pricing-tier card used on the homepage Pricing section and the /packages page. */
export default function PricingCard({ pkg, features, popularBadgeStyle, delay = 0 }: PricingCardProps) {
  return (
    <AnimatedSection delay={delay}>
      <div
        className={`relative rounded-2xl p-8 flex flex-col h-full transition-all ${
          pkg.featured
            ? "bg-emerald-primary text-white shadow-2xl shadow-emerald-primary/30 scale-105 border-2 border-emerald-primary"
            : "bg-white border border-black/5 shadow-sm hover:shadow-md"
        }`}
      >
        {pkg.featured && popularBadgeStyle === "inline" && (
          <div className="flex justify-center mb-4">
            <span className="inline-block bg-gold text-white text-xs font-bold uppercase tracking-widest px-6 py-2 rounded-full shadow-md">
              Most Popular
            </span>
          </div>
        )}
        {pkg.featured && popularBadgeStyle === "floating" && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <Badge variant="gold" className="shadow-md">
              Most Popular
            </Badge>
          </div>
        )}

        <div className="mb-6">
          <h3 className={`font-display text-2xl font-bold mb-1 ${pkg.featured ? "text-white" : "text-charcoal"}`}>
            {pkg.name}
          </h3>
          <div className="flex items-baseline gap-1 mt-3">
            <span className={`text-4xl font-bold ${pkg.featured ? "text-white" : "text-charcoal"}`}>
              {pkg.currency}{pkg.price}
            </span>
            <span className={`text-sm ${pkg.featured ? "text-white/70" : "text-charcoal/50"}`}>
              / month
            </span>
          </div>
        </div>

        <ul className="space-y-3 mb-8 flex-1">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  pkg.featured ? "bg-white/20" : "bg-emerald-primary/10"
                }`}
              >
                <Check size={12} className={pkg.featured ? "text-white" : "text-emerald-primary"} />
              </div>
              <span className={`text-sm ${pkg.featured ? "text-white/85" : "text-charcoal/70"}`}>
                {feature}
              </span>
            </li>
          ))}
        </ul>

        <Button href="/free-trial" variant={pkg.featured ? "gold" : "secondary"} className="w-full">
          Get Started
        </Button>
      </div>
    </AnimatedSection>
  );
}
