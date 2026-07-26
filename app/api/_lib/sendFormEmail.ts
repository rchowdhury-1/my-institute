import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, FORM_RATE_LIMIT, FORM_RATE_LIMIT_WINDOW_MS } from "@/lib/rateLimit";
import { FALLBACK_CONTACT_EMAIL } from "@/lib/content";

interface HandleFormSubmissionOptions<T> {
  req: NextRequest;
  schema: z.ZodType<T>;
  logLabel: string;
  buildEmail: (data: T) => { subject: string; body: string };
}

/**
 * Shared body for the public form routes (contact, free-trial, scholarship):
 * rate-limit → validate → build the email → send-or-log → respond.
 *
 * When RESEND_API_KEY is unset, still responds 200 with `delivery: "disabled"`
 * (and logs the submission at warn level) so the public form doesn't break —
 * this is expected in local dev without the key configured.
 */
export async function handleFormSubmission<T>({
  req,
  schema,
  logLabel,
  buildEmail,
}: HandleFormSubmissionOptions<T>) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfter } = checkRateLimit(ip, FORM_RATE_LIMIT, FORM_RATE_LIMIT_WINDOW_MS);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a while before submitting again." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 3600) } }
    );
  }

  try {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid form data", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { subject, body: emailBody } = buildEmail(result.data);

    let delivery: "sent" | "disabled";
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "MY Institute <noreply@my-institute.com>",
        to: process.env.CONTACT_EMAIL || FALLBACK_CONTACT_EMAIL,
        subject,
        text: emailBody,
      });
      delivery = "sent";
    } else {
      console.warn(`${logLabel} RESEND_API_KEY not set — logging instead of sending.`);
      console.log(logLabel, emailBody);
      delivery = "disabled";
    }

    return NextResponse.json({ success: true, delivery }, { status: 200 });
  } catch (err) {
    console.error(logLabel, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
