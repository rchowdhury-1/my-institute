import type { Metadata } from "next";
import DonateClient from "./DonateClient";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Support My Institute by donating to our scholarship fund. Help make Quran and Islamic education accessible to all.",
};

export default function DonatePage() {
  return <DonateClient />;
}
