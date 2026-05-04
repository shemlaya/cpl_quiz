"""Split a rendered page into N horizontal bands so Claude's Read tool
preserves enough resolution to read Hebrew text.

Usage:
    python tools/split_bands.py a 1     # split tools/_pages/a_p01.png into bands
"""
import os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = os.path.join(ROOT, "tools", "_pages")
BANDS_DIR = os.path.join(ROOT, "tools", "_bands")
os.makedirs(BANDS_DIR, exist_ok=True)

N_BANDS = 6
OVERLAP = 150  # px of vertical overlap so questions split across the seam stay readable

def split(prefix, page):
    src = os.path.join(PAGES, f"{prefix}_p{page:02d}.png")
    img = Image.open(src)
    w, h = img.size
    band_h = h // N_BANDS
    for i in range(N_BANDS):
        top = max(0, i * band_h - (OVERLAP if i > 0 else 0))
        bottom = min(h, (i + 1) * band_h + (OVERLAP if i < N_BANDS - 1 else 0))
        crop = img.crop((0, top, w, bottom))
        # Downscale slightly to keep file size manageable but preserve readability
        out = os.path.join(BANDS_DIR, f"{prefix}_p{page:02d}_b{i+1}.png")
        crop.save(out, optimize=True)
        print(f"  {out} ({crop.size[0]}x{crop.size[1]})")

def main():
    if len(sys.argv) < 3:
        print("Usage: python split_bands.py <a|b> <page-number>")
        sys.exit(1)
    prefix = sys.argv[1]
    page = int(sys.argv[2])
    split(prefix, page)

if __name__ == "__main__":
    main()
