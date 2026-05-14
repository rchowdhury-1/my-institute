"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { scholarshipSchema, type ScholarshipInput } from "@/lib/validators";
import { submitWithWhatsApp } from "@/lib/submitWithWhatsApp";
import Button from "@/components/shared/Button";

function formatWhatsAppMessage(data: ScholarshipInput): string {
  return [
    "Assalamu alaikum, I'd like to apply for the scholarship programme.",
    "",
    `Name: ${data.fullName}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `Country: ${data.country || "Not provided"}`,
    `Age: ${data.age || "Not provided"}`,
    "",
    "My story:",
    data.story || "Not provided",
    "",
    `How I heard about MY Institute: ${data.source || "Not provided"}`,
  ].join("\n");
}

export default function ScholarshipForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ScholarshipInput>({
    resolver: zodResolver(scholarshipSchema),
  });

  const onSubmit = async (data: ScholarshipInput) => {
    setStatus("loading");
    setErrorMessage("");

    try {
      await submitWithWhatsApp({
        endpoint: "/scholarship-apply",
        formData: data,
        whatsappTemplate: formatWhatsAppMessage,
      });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
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
          Application Received &mdash; JazakAllahu Khairan
        </h3>
        <p className="text-charcoal/65 text-sm leading-relaxed">
          Your scholarship application has been submitted. We&apos;ve also opened
          WhatsApp with your details &mdash; please send the message to complete the
          process. Mohammad will respond within 24 hours, insha&apos;Allah.
        </p>
        <p className="text-charcoal/40 text-xs mt-4">
          If WhatsApp didn&apos;t open automatically, please message us at +20 106 782 7621.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input {...register("fullName")} type="text" placeholder="Ahmed Khan" className={inputClass} />
        {errors.fullName && <p className="mt-1.5 text-red-500 text-xs">{errors.fullName.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input {...register("email")} type="email" placeholder="you@example.com" className={inputClass} />
        {errors.email && <p className="mt-1.5 text-red-500 text-xs">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          Phone / WhatsApp Number <span className="text-red-500">*</span>
        </label>
        <input {...register("phone")} type="tel" placeholder="+44 7700 900000" className={inputClass} />
        {errors.phone && <p className="mt-1.5 text-red-500 text-xs">{errors.phone.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            Country
          </label>
          <input {...register("country")} type="text" placeholder="e.g. United Kingdom" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            Age
          </label>
          <input {...register("age")} type="text" placeholder="e.g. 25" className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          Your Story &mdash; why are you applying for a scholarship?
        </label>
        <textarea
          {...register("story")}
          rows={4}
          placeholder="Tell us about your background and why you'd like a scholarship..."
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          How did you hear about us?
        </label>
        <input {...register("source")} type="text" placeholder="e.g. Facebook, a friend, etc." className={inputClass} />
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
        {status === "loading" ? "Submitting..." : "Submit Application"}
      </Button>
    </form>
  );
}
