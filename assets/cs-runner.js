/* Client for the in-browser C# compiler (runner/index.html, Roslyn on WebAssembly).
   CsRunner.run(code, inputs) -> Promise<{errors:[], runs:[{status, stdout, errorType, error, ms}], ms}> */
(function () {
  const listeners = [];
  let frame = null, ready = false, failed = false, readyResolve, readyReject, nextId = 0;
  const pending = new Map();
  let chain = Promise.resolve();
  const readyPromise = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });

  function emit(state, info) { listeners.forEach(f => { try { f(state, info); } catch (e) { } }); }

  function start() {
    if (frame) return;
    emit("loading");
    frame = document.createElement("iframe");
    frame.src = "runner/index.html";
    frame.title = "C# runner";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:absolute;width:1px;height:1px;left:-9999px;top:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    setTimeout(() => { if (!ready && !failed) emit("slow"); }, 15000);
  }

  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data) return;
    const d = e.data;
    if (d.type === "cs-ready") { ready = true; emit("ready"); readyResolve(); }
    else if (d.type === "cs-fail") { failed = true; emit("fail", d.error); readyReject(new Error(d.error)); }
    else if (d.type === "cs-result" && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
  });

  function runNow(code, inputs) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("timeout")); }, 60000);
      pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
      frame.contentWindow.postMessage({ type: "cs-run", id, code, inputs }, location.origin);
    });
  }

  window.CsRunner = {
    start,
    get ready() { return ready; },
    onState(f) { listeners.push(f); if (ready) f("ready"); },
    whenReady() { start(); return readyPromise; },
    run(code, inputs) {
      start();
      const job = chain.then(() => readyPromise).then(() => runNow(code, inputs));
      chain = job.catch(() => { });
      return job;
    }
  };
})();
