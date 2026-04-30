// Top-level app controller. Loads the question bank from window.QUESTIONS,
// renders home / quiz / summary / stats screens, and wires up practice, exam
// and SRS modes through Modes/Store.
(function () {
  const $ = (sel) => document.querySelector(sel);
  const screens = {
    home: $("#screen-home"),
    quiz: $("#screen-quiz"),
    summary: $("#screen-summary"),
    stats: $("#screen-stats"),
  };
  const topbar = {
    back: $("#back-btn"),
    title: $("#title"),
    progress: $("#progress"),
  };

  let bank = [];
  let topics = [];
  let activeTopics = new Set();
  let runner = null;
  let currentMode = null;

  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el && (el.hidden = k !== name));
    topbar.back.hidden = name === "home";
    topbar.progress.hidden = name !== "quiz";
  }

  // --- Home -----------------------------------------------------------------
  function renderHome() {
    topbar.title.textContent = "תרגול CPL";
    show("home");
    renderTopicChips();
    $("#bank-meta").textContent =
      bank.length + " שאלות בבנק • " + topics.length + " נושאים";
  }

  function renderTopicChips() {
    const wrap = $("#topic-picker");
    wrap.innerHTML = "";
    if (topics.length <= 1) return;
    topics.forEach(t => {
      const btn = document.createElement("button");
      btn.className = "topic-chip" + (activeTopics.has(t) ? " active" : "");
      btn.textContent = t;
      btn.addEventListener("click", () => {
        if (activeTopics.has(t)) activeTopics.delete(t);
        else activeTopics.add(t);
        renderTopicChips();
      });
      wrap.appendChild(btn);
    });
  }

  function filteredQuestions() {
    if (activeTopics.size === 0) return bank;
    return bank.filter(q => activeTopics.has(q.topic));
  }

  // --- Quiz dispatch --------------------------------------------------------
  function startMode(mode) {
    const qs = filteredQuestions();
    if (qs.length === 0) {
      alert("אין שאלות תואמות לנושאים שנבחרו.");
      return;
    }
    currentMode = mode;
    if (mode === "practice") {
      runner = Modes.practice(qs);
      topbar.title.textContent = "תרגול חופשי";
    } else if (mode === "exam") {
      const size = Math.min(Modes.EXAM_DEFAULT_SIZE, qs.length);
      runner = Modes.exam(qs, size);
      topbar.title.textContent = "סימולציית מבחן (" + size + " שאלות)";
    } else if (mode === "srs") {
      const size = Math.min(Modes.SRS_DEFAULT_SIZE, qs.length);
      runner = Modes.srs(qs, size);
      topbar.title.textContent = "שאלות חלשות";
    }
    show("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const q = runner.current();
    const p = runner.progress();
    topbar.progress.textContent = p.current + "/" + p.total;

    const card = $("#question-card");
    card.innerHTML = "";

    if (q.image) {
      const img = document.createElement("img");
      img.className = "q-image";
      img.src = q.image;
      img.alt = "";
      card.appendChild(img);
    }

    const stem = document.createElement("p");
    stem.className = "stem";
    stem.textContent = q.stem;
    card.appendChild(stem);

    const list = document.createElement("ul");
    list.className = "options";
    q.options.forEach((opt, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "option";
      btn.dataset.idx = i;
      const marker = document.createElement("span");
      marker.className = "marker";
      marker.textContent = Modes.LETTERS[i] || (i + 1);
      const text = document.createElement("span");
      text.className = "text";
      text.textContent = opt.text;
      btn.appendChild(marker);
      btn.appendChild(text);
      btn.addEventListener("click", () => onOptionPick(i));
      li.appendChild(btn);
      list.appendChild(li);
    });
    card.appendChild(list);

    $("#submit-btn").disabled = true;
    $("#submit-btn").hidden = false;
    // Exam mode: submitting goes straight to the next question without
    // showing feedback, so the "next" button is repurposed as a no-op here.
    $("#next-btn").hidden = true;
    // The submit button label changes per mode for clarity.
    $("#submit-btn").textContent = currentMode === "exam" ? "ענה →" : "בדיקה";
  }

  function onOptionPick(i) {
    if (runner.submitted) return;
    runner.selectOption(i);
    document.querySelectorAll(".option").forEach((el, idx) => {
      el.classList.toggle("selected", idx === i);
    });
    $("#submit-btn").disabled = false;
  }

  function onSubmit() {
    if (runner.pickedIdx === null) return;
    const result = runner.submit();

    if (currentMode === "exam") {
      // No per-question feedback in exam mode — go straight to next.
      advance();
      return;
    }

    // Practice & SRS show immediate feedback.
    const opts = document.querySelectorAll(".option");
    opts.forEach((el, idx) => {
      el.disabled = true;
      el.classList.remove("selected");
      if (idx === result.correctIdx) el.classList.add("correct");
      else if (idx === runner.pickedIdx) el.classList.add("wrong");
    });

    const fb = document.createElement("div");
    fb.className = "feedback " + (result.wasCorrect ? "correct" : "wrong");
    fb.textContent = result.wasCorrect ? "תשובה נכונה ✓" : "טעות. התשובה הנכונה מודגשת בירוק.";
    $("#question-card").appendChild(fb);

    $("#submit-btn").hidden = true;
    $("#next-btn").hidden = false;
  }

  function onNext() { advance(); }

  function advance() {
    const r = runner.next();
    if (r.done) onQuizDone(r.result);
    else renderQuestion();
  }

  // --- Summary --------------------------------------------------------------
  function onQuizDone(result) {
    show("summary");
    topbar.title.textContent = "סיכום";
    topbar.progress.hidden = true;
    const card = $("#summary-card");
    const pct = Math.round(100 * result.correct / result.total);

    let html = "";
    if (result.mode === "exam") {
      const status = result.passed
        ? "<span class='pass'>עברת! ✓</span>"
        : "<span class='fail'>לא עברת ✗</span>";
      html += "<h2>סיום מבחן</h2>" +
        "<div class='summary-score'>" + result.correct + " / " + result.total + "</div>" +
        "<p>" + pct + "% — " + status + " (סף מעבר: " + result.passThreshold + "%)</p>";
    } else {
      const title = result.mode === "srs" ? "סבב חזרה" : "סיום סבב תרגול";
      html += "<h2>" + title + "</h2>" +
        "<div class='summary-score'>" + result.correct + " / " + result.total + "</div>" +
        "<p>" + pct + "% תשובות נכונות</p>";
    }

    const wrong = result.log.filter(e => !e.wasCorrect);
    if (wrong.length > 0) {
      html += "<h3>שאלות שגויות (" + wrong.length + ")</h3><ul class='wrong-list'>";
      wrong.forEach(e => {
        const correctText = e.question.options.find(o => o.correct).text;
        html += "<li>" +
          "<div class='wrong-stem'>" + escapeHtml(e.question.stem) + "</div>" +
          "<div class='wrong-correct'>תשובה נכונה: " + escapeHtml(correctText) + "</div>" +
          "</li>";
      });
      html += "</ul>";
    }

    html += "<div class='quiz-actions' style='justify-content:center;margin-top:16px'>" +
      "  <button class='primary' id='again-btn'>סבב נוסף</button>" +
      "  <button class='primary outline' id='home-btn'>חזרה לתפריט</button>" +
      "</div>";

    card.innerHTML = html;
    $("#again-btn").addEventListener("click", () => startMode(currentMode));
    $("#home-btn").addEventListener("click", goHome);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  // --- Stats screen ---------------------------------------------------------
  function renderStats() {
    show("stats");
    topbar.title.textContent = "סטטיסטיקה";
    topbar.progress.hidden = true;
    const stats = Store.getStats();
    const card = $("#stats-card");
    const pct = stats.seen === 0 ? 0 : Math.round(100 * stats.correct / stats.seen);

    let html = "<h2>התקדמות אישית</h2>";
    if (stats.seen === 0) {
      html += "<p class='lead'>עדיין לא ענית על שאלות. התחל סבב תרגול כדי לבנות סטטיסטיקה.</p>";
    } else {
      html += "<div class='summary-score'>" + stats.correct + " / " + stats.seen + "</div>" +
        "<p>" + pct + "% תשובות נכונות (כולל חזרות)</p>";

      const topicEntries = Object.entries(stats.perTopic)
        .sort((a, b) => b[1].seen - a[1].seen);
      if (topicEntries.length > 0) {
        html += "<h3>לפי נושא</h3><ul class='topic-stats'>";
        topicEntries.forEach(([t, s]) => {
          const tp = Math.round(100 * s.correct / s.seen);
          html += "<li><span class='topic-name'>" + escapeHtml(t) + "</span>" +
            "<span class='topic-bar'><span style='width:" + tp + "%'></span></span>" +
            "<span class='topic-pct'>" + tp + "% (" + s.correct + "/" + s.seen + ")</span></li>";
        });
        html += "</ul>";
      }

      const hist = Store.boxHistogram(bank);
      const total = hist.reduce((a, b) => a + b, 0);
      html += "<h3>קופסאות לייטנר (Leitner)</h3><ul class='box-list'>";
      const labels = ["לא נראה", "1 (חלש)", "2", "3", "4", "5 (שולט)"];
      hist.forEach((n, i) => {
        const w = total === 0 ? 0 : Math.round(100 * n / total);
        html += "<li><span class='box-label'>" + labels[i] + "</span>" +
          "<span class='topic-bar'><span style='width:" + w + "%'></span></span>" +
          "<span class='topic-pct'>" + n + "</span></li>";
      });
      html += "</ul>";
    }

    html += "<div class='quiz-actions' style='justify-content:center;flex-wrap:wrap;margin-top:16px'>" +
      "  <button class='primary outline' id='export-btn'>ייצוא סטטיסטיקה</button>" +
      "  <button class='primary outline' id='import-btn'>ייבוא סטטיסטיקה</button>" +
      "  <button class='primary outline' id='reset-btn'>אפס סטטיסטיקה</button>" +
      "  <button class='primary' id='stats-home-btn'>חזרה לתפריט</button>" +
      "</div>" +
      "<input type='file' id='import-file' accept='application/json,.json' hidden>";

    card.innerHTML = html;
    $("#reset-btn").addEventListener("click", () => {
      if (confirm("למחוק את כל היסטוריית התשובות וקופסאות לייטנר?")) {
        Store.reset();
        renderStats();
      }
    });
    $("#export-btn").addEventListener("click", onExportStats);
    $("#import-btn").addEventListener("click", () => $("#import-file").click());
    $("#import-file").addEventListener("change", onImportStatsFile);
    $("#stats-home-btn").addEventListener("click", goHome);
  }

  function onExportStats() {
    const payload = Store.exportState();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cpl-quiz-stats-" + todayStamp() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function onImportStatsFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-importing the same file later
    if (!file) return;
    if (!confirm("ייבוא יחליף את הסטטיסטיקה הנוכחית. להמשיך?")) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        Store.importState(parsed);
        alert("ייבוא הושלם.");
        renderStats();
      } catch (err) {
        alert("ייבוא נכשל: " + (err && err.message ? err.message : err));
      }
    };
    reader.onerror = () => alert("שגיאה בקריאת הקובץ.");
    reader.readAsText(file);
  }

  function todayStamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function goHome() { renderHome(); }

  // --- Boot -----------------------------------------------------------------
  function boot() {
    bank = Array.isArray(window.QUESTIONS) ? window.QUESTIONS : [];
    if (bank.length === 0) {
      $("#bank-meta").textContent = "שגיאה בטעינת השאלות.";
      return;
    }
    topics = Array.from(new Set(bank.map(q => q.topic)));

    document.querySelectorAll(".mode-card").forEach(btn => {
      if (btn.disabled) return;
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        if (mode === "stats") renderStats();
        else startMode(mode);
      });
    });
    topbar.back.addEventListener("click", goHome);
    $("#submit-btn").addEventListener("click", onSubmit);
    $("#next-btn").addEventListener("click", onNext);

    document.addEventListener("keydown", (e) => {
      if (screens.quiz.hidden) return;
      const n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && n <= 6) {
        const opts = document.querySelectorAll(".option");
        if (opts[n - 1] && !opts[n - 1].disabled) opts[n - 1].click();
      } else if (e.key === "Enter") {
        if (!$("#next-btn").hidden) $("#next-btn").click();
        else if (!$("#submit-btn").disabled) $("#submit-btn").click();
      }
    });

    renderHome();
  }

  boot();
})();
