#!/usr/bin/env python3
"""Render `public/og-image-v2.png`, the 1200x630 social preview card.

The card is a build-time artifact so production never has to rasterise it:
the committed PNG is served straight from `public/`. Re-run this script after
changing the tagline, the brand colors, or the character.

The filename is versioned. X caches card images against their URL, so a
redrawn card under the same name never reaches posts already shared — bump
the suffix here and in `SITE_OG_IMAGE` together whenever the artwork changes.

    pip install pillow fonttools brotli
    python3 scripts/generate-og-image.py

Everything it draws comes from the site and the app rather than a new design
system:

* colors from `src/constants/theme.ts` and the `body` background in
  `src/app/globals.css`
* the wordmark and quote from `src/components/Hero.tsx`
* the SF Compact Rounded faces the site loads in `globals.css`
* the character geometry from `components/MarshmallowCharacter.tsx` in the
  app, in its own 200x222 body units, drawn at `CHAR_SCALE`
"""

from __future__ import annotations

import io
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "public" / "fonts"
OUTPUT = ROOT / "public" / "og-image-v2.png"

WIDTH, HEIGHT = 1200, 630
SS = 3  # supersample factor; the card is drawn at 3x and downsampled

# --- Brand tokens (src/constants/theme.ts, src/app/globals.css) -------------

TEXT = (28, 28, 30)  # --color-text  #1C1C1E
SECONDARY = (139, 99, 92)  # --color-secondary  #8B635C
SECONDARY_LIGHT = (168, 125, 117)  # --color-secondary-light  #A87D75
BG = (255, 242, 229)  # --color-bg  #FFF2E5
BG_SOFT = (255, 248, 240)  # --color-bg-soft  #FFF8F0
EYE = (44, 44, 46)  # --color-eye  #2C2C2E
STRAWBERRY = (255, 181, 194)  # MARSHMALLOW_COLORS "Strawberry"  #FFB5C2

# --- Copy (src/components/Hero.tsx) -----------------------------------------

WORDMARK = "Marshmallow"
QUOTE = "Spend less time on your phone. Grow something instead."
DOMAIN = "themarshmallow.app"

# --- Layout -----------------------------------------------------------------

MARGIN_X = 84
COLUMN_WIDTH = 600

WORDMARK_SIZE = 46
QUOTE_SIZE = 58
QUOTE_LINE_HEIGHT = 1.14
DOMAIN_SIZE = 26

GAP_WORDMARK_QUOTE = 28
GAP_QUOTE_DOMAIN = 36

# `letter-spacing` in em, matching .brand (-0.04em) and .title (-0.03em).
WORDMARK_TRACKING = -0.03
QUOTE_TRACKING = -0.03

CHAR_SCALE = 1.95
CHAR_CENTER_X = 945
CHAR_CENTER_Y = 306


def load_font(weight: str, size: float) -> ImageFont.FreeTypeFont:
    """Load one of the site's own woff2 faces at `size` pixels.

    Pillow cannot read woff2, so fontTools decompresses it to an in-memory
    TrueType file first. No derived font binary is checked in.
    """
    face = TTFont(FONT_DIR / f"SF-Compact-Rounded-{weight}.woff2")
    face.flavor = None
    buffer = io.BytesIO()
    face.save(buffer)
    buffer.seek(0)
    return ImageFont.truetype(buffer, size)


def tracked_width(font: ImageFont.FreeTypeFont, text: str, tracking: float) -> float:
    if not text:
        return 0.0
    return font.getlength(text) + tracking * (len(text) - 1)


def draw_tracked(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    tracking: float,
) -> None:
    """Draw `text` with CSS-style letter-spacing, keeping the font's kerning.

    Each glyph's origin is measured from the kerned prefix that precedes it,
    then pushed along by the accumulated tracking.
    """
    x, y = xy
    for index, char in enumerate(text):
        prefix = font.getlength(text[: index + 1]) - font.getlength(char)
        draw.text((x + prefix + index * tracking, y), char, font=font, fill=fill)


def greedy_wrap(
    font: ImageFont.FreeTypeFont, text: str, tracking: float, max_width: float
) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if current and tracked_width(font, candidate, tracking) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def wrap(font: ImageFont.FreeTypeFont, text: str, tracking: float, max_width: float) -> list[str]:
    """Wrap into the fewest lines, then even them out.

    Greedy wrapping leaves a short last line ("phone. Grow"), which reads badly
    at card size. Narrowing the measure as far as it will go without adding a
    line gives the same line count with far less rag.
    """
    lines = greedy_wrap(font, text, tracking, max_width)
    low, high = 0.0, max_width
    while high - low > 1:
        middle = (low + high) / 2
        if len(greedy_wrap(font, text, tracking, middle)) <= len(lines):
            high = middle
        else:
            low = middle
    return greedy_wrap(font, text, tracking, high)


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def build_background(size: tuple[int, int]) -> Image.Image:
    """Reproduce the `body` background from globals.css.

    The two radial highlights and the vertical ramp are smooth, so they are
    computed small and scaled up — the result is indistinguishable and avoids
    a per-pixel pass over the full supersampled canvas.
    """
    low_w, low_h = 300, 158
    base = Image.new("RGB", (low_w, low_h))
    pixels = base.load()

    for y in range(low_h):
        t = y / (low_h - 1)
        # linear-gradient(180deg, bg 0%, bg-soft 45%, bg 100%)
        color = lerp(BG, BG_SOFT, t / 0.45) if t <= 0.45 else lerp(BG_SOFT, BG, (t - 0.45) / 0.55)
        for x in range(low_w):
            pixels[x, y] = color

    radials = (
        # radial-gradient(1200px 600px at 85% -10%, rgba(255,255,255,0.7), transparent 55%)
        ((0.85, -0.10), (1200 / WIDTH, 600 / HEIGHT), (255, 255, 255), 0.70, 0.55),
        # radial-gradient(900px 500px at -10% 20%, rgba(168,125,117,0.12), transparent 50%)
        ((-0.10, 0.20), (900 / WIDTH, 500 / HEIGHT), SECONDARY_LIGHT, 0.12, 0.50),
    )

    for (cx, cy), (rx, ry), color, alpha, stop in radials:
        center_x, center_y = cx * low_w, cy * low_h
        radius_x, radius_y = rx * low_w, ry * low_h
        for y in range(low_h):
            dy = (y - center_y) / radius_y
            for x in range(low_w):
                dx = (x - center_x) / radius_x
                distance = (dx * dx + dy * dy) ** 0.5
                if distance >= stop:
                    continue
                a = alpha * (1 - distance / stop)
                pixels[x, y] = lerp(pixels[x, y], color, a)

    return base.resize(size, Image.Resampling.BICUBIC)


def draw_character(canvas: Image.Image, scale: float, center_x: float, center_y: float) -> None:
    """Draw the marshmallow, mirroring components/MarshmallowCharacter.tsx.

    Coordinates below are the component's own units for a 200x222 body; `u`
    converts them to canvas pixels.
    """

    def u(value: float) -> float:
        return value * scale * SS

    body_w, body_h = u(200), u(222)
    left = center_x * SS - body_w / 2
    top = center_y * SS - body_h / 2
    body = (left, top, left + body_w, top + body_h)
    radius = u(70)

    # groundShadow: 161x38 pill, marginLeft 30, bottom -8, rgba(0,0,0,0.06)
    ground = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ground_draw = ImageDraw.Draw(ground)
    ground_top = top + body_h + u(8) - u(38)
    ground_draw.rounded_rectangle(
        (left + u(30), ground_top, left + u(30) + u(161), ground_top + u(38)),
        radius=u(19),
        fill=(0, 0, 0, round(255 * 0.06)),
    )
    # The app leaves this edge hard; the phone's own shadow hides it there, so
    # blur it just enough that the pill does not read as a grey slab here.
    canvas.alpha_composite(ground.filter(ImageFilter.GaussianBlur(u(5))))

    # body shadow: offset (0, 6), radius 14, opacity 0.1
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (body[0], body[1] + u(6), body[2], body[3] + u(6)),
        radius=radius,
        fill=(0, 0, 0, round(255 * 0.10)),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(u(14) / 2))
    canvas.alpha_composite(shadow)

    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(
        body,
        radius=radius,
        fill=(*STRAWBERRY, 255),
        outline=(0, 0, 0, round(255 * 0.04)),
        width=max(1, round(u(1))),
    )

    # shine: 40x20 pill at top 14 / left 28, white 50%, rotated -20deg
    shine_w, shine_h = u(40), u(20)
    pad = round(shine_h)
    shine = Image.new("RGBA", (round(shine_w) + 2 * pad, round(shine_h) + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(shine).rounded_rectangle(
        (pad, pad, pad + shine_w, pad + shine_h),
        radius=u(10),
        fill=(255, 255, 255, round(255 * 0.5)),
    )
    shine = shine.rotate(20, resample=Image.Resampling.BICUBIC, expand=False)
    shine_box = (round(left + u(28) - pad), round(top + u(14) - pad))
    layer.alpha_composite(shine, shine_box)

    # Face. Measured against the app: eye centers sit 14u left of the body
    # centre, 117u below its top, 40u either side; the smile hangs 3.5u further
    # left with its top 147u below the body top.
    face_center_x = left + body_w / 2 - u(14)
    eye_center_y = top + u(117)
    eye_r = u(13)

    for direction in (-1, 1):
        eye_cx = face_center_x + direction * u(40)
        draw.ellipse(
            (eye_cx - eye_r, eye_center_y - eye_r, eye_cx + eye_r, eye_center_y + eye_r),
            fill=(*EYE, 255),
        )
        # eyeHighlight: 8x8 dot, top 5 / right 4 inside the 26u eye
        dot_cx = eye_cx - eye_r + u(18)
        dot_cy = eye_center_y - eye_r + u(9)
        draw.ellipse(
            (dot_cx - u(4), dot_cy - u(4), dot_cx + u(4), dot_cy + u(4)),
            fill=(255, 255, 255, 255),
        )

    # mouthSmileLine: bottom half of a 25x10 box, 2.5u stroke
    mouth_w, mouth_h = u(25), u(10)
    mouth_cx = face_center_x - u(3.5)
    mouth_top = top + u(147)
    stroke = max(1, round(u(2.5)))
    draw.arc(
        (
            mouth_cx - mouth_w / 2,
            mouth_top - mouth_h,
            mouth_cx + mouth_w / 2,
            mouth_top + mouth_h,
        ),
        start=20,
        end=160,
        fill=(*EYE, 255),
        width=stroke,
    )

    canvas.alpha_composite(layer)


def main() -> None:
    canvas = build_background((WIDTH * SS, HEIGHT * SS)).convert("RGBA")

    wordmark_font = load_font("Bold", WORDMARK_SIZE * SS)
    quote_font = load_font("Bold", QUOTE_SIZE * SS)
    domain_font = load_font("Semibold", DOMAIN_SIZE * SS)

    wordmark_tracking = WORDMARK_TRACKING * WORDMARK_SIZE * SS
    quote_tracking = QUOTE_TRACKING * QUOTE_SIZE * SS

    quote_lines = wrap(quote_font, QUOTE, quote_tracking, COLUMN_WIDTH * SS)
    line_height = QUOTE_SIZE * QUOTE_LINE_HEIGHT * SS

    # Cap heights, so the column is centred on the ink rather than on the
    # font's full line box.
    wordmark_cap = wordmark_font.getbbox(WORDMARK)[3] - wordmark_font.getbbox(WORDMARK)[1]
    domain_cap = domain_font.getbbox(DOMAIN)[3] - domain_font.getbbox(DOMAIN)[1]
    quote_block = line_height * (len(quote_lines) - 1) + (
        quote_font.getbbox(quote_lines[0])[3] - quote_font.getbbox(quote_lines[0])[1]
    )

    total = (
        wordmark_cap
        + GAP_WORDMARK_QUOTE * SS
        + quote_block
        + GAP_QUOTE_DOMAIN * SS
        + domain_cap
    )

    draw = ImageDraw.Draw(canvas)
    x = MARGIN_X * SS
    y = (HEIGHT * SS - total) / 2

    y -= wordmark_font.getbbox(WORDMARK)[1]
    draw_tracked(draw, (x, y), WORDMARK, wordmark_font, SECONDARY, wordmark_tracking)
    y += wordmark_cap + wordmark_font.getbbox(WORDMARK)[1] + GAP_WORDMARK_QUOTE * SS

    quote_y = y - quote_font.getbbox(quote_lines[0])[1]
    for line in quote_lines:
        draw_tracked(draw, (x, quote_y), line, quote_font, TEXT, quote_tracking)
        quote_y += line_height
    y += quote_block + GAP_QUOTE_DOMAIN * SS

    draw.text((x, y - domain_font.getbbox(DOMAIN)[1]), DOMAIN, font=domain_font, fill=SECONDARY_LIGHT)

    draw_character(canvas, CHAR_SCALE, CHAR_CENTER_X, CHAR_CENTER_Y)

    card = canvas.convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    card.save(OUTPUT, format="PNG", optimize=True)

    print(f"wrote {OUTPUT.relative_to(ROOT)} ({card.width}x{card.height})")
    print(f"quote lines: {quote_lines}")


if __name__ == "__main__":
    main()
