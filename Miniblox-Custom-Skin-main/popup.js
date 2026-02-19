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

function setStatus(msg, ok = true) {
  const s = document.getElementById("status");
  s.textContent = msg;
  s.style.color = ok ? "#7CFFB1" : "#ff8b8b";
}

function isUrl(s) {
  try { new URL(s); return true; } catch { return false; }
}

async function reloadActiveTabBypassCache() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs?.[0];
  if (!tab?.id) return;
  // Esto es lo que hace que “siempre” aplique: fuerza a pedir de nuevo assets.
  await chrome.tabs.reload(tab.id, { bypassCache: true });
}

let selectedName = "";

function renderList(mode, currentMap = {}) {
  const listEl = document.getElementById("list");
  listEl.innerHTML = "";

  const items = (mode === "cape") ? CAPES : SKINS;
  if (!selectedName) selectedName = items[0];

  for (const name of items) {
    const row = document.createElement("div");
    row.className = "item";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "pick";
    radio.value = name;
    radio.checked = (name === selectedName);

    const title = document.createElement("div");
    title.className = "name";
    title.textContent = name;

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = currentMap[name] ? "custom" : "original";

    row.addEventListener("click", () => {
      selectedName = name;
      renderList(mode, currentMap);
      document.getElementById("customUrl").value = currentMap[name] || "";
      setStatus(`Seleccionado: ${name}`, true);
    });

    row.appendChild(radio);
    row.appendChild(title);
    row.appendChild(badge);
    listEl.appendChild(row);
  }
}

(async () => {
  const modeSel = document.getElementById("mode");
  const urlInput = document.getElementById("customUrl");

  let state = { currentSkins: {}, currentCapes: {} };

  function currentMapForMode(mode) {
    return mode === "cape" ? (state.currentCapes || {}) : (state.currentSkins || {});
  }

  chrome.runtime.sendMessage({ type: "getState" }, (res) => {
    if (res?.ok) {
      state.currentSkins = res.currentSkins || {};
      state.currentCapes = res.currentCapes || {};
    }
    renderList(modeSel.value, currentMapForMode(modeSel.value));
  });

  modeSel.addEventListener("change", () => {
    selectedName = "";
    urlInput.value = "";
    setStatus("");
    renderList(modeSel.value, currentMapForMode(modeSel.value));
  });

  document.getElementById("applyBtn").addEventListener("click", () => {
    const mode = modeSel.value;
    const name = selectedName;
    const customUrl = urlInput.value.trim();

    if (!name) return setStatus("Selecciona uno en la lista.", false);
    if (customUrl && !isUrl(customUrl)) return setStatus("URL inválida (http/https).", false);

    const msg = (mode === "cape")
      ? { type: "setCape", capeName: name, customUrl }
      : { type: "setSkin", skinName: name, customUrl };

    chrome.runtime.sendMessage(msg, async (r) => {
      if (!r?.ok) {
        setStatus("Error: " + (r?.error || "desconocido"), false);
        return;
      }

      // Actualiza estado local UI
      if (mode === "cape") {
        if (customUrl) state.currentCapes[name] = customUrl;
        else delete state.currentCapes[name];
      } else {
        if (customUrl) state.currentSkins[name] = customUrl;
        else delete state.currentSkins[name];
      }
      renderList(mode, currentMapForMode(mode));

      // CLAVE: recarga sin cache
      try {
        setStatus("Aplicado ✅ Recargando sin cache…", true);
        await reloadActiveTabBypassCache();
      } catch (e) {
        setStatus("Aplicado, pero no pude recargar la pestaña: " + String(e?.message || e), false);
      }
    });
  });

  document.getElementById("resetTypeBtn").addEventListener("click", () => {
    const mode = modeSel.value;
    const msg = (mode === "cape") ? { type: "resetCapes" } : { type: "resetSkins" };

    chrome.runtime.sendMessage(msg, async (r) => {
      if (!r?.ok) return setStatus("Error: " + (r?.error || "desconocido"), false);

      urlInput.value = "";
      if (mode === "cape") state.currentCapes = {};
      else state.currentSkins = {};
      renderList(mode, currentMapForMode(mode));

      try {
        setStatus("Reset ✅ Recargando sin cache…", true);
        await reloadActiveTabBypassCache();
      } catch (e) {
        setStatus("Reset hecho, pero no pude recargar la pestaña: " + String(e?.message || e), false);
      }
    });
  });

  document.getElementById("resetAllBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "resetAll" }, async (r) => {
      if (!r?.ok) return setStatus("Error: " + (r?.error || "desconocido"), false);

      urlInput.value = "";
      state.currentSkins = {};
      state.currentCapes = {};
      renderList(modeSel.value, currentMapForMode(modeSel.value));

      try {
        setStatus("Reset total ✅ Recargando sin cache…", true);
        await reloadActiveTabBypassCache();
      } catch (e) {
        setStatus("Reset total hecho, pero no pude recargar la pestaña: " + String(e?.message || e), false);
      }
    });
  });
})();
