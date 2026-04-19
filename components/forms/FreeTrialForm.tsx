"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { freeTrialSchema, type FreeTrialInput } from "@/lib/validators";
import Button from "@/components/shared/Button";

export default function FreeTrialForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FreeTrialInput>({
    resolver: zodResolver(freeTrialSchema),
  });

  const onSubmit = async (data: FreeTrialInput) => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/free-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
      reset();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      const msg = `New Free Trial Request\nName: ${data.firstName} ${data.lastName}\nEmail: ${data.email}\nPhone: ${data.phone}\nCourse: ${data.interest}\nMessage: ${data.message || ""}`;
      window.open(`https://wa.me/201067827621?text=${encodeURIComponent(msg)}`);
    }
  };

  if (status === "success") {
    return (
      <div className="bg-emerald-primary/5 border border-emerald-primary/20 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-primary/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-display text-xl font-bold text-charcoal mb-2">
          Request Received!
        </h3>
        <p className="text-charcoal/65 text-sm">
          Thank you! We&apos;ll be in touch shortly to arrange your free session.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register("firstName")}
            type="text"
            placeholder="Ahmed"
            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm"
          />
          {errors.firstName && (
            <p className="mt-1.5 text-red-500 text-xs">{errors.firstName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register("lastName")}
            type="text"
            placeholder="Khan"
            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm"
          />
          {errors.lastName && (
            <p className="mt-1.5 text-red-500 text-xs">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          {...register("email")}
          type="email"
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm"
        />
        {errors.email && (
          <p className="mt-1.5 text-red-500 text-xs">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          Phone Number (with country code) <span className="text-red-500">*</span>
        </label>
        <input
          {...register("phone")}
          type="tel"
          placeholder="+44 7700 900000"
          className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm"
        />
        {errors.phone && (
          <p className="mt-1.5 text-red-500 text-xs">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          Area of Interest <span className="text-red-500">*</span>
        </label>
        <select
          {...register("interest")}
          className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm appearance-none"
        >
          <option value="">Select an area...</option>
          <option value="Quran">Quran</option>
          <option value="Arabic">Arabic</option>
          <option value="Islamic Studies">Islamic Studies</option>
        </select>
        {errors.interest && (
          <p className="mt-1.5 text-red-500 text-xs">{errors.interest.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          Message <span className="text-charcoal/40 font-normal">(optional)</span>
        </label>
        <textarea
          {...register("message")}
          rows={4}
          placeholder="Tell us a bit about yourself, your level, or any questions you have..."
          className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm resize-none"
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
        {status === "loading" ? "Submitting..." : "Request Free Session"}
      </Button>
    </form>
  );
}
