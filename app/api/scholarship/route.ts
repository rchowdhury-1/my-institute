import { NextRequest } from "next/server";
import { scholarshipSchema } from "@/lib/validators";
import { handleFormSubmission } from "../_lib/sendFormEmail";

export async function POST(req: NextRequest) {
  return handleFormSubmission({
    req,
    schema: scholarshipSchema,
    logLabel: "[Scholarship Application]",
    buildEmail: (data) => ({
      subject: `Scholarship Application — ${data.fullName}`,
      body: `
New Scholarship Application
============================
Name:    ${data.fullName}
Email:   ${data.email}
Phone:   ${data.phone}
Country: ${data.country || "Not provided"}
Age:     ${data.age || "Not provided"}

Story:
${data.story || "Not provided"}

How they heard about us: ${data.source || "Not provided"}
      `.trim(),
    }),
  });
}
