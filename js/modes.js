// Quiz mode runners.
//   practice — immediate feedback after each answer.
//   exam     — no feedback until the end; pass threshold 75%.
//   srs      — questions ordered by Leitner box (weakest first).
(function () {
  const LETTERS = ["א", "ב", "ג", "ד", "ה", "ו"];
  const EXAM_DEFAULT_SIZE = 30;
  const EXAM_PASS_PCT = 75;
  const SRS_DEFAULT_SIZE = 20;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Common runner skeleton — the modes differ only in how they react to submit.
  // `onSubmit(question, wasCorrect)` is the per-mode hook (record answer or
  // defer scoring), and `onDone(result)` fires once the queue empties.
  function makeRunner({ mode, queue, onSubmit, finalize }) {
    let idx = 0;
    let correct = 0;
    let pickedIdx = null;
    let submitted = false;
    const log = []; // { question, pickedIdx, wasCorrect }

    function current() { return queue[idx]; }
    function progress() { return { current: idx + 1, total: queue.length, correct }; }

    function selectOption(i) {
      if (submitted) return;
      pickedIdx = i;
    }

    function submit() {
      if (pickedIdx === null) return null;
      submitted = true;
      const q = current();
      const correctIdx = q.options.findIndex(o => o.correct);
      const wasCorrect = pickedIdx === correctIdx;
      if (wasCorrect) correct += 1;
      log.push({ question: q, pickedIdx, wasCorrect });
      onSubmit(q, wasCorrect);
      return { wasCorrect, correctIdx };
    }

    function next() {
      idx += 1;
      pickedIdx = null;
      submitted = false;
      if (idx >= queue.length) {
        return { done: true, result: finalize({ total: queue.length, correct, log }) };
      }
      return { done: false, question: current() };
    }

    return {
      mode,
      current, progress, selectOption, submit, next,
      get pickedIdx() { return pickedIdx; },
      get submitted() { return submitted; },
    };
  }

  function makePracticeRunner(questions) {
    return makeRunner({
      mode: "practice",
      queue: shuffle(questions),
      // Practice records answers as they happen — feedback is immediate.
      onSubmit: (q, wasCorrect) => Store.recordAnswer(q, wasCorrect),
      finalize: ({ total, correct, log }) => ({ mode: "practice", total, correct, log }),
    });
  }

  function makeExamRunner(questions, size = EXAM_DEFAULT_SIZE) {
    const pool = shuffle(questions);
    const queue = pool.slice(0, Math.min(size, pool.length));
    return makeRunner({
      mode: "exam",
      queue,
      // Defer recording so the exam feels like one batched assessment.
      onSubmit: (q, wasCorrect) => Store.recordAnswer(q, wasCorrect),
      finalize: ({ total, correct, log }) => {
        const pct = total === 0 ? 0 : Math.round(100 * correct / total);
        return {
          mode: "exam",
          total, correct, log,
          pct,
          passed: pct >= EXAM_PASS_PCT,
          passThreshold: EXAM_PASS_PCT,
        };
      },
    });
  }

  function makeSrsRunner(questions, size = SRS_DEFAULT_SIZE) {
    const ranked = Store.rankForSrs(questions);
    const queue = ranked.slice(0, Math.min(size, ranked.length));
    return makeRunner({
      mode: "srs",
      queue,
      onSubmit: (q, wasCorrect) => Store.recordAnswer(q, wasCorrect),
      finalize: ({ total, correct, log }) => ({ mode: "srs", total, correct, log }),
    });
  }

  window.Modes = {
    LETTERS,
    EXAM_PASS_PCT,
    EXAM_DEFAULT_SIZE,
    SRS_DEFAULT_SIZE,
    practice: makePracticeRunner,
    exam: makeExamRunner,
    srs: makeSrsRunner,
  };
})();
