import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/constants/theme";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#FFF2E5",
          color: "#1C1C1E",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 42, fontWeight: 700, color: "#8B635C", marginBottom: 20 }}>
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.12, maxWidth: 900 }}>
          Take back your screen time.
        </div>
      </div>
    ),
    size,
  );
}
