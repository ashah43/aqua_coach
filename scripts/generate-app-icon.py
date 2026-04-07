#!/usr/bin/env python3
"""Composite aquacoach-logo onto a white 1024² canvas for app icons. Edit PAD_RATIO below."""

from pathlib import Path

from PIL import Image

# Logo scale: longest side of the logo as a fraction of the 1024px canvas (0–1).
# Higher = larger logo (less white margin). Uses resize (not thumbnail), so small sources upscale.
PAD_RATIO = 0.94

ROOT = Path(__file__).resolve().parents[1]
LOGO = ROOT / "assets/images/aquacoach-logo.png"
SIZE = 1024

OUTS = [
    ROOT / "assets/images/icon.png",
    ROOT / "assets/images/adaptive-icon.png",
    ROOT / "ios/rowing/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png",
]


def scale_logo_to_max_side(logo: Image.Image, max_side: int) -> Image.Image:
    """Fit inside max_side×max_side, preserving aspect ratio (unlike thumbnail(), this upscales)."""
    w, h = logo.size
    if w < 1 or h < 1:
        return logo
    longest = max(w, h)
    scale = max_side / longest
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return logo.resize((new_w, new_h), Image.Resampling.LANCZOS)


def main() -> None:
    logo = Image.open(LOGO).convert("RGBA")
    canvas = Image.new("RGB", (SIZE, SIZE), (255, 255, 255))
    max_side = int(SIZE * PAD_RATIO)
    layer = scale_logo_to_max_side(logo, max_side)
    x = (SIZE - layer.width) // 2
    y = (SIZE - layer.height) // 2
    canvas.paste(layer, (x, y), layer)
    for path in OUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(path, "PNG", optimize=True)
        print("Wrote", path)


if __name__ == "__main__":
    main()
