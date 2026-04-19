import type { Testimonial } from "@/types";

interface TestimonialCardProps {
  testimonial: Testimonial;
}

export default function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "12px",
        border: "0.5px solid rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}
    >
      {/* iframe wrapper — top corners inherit the card radius */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9" }}>
        <iframe
          src={`https://www.youtube.com/embed/${testimonial.videoId}`}
          title={testimonial.name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
            display: "block",
          }}
        />
      </div>

      {/* Name label */}
      <div style={{ padding: "12px" }}>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "#1c1917",
            margin: 0,
            textAlign: "left",
          }}
        >
          {testimonial.name}
        </p>
      </div>
    </div>
  );
}
