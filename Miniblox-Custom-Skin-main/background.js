/* =========================================================
   Miniblox Custom Skin/Cape + Adblock Monitor (PRO)
   background.js (MV3 service worker)
   ========================================================= */

/* =========================
   Boot / persistence
   ========================= */
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(["currentSkins", "currentCapes"]);
  if (!data.currentSkins) await chrome.storage.local.set({ currentSkins: {} });
  if (!data.currentCapes) await chrome.storage.local.set({ currentCapes: {} });

  mbxLog("info", "Extension installed/updated", {});
  await reapplyAllFromStorage();
});

chrome.runtime.onStartup?.addListener(async () => {
  mbxLog("info", "Extension startup", {});
  await reapplyAllFromStorage();
});

/* =========================
   MBX console logger (Port)
   ========================= */
const MBX_PORTS = new Set();

chrome.runtime.onConnect.addListener((port) => {
  if (port?.name !== "mbx_console") return;

  MBX_PORTS.add(port);

  port.onMessage.addListener((m) => {
    if (m?.type === "MBX_CONSOLE_HELLO") {
      mbxLog("info", "console.js conectado", {
        href: m.href,
        top: m.top,
        frame: m.frame
      });
    }
  });

  port.onDisconnect.addListener(() => {
    MBX_PORTS.delete(port);
  });
});

function mbxLog(level, msg, data) {
  const payload = { type: "MBX_LOG", level, msg, data, ts: Date.now() };
  for (const p of MBX_PORTS) {
    try { p.postMessage(payload); } catch {}
  }
}

/* =========================
   Skins / Capes lists
   ========================= */
const SKINS = [
  "alice","bob","techno","thebiggelo","corrupted","diana","strange","endoskeleton",
  "ganyu","georgenotfound","holly","hutao","jake","james","klee","kyoko",
  "adele","chris","deadpool","galactus","heather","ironman","suit","levi","lexi",
  "natalie","remus","sara","transformer","vindicate","adventure","aether","apex",
  "ariel","aurora","celeste","cody","ember","finn","glory","hunter","katie",
  "nova","panda","raven","seraphina","vain","zane","tester","qhyun","banana",
  "sushi","ethan","duck","cat","remlin"
];

const CAPES = [
  "angry-pig","bao","cloud","cow","creeper","golden-apple","grass-block","heart",
  "pumpkin","maki","mushroom","soul-creeper","sushi","wooden-sword",
  "stone-sword","iron-sword","gold-sword","diamond-sword","emerald-sword"
];

function getRuleId(type, name) {
  const list = (type === "cape") ? CAPES : SKINS;
  const idx = list.indexOf(name);
  if (idx === -1) throw new Error(`Unknown ${type} name: ${name}`);
  return (type === "cape" ? 2000 : 1000) + idx;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Regex robusto para skins/capes:
 * - cualquier dominio (miniblox.online, cdn, crazygames iframe)
 * - acepta prefijos antes de textures/
 * - acepta querystrings
 */
function buildRegexFilter(type, name) {
  const folder = (type === "cape") ? "capes" : "skins";
  const n = escapeRegex(name);
  return `^https?://[^?]*textures/entity/${folder}/${n}\\.png(\\?.*)?$`;
}

async function upsertRule(type, name, redirectUrl) {
  const ruleId = getRuleId(type, name);
  const regex = buildRegexFilter(type, name);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [ruleId],
    addRules: [{
      id: ruleId,
      priority: 1,
      action: { type: "redirect", redirect: { url: redirectUrl } },
      condition: {
        regexFilter: regex,
        resourceTypes: ["image"]
      }
    }]
  });

  mbxLog("info", "Skin/Cape rule updated", { type, name, ruleId, to: redirectUrl });
}

async function removeRule(type, name) {
  const ruleId = getRuleId(type, name);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] });
  mbxLog("info", "Skin/Cape rule removed", { type, name, ruleId });
}

/**
 * Semántica:
 * - customUrl vacío => QUITA regla (vuelve al original real del juego)
 * - customUrl con URL => redirect a esa URL
 */
async function setRedirect(type, name, customUrl = "") {
  const trimmed = (customUrl || "").trim();

  if (!trimmed) {
    await removeRule(type, name);

    const key = (type === "cape") ? "currentCapes" : "currentSkins";
    const data = await chrome.storage.local.get([key]);
    const current = data[key] || {};
    delete current[name];
    await chrome.storage.local.set({ [key]: current });

    mbxLog("ok", "Volvió a original (regla quitada)", { type, name });
    return;
  }

  let u;
  try { u = new URL(trimmed); } catch {
    mbxLog("error", "URL inválida (no se aplicó)", { type, name, customUrl: trimmed });
    throw new Error("Invalid URL");
  }
  if (!/^https?:$/.test(u.protocol)) {
    mbxLog("error", "URL debe ser http/https (no se aplicó)", { type, name, customUrl: trimmed });
    throw new Error("URL must be http/https");
  }

  await upsertRule(type, name, trimmed);

  const key = (type === "cape") ? "currentCapes" : "currentSkins";
  const data = await chrome.storage.local.get([key]);
  const current = data[key] || {};
  current[name] = trimmed;
  await chrome.storage.local.set({ [key]: current });

  mbxLog("ok", "Aplicado (redirect listo)", { type, name, to: trimmed });
}

async function resetType(type) {
  const key = (type === "cape") ? "currentCapes" : "currentSkins";
  const list = (type === "cape") ? CAPES : SKINS;

  const data = await chrome.storage.local.get([key]);
  const current = data[key] || {};

  const ruleIds = Object.keys(current)
    .filter(n => list.includes(n))
    .map(n => getRuleId(type, n));

  if (ruleIds.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIds });
  }

  await chrome.storage.local.set({ [key]: {} });
  mbxLog("ok", "Reset modo", { type, removedRules: ruleIds.length });
}

async function resetAll() {
  await resetType("skin");
  await resetType("cape");
  mbxLog("ok", "Reset total", {});
}

/**
 * Reaplica reglas desde storage (para “siempre” tras updates/startup).
 */
async function reapplyAllFromStorage() {
  const data = await chrome.storage.local.get(["currentSkins", "currentCapes"]);
  const skins = data.currentSkins || {};
  const capes = data.currentCapes || {};

  let count = 0;

  for (const [name, url] of Object.entries(skins)) {
    if (!SKINS.includes(name)) continue;
    if (!url) continue;
    try { await upsertRule("skin", name, url); count++; }
    catch (e) { mbxLog("error", "No se pudo reaplicar skin", { name, url, error: String(e?.message || e) }); }
  }

  for (const [name, url] of Object.entries(capes)) {
    if (!CAPES.includes(name)) continue;
    if (!url) continue;
    try { await upsertRule("cape", name, url); count++; }
    catch (e) { mbxLog("error", "No se pudo reaplicar cape", { name, url, error: String(e?.message || e) }); }
  }

  mbxLog("info", "Reapply done", { rulesApplied: count });
}

/* =========================
   PRO Ad Monitor State
   ========================= */
const AD_STATE = {
  lastDomAdSeenAt: 0,
  lastDomAdInfo: null,

  lastSdkLogAt: 0,
  lastSdkLogInfo: null,

  lastDnrBlockAt: 0,
  lastDnrInfo: null,

  lastStatus: "" // "blocked" | "not_blocked_dom" | "cooldown" | "clear" | "dnr_error"
};

function recordDomAd(info) {
  AD_STATE.lastDomAdSeenAt = Date.now();
  AD_STATE.lastDomAdInfo = info || null;
  mbxLog("info", "Anuncio detectado (DOM)", info || {});
}

function recordSdkLog(info) {
  AD_STATE.lastSdkLogAt = Date.now();
  AD_STATE.lastSdkLogInfo = info || null;

  const t = String(info?.text || "");
  if (t.includes("bannerCooldown") || t.includes("adCooldown")) {
    // Esto es exactamente lo que pegaste tú: el SDK frenó el request por cooldown
    mbxLog("warn", "CrazyGames: intento de anuncio (cooldown) ⏳", info);
  } else {
    mbxLog("info", "CrazyGames Ad SDK log", info);
  }
}

/**
 * DNR feedback: reglas block activadas recientemente.
 * Requiere declarativeNetRequestFeedback.
 */
async function pollDnrBlocked() {
  try {
    const now = Date.now();
    const res = await chrome.declarativeNetRequest.getMatchedRules({
      minTimeStamp: now - 6000
    });

    const blockedRules = (res?.rulesMatchedInfo || [])
      .filter(x => x?.rule?.action?.type === "block")
      .map(x => x.rule)
      .filter(Boolean);

    if (blockedRules.length > 0) {
      AD_STATE.lastDnrBlockAt = now;
      AD_STATE.lastDnrInfo = {
        total: blockedRules.length,
        ruleIds: blockedRules.map(r => r.id).slice(0, 30)
      };
    }

    if (AD_STATE.lastStatus === "dnr_error") AD_STATE.lastStatus = "";

  } catch (e) {
    if (AD_STATE.lastStatus !== "dnr_error") {
      AD_STATE.lastStatus = "dnr_error";
      mbxLog("warn", "DNR feedback no disponible", {
        error: String(e?.message || e),
        hint: "Necesitas declarativeNetRequestFeedback y extensión descomprimida (modo desarrollador)."
      });
    }
  }
}

function evaluateAdStatus() {
  const now = Date.now();

  const dnrRecent = (now - AD_STATE.lastDnrBlockAt) < 8000;
  const domRecent = (now - AD_STATE.lastDomAdSeenAt) < 8000;
  const sdkRecent = (now - AD_STATE.lastSdkLogAt) < 8000;

  if (dnrRecent) {
    if (AD_STATE.lastStatus !== "blocked") {
      AD_STATE.lastStatus = "blocked";
      mbxLog("ok", "Anuncio bloqueado ✅", AD_STATE.lastDnrInfo || {});
    }
    return;
  }

  // Si el SDK reporta cooldown, eso significa intento de ad pero no se mostró (o no pudo)
  if (sdkRecent) {
    const t = String(AD_STATE.lastSdkLogInfo?.text || "");
    if (t.includes("bannerCooldown") || t.includes("adCooldown")) {
      if (AD_STATE.lastStatus !== "cooldown") {
        AD_STATE.lastStatus = "cooldown";
        mbxLog("warn", "CrazyGames: intentó mostrar anuncio, pero cooldown lo evitó ⏳", AD_STATE.lastSdkLogInfo || {});
      }
      return;
    }
  }

  // Si vimos DOM de anuncio pero no hubo block DNR reciente => no pudimos bloquear (probable first-party/canvas)
  if (domRecent && !dnrRecent) {
    if (AD_STATE.lastStatus !== "not_blocked_dom") {
      AD_STATE.lastStatus = "not_blocked_dom";
      mbxLog("warn", "Anuncio detectado, pero no pudimos bloquearlo ❌", {
        hint: "Probable first-party/canvas o falta dominio en rules.json",
        dom: AD_STATE.lastDomAdInfo
      });
    }
    return;
  }

  if (AD_STATE.lastStatus !== "clear") {
    AD_STATE.lastStatus = "clear";
    mbxLog("info", "Monitor activo. Sin anuncios detectados ahora.", {});
  }
}

// Polling monitor
setInterval(async () => {
  await pollDnrBlocked();
  evaluateAdStatus();
}, 4000);

/* =========================
   Messaging from popup.js + monitor.js
   ========================= */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      // --- skins/capes ---
      if (message?.type === "setSkin") {
        await setRedirect("skin", message.skinName, message.customUrl || "");
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === "setCape") {
        await setRedirect("cape", message.capeName, message.customUrl || "");
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === "resetSkins") {
        await resetType("skin");
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === "resetCapes") {
        await resetType("cape");
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === "resetAll") {
        await resetAll();
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === "getState") {
        const data = await chrome.storage.local.get(["currentSkins", "currentCapes"]);
        sendResponse({
          ok: true,
          currentSkins: data.currentSkins || {},
          currentCapes: data.currentCapes || {}
        });
        return;
      }

      // --- ad monitor (DOM) ---
      if (message?.type === "CG_AD_DOM_SEEN") {
        recordDomAd(message.info || null);
        sendResponse({ ok: true });
        return;
      }

      // --- ad monitor (SDK logs: bannerCooldown/adCooldown etc) ---
      if (message?.type === "CG_AD_SDK_LOG") {
        recordSdkLog(message.info || null);
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message" });

    } catch (e) {
      const err = String(e?.message || e);
      mbxLog("error", "Fallo en background", { error: err, message });
      console.error(e);
      sendResponse({ ok: false, error: err });
    }
  })();

  return true;
});
