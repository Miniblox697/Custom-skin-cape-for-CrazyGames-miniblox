(() => {
  "use strict";
  if (window.__CG_AD_MONITOR__) return;
  window.__CG_AD_MONITOR__ = true;

  // 1) Inyectar hook de console (page context)
  function injectHook() {
    try {
      const s = document.createElement("script");
      s.src = chrome.runtime.getURL("adconsole_hook.js");
      s.onload = () => s.remove();
      (document.head || document.documentElement).appendChild(s);
    } catch {}
  }

  injectHook();

  // 2) Escuchar eventos desde el hook (window.postMessage)
  window.addEventListener("message", (ev) => {
    const d = ev?.data;
    if (!d || d.__cg_ad_event !== true) return;

    // Normaliza texto para mandar al background
    const text = (d.payload || []).map(x => {
      if (typeof x === "string") return x;
      try { return JSON.stringify(x); } catch { return String(x); }
    }).join(" ");

    chrome.runtime.sendMessage({
      type: "CG_AD_SDK_LOG",
      info: {
        level: d.level || "info",
        text,
        href: location.href,
        frame: (window === window.top ? "top" : "iframe")
      }
    });
  });

  // 3) Detector DOM (por si hay banner/overlay visible)
  const SELECTORS = [
    "#banner-container-crazygames-inner",
    "[id*='banner-container' i]",
    "[class*='banner' i]",
    "[class*='interstitial' i]",
    "[class*='overlay' i]",
    "iframe[src*='doubleclick' i]",
    "iframe[src*='googlesyndication' i]"
  ];

  function scanOnce() {
    for (const sel of SELECTORS) {
      const el = document.querySelector(sel);
      if (!el) continue;
      if (el.tagName === "CANVAS") continue;

      chrome.runtime.sendMessage({
        type: "CG_AD_DOM_SEEN",
        info: {
          reason: `match:${sel}`,
          tag: el.tagName,
          id: el.id || "",
          class: (typeof el.className === "string" ? el.className : ""),
          src: el.tagName === "IFRAME" ? (el.getAttribute("src") || "") : "",
          href: location.href,
          frame: (window === window.top ? "top" : "iframe")
        }
      });

      return;
    }
  }

  scanOnce();
  const obs = new MutationObserver(() => scanOnce());
  obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  setInterval(scanOnce, 3500);
})();
