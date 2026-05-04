"""Render scanned exam PDFs to PNG pages at high DPI.

Used during transcription so Claude can read the questions clearly. Not part
of the user-facing app. Run after copying the source PDFs into ``cpl_quiz/``
as ``_pdf_19-35.pdf`` / ``_pdf_36-57.pdf`` (the Hebrew folder name on disk
breaks bash, so the working copies live next to the renderer).

Usage:
    python tools/render_pages.py            # render every page of both PDFs
    python tools/render_pages.py 1 2 3 4    # only first PDF pages 1-4
"""
import os
import sys
import fitz

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "_pages")
os.makedirs(OUT, exist_ok=True)

PDFS = [
    ("_pdf_19-35.pdf", "a"),
    ("_pdf_36-57.pdf", "b"),
    ("_pdf_huka.pdf", "c"),
]

DPI = 300

def render(pdf_name, prefix, only=None):
    path = os.path.join(ROOT, pdf_name)
    doc = fitz.open(path)
    for i, page in enumerate(doc):
        if only and (i + 1) not in only:
            continue
        pix = page.get_pixmap(dpi=DPI)
        out = os.path.join(OUT, f"{prefix}_p{i+1:02d}.png")
        pix.save(out)
        print(f"  {out} ({pix.width}x{pix.height})")
    doc.close()

def main():
    only = set(int(x) for x in sys.argv[1:]) or None
    for pdf, prefix in PDFS:
        print(pdf)
        render(pdf, prefix, only)

if __name__ == "__main__":
    main()
