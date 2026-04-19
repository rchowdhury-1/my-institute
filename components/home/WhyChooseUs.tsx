import {
  GraduationCap,
  Clock,
  Users,
  User,
  TrendingUp,
  Gift,
} from "lucide-react";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import { WHY_CHOOSE_US } from "@/lib/content";

const iconMap: Record<string, React.ReactNode> = {
  GraduationCap: <GraduationCap size={22} />,
  Clock: <Clock size={22} />,
  Users: <Users size={22} />,
  User: <User size={22} />,
  TrendingUp: <TrendingUp size={22} />,
  Gift: <Gift size={22} />,
};

export default function WhyChooseUs() {
  return (
    <Section id="why-us">
      <AnimatedSection className="text-center mb-14">
        <Badge variant="gold" className="mb-4">
          Why My Institute
        </Badge>
        <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-4">
          Why Choose Us?
        </h2>
        <p className="text-charcoal/60 max-w-xl mx-auto">
          We go beyond just teaching — we create a nurturing environment where
          every student can thrive.
        </p>
      </AnimatedSection>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {WHY_CHOOSE_US.map((item, i) => (
          <AnimatedSection key={item.title} delay={i * 0.08}>
            <div className="flex gap-4 p-6 rounded-2xl bg-cream-dark border border-black/5 hover:border-emerald-primary/20 hover:bg-white transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-primary/10 text-emerald-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                {iconMap[item.icon]}
              </div>
              <div>
                <h3 className="font-semibold text-charcoal mb-1">{item.title}</h3>
                <p className="text-charcoal/60 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          </AnimatedSection>
        ))}
      </div>
    </Section>
  );
}
