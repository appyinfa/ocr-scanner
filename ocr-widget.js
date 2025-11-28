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
      // Common bedroom abbreviations
      mbr: "Master bedroom",
      "main bedroom": "Master bedroom",
      "bed 1": "Bedroom 1",
      "bedroom 1": "Bedroom 1",
      "bed 2": "Bedroom 2",
      "bedroom 2": "Bedroom 2",
      "bed 3": "Bedroom 3",
      "bedroom 3": "Bedroom 3",
      "kids room": "Kids room",
      nursery: "Nursery",

      // Living areas
      lounge: "Living room",
      "front room": "Living room",
      "sitting room": "Living room",
      "living rm": "Living room",
      "liv room": "Living room",

      // Dining & kitchen
      diner: "Dining room",
      dining: "Dining room",
      "dining rm": "Dining room",
      kit: "Kitchen",
      "kitchen diner": "Kitchen",
      "kitchen/diner": "Kitchen",

      // Bathrooms & toilets
      bath: "Bathroom",
      "bath rm": "Bathroom",
      "bathroom 1": "Bathroom",
      "bathroom 2": "Bathroom",
      ensuite: "En-suite",
      "en-suite": "En-suite",
      wc: "Toilet",
      cloakroom: "Cloakroom",
      loo: "Toilet",

      // Other areas
      garage: "Garage",
      loft: "Loft",
      attic: "Loft",
      hallway: "Hall",
      hall: "Hall",
      porch: "Porch",
      conservatory: "Conservatory",
      study: "Study",
      office: "Office",
      utility: "Utility room",
      "utility room": "Utility room",
      cellar: "Cellar",
      basement: "Basement",
      shed: "Shed",
      garden: "Garden",
      drive: "Driveway",
      driveway: "Driveway"
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
      "washer",
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

  function stripLabelsAndExtractValues(text) {
    if (!text) return "";
    const lines = text.split(/\r?\n/);
    const cleaned = [];

    for (let i = 0; i < lines.length; i++) {
      var raw = lines[i].trim();
      if (!raw) continue;

      if (isLabelOnlyLine(raw)) continue;

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
      try {
        console.log.apply(console, arguments);
      } catch (e) {
        // ignore
      }
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const css = `
#${BUTTON_ID} {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  border: none;
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
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  z-index: 2147483647;
  display: none;
  flex-direction: column;
  overflow: hidden;
}
#${PANEL_ID}.open {
  display: flex;
}
#${PANEL_ID} header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #0f172a;
  color: #e5e7eb;
}
#${PANEL_ID} header .title {
  font-size: 14px;
  font-weight: 600;
}
#${PANEL_ID} header .subtitle {
  font-size: 11px;
  opacity: 0.8;
}
#${PANEL_ID} header .close {
  cursor: pointer;
  border: none;
  background: transparent;
  color: inherit;
}
#${PANEL_ID} .body {
  padding: 10px 12px 12px;
  max-height: 320px;
  overflow: auto;
  background: #f9fafb;
}
#${PANEL_ID} .body .status {
  font-size: 12px;
  color: #4b5563;
  margin-bottom: 6px;
}
#${PANEL_ID} .body .status strong {
  color: #111827;
}
#${PANEL_ID} .mapping-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
#${PANEL_ID} .mapping-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  padding: 5px 0;
}
#${PANEL_ID} .mapping-item label {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  cursor: pointer;
}
#${PANEL_ID} .mapping-item .field-label {
  font-weight: 500;
  color: #111827;
}
#${PANEL_ID} .mapping-item .field-value {
  color: #374151;
}
#${PANEL_ID} .mapping-item input[type="checkbox"] {
  margin-top: 2px;
}
#${PANEL_ID} .footer {
  padding: 8px 12px 10px;
  border-top: 1px solid #e5e7eb;
  background: #f3f4f6;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
#${PANEL_ID} .footer button {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}
#${PANEL_ID} .footer .secondary {
  background: #e5e7eb;
  color: #111827;
}
#${PANEL_ID} .footer .primary {
  background: #0f172a;
  color: #f9fafb;
}
#${PANEL_ID} .footer .primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}
#${PANEL_ID} .raw-text {
  margin-top: 8px;
  font-size: 11px;
  color: #6b7280;
  border-top: 1px dashed #e5e7eb;
  padding-top: 6px;
}
#${PANEL_ID} .raw-text textarea {
  width: 100%;
  min-height: 60px;
  font-size: 11px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  padding: 6px;
  resize: vertical;
  background: #f9fafb;
}
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

  function createButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.innerHTML = `
      <span class="dot"></span>
      <span class="label">Scan with AppyCrew</span>
    `;
    btn.addEventListener("click", onButtonClick);
    document.body.appendChild(btn);
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <header>
        <div>
          <div class="title">AppyCrew OCR</div>
          <div class="subtitle">Scan to fill this form</div>
        </div>
        <button class="close" aria-label="Close">&times;</button>
      </header>
      <div class="body">
        <div class="status">No scan yet. Tap the button below to start.</div>
      </div>
      <div class="footer">
        <button class="secondary" data-action="undo" disabled>Undo</button>
        <button class="primary" data-action="apply" disabled>Apply</button>
      </div>
    `;
    const close = panel.querySelector("button.close");
    close.addEventListener("click", () => panel.classList.remove("open"));
    const applyBtn = panel.querySelector('button[data-action="apply"]');
    const undoBtn = panel.querySelector('button[data-action="undo"]');
    applyBtn.addEventListener("click", onApplyClick);
    undoBtn.addEventListener("click", onUndoClick);
    document.body.appendChild(panel);
  }

  function ensureUi() {
    injectStyles();
    createButton();
    createPanel();
  }

  function getPanelBody() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return null;
    return panel.querySelector(".body");
  }

  function getPanel() {
    return document.getElementById(PANEL_ID);
  }

  function openPanel() {
    const panel = getPanel();
    if (!panel) return;
    panel.classList.add("open");
  }

  function closePanel() {
    const panel = getPanel();
    if (!panel) return;
    panel.classList.remove("open");
  }

  function escapeRegex(str) {
    return (str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function isFieldVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;

    if (rect.bottom < 0 || rect.right < 0 || rect.top > vh || rect.left > vw) {
      return false;
    }

    const height = rect.height || 1;
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, vh);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const ratio = visibleHeight / height;

    return ratio >= 0.3;
  }

  function pickActiveForm(forms) {
    if (!forms || !forms.length) return null;

    let bestForm = null;
    let bestScore = 0;

    const vh = window.innerHeight || document.documentElement.clientHeight;

    forms.forEach(function (form) {
      const rect = form.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return;

      const height = rect.height || 1;
      const visibleTop = Math.max(rect.top, 0);
      const visibleBottom = Math.min(rect.bottom, vh);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const ratio = visibleHeight / height;

      if (ratio <= 0) return;

      const score = visibleHeight;
      if (score > bestScore) {
        bestScore = score;
        bestForm = form;
      }
    });

    return bestForm || null;
  }

  function findForms() {
    const forms = Array.prototype.slice.call(document.querySelectorAll("form"));
    state.forms = forms;
    state.activeForm = pickActiveForm(forms);
  }

  function refreshForms() {
    findForms();
    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
      btn.style.display = state.forms && state.forms.length ? "flex" : "none";
    }
  }

  function setupMutationObserver() {
    if (state.observer) return;
    try {
      const obs = new MutationObserver(function () {
        refreshForms();
      });
      obs.observe(document.body, {
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
    return [];
  }

  function setReactFriendlyValue(el, value) {
    try {
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) {
        desc.set.call(el, value);
      } else {
        el.value = value;
      }

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (err) {
      el.value = value;
      try {
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e) {
        // ignore
      }
    }
  }

  function gatherInputs(form) {
    if (!form) return [];
    const fields = Array.prototype.slice.call(
      form.querySelectorAll("input, textarea, select")
    );
    return fields.filter(function (el) {
      if (!el.name && !el.id && !el.getAttribute("data-appycrew-type")) {
        return false;
      }
      return true;
    });
  }

  function getLabelFor(el) {
    if (!el || !el.id) return null;
    const lbl = document.querySelector('label[for="' + el.id + '"]');
    if (lbl && lbl.innerText) return lbl.innerText.trim();
    return null;
  }

  function getMeta(el) {
    const tag = el.tagName.toLowerCase();
    const typeAttr = (el.getAttribute("type") || "").toLowerCase();
    const name = el.name || "";
    const id = el.id || "";
    const label = getLabelFor(el);
    const placeholder = el.placeholder || "";
    const dataType = el.getAttribute("data-appycrew-type") || "";

    return {
      tag,
      typeAttr,
      name,
      id,
      label,
      placeholder,
      typeHint: dataType
    };
  }

  function getFormType(forms) {
    const list = forms || [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const t = f.getAttribute("data-appycrew-form-type");
      if (t) return t;
    }
    return null;
  }

  function openFilePicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";

    input.addEventListener("change", function () {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      state.selectedFile = file;
      runOcr(file);
    });

    input.click();
  }

  function onButtonClick() {
    const forms = getTargetForms();
    if (!forms || !forms.length) {
      alert("AppyCrew OCR: No form detected on this page.");
      return;
    }

    openFilePicker();
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function (e) {
        reject(e);
      };
      reader.readAsDataURL(file);
    });
  }

  function runOcr(file) {
    const body = getPanelBody();
    if (body) {
      body.innerHTML =
        '<div class="status"><strong>Uploading...</strong> Please wait.</div>';
    }
    openPanel();

    readFileAsDataUrl(file)
      .then(function (dataUrl) {
        const baseUrl = detectApiBase();
        const url = baseUrl.replace(/\/+$/, "") + "/api/ocr";

        const forms = getTargetForms();
        const formType = getFormType(forms);

        return fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            imageBase64: dataUrl,
            formType: formType || null
          })
        });
      })
      .then(function (resp) {
        if (!resp.ok) {
          return resp.text().then(function (text) {
            throw new Error("HTTP " + resp.status + ": " + text);
          });
        }
        return resp.json();
      })
      .then(function (data) {
        if (!data || !data.success) {
          throw new Error(
            (data && data.error) || "AppyCrew OCR: Unknown error from server"
          );
        }
        state.lastOriginalText = data.text || "";
        state.lastText = stripLabelsAndExtractValues(data.text || "");
        state.lastVision = data.vision || null;
        buildMappingsUi();
      })
      .catch(function (err) {
        log("AppyCrew OCR error", err);
        const body = getPanelBody();
        if (body) {
          body.innerHTML =
            '<div class="status"><strong>Error:</strong> ' +
            (err && err.message ? err.message : "Unknown error") +
            "</div>";
        }
      });
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

  function buildMappings(forms, text, vision) {
    const cleanedText = stripLabelsAndExtractValues(text || "");
    const full = cleanedText || text || "";
    const hasText = !!full && full.trim().length > 0;

    const lines = full.split(/\r?\n/).map(function (l) {
      return l.trim();
    });

    const itemsFromText = hasText ? findItemsFromText(full) : [];
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

    const qtyMatch = hasText ? full.match(/\b(\d{1,3})\b/) : null;
    const locationFromText = hasText ? findLocationFromText(full) : "";

    function buildDescription() {
      // Prefer AI vision description/colour/item, but keep it short & item-only.
      if (visionDesc || visionColour || visionItem) {
        let base = visionDesc || "";
        const colour = visionColour || "";
        const item = visionItem || "";

        // If no explicit description but we have a colour, use that as a base.
        if (!base && colour) {
          base = colour;
        }

        let desc = (base || "").toString().trim();

        // 1) Remove item words from description so we don't repeat the item name.
        if (item && desc) {
          const itemWords = item
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
          let descWords = desc.split(/\s+/);
          descWords = descWords.filter(function (w) {
            return itemWords.indexOf(w.toLowerCase()) === -1;
          });
          desc = descWords.join(" ").trim();
        }

        // 2) Strip obvious background/location words (wall, floor, room, etc.).
        if (desc) {
          const backgroundWords = [
            "wall",
            "floor",
            "room",
            "door",
            "corner",
            "window",
            "garage",
            "garden",
            "drive",
            "street",
            "outside",
            "inside",
            "against",
            "leaning",
            "mounted",
            "stairs",
            "landing"
          ];
          let descWords = desc.split(/\s+/);
          descWords = descWords.filter(function (w) {
            return backgroundWords.indexOf(w.toLowerCase()) === -1;
          });
          desc = descWords.join(" ").trim();
        }

        // 3) Hard cap to max 4 words.
        if (desc) {
          desc = desc
            .split(/\s+/)
            .slice(0, 4)
            .join(" ");
        }

        // 4) If we stripped everything, fall back to colour only.
        if ((!desc || !desc.trim()) && colour) {
          desc = colour.toString().trim();
        }

        return desc;
      }

      // Fallback: text-only behaviour (for OCR-only / no vision cases).
      if (!hasText) return "";

      if (full.length > 140 || full.indexOf("\n") !== -1) {
        return full;
      }

      let desc = full;

      if (qtyMatch && qtyMatch[1]) {
        const reQty = new RegExp("\\b" + escapeRegex(qtyMatch[1]) + "\\b", "ig");
        desc = desc.replace(reQty, " ");
      }

      itemsFromText.forEach(function (it) {
        if (!it) return;
        const reItem = new RegExp("\\b" + escapeRegex(it) + "\\b", "ig");
        desc = desc.replace(reItem, " ");
      });

      if (locationFromText) {
        const reLoc = new RegExp(
          "\\b" + escapeRegex(locationFromText) + "\\b",
          "ig"
        );
        desc = desc.replace(reLoc, " ");
      }

      desc = desc
        .replace(/\b[xX]\b/g, " ")
        .replace(/[,:;()-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return desc || full;
    }

    function deriveItemType() {
      const lower = (full || "").toLowerCase();
      if (lower.indexOf("flat pack") !== -1 || lower.indexOf("flat-pack") !== -1) {
        return "flat-pack";
      }
      if (lower.indexOf("box") !== -1 || lower.indexOf("carton") !== -1) {
        return "box";
      }
      if (
        itemsFromText.length ||
        (visionItem &&
          ["chair", "sofa", "table", "desk", "wardrobe", "bed"].some(function (k) {
            return visionItem.toLowerCase().indexOf(k) !== -1;
          }))
      ) {
        return "furniture";
      }
      return "";
    }

    const descriptionText = buildDescription();
    const typeText = deriveItemType();

    const mappings = [];

    const targetForms = forms && forms.length ? forms : getTargetForms();

    const inputs = targetForms.reduce(function (acc, form) {
      return acc.concat(gatherInputs(form));
    }, []);

    const visibleInputs = inputs.filter(isFieldVisible);

    visibleInputs.forEach(function (el) {
      const meta = getMeta(el);
      const elType = meta.typeAttr || (meta.tag === "textarea" ? "textarea" : "text");
      const label =
        meta.label || meta.placeholder || meta.name || meta.id || "Field";
      let value = null;

      const hint = (meta.typeHint || "").toLowerCase();

      if (hint === "item") {
        if (visionItem) value = visionItem;
        else if (itemsFromText.length) value = itemsFromText[0];
      } else if (hint === "location") {
        if (locationFromText) value = locationFromText;
      } else if (hint === "qty" || hint === "quantity") {
        if (qtyMatch && qtyMatch[1]) value = qtyMatch[1];
      } else if (hint === "notes" || hint === "description") {
        if (descriptionText) value = descriptionText;
      } else if (hint === "type") {
        if (typeText) value = typeText;
      }

      if (!value && hasText) {
        const fieldStr =
          (meta.label || "") +
          " " +
          (meta.name || "") +
          " " +
          (meta.id || "") +
          " " +
          (meta.placeholder || "");
        const lowerField = fieldStr.toLowerCase();

        if (!value && (lowerField.indexOf("item") !== -1 || lowerField.indexOf("object") !== -1)) {
          if (visionItem) value = visionItem;
          else if (itemsFromText.length) value = itemsFromText[0];
        }

        if (!value && lowerField.indexOf("location") !== -1) {
          if (locationFromText) value = locationFromText;
        }

        if (!value && (lowerField.indexOf("qty") !== -1 || lowerField.indexOf("quantity") !== -1)) {
          if (qtyMatch && qtyMatch[1]) value = qtyMatch[1];
        }

        if (
          !value &&
          (lowerField.indexOf("description") !== -1 ||
            lowerField.indexOf("notes") !== -1 ||
            lowerField.indexOf("comment") !== -1)
        ) {
          if (descriptionText) value = descriptionText;
        }
      }

      if (!value) return;

      mappings.push({
        element: el,
        label: label,
        value: value,
        enabled: true,
        elType: elType
      });
    });

    return mappings;
  }

  function buildMappingsUi() {
    const body = getPanelBody();
    if (!body) return;

    const forms = getTargetForms();
    if (!forms || !forms.length) {
      body.innerHTML =
        '<div class="status"><strong>No form found.</strong> Make sure you are on a form page.</div>';
      return;
    }

    const mappings = buildMappings(
      forms,
      state.lastText || state.lastOriginalText || "",
      state.lastVision
    );
    state.mappings = mappings;

    const applyBtn = getPanel().querySelector('button[data-action="apply"]');
    const undoBtn = getPanel().querySelector('button[data-action="undo"]');

    if (!mappings || !mappings.length) {
      body.innerHTML = "";
      const msg = document.createElement("div");
      msg.className = "status";
      msg.innerHTML =
        "<strong>No obvious matches.</strong> You can copy the extracted text below.";
      const raw = document.createElement("div");
      raw.className = "raw-text";
      raw.innerHTML =
        '<div style="margin-bottom:4px;">Extracted text:</div><textarea readonly>' +
        (state.lastText || state.lastOriginalText || "") +
        "</textarea>";
      body.appendChild(msg);
      body.appendChild(raw);
      if (applyBtn) applyBtn.disabled = true;
      return;
    }

    const list = document.createElement("ul");
    list.className = "mapping-list";

    mappings.forEach(function (m, idx) {
      const li = document.createElement("li");
      li.className = "mapping-item";
      const id = "mapping-" + idx;
      li.innerHTML =
        '<label><input type="checkbox" id="' +
        id +
        '" checked />' +
        '<div><div class="field-label">' +
        escapeHtml(m.label) +
        "</div>" +
        '<div class="field-value">' +
        escapeHtml(String(m.value)) +
        "</div></div></label>";
      const cb = li.querySelector("input[type=checkbox]");
      cb.addEventListener("change", function () {
        m.enabled = !!cb.checked;
      });
      list.appendChild(li);
    });

    body.innerHTML = "";
    const status = document.createElement("div");
    status.className = "status";
    status.innerHTML =
      "<strong>Review matches.</strong> Uncheck any fields you don't want to fill.";
    body.appendChild(status);
    body.appendChild(list);

    const raw = document.createElement("div");
    raw.className = "raw-text";
    raw.innerHTML =
      '<div style="margin-bottom:4px;">Extracted text:</div><textarea readonly>' +
      (state.lastText || state.lastOriginalText || "") +
      "</textarea>";
    body.appendChild(raw);

    if (applyBtn) applyBtn.disabled = false;
    if (undoBtn) {
      undoBtn.disabled = !state.lastApplied;
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function onApplyClick() {
    const enabledMappings = (state.mappings || []).filter(function (m) {
      return m.enabled;
    });
    if (!enabledMappings.length) {
      closePanel();
      return;
    }

    state.lastApplied = enabledMappings.map(function (m) {
      return {
        element: m.element,
        previousValue: m.element.value,
        value: m.value
      };
    });

    enabledMappings.forEach(function (m) {
      if (m.elType === "textarea" || m.elType === "text") {
        setReactFriendlyValue(m.element, m.value);
      } else {
        setReactFriendlyValue(m.element, m.value);
      }
    });

    const undoBtn = getPanel().querySelector('button[data-action="undo"]');
    if (undoBtn) undoBtn.disabled = false;
    closePanel();
  }

  function onUndoClick() {
    if (!state.lastApplied || !state.lastApplied.length) return;

    state.lastApplied.forEach(function (m) {
      setReactFriendlyValue(m.element, m.previousValue);
    });

    state.lastApplied = null;
    const undoBtn = getPanel().querySelector('button[data-action="undo"]');
    if (undoBtn) undoBtn.disabled = true;
  }

  function init() {
    ensureUi();
    refreshForms();
    setupMutationObserver();

    window.addEventListener("scroll", onViewportChange, { passive: true });
    window.addEventListener("resize", onViewportChange, { passive: true });
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(init, 0);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
