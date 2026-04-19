import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  variant?: "default" | "alt" | "dark";
}

export default function Section({
  children,
  className,
  id,
  variant = "default",
}: SectionProps) {
  const baseClasses = "py-16 md:py-24";
  const variantClasses = {
    default: "bg-cream",
    alt: "bg-cream-dark",
    dark: "bg-charcoal text-white",
  };

  return (
    <section id={id} className={cn(baseClasses, variantClasses[variant], className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}
