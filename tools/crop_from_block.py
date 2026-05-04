"""Crop a region out of an already-split question block PNG.

Faster than crop_diagram.py when the diagram is fully visible inside the
block — you don't have to compute page-relative fractions, just the region
inside the block itself.

Usage:
    python tools/crop_from_block.py c_p15_q02 0.55 0.05 0.95 0.50 q228
    # args: <block-name>  <left%> <top%> <right%> <bottom%>  <output_id>
    # writes img/q228.png
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) != 7:
        print(__doc__)
        sys.exit(1)
    block, l, t, r, b, qid = sys.argv[1:]
    if not block.endswith(".png"):
        block += ".png"
    src = os.path.join(ROOT, "tools", "_blocks", block)
    if not os.path.isfile(src):
        print(f"Not found: {src}")
        sys.exit(1)
    img = Image.open(src).convert("RGB")
    w, h = img.size
    box = (int(float(l) * w), int(float(t) * h), int(float(r) * w), int(float(b) * h))
    crop = img.crop(box)
    out = os.path.join(ROOT, "img", f"{qid}.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    crop.save(out, optimize=True)
    print(f"Wrote {out}  ({crop.size[0]}x{crop.size[1]})  from {block}{box}")


if __name__ == "__main__":
    main()
