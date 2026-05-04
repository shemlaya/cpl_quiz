"""Crop a diagram region from a rendered page and save into img/.

Usage:
    python tools/crop_diagram.py <prefix> <page> <left> <top> <right> <bottom> <out_id>

Coords are in fraction of page size (0.0 - 1.0) so the same script works at any
DPI. <out_id> becomes img/q<id>.png.

Example:
    python tools/crop_diagram.py a 2 0.30 0.50 0.62 0.85 q024
"""
import os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = os.path.join(ROOT, "tools", "_pages")
IMG = os.path.join(ROOT, "img")
os.makedirs(IMG, exist_ok=True)

def main():
    if len(sys.argv) != 8:
        print(__doc__)
        sys.exit(1)
    prefix, page, l, t, r, b, qid = sys.argv[1:]
    src = os.path.join(PAGES, f"{prefix}_p{int(page):02d}.png")
    img = Image.open(src)
    W, H = img.size
    box = (int(float(l) * W), int(float(t) * H), int(float(r) * W), int(float(b) * H))
    crop = img.crop(box)
    # Downscale max 900px wide for mobile-friendly file size
    if crop.width > 900:
        ratio = 900 / crop.width
        crop = crop.resize((900, int(crop.height * ratio)), Image.LANCZOS)
    out = os.path.join(IMG, f"{qid}.png")
    crop.save(out, optimize=True)
    print(f"  {out} ({crop.size[0]}x{crop.size[1]})")

if __name__ == "__main__":
    main()
