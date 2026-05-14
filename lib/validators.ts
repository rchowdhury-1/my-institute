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
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(7, "Please enter a valid phone / WhatsApp number"),
  country: z.string().optional(),
  age: z.string().optional(),
  story: z.string().optional(),
  source: z.string().optional(),
});

export const revertSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(7, "Please enter a valid phone / WhatsApp number"),
  country: z.string().optional(),
  story: z.string().optional(),
});

export type FreeTrialInput = z.infer<typeof freeTrialSchema>;
export type ScholarshipInput = z.infer<typeof scholarshipSchema>;
export type RevertInput = z.infer<typeof revertSchema>;
