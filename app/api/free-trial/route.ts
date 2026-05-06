import { NextRequest, NextResponse } from "next/server";
import { freeTrialSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rateLimit";

// 5 submissions per IP per hour
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfter } = checkRateLimit(ip, RATE_LIMIT, WINDOW_MS);

  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "Too many requests. Please wait a while before submitting again.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter ?? 3600) },
      }
    );
  }

  try {
    const body = await req.json();
    const result = freeTrialSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid form data", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;

    const emailBody = `
New Free Trial Request
======================
Name:       ${data.firstName} ${data.lastName}
Email:      ${data.email}
Phone:      ${data.phone}
Interest:   ${data.interest}
Message:    ${data.message || "—"}
    `.trim();

    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "My Institute <noreply@myinstitute.com>",
        to: process.env.CONTACT_EMAIL || "myinstitute2026@gmail.com",
        subject: `Free Trial Request — ${data.firstName} ${data.lastName}`,
        text: emailBody,
      });
    } else {
      console.log("[Free Trial Submission]", emailBody);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[API /free-trial]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
