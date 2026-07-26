import { NextRequest } from "next/server";
import { z } from "zod";
import { handleFormSubmission } from "../_lib/sendFormEmail";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export async function POST(req: NextRequest) {
  return handleFormSubmission({
    req,
    schema: contactSchema,
    logLabel: "[Contact Form Submission]",
    buildEmail: (data) => ({
      subject: `Contact Message from ${data.name}`,
      body: `
New Contact Message
===================
Name:    ${data.name}
Email:   ${data.email}

Message:
${data.message}
      `.trim(),
    }),
  });
}
