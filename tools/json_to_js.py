"""Regenerate per-test data/<id>.js from data/<id>.json.

The .js wrappers are loaded via <script> tags so the app works under file://
without CORS issues. The .json files are the canonical source.

Usage:
  python tools/json_to_js.py                # regenerate ALL tests in TEST_IDS
  python tools/json_to_js.py <test-id>      # regenerate one test

The list below must mirror data/tests.js (same ids, in the same order).
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")

# Keep in sync with data/tests.js. Each id maps to data/<id>.json and data/<id>.js.
TEST_IDS = [
    "heli-conversion",
    "c172-open",
    "c172-closed",
]


def regen(test_id: str) -> int:
    src = os.path.join(DATA_DIR, f"{test_id}.json")
    dst = os.path.join(DATA_DIR, f"{test_id}.js")

    if not os.path.exists(src):
        raise FileNotFoundError(f"Missing source file: {src}")

    with open(src, encoding="utf-8") as f:
        data = json.load(f)

    # Accept either a bare list (legacy shape) or {"questions": [...]}.
    if isinstance(data, dict) and "questions" in data:
        questions = data["questions"]
    elif isinstance(data, list):
        questions = data
    else:
        raise ValueError(f"{src}: expected a list or an object with a 'questions' key")

    body = json.dumps(questions, ensure_ascii=False, indent=2)
    out = (
        f"// Auto-loaded question bank for test '{test_id}'.\n"
        f"// Generated from data/{test_id}.json by tools/json_to_js.py.\n"
        f"// Loaded via <script> tag so the app works when opening index.html directly (file://).\n"
        f"window.TEST_BANKS = window.TEST_BANKS || {{}};\n"
        f"window.TEST_BANKS[{json.dumps(test_id)}] = " + body + ";\n"
    )
    with open(dst, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)

    print(f"Wrote {len(questions)} questions to {dst}")
    return len(questions)


def main():
    if len(sys.argv) > 1:
        targets = sys.argv[1:]
    else:
        targets = TEST_IDS

    for t in targets:
        regen(t)


if __name__ == "__main__":
    main()
