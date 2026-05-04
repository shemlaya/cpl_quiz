"""Detect each colored question-block on a rendered page and save it as
its own PNG. Each Moodle quiz block has a thin colored border (green/red/orange)
around a near-white interior — we find horizontal runs of those colors to slice
the page into individual blocks.

Usage:
    python tools/split_blocks.py a 1
"""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = os.path.join(ROOT, "tools", "_pages")
OUT = os.path.join(ROOT, "tools", "_blocks")
os.makedirs(OUT, exist_ok=True)

def is_gap_row(row):
    """Row is a gap between blocks if it's nearly pure white edge-to-edge."""
    r, g, b = row[..., 0], row[..., 1], row[..., 2]
    # All channels > 245 across nearly all pixels
    nonwhite = ((r < 245) | (g < 245) | (b < 245)).sum()
    return nonwhite < 30  # <30 non-white pixels in the whole row

def find_blocks(img_arr):
    h = img_arr.shape[0]
    is_gap = np.array([is_gap_row(img_arr[y]) for y in range(h)])
    # Find runs of consecutive content rows (non-gap)
    blocks = []
    in_block = False
    start = 0
    for y, gap in enumerate(is_gap):
        if not gap and not in_block:
            in_block, start = True, y
        elif gap and in_block:
            # Only end if we have a real gap (10+ consecutive gap rows)
            gap_end = y
            while gap_end < h and is_gap[gap_end]:
                gap_end += 1
            if gap_end - y >= 10:
                in_block = False
                if y - start > 80:  # ignore tiny artifacts
                    blocks.append((start, y))
    if in_block and h - start > 80:
        blocks.append((start, h))
    return blocks

def split(prefix, page):
    src = os.path.join(PAGES, f"{prefix}_p{page:02d}.png")
    img = Image.open(src).convert("RGB")
    arr = np.array(img)
    blocks = find_blocks(arr)
    print(f"  {len(blocks)} blocks on {prefix} page {page}")
    w = img.width
    for n, (top, bot) in enumerate(blocks, 1):
        # add small margin
        top = max(0, top - 6)
        bot = min(arr.shape[0], bot + 6)
        crop = img.crop((0, top, w, bot))
        # downscale to max width 1400 to keep Read-tool legibility high
        if crop.width > 1400:
            ratio = 1400 / crop.width
            crop = crop.resize((1400, int(crop.height * ratio)), Image.LANCZOS)
        out = os.path.join(OUT, f"{prefix}_p{page:02d}_q{n:02d}.png")
        crop.save(out, optimize=True)
        print(f"    {out} ({crop.size[0]}x{crop.size[1]})")

def main():
    if len(sys.argv) < 3:
        print("Usage: python split_blocks.py <a|b> <page-number>")
        sys.exit(1)
    split(sys.argv[1], int(sys.argv[2]))

if __name__ == "__main__":
    main()
