import { NextRequest, NextResponse } from "next/server";
import { scholarshipSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = scholarshipSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid form data", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;

    const emailBody = `
New Scholarship Application
============================
Name:          ${data.firstName} ${data.lastName}
Email:         ${data.email}
Phone:         ${data.phone}
Year of Birth: ${data.yearOfBirth}
How Heard:     ${data.howHeard}
Interests:     ${data.interests.join(", ")}

About Themselves:
${data.aboutYourself}
    `.trim();

    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "My Institute <noreply@myinstitute.com>",
        to: process.env.CONTACT_EMAIL || "myinstitute2026@gmail.com",
        subject: `Scholarship Application — ${data.firstName} ${data.lastName}`,
        text: emailBody,
      });
    } else {
      // Log to console if RESEND_API_KEY is not configured
      console.log("[Scholarship Application]", emailBody);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[API /scholarship]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
