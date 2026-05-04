"""Show the top portion of a page so we can spot section headers / cut-off stems."""
import sys, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
prefix, page, top_pct, bottom_pct = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
src = os.path.join(ROOT, "tools", "_pages", f"{prefix}_p{page:02d}.png")
img = Image.open(src)
W, H = img.size
crop = img.crop((0, int(top_pct * H), W, int(bottom_pct * H)))
if crop.width > 1400:
    r = 1400 / crop.width
    crop = crop.resize((1400, int(crop.height * r)), Image.LANCZOS)
out = os.path.join(ROOT, "tools", "_peek.png")
crop.save(out)
print(out, crop.size)
