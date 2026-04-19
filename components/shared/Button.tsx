import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "gold";

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
  disabled?: boolean;
  external?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-primary text-white hover:bg-emerald-light shadow-sm hover:shadow-md",
  secondary:
    "bg-transparent text-emerald-primary border-2 border-emerald-primary hover:bg-emerald-primary hover:text-white",
  outline:
    "bg-transparent text-charcoal border-2 border-charcoal/30 hover:border-charcoal hover:text-charcoal",
  gold:
    "bg-gold text-white hover:bg-gold-dark shadow-sm hover:shadow-md",
};

export default function Button({
  children,
  variant = "primary",
  href,
  onClick,
  type = "button",
  className,
  disabled,
  external,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed";

  const classes = cn(base, variantClasses[variant], className);

  if (href) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes}
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
