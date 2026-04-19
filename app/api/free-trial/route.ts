import { NextRequest, NextResponse } from "next/server";
import { freeTrialSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
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
      // Log to console if RESEND_API_KEY is not configured
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
