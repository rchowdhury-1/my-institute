"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { scholarshipSchema, type ScholarshipInput } from "@/lib/validators";
import Button from "@/components/shared/Button";

const INTEREST_OPTIONS: ScholarshipInput["interests"][number][] = [
  "Learn Quran",
  "Learn Arabic",
  "Learn Islamic Studies",
];

export default function ScholarshipForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScholarshipInput>({
    resolver: zodResolver(scholarshipSchema),
    defaultValues: { interests: [] },
  });

  const onSubmit = async (data: ScholarshipInput) => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/scholarship", {
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
      const msg = `New Scholarship Application\nName: ${data.firstName} ${data.lastName}\nEmail: ${data.email}\nPhone: ${data.phone}\nYear of Birth: ${data.yearOfBirth}\nHow Heard: ${data.howHeard}\nInterests: ${data.interests.join(", ")}\nAbout: ${data.aboutYourself}`;
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
          Application Submitted!
        </h3>
        <p className="text-charcoal/65 text-sm">
          Thank you for applying. We&apos;ll review your application and be in touch soon.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            First Name <span className="text-red-500">*</span>
          </label>
          <input {...register("firstName")} type="text" placeholder="Ahmed" className={inputClass} />
          {errors.firstName && <p className="mt-1.5 text-red-500 text-xs">{errors.firstName.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input {...register("lastName")} type="text" placeholder="Khan" className={inputClass} />
          {errors.lastName && <p className="mt-1.5 text-red-500 text-xs">{errors.lastName.message}</p>}
        </div>
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
          Phone Number (with country code) <span className="text-red-500">*</span>
        </label>
        <input {...register("phone")} type="tel" placeholder="+44 7700 900000" className={inputClass} />
        {errors.phone && <p className="mt-1.5 text-red-500 text-xs">{errors.phone.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          Year of Birth <span className="text-red-500">*</span>
        </label>
        <input
          {...register("yearOfBirth")}
          type="text"
          placeholder="e.g. 1995"
          maxLength={4}
          className={inputClass}
        />
        {errors.yearOfBirth && <p className="mt-1.5 text-red-500 text-xs">{errors.yearOfBirth.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          How did you hear about us? <span className="text-red-500">*</span>
        </label>
        <select {...register("howHeard")} className={`${inputClass} appearance-none`}>
          <option value="">Select one...</option>
          <option value="Friends">Friends</option>
          <option value="Social Media">Social Media</option>
          <option value="Other">Other</option>
        </select>
        {errors.howHeard && <p className="mt-1.5 text-red-500 text-xs">{errors.howHeard.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-2">
          What are you interested in? <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {INTEREST_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-3 cursor-pointer group">
              <input
                {...register("interests")}
                type="checkbox"
                value={option}
                className="w-4 h-4 rounded border-black/20 text-emerald-primary focus:ring-emerald-primary/30"
              />
              <span className="text-sm text-charcoal/75 group-hover:text-charcoal transition-colors">
                {option}
              </span>
            </label>
          ))}
        </div>
        {errors.interests && (
          <p className="mt-1.5 text-red-500 text-xs">{errors.interests.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          Tell us about yourself <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register("aboutYourself")}
          rows={5}
          placeholder="Tell us about your background, why you're applying for a scholarship, and what you hope to achieve..."
          className={`${inputClass} resize-none`}
        />
        {errors.aboutYourself && (
          <p className="mt-1.5 text-red-500 text-xs">{errors.aboutYourself.message}</p>
        )}
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
