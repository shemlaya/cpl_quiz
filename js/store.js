// localStorage-backed persistence. Tracks aggregate stats and per-question
// Leitner-box state for the SRS mode. One namespace so future schema changes
// can rev cleanly.
(function () {
  const NS = "cpl_quiz_v1";
  const MAX_BOX = 5;

  function load() {
    try {
      const raw = localStorage.getItem(NS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function save(state) {
    try {
      localStorage.setItem(NS, JSON.stringify(state));
    } catch (e) {
      // Quota or private mode — silently degrade.
    }
  }

  function ensureCards(state) {
    state.cards = state.cards || {};
    return state.cards;
  }

  const Store = {
    MAX_BOX,
    getStats() {
      const s = load();
      return s.stats || { seen: 0, correct: 0, perTopic: {} };
    },
    recordAnswer(question, wasCorrect) {
      const s = load();
      s.stats = s.stats || { seen: 0, correct: 0, perTopic: {} };
      s.stats.seen += 1;
      if (wasCorrect) s.stats.correct += 1;
      const t = s.stats.perTopic[question.topic] || { seen: 0, correct: 0 };
      t.seen += 1;
      if (wasCorrect) t.correct += 1;
      s.stats.perTopic[question.topic] = t;

      // Leitner box update: correct = promote (cap at MAX_BOX), wrong = back to box 1.
      const cards = ensureCards(s);
      const c = cards[question.id] || { box: 1, attempts: 0, correct: 0, lastSeen: 0 };
      c.attempts += 1;
      c.lastSeen = Date.now();
      if (wasCorrect) {
        c.correct += 1;
        c.box = Math.min(MAX_BOX, c.box + 1);
      } else {
        c.box = 1;
      }
      cards[question.id] = c;

      save(s);
    },
    getCard(qid) {
      const s = load();
      const cards = s.cards || {};
      return cards[qid] || null;
    },
    // Returns questions ordered for SRS review: lower box first, unseen at the
    // end of box-1 (treated as box 1). Within a box, the least-recently-seen
    // questions come first so we don't repeat the same handful.
    rankForSrs(bank) {
      const s = load();
      const cards = s.cards || {};
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
      const cards = s.cards || {};
      const hist = [0, 0, 0, 0, 0, 0]; // index 0 = unseen
      bank.forEach(q => {
        const c = cards[q.id];
        if (!c) hist[0] += 1;
        else hist[c.box] = (hist[c.box] || 0) + 1;
      });
      return hist;
    },
    reset() {
      try { localStorage.removeItem(NS); } catch (e) {}
    },
  };

  window.Store = Store;
})();
