/* ===== C# – Bài tập ôn luyện: trắc nghiệm + lập trình có chấm tự động ===== */
(function () {
  const P = window.PRACTICE;
  const L = P.lesson;
  const pad = n => String(n).padStart(2, "0");
  const KEY = "csbt" + pad(L);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(KEY + ":" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + ":" + k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(KEY + ":" + k); } catch (e) { } }
  };
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  const DEFAULT_STARTER = `using System;

class Program
{
    static void Main(string[] args)
    {
        // Viết code của bạn ở đây

    }
}`;

  /* ---------- page skeleton ---------- */
  const quizCount = P.quiz.length, probCount = P.problems.length;
  document.title = `Bài tập Buổi ${L} · ${P.title}`;
  const prevL = L > 1 ? `bai-tap-${pad(L - 1)}.html` : null;
  const nextL = L < 12 ? `bai-tap-${pad(L + 1)}.html` : null;
  document.body.innerHTML = `
  <header class="hero"><div class="wrap">
    <nav class="crumbs"><a href="index.html">☰ Mục lục khóa học</a><a href="buoi-${pad(L)}.html">▶ Slide Buổi ${L}</a>${prevL ? `<a href="${prevL}">← Bài tập Buổi ${L - 1}</a>` : ""}${nextL ? `<a href="${nextL}">Bài tập Buổi ${L + 1} →</a>` : ""}</nav>
    <div class="badge"><i></i>Bài tập ôn luyện · Buổi ${pad(L)}</div>
    <h1>${esc(P.title)} <em>· Luyện tập</em></h1>
    <p>${P.intro || "Phần 1 luyện đọc code và lần vết. Phần 2 viết chương trình ngay trên trang: bấm <b>Chạy thử</b> để chạy với dữ liệu tự nhập, bấm <b>Chấm bài</b> để chạy toàn bộ test case."}</p>
    <div class="stats"><span>📝 Trắc nghiệm: <b id="st-quiz">0/${quizCount}</b></span><span>💻 Lập trình: <b id="st-prob">0/${probCount}</b> bài đạt</span></div>
  </div></header>
  <div class="tabs"><div class="wrap"><div class="bar">
    <button data-tab="quiz" class="on">① Trắc nghiệm · trace code <span class="n">(${quizCount})</span></button>
    <button data-tab="code">② Lập trình · chấm tự động <span class="n">(${probCount})</span></button>
  </div></div></div>
  <main class="wrap">
    <section class="pane on" id="pane-quiz"></section>
    <section class="pane" id="pane-code"></section>
    <div class="nav-foot">${prevL ? `<a href="${prevL}">← Bài tập Buổi ${L - 1}</a>` : "<span></span>"}<a href="buoi-${pad(L)}.html">Xem lại slide Buổi ${L}</a>${nextL ? `<a href="${nextL}">Bài tập Buổi ${L + 1} →</a>` : "<span></span>"}</div>
  </main>
  <footer>Cơ sở lập trình C# · Bài tập ôn luyện · Code chạy ngay trong trình duyệt của bạn (trình biên dịch Roslyn trên WebAssembly)</footer>
  <div class="rstatus" id="rstatus"><i></i><span>Đang tải trình biên dịch C#…</span></div>`;

  const tabs = document.querySelectorAll(".tabs button");
  function showTab(name) {
    tabs.forEach(b => b.classList.toggle("on", b.dataset.tab === name));
    $("#pane-quiz").classList.toggle("on", name === "quiz");
    $("#pane-code").classList.toggle("on", name === "code");
    if (name === "code") setTimeout(() => editors.forEach(e => e.refresh()), 0);
    try { history.replaceState(null, "", "#" + name); } catch (e) { }
  }
  tabs.forEach(b => b.addEventListener("click", () => { showTab(b.dataset.tab); window.scrollTo({ top: $(".tabs").offsetTop - 4 }); }));

  /* ---------- runner status ---------- */
  const rs = $("#rstatus");
  CsRunner.onState((s) => {
    const t = rs.querySelector("span");
    if (s === "ready") { rs.className = "rstatus ready"; t.textContent = "Trình biên dịch C# sẵn sàng"; setTimeout(() => { rs.style.transition = "opacity .6s"; rs.style.opacity = "0"; rs.style.pointerEvents = "none"; }, 3000); }
    else if (s === "slow") { t.textContent = "Đang tải trình biên dịch C# (~10 MB, chỉ lần đầu)…"; }
    else if (s === "fail") { rs.className = "rstatus fail"; t.textContent = "Không tải được trình biên dịch. Hãy tải lại trang."; }
  });

  /* ============ QUIZ ============ */
  const answers = store.get("quiz", {});
  const qp = $("#pane-quiz");
  qp.appendChild(el("div", "intro", "<b>Cách làm:</b> đọc kỹ đoạn code, tự <b>lần vết trên giấy</b> rồi mới chọn đáp án. Mỗi câu chỉ được chọn một lần, sau khi chọn sẽ hiện giải thích."));
  P.quiz.forEach((q, i) => {
    const card = el("div", "q");
    const code = q.code ? `<pre><code class="language-csharp">${esc(dedent(q.code))}</code></pre>` : "";
    card.innerHTML = `<div class="q-h"><span class="no">Câu ${i + 1}</span><div class="txt">${q.q}</div></div>${code}<div class="opts"></div><div class="why">${q.why || ""}</div>`;
    const box = card.querySelector(".opts");
    q.opts.forEach((o, j) => {
      const b = el("button", "opt" + (q.mono ? " mono" : ""), `<span class="k">${"ABCD"[j]}</span><span class="v">${esc(o)}</span>`);
      b.type = "button";
      b.addEventListener("click", () => { answers[i] = j; store.set("quiz", answers); paint(); updateStats(); });
      box.appendChild(b);
    });
    function paint() {
      const a = answers[i];
      if (a === undefined) return;
      card.classList.add("done");
      card.classList.toggle("bad", a !== q.ans);
      box.querySelectorAll(".opt").forEach((b, j) => {
        b.disabled = true;
        if (j === q.ans) b.classList.add("right");
        else if (j === a) b.classList.add("wrong");
      });
    }
    paint();
    qp.appendChild(card);
  });
  const qfoot = el("div", "quiz-foot", `<div class="score">Điểm trắc nghiệm: <b id="qscore">0</b> / ${quizCount}</div><div><button class="btn grade" id="qreset" type="button">↺ Làm lại phần trắc nghiệm</button> <button class="btn grade" id="qgo" type="button" style="background:var(--accent)">Sang phần lập trình →</button></div>`);
  qp.appendChild(qfoot);
  $("#qreset").addEventListener("click", () => { if (confirm("Xóa các câu đã chọn và làm lại?")) { store.del("quiz"); location.reload(); } });
  $("#qgo").addEventListener("click", () => { showTab("code"); window.scrollTo({ top: $(".tabs").offsetTop - 4 }); });
  if (window.hljs) qp.querySelectorAll("pre code").forEach(c => hljs.highlightElement(c));

  /* ============ PROBLEMS ============ */
  const cp = $("#pane-code");
  const solved = store.get("solved", {});
  const editors = [];
  cp.appendChild(el("div", "intro", `<b>Cách làm:</b> viết code trong khung bên trái → <b>▶ Chạy thử</b> (Ctrl/⌘ + Enter) để chạy với dữ liệu ở ô <i>Dữ liệu vào</i> → <b>✓ Chấm bài</b> để chạy toàn bộ test. ${P.codeNote || "Chỉ in đúng kết quả theo định dạng của đề; nếu có in câu nhắc nhập liệu bằng <code>Console.Write</code>, trình chấm sẽ tự bỏ qua phần nhắc đó."} Code được tự lưu trên trình duyệt của bạn.`));
  const toc = el("div", "toc");
  cp.appendChild(toc);

  P.problems.forEach((pb, idx) => {
    const id = pb.id || ("p" + (idx + 1));
    const card = el("div", "prob");
    card.id = "bai-" + (idx + 1);
    const lvlName = ["", "Cơ bản", "Trung bình", "Nâng cao"][pb.level || 1];
    const samples = (pb.samples || []).map((s, k) => `
      <div class="sample"><div class="t">Ví dụ ${k + 1}</div><div class="io">
        <div><div class="lab">Dữ liệu vào</div><pre>${esc(s.in || "(không có)")}</pre></div>
        <div><div class="lab">Kết quả mong đợi</div><pre>${esc(s.out)}</pre></div>
      </div></div>`).join("");
    card.innerHTML = `
      <div class="prob-h"><span class="no">Bài ${idx + 1}</span><h3>${pb.title}</h3><span class="lvl l${pb.level || 1}">${lvlName}</span><span class="solved">✔ Đã đạt</span></div>
      <div class="prob-desc">${pb.desc}</div>
      ${samples ? `<div class="samples">${samples}</div>` : ""}
      <div class="hintbox"></div>
      <div class="work">
        <div class="ed">
          <div class="tool">
            <button class="btn run" type="button">▶ Chạy thử</button>
            <button class="btn grade" type="button">✓ Chấm bài</button>
            <span class="spacer"></span>
            ${pb.hint ? '<button class="btn ghost b-hint" type="button">💡 Gợi ý</button>' : ""}
            <button class="btn ghost b-sol" type="button">🔑 Lời giải</button>
            <button class="btn ghost b-reset" type="button">↺ Code ban đầu</button>
          </div>
          <textarea class="src"></textarea>
        </div>
        <div class="side">
          <div class="lab"><span>Dữ liệu vào (stdin)</span><span>mỗi giá trị một dòng</span></div>
          <textarea class="stdin" spellcheck="false"></textarea>
          <div class="lab"><span>Màn hình Console</span></div>
          <div class="console"><span class="dim">Bấm ▶ Chạy thử để chạy chương trình.</span></div>
        </div>
      </div>
      <div class="results"></div>`;
    cp.appendChild(card);

    const tocA = el("a", "", `Bài ${idx + 1}`);
    tocA.href = "#bai-" + (idx + 1);
    toc.appendChild(tocA);

    const starter = dedent(pb.starter || DEFAULT_STARTER);
    const saved = store.get("code:" + id, null);
    const cm = CodeMirror.fromTextArea(card.querySelector("textarea.src"), {
      mode: "text/x-csharp", theme: "csx", lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false,
      matchBrackets: true, autoCloseBrackets: true, viewportMargin: 20,
      extraKeys: {
        "Ctrl-Enter": () => doRun(), "Cmd-Enter": () => doRun(),
        "Shift-Ctrl-Enter": () => doGrade(), "Shift-Cmd-Enter": () => doGrade(),
        Tab: (c) => c.somethingSelected() ? c.indentSelection("add") : c.replaceSelection("    ", "end")
      }
    });
    cm.setValue(saved !== null ? saved : starter);
    cm.on("change", () => { store.set("code:" + id, cm.getValue()); clearMarks(); });
    editors.push(cm);

    const stdin = card.querySelector("textarea.stdin");
    stdin.value = (pb.samples && pb.samples[0] && pb.samples[0].in) || "";
    const con = card.querySelector(".console");
    const res = card.querySelector(".results");
    const bRun = card.querySelector(".btn.run"), bGrade = card.querySelector(".btn.grade");
    let marks = [];
    function clearMarks() { marks.forEach(l => cm.removeLineClass(l, "background", "cm-err-line")); marks = []; }
    function setSolved(v) {
      card.classList.toggle("is-solved", v);
      tocA.classList.toggle("done", v);
      if (v) { solved[id] = true; store.set("solved", solved); updateStats(); }
    }
    setSolved(!!solved[id]);

    card.querySelector(".b-reset").addEventListener("click", () => { if (confirm("Thay code hiện tại bằng code ban đầu?")) cm.setValue(starter); });
    const hb = card.querySelector(".hintbox");
    if (pb.hint) card.querySelector(".b-hint").addEventListener("click", () => { hb.innerHTML = "💡 " + pb.hint; hb.classList.toggle("on"); });
    card.querySelector(".b-sol").addEventListener("click", () => {
      if (!confirm("Bạn đã thử tự làm chưa? Xem lời giải sẽ thay code hiện tại trong khung soạn thảo (code cũ được chép vào clipboard nếu trình duyệt cho phép).")) return;
      try { navigator.clipboard && navigator.clipboard.writeText(cm.getValue()); } catch (e) { }
      cm.setValue(dedent(pb.solution));
    });

    function busy(on, label) {
      bRun.disabled = bGrade.disabled = on;
      if (on) con.innerHTML = `<span class="dim">${label}${CsRunner.ready ? "" : "\n(lần đầu cần tải trình biên dịch ~10 MB, vui lòng đợi…)"}</span>`;
    }

    function showCompileErrors(errors) {
      clearMarks();
      con.innerHTML = `<span class="bad">✘ Lỗi biên dịch (${errors.length})</span>\n` + errors.map(e => {
        const vn = translateCompile(e);
        const line = e.line - 1;
        if (line >= 0 && line < cm.lineCount()) { cm.addLineClass(line, "background", "cm-err-line"); marks.push(line); }
        return `<span class="err-line" data-line="${e.line}" data-col="${e.col}">Dòng ${e.line}, cột ${e.col}: ${esc(e.id)}</span> ${esc(e.message)}${vn ? `\n  <span class="vn">→ ${esc(vn)}</span>` : ""}`;
      }).join("\n");
      con.querySelectorAll(".err-line").forEach(s => s.addEventListener("click", () => { cm.focus(); cm.setCursor({ line: +s.dataset.line - 1, ch: +s.dataset.col - 1 }); }));
    }

    async function doRun() {
      busy(true, "Đang biên dịch và chạy…");
      res.classList.remove("on");
      try {
        const r = await CsRunner.run(cm.getValue(), [stdin.value]);
        if (r.fatal) { con.innerHTML = `<span class="bad">Lỗi hệ thống: ${esc(r.fatal)}</span>`; return; }
        if (r.errors.length) { showCompileErrors(r.errors); return; }
        clearMarks();
        const run = r.runs[0];
        con.innerHTML = (run.stdout ? esc(run.stdout) : `<span class="dim">(chương trình không in gì)</span>\n`) + "\n" + statusLine(run);
      } catch (e) {
        con.innerHTML = `<span class="bad">Không chạy được: ${esc(e.message || e)}. Hãy tải lại trang.</span>`;
      } finally { busy(false); }
    }

    let expectedCache = null;
    async function expectedOutputs() {
      const tests = (pb.samples || []).map(s => ({ in: s.in || "", out: s.out, sample: true }))
        .concat((pb.tests || []).map(t => typeof t === "string" ? { in: t } : t));
      const need = tests.filter(t => t.out === undefined);
      if (need.length && !expectedCache) {
        const r = await CsRunner.run(dedent(pb.solution), need.map(t => t.in));
        if (r.errors.length) throw new Error("Lời giải mẫu lỗi biên dịch: " + r.errors[0].message);
        expectedCache = r.runs.map(x => x.stdout);
      }
      let k = 0;
      return tests.map(t => t.out === undefined ? Object.assign({}, t, { out: expectedCache[k++] }) : t);
    }

    async function doGrade() {
      busy(true, "Đang chấm bài…");
      try {
        const tests = await expectedOutputs();
        const r = await CsRunner.run(cm.getValue(), tests.map(t => t.in));
        if (r.fatal) { con.innerHTML = `<span class="bad">Lỗi hệ thống: ${esc(r.fatal)}</span>`; return; }
        if (r.errors.length) { showCompileErrors(r.errors); res.classList.remove("on"); return; }
        clearMarks();
        const rows = tests.map((t, i) => {
          const run = r.runs[i];
          const cmp = run.status === "ok" ? compare(run.stdout, t.out) : null;
          return { t, run, pass: !!cmp, lenient: cmp === "lenient" };
        });
        const nPass = rows.filter(x => x.pass).length;
        const all = nPass === rows.length;
        con.innerHTML = all ? `<span class="ok">✔ Đạt ${nPass}/${rows.length} test. Xuất sắc!</span>` : `<span class="bad">✘ Đạt ${nPass}/${rows.length} test.</span> <span class="dim">Bấm vào từng test bên dưới để xem chi tiết.</span>`;
        renderResults(rows, nPass, all);
        if (all) setSolved(true);
      } catch (e) {
        con.innerHTML = `<span class="bad">Không chấm được: ${esc(e.message || e)}</span>`;
      } finally { busy(false); }
    }

    function renderResults(rows, nPass, all) {
      res.classList.add("on");
      res.innerHTML = `<div class="sum ${all ? "pass" : "fail"}"><span class="big">${all ? "🎉" : "🧪"}</span>${all ? `Chính xác! Vượt qua toàn bộ ${rows.length} test case.` : `Vượt qua ${nPass}/${rows.length} test case. Hãy xem test bị sai và sửa lại.`}</div>
        <div class="tc"></div><div class="detail"></div>`;
      const tc = res.querySelector(".tc"), det = res.querySelector(".detail");
      rows.forEach((x, i) => {
        const label = x.pass ? "Đúng" : statusName(x.run);
        const b = el("div", "tcase " + (x.pass ? "pass" : "fail"), `<b>Test ${i + 1}${x.t.sample ? " · ví dụ" : ""}</b><span>${x.pass ? "✔ " : "✘ "}${label}</span>`);
        b.addEventListener("click", () => select(i));
        tc.appendChild(b);
      });
      function select(i) {
        tc.querySelectorAll(".tcase").forEach((b, j) => b.classList.toggle("sel", i === j));
        const x = rows[i];
        const exp = norm(x.t.out), got = norm(x.run.stdout || "");
        const gotHtml = got.map((l, k) => (!x.pass && l !== exp[k]) ? `<span class="diff-bad">${esc(l) || " "}</span>` : esc(l)).join("\n");
        det.innerHTML = `<div><div class="lab">Dữ liệu vào</div><pre>${esc(x.t.in) || "(trống)"}</pre></div>
          <div><div class="lab">Kết quả mong đợi</div><pre>${esc(exp.join("\n"))}</pre></div>
          <div><div class="lab">Chương trình của bạn in ra</div><pre>${gotHtml || '<span style="color:#8a8fa8">(không in gì)</span>'}</pre></div>
          ${x.pass && x.lenient ? `<div class="note">✔ Đạt: phần câu nhắc nhập liệu được bỏ qua khi so sánh.</div>` : ""}
          ${!x.pass ? `<div class="note">${explain(x.run, exp, got)}</div>` : ""}`;
      }
      const firstBad = rows.findIndex(x => !x.pass);
      select(firstBad >= 0 ? firstBad : 0);
    }

    bRun.addEventListener("click", doRun);
    bGrade.addEventListener("click", doGrade);
  });

  /* ---------- helpers ---------- */
  function statusName(run) {
    return { ok: "Sai kết quả", re: "Lỗi khi chạy", tle: "Quá thời gian", ole: "In quá nhiều", ce: "Lỗi biên dịch" }[run.status] || run.status;
  }
  function statusLine(run) {
    if (run.status === "ok") return `<span class="ok">✔ Chương trình kết thúc bình thường.</span>`;
    if (run.status === "tle") return `<span class="warn">⏱ Quá thời gian: chương trình chạy quá lâu, có thể bị vòng lặp vô hạn.</span>`;
    if (run.status === "ole") return `<span class="warn">⚠ Chương trình in ra quá nhiều: có thể vòng lặp vô hạn, hoặc đọc hết dữ liệu vào mà vẫn tiếp tục chờ nhập.</span>`;
    return `<span class="bad">✘ Lỗi khi chạy: ${esc(friendlyRuntime(run))}</span>`;
  }
  function explain(run, exp, got) {
    if (run.status === "re") return "✘ Lỗi khi chạy: " + esc(friendlyRuntime(run));
    if (run.status === "tle") return "⏱ Chương trình chạy quá lâu, có thể có vòng lặp vô hạn (kiểm tra điều kiện dừng và lệnh cập nhật biến đếm).";
    if (run.status === "ole") return "⚠ In quá nhiều dữ liệu: có thể vòng lặp vô hạn hoặc chương trình vẫn chờ nhập khi đã hết dữ liệu.";
    if (got.length === 0) return "Chương trình không in ra gì. Bạn đã gọi Console.WriteLine để in kết quả chưa?";
    if (got.length !== exp.length) return `Số dòng in ra (${got.length}) khác số dòng mong đợi (${exp.length}). Kiểm tra lại số lần in và việc xuống dòng.`;
    const k = got.findIndex((l, i) => l !== exp[i]);
    if (k >= 0 && got[k].replace(/\s+/g, "") === exp[k].replace(/\s+/g, "")) return `Dòng ${k + 1} chỉ khác nhau ở <b>khoảng trắng</b>.`;
    if (k >= 0 && got[k].toLowerCase() === exp[k].toLowerCase()) return `Dòng ${k + 1} chỉ khác nhau ở <b>chữ hoa/chữ thường</b>.`;
    return `Dòng ${k + 1} khác kết quả mong đợi (phần tô đỏ). Kiểm tra lại công thức, định dạng số (ví dụ <code>{x:F2}</code>) và chính tả.`;
  }
  function friendlyRuntime(run) {
    const t = (run.errorType || "").replace(/^System\./, "");
    const m = {
      "FormatException": "FormatException: chuỗi không chuyển được sang số (kiểm tra int.Parse/double.Parse và dữ liệu nhập).",
      "ArgumentNullException": "ArgumentNullException: thường do Console.ReadLine() trả về null vì chương trình đọc nhiều dòng hơn số dòng dữ liệu vào.",
      "IndexOutOfRangeException": "IndexOutOfRangeException: truy cập phần tử ngoài phạm vi mảng/chuỗi (chỉ số phải từ 0 đến Length − 1).",
      "ArgumentOutOfRangeException": "ArgumentOutOfRangeException: chỉ số hoặc độ dài vượt phạm vi (thường gặp ở Substring, Remove, Insert).",
      "DivideByZeroException": "DivideByZeroException: chia số nguyên cho 0.",
      "NullReferenceException": "NullReferenceException: dùng một biến đang có giá trị null (chưa khởi tạo).",
      "OverflowException": "OverflowException: giá trị vượt quá giới hạn của kiểu dữ liệu.",
      "InvalidCastException": "InvalidCastException: ép kiểu không hợp lệ.",
      "StackOverflowException": "Đệ quy quá sâu: hàm đệ quy có thể thiếu điều kiện dừng.",
      "IO.FileNotFoundException": "FileNotFoundException: không tìm thấy tệp tin.",
      "InvalidOperationException": "InvalidOperationException: thao tác không hợp lệ ở trạng thái hiện tại."
    }[t];
    return m || (t || "Exception") + (run.error ? ": " + run.error : "");
  }
  function translateCompile(e) {
    const m = e.message;
    const map = {
      CS1002: "Thiếu dấu chấm phẩy ;",
      CS1513: "Thiếu dấu đóng ngoặc nhọn }",
      CS1514: "Thiếu dấu mở ngoặc nhọn {",
      CS1026: "Thiếu dấu đóng ngoặc tròn )",
      CS1003: "Sai cú pháp: thiếu một ký tự bắt buộc",
      CS1010: "Chuỗi chưa được đóng bằng dấu nháy kép \"",
      CS1012: "Ký tự (char) dùng nháy đơn và chỉ chứa đúng 1 ký tự",
      CS0103: "Tên này chưa được khai báo (gõ sai tên, sai hoa/thường, hoặc biến khai báo ở phạm vi khác)",
      CS0029: "Không thể gán giá trị kiểu này cho biến kiểu kia (cần Parse/Convert hoặc ép kiểu)",
      CS0266: "Cần ép kiểu tường minh, ví dụ (int)x, vì có thể mất dữ liệu",
      CS0165: "Dùng biến chưa được gán giá trị (hãy khởi tạo, ví dụ int tong = 0;)",
      CS0161: "Không phải mọi nhánh của hàm đều có return",
      CS0019: "Toán tử không dùng được với các kiểu dữ liệu này",
      CS0117: "Kiểu/lớp này không có thành viên với tên đó",
      CS1061: "Không có phương thức/thuộc tính với tên đó (kiểm tra chính tả, hoa/thường)",
      CS0128: "Biến đã được khai báo trước đó trong cùng phạm vi",
      CS0136: "Trùng tên biến với một biến ở phạm vi bao ngoài",
      CS0120: "Gọi hàm không static từ Main: hãy thêm từ khóa static cho hàm",
      CS1501: "Gọi hàm sai số lượng đối số",
      CS1503: "Đối số truyền vào sai kiểu",
      CS0127: "Hàm void không được return giá trị",
      CS0126: "Hàm có kiểu trả về thì return phải kèm giá trị",
      CS0163: "Thiếu break ở cuối một case trong switch",
      CS0152: "Hai case trong switch trùng giá trị",
      CS0131: "Vế trái của phép gán phải là biến",
      CS0201: "Câu lệnh không hợp lệ (chỉ là một biểu thức, không làm gì)",
      CS0200: "Thuộc tính này chỉ đọc, không gán được",
      CS0841: "Dùng biến trước khi khai báo",
      CS0219: "Biến được gán nhưng không dùng",
      CS0642: "Có thể bạn đặt nhầm dấu ; ngay sau if/for/while",
      CS0206: "Không thể truyền thuộc tính bằng ref/out",
      CS1620: "Thiếu từ khóa ref/out khi gọi hàm",
      CS0177: "Tham số out phải được gán giá trị trước khi hàm kết thúc",
      CS0428: "Thiếu dấu () khi gọi phương thức",
      CS1955: "Không thể gọi thuộc tính như phương thức (bỏ dấu ())",
      CS0021: "Không dùng được [ ] với kiểu này",
      CS0022: "Sai số chỉ số khi truy cập mảng (mảng 2 chiều dùng a[i, j])",
      CS0246: "Không tìm thấy kiểu dữ liệu này (thiếu using hoặc gõ sai tên)",
      CS5001: "Chương trình chưa có hàm Main (hoặc Main viết sai)"
    };
    return map[e.id] || (/does not exist in the current context/.test(m) ? map.CS0103 : "");
  }
  function updateStats() {
    const nq = P.quiz.filter((q, i) => answers[i] === q.ans).length;
    const done = Object.keys(answers).length;
    $("#st-quiz").textContent = `${nq}/${quizCount}` + (done < quizCount ? ` (đã làm ${done})` : "");
    const qs = $("#qscore"); if (qs) qs.textContent = nq;
    const ns = P.problems.filter((pb, i) => solved[pb.id || ("p" + (i + 1))]).length;
    $("#st-prob").textContent = `${ns}/${probCount}`;
    store.set("summary", { quiz: nq, quizTotal: quizCount, solved: ns, probTotal: probCount });
  }

  function dedent(text) {
    const lines = String(text).replace(/\t/g, "    ").split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const ind = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(ind)).join("\n");
  }
  function norm(s) {
    const a = String(s || "").replace(/\r/g, "").split("\n").map(l => l.replace(/\s+$/, ""));
    while (a.length && a[a.length - 1] === "") a.pop();
    while (a.length && a[0] === "") a.shift();
    return a;
  }
  function compare(got, exp) {
    const g = norm(got), e = norm(exp);
    if (g.length === e.length && g.every((l, i) => l === e[i])) return "exact";
    // tolerate input prompts: the last lines must equal the expected lines, optionally preceded by prompt text
    const gn = g.filter(l => l.trim() !== ""), en = e.filter(l => l.trim() !== "");
    if (gn.length < en.length || en.length === 0) return null;
    const tail = gn.slice(gn.length - en.length);
    const ok = tail.every((l, i) => {
      const want = en[i].trim(), have = l.trim();
      if (have === want) return true;
      if (!have.endsWith(want)) return false;
      const prefix = have.slice(0, have.length - want.length);
      return /[:?=>]\s*$/.test(prefix);
    });
    return ok ? "lenient" : null;
  }
  window.__practiceCompare = compare;

  updateStats();
  if (location.hash === "#code") showTab("code");
  // start loading the compiler in the background a moment after the page is shown
  setTimeout(() => CsRunner.start(), 300);
})();
