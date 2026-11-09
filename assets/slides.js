/* ===== C# – Cơ sở lập trình | Slide engine ===== */
(function () {
  const body = document.body;
  const lessonNo = body.dataset.lesson || "";
  const lessonTitle = body.dataset.title || "";
  const slides = Array.from(document.querySelectorAll(".slide"));
  const total = slides.length;
  let cur = 0;
  let started = false;

  /* ---- helpers ---- */
  function dedent(text) {
    const lines = text.replace(/\t/g, "    ").split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const ind = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(ind)).join("\n");
  }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* ---- code blocks: <script type="text/x-csharp" data-file="..."> ---- */
  document.querySelectorAll('script[type="text/x-csharp"]').forEach(sc => {
    const src = dedent(sc.textContent);
    const wrap = document.createElement("div");
    wrap.className = "code" + (sc.dataset.size === "sm" ? " sm" : "");
    wrap.innerHTML =
      '<div class="bar"><i></i><i></i><i></i>' + esc(sc.dataset.file || "Program.cs") + "</div>" +
      '<button class="copy" type="button">Sao chép</button>' +
      '<pre><code class="language-csharp"></code></pre>';
    wrap.querySelector("code").textContent = src;
    wrap.querySelector(".copy").addEventListener("click", e => {
      e.stopPropagation();
      const b = e.currentTarget;
      const done = () => { b.textContent = "Đã chép ✓"; setTimeout(() => (b.textContent = "Sao chép"), 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(src).then(done, done); else done();
    });
    sc.replaceWith(wrap);
  });
  /* console output: <script type="text/x-out"> ; lines starting with "> " are user input */
  document.querySelectorAll('script[type="text/x-out"]').forEach(sc => {
    const div = document.createElement("div");
    div.className = "out";
    div.innerHTML = dedent(sc.textContent).split("\n").map(l => {
      const m = l.match(/^(.*?)\{\{(.*)\}\}(.*)$/);
      if (m) return esc(m[1]) + '<span class="in">' + esc(m[2]) + "</span>" + esc(m[3]);
      return esc(l);
    }).join("\n");
    sc.replaceWith(div);
  });
  if (window.hljs) document.querySelectorAll(".code code").forEach(el => window.hljs.highlightElement(el));

  /* ---- footers ---- */
  slides.forEach((s, i) => {
    const f = document.createElement("div");
    f.className = "s-foot";
    f.innerHTML = "<span><b>C# · Cơ sở lập trình</b> &nbsp;—&nbsp; " + esc(lessonNo) + (lessonTitle ? ": " + esc(lessonTitle) : "") +
      "</span><span>" + (i + 1) + " / " + total + "</span>";
    s.appendChild(f);
    const b = s.querySelector(".s-body");
    if (b) {
      const h = document.createElement("div");
      h.className = "more-hint"; h.textContent = "↓ Cuộn để xem thêm";
      s.appendChild(h);
      b.addEventListener("scroll", () => checkMore(s));
      s.querySelectorAll("details").forEach(d => d.addEventListener("toggle", () => checkMore(s)));
    }
    s.addEventListener("click", () => { if (body.classList.contains("overview")) { body.classList.remove("overview"); go(i); } });
  });

  function checkMore(s) {
    const b = s.querySelector(".s-body");
    if (!b) return;
    s.classList.toggle("has-more", b.scrollHeight - b.clientHeight - b.scrollTop > 8);
  }

  /* ---- chrome ---- */
  const prog = document.createElement("div"); prog.className = "progress"; body.appendChild(prog);
  const hud = document.createElement("div"); hud.className = "hud";
  hud.innerHTML =
    '<a href="index.html" title="Danh sách buổi học">☰ Mục lục</a>' +
    '<button class="nav-only" data-a="prev" title="Slide trước (←)">←</button>' +
    '<span class="count nav-only"></span>' +
    '<button class="nav-only" data-a="next" title="Slide sau (→)">→</button>' +
    '<button class="nav-only" data-a="ov" title="Xem tổng quan (O)">▦</button>' +
    '<button class="nav-only" data-a="fs" title="Toàn màn hình (F)">⛶</button>';
  body.appendChild(hud);
  const hint = document.createElement("div"); hint.className = "hint";
  hint.textContent = "← → chuyển slide · F toàn màn hình · O tổng quan";
  body.appendChild(hint);
  const count = hud.querySelector(".count");
  hud.addEventListener("click", e => {
    const a = e.target.closest("[data-a]"); if (!a) return;
    ({ prev: () => go(cur - 1), next: () => go(cur + 1), ov: toggleOverview, fs: toggleFS })[a.dataset.a]();
  });

  /* ---- layout ---- */
  function isDoc() { return window.innerWidth < 820 || (window.innerWidth < 1000 && window.innerHeight > window.innerWidth); }
  function layout() {
    body.classList.toggle("docmode", isDoc());
    if (body.classList.contains("docmode") || body.classList.contains("overview")) {
      slides.forEach(s => { s.style.transform = ""; s.style.removeProperty("--scale-t"); });
      return;
    }
    const sc = Math.min(window.innerWidth / 1280, window.innerHeight / 720) * 0.96;
    slides.forEach(s => { s.style.setProperty("--scale-t", "scale(" + sc + ")"); s.style.transform = "scale(" + sc + ")"; });
  }

  function go(n) {
    cur = Math.max(0, Math.min(total - 1, n));
    slides.forEach((s, i) => s.classList.toggle("active", i === cur));
    if (started) { const sl = slides[cur]; sl.classList.remove("enter"); void sl.offsetWidth; sl.classList.add("enter"); }
    count.textContent = (cur + 1) + " / " + total;
    prog.style.width = ((cur + 1) / total * 100) + "%";
    const b = slides[cur].querySelector(".s-body"); if (b) b.scrollTop = 0;
    checkMore(slides[cur]);
    setTimeout(() => checkMore(slides[cur]), 400);   // after fonts/highlight settle
    if (location.hash !== "#" + (cur + 1)) history.replaceState(null, "", "#" + (cur + 1));
  }
  function toggleOverview() {
    body.classList.toggle("overview"); layout();
    if (body.classList.contains("overview")) slides[cur].scrollIntoView({ block: "center" });
  }
  function toggleFS() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    else document.exitFullscreen && document.exitFullscreen();
  }

  document.addEventListener("keydown", e => {
    if (body.classList.contains("docmode")) return;
    if (e.target.closest && e.target.closest("input, textarea")) return;
    const k = e.key;
    if (["ArrowRight", "PageDown", " "].includes(k) && !(k === " " && e.target.tagName === "SUMMARY")) { e.preventDefault(); go(cur + 1); }
    else if (["ArrowLeft", "PageUp"].includes(k)) { e.preventDefault(); go(cur - 1); }
    else if (k === "Home") go(0);
    else if (k === "End") go(total - 1);
    else if (k === "f" || k === "F") toggleFS();
    else if (k === "o" || k === "O") toggleOverview();
    else if (k === "Escape" && body.classList.contains("overview")) toggleOverview();
  });

  let tx = null, ty = null;
  document.addEventListener("touchstart", e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  document.addEventListener("touchend", e => {
    if (tx === null || body.classList.contains("docmode")) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));
    tx = null;
  });

  window.addEventListener("resize", layout);
  window.addEventListener("hashchange", () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (!isNaN(n) && n - 1 !== cur) go(n - 1);
  });
  layout();
  const h = parseInt(location.hash.slice(1), 10);
  go(isNaN(h) ? 0 : h - 1);
  started = true;
})();
