(function () {
  const BUTTON_ID = "appycrew-ocr-button";
  const PANEL_ID = "appycrew-ocr-panel";
  const STYLE_ID = "appycrew-ocr-styles";

  const state = {
    apiBase: null,
    selectedFile: null,
    lastText: "",
    lastVision: null,
    mappings: []
  };

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

  function createButton(forms) {
    if (document.getElementById(BUTTON_ID)) return;
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.innerHTML = '<span class="dot"></span><span>Scan with AppyCrew</span>';
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      togglePanel(forms);
    });
    document.body.appendChild(btn);
  }

  function togglePanel(forms) {
    let panel = document.getElementById(PANEL_ID);
    if (panel) {
      const isOpen = panel.getAttribute("data-open") === "true";
      panel.setAttribute("data-open", isOpen ? "false" : "true");
      return;
    }
    createPanel(forms);
  }

  function createPanel(forms) {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.setAttribute("data-open", "true");

    const header = document.createElement("div");
    header.className = "ac-header";

    const title = document.createElement("div");
    title.className = "ac-title";
    title.innerHTML =
      'AppyCrew Scan <span>OCR + image recognition to auto-fill this form</span>';

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
    label.textContent = "1. Take a photo of the item, document, or notes";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.capture = "environment";
    fileInput.addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      state.selectedFile = file || null;
    });

    rowFile.appendChild(label);
    rowFile.appendChild(fileInput);

    const status = document.createElement("div");
    status.className = "ac-status";
    status.textContent = "No image selected yet.";

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
      state.lastText = "";
      state.lastVision = null;
      state.mappings = [];
      fileInput.value = "";
      mappingsContainer.innerHTML = "";
      mappingsContainer.style.display = "none";
      status.textContent = "Cleared. Select another image to scan.";
      status.classList.remove("error");
    });

    const scanBtn = document.createElement("button");
    scanBtn.type = "button";
    scanBtn.className = "ac-btn ac-btn-primary";
    scanBtn.textContent = "Scan & match fields";

    scanBtn.addEventListener("click", function () {
      if (!state.selectedFile) {
        status.textContent = "Please choose an image first.";
        status.classList.add("error");
        return;
      }
      status.classList.remove("error");
      runScan(forms, status, mappingsContainer, scanBtn);
    });

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
  }

  // Compress image on the client to stay within Vercel limits
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
    state.lastText = text || "";
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

    const hasText = text && text.trim();
    const lines = hasText
      ? text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean)
      : [];
    const full = lines.join("\n");

    const emailMatch = hasText ? full.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) : null;
    const phoneMatch = hasText ? full.replace(/\s+/g, "").match(/(\+?\d{7,15})/) : null;
    const postcodeMatch = hasText ? full.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i) : null;

    const firstLine = lines[0] || "";
    const secondLine = lines[1] || "";

    function getMeta(el) {
      const id = el.id || "";
      const name = el.name || "";
      const placeholder = el.placeholder || "";
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
      return { id, name, placeholder, label: labelText };
    }

    function candidateValue(meta, elType) {
      const str = (
        (meta.label || "") + " " +
        (meta.name || "") + " " +
        (meta.id || "") + " " +
        (meta.placeholder || "")
      ).toLowerCase();

      const visionItem = vision && (vision.item || vision.itemName || vision.object || "");
      const visionColour = vision && (vision.colour || vision.color || "");
      const visionDesc = vision && vision.description;

      // Inventory-style mappings first (vision)
      if (visionItem && str.indexOf("item") !== -1) {
        return visionItem;
      }
      if (visionColour && (str.indexOf("colour") !== -1 || str.indexOf("color") !== -1)) {
        return visionColour;
      }
      if (str.indexOf("description") !== -1 || str.indexOf("notes") !== -1 || str.indexOf("job") !== -1) {
        if (visionDesc) return visionDesc;
        if (visionItem || visionColour) {
          const parts = [];
          if (visionColour) parts.push(visionColour);
          if (visionItem) parts.push(visionItem);
          if (parts.length) return parts.join(" ");
        }
        return full || "";
      }
      if (str.indexOf("qty") !== -1 || str.indexOf("quantity") !== -1) {
        if (hasText) {
          const qtyMatch = full.match(/\b(\d{1,3})\b/);
          if (qtyMatch) return qtyMatch[1];
        }
      }
      if (str.indexOf("location") !== -1 || str.indexOf("room") !== -1) {
        return lines.slice(0, 3).join(" ");
      }

      // Generic text OCR mappings
      if (!hasText) return "";

      if (str.indexOf("email") !== -1) {
        return emailMatch && emailMatch[0];
      }
      if (str.indexOf("phone") !== -1 || str.indexOf("mobile") !== -1 || str.indexOf("tel") !== -1) {
        return phoneMatch && phoneMatch[0];
      }
      if (str.indexOf("postcode") !== -1 || str.indexOf("zip") !== -1) {
        return postcodeMatch && postcodeMatch[0];
      }
      if (str.indexOf("name") !== -1) {
        return firstLine || secondLine || "";
      }
      if (str.indexOf("company") !== -1 || str.indexOf("business") !== -1 || str.indexOf("organisation") !== -1) {
        return firstLine || "";
      }
      if (str.indexOf("address") !== -1 || str.indexOf("street") !== -1) {
        return (lines.slice(1, 4).join(", ")) || full;
      }
      if (str.indexOf("notes") !== -1 || str.indexOf("description") !== -1 || str.indexOf("comments") !== -1) {
        return full;
      }

      return "";
    }

    allInputs.forEach(function (el) {
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || (tag === "textarea" ? "textarea" : "text")).toLowerCase();
      if (["hidden", "submit", "button", "checkbox", "radio", "file"].indexOf(type) !== -1) {
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
      raw.value = state.lastText || "";
      container.appendChild(msg);
      container.appendChild(raw);

      if (state.lastVision && (state.lastVision.item || state.lastVision.description)) {
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
    applyRow.style.justifyContent = "flex-end";

    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "ac-btn ac-btn-primary";
    applyBtn.textContent = "Apply to form";

    applyBtn.addEventListener("click", function () {
      mappings.forEach(function (m) {
        if (!m.enabled) return;
        try {
          if (m.element.tagName.toLowerCase() === "select") {
            m.element.value = m.value;
            const event = new Event("change", { bubbles: true });
            m.element.dispatchEvent(event);
          } else {
            m.element.value = m.value;
            const event = new Event("input", { bubbles: true });
            m.element.dispatchEvent(event);
          }
        } catch (err) {
          // ignore
        }
      });
      applyBtn.textContent = "Applied!";
      setTimeout(function () {
        applyBtn.textContent = "Apply again";
      }, 1500);
    });

    applyRow.appendChild(applyBtn);
    container.appendChild(applyRow);
  }

  async function runScan(forms, statusEl, mappingsContainer, scanBtn) {
    try {
      scanBtn.disabled = true;
      statusEl.classList.remove("error");
      statusEl.textContent = "Reading image and sending to AppyCrew OCR + AI...";

      const dataUrl = await fileToDataUrlCompressed(state.selectedFile);
      statusEl.textContent = "Processing OCR & vision...";

      const result = await callOcrApi(dataUrl);
      const text = (result && result.text) || "";
      const vision = (result && result.vision) || null;

      if (!text.trim() && !vision) {
        statusEl.textContent = "No text or items detected. Try a clearer photo.";
        statusEl.classList.add("error");
        mappingsContainer.innerHTML = "";
        mappingsContainer.style.display = "none";
        return;
      }

      const mappings = buildMappings(forms, text, vision);
      state.mappings = mappings;

      if (mappings.length) {
        statusEl.textContent =
          "Review the matches below (OCR + AI), then click “Apply to form”.";
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
      scanBtn.disabled = false;
    }
  }

  function init() {
    try {
      const forms = Array.prototype.slice.call(document.forms);
      if (!forms.length) {
        log("No forms found on page – widget stays hidden.");
        return;
      }
      injectStyles();
      detectApiBase();
      createButton(forms);
    } catch (err) {
      log("Failed to initialize widget", err);
    }
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(init, 0);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();