import { NextRequest } from "next/server";
import { freeTrialSchema } from "@/lib/validators";
import { handleFormSubmission } from "../_lib/sendFormEmail";

export async function POST(req: NextRequest) {
  return handleFormSubmission({
    req,
    schema: freeTrialSchema,
    logLabel: "[Free Trial Submission]",
    buildEmail: (data) => ({
      subject: `Free Trial Request — ${data.firstName} ${data.lastName}`,
      body: `
New Free Trial Request
======================
Name:       ${data.firstName} ${data.lastName}
Email:      ${data.email}
Phone:      ${data.phone}
Interest:   ${data.interest}
Message:    ${data.message || "—"}
      `.trim(),
    }),
  });
}
