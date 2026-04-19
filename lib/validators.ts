import { z } from "zod";

export const freeTrialSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(7, "Please enter a valid phone number with country code"),
  interest: z.enum(["Quran", "Arabic", "Islamic Studies"] as const).refine(
    (val) => ["Quran", "Arabic", "Islamic Studies"].includes(val),
    { message: "Please select your area of interest" }
  ),
  message: z.string().optional(),
});

export const scholarshipSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(7, "Please enter a valid phone number with country code"),
  yearOfBirth: z
    .string()
    .min(1, "Year of birth is required")
    .regex(/^\d{4}$/, "Please enter a valid 4-digit year"),
  howHeard: z.enum(["Friends", "Social Media", "Other"] as const).refine(
    (val) => ["Friends", "Social Media", "Other"].includes(val),
    { message: "Please select how you heard about us" }
  ),
  interests: z
    .array(z.enum(["Learn Quran", "Learn Arabic", "Learn Islamic Studies"] as const))
    .min(1, "Please select at least one area of interest"),
  aboutYourself: z.string().min(20, "Please tell us a bit more about yourself (at least 20 characters)"),
});

export type FreeTrialInput = z.infer<typeof freeTrialSchema>;
export type ScholarshipInput = z.infer<typeof scholarshipSchema>;
