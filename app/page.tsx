import type { Metadata } from "next";
import Hero from "@/components/home/Hero";
import Services from "@/components/home/Services";
import WhyChooseUs from "@/components/home/WhyChooseUs";
import Pricing from "@/components/home/Pricing";
import Testimonials from "@/components/home/Testimonials";
import CTA from "@/components/home/CTA";
import CmsSections from "@/components/home/CmsSections";

export const metadata: Metadata = {
  title: "Online Quran, Arabic & Islamic Studies",
  description:
    "Private online lessons in Quran, Arabic, and Islamic Studies for all ages. Expert teachers, flexible scheduling, one-to-one private lessons. Book your free trial today.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Services />
      <WhyChooseUs />
      <Pricing />
      <Testimonials />
      <CmsSections />
      <CTA />
    </>
  );
}
