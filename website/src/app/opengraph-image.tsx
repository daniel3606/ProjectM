import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TITLE } from "@/constants/theme";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = SITE_TITLE;

export default function OpenGraphImage() {
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
          background: "linear-gradient(160deg, #FFF8F0 0%, #FFF2E5 45%, #F5E6D4 100%)",
          color: "#1C1C1E",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 28,
              background: "#FFF5EE",
              border: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#2C2C2E",
                left: 22,
                top: 42,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#2C2C2E",
                right: 22,
                top: 42,
              }}
            />
          </div>
          <div style={{ fontSize: 48, fontWeight: 700 }}>{SITE_NAME}</div>
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -1.5,
            maxWidth: 920,
          }}
        >
          Spend less time on your phone. Grow something instead.
        </div>
      </div>
    ),
    size,
  );
}
