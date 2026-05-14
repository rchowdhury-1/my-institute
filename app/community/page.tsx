import type { Metadata } from "next";
import CommunityClient from "./CommunityClient";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Quotes, achievements, and updates from MY Institute.",
};

export default function CommunityPage() {
  return <CommunityClient />;
}
