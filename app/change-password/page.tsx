"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import Button from "@/components/shared/Button";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.push("/login");
    } else {
      setAuthChecked(true);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (newPassword.length < 8) {
      setStatus("error");
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus("error");
      setErrorMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");

    try {
      const token = localStorage.getItem("accessToken");
      await api.post(
        "/auth/change-password",
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const role = localStorage.getItem("userRole");
      if (role === "admin" || role === "supervisor") {
        router.push("/supervisor");
      } else if (role === "teacher") {
        router.push("/teacher/dashboard");
      } else {
        router.push("/student/dashboard");
      }
    } catch (err: unknown) {
      setStatus("error");
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Something went wrong. Please try again.";
      setErrorMessage(message);
    }
  };

  // Don't render anything until the auth check completes —
  // avoids a flash of the form before the redirect fires.
  if (!authChecked) return null;

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm";

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-charcoal mb-2">
            Set your password
          </h1>
          <p className="text-charcoal/60 text-sm">
            Choose a new password to secure your account.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setStatus("idle");
                }}
                placeholder="••••••••"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setStatus("idle");
                }}
                placeholder="••••••••"
                required
                className={inputClass}
              />
            </div>

            {status === "error" && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={status === "loading"}
              className="w-full py-4"
            >
              {status === "loading" ? "Saving…" : "Set password"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
