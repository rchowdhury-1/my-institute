import { BookOpen, Heart, Languages } from "lucide-react";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import { SERVICES } from "@/lib/content";

const iconMap: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen size={28} />,
  Heart: <Heart size={28} />,
  Languages: <Languages size={28} />,
};

export default function Services() {
  return (
    <Section variant="alt" id="services">
      <AnimatedSection className="text-center mb-14">
        <Badge variant="emerald" className="mb-4">
          What We Teach
        </Badge>
        <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-4">
          Our Services
        </h2>
        <p className="text-charcoal/60 max-w-xl mx-auto">
          Structured, personalised lessons delivered one-to-one by expert teachers.
        </p>
      </AnimatedSection>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {SERVICES.map((service, i) => (
          <AnimatedSection key={service.title} delay={i * 0.12}>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-black/5 hover:shadow-md hover:border-emerald-primary/20 transition-all h-full flex flex-col">
              <div className="w-14 h-14 rounded-xl bg-emerald-primary/10 text-emerald-primary flex items-center justify-center mb-6">
                {iconMap[service.icon]}
              </div>
              <h3 className="font-display text-xl font-bold text-charcoal mb-3">
                {service.title}
              </h3>
              <p className="text-charcoal/65 text-sm leading-relaxed flex-1">
                {service.description}
              </p>
            </div>
          </AnimatedSection>
        ))}
      </div>
    </Section>
  );
}
