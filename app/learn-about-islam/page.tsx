import type { Metadata } from "next";
import LearnAboutIslamClient from "./LearnAboutIslamClient";

export const metadata: Metadata = {
  title: "Free Islamic Studies for New Muslim Reverts — MY Institute",
  description:
    "Free Quran classes, one-on-one mentorship, and patient support for new Muslims. Get started with no commitment.",
};

export default function LearnAboutIslamPage() {
  return <LearnAboutIslamClient />;
}
