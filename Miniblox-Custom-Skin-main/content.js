(() => {
  "use strict";

  const SKIN_RE = /skin|skins|avatar|character|player/i;

  // Estado local
  let applyEnabled = false;
  let targetOriginalUrl = "";
  let replacementUrl = "";

  // Cache de candidatos detectados (para mostrarlos en popup)
  const candidates = new Set();

  // Cargar configuración guardada
  chrome.storage.local.get(["mbx_apply", "mbx_target_original", "mbx_replacement"], (data) => {
    applyEnabled = !!data.mbx_apply;
    targetOriginalUrl = data.mbx_target_original || "";
    replacementUrl = data.mbx_replacement || "";
  });

  // Escuchar mensajes del popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "GET_CANDIDATES") {
      sendResponse({ ok: true, list: Array.from(candidates).slice(-200) });
      return true;
    }

    if (msg.type === "CLEAR_CANDIDATES") {
      candidates.clear();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === "SET_CONFIG") {
      // msg: { apply, targetOriginalUrl, replacementUrl }
      applyEnabled = !!msg.apply;
      targetOriginalUrl = msg.targetOriginalUrl || "";
      replacementUrl = msg.replacementUrl || "";

      chrome.storage.local.set({
        mbx_apply: applyEnabled,
        mbx_target_original: targetOriginalUrl,
        mbx_replacement: replacementUrl
      }, () => sendResponse({ ok: true }));

      return true;
    }

    sendResponse({ ok: false, error: "Unknown message" });
    return true;
  });

  function looksLikeCandidate(url) {
    if (!url || typeof url !== "string") return false;
    if (!SKIN_RE.test(url)) return false;
    // Evita meter data: etc
    if (url.startsWith("data:")) return false;
    return true;
  }

  function shouldReplace(url) {
    if (!applyEnabled) return false;
    if (!targetOriginalUrl || !replacementUrl) return false;
    return url === targetOriginalUrl;
  }

  // --------- fetch hook ----------
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url;

    try {
      if (looksLikeCandidate(url)) candidates.add(url);

      if (shouldReplace(url)) {
        return originalFetch(replacementUrl, { ...(init || {}), cache: "no-store" });
      }
    } catch (e) {}

    return originalFetch(input, init);
  };

  // --------- Image.src hook ----------
  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (desc?.set && desc?.get) {
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      set(value) {
        const url = String(value || "");
        try {
          if (looksLikeCandidate(url)) candidates.add(url);

          if (shouldReplace(url)) {
            return desc.set.call(this, replacementUrl);
          }
        } catch (e) {}
        return desc.set.call(this, value);
      },
      get() {
        return desc.get.call(this);
      }
    });
  }
})();
