#!/usr/bin/env python3
"""Render `assets/images/splash-icon.png`, the launch screen's two eyes.

The launch screen is drawn twice: once by iOS/Android from this PNG while the
JS bundle loads, and again by `components/LaunchScreen.tsx` once React is up.
They show the same image at the same size so the handover is invisible.

The background is left transparent: `app.json` paints it with the same cream
the app uses.

    pip install pillow
    python3 scripts/generate-splash-icon.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "assets" / "images" / "splash-icon.png"

SIZE = 1024
SS = 3  # supersample factor; drawn at 3x and downsampled

# components/MarshmallowCharacter.tsx
EYE = (44, 44, 46)  # #2C2C2E
EYE_DIAMETER = 26
EYE_GAP = 54
HIGHLIGHT_SIZE = 8
HIGHLIGHT_TOP = 5
HIGHLIGHT_RIGHT = 4

# Pair width in the character's own units (26 + 54 + 26).
PAIR_WIDTH = EYE_DIAMETER * 2 + EYE_GAP

# Fill most of the canvas; padding keeps `contain` from clipping the circles.
PAIR_WIDTH_PX = 820
SCALE = PAIR_WIDTH_PX / PAIR_WIDTH


def draw_eyes(canvas: Image.Image, scale: float, center_x: float, center_y: float) -> None:
    def u(value: float) -> float:
        return value * scale * SS

    diameter = u(EYE_DIAMETER)
    gap = u(EYE_GAP)
    pair_width = diameter * 2 + gap
    left = center_x * SS - pair_width / 2
    top = center_y * SS - diameter / 2
    highlight = u(HIGHLIGHT_SIZE)

    draw = ImageDraw.Draw(canvas)

    for i in range(2):
        eye_left = left + i * (diameter + gap)
        draw.ellipse(
            (eye_left, top, eye_left + diameter, top + diameter),
            fill=(*EYE, 255),
        )
        # eyeHighlight: 8x8, top 5 / right 4 inside the 26u eye
        dot_left = eye_left + diameter - u(HIGHLIGHT_RIGHT) - highlight
        dot_top = top + u(HIGHLIGHT_TOP)
        draw.ellipse(
            (dot_left, dot_top, dot_left + highlight, dot_top + highlight),
            fill=(255, 255, 255, 255),
        )


def main() -> None:
    canvas = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
    draw_eyes(canvas, SCALE, SIZE / 2, SIZE / 2)

    icon = canvas.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    icon.save(OUTPUT, format="PNG", optimize=True)

    print(f"wrote {OUTPUT.relative_to(ROOT)} ({icon.width}x{icon.height})")


if __name__ == "__main__":
    main()
