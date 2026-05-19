// Tests registry. Order here defines the order in the test-picker dropdown.
// The first entry is the default test — used as the migration target for any
// pre-v2 localStorage data, and as the fallback when no last-test pointer is set.
//
// To add a new test:
//   1. Add an entry to this array with a unique stable id.
//   2. Create data/<id>.json (either a bare questions list or {"questions": [...]}).
//   3. Run: python tools/json_to_js.py <id>
//   4. Add <script src="data/<id>.js"></script> to index.html.
//   5. Mirror the id in tools/json_to_js.py's TEST_IDS list.
window.TESTS = [
  { id: "heli-conversion", title: "מבחן הסבה משולב למסוקאים" },
  { id: "c172-open",       title: "צסנה 172 - ספר פתוח" },
  { id: "c172-closed",     title: "צסנה 172 - ספר סגור" },
];
