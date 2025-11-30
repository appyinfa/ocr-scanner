(function () {
  if (typeof window === "undefined") return;
  if (window.__APPYCREW_OCR_WIDGET_INITED__) return;
  window.__APPYCREW_OCR_WIDGET_INITED__ = true;

  var PANEL_ID = "appycrew-ocr-panel";
  var FAB_ID = "appycrew-ocr-fab";

  var state = {
    apiBase: null,
    forms: [],
    activeForm: null,
    observer: null,
    mappings: [],
    lastApplied: null,
    selectedFile: null,
    lastOriginalText: "",
    lastText: "",
    lastVision: null,
    voiceData: null,
    isListening: false,
    speechRecognition: null,
    ui: null
  };

  // ---------- Utilities ----------

  function ready(fn) {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      setTimeout(fn, 0);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  function injectStyles() {
    if (document.getElementById(PANEL_ID + "-styles")) return;
    var css = `
#${FAB_ID} {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147480000;
  border-radius: 999px;
  padding: 10px 16px;
  border: none;
  background: #111827;
  color: #f9fafb;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.35);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Segoe UI", sans-serif;
}
#${FAB_ID}:hover {
  background: #020617;
}
#${FAB_ID} .ac-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;
}

#${PANEL_ID} {
  position: fixed;
  right: 16px;
  bottom: 72px;
  width: 340px;
  max-width: calc(100vw - 32px);
  background: #f9fafb;
  border-radius: 16px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.45);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Segoe UI", sans-serif;
  color: #0f172a;
  z-index: 2147480000;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
  transition: opacity 0.18s ease, transform 0.18s ease;
}
#${PANEL_ID}.ac-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

#${PANEL_ID} .ac-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #020617;
  color: #e5e7eb;
}
#${PANEL_ID} .ac-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
#${PANEL_ID} .ac-title-main {
  font-size: 14px;
  font-weight: 600;
}
#${PANEL_ID} .ac-title-sub {
  font-size: 11px;
  opacity: 0.85;
}
#${PANEL_ID} .ac-close {
  border: none;
  background: transparent;
  color: #e5e7eb;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}

#${PANEL_ID} .ac-body {
  padding: 10px 14px 12px;
  font-size: 12px;
}

#${PANEL_ID} .ac-status {
  font-size: 11px;
  margin-bottom: 8px;
  color: #4b5563;
}
#${PANEL_ID} .ac-status strong {
  font-weight: 600;
}
#${PANEL_ID} .ac-status.error {
  color: #b91c1c;
}

#${PANEL_ID} .ac-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
#${PANEL_ID} .ac-btn {
  border-radius: 999px;
  border: none;
  padding: 6px 10px;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
#${PANEL_ID} .ac-btn-primary {
  background: #111827;
  color: #f9fafb;
}
#${PANEL_ID} .ac-btn-primary:hover {
  background: #020617;
}
#${PANEL_ID} .ac-btn-ghost {
  background: rgba(15, 23, 42, 0.03);
  color: #111827;
}
#${PANEL_ID} .ac-btn-ghost:hover {
  background: rgba(15, 23, 42, 0.08);
}

/* Voice button always visible */
#${PANEL_ID} .ac-voice-btn {
  border-radius: 999px;
  border: none;
  padding: 6px 10px;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(15, 23, 42, 0.04);
  color: #0f172a;
}
#${PANEL_ID} .ac-voice-btn:hover {
  background: rgba(15, 23, 42, 0.08);
}
#${PANEL_ID} .ac-voice-btn[data-listening="true"] {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}
#${PANEL_ID} .ac-voice-btn svg {
  width: 14px;
  height: 14px;
}

#${PANEL_ID} .ac-mappings {
  max-height: 260px;
  overflow: auto;
  border-radius: 10px;
  background: #f3f4f6;
  padding: 6px 6px 4px;
  margin-bottom: 8px;
}
#${PANEL_ID} .ac-mappings-empty {
  font-size: 11px;
  color: #6b7280;
  padding: 4px 2px 2px;
}
#${PANEL_ID} .ac-map-row {
  background: #ffffff;
  border-radius: 8px;
  padding: 6px 7px;
  margin-bottom: 4px;
  display: flex;
  gap: 6px;
  align-items: flex-start;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
#${PANEL_ID} .ac-map-row:last-child {
  margin-bottom: 0;
}
#${PANEL_ID} .ac-map-check {
  margin-top: 3px;
}
#${PANEL_ID} .ac-map-main {
  flex: 1;
}
#${PANEL_ID} .ac-map-label {
  font-size: 11px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}
#${PANEL_ID} .ac-map-preview {
  font-size: 11px;
  color: #4b5563;
  word-break: break-word;
}

#${PANEL_ID} .ac-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}
#${PANEL_ID} .ac-footer-left {
  font-size: 10px;
  color: #9ca3af;
}
#${PANEL_ID} .ac-footer-actions {
  display: flex;
  gap: 6px;
}
#${PANEL_ID} .ac-btn-disabled {
  opacity: 0.5;
  cursor: default;
}
`;
    var style = document.createElement("style");
    style.id = PANEL_ID + "-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function detectApiBase() {
    if (state.apiBase) return state.apiBase;
    if (window.APPYCREW_OCR_API_BASE) {
      state.apiBase = String(window.APPYCREW_OCR_API_BASE).replace(/\/+$/, "");
      return state.apiBase;
    }
    state.apiBase = window.location.origin;
    return state.apiBase;
  }

  function isElementVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.bottom <= 0 || rect.top >= vh) return false;
    var height = rect.height || 0;
    if (!height) return true;
    var visibleTop = Math.max(rect.top, 0);
    var visibleBottom = Math.min(rect.bottom, vh);
    var visible = Math.max(0, visibleBottom - visibleTop);
    return visible / height >= 0.3;
  }

  function collectForms() {
    var forms = Array.prototype.slice.call(document.querySelectorAll("form"));
    state.forms = forms;
    state.activeForm = pickActiveForm(forms);
    updateFabVisibility();
  }

  function pickActiveForm(forms) {
    if (!forms || !forms.length) return null;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < forms.length; i++) {
      var f = forms[i];
      var rect = f.getBoundingClientRect();
      var height = rect.height || 0;
      if (height <= 0) continue;
      var visibleTop = Math.max(rect.top, 0);
      var visibleBottom = Math.min(rect.bottom, vh);
      var visible = Math.max(0, visibleBottom - visibleTop);
      var score = visible;
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return best;
  }

  function setupMutationObserver() {
    if (state.observer) return;
    var obs = new MutationObserver(function () {
      collectForms();
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true
    });
    state.observer = obs;
    window.addEventListener(
      "scroll",
      function () {
        collectForms();
      },
      { passive: true }
    );
    window.addEventListener(
      "resize",
      function () {
        collectForms();
      },
      { passive: true }
    );
  }

  // ---------- UI creation ----------

  function createFab() {
    if (document.getElementById(FAB_ID)) return;
    var btn = document.createElement("button");
    btn.id = FAB_ID;
    btn.type = "button";

    var dot = document.createElement("span");
    dot.className = "ac-dot";
    var label = document.createElement("span");
    label.textContent = "Scan with AppyCrew";

    btn.appendChild(dot);
    btn.appendChild(label);

    btn.addEventListener("click", function () {
      togglePanel();
    });

    document.body.appendChild(btn);
    updateFabVisibility();
  }

  function updateFabVisibility() {
    var fab = document.getElementById(FAB_ID);
    if (!fab) return;
    if (state.forms && state.forms.length) {
      fab.style.display = "flex";
    } else {
      fab.style.display = "none";
    }
  }

  function togglePanel(forceOpen) {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = createPanel();
    }
    var open = panel.classList.contains("ac-open");
    if (forceOpen === true) open = false; // will be toggled to open
    panel.classList.toggle("ac-open", !open);
  }

  function createPanel() {
    if (state.ui && state.ui.panel) return state.ui.panel;

    var panel = document.createElement("div");
    panel.id = PANEL_ID;

    var header = document.createElement("div");
    header.className = "ac-header";

    var titleWrap = document.createElement("div");
    titleWrap.className = "ac-title";
    var titleMain = document.createElement("div");
    titleMain.className = "ac-title-main";
    titleMain.textContent = "AppyCrew OCR";
    var titleSub = document.createElement("div");
    titleSub.className = "ac-title-sub";
    titleSub.textContent = "Scan or speak to fill this form";
    titleWrap.appendChild(titleMain);
    titleWrap.appendChild(titleSub);

    var closeBtn = document.createElement("button");
    closeBtn.className = "ac-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", function () {
      panel.classList.remove("ac-open");
    });

    header.appendChild(titleWrap);
    header.appendChild(closeBtn);

    var body = document.createElement("div");
    body.className = "ac-body";

    var status = document.createElement("div");
    status.className = "ac-status";
    status.textContent = "Ready. Take a photo or use Voice to fill the visible fields.";

    var actions = document.createElement("div");
    actions.className = "ac-actions";

    var clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "ac-btn ac-btn-ghost";
    clearBtn.textContent = "Clear";
    actions.appendChild(clearBtn);

    var voiceBtn = document.createElement("button");
    voiceBtn.type = "button";
    voiceBtn.className = "ac-btn ac-voice-btn";
    voiceBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zm-1 14.93V20h2v-2.07A7.001 7.001 0 0 0 19 11h-2a5 5 0 0 1-10 0H5a7.001 7.001 0 0 0 6 6.93z"></path></svg><span>Voice</span>';
    actions.appendChild(voiceBtn);

    var scanBtn = document.createElement("button");
    scanBtn.type = "button";
    scanBtn.className = "ac-btn ac-btn-primary";
    scanBtn.textContent = "Scan & match fields";
    actions.appendChild(scanBtn);

    var mappingsContainer = document.createElement("div");
    mappingsContainer.className = "ac-mappings";
    var mappingsEmpty = document.createElement("div");
    mappingsEmpty.className = "ac-mappings-empty";
    mappingsEmpty.textContent =
      "No matches yet. Scan an image or use Voice to see suggested fills.";
    mappingsContainer.appendChild(mappingsEmpty);

    var footer = document.createElement("div");
    footer.className = "ac-footer";
    var footerLeft = document.createElement("div");
    footerLeft.className = "ac-footer-left";
    footerLeft.textContent = "AppyCrew OCR · visible fields only";
    var footerActions = document.createElement("div");
    footerActions.className = "ac-footer-actions";

    var undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "ac-btn ac-btn-ghost ac-btn-disabled";
    undoBtn.textContent = "Undo";

    var applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "ac-btn ac-btn-primary ac-btn-disabled";
    applyBtn.textContent = "Apply";

    footerActions.appendChild(undoBtn);
    footerActions.appendChild(applyBtn);

    footer.appendChild(footerLeft);
    footer.appendChild(footerActions);

    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.capture = "environment";
    fileInput.style.display = "none";

    body.appendChild(status);
    body.appendChild(actions);
    body.appendChild(mappingsContainer);
    body.appendChild(footer);
    body.appendChild(fileInput);

    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(panel);

    // --- Wire up buttons ---

    clearBtn.addEventListener("click", function () {
      state.selectedFile = null;
      state.lastOriginalText = "";
      state.lastText = "";
      state.lastVision = null;
      state.voiceData = null;
      state.mappings = [];
      state.lastApplied = null;
      fileInput.value = "";
      mappingsContainer.innerHTML = "";
      var empty = document.createElement("div");
      empty.className = "ac-mappings-empty";
      empty.textContent =
        "Cleared. Scan again or use Voice to see matches.";
      mappingsContainer.appendChild(empty);
      status.classList.remove("error");
      status.textContent =
        "Cleared. Take a new photo or speak again to fill the form.";
      undoBtn.classList.add("ac-btn-disabled");
      applyBtn.classList.add("ac-btn-disabled");
    });

    voiceBtn.addEventListener("click", function () {
      startVoiceInput({
        statusEl: status,
        mappingsContainer: mappingsContainer,
        voiceBtn: voiceBtn,
        undoBtn: undoBtn,
        applyBtn: applyBtn
      });
    });

    scanBtn.addEventListener("click", function () {
      if (!state.activeForm) {
        status.classList.add("error");
        status.textContent =
          "No form detected in view. Scroll to a form and try again.";
        return;
      }
      fileInput.click();
    });

    fileInput.addEventListener("change", function (e) {
      var file =
        (e.target && e.target.files && e.target.files[0]) || null;
      if (!file) return;
      handleImageFile(file, status, mappingsContainer, undoBtn, applyBtn);
    });

    undoBtn.addEventListener("click", function () {
      if (!state.lastApplied || !state.lastApplied.length) return;
      restoreLastApplied();
      undoBtn.classList.add("ac-btn-disabled");
      status.classList.remove("error");
      status.textContent = "Reverted to previous values.";
    });

    applyBtn.addEventListener("click", function () {
      if (!state.mappings || !state.mappings.length) return;
      var selected = state.mappings.filter(function (m) {
        return m.checked !== false;
      });
      if (!selected.length) return;
      applyMappings(selected);
      undoBtn.classList.remove("ac-btn-disabled");
      status.classList.remove("error");
      status.textContent = "Applied to form.";
    });

    state.ui = {
      panel: panel,
      status: status,
      mappingsContainer: mappingsContainer,
      clearBtn: clearBtn,
      voiceBtn: voiceBtn,
      scanBtn: scanBtn,
      undoBtn: undoBtn,
      applyBtn: applyBtn,
      fileInput: fileInput
    };

    return panel;
  }

  // ---------- Voice helpers ----------

  function parseVoiceTranscriptToParts(transcript) {
    if (!transcript) {
      return { item: "", description: "", location: "", notes: "" };
    }
    var raw = String(transcript).trim();
    var parts = raw
      .split(/[;,]/)
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean);

    var item = parts[0] || "";
    var description = parts[1] || "";
    var location = parts[2] || "";
    var notes = parts.slice(3).join(", ").trim();

    return {
      item: item,
      description: description,
      location: location,
      notes: notes
    };
  }

  function translateVoiceToEnglish(text) {
    // Optional server-side translation via /api/voice-translate
    if (!text) return Promise.resolve(text);
    var endpoint = "/api/voice-translate";
    return fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: text })
    })
      .then(function (res) {
        if (!res.ok) return text;
        return res.json();
      })
      .then(function (data) {
        if (data && typeof data.text === "string" && data.text.trim()) {
          return data.text;
        }
        return text;
      })
      .catch(function () {
        return text;
      });
  }

  function startVoiceInput(opts) {
    var statusEl = opts && opts.statusEl;
    var mappingsContainer = opts && opts.mappingsContainer;
    var voiceBtn = opts && opts.voiceBtn;
    var undoBtn = opts && opts.undoBtn;
    var applyBtn = opts && opts.applyBtn;

    if (!state.activeForm) {
      if (statusEl) {
        statusEl.classList.add("error");
        statusEl.textContent =
          "No form detected in view. Scroll to a form and try again.";
      }
      return;
    }

    var SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (statusEl) {
        statusEl.classList.add("error");
        statusEl.textContent =
          "Voice input is not supported in this browser.";
      }
      return;
    }

    if (state.isListening && state.speechRecognition) {
      try {
        state.speechRecognition.stop();
      } catch (e) {}
      state.isListening = false;
      if (voiceBtn) voiceBtn.setAttribute("data-listening", "false");
      if (statusEl) {
        statusEl.classList.remove("error");
        statusEl.textContent = "Stopped listening.";
      }
      return;
    }

    var rec = new SpeechRecognition();
    rec.lang = window.APPYCREW_VOICE_LANG || "en-GB";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = function () {
      state.isListening = true;
      state.speechRecognition = rec;
      if (statusEl) {
        statusEl.classList.remove("error");
        statusEl.textContent =
          "Listening… say: 'Wardrobe, oak, master bedroom, left door loose, customer aware'.";
      }
      if (voiceBtn) voiceBtn.setAttribute("data-listening", "true");
    };

    rec.onerror = function (event) {
      state.isListening = false;
      if (voiceBtn) voiceBtn.setAttribute("data-listening", "false");
      if (statusEl) {
        statusEl.classList.add("error");
        statusEl.textContent =
          "Voice error: " +
          (event && event.error
            ? event.error
            : "please try again or speak clearly.");
      }
    };

    rec.onend = function () {
      state.isListening = false;
      if (voiceBtn) voiceBtn.setAttribute("data-listening", "false");
      if (!state.voiceData && statusEl) {
        statusEl.textContent = "No voice captured. Tap Voice to try again.";
      }
    };

    rec.onresult = function (event) {
      var res =
        event &&
        event.results &&
        event.results[0] &&
        event.results[0][0];
      var transcript = res && res.transcript ? res.transcript : "";
      if (!transcript) {
        if (statusEl) {
          statusEl.classList.add("error");
          statusEl.textContent = "Didn't catch that. Please try again.";
        }
        return;
      }

      // Translate transcript to English (server-side) then parse & map
      translateVoiceToEnglish(transcript).then(function (translated) {
        var parts = parseVoiceTranscriptToParts(translated);
        state.voiceData = {
          item: parts.item,
          description: parts.description,
          location: parts.location,
          notes: parts.notes,
          transcriptRaw: transcript,
          transcriptEn: translated
        };

        state.lastOriginalText = translated;
        state.lastText = translated;
        state.lastVision = null;

        if (!state.activeForm) {
          if (statusEl) {
            statusEl.classList.add("error");
            statusEl.textContent = "No form in view to fill.";
          }
          return;
        }

        if (mappingsContainer) {
          mappingsContainer.innerHTML = "";
        }

        var mappings = buildMappingsForActiveForm(translated, null);
        state.mappings = mappings;

        if (!mappings || !mappings.length) {
          if (statusEl) {
            statusEl.classList.remove("error");
            statusEl.textContent =
              'Heard: "' +
              translated +
              '". No automatic matches – text is available below.';
          }
          renderMappings(mappingsContainer, []);
          applyBtn.classList.add("ac-btn-disabled");
          undoBtn.classList.add("ac-btn-disabled");
          return;
        }

        if (statusEl) {
          statusEl.classList.remove("error");
          statusEl.textContent =
            'Heard: "' +
            translated +
            '". Review matches and tap Apply to fill the form.';
        }

        renderMappings(mappingsContainer, mappings);
        applyBtn.classList.remove("ac-btn-disabled");
        undoBtn.classList.add("ac-btn-disabled");
      });
    };

    try {
      rec.start();
    } catch (e) {
      if (statusEl) {
        statusEl.classList.add("error");
        statusEl.textContent =
          "Could not start voice input. Please try again.";
      }
    }
  }

  // ---------- OCR image handling ----------

  function handleImageFile(file, status, mappingsContainer, undoBtn, applyBtn) {
    if (!file) return;
    if (!state.activeForm) {
      status.classList.add("error");
      status.textContent =
        "No form detected in view. Scroll to a form and try again.";
      return;
    }
    status.classList.remove("error");
    status.textContent = "Image captured. Running OCR / AI…";

    var reader = new FileReader();
    reader.onload = function (ev) {
      var base64 = ev.target && ev.target.result;
      if (!base64) {
        status.classList.add("error");
        status.textContent =
          "Could not read the image. Please try again.";
        return;
      }
      state.selectedFile = file;
      callOcrApi(base64)
        .then(function (data) {
          if (!data || !data.success) {
            status.classList.add("error");
            status.textContent =
              (data && data.error) ||
              "Could not run OCR / AI. Please try again.";
            return;
          }

          state.lastOriginalText = data.text || "";
          state.lastText = data.text || "";
          state.lastVision = data.vision || null;
          state.voiceData = null;

          var mappings = buildMappingsForActiveForm(
            data.text || "",
            data.vision || null
          );
          state.mappings = mappings || [];

          if (!mappings || !mappings.length) {
            mappingsContainer.innerHTML = "";
            var empty = document.createElement("div");
            empty.className = "ac-mappings-empty";
            empty.textContent =
              "OCR ran successfully but no obvious matches were found. You can still copy text from the app if needed.";
            mappingsContainer.appendChild(empty);
            status.classList.remove("error");
            status.textContent =
              "OCR complete, but no automatic matches. Check the form manually.";
            applyBtn.classList.add("ac-btn-disabled");
            undoBtn.classList.add("ac-btn-disabled");
            return;
          }

          status.classList.remove("error");
          status.textContent =
            "OCR complete. Review the suggested matches and tap Apply to fill the form.";
          renderMappings(mappingsContainer, mappings);
          applyBtn.classList.remove("ac-btn-disabled");
          undoBtn.classList.add("ac-btn-disabled");
        })
        .catch(function (err) {
          console.error("AppyCrew OCR fetch error:", err);
          status.classList.add("error");
          status.textContent =
            "Error calling OCR API. Please check your connection and try again.";
        });
    };
    reader.onerror = function () {
      status.classList.add("error");
      status.textContent = "Could not read the image. Please try again.";
    };
    reader.readAsDataURL(file);
  }

  function callOcrApi(imageBase64) {
    var base = detectApiBase();
    var url = base + "/api/ocr";
    var formType = detectFormType();
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        imageBase64: imageBase64,
        formType: formType || null
      })
    }).then(function (res) {
      return res.json();
    });
  }

  function detectFormType() {
    if (!state.activeForm) return null;
    var t =
      state.activeForm.getAttribute("data-appycrew-form-type") || "";
    return t || null;
  }

  // ---------- Mapping logic ----------

  var LOCATION_KEYWORDS = [
    "Kitchen",
    "Dining Room",
    "lounge",
    "living Room",
    "living room",
    "Hall",
    "Hallway",
    "Landing",
    "Stairs",
    "Bedroom",
    "Master Bedroom",
    "MBR",
    "Main Bedroom",
    "Guest Bedroom",
    "Bathroom",
    "Ensuite",
    "Office",
    "Study",
    "Garage",
    "Loft",
    "Attic",
    "Garden",
    "Shed",
    "Storage",
    "Store",
    "Cupboard"
  ];

  function normaliseLocationWord(w) {
    var lw = w.toLowerCase();
    if (lw === "mbr") return "master bedroom";
    if (lw === "bedrm" || lw === "bed") return "bedroom";
    return lw;
  }

  function extractLocationFromText(text) {
    if (!text) return "";
    var lower = text.toLowerCase();
    for (var i = 0; i < LOCATION_KEYWORDS.length; i++) {
      var key = LOCATION_KEYWORDS[i];
      if (lower.indexOf(key) !== -1) {
        return key;
      }
    }
    return "";
  }

  var ITEM_KEYWORDS = [
    "wardrobe",
    "sofa",
    "couch",
    "table",
    "dining table",
    "chair",
    "desk",
    "bed",
    "mattress",
    "headboard",
    "chest",
    "drawers",
    "chest of drawers",
    "sideboard",
    "cabinet",
    "cupboard",
    "bookcase",
    "shelf",
    "shelving",
    "tv",
    "television",
    "picture",
    "painting",
    "mirror",
    "lamp",
    "box",
    "carton",
    "crate",
    "ladder",
    "bicycle",
    "bike"
  ];

  function findItemsFromText(text) {
    if (!text) return [];
    var lower = text.toLowerCase();
    var found = [];
    for (var i = 0; i < ITEM_KEYWORDS.length; i++) {
      var it = ITEM_KEYWORDS[i];
      if (lower.indexOf(it) !== -1 && found.indexOf(it) === -1) {
        found.push(it);
      }
    }
    return found;
  }

  function extractQty(text) {
    if (!text) return null;
    var m = text.match(/\b(\d{1,3})\s*(x|pcs?|pieces?)?\b/i);
    if (!m) return null;
    return m[1];
  }

  function buildDescription(text, vision, item, location, qty) {
    var visionDesc =
      (vision && vision.description) || (vision && vision.itemDescription);
    var visionColour = vision && (vision.colour || vision.color);
    var visionItem = (vision && vision.item) || item || "";

    if (visionDesc || visionColour || visionItem) {
      var base = visionDesc || "";
      var colour = visionColour || "";
      var itemWord = visionItem || "";
      if (!base && colour) base = colour;

      var desc = (base || "").toString().trim();

      if (itemWord && desc) {
        var itemWords = itemWord
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        var descWords = desc.split(/\s+/);
        descWords = descWords.filter(function (w) {
          return itemWords.indexOf(w.toLowerCase()) === -1;
        });
        desc = descWords.join(" ").trim();
      }

      if (desc) {
        var background = [
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
        var words = desc.split(/\s+/);
        words = words.filter(function (w) {
          return background.indexOf(w.toLowerCase()) === -1;
        });
        desc = words.join(" ").trim();
      }

      if (desc) {
        desc = desc
          .split(/\s+/)
          .slice(0, 4)
          .join(" ");
      }

      if ((!desc || !desc.trim()) && colour) {
        desc = colour.toString().trim();
      }

      return desc || "";
    }

    if (!text) return "";
    if (text.length > 140 || text.indexOf("\n") !== -1) {
      return text;
    }

    var descText = text;
    if (qty) {
      var reQty = new RegExp("\\b" + qty + "\\b", "ig");
      descText = descText.replace(reQty, " ");
    }
    if (item) {
      var reItem = new RegExp(
        "\\b" + escapeRegex(item) + "\\b",
        "ig"
      );
      descText = descText.replace(reItem, " ");
    }
    if (location) {
      var reLoc = new RegExp(
        "\\b" + escapeRegex(location) + "\\b",
        "ig"
      );
      descText = descText.replace(reLoc, " ");
    }
    descText = descText
      .replace(/\b[xX]\b/g, " ")
      .replace(/[,:;()-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return descText || text;
  }

  function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildMappingsForActiveForm(text, vision) {
    if (!state.activeForm) return [];
    var form = state.activeForm;

    var voice = state.voiceData || null;
    var lowerText = (text || "").toLowerCase();
    var items = findItemsFromText(text || "");
    var locationFromText = extractLocationFromText(text || "");
    var qty = extractQty(text || "");
    var mainItem =
      (voice && voice.item) ||
      (items && items.length ? items[0] : "") ||
      (vision && vision.item) ||
      "";
    var mainLoc =
      (voice && voice.location) || locationFromText || "";
    var description = buildDescription(
      text || "",
      vision,
      mainItem,
      mainLoc,
      qty
    );
    var notes = voice && voice.notes ? voice.notes : "";

    var fields = getCandidateFields(form);
    var mappings = [];

    for (var i = 0; i < fields.length; i++) {
      var meta = fields[i];
      var val = chooseValueForField(
        meta,
        {
          text: text || "",
          lowerText: lowerText,
          mainItem: mainItem,
          mainLoc: mainLoc,
          qty: qty,
          description: description,
          notes: notes
        },
        voice
      );
      if (!val && val !== 0) continue;
      var preview = String(val).trim();
      if (!preview) continue;
      mappings.push({
        el: meta.el,
        label: meta.label,
        typeHint: meta.typeHint,
        value: preview,
        checked: true
      });
    }

    return mappings;
  }

  function getCandidateFields(form) {
    var els = Array.prototype.slice.call(
      form.querySelectorAll("input, textarea, select")
    );
    var out = [];
    var seen = new Set();

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!isElementVisible(el)) continue;
      if (el.disabled) continue;
      if (el.type === "hidden") continue;

      var key = el.tagName + ":" + (el.name || el.id || i);
      if (seen.has(key)) continue;
      seen.add(key);

      var meta = buildFieldMeta(el);
      out.push(meta);
    }

    return out;
  }

  function buildFieldMeta(el) {
    var labelText = "";
    var id = el.id;
    if (id) {
      var lab = document.querySelector('label[for="' + id + '"]');
      if (lab && lab.textContent) {
        labelText = lab.textContent.trim();
      }
    }
    if (!labelText) {
      var p = el.parentElement;
      if (p && p.tagName.toLowerCase() === "label") {
        labelText = p.textContent.trim();
      }
    }
    if (!labelText) {
      var prev = el.previousElementSibling;
      if (
        prev &&
        prev.tagName.toLowerCase() === "label" &&
        prev.textContent
      ) {
        labelText = prev.textContent.trim();
      }
    }

    var placeholder =
      (el.getAttribute("placeholder") || "").trim();
    var dataLabel =
      (el.getAttribute("data-label") || "").trim();
    var allLabel = [labelText, placeholder, dataLabel]
      .filter(Boolean)
      .join(" / ");

    var typeHint = el.getAttribute("data-appycrew-type") || "";
    typeHint = typeHint.trim().toLowerCase();

    return {
      el: el,
      label: allLabel || el.name || el.id || "Field",
      labelLower: (allLabel || "")
        .toString()
        .toLowerCase(),
      typeHint: typeHint
    };
  }

  function chooseValueForField(meta, ctx, voice) {
    var label = meta.labelLower || "";
    var hint = meta.typeHint || "";

    // Priority 1: explicit hints
    if (hint === "item") {
      if (voice && voice.item) return voice.item;
      if (ctx.mainItem) return ctx.mainItem;
      return "";
    }
    if (hint === "location") {
      if (voice && voice.location) return voice.location;
      if (ctx.mainLoc) return ctx.mainLoc;
      return "";
    }
    if (hint === "qty" || hint === "quantity") {
      if (ctx.qty) return ctx.qty;
      return "";
    }
    if (hint === "description") {
      if (voice && voice.description) return voice.description;
      if (ctx.description) return ctx.description;
      return "";
    }
    if (hint === "notes") {
      if (voice && voice.notes) return voice.notes;
      return ctx.text || "";
    }
    if (hint === "name") {
      var lines = (ctx.text || "").split(/\r?\n/);
      var first = (lines[0] || "").trim();
      var second = (lines[1] || "").trim();
      return first || second || "";
    }
    if (hint === "job-id" || hint === "id") {
      var m = ctx.text.match(/\b[A-Z0-9\-]{4,}\b/i);
      return (m && m[0]) || "";
    }

    // Priority 2: label-based heuristics
    if (label.indexOf("item") !== -1) {
      if (voice && voice.item) return voice.item;
      if (ctx.mainItem) return ctx.mainItem;
    }
    if (
      label.indexOf("location") !== -1 ||
      label.indexOf("room") !== -1 ||
      label.indexOf("site") !== -1
    ) {
      if (voice && voice.location) return voice.location;
      if (ctx.mainLoc) return ctx.mainLoc;
    }
    if (
      label.indexOf("qty") !== -1 ||
      label.indexOf("quantity") !== -1 ||
      label.indexOf("no of") !== -1
    ) {
      if (ctx.qty) return ctx.qty;
    }
    if (
      label.indexOf("description") !== -1 ||
      label.indexOf("details") !== -1
    ) {
      if (voice && voice.description) return voice.description;
      if (ctx.description) return ctx.description;
    }
    if (
      label.indexOf("notes") !== -1 ||
      label.indexOf("additional") !== -1
    ) {
      if (voice && voice.notes) return voice.notes;
      return ctx.text || "";
    }
    if (
      label.indexOf("client") !== -1 ||
      label.indexOf("customer") !== -1
    ) {
      var lineClient = findLineAfterLabel(ctx.text, [
        "client",
        "customer"
      ]);
      return lineClient;
    }
    if (
      label.indexOf("surveyor") !== -1 ||
      label.indexOf("estimator") !== -1
    ) {
      var lineSurveyor = findLineAfterLabel(ctx.text, [
        "surveyor",
        "estimator"
      ]);
      return lineSurveyor;
    }
    if (
      label.indexOf("driver") !== -1 ||
      label.indexOf("porter") !== -1
    ) {
      var lineDriver = findLineAfterLabel(ctx.text, ["driver"]);
      return lineDriver;
    }
    if (
      label.indexOf("job") !== -1 ||
      label.indexOf("reference") !== -1
    ) {
      var m2 = ctx.text.match(/\b[A-Z0-9\-]{4,}\b/i);
      return (m2 && m2[0]) || "";
    }

    // Fallback: nothing
    return "";
  }

  function findLineAfterLabel(text, labels) {
    if (!text) return "";
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var lower = lines[i].toLowerCase();
      for (var j = 0; j < labels.length; j++) {
        if (lower.indexOf(labels[j]) !== -1) {
          var next = (lines[i + 1] || "").trim();
          if (next) return next;
        }
      }
    }
    return "";
  }

  // ---------- Apply / Undo ----------

  function renderMappings(container, mappings) {
    if (!container) return;
    container.innerHTML = "";

    if (!mappings || !mappings.length) {
      var empty = document.createElement("div");
      empty.className = "ac-mappings-empty";
      empty.textContent =
        "No automatic matches. Scan again or adjust the photo / voice input.";
      container.appendChild(empty);
      return;
    }

    for (var i = 0; i < mappings.length; i++) {
      (function (m) {
        var row = document.createElement("div");
        row.className = "ac-map-row";

        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "ac-map-check";
        checkbox.checked = m.checked !== false;
        checkbox.addEventListener("change", function () {
          m.checked = checkbox.checked;
        });

        var main = document.createElement("div");
        main.className = "ac-map-main";

        var lab = document.createElement("div");
        lab.className = "ac-map-label";
        lab.textContent = m.label;

        var preview = document.createElement("div");
        preview.className = "ac-map-preview";
        preview.textContent = m.value;

        main.appendChild(lab);
        main.appendChild(preview);

        row.appendChild(checkbox);
        row.appendChild(main);

        container.appendChild(row);
      })(mappings[i]);
    }
  }

  function snapshotCurrentValues(mappings) {
    var out = [];
    for (var i = 0; i < mappings.length; i++) {
      var el = mappings[i].el;
      if (!el) continue;
      out.push({
        el: el,
        value: readElementValue(el)
      });
    }
    state.lastApplied = out;
  }

  function restoreLastApplied() {
    if (!state.lastApplied) return;
    for (var i = 0; i < state.lastApplied.length; i++) {
      var item = state.lastApplied[i];
      if (!item.el) continue;
      writeElementValue(item.el, item.value);
    }
  }

  function applyMappings(mappings) {
    if (!mappings || !mappings.length) return;
    snapshotCurrentValues(mappings);

    for (var i = 0; i < mappings.length; i++) {
      var m = mappings[i];
      if (!m.el) continue;
      writeElementValue(m.el, m.value);
    }
  }

  function readElementValue(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === "select") {
      return el.value;
    }
    if (tag === "input" && el.type === "radio") {
      return el.checked;
    }
    return el.value;
  }

  function writeElementValue(el, value) {
    var tag = el.tagName.toLowerCase();

    if (tag === "select") {
      var bestOption = null;
      var bestScore = -1;
      for (var i = 0; i < el.options.length; i++) {
        var opt = el.options[i];
        var score = 0;
        var v = (opt.value || "").toLowerCase();
        var t = (opt.text || "").toLowerCase();
        var want = String(value).toLowerCase();
        if (v === want || t === want) score = 3;
        else if (v.indexOf(want) !== -1 || t.indexOf(want) !== -1)
          score = 2;
        else if (want.indexOf(t) !== -1 || want.indexOf(v) !== -1)
          score = 1;
        if (score > bestScore) {
          bestScore = score;
          bestOption = opt;
        }
      }
      if (bestOption) {
        el.value = bestOption.value;
        el.dispatchEvent(
          new Event("input", { bubbles: true })
        );
        el.dispatchEvent(
          new Event("change", { bubbles: true })
        );
      }
      return;
    }

    if (tag === "input" && el.type === "radio") {
      el.checked = !!value;
      el.dispatchEvent(
        new Event("input", { bubbles: true })
      );
      el.dispatchEvent(
        new Event("change", { bubbles: true })
      );
      return;
    }

    var proto =
      Object.getOwnPropertyDescriptor(el.__proto__, "value") ||
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      ) ||
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      );

    if (proto && proto.set) {
      proto.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ---------- Boot ----------

  ready(function () {
    injectStyles();
    collectForms();
    setupMutationObserver();
    createFab();
  });
})();
