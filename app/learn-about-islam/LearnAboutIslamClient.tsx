"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen, Users, MessageCircle, Heart, CheckCircle } from "lucide-react";
import { revertSchema, type RevertInput } from "@/lib/validators";
import { submitWithWhatsApp } from "@/lib/submitWithWhatsApp";
import Badge from "@/components/shared/Badge";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Button from "@/components/shared/Button";

function formatWhatsAppMessage(data: RevertInput): string {
  return [
    "Assalamu alaikum, a new revert has applied for the reverts programme.",
    "",
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `Country: ${data.country || "Not provided"}`,
    "",
    "Their journey:",
    data.story || "Not provided",
  ].join("\n");
}

const OFFERS = [
  {
    icon: BookOpen,
    title: "Free Quran Lessons",
    text: "A gentle introduction to the Quran, tailored to your pace and level.",
  },
  {
    icon: Users,
    title: "One-on-One Mentorship",
    text: "A dedicated teacher to guide you through the basics of faith and practice.",
  },
  {
    icon: MessageCircle,
    title: "Beginner Arabic",
    text: "Learn to read Arabic script and understand key phrases from the Quran.",
  },
  {
    icon: Heart,
    title: "A Welcoming Community",
    text: "Ask questions, share your journey, and learn in a judgement-free space.",
  },
];

const STEPS = [
  { num: "1", text: "Fill in the form below" },
  { num: "2", text: "Our team will contact you on WhatsApp within 24 hours" },
  { num: "3", text: "We'll arrange a free introductory session with a teacher" },
];

export default function LearnAboutIslamClient() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RevertInput>({
    resolver: zodResolver(revertSchema),
  });

  const onSubmit = async (data: RevertInput) => {
    setStatus("loading");
    setErrorMessage("");
    try {
      await submitWithWhatsApp({
        endpoint: "/revert-apply",
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

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-charcoal placeholder:text-charcoal/35 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all text-sm";

  return (
    <>
      {/* Hero */}
      <section className="pattern-hero pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="gold" className="mb-4">
            Reverts Programme
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            New to Islam? You&apos;re Not Alone.
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
            Free guidance, mentorship, and Quran classes for new Muslim reverts.
          </p>
          <a
            href="#apply"
            className="inline-flex items-center px-6 py-3 rounded-full bg-gold text-white font-semibold text-sm hover:bg-gold-dark transition-colors shadow-sm"
          >
            Get free support
          </a>
        </div>
      </section>

      {/* What we offer */}
      <Section>
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-3">
              What We Offer
            </h2>
            <p className="text-charcoal/50 text-sm max-w-lg mx-auto">
              Everything you need to begin your journey with confidence.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {OFFERS.map((card, i) => (
            <AnimatedSection key={card.title} delay={i * 0.1}>
              <div className="bg-white rounded-2xl border border-black/5 p-6 text-center shadow-sm h-full">
                <div className="w-12 h-12 rounded-full bg-emerald-primary/10 flex items-center justify-center mx-auto mb-4">
                  <card.icon size={20} className="text-emerald-primary" />
                </div>
                <h3 className="font-display text-sm font-bold text-charcoal mb-2">
                  {card.title}
                </h3>
                <p className="text-xs text-charcoal/60 leading-relaxed">
                  {card.text}
                </p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </Section>

      {/* Who this is for */}
      <section className="py-16 bg-cream">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="bg-white rounded-2xl border border-black/5 p-8 text-center shadow-sm">
              <h2 className="font-display text-2xl font-bold text-charcoal mb-4">
                Who This Is For
              </h2>
              <p className="text-charcoal/65 text-sm leading-relaxed max-w-xl mx-auto">
                Whether you&apos;ve recently embraced Islam or are exploring it for the
                first time, our reverts programme offers patient, structured support
                &mdash; no question is too small.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* What happens next */}
      <Section>
        <AnimatedSection>
          <div className="max-w-2xl mx-auto">
            <h2 className="font-display text-2xl font-bold text-charcoal mb-8 text-center">
              What Happens Next
            </h2>
            <div className="space-y-4">
              {STEPS.map((step) => (
                <div key={step.num} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {step.num}
                  </div>
                  <p className="text-charcoal/70 text-sm pt-1">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </Section>

      {/* Application form */}
      <section id="apply" className="py-16 bg-cream">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            {status === "success" ? (
              <div className="bg-emerald-primary/5 border border-emerald-primary/20 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-primary/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-emerald-primary" />
                </div>
                <h3 className="font-display text-xl font-bold text-charcoal mb-2">
                  Thank You
                </h3>
                <p className="text-charcoal/65 text-sm leading-relaxed">
                  We&apos;ll be in touch within 24 hours, insha&apos;Allah. We&apos;ve
                  also opened WhatsApp with your details &mdash; please send the message
                  to complete the process.
                </p>
                <p className="text-charcoal/40 text-xs mt-4">
                  If WhatsApp didn&apos;t open automatically, please message us at +20 106 782 7621.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border border-black/5 shadow-sm">
                <h2 className="font-display text-xl font-bold text-charcoal mb-6">
                  Get Started &mdash; Free Support
                </h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1.5">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register("name")}
                      type="text"
                      placeholder="Your full name"
                      className={inputClass}
                    />
                    {errors.name && (
                      <p className="mt-1.5 text-red-500 text-xs">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register("email")}
                      type="email"
                      placeholder="you@example.com"
                      className={inputClass}
                    />
                    {errors.email && (
                      <p className="mt-1.5 text-red-500 text-xs">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1.5">
                      Phone / WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register("phone")}
                      type="tel"
                      placeholder="+44 7700 900000"
                      className={inputClass}
                    />
                    {errors.phone && (
                      <p className="mt-1.5 text-red-500 text-xs">{errors.phone.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1.5">
                      Country
                    </label>
                    <input
                      {...register("country")}
                      type="text"
                      placeholder="e.g. United Kingdom"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1.5">
                      Tell us a bit about your journey
                    </label>
                    <textarea
                      {...register("story")}
                      rows={4}
                      placeholder="Whatever you're comfortable sharing — there's no wrong answer."
                      className={`${inputClass} resize-none`}
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
                    {status === "loading" ? "Submitting..." : "Get Free Support"}
                  </Button>
                </form>
              </div>
            )}
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
