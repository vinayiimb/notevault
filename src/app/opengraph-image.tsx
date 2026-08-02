import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

export const alt = `${SITE_NAME} — Delhi University Previous Year Question Papers`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default social-share card, inherited by every page that doesn't define
// its own opengraph-image/twitter-image in a nested route segment.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #5358e3 0%, #34beff 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 132,
            height: 132,
            borderRadius: 32,
            background: "rgba(255,255,255,0.16)",
            marginBottom: 40,
          }}
        >
          <span style={{ fontSize: 72 }}>🎓</span>
        </div>
        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 32,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          Delhi University Previous Year Question Papers
        </div>
      </div>
    ),
    { ...size }
  );
}
