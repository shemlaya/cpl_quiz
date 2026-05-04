"""Regenerate data/questions.js from data/questions.json.

The .js wrapper is loaded via a <script> tag so the app works under file://
without CORS issues. The .json file is the canonical source.
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ROOT, "data", "questions.json")
dst = os.path.join(ROOT, "data", "questions.js")

with open(src, encoding="utf-8") as f:
    data = json.load(f)

body = json.dumps(data, ensure_ascii=False, indent=2)
out = (
    "// Auto-loaded question bank. Generated from data/questions.json by tools/json_to_js.py.\n"
    "// Loaded via <script> tag so the app works when opening index.html directly (file://).\n"
    "window.QUESTIONS = " + body + ";\n"
)
with open(dst, "w", encoding="utf-8", newline="\n") as f:
    f.write(out)

print(f"Wrote {len(data)} questions to {dst}")
