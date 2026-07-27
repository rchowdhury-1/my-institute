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
  if (variant === "create") {
    const roleLabel = role === "teacher" ? "teacher " : "";
    return (
      <div data-testid="success-banner" className="mb-6 p-4 bg-emerald-primary/10 border border-emerald-primary/20 rounded-2xl">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="text-sm text-charcoal">
            <p className="font-semibold text-emerald-primary mb-2">Account created for {name}</p>
            <p className="text-charcoal/70 mb-1">Login email: <span className="font-medium text-charcoal">{email}</span></p>
            <p className="text-charcoal/70">
              Temporary password:{" "}
              <span data-testid="temp-password" className="font-mono font-bold text-charcoal">{password}</span>
              <CopyButton text={password} />
            </p>
          </div>
          <button data-testid="btn-dismiss-success" onClick={onDismiss} className="text-charcoal/40 hover:text-charcoal transition-colors mt-0.5">
            <X size={16} />
          </button>
        </div>
        {emailSent ? (
          <p className="text-xs text-emerald-primary">✓ Welcome email sent</p>
        ) : (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-700 font-medium">⚠ Welcome email could not be sent — please share these credentials manually.</p>
            {emailError && <p className="text-xs text-amber-600 mt-1">Reason: {emailError}</p>}
            <a
              href={whatsAppUrl(BRAND.whatsapp, `Assalamu alaikum! Your My Institute ${roleLabel}account is ready.\n\nLogin: ${email}\nPassword: ${password}\n\nPlease log in at https://www.my-institute.com/login and set a new password.`) ?? undefined}
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

  return (
    <div data-testid="reset-banner" className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="text-sm text-charcoal">
          <p className="font-semibold text-amber-700 mb-2">Password reset for {name}</p>
          <p className="text-charcoal/70 mb-1">Login email: <span className="font-medium text-charcoal">{email}</span></p>
          <p className="text-charcoal/70">
            New temporary password:{" "}
            <span data-testid="reset-temp-password" className="font-mono font-bold text-charcoal">{password}</span>
            <CopyButton text={password} />
          </p>
        </div>
        <button onClick={onDismiss} className="text-charcoal/40 hover:text-charcoal transition-colors mt-0.5">
          <X size={16} />
        </button>
      </div>
      {emailSent ? (
        <p className="text-xs text-emerald-primary">✓ Password reset email sent</p>
      ) : (
        <div className="p-2 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-xs text-red-700 font-medium">⚠ Email could not be sent — please share the new password manually.</p>
          <a
            href={whatsAppUrl(BRAND.whatsapp, `Your My Institute password has been reset.\n\nLogin: ${email}\nNew password: ${password}\n\nPlease log in and set a new password.`) ?? undefined}
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
