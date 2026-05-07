# Tools — Workflows

Scripts for maintaining the quiz data. The canonical question source is `data/questions.json`; the app loads `data/questions.js` (a `window.QUESTIONS = …` wrapper) so it works under `file://` without CORS.

## Regenerating `data/questions.js` after editing `data/questions.json`

After any edit to `data/questions.json`, regenerate the JS wrapper:

```bash
python tools/json_to_js.py
```

The script reads `data/questions.json` and writes `data/questions.js` with the `window.QUESTIONS = …;` wrapper. It prints the question count on success.

Then commit both files together:

```bash
git add data/questions.json data/questions.js
git commit -m "<your message>"
```

## `.gitignore` policy for `tools/`

The `tools/` folder is **tracked** (Python scripts are versioned), but generated PNG artifacts (block crops, page renders, zoom previews, etc.) are excluded at any depth via:

```
tools/**/*.png
```

If you add a new generated artifact type (e.g. `.jpg`, `.svg`), extend the pattern in `.gitignore` rather than re-ignoring the whole folder.
