(function () {
  const BUTTON_ID = "appycrew-ocr-button";
  const PANEL_ID = "appycrew-ocr-panel";
  const STYLE_ID = "appycrew-ocr-styles";

  const state = {
    apiBase: null,
    selectedFile: null,
    lastOriginalText: "",
    lastText: "",
    lastVision: null,
    mappings: [],
    lastApplied: null,
    forms: [],
    activeForm: null,
    observer: null
  };

  const APPYCREW_HINTS = {
    locationKeywords: [
      "living room",
      "lounge",
      "front room",
      "sitting room",
      "bathroom",
      "toilet",
      "wc",
      "cloakroom",
      "kitchen",
      "dining room",
      "hall",
      "hallway",
      "garage",
      "loft",
      "attic",
      "office",
      "study",
      "bedroom 1",
      "bedroom 2",
      "bedroom 3",
      "master bedroom",
      "main bedroom",
      "kids room",
      "nursery"
    ],
    locationSynonyms: {
      mbr: "Master bedroom",
      "bed 1": "Bedroom 1",
      "bed 2": "Bedroom 2",
      "bed 3": "Bedroom 3"
    },
    itemKeywords: [
      "chair",
      "armchair",
      "dining chair",
      "sofa",
      "couch",
      "table",
      "coffee table",
      "desk",
      "wardrobe",
      "chest of drawers",
      "drawer",
      "sideboard",
      "mattress",
      "bed",
      "tv",
      "television",
      "monitor",
      "fridge",
      "freezer",
      "fridge freezer",
      "washing machine",
      "dryer",
      "tumble dryer",
      "box",
      "carton",
      "mirror",
      "lamp"
    ],
    itemSynonyms: {
      tv: "TV",
      television: "TV",
      carton: "box"
    }
  };

  // Labels we want to strip from OCR text, e.g. "Name: John" -> "John"
  const RAW_LABEL_WORDS = [
    "item",
    "type",
    "description",
    "qty",
    "quantity",
    "location",
    "name",
    "client",
    "driver",
    "surveyor",
    "job number",
    "job no",
    "container number",
    "container no",
    "additional information",
    "container level",
    "date"
  ];

  function normalizeLabel(str) {
    return (str || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  const LABEL_SET = (function () {
    const set = {};
    RAW_LABEL_WORDS.forEach(function (w) {
      const n = normalizeLabel(w);
      if (n) set[n] = true;
    });
    return set;
  })();

  function isLabelOnlyLine(line) {
    const n = normalizeLabel(line);
    if (!n) return false;
    return !!LABEL_SET[n];
  }

  // Strip pure labels and keep only the value part after :, -, =
  function stripLabelsAndExtractValues(text) {
    if (!text) return "";
    const lines = text.split(/\r?\n/);
    const cleaned = [];

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i].trim();
      if (!raw) continue;

      // If the line is just a label ("Name", "Job Number") – skip it
      if (isLabelOnlyLine(raw)) continue;

      // If we have "Label: Value" or "Label - Value" or "Label = Value"
      var match = raw.match(/[:=\-]/);
      if (match) {
        var idx = match.index;
        var left = raw.slice(0, idx).trim();
        var right = raw.slice(idx + 1).trim();
        var leftNorm = normalizeLabel(left);

        if (LABEL_SET[leftNorm] && right) {
          raw = right;
        }
      }

      cleaned.push(raw);
    }

    return cleaned.join("\n");
  }

  function log() {
    if (typeof console !== "undefined" && console.log) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[AppyCrew OCR]");
      console.log.apply(console, args);
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
#${BUTTON_ID} {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 999999;
  border-radius: 999px;
  border: none;
  padding: 10px 16px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  background: #0f172a;
  color: #f9fafb;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.35);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
#${BUTTON_ID}:hover { background: #020617; }
#${BUTTON_ID} .dot {
  width: 8px; height: 8px; border-radius: 999px; background: #22c55e;
}
#${BUTTON_ID} .label {
  white-space: nowrap;
}
@media (max-width: 480px) {
  #${BUTTON_ID} {
    padding-inline: 10px;
  }
  #${BUTTON_ID} .label {
    display: none;
  }
}
#${PANEL_ID} {
  position: fixed;
  bottom: 70px;
  right: 16px;
  width: 320px;
  max-width: calc(100vw - 32px);
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.35);
  z-index: 999999;
  display: none;
  flex-direction: column;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  border: 1px solid rgba(148, 163, 184, 0.4);
}
@media (max-width: 480px) {
  #${PANEL_ID} { right: 8px; left: 8px; width: auto; }
}
#${PANEL_ID}[data-open="true"] { display: flex; }
#${PANEL_ID} .ac-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px 8px; border-bottom: 1px solid rgba(226, 232, 240, 0.9);
}
#${PANEL_ID} .ac-title {
  font-size: 13px; font-weight: 600; display: flex; flex-direction: column; gap: 2px;
}
#${PANEL_ID} .ac-title span {
  font-size: 11px; color: #6b7280; font-weight: 400;
}
#${PANEL_ID} .ac-close {
  border: none; background: transparent; cursor: pointer;
  font-size: 16px; line-height: 1; color: #6b7280;
  padding: 2px 4px; border-radius: 999px;
}
#${PANEL_ID} .ac-close:hover {
  background: rgba(15, 23, 42, 0.04);
}
#${PANEL_ID} .ac-body {
  padding: 10px 12px 10px; display: flex; flex-direction: column; gap: 8px;
}
#${PANEL_ID} .ac-row { display: flex; flex-direction: column; gap: 4px; }
#${PANEL_ID} .ac-label { font-size: 11px; color: #6b7280; }
#${PANEL_ID} input[type="file"] { font-size: 11px; }
#${PANEL_ID} .ac-actions {
  display: flex; justify-content: space-between; gap: 6px;
  margin-top: 4px; align-items: center;
}
#${PANEL_ID} .ac-btn {
  border-radius: 999px; border: none; padding: 6px 10px; font-size: 11px;
  cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
  font-weight: 500;
}
#${PANEL_ID} .ac-btn-primary { background: #22c55e; color: white; }
#${PANEL_ID} .ac-btn-primary[disabled] { opacity: 0.6; cursor: default; }
#${PANEL_ID} .ac-btn-secondary {
  background: rgba(148, 163, 184, 0.16); color: #0f172a;
}
#${PANEL_ID} .ac-status {
  font-size: 11px; color: #6b7280; min-height: 16px;
}
#${PANEL_ID} .ac-status.error { color: #b91c1c; }
#${PANEL_ID} .ac-mappings {
  max-height: 200px; overflow: auto; border-radius: 8px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  padding: 6px 6px 4px; background: #f9fafb; margin-top: 4px;
}
#${PANEL_ID} .ac-map-row {
  display: grid; grid-template-columns: auto 1fr; gap: 4px 6px;
  padding: 4px 4px; border-radius: 6px; font-size: 11px;
  align-items: flex-start;
}
#${PANEL_ID} .ac-map-row:nth-child(odd) {
  background: rgba(15, 23, 42, 0.02);
}
#${PANEL_ID} .ac-map-row label {
  display: inline-flex; align-items: flex-start; gap: 4px; cursor: pointer;
}
#${PANEL_ID} .ac-map-field { font-weight: 500; }
#${PANEL_ID} .ac-map-value {
  color: #4b5563; white-space: normal; word-break: break-word;
}
#${PANEL_ID} .ac-raw {
  width: 100%; min-height: 70px; border-radius: 6px;
  border: 1px dashed rgba(148, 163, 184, 0.9);
  background: #f9fafb; font-size: 11px; padding: 6px 8px; resize: vertical;
}
#${PANEL_ID} .ac-brand {
  padding: 6px 10px 8px; border-top: 1px solid rgba(226, 232, 240, 0.9);
  font-size: 10px; color: #9ca3af; display: flex;
  justify-content: space-between; align-items: center; gap: 4px;
}
#${PANEL_ID} .ac-pill {
  padding: 2px 8px; border-radius: 999px;
  background: rgba(34, 197, 94, 0.1); color: #16a34a;
  font-size: 10px; white-space: nowrap;
}
#${PANEL_ID} .ac-pill span { font-weight: 600; }
`;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function detectApiBase() {
    if (state.apiBase) return state.apiBase;
    try {
      const current =
        document.currentScript ||
        (function () {
          const scripts = document.getElementsByTagName("script");
          for (let i = scripts.length - 1; i >= 0; i--) {
            if (scripts[i].src && scripts[i].src.indexOf("ocr-widget.js") !== -1) {
              return scripts[i];
            }
          }
          return null;
        })();
      if (current && current.src) {
        const u = new URL(current.src, window.location.href);
        state.apiBase = u.origin;
      } else {
        state.apiBase = window.location.origin;
      }
    } catch (err) {
      log("Could not detect API base, defaulting to window.location.origin", err);
      state.apiBase = window.location.origin;
    }
    return state.apiBase;
  }

  function getAllCandidateForms() {
    const all = Array.prototype.slice.call(document.forms || []);
    if (!all.length) return [];

    // Prefer forms explicitly marked for AppyCrew
    const marked = all.filter(function (f) {
      return f.hasAttribute("data-appycrew-ocr");
    });
    if (marked.length) return marked;
    return all;
  }

  function getVisibleRatio(el) {
    if (!el || !el.getBoundingClientRect) return 0;
    const rect = el.getBoundingClientRect();
    const vpH = window.innerHeight || document.documentElement.clientHeight || 0;
    const vpW = window.innerWidth || document.documentElement.clientWidth || 0;

    if (!vpH || !vpW) return 0;
    const visibleWidth = Math.max(0, Math.min(rect.right, vpW) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, vpH) - Math.max(rect.top, 0));
    const visibleArea = visibleWidth * visibleHeight;
    const totalArea = (rect.width || 1) * (rect.height || 1);
    if (!totalArea) return 0;
    return visibleArea > 0 ? visibleArea / totalArea : 0;
  }

  // Field-level visibility: require that at least ~30% of field is visible vertically
  function isFieldVisible(el) {
    if (!el || !el.getBoundingClientRect) return true;
    const rect = el.getBoundingClientRect();
    const vpH = window.innerHeight || document.documentElement.clientHeight || 0;
    const vpW = window.innerWidth || document.documentElement.clientWidth || 0;
    if (!vpH || !vpW) return true;

    const verticallyVisible = rect.bottom > 0 && rect.top < vpH;
    const horizontallyVisible = rect.right > 0 && rect.left < vpW;
    if (!verticallyVisible || !horizontallyVisible) return false;

    const visibleHeight = Math.min(rect.bottom, vpH) - Math.max(rect.top, 0);
    const ratio = visibleHeight / (rect.height || 1);
    return ratio >= 0.3;
  }

  function pickActiveForm(forms) {
    if (!forms || !forms.length) return null;
    let bestForm = null;
    let bestRatio = 0;
    for (let i = 0; i < forms.length; i++) {
      const f = forms[i];
      const ratio = getVisibleRatio(f);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestForm = f;
      }
    }
    // Require at least 15% visibility to consider it active
    if (bestRatio > 0.15) return bestForm;
    return null;
  }

  let formsUpdateTimer = null;
  function scheduleUpdateForms() {
    if (formsUpdateTimer) return;
    formsUpdateTimer = setTimeout(function () {
      formsUpdateTimer = null;
      updateForms();
    }, 120);
  }

  function updateForms() {
    const forms = getAllCandidateForms();
    state.forms = forms;
    state.activeForm = pickActiveForm(forms);
    const btn = document.getElementById(BUTTON_ID);

    if (!forms.length) {
      if (btn) btn.style.display = "none";
      log("No forms currently on page – widget hidden.");
      return;
    }

    if (btn) {
      btn.style.display = "inline-flex";
    } else {
      createButton();
    }
  }

  function observeDom() {
    if (state.observer || !window.MutationObserver) return;
    try {
      const obs = new MutationObserver(function () {
        scheduleUpdateForms();
      });
      obs.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
      state.observer = obs;
    } catch (err) {
      log("MutationObserver setup failed", err);
    }
  }

  function onViewportChange() {
    if (!state.forms || !state.forms.length) return;
    state.activeForm = pickActiveForm(state.forms);
  }

  function getTargetForms() {
    if (state.activeForm) return [state.activeForm];
    if (state.forms && state.forms.length) return state.forms;
    const forms = getAllCandidateForms();
    state.forms = forms;
    state.activeForm = pickActiveForm(forms);
    return forms;
  }

  function createButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.innerHTML =
      '<span class="dot"></span><span class="label">Scan with AppyCrew</span>';
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const forms = getTargetForms();
      if (!forms || !forms.length) {
        log("Scan requested but no forms available.");
        return;
      }
      togglePanel();
    });
    document.body.appendChild(btn);
  }

  function togglePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) {
      const isOpen = panel.getAttribute("data-open") === "true";
      panel.setAttribute("data-open", isOpen ? "false" : "true");
      return;
    }
    createPanel();
  }

  function createPanel() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.setAttribute("data-open", "true");

    const header = document.createElement("div");
    header.className = "ac-header";

    const title = document.createElement("div");
    title.className = "ac-title";
    title.innerHTML =
      'AppyCrew Scan <span>Camera opens, then we auto-fill the visible fields in this form</span>';

    const closeBtn = document.createElement("button");
    closeBtn.className = "ac-close";
    closeBtn.type = "button";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", function () {
      panel.setAttribute("data-open", "false");
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "ac-body";

    const rowFile = document.createElement("div");
    rowFile.className = "ac-row";

    const label = document.createElement("div");
    label.className = "ac-label";
    label.textContent =
      "1. Snap a photo of the item or notes – camera opens automatically";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.capture = "environment";

    const status = document.createElement("div");
    status.className = "ac-status";
    status.textContent = "Opening camera…";

    const mappingsContainer = document.createElement("div");
    mappingsContainer.className = "ac-mappings";
    mappingsContainer.style.display = "none";

    const actions = document.createElement("div");
    actions.className = "ac-actions";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "ac-btn ac-btn-secondary";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", function () {
      state.selectedFile = null;
      state.lastOriginalText = "";
      state.lastText = "";
      state.lastVision = null;
      state.mappings = [];
      state.lastApplied = null;
      fileInput.value = "";
      mappingsContainer.innerHTML = "";
      mappingsContainer.style.display = "none";
      status.textContent = "Cleared. Tap button again to rescan.";
      status.classList.remove("error");
    });

    const scanBtn = document.createElement("button");
    scanBtn.type = "button";
    scanBtn.className = "ac-btn ac-btn-primary";
    scanBtn.textContent = "Scan & match fields";

    fileInput.addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      state.selectedFile = file || null;
      if (!file) {
        status.textContent = "No image selected.";
        return;
      }
      status.classList.remove("error");
      status.textContent = "Image captured – running OCR / AI…";
      const forms = getTargetForms();
      runScan(forms, status, mappingsContainer, scanBtn, clearBtn);
    });

    scanBtn.addEventListener("click", function () {
      if (!state.selectedFile) {
        status.textContent = "Please capture or choose an image first.";
        status.classList.add("error");
        return;
      }
      status.classList.remove("error");
      const forms = getTargetForms();
      if (!forms || !forms.length) {
        status.textContent = "No form in view to fill.";
        status.classList.add("error");
        return;
      }
      runScan(forms, status, mappingsContainer, scanBtn, clearBtn);
    });

    rowFile.appendChild(label);
    rowFile.appendChild(fileInput);

    actions.appendChild(clearBtn);
    actions.appendChild(scanBtn);

    body.appendChild(rowFile);
    body.appendChild(status);
    body.appendChild(actions);
    body.appendChild(mappingsContainer);

    const footer = document.createElement("div");
    footer.className = "ac-brand";
    const left = document.createElement("span");
    left.textContent = "Powered by AppyCrew OCR + AI";
    const right = document.createElement("span");
    right.className = "ac-pill";
    right.innerHTML = "<span>AI</span> enhanced";
    footer.appendChild(left);
    footer.appendChild(right);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);

    document.body.appendChild(panel);

    setTimeout(function () {
      try {
        fileInput.click();
      } catch (err) {
        log("Auto camera open failed (browser blocked)", err);
        status.textContent = "Tap to choose or capture an image.";
      }
    }, 50);
  }

  function fileToDataUrlCompressed(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          try {
            const maxSide = 1600;
            let w = img.width;
            let h = img.height;
            if (w > h && w > maxSide) {
              h = Math.round((h * maxSide) / w);
              w = maxSide;
            } else if (h >= w && h > maxSide) {
              w = Math.round((w * maxSide) / h);
              h = maxSide;
            }
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL("image/jpeg", 0.7);
            resolve(compressed);
          } catch (err) {
            log("Compression failed, falling back to original", err);
            resolve(e.target.result);
          }
        };
        img.onerror = function () {
          log("Image load failed, using raw data URL");
          resolve(e.target.result);
        };
        img.src = e.target.result;
      };
      reader.onerror = function () {
        reject(new Error("Failed to read image"));
      };
      reader.readAsDataURL(file);
    });
  }

  async function callOcrApi(imageBase64) {
    const base = detectApiBase();
    const endpoint = base.replace(/\/$/, "") + "/api/ocr";
    const payload = { imageBase64: imageBase64 };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let data;
    try {
      data = await res.json();
    } catch (err) {
      log("Failed to parse OCR API JSON", err);
      throw new Error("Invalid JSON from OCR API");
    }

    if (!res.ok) {
      log("OCR API HTTP error", res.status, data);
      throw new Error((data && data.error) || "OCR request failed");
    }
    if (!data.success) {
      log("OCR API logical error", data);
      throw new Error(data.error || "OCR failed");
    }
    return data;
  }

  function buildMappings(forms, text, vision) {
    state.lastOriginalText = text || "";
    const cleanedText = stripLabelsAndExtractValues(text || "");
    state.lastText = cleanedText || "";
    state.lastVision = vision || null;
    const mappings = [];
    if (!forms || !forms.length) return mappings;

    const allInputs = [];
    Array.prototype.forEach.call(forms, function (form) {
      const nodes = form.querySelectorAll("input, textarea, select");
      Array.prototype.forEach.call(nodes, function (el) {
        allInputs.push(el);
      });
    });

    // Only consider visible fields for mapping
    const visibleInputs = allInputs.filter(isFieldVisible);
    if (!visibleInputs.length) {
      log("No visible fields found to map.");
    }

    const hasText = cleanedText && cleanedText.trim();
    const lines = hasText
      ? cleanedText
          .split(/\r?\n/)
          .map(function (l) {
            return l.trim();
          })
          .filter(Boolean)
      : [];
    const full = lines.join("\n");

    const emailMatch = hasText
      ? full.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
      : null;
    const phoneMatch = hasText
      ? full.replace(/\s+/g, "").match(/(\+?\d{7,15})/)
      : null;
    const postcodeMatch = hasText
      ? full.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)
      : null;

    const firstLine = lines[0] || "";
    const secondLine = lines[1] || "";

    function getMeta(el) {
      const id = el.id || "";
      const name = el.name || "";
      const placeholder = el.placeholder || "";
      const typeHint = el.getAttribute && el.getAttribute("data-appycrew-type");
      let labelText = "";
      if (id) {
        const label = document.querySelector('label[for="' + id + '"]');
        if (label) {
          labelText = label.innerText || label.textContent || "";
        }
      }
      if (!labelText) {
        const parentLabel = el.closest && el.closest("label");
        if (parentLabel) {
          labelText = parentLabel.innerText || parentLabel.textContent || "";
        }
      }
      return { id, name, placeholder, label: labelText, typeHint: typeHint || "" };
    }

    function findLocationFromText(fullText) {
      const lower = (fullText || "").toLowerCase();

      const synonyms = APPYCREW_HINTS.locationSynonyms || {};
      for (const key in synonyms) {
        if (!Object.prototype.hasOwnProperty.call(synonyms, key)) continue;
        if (lower.indexOf(key.toLowerCase()) !== -1) {
          return synonyms[key];
        }
      }

      const list = APPYCREW_HINTS.locationKeywords || [];
      for (let i = 0; i < list.length; i++) {
        const term = list[i];
        if (lower.indexOf(term.toLowerCase()) !== -1) {
          return term.charAt(0).toUpperCase() + term.slice(1);
        }
      }
      return "";
    }

    function findItemsFromText(fullText) {
      const lower = (fullText || "").toLowerCase();
      const found = [];
      const items = APPYCREW_HINTS.itemKeywords || [];
      const syn = APPYCREW_HINTS.itemSynonyms || {};
      items.forEach(function (term) {
        if (lower.indexOf(term.toLowerCase()) !== -1) {
          const canon = syn[term.toLowerCase()] || term;
          if (found.indexOf(canon) === -1) found.push(canon);
        }
      });
      for (const key in syn) {
        if (!Object.prototype.hasOwnProperty.call(syn, key)) continue;
        if (lower.indexOf(key.toLowerCase()) !== -1) {
          const canon = syn[key];
          if (found.indexOf(canon) === -1) found.push(canon);
        }
      }
      return found;
    }

    function candidateValue(meta, elType) {
      const str = (
        (meta.label || "") +
        " " +
        (meta.name || "") +
        " " +
        (meta.id || "") +
        " " +
        (meta.placeholder || "")
      )
        .toLowerCase()
        .trim();

      const visionItem =
        vision &&
        (vision.item || vision.itemName || vision.object || vision.mainItem);
      const visionColour =
        vision &&
        (vision.colour ||
          vision.color ||
          vision.colourName ||
          vision.mainColour);
      const visionDesc = vision && (vision.description || vision.summary);

      const itemsFromText = hasText ? findItemsFromText(full) : [];

      // If form hints are provided via data-appycrew-type, respect them first
      if (meta.typeHint) {
        const hint = meta.typeHint.toLowerCase();
        if (hint === "item") {
          if (itemsFromText && itemsFromText.length) return itemsFromText[0];
          if (visionItem) return visionItem;
        } else if (hint === "location") {
          const loc = findLocationFromText(full);
          if (loc) return loc;
        } else if (hint === "qty" || hint === "quantity") {
          if (hasText) {
            const qtyMatch = full.match(/\b(\d{1,3})\b/);
            if (qtyMatch) return qtyMatch[1];
          }
        } else if (hint === "notes" || hint === "description") {
          if (visionDesc) return visionDesc;
          if (hasText) return full;
        } else if (hint === "name") {
          return firstLine || secondLine || "";
        } else if (hint === "job-id" || hint === "id") {
          const idMatch = full.match(/\b[A-Z0-9\-]{4,}\b/i);
          if (idMatch) return idMatch[0];
        }
      }

      // ITEM mapping (without hints)
      if (str.indexOf("item") !== -1) {
        const allItems = [];
        if (itemsFromText && itemsFromText.length) {
          itemsFromText.forEach(function (it) {
            if (allItems.indexOf(it) === -1) allItems.push(it);
          });
        }
        if (visionItem && allItems.indexOf(visionItem) === -1) {
          allItems.push(visionItem);
        }
        if (allItems.length > 1) {
          return allItems.join(", ");
        }
        if (allItems.length === 1) {
          return allItems[0];
        }
        if (visionItem) return visionItem;
      }

      // Colour-only fields
      if (
        str.indexOf("colour") !== -1 ||
        str.indexOf("color") !== -1 ||
        str.indexOf("colorway") !== -1
      ) {
        if (visionColour) return visionColour;
      }

      // Description / notes fields
      if (
        str.indexOf("description") !== -1 ||
        str.indexOf("notes") !== -1 ||
        str.indexOf("job") !== -1
      ) {
        let desc = "";
        if (visionDesc) {
          desc = visionDesc;
        } else if (visionColour || visionItem) {
          const parts = [];
          if (visionColour) parts.push(visionColour);
          if (visionItem) parts.push(visionItem);
          desc = parts.join(" ");
        } else if (hasText) {
          desc = full;
        }

        if (
          desc &&
          visionItem &&
          desc.trim().toLowerCase() === visionItem.trim().toLowerCase() &&
          hasText
        ) {
          desc = full;
        }

        return desc || "";
      }

      // Quantity
      if (str.indexOf("qty") !== -1 || str.indexOf("quantity") !== -1) {
        if (hasText) {
          const qtyMatch = full.match(/\b(\d{1,3})\b/);
          if (qtyMatch) return qtyMatch[1];
        }
      }

      // Location - only fill if we actually detect a location keyword
      if (str.indexOf("location") !== -1 || str.indexOf("room") !== -1) {
        if (hasText) {
          const loc = findLocationFromText(full);
          if (loc) return loc;
        }
        return "";
      }

      if (!hasText) return "";

      // Generic mappings
      if (str.indexOf("email") !== -1) {
        return emailMatch && emailMatch[0];
      }
      if (
        str.indexOf("phone") !== -1 ||
        str.indexOf("mobile") !== -1 ||
        str.indexOf("tel") !== -1
      ) {
        return phoneMatch && phoneMatch[0];
      }
      if (str.indexOf("postcode") !== -1 || str.indexOf("zip") !== -1) {
        return postcodeMatch && postcodeMatch[0];
      }
      if (str.indexOf("name") !== -1) {
        return firstLine || secondLine || "";
      }
      if (
        str.indexOf("company") !== -1 ||
        str.indexOf("business") !== -1 ||
        str.indexOf("organisation") !== -1
      ) {
        return firstLine || "";
      }
      if (
        str.indexOf("address") !== -1 ||
        str.indexOf("street") !== -1 ||
        str.indexOf("line 1") !== -1
      ) {
        return lines.slice(1, 4).join(", ") || full;
      }
      if (
        str.indexOf("notes") !== -1 ||
        str.indexOf("description") !== -1 ||
        str.indexOf("comments") !== -1
      ) {
        return full;
      }

      return "";
    }

    visibleInputs.forEach(function (el) {
      const tag = el.tagName.toLowerCase();
      const type = (
        el.getAttribute("type") ||
        (tag === "textarea" ? "textarea" : "text")
      ).toLowerCase();
      if (
        ["hidden", "submit", "button", "checkbox", "radio", "file"].indexOf(
          type
        ) !== -1
      ) {
        return;
      }
      const meta = getMeta(el);
      const value = candidateValue(meta, type);
      if (!value) return;
      const label =
        meta.label || meta.placeholder || meta.name || meta.id || "Field";
      mappings.push({
        element: el,
        label: label,
        value: value,
        enabled: true
      });
    });

    return mappings;
  }

  function renderMappings(container, mappings) {
    container.innerHTML = "";
    const hasMappings = mappings && mappings.length;

    if (!hasMappings) {
      container.style.display = "block";
      const msg = document.createElement("div");
      msg.className = "ac-status";
      msg.textContent =
        "OCR / AI finished – no obvious field matches. You can copy the text below manually.";
      const raw = document.createElement("textarea");
      raw.className = "ac-raw";
      raw.readOnly = true;
      raw.value = state.lastText || state.lastOriginalText || "";
      container.appendChild(msg);
      container.appendChild(raw);

      if (
        state.lastVision &&
        (state.lastVision.item || state.lastVision.description)
      ) {
        const extra = document.createElement("div");
        extra.className = "ac-status";
        extra.style.marginTop = "4px";
        extra.textContent =
          "AI vision guess: " +
          ([state.lastVision.colour || state.lastVision.color || null,
          state.lastVision.item || null]
            .filter(Boolean)
            .join(" ") ||
            state.lastVision.description ||
            "");
        container.appendChild(extra);
      }
      return;
    }

    container.style.display = "block";
    const list = document.createElement("div");
    list.className = "ac-map-list";

    mappings.forEach(function (m) {
      const row = document.createElement("div");
      row.className = "ac-map-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.addEventListener("change", function () {
        m.enabled = checkbox.checked;
      });

      const labelWrap = document.createElement("label");
      const fieldName = document.createElement("div");
      fieldName.className = "ac-map-field";
      fieldName.textContent = m.label + " →";

      const value = document.createElement("div");
      value.className = "ac-map-value";
      value.textContent = m.value;

      labelWrap.appendChild(checkbox);
      labelWrap.appendChild(fieldName);
      row.appendChild(labelWrap);
      row.appendChild(value);
      list.appendChild(row);
    });

    container.appendChild(list);

    const applyRow = document.createElement("div");
    applyRow.style.marginTop = "6px";
    applyRow.style.display = "flex";
    applyRow.style.justifyContent = "space-between";
    applyRow.style.alignItems = "center";
    applyRow.style.gap = "6px";

    const left = document.createElement("div");
    left.style.fontSize = "10px";
    left.style.color = "#6b7280";

    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "ac-btn ac-btn-secondary";
    undoBtn.textContent = "Undo last apply";
    undoBtn.disabled = !state.lastApplied;

    undoBtn.addEventListener("click", function () {
      if (!state.lastApplied) return;
      try {
        state.lastApplied.forEach(function (entry) {
          if (!entry.element) return;
          if (entry.element.tagName.toLowerCase() === "select") {
            entry.element.value = entry.oldValue;
            const ev = new Event("change", { bubbles: true });
            entry.element.dispatchEvent(ev);
          } else {
            entry.element.value = entry.oldValue;
            const ev = new Event("input", { bubbles: true });
            entry.element.dispatchEvent(ev);
          }
        });
      } catch (err) {
        log("Undo failed", err);
      }
      state.lastApplied = null;
      undoBtn.disabled = true;
      left.textContent = "Undo complete.";
    });

    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "ac-btn ac-btn-primary";
    applyBtn.textContent = "Apply to form";

    applyBtn.addEventListener("click", function () {
      const history = [];
      mappings.forEach(function (m) {
        if (!m.enabled) return;
        const el = m.element;
        if (!el) return;
        const tag = el.tagName.toLowerCase();
        const oldValue = el.value;
        history.push({ element: el, oldValue: oldValue });
        try {
          if (tag === "select") {
            el.value = m.value;
            const event = new Event("change", { bubbles: true });
            el.dispatchEvent(event);
          } else {
            el.value = m.value;
            const event = new Event("input", { bubbles: true });
            el.dispatchEvent(event);
          }
        } catch (err) {
          // ignore
        }
      });
      state.lastApplied = history;
      undoBtn.disabled = history.length === 0;
      left.textContent = history.length
        ? "Applied to " + history.length + " field(s)."
        : "Nothing applied.";
      applyBtn.textContent = "Applied!";

      setTimeout(function () {
        applyBtn.textContent = "Apply again";
        const panel = document.getElementById(PANEL_ID);
        if (panel) panel.setAttribute("data-open", "false");
      }, 900);
    });

    applyRow.appendChild(undoBtn);
    applyRow.appendChild(applyBtn);
    container.appendChild(applyRow);
  }

  async function runScan(forms, statusEl, mappingsContainer, scanBtn, clearBtn) {
    try {
      if (scanBtn) scanBtn.disabled = true;
      if (clearBtn) clearBtn.disabled = true;
      statusEl.classList.remove("error");
      statusEl.textContent =
        "Compressing image and sending to AppyCrew OCR + AI…";

      const file = state.selectedFile;
      if (!file) {
        statusEl.textContent = "No image selected.";
        statusEl.classList.add("error");
        if (scanBtn) scanBtn.disabled = false;
        if (clearBtn) clearBtn.disabled = false;
        return;
      }

      const dataUrl = await fileToDataUrlCompressed(file);
      statusEl.textContent = "Running OCR (and AI if needed)…";

      const result = await callOcrApi(dataUrl);
      const text = (result && result.text) || "";
      const vision = (result && result.vision) || null;

      if (!text.trim() && !vision) {
        statusEl.textContent =
          "No text or items detected. Try a clearer photo or different angle.";
        statusEl.classList.add("error");
        mappingsContainer.innerHTML = "";
        mappingsContainer.style.display = "none";
        return;
      }

      const mappings = buildMappings(forms, text, vision);
      state.mappings = mappings;

      if (mappings.length) {
        statusEl.textContent =
          "Review the matches below, then tap “Apply to form”.";
      } else {
        statusEl.textContent =
          "OCR + AI completed. No automatic matches – text is available below.";
      }
      renderMappings(mappingsContainer, mappings);
    } catch (err) {
      log("Scan failed", err);
      statusEl.textContent =
        "Could not run OCR / AI. Check your connection or API keys and try again.";
      statusEl.classList.add("error");
      mappingsContainer.innerHTML = "";
      mappingsContainer.style.display = "none";
    } finally {
      if (scanBtn) scanBtn.disabled = false;
      if (clearBtn) clearBtn.disabled = false;
    }
  }

  function init() {
    try {
      injectStyles();
      detectApiBase();
      updateForms();
      observeDom();
      window.addEventListener("scroll", onViewportChange, { passive: true });
      window.addEventListener("resize", onViewportChange);
    } catch (err) {
      log("Failed to initialize widget", err);
    }
  }

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(init, 0);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();