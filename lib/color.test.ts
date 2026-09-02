import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import { hexToHsl, hslToHex, isPresetColor } from "@/lib/color";

describe("hslToHex", () => {
  it("converts the primary hues", () => {
    expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe("#FF0000");
    expect(hslToHex({ h: 120, s: 100, l: 50 })).toBe("#00FF00");
    expect(hslToHex({ h: 240, s: 100, l: 50 })).toBe("#0000FF");
  });

  it("returns grey when saturation is zero, whatever the hue", () => {
    expect(hslToHex({ h: 200, s: 0, l: 50 })).toBe("#808080");
  });

  it("wraps hue past a full turn", () => {
    expect(hslToHex({ h: 360, s: 100, l: 50 })).toBe(hslToHex({ h: 0, s: 100, l: 50 }));
    expect(hslToHex({ h: -120, s: 100, l: 50 })).toBe(hslToHex({ h: 240, s: 100, l: 50 }));
  });

  it("clamps saturation and lightness outside 0–100", () => {
    expect(hslToHex({ h: 0, s: 400, l: 400 })).toBe("#FFFFFF");
    expect(hslToHex({ h: 0, s: -50, l: -50 })).toBe("#000000");
  });
});

describe("hexToHsl", () => {
  it("expands three-digit hex", () => {
    expect(hexToHsl("#F00")).toEqual(hexToHsl("#FF0000"));
  });

  it("falls back to mid grey on unparseable input", () => {
    expect(hexToHsl("nonsense")).toEqual({ h: 0, s: 0, l: 50 });
  });

  it("round-trips every palette colour", () => {
    for (const { hex } of MARSHMALLOW_COLORS) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex.toUpperCase());
    }
  });
});

describe("isPresetColor", () => {
  it("matches palette entries regardless of case", () => {
    expect(isPresetColor("#FFB5C2")).toBe(true);
    expect(isPresetColor("#f5e689".toUpperCase())).toBe(true);
  });

  it("rejects a colour mixed in the custom picker", () => {
    expect(isPresetColor("#123456")).toBe(false);
  });

  it("rejects the removed Mint swatch", () => {
    expect(isPresetColor("#B5FFCB")).toBe(false);
  });
});
