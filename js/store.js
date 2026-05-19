// localStorage-backed persistence. Tracks aggregate stats and per-question
// Leitner-box state for the SRS mode. State is bucketed per test so multiple
// question banks can coexist without their progress bleeding into each other.
//
// Storage layout (under key NS):
//   {
//     schemaVersion: 2,
//     lastTestId: "<id>",
//     tests: {
//       "<id>": {
//         stats: { seen, correct, perTopic: { "<topic>": { seen, correct } } },
//         cards: { "<qid>": { box, attempts, correct, lastSeen } }
//       },
//       ...
//     }
//   }
//
// A pre-v2 value (no schemaVersion field, just { stats, cards }) is auto-migrated
// the first time it's read: existing progress lands in DEFAULT_TEST_ID.
(function () {
  const NS = "cpl_quiz_v1";
  const MAX_BOX = 5;
  const SCHEMA_VERSION = 2;
  const DEFAULT_TEST_ID = "heli-conversion";

  // The "active test" lives only in memory. app.js calls setActiveTest() on
  // boot and on every test switch; all read/write methods below scope to it.
  let activeTestId = DEFAULT_TEST_ID;

  function emptyTestBucket() {
    return {
      stats: { seen: 0, correct: 0, perTopic: {} },
      cards: {},
    };
  }

  function emptyV2() {
    return {
      schemaVersion: SCHEMA_VERSION,
      lastTestId: DEFAULT_TEST_ID,
      tests: {},
    };
  }

  function migrateV1ToV2(v1) {
    return {
      schemaVersion: SCHEMA_VERSION,
      lastTestId: DEFAULT_TEST_ID,
      tests: {
        [DEFAULT_TEST_ID]: {
          stats: (v1 && v1.stats) || { seen: 0, correct: 0, perTopic: {} },
          cards: (v1 && v1.cards) || {},
        },
      },
    };
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object") return emptyV2();
    if (raw.schemaVersion === SCHEMA_VERSION && raw.tests && typeof raw.tests === "object") {
      // Ensure lastTestId is at least a string; tests sub-map may be empty.
      if (!raw.lastTestId) raw.lastTestId = DEFAULT_TEST_ID;
      return raw;
    }
    // Anything else (no schemaVersion, or unknown version) is treated as v1.
    return migrateV1ToV2(raw);
  }

  function load() {
    try {
      const raw = localStorage.getItem(NS);
      const parsed = raw ? JSON.parse(raw) : null;
      return normalize(parsed);
    } catch (e) {
      return emptyV2();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(NS, JSON.stringify(state));
    } catch (e) {
      // Quota or private mode — silently degrade.
    }
  }

  function ensureBucket(state, testId) {
    if (!state.tests[testId]) state.tests[testId] = emptyTestBucket();
    const b = state.tests[testId];
    b.stats = b.stats || { seen: 0, correct: 0, perTopic: {} };
    b.stats.perTopic = b.stats.perTopic || {};
    b.cards = b.cards || {};
    return b;
  }

  const Store = {
    MAX_BOX,
    setActiveTest(id) {
      if (typeof id === "string" && id.length > 0) activeTestId = id;
    },
    getActiveTest() {
      return activeTestId;
    },
    getLastTestId() {
      return load().lastTestId || null;
    },
    setLastTestId(id) {
      if (typeof id !== "string" || id.length === 0) return;
      const s = load();
      s.lastTestId = id;
      save(s);
    },
    getStats() {
      const s = load();
      const b = ensureBucket(s, activeTestId);
      return b.stats;
    },
    recordAnswer(question, wasCorrect) {
      const s = load();
      const b = ensureBucket(s, activeTestId);
      b.stats.seen += 1;
      if (wasCorrect) b.stats.correct += 1;
      const t = b.stats.perTopic[question.topic] || { seen: 0, correct: 0 };
      t.seen += 1;
      if (wasCorrect) t.correct += 1;
      b.stats.perTopic[question.topic] = t;

      // Leitner box update: correct = promote (cap at MAX_BOX), wrong = back to box 1.
      const c = b.cards[question.id] || { box: 1, attempts: 0, correct: 0, lastSeen: 0 };
      c.attempts += 1;
      c.lastSeen = Date.now();
      if (wasCorrect) {
        c.correct += 1;
        c.box = Math.min(MAX_BOX, c.box + 1);
      } else {
        c.box = 1;
      }
      b.cards[question.id] = c;

      save(s);
    },
    getCard(qid) {
      const s = load();
      const b = ensureBucket(s, activeTestId);
      return b.cards[qid] || null;
    },
    // Returns questions ordered for SRS review: lower box first, unseen at the
    // end of box-1 (treated as box 1). Within a box, the least-recently-seen
    // questions come first so we don't repeat the same handful.
    rankForSrs(bank) {
      const s = load();
      const b = ensureBucket(s, activeTestId);
      const cards = b.cards;
      const decorated = bank.map(q => {
        const c = cards[q.id];
        return {
          q,
          box: c ? c.box : 1,
          lastSeen: c ? c.lastSeen : 0,
          attempts: c ? c.attempts : 0,
        };
      });
      decorated.sort((a, b) => {
        if (a.box !== b.box) return a.box - b.box;
        // Older first, but unseen (lastSeen=0, attempts=0) gets a small boost
        // so a brand-new card doesn't always come before a card you missed yesterday.
        if (a.attempts === 0 && b.attempts > 0) return 1;
        if (b.attempts === 0 && a.attempts > 0) return -1;
        return a.lastSeen - b.lastSeen;
      });
      return decorated.map(d => d.q);
    },
    // For the stats screen: a histogram of how many cards sit in each box.
    boxHistogram(bank) {
      const s = load();
      const b = ensureBucket(s, activeTestId);
      const cards = b.cards;
      const hist = [0, 0, 0, 0, 0, 0]; // index 0 = unseen
      bank.forEach(q => {
        const c = cards[q.id];
        if (!c) hist[0] += 1;
        else hist[c.box] = (hist[c.box] || 0) + 1;
      });
      return hist;
    },
    // Resets only the active test's bucket — other tests' progress is preserved.
    reset() {
      const s = load();
      s.tests[activeTestId] = emptyTestBucket();
      save(s);
    },
    exportState() {
      return {
        version: NS,
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data: load(),
      };
    },
    importState(payload) {
      if (!payload || typeof payload !== "object") {
        throw new Error("קובץ לא תקין");
      }
      if (payload.version !== NS) {
        throw new Error("גרסת קובץ לא תואמת");
      }
      const data = payload.data;
      if (!data || typeof data !== "object") {
        throw new Error("מבנה נתונים לא תקין");
      }
      // Accept both legacy v1 exports ({stats, cards}) and v2 exports.
      // normalize() handles either case.
      save(normalize(data));
    },
  };

  window.Store = Store;
})();
