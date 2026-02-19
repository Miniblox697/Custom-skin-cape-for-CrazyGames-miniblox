(() => {
  "use strict";
  if (window.__CG_ADHIDE__) return;
  window.__CG_ADHIDE__ = true;

  const STYLE_ID = "cg-adhide-style";

  const SELECTORS = [
    'iframe[src*="doubleclick" i]',
    'iframe[src*="googlesyndication" i]',
    'iframe[src*="adservice" i]',
    'iframe[src*="adnxs" i]',
    'iframe[src*="rubicon" i]',
    'iframe[src*="openx" i]',
    'iframe[src*="criteo" i]',
    'iframe[id*="ad" i]',
    'iframe[class*="ad" i]',

    '[class*="interstitial" i]',
    '[id*="interstitial" i]',
    '[class*="overlay" i]',
    '[id*="overlay" i]',
    '[class*="modal" i]',
    '[id*="modal" i]',
    '[class*="popup" i]',
    '[id*="popup" i]',
    '[class*="banner" i]',
    '[id*="banner" i]',

    '[id*="advert" i]',
    '[class*="advert" i]',
    '[id*="ads" i]',
    '[class*="ads" i]'
  ];

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
      ${SELECTORS.join(",\n")}{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }
    `;
    document.documentElement.appendChild(st);
  }

  function cleanup() {
    for (const sel of SELECTORS) {
      document.querySelectorAll(sel).forEach((n) => {
        if (!n) return;
        if (n.tagName === "CANVAS") return;
        try { n.remove(); }
        catch {
          try {
            n.style.setProperty("display", "none", "important");
            n.style.setProperty("pointer-events", "none", "important");
          } catch {}
        }
      });
    }
  }

  injectCss();
  cleanup();

  const obs = new MutationObserver(() => { injectCss(); cleanup(); });
  obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

  setTimeout(cleanup, 500);
  setTimeout(cleanup, 1500);
  setTimeout(cleanup, 3500);
})();
