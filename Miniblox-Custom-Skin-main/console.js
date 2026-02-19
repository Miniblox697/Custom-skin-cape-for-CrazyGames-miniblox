(() => {
  "use strict";
  if (window.__CG_ADBLOCK_CONSOLE__) return;
  window.__CG_ADBLOCK_CONSOLE__ = true;

  const PREFIX = "[CG-ADBLOCK]";
  const S = {
    ok: "color:#7CFFB1;font-weight:700",
    error: "color:#ff8b8b;font-weight:700",
    warn: "color:#ffd580;font-weight:700",
    info: "color:#89b4ff;font-weight:700"
  };

  function style(level){ return S[level] || S.info; }

  function log(level, msg, data) {
    try {
      if (data && typeof data === "object") {
        console.groupCollapsed(`%c${PREFIX} ${msg}`, style(level));
        console.log(data);
        console.groupEnd();
      } else if (data !== undefined) {
        console.log(`%c${PREFIX} ${msg}`, style(level), data);
      } else {
        console.log(`%c${PREFIX} ${msg}`, style(level));
      }
    } catch {}
  }

  let port;
  try { port = chrome.runtime.connect({ name: "cg_adblock_console" }); }
  catch (e) { log("error", "No pudo conectar con background", String(e)); return; }

  port.onMessage.addListener((m) => {
    if (!m || m.type !== "LOG") return;
    log(m.level || "info", m.msg, m.data);
  });

  log("info", "Console conectado", {
    url: location.href,
    frame: window === window.top ? "top" : "iframe"
  });
})();
