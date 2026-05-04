"""Analyze a Moodle review question block PNG to extract its color-coded metadata.

For each block under tools/_blocks/, report:
  - border color  → answered status
       green border = user answered CORRECTLY (the option marked with a green
                      ✓ inside the block IS the correct answer)
       red border   = user answered WRONG (the user's pick is marked with red
                      ✗; the correct answer is marked with green ✓ — it appears
                      WITHIN the same block, not in a separate explanation)
       orange/yellow border = unanswered/ambiguous
       (gray/beige  = NOT a question block, it's a feedback/explanation box —
                      skip these completely when transcribing)
  - markers found  → vertical y-coordinate of each colored marker
       Red marker (✗) at y=YYY  → the user's wrong pick
       Green marker (✓) at y=YYY → the correct answer
  - filled-radio rows → y-coordinates where the radio button is filled
       (the user's selection)

Pair the y-coordinates with the visible options (top-to-bottom) when reading the
PNG with the Read tool, to identify which option is correct.

Usage:
    python tools/analyze_block.py c_p13_q01
    python tools/analyze_block.py tools/_blocks/c_p13_q01.png
    python tools/analyze_block.py c_p13          # analyze every block on page 13
"""
import io
import os
import sys
import glob
import numpy as np
from PIL import Image

# Windows default cp1252 chokes on the arrows / check marks in our output.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLOCKS = os.path.join(ROOT, "tools", "_blocks")


def _classify_border(arr):
    """Return one of 'green' | 'red' | 'orange' | 'gray'."""
    h, w = arr.shape[:2]
    # Sample border row 8 (just inside the 6px margin the splitter adds).
    border = arr[8, 50:w - 50]
    r, g, b = [int(c) for c in border.mean(axis=0)]
    if g > r + 8 and g > b + 8:
        return f"green  RGB({r},{g},{b})  → correct answer; user answered correctly"
    if r > g + 8 and r > b + 8:
        return f"red    RGB({r},{g},{b})  → wrong answer; user picked wrong, correct ✓ also shown"
    if r > 200 and g > 150 and b < 180 and r > b + 15:
        return f"orange RGB({r},{g},{b})  → unanswered/ambiguous"
    if abs(r - g) < 10 and abs(g - b) < 10:
        return f"gray   RGB({r},{g},{b})  → NOT a question block (feedback/explanation box) — SKIP"
    return f"other  RGB({r},{g},{b})"


def _find_markers(arr, border_skip=20):
    """Find rows containing red ✗ or green ✓ marker icons.

    Excludes the outer ``border_skip`` pixels on every side so the colored
    block border doesn't dominate the search. Markers (✓ / ✗) are small icons
    that sit in the body, near the radio-button column.

    Returns a tuple (red_ys, green_ys) — y-coordinates (in the ORIGINAL block
    coordinates) of marker clusters.
    """
    h, w = arr.shape[:2]
    interior = arr[border_skip:h - border_skip, border_skip:w - border_skip]
    r, g, b = interior[..., 0].astype(int), interior[..., 1].astype(int), interior[..., 2].astype(int)

    # Saturated red ✗ icon: R high, G/B low. The Moodle ✗ icon is a deep red.
    # Border red is much paler, so require dark G and B.
    red_mask = (r > 180) & (g < 110) & (b < 110) & (r - g > 80) & (r - b > 80)
    # Saturated green ✓ icon: a deep green where R≈130, G≈180, B<80. The pale
    # border green has B>=120, so reject anything with B too high.
    green_mask = (r < 150) & (b < 100) & (g - r > 35) & (g - b > 80)

    ih = interior.shape[0]

    def _cluster_rows(mask):
        per_row = mask.sum(axis=1)
        kernel = np.ones(5)
        smoothed = np.convolve(per_row, kernel, mode="same")
        # A real ✓/✗ icon clusters ~30-200 saturated px in a small height range;
        # require a low minimum so we don't miss small icons.
        in_cluster = smoothed > 8
        ys = []
        i = 0
        while i < ih:
            if in_cluster[i]:
                start = i
                while i < ih and in_cluster[i]:
                    i += 1
                # Translate back to the original block coordinates
                ys.append((start + i) // 2 + border_skip)
            else:
                i += 1
        return ys

    return _cluster_rows(red_mask), _cluster_rows(green_mask)


def _find_text_rows(arr):
    """Find y-coordinate centers of horizontal text rows.

    Detects clusters of dark pixels (any glyphs) separated by white gaps.
    Useful for mapping a marker's y-coordinate to "the Nth text line in the
    block" without requiring fragile radio-button detection.
    """
    h, w = arr.shape[:2]
    r, g, b = arr[..., 0].astype(int), arr[..., 1].astype(int), arr[..., 2].astype(int)
    # Anything noticeably darker than background counts as "text-ish".
    dark = (r < 170) & (g < 170) & (b < 170)
    per_row = dark.sum(axis=1)
    # Threshold relative to row width — text rows have many dark pixels.
    threshold = max(20, w * 0.02)
    rows = []
    i = 0
    while i < h:
        if per_row[i] >= threshold:
            start = i
            while i < h and per_row[i] >= threshold:
                i += 1
            if (i - start) >= 4:
                rows.append((start + i) // 2)
        else:
            i += 1
    return rows


def _resolve(name):
    """Accept 'c_p13_q01', 'c_p13_q01.png', or a full path."""
    if os.path.isfile(name):
        return [name]
    if os.path.isfile(os.path.join(BLOCKS, name)):
        return [os.path.join(BLOCKS, name)]
    if os.path.isfile(os.path.join(BLOCKS, name + ".png")):
        return [os.path.join(BLOCKS, name + ".png")]
    # Treat as a glob prefix → all blocks on a page (e.g. 'c_p13')
    matches = sorted(glob.glob(os.path.join(BLOCKS, name + "_*.png")))
    if matches:
        return matches
    raise FileNotFoundError(name)


def _nearest_text_row(text_rows, y, tolerance=18):
    """Index of the closest text row (1-based) to y. Useful as a hint for which
    visible line a marker is on. Returns None if no row is within tolerance."""
    if not text_rows:
        return None
    best_idx, best_dist = None, tolerance + 1
    for idx, ty in enumerate(text_rows, 1):
        d = abs(ty - y)
        if d < best_dist:
            best_idx, best_dist = idx, d
    return best_idx


def analyze(path):
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    h, w = arr.shape[:2]
    name = os.path.basename(path)
    print(f"=== {name}  ({w}x{h}) ===")
    print(f"  size   : {w}x{h}")
    print(f"  border : {_classify_border(arr)}")
    red_ys, green_ys = _find_markers(arr)
    text_rows = _find_text_rows(arr)
    print(f"  text rows ({len(text_rows)}): y = {text_rows}")
    if green_ys:
        for y in green_ys:
            idx = _nearest_text_row(text_rows, y)
            pct = round(100 * y / h, 1)
            print(f"  green ✓ at y={y} ({pct}% down)  ≈ text-row #{idx}  → option text on this row is CORRECT")
    else:
        print(f"  green ✓ : none")
    if red_ys:
        for y in red_ys:
            idx = _nearest_text_row(text_rows, y)
            pct = round(100 * y / h, 1)
            print(f"  red ✗  at y={y} ({pct}% down)  ≈ text-row #{idx}  → user's wrong pick (or another wrong option)")
    else:
        print(f"  red ✗  : none")
    print()


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    for arg in sys.argv[1:]:
        for path in _resolve(arg):
            analyze(path)


if __name__ == "__main__":
    main()
