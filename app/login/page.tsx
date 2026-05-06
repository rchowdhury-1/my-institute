"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import Button from "@/components/shared/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await api.post("/auth/login", { email, password });
      const { accessToken, user } = res.data;

      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("userRole", user.role);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("displayName", user.display_name);

      // Set a non-httpOnly cookie so middleware can read the role
      document.cookie = `userRole=${user.role}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;

      if (user.role === "admin" || user.role === "supervisor") {
        router.push("/supervisor");
      } else if (user.role === "teacher") {
        router.push("/teacher/dashboard");
      } else {
        router.push("/student/dashboard");
      }
    } catch (err: unknown) {
      setStatus("error");
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Invalid email or password.";
      setErrorMessage(message);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm";

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-charcoal mb-2">Welcome back</h1>
          <p className="text-charcoal/60 text-sm">Sign in to your My Institute account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {status === "loading" ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-charcoal/50">
          Don&apos;t have an account?{" "}
          <a href="/free-trial" className="text-emerald-primary font-medium hover:underline">
            Book a free trial
          </a>
        </p>
      </div>
    </main>
  );
}
