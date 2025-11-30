/**
 * AppyCrew OCR Widget v10 - Enhanced Edition
 * Complete integration of all improvements:
 * - Smart field mapping with semantic similarity
 * - Modern UI with speed dial FAB
 * - Toast notifications
 * - Context-aware extraction
 * - Fuzzy matching & confidence scoring
 * - Progressive workflow
 * - Keyboard shortcuts
 * - Smart auto-hide
 * - Mobile-optimized
 */

(function () {
  if (typeof window === "undefined") return;
  if (window.__APPYCREW_OCR_WIDGET_INITED__) return;
  window.__APPYCREW_OCR_WIDGET_INITED__ = true;

  const PANEL_ID = "appycrew-ocr-panel";
  const FAB_ID = "appycrew-ocr-fab";
  const TOAST_CONTAINER_ID = "appycrew-toast-container";

  const state = {
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
    ui: null,
    fieldClassifier: {
      trainingData: [],
      learn: function(fieldLabel, fieldType, correctValue) {
        this.trainingData.push({
          fieldLabel: fieldLabel.toLowerCase(),
          fieldType: fieldType || 'text',
          correctValue: String(correctValue).toLowerCase(),
          timestamp: Date.now()
        });
        if (this.trainingData.length % 5 === 0) {
          this.save();
        }
      },
      save: function() {
        try {
          localStorage.setItem('appycrew_field_classifier', 
            JSON.stringify(this.trainingData.slice(-100))
          );
        } catch (e) {
          console.warn('Could not save field classifier:', e);
        }
      },
      load: function() {
        try {
          const saved = localStorage.getItem('appycrew_field_classifier');
          if (saved) {
            this.trainingData = JSON.parse(saved);
          }
        } catch (e) {
          console.warn('Could not load field classifier:', e);
        }
      }
    }
  };

  // ========== UTILITIES ==========

  function ready(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(fn, 0);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
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

  // Levenshtein distance for fuzzy matching
  function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  // Semantic similarity (Jaccard)
  function semanticSimilarity(text1, text2) {
    const tokens1 = new Set(text1.toLowerCase().split(/\W+/).filter(Boolean));
    const tokens2 = new Set(text2.toLowerCase().split(/\W+/).filter(Boolean));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return intersection.size / (union.size || 1);
  }

  // Fuzzy match against keywords
  function fuzzyMatch(text, keywords, threshold = 2) {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);
    
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return keyword;
      
      for (const word of words) {
        if (levenshtein(word, keyword) <= threshold) {
          return keyword;
        }
      }
    }
    return null;
  }

  // Image compression
  async function compressImage(file, maxWidth = 1200, quality = 0.85) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ========== TOAST NOTIFICATIONS ==========

  function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById(TOAST_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = TOAST_CONTAINER_ID;
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483648;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'ac-toast ac-toast-' + type;
    
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
      loading: '<div class="ac-spinner-sm"></div>'
    };
    
    toast.innerHTML = `
      <div class="ac-toast-icon">${icons[type]}</div>
      <div class="ac-toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('ac-toast-show'), 10);
    
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.remove('ac-toast-show');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
    
    return toast;
  }

  // ========== FIELD DETECTION & MAPPING ==========

  function isElementVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.bottom <= 0 || rect.top >= vh) return false;
    const height = rect.height || 0;
    if (!height) return true;
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, vh);
    const visible = Math.max(0, visibleBottom - visibleTop);
    return visible / height >= 0.3;
  }

  function collectForms() {
    const forms = Array.prototype.slice.call(document.querySelectorAll("form"));
    state.forms = forms;
    state.activeForm = pickActiveForm(forms);
    updateFabVisibility();
  }

  function pickActiveForm(forms) {
    if (!forms || !forms.length) return null;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    let best = null;
    let bestScore = -1;
    
    for (let i = 0; i < forms.length; i++) {
      const f = forms[i];
      const rect = f.getBoundingClientRect();
      const height = rect.height || 0;
      if (height <= 0) continue;
      
      const visibleTop = Math.max(rect.top, 0);
      const visibleBottom = Math.min(rect.bottom, vh);
      const visible = Math.max(0, visibleBottom - visibleTop);
      
      let score = visible;
      
      // Bonus for having type hints
      if (f.querySelector('[data-appycrew-type]')) {
        score += 1000;
      }
      
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return best;
  }

  function getCandidateFields(form) {
    const els = Array.prototype.slice.call(
      form.querySelectorAll("input, textarea, select")
    );
    const out = [];
    const seen = new Set();

    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!isElementVisible(el)) continue;
      if (el.disabled) continue;
      if (el.type === "hidden") continue;

      const key = el.tagName + ":" + (el.name || el.id || i);
      if (seen.has(key)) continue;
      seen.add(key);

      const meta = buildFieldMeta(el);
      out.push(meta);
    }

    return out;
  }

  function buildFieldMeta(el) {
    let labelText = "";
    const id = el.id;
    
    if (id) {
      const lab = document.querySelector('label[for="' + id + '"]');
      if (lab && lab.textContent) {
        labelText = lab.textContent.trim();
      }
    }
    
    if (!labelText) {
      const p = el.parentElement;
      if (p && p.tagName.toLowerCase() === "label") {
        labelText = p.textContent.trim();
      }
    }
    
    if (!labelText) {
      const prev = el.previousElementSibling;
      if (prev && prev.tagName.toLowerCase() === "label" && prev.textContent) {
        labelText = prev.textContent.trim();
      }
    }

    const placeholder = (el.getAttribute("placeholder") || "").trim();
    const dataLabel = (el.getAttribute("data-label") || "").trim();
    const allLabel = [labelText, placeholder, dataLabel].filter(Boolean).join(" / ");

    const typeHint = (el.getAttribute("data-appycrew-type") || "").trim().toLowerCase();

    return {
      el: el,
      label: allLabel || el.name || el.id || "Field",
      labelLower: (allLabel || "").toString().toLowerCase(),
      typeHint: typeHint
    };
  }

  // Field synonyms for semantic matching
  function getFieldSynonyms(fieldType) {
    const synonymMap = {
      item: ['item', 'product', 'object', 'article', 'furniture', 'name', 'type', 'what'],
      location: ['location', 'room', 'place', 'where', 'area', 'site', 'position'],
      quantity: ['qty', 'quantity', 'count', 'number', 'amount', 'how many', 'no of', 'no.'],
      description: ['description', 'details', 'notes', 'info', 'condition', 'appearance', 'desc'],
      notes: ['notes', 'comments', 'remarks', 'additional', 'extra', 'other']
    };
    
    return synonymMap[fieldType] || [];
  }

  // Calculate field match score
  function calculateFieldMatchScore(fieldMeta, candidate) {
    let score = 0;
    const label = fieldMeta.labelLower;
    const candidateType = candidate.type;
    
    // Exact type hint = highest confidence
    if (fieldMeta.typeHint === candidateType) {
      score += 10;
    }
    
    // Semantic label matching
    const labelSynonyms = getFieldSynonyms(candidateType);
    for (const synonym of labelSynonyms) {
      if (label.includes(synonym)) {
        score += 5;
      }
    }
    
    // Fuzzy matching
    const labelWords = label.split(/\s+/);
    for (const word of labelWords) {
      for (const synonym of labelSynonyms) {
        const distance = levenshtein(word, synonym);
        if (distance <= 2) {
          score += Math.max(0, 3 - distance);
        }
      }
    }
    
    return score;
  }

  // ========== DATA EXTRACTION ==========

  const LOCATION_KEYWORDS = [
    "kitchen", "dining", "lounge", "living", "living room", "hall", "hallway",
    "landing", "stairs", "bedroom", "master bedroom", "mbr", "main bedroom",
    "guest bedroom", "bathroom", "ensuite", "office", "study", "garage",
    "loft", "attic", "garden", "shed", "storage", "store", "cupboard"
  ];

  const ITEM_KEYWORDS = [
    "wardrobe", "sofa", "couch", "table", "dining table", "chair", "desk",
    "bed", "mattress", "headboard", "chest", "drawers", "chest of drawers",
    "sideboard", "cabinet", "cupboard", "bookcase", "shelf", "shelving",
    "tv", "television", "picture", "painting", "mirror", "lamp", "box",
    "carton", "crate", "ladder", "bicycle", "bike"
  ];

  function extractStructuredData(text, vision, voice) {
    const extracted = {
      item: null,
      quantity: null,
      location: null,
      description: null,
      notes: null,
      confidence: {}
    };
    
    // Voice data has highest confidence
    if (voice) {
      extracted.item = voice.item;
      extracted.location = voice.location;
      extracted.description = voice.description;
      extracted.notes = voice.notes;
      extracted.confidence = { item: 0.95, location: 0.95, description: 0.9, notes: 0.9 };
      return extracted;
    }
    
    // Vision data
    if (vision && vision.item) {
      extracted.item = vision.item;
      extracted.confidence.item = 0.85;
      
      if (vision.description) {
        extracted.description = vision.description;
        extracted.confidence.description = 0.8;
      }
    }
    
    // OCR text extraction
    const qtyMatch = text.match(/\b(\d{1,3})\s*[xX×]?\s*(pcs?|pieces?|items?|boxes?)?\b/i);
    if (qtyMatch) {
      extracted.quantity = qtyMatch[1];
      extracted.confidence.quantity = 0.9;
    }
    
    if (!extracted.location) {
      const loc = fuzzyMatch(text, LOCATION_KEYWORDS);
      if (loc) {
        extracted.location = loc;
        extracted.confidence.location = 0.8;
      }
    }
    
    if (!extracted.item) {
      const item = fuzzyMatch(text, ITEM_KEYWORDS);
      if (item) {
        extracted.item = item;
        extracted.confidence.item = 0.75;
      }
    }
    
    if (!extracted.description) {
      extracted.description = buildSmartDescription(text, extracted);
      extracted.confidence.description = 0.6;
    }
    
    return extracted;
  }

  function buildSmartDescription(text, extracted) {
    let desc = text;
    
    if (extracted.item) {
      const itemRegex = new RegExp('\\b' + escapeRegex(extracted.item) + '\\b', 'gi');
      desc = desc.replace(itemRegex, '');
    }
    
    if (extracted.location) {
      const locRegex = new RegExp('\\b' + escapeRegex(extracted.location) + '\\b', 'gi');
      desc = desc.replace(locRegex, '');
    }
    
    if (extracted.quantity) {
      const qtyRegex = new RegExp('\\b' + extracted.quantity + '\\s*[xX×]?\\s*(pcs?|pieces?)?\\b', 'gi');
      desc = desc.replace(qtyRegex, '');
    }
    
    desc = desc
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[,;:\-\s]+/, '')
      .replace(/[,;:\-\s]+$/, '')
      .trim();
    
    return desc || text;
  }

  function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ========== MAPPING WITH MULTI-PASS ==========

  function buildMappingsWithMultiPass(text, vision, voice) {
    const extracted = extractStructuredData(text, vision, voice);
    const fields = getCandidateFields(state.activeForm);
    
    // Pass 1: Type hints
    const pass1 = matchByTypeHints(fields, extracted);
    
    // Pass 2: Semantic labels
    const pass2 = matchBySemanticLabels(fields, extracted, pass1);
    
    // Combine and deduplicate
    const allMappings = [...pass1, ...pass2];
    const uniqueMappings = deduplicateMappings(allMappings);
    
    uniqueMappings.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    return uniqueMappings;
  }

  function matchByTypeHints(fields, extracted) {
    const mappings = [];
    const usedFields = new Set();
    
    for (const field of fields) {
      if (!field.typeHint || usedFields.has(field.el)) continue;
      
      const value = extracted[field.typeHint];
      if (value) {
        mappings.push({
          el: field.el,
          label: field.label,
          typeHint: field.typeHint,
          value: value,
          confidence: extracted.confidence?.[field.typeHint] || 0.95,
          checked: true,
          method: 'type-hint'
        });
        usedFields.add(field.el);
      }
    }
    
    return mappings;
  }

  function matchBySemanticLabels(fields, extracted, existingMappings) {
    const mappings = [];
    const usedFields = new Set(existingMappings.map(m => m.el));
    const usedValues = new Set(existingMappings.map(m => m.value));
    
    for (const field of fields) {
      if (usedFields.has(field.el)) continue;
      
      for (const [key, value] of Object.entries(extracted)) {
        if (key === 'confidence' || !value || usedValues.has(value)) continue;
        
        const score = calculateFieldMatchScore(field, { type: key, value });
        
        if (score > 5) {
          mappings.push({
            el: field.el,
            label: field.label,
            typeHint: key,
            value: value,
            confidence: Math.min(score / 15, 0.9),
            checked: true,
            method: 'semantic'
          });
          usedFields.add(field.el);
          usedValues.add(value);
          break;
        }
      }
    }
    
    return mappings;
  }

  function deduplicateMappings(mappings) {
    const seen = new Map();
    
    for (const mapping of mappings) {
      const key = (mapping.el.name || mapping.el.id) + '_' + mapping.value;
      const existing = seen.get(key);
      
      if (!existing || (mapping.confidence || 0) > (existing.confidence || 0)) {
        seen.set(key, mapping);
      }
    }
    
    return Array.from(seen.values());
  }

  // ========== STYLES ==========

  function injectStyles() {
    if (document.getElementById(PANEL_ID + "-styles")) return;
    
    const css = `
/* FAB Styles */
#${FAB_ID} {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2147483647;
  width: 56px;
  height: 56px;
  border-radius: 28px;
  border: none;
  background: #111827;
  color: white;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: system-ui, -apple-system, sans-serif;
}

#${FAB_ID}:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 20px 35px rgba(0,0,0,0.25);
}

#${FAB_ID}:active {
  transform: translateY(0) scale(0.98);
}

#${FAB_ID}.ac-fab-hidden {
  transform: translateY(100px) scale(0.8);
  opacity: 0;
  pointer-events: none;
}

#${FAB_ID} svg {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

#${FAB_ID}.ac-scanning {
  background: #6366f1;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

#${FAB_ID}.ac-listening {
  background: #ec4899;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 currentColor; }
  50% { box-shadow: 0 0 0 20px transparent; }
}

/* Panel */
#${PANEL_ID} {
  position: fixed;
  right: 20px;
  bottom: 90px;
  width: 380px;
  max-width: calc(100vw - 40px);
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  font-family: system-ui, -apple-system, sans-serif;
  z-index: 2147483647;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateY(10px) scale(0.95);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

#${PANEL_ID}.ac-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0) scale(1);
}

#${PANEL_ID} .ac-header {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

#${PANEL_ID} .ac-title {
  color: white;
}

#${PANEL_ID} .ac-title-main {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 2px;
}

#${PANEL_ID} .ac-title-sub {
  font-size: 12px;
  opacity: 0.8;
}

#${PANEL_ID} .ac-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(255,255,255,0.1);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

#${PANEL_ID} .ac-close:hover {
  background: rgba(255,255,255,0.2);
}

#${PANEL_ID} .ac-body {
  padding: 20px;
  max-height: 400px;
  overflow-y: auto;
}

#${PANEL_ID} .ac-mappings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

#${PANEL_ID} .ac-map-row {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.2s;
}

#${PANEL_ID} .ac-map-row:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99,102,241,0.1);
}

#${PANEL_ID} .ac-map-check {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  accent-color: #6366f1;
  cursor: pointer;
}

#${PANEL_ID} .ac-map-main {
  flex: 1;
  min-width: 0;
}

#${PANEL_ID} .ac-map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

#${PANEL_ID} .ac-map-label {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  text-transform: capitalize;
}

#${PANEL_ID} .ac-map-confidence {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
}

#${PANEL_ID} .ac-confidence-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

#${PANEL_ID} .ac-map-value {
  font-size: 13px;
  color: #475569;
  word-break: break-word;
}

#${PANEL_ID} .ac-footer {
  padding: 16px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

#${PANEL_ID} .ac-btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

#${PANEL_ID} .ac-btn-primary {
  background: #6366f1;
  color: white;
  flex: 1;
}

#${PANEL_ID} .ac-btn-primary:hover {
  background: #4f46e5;
  transform: translateY(-1px);
}

#${PANEL_ID} .ac-btn-ghost {
  background: transparent;
  color: #64748b;
}

#${PANEL_ID} .ac-btn-ghost:hover {
  background: #e2e8f0;
}

/* Toast Notifications */
.ac-toast {
  background: white;
  border-radius: 12px;
  padding: 14px 18px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 250px;
  max-width: 350px;
  opacity: 0;
  transform: translateX(400px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
}

.ac-toast-show {
  opacity: 1;
  transform: translateX(0);
}

.ac-toast-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.ac-toast-icon svg {
  width: 100%;
  height: 100%;
}

.ac-toast-message {
  font-size: 14px;
  color: #1e293b;
  font-weight: 500;
}

.ac-toast
