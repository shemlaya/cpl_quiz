# CPL Quiz

A static, RTL Hebrew quiz app for Commercial Pilot License (CPL) exam prep. Runs entirely in the browser — open `index.html` directly (`file://` works) or serve the folder over HTTP.

## Running

```bash
python -m http.server 8765
# then open http://localhost:8765/
```

Or just double-click `index.html`. The app is plain HTML/CSS/JS with no build step. A PWA manifest is included so it installs to the home screen on mobile.

## Modes

Four study modes, wired through `js/modes.js` + `js/store.js`:

| Mode | Behaviour |
|---|---|
| תרגול חופשי (practice) | Random order, immediate feedback after each submit. |
| סימולציית מבחן (exam) | 30 random questions, no per-question feedback, pass threshold 75%, summary lists every wrong question with the correct answer. |
| שאלות חלשות (SRS) | 20 questions ordered by Leitner box (correct → promote up to box 5, wrong → reset to box 1). Weakest first. |
| סטטיסטיקה (stats) | Per-topic accuracy bars + Leitner box histogram + reset button. |

## Tests

A topbar dropdown switches between question banks (only shown when ≥2 tests exist). The currently included banks:

| Test id | Title | Questions |
|---|---|---|
| `heli-conversion` | מבחן הסבה משולב למסוקאים | 452 |
| `c172-open` | צסנה 172 - ספר פתוח | 37 |
| `c172-closed` | צסנה 172 - ספר סגור | 182 |

The last-visited test is restored on boot.

## Storage

State lives in `localStorage` under the namespace `cpl_quiz_v1`, bucketed per test (schema v2):

```jsonc
{
  "schemaVersion": 2,
  "lastTestId": "heli-conversion",
  "tests": {
    "heli-conversion": { "stats": {...}, "cards": {...} },
    "c172-open":        { "stats": {...}, "cards": {...} },
    "c172-closed":      { "stats": {...}, "cards": {...} }
  }
}
```

Pre-v2 values (`{stats, cards}` only) auto-migrate on first read into the `heli-conversion` bucket. "אפס סטטיסטיקה למבחן הנוכחי" on the stats screen wipes the current test only; to wipe everything, run `localStorage.removeItem('cpl_quiz_v1')` in DevTools.

## Project layout

```
cpl_quiz/
├── index.html                  # Entry point
├── manifest.json               # PWA manifest
├── css/style.css               # Styles (light + dark via prefers-color-scheme)
├── js/
│   ├── app.js                  # Top-level controller (screens, wiring, test picker)
│   ├── modes.js                # Practice / exam / SRS runners
│   └── store.js                # localStorage stats + Leitner cards (per-test)
├── data/
│   ├── tests.js                # ← Test registry (hand-edit to add a test)
│   ├── heli-conversion.json    # ← Canonical bank
│   ├── heli-conversion.js      # ← Auto-generated wrapper (do NOT edit)
│   ├── c172-open.json
│   ├── c172-open.js
│   ├── c172-closed.json
│   └── c172-closed.js
├── img/                        # Diagrams referenced by question.image
│                               #   Namespaced: img/<test-id>-q<NNN>.png
├── tools/                      # Transcription helpers (not shipped to user)
│   ├── render_pages.py         # PDF → high-DPI PNG per page
│   ├── split_blocks.py         # Detect question blocks on a page
│   ├── crop_diagram.py         # Crop a region of a page → img/<out_id>.png
│   ├── peek_top.py             # Pull a vertical slice of a page (debug aid)
│   └── json_to_js.py           # Regenerate data/<test-id>.js from each <test-id>.json
└── README.md                   # This file
```

Working scratch under `tools/_pages/`, `tools/_blocks/`, plus `_pdf_*.pdf` next to the repo root are kept locally (ignored by git) so the next session can keep transcribing without re-rendering originals.

## Question schema

```jsonc
{
  "id": "q042",                            // sequential, gap-free, zero-padded
  "topic": "אווירודינמיקה",                // see per-bank topic taxonomies
  "source": "19-35.pdf p8",                // source PDF + page (for spot-checks)
  "stem": "Hebrew question text…",
  "image": "img/heli-conversion-q042.png", // or null
  "options": [
    { "text": "...", "correct": false },
    { "text": "...", "correct": true },
    // 3–5 options; exactly one has correct=true
  ]
}
```

Each bank has its own topic taxonomy — don't try to unify them. Image filenames are namespaced per test (`img/<test-id>-q<NNN>.png`) so banks can each have their own e.g. `q034` without collisions.

## Source PDFs

Originals live one directory up at `../יטכ כנף קבועה/`. The local working copies (`_pdf_*.pdf` next to this README) feed the renderer:

| Local copy | Prefix | Notes |
|---|---|---|
| `_pdf_19-35.pdf` | `a` | heli-conversion q001–q106 |
| `_pdf_36-57.pdf` | `b` | heli-conversion q107–q210 |
| `_pdf_huka.pdf`  | `c` | חוקה (regulations) bulk |
| `_pdf_c172_open.pdf` | `d` | c172-open all 37 questions |

PDFs are scanned-image Moodle review screenshots: the correct answer is highlighted green with ✓, the user's previous wrong pick has a heavy red ✗, other wrong options have a light orange ✗. The c172-open PDF differs slightly — it's a phone screenshot capture with one question per page.

## Workflow for adding more questions

All commands assume CWD = `cpl_quiz/`.

### 1. Render the page(s) at 300 DPI

```bash
python tools/render_pages.py 5 6 7      # PDF1 pages 5–7
python tools/render_pages.py            # render every page of every PDF
```

The script copies originals to local `_pdf_*.pdf` first if needed (Hebrew folder names break bash on Windows). Pages land in `tools/_pages/<prefix>_pNN.png`.

### 2. Split a page into question blocks

```bash
python tools/split_blocks.py a 5      # → tools/_blocks/a_p05_q01.png, …
```

Detection is gap-based (white horizontal gaps separate blocks). It's good but not perfect — orange "explanation" boxes inside Moodle review pages sometimes get glued onto the question above. When in doubt, eyeball `tools/_pages/<prefix>_pNN.png`. **Skip this step** for PDFs that have one question per page (e.g. c172-open).

### 3. Read each block and transcribe

Use the `Read` tool on each `tools/_blocks/<prefix>_pNN_qMM.png` (or `tools/_pages/<prefix>_pNN.png` for single-question-per-page formats).

The standard Moodle review pattern:
- The Hebrew question stem sits in the colored header at the top of the block.
- Options follow, each with ✓ (green = correct), ✗ (red heavy = user's wrong pick), or ✗ (orange light = simply wrong).
- Block border colour: green = answered correctly, red = wrong, orange = no answer / ambiguous.

If a block looks too small to read, use `python tools/peek_top.py <prefix> <page> 0.45 0.70` to extract a wider slice of the page (`<prefix> <page> <top%> <bottom%>` of page height) → `tools/_peek.png`.

### 4. Append to the relevant test's JSON file

- `data/heli-conversion.json` — "מבחן הסבה משולב למסוקאים"
- `data/c172-open.json` — "צסנה 172 - ספר פתוח"
- `data/c172-closed.json` — "צסנה 172 - ספר סגור"

The JSON shape is either a bare list of questions (legacy) or `{"questions": [...]}` — the generator accepts both.

Maintain the next sequential id (`q211`, `q212`, …) per file. Match the schema above. Tag topics consistently with the rest of that file.

**To add a new test entirely**: (1) add an entry to `data/tests.js`, (2) create `data/<id>.json`, (3) add the id to `TEST_IDS` in `tools/json_to_js.py`, (4) add `<script src="data/<id>.js"></script>` to `index.html`.

**Skip duplicates.** Many questions repeat across pages with options reordered — search the existing JSON for the stem before adding.

### 5. Crop diagrams (only if the question has a chart / "התמונה המצורפת")

```bash
python tools/crop_diagram.py b 6 0.18 0.36 0.85 0.66 heli-conversion-q220
# args: <prefix> <page> <left%> <top%> <right%> <bottom%> <output_id>
# → img/heli-conversion-q220.png
```

Image filenames are namespaced per test: `img/<test-id>-q<NNN>.png`. Pass the full prefixed id as `<output_id>` so `crop_diagram.py` writes to the right path. Set `"image": "img/<test-id>-q<NNN>.png"` on the question. Shared diagrams within the same bank can either be saved twice or referenced from one canonical file — both work.

### 6. Regenerate the test's `data/<id>.js`

```bash
python tools/json_to_js.py heli-conversion   # one test
python tools/json_to_js.py                    # all tests in TEST_IDS
```

This wraps the JSON in `window.TEST_BANKS[id] = ...;` so the app loads without `fetch()` (needed for `file://` to work). **Always run this after editing a `data/<id>.json`.**

### 7. Smoke test

Open `index.html` in a browser, switch to the relevant test, and run a few practice questions including the new ones. Confirm any cropped images render.

## Conventions worth keeping

- **Hebrew RTL throughout.** `<html dir="rtl">` plus the question card uses `text-align: start` so it flips correctly.
- **No build step.** Plain HTML/CSS/JS so the user can open the file directly. Don't introduce React/Vite/etc.
- **`data/<test-id>.js` files are generated, never edited by hand.** Always edit the matching `data/<test-id>.json` then run `python tools/json_to_js.py <test-id>`.
- **Don't reorder existing question ids.** Stats and Leitner boxes are keyed by `id` in localStorage — renaming `q042` to something else loses that user's history.
- **Image filenames are per-test** (`img/<test-id>-q<NNN>.png`) so banks can't collide on diagram numbers.
- **Diagrams**: 200–300 DPI is plenty; tighter crops (less green border bleed) look cleaner. PNG only — keep file sizes reasonable since the bank ships inline.
- **Topic tagging**: each bank has its own taxonomy; lean toward existing topics in that file. Only add a new topic when ≥4 questions genuinely don't fit any existing one.
