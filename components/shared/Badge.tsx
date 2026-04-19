import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "gold" | "emerald" | "subtle";
  className?: string;
}

export default function Badge({ children, variant = "gold", className }: BadgeProps) {
  const variantClasses = {
    gold: "bg-gold/10 text-gold-dark border border-gold/30",
    emerald: "bg-emerald-primary/10 text-emerald-primary border border-emerald-primary/30",
    subtle: "bg-charcoal/5 text-charcoal border border-charcoal/15",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
