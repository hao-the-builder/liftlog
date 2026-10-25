"""
Generates the installed-app icon set from the Liftlog mark.

The mark is a plate on a bar seen from the side: a volt ring with the bar
running through it and out past both edges. Drawn here rather than exported
from a design tool so the geometry stays in the repo and the sizes can be
regenerated with one command.

Two variants, because they are different jobs:

  icon-*.png       the mark at full size on the app's near-black background
  maskable-*.png   the same mark inside the 80% safe zone, on a filled
                   background, so Android can crop it to a circle, a squircle
                   or a rounded square without clipping the plate

Run: python scripts/gen_icons.py
"""

from PIL import Image, ImageDraw

BG = (11, 13, 12, 255)  # --color-bg
VOLT = (212, 255, 63, 255)  # --color-volt
BAR_OPACITY = 0.38  # the bar recedes behind the plate, as in the SVG mark


def over(fg: tuple[int, int, int, int], bg: tuple[int, int, int, int], alpha: float):
    """Blend fg over bg and return an OPAQUE colour.

    ImageDraw replaces pixels rather than compositing them, so drawing with a
    translucent fill would leave real transparency in the icon. A maskable
    icon has to be opaque across the whole canvas or the launcher shows the
    wallpaper through it, so the blend is done here and drawn at full alpha.
    """
    return tuple(round(b + (f - b) * alpha) for f, b in zip(fg[:3], bg[:3])) + (255,)


BAR = over(VOLT, BG, BAR_OPACITY)

OUT = "public/icons"
SUPERSAMPLE = 4  # draw big, downsample once: cheap antialiasing


def draw_mark(size: int, safe_ratio: float) -> Image.Image:
    """One icon. safe_ratio is how much of the canvas the mark may occupy."""
    s = size * SUPERSAMPLE
    image = Image.new("RGBA", (s, s), BG)
    draw = ImageDraw.Draw(image)

    centre = s / 2
    # The SVG is a 48 unit square; scale every measurement from that so the
    # PNG and the inline SVG stay the same drawing.
    unit = (s * safe_ratio) / 48

    bar_half_height = 2.5 * unit
    bar_half_width = 22 * unit
    ring_radius = 13.5 * unit
    ring_width = 5 * unit
    hub_half_width = 4 * unit

    # Bar first, so the ring sits on top of it.
    draw.rounded_rectangle(
        [
            centre - bar_half_width,
            centre - bar_half_height,
            centre + bar_half_width,
            centre + bar_half_height,
        ],
        radius=unit,
        fill=BAR,
    )

    # The plate.
    draw.ellipse(
        [
            centre - ring_radius,
            centre - ring_radius,
            centre + ring_radius,
            centre + ring_radius,
        ],
        outline=VOLT,
        width=round(ring_width),
    )

    # The hub where the bar passes through, at full strength.
    draw.rounded_rectangle(
        [
            centre - hub_half_width,
            centre - bar_half_height,
            centre + hub_half_width,
            centre + bar_half_height,
        ],
        radius=unit,
        fill=VOLT,
    )

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    import os

    os.makedirs(OUT, exist_ok=True)

    # Standard icons: the mark fills the canvas.
    for size in (192, 512):
        draw_mark(size, safe_ratio=0.86).save(f"{OUT}/icon-{size}.png")

    # Maskable: the mark sits inside the 80% safe zone so any mask crops only
    # background. Android's minimum safe area is a circle of 80% diameter.
    for size in (192, 512):
        draw_mark(size, safe_ratio=0.60).save(f"{OUT}/maskable-{size}.png")

    # iOS home screen. No transparency, no mask: iOS rounds it itself.
    draw_mark(180, safe_ratio=0.80).convert("RGB").save(f"{OUT}/apple-touch-icon.png")

    # Browser tab. A .ico with the sizes Windows and Chrome actually ask for.
    favicon = draw_mark(256, safe_ratio=0.92)
    favicon.save(
        "src/app/favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    print("wrote:")
    for name in sorted(os.listdir(OUT)):
        print(f"  {OUT}/{name}")
    print("  src/app/favicon.ico")


if __name__ == "__main__":
    main()
