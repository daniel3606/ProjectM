#!/usr/bin/env python3
"""Render `assets/images/splash-icon.png`, the launch screen's character.

The launch screen is drawn twice: once by iOS/Android from this PNG while the
JS bundle loads, and again by `components/LaunchScreen.tsx` once React is up.
For the handover between the two to go unnoticed they have to show the same
marshmallow, so the geometry below is `components/MarshmallowCharacter.tsx`'s
own 200x222 body units rather than a separately drawn piece of artwork.

The background is left transparent: `app.json` paints it with the same cream
the app uses, so the character reads as floating on the app's own background
instead of on a card.

    pip install pillow
    python3 scripts/generate-splash-icon.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "assets" / "images" / "splash-icon.png"

SIZE = 1024
SS = 3  # supersample factor; drawn at 3x and downsampled

# constants/colors.ts and constants/marshmallow.ts
EYE = (44, 44, 46)  # #2C2C2E
STRAWBERRY = (255, 181, 194)  # MARSHMALLOW_COLORS "Strawberry"  #FFB5C2

# The body is 222 units tall; at this scale it fills most of the canvas while
# leaving room for the ground shadow and its blur. The body is centred in the
# canvas rather than optically balanced against the shadow, so that the launch
# screen can place its own copy of the character over exactly the same spot —
# `LaunchScreen.tsx` derives its size from this ratio.
BODY_HEIGHT_PX = 800
CHAR_SCALE = BODY_HEIGHT_PX / 222


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
    # The app leaves this edge hard because the character sits on a scene that
    # hides it. Alone on the launch screen it would read as a grey slab, so
    # blur it just enough to pass as contact shadow.
    canvas.alpha_composite(ground.filter(ImageFilter.GaussianBlur(u(5))))

    # body shadow: offset (0, 6), radius 14, opacity 0.1
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (body[0], body[1] + u(6), body[2], body[3] + u(6)),
        radius=radius,
        fill=(0, 0, 0, round(255 * 0.10)),
    )
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(u(14) / 2)))

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
    layer.alpha_composite(shine, (round(left + u(28) - pad), round(top + u(14) - pad)))

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
    draw.arc(
        (mouth_cx - mouth_w / 2, mouth_top - mouth_h, mouth_cx + mouth_w / 2, mouth_top + mouth_h),
        start=20,
        end=160,
        fill=(*EYE, 255),
        width=max(1, round(u(2.5))),
    )

    canvas.alpha_composite(layer)


def main() -> None:
    canvas = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
    draw_character(canvas, CHAR_SCALE, SIZE / 2, SIZE / 2)

    icon = canvas.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    icon.save(OUTPUT, format="PNG", optimize=True)

    print(f"wrote {OUTPUT.relative_to(ROOT)} ({icon.width}x{icon.height})")


if __name__ == "__main__":
    main()
