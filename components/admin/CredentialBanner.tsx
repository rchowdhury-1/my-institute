import { X } from "lucide-react";
import { BRAND } from "@/lib/content";
import { whatsAppUrl } from "@/lib/labels";
import CopyButton from "@/components/shared/CopyButton";

interface CredentialBannerProps {
  variant: "create" | "reset";
  role: "teacher" | "student";
  name: string;
  email: string;
  password: string;
  emailSent: boolean;
  emailError?: string;
  onDismiss: () => void;
}

interface VariantConfig {
  testId: string;
  containerClass: string;
  heading: (name: string) => string;
  headingClass: string;
  passwordTestId: string;
  passwordLabel: string;
  emailSentMessage: string;
  emailFailedClass: string;
  emailFailedTextClass: string;
  emailFailedMessage: string;
  emailErrorTextClass: string;
  waMessage: (email: string, password: string) => string;
}

function getVariantConfig(variant: "create" | "reset", role: "teacher" | "student"): VariantConfig {
  if (variant === "create") {
    const roleLabel = role === "teacher" ? "teacher " : "";
    return {
      testId: "success-banner",
      containerClass: "mb-6 p-4 bg-emerald-primary/10 border border-emerald-primary/20 rounded-2xl",
      heading: (name) => `Account created for ${name}`,
      headingClass: "font-semibold text-emerald-primary mb-2",
      passwordTestId: "temp-password",
      passwordLabel: "Temporary password:",
      emailSentMessage: "✓ Welcome email sent",
      emailFailedClass: "p-2 bg-amber-50 border border-amber-200 rounded-xl",
      emailFailedTextClass: "text-xs text-amber-700 font-medium",
      emailFailedMessage: "⚠ Welcome email could not be sent — please share these credentials manually.",
      emailErrorTextClass: "text-xs text-amber-600 mt-1",
      waMessage: (email, password) =>
        `Assalamu alaikum! Your My Institute ${roleLabel}account is ready.\n\nLogin: ${email}\nPassword: ${password}\n\nPlease log in at https://www.my-institute.com/login and set a new password.`,
    };
  }

  return {
    testId: "reset-banner",
    containerClass: "mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl",
    heading: (name) => `Password reset for ${name}`,
    headingClass: "font-semibold text-amber-700 mb-2",
    passwordTestId: "reset-temp-password",
    passwordLabel: "New temporary password:",
    emailSentMessage: "✓ Password reset email sent",
    emailFailedClass: "p-2 bg-red-50 border border-red-200 rounded-xl",
    emailFailedTextClass: "text-xs text-red-700 font-medium",
    emailFailedMessage: "⚠ Email could not be sent — please share the new password manually.",
    emailErrorTextClass: "text-xs text-red-600 mt-1",
    waMessage: (email, password) =>
      `Your My Institute password has been reset.\n\nLogin: ${email}\nNew password: ${password}\n\nPlease log in and set a new password.`,
  };
}

export default function CredentialBanner({
  variant,
  role,
  name,
  email,
  password,
  emailSent,
  emailError,
  onDismiss,
}: CredentialBannerProps) {
  const config = getVariantConfig(variant, role);

  return (
    <div data-testid={config.testId} className={config.containerClass}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="text-sm text-charcoal">
          <p className={config.headingClass}>{config.heading(name)}</p>
          <p className="text-charcoal/70 mb-1">Login email: <span className="font-medium text-charcoal">{email}</span></p>
          <p className="text-charcoal/70">
            {config.passwordLabel}{" "}
            <span data-testid={config.passwordTestId} className="font-mono font-bold text-charcoal">{password}</span>
            <CopyButton text={password} />
          </p>
        </div>
        <button
          data-testid={variant === "create" ? "btn-dismiss-success" : undefined}
          onClick={onDismiss}
          className="text-charcoal/40 hover:text-charcoal transition-colors mt-0.5"
        >
          <X size={16} />
        </button>
      </div>
      {emailSent ? (
        <p className="text-xs text-emerald-primary">{config.emailSentMessage}</p>
      ) : (
        <div className={config.emailFailedClass}>
          <p className={config.emailFailedTextClass}>{config.emailFailedMessage}</p>
          {emailError && <p className={config.emailErrorTextClass}>Reason: {emailError}</p>}
          <a
            href={whatsAppUrl(BRAND.whatsapp, config.waMessage(email, password)) ?? undefined}
            target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors"
          >
            Share via WhatsApp →
          </a>
        </div>
      )}
    </div>
  );
}
