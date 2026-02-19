(() => {
  "use strict";
  if (window.__CG_ADCONSOLE_HOOK__) return;
  window.__CG_ADCONSOLE_HOOK__ = true;

  const KEYWORDS = [
    "bannerCooldown",
    "adCooldown",
    "midgame ad",
    "Banner request error",
    "banner-container-crazygames-inner"
  ];

  function matches(args) {
    try {
      const text = args.map(a => {
        if (typeof a === "string") return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(" ");
      return KEYWORDS.some(k => text.includes(k));
    } catch {
      return false;
    }
  }

  function emit(level, args) {
    try {
      window.postMessage({
        __cg_ad_event: true,
        level,
        payload: args
      }, "*");
    } catch {}
  }

  // Hook console
  const orig = {
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    log: console.log.bind(console)
  };

  console.error = (...args) => {
    if (matches(args)) emit("error", args);
    orig.error(...args);
  };
  console.warn = (...args) => {
    if (matches(args)) emit("warn", args);
    orig.warn(...args);
  };
  console.info = (...args) => {
    if (matches(args)) emit("info", args);
    orig.info(...args);
  };
  console.log = (...args) => {
    if (matches(args)) emit("log", args);
    orig.log(...args);
  };

  // Hook window error (por si aparece como error de script)
  window.addEventListener("error", (e) => {
    try {
      const msg = String(e?.message || "");
      if (KEYWORDS.some(k => msg.includes(k))) {
        emit("error", [msg, e?.filename, e?.lineno, e?.colno]);
      }
    } catch {}
  }, true);
})();
