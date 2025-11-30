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
  "use strict";
  
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
    isPanelOpen: false,
    isProcessing: false,
    fabVisible: true,
    lastScrollY: 0,
    originalValues: new Map(),
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
    
    // Check for explicit configuration
    if (window.APPYCREW_OCR_API_BASE) {
      state.apiBase = String(window.APPYCREW_OCR_API_BASE).replace(/\/+$/, "");
      console.log('[AppyCrew OCR] Using configured API base:', state.apiBase);
      return state.apiBase;
    }
    
    // Try to detect from script src
    const scripts = document.querySelectorAll('script[src*="ocr-widget"]');
    for (const script of scripts) {
      try {
        const url = new URL(script.src);
        state.apiBase = url.origin;
        console.log('[AppyCrew OCR] Detected API base from script:', state.apiBase);
        return state.apiBase;
      } catch (e) {
        // Ignore invalid URLs
      }
    }
    
    // Fallback to current origin (only works if widget is same-origin)
    state.apiBase = window.location.origin;
    console.warn('[AppyCrew OCR] Using current origin as API base:', state.apiBase, 
      '- Set window.APPYCREW_OCR_API_BASE if this is incorrect');
    return state.apiBase;
  }

  // Levenshtein distance for fuzzy matching
  function levenshtein(a, b) {
    if (!a || !b) return Math.max((a || '').length, (b || '').length);
    a = a.toLowerCase();
    b = b.toLowerCase();
    
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
    if (!text1 || !text2) return 0;
    const tokens1 = new Set(text1.toLowerCase().split(/\W+/).filter(Boolean));
    const tokens2 = new Set(text2.toLowerCase().split(/\W+/).filter(Boolean));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return intersection.size / (union.size || 1);
  }

  // Fuzzy match against keywords
  function fuzzyMatch(text, keywords, threshold = 2) {
    if (!text) return null;
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

  function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Image compression
  async function compressImage(file, maxWidth = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to load image'));
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
      <div class="ac-toast-icon">${icons[type] || icons.info}</div>
      <div class="ac-toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('ac-toast-show');
    });
    
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.remove('ac-toast-show');
        setTimeout(() => {
          if (toast.parentNode) toast.remove();
        }, 300);
      }, duration);
    }
    
    return toast;
  }

  function hideToast(toast) {
    if (!toast) return;
    toast.classList.remove('ac-toast-show');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 300);
  }

  // ========== FIELD DETECTION & MAPPING ==========

  function isElementVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    
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
      
      // Bonus for having visible input fields
      const inputs = f.querySelectorAll('input, textarea, select');
      score += inputs.length * 10;
      
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return best;
  }

  function getCandidateFields(form) {
    if (!form) return [];
    
    const els = Array.prototype.slice.call(
      form.querySelectorAll("input, textarea, select")
    );
    const out = [];
    const seen = new Set();

    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!isElementVisible(el)) continue;
      if (el.disabled || el.readOnly) continue;
      if (el.type === "hidden" || el.type === "submit" || el.type === "button") continue;

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
    
    // Check for parent with label-like class
    if (!labelText) {
      const parent = el.closest('.form-group, .field-group, .input-group');
      if (parent) {
        const label = parent.querySelector('label, .label, .field-label');
        if (label) labelText = label.textContent.trim();
      }
    }

    const placeholder = (el.getAttribute("placeholder") || "").trim();
    const dataLabel = (el.getAttribute("data-label") || "").trim();
    const ariaLabel = (el.getAttribute("aria-label") || "").trim();
    const name = (el.name || "").replace(/[-_]/g, ' ').trim();
    
    const allLabel = [labelText, placeholder, dataLabel, ariaLabel, name].filter(Boolean).join(" / ");
    const typeHint = (el.getAttribute("data-appycrew-type") || "").trim().toLowerCase();

    return {
      el: el,
      label: allLabel || el.name || el.id || "Field",
      labelLower: (allLabel || "").toString().toLowerCase(),
      typeHint: typeHint,
      inputType: el.type || el.tagName.toLowerCase()
    };
  }

  // Field synonyms for semantic matching
  function getFieldSynonyms(fieldType) {
    const synonymMap = {
      item: ['item', 'product', 'object', 'article', 'furniture', 'name', 'type', 'what', 'thing', 'piece'],
      location: ['location', 'room', 'place', 'where', 'area', 'site', 'position', 'from', 'origin'],
      quantity: ['qty', 'quantity', 'count', 'number', 'amount', 'how many', 'no of', 'no.', 'num', 'units'],
      description: ['description', 'details', 'notes', 'info', 'condition', 'appearance', 'desc', 'about'],
      notes: ['notes', 'comments', 'remarks', 'additional', 'extra', 'other', 'memo'],
      dimensions: ['dimensions', 'size', 'width', 'height', 'length', 'depth', 'measurement'],
      weight: ['weight', 'kg', 'lbs', 'pounds', 'kilos', 'mass'],
      color: ['color', 'colour', 'hue', 'shade']
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
    
    // Input type compatibility bonus
    if (candidateType === 'quantity' && fieldMeta.inputType === 'number') {
      score += 3;
    }
    
    return score;
  }

  // ========== DATA EXTRACTION ==========

  const LOCATION_KEYWORDS = [
    "kitchen", "dining", "dining room", "lounge", "living", "living room", 
    "hall", "hallway", "landing", "stairs", "staircase",
    "bedroom", "master bedroom", "mbr", "main bedroom", "guest bedroom", "kids room",
    "bathroom", "ensuite", "en-suite", "toilet", "wc",
    "office", "study", "home office", "garage", "car port",
    "loft", "attic", "basement", "cellar", "garden", "patio", "yard",
    "shed", "storage", "store", "cupboard", "closet", "utility", "laundry",
    "conservatory", "sunroom", "porch", "entrance", "foyer"
  ];

  const ITEM_KEYWORDS = [
    "wardrobe", "armoire", "sofa", "couch", "settee", "loveseat",
    "table", "dining table", "coffee table", "side table", "end table",
    "chair", "armchair", "recliner", "desk", "desk chair", "office chair",
    "bed", "mattress", "headboard", "footboard", "bed frame",
    "chest", "drawers", "chest of drawers", "dresser", "nightstand",
    "sideboard", "buffet", "cabinet", "cupboard", "pantry",
    "bookcase", "bookshelf", "shelf", "shelving", "shelves",
    "tv", "television", "tv stand", "entertainment center",
    "picture", "painting", "artwork", "mirror", "lamp", "floor lamp",
    "box", "carton", "crate", "container", "bin",
    "ladder", "bicycle", "bike", "exercise equipment", "treadmill",
    "washer", "dryer", "washing machine", "refrigerator", "fridge", "freezer",
    "microwave", "oven", "stove", "dishwasher"
  ];

  const BRAND_NOISE = [
    "appycrew", "fragile", "handle with care", "this side up", 
    "heavy", "do not stack", "keep dry"
  ];

  function cleanOcrText(text) {
    if (!text) return "";
    let cleaned = text;
    
    // Remove brand noise
    for (const noise of BRAND_NOISE) {
      const regex = new RegExp('\\b' + escapeRegex(noise) + '\\b', 'gi');
      cleaned = cleaned.replace(regex, '');
    }
    
    // Clean up whitespace
    cleaned = cleaned
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned;
  }

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
    if (voice && Object.keys(voice).length > 0) {
      if (voice.item) {
        extracted.item = voice.item;
        extracted.confidence.item = 0.95;
      }
      if (voice.location) {
        extracted.location = voice.location;
        extracted.confidence.location = 0.95;
      }
      if (voice.description) {
        extracted.description = voice.description;
        extracted.confidence.description = 0.9;
      }
      if (voice.notes) {
        extracted.notes = voice.notes;
        extracted.confidence.notes = 0.9;
      }
      if (voice.quantity) {
        extracted.quantity = voice.quantity;
        extracted.confidence.quantity = 0.95;
      }
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
      if (vision.location) {
        extracted.location = vision.location;
        extracted.confidence.location = 0.8;
      }
    }
    
    // Clean OCR text
    const cleanedText = cleanOcrText(text);
    
    // OCR text extraction - quantity
    const qtyMatch = cleanedText.match(/\b(\d{1,3})\s*[xX×]?\s*(pcs?|pieces?|items?|boxes?|units?)?\b/i);
    if (qtyMatch && !extracted.quantity) {
      extracted.quantity = qtyMatch[1];
      extracted.confidence.quantity = 0.9;
    }
    
    // Location extraction
    if (!extracted.location) {
      // Try to find location phrase (e.g., "Master bedroom")
      for (const loc of LOCATION_KEYWORDS) {
        const regex = new RegExp('(?:from\\s+)?(?:the\\s+)?([a-z]+\\s+)?' + escapeRegex(loc) + '(?:\\s+[a-z]+)?', 'i');
        const match = cleanedText.match(regex);
        if (match) {
          extracted.location = match[0].replace(/^(from|the)\s+/i, '').trim();
          extracted.confidence.location = 0.8;
          break;
        }
      }
    }
    
    // Item extraction
    if (!extracted.item) {
      for (const item of ITEM_KEYWORDS) {
        const regex = new RegExp('(?:[a-z]+\\s+)?' + escapeRegex(item) + '(?:\\s+[a-z]+)?', 'i');
        const match = cleanedText.match(regex);
        if (match) {
          extracted.item = match[0].trim();
          extracted.confidence.item = 0.75;
          break;
        }
      }
    }
    
    // Build description from remaining text
    if (!extracted.description && cleanedText) {
      extracted.description = buildSmartDescription(cleanedText, extracted);
      extracted.confidence.description = 0.6;
    }
    
    return extracted;
  }

  function buildSmartDescription(text, extracted) {
    let desc = text;
    
    // Remove already extracted data
    if (extracted.item) {
      const itemRegex = new RegExp('\\b' + escapeRegex(extracted.item) + '\\b', 'gi');
      desc = desc.replace(itemRegex, '');
    }
    
    if (extracted.location) {
      const locRegex = new RegExp('\\b' + escapeRegex(extracted.location) + '\\b', 'gi');
      desc = desc.replace(locRegex, '');
    }
    
    if (extracted.quantity) {
      const qtyRegex = new RegExp('\\b' + extracted.quantity + '\\s*[xX×]?\\s*(pcs?|pieces?|items?)?\\b', 'gi');
      desc = desc.replace(qtyRegex, '');
    }
    
    // Clean up
    desc = desc
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[,;:\-\s]+/, '')
      .replace(/[,;:\-\s]+$/, '')
      .trim();
    
    // Don't return empty or very short descriptions
    return desc.length > 2 ? desc : null;
  }

  // ========== MAPPING WITH MULTI-PASS ==========

  function buildMappingsWithMultiPass(text, vision, voice) {
    if (!state.activeForm) {
      collectForms();
    }
    if (!state.activeForm) return [];
    
    const extracted = extractStructuredData(text, vision, voice);
    const fields = getCandidateFields(state.activeForm);
    
    if (fields.length === 0) return [];
    
    // Pass 1: Type hints (highest priority)
    const pass1 = matchByTypeHints(fields, extracted);
    
    // Pass 2: Semantic labels
    const pass2 = matchBySemanticLabels(fields, extracted, pass1);
    
    // Combine and deduplicate
    const allMappings = [...pass1, ...pass2];
    const uniqueMappings = deduplicateMappings(allMappings);
    
    // Sort by confidence
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
      const key = (mapping.el.name || mapping.el.id || '') + '_' + mapping.typeHint;
      const existing = seen.get(key);
      
      if (!existing || (mapping.confidence || 0) > (existing.confidence || 0)) {
        seen.set(key, mapping);
      }
    }
    
    return Array.from(seen.values());
  }

  // ========== APPLYING MAPPINGS ==========

  function setFieldValue(el, value) {
    if (!el || value === null || value === undefined) return false;
    
    const tagName = el.tagName.toLowerCase();
    const type = el.type ? el.type.toLowerCase() : '';
    
    // Store original value for undo
    if (!state.originalValues.has(el)) {
      state.originalValues.set(el, el.value || '');
    }
    
    try {
      if (tagName === 'select') {
        return setSelectValue(el, value);
      } else if (type === 'radio') {
        return setRadioValue(el, value);
      } else if (type === 'checkbox') {
        return setCheckboxValue(el, value);
      } else {
        return setInputValue(el, value);
      }
    } catch (e) {
      console.warn('Error setting field value:', e);
      return false;
    }
  }

  function setInputValue(el, value) {
    // Use native setter for React compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;
    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;
    
    const setter = el.tagName.toLowerCase() === 'textarea' 
      ? nativeTextareaValueSetter 
      : nativeInputValueSetter;
    
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    
    // Dispatch events for framework compatibility
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    return true;
  }

  function setSelectValue(el, value) {
    const options = Array.from(el.options);
    const valueLower = String(value).toLowerCase();
    
    // Try exact match first
    let matched = options.find(opt => 
      opt.value.toLowerCase() === valueLower || 
      opt.text.toLowerCase() === valueLower
    );
    
    // Try partial match
    if (!matched) {
      matched = options.find(opt => 
        opt.value.toLowerCase().includes(valueLower) || 
        opt.text.toLowerCase().includes(valueLower) ||
        valueLower.includes(opt.value.toLowerCase()) ||
        valueLower.includes(opt.text.toLowerCase())
      );
    }
    
    // Try fuzzy match
    if (!matched) {
      let bestScore = Infinity;
      for (const opt of options) {
        if (!opt.value) continue;
        const scoreValue = levenshtein(opt.value.toLowerCase(), valueLower);
        const scoreText = levenshtein(opt.text.toLowerCase(), valueLower);
        const score = Math.min(scoreValue, scoreText);
        if (score < bestScore && score <= 3) {
          bestScore = score;
          matched = opt;
        }
      }
    }
    
    if (matched) {
      el.value = matched.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    
    return false;
  }

  function setRadioValue(el, value) {
    const name = el.name;
    if (!name) return false;
    
    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
    const valueLower = String(value).toLowerCase();
    
    for (const radio of radios) {
      const radioValue = radio.value.toLowerCase();
      const radioLabel = radio.parentElement?.textContent?.toLowerCase() || '';
      
      if (radioValue === valueLower || 
          radioLabel.includes(valueLower) ||
          valueLower.includes(radioValue)) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    
    return false;
  }

  function setCheckboxValue(el, value) {
    const valueLower = String(value).toLowerCase();
    const isTrue = ['true', 'yes', '1', 'on', 'checked'].includes(valueLower);
    el.checked = isTrue;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function applyMappings(mappings) {
    if (!mappings || mappings.length === 0) return 0;
    
    let applied = 0;
    const checkedMappings = mappings.filter(m => m.checked);
    
    for (const mapping of checkedMappings) {
      const success = setFieldValue(mapping.el, mapping.value);
      if (success) {
        applied++;
        
        // Learn from successful mapping
        state.fieldClassifier.learn(
          mapping.label,
          mapping.typeHint,
          mapping.value
        );
      }
    }
    
    state.lastApplied = checkedMappings;
    return applied;
  }

  function undoMappings() {
    if (!state.originalValues || state.originalValues.size === 0) return 0;
    
    let undone = 0;
    for (const [el, originalValue] of state.originalValues) {
      setFieldValue(el, originalValue);
      undone++;
    }
    
    state.originalValues.clear();
    return undone;
  }

  // ========== API CALLS ==========

  async function performOcr(imageData) {
    const apiBase = detectApiBase();
    const endpoint = `${apiBase}/api/ocr`;
    
    console.log('[AppyCrew OCR] Calling OCR API:', endpoint);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ image: imageData })
      });
      
      console.log('[AppyCrew OCR] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[AppyCrew OCR] API Error:', response.status, errorText);
        throw new Error(`OCR API error: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      
      const data = await response.json();
      console.log('[AppyCrew OCR] OCR result:', data);
      return data.text || data.result || data.content || '';
    } catch (error) {
      console.error('[AppyCrew OCR] OCR Error:', error);
      
      // Provide more helpful error messages
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Network error - check if API is reachable and CORS is configured');
      }
      throw error;
    }
  }

  async function performVisionAnalysis(imageData) {
    const apiBase = detectApiBase();
    const endpoint = `${apiBase}/api/vision`;
    
    console.log('[AppyCrew OCR] Calling Vision API:', endpoint);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ image: imageData })
      });
      
      if (!response.ok) {
        console.warn('[AppyCrew OCR] Vision API returned:', response.status);
        return null; // Vision is optional
      }
      
      const data = await response.json();
      console.log('[AppyCrew OCR] Vision result:', data);
      return data;
    } catch (error) {
      console.warn('[AppyCrew OCR] Vision API error (non-critical):', error.message);
      return null;
    }
  }

  async function processImage(file) {
    state.isProcessing = true;
    updateFabState();
    
    const loadingToast = showToast('Processing image...', 'loading', 0);
    
    try {
      // Compress image
      showToast('Compressing...', 'info', 1000);
      console.log('[AppyCrew OCR] Compressing image:', file.name, file.size, 'bytes');
      const compressedImage = await compressImage(file);
      console.log('[AppyCrew OCR] Compressed to:', compressedImage.length, 'chars');
      
      // Run OCR and Vision in parallel
      showToast('Reading text...', 'info', 1500);
      
      let ocrText = '';
      let visionData = null;
      let ocrError = null;
      
      try {
        [ocrText, visionData] = await Promise.all([
          performOcr(compressedImage).catch(e => { ocrError = e; return ''; }),
          performVisionAnalysis(compressedImage).catch(() => null)
        ]);
      } catch (e) {
        ocrError = e;
      }
      
      hideToast(loadingToast);
      
      if (ocrError && !ocrText && !visionData) {
        console.error('[AppyCrew OCR] Processing failed:', ocrError);
        showToast(`Error: ${ocrError.message}`, 'error', 5000);
        return;
      }
      
      if (!ocrText && !visionData) {
        showToast('Could not read image. Try a clearer photo.', 'error');
        return;
      }
      
      state.lastText = ocrText || '';
      state.lastOriginalText = ocrText || '';
      state.lastVision = visionData;
      state.voiceData = null;
      
      console.log('[AppyCrew OCR] Building mappings from:', { ocrText, visionData });
      
      // Build mappings
      const mappings = buildMappingsWithMultiPass(ocrText, visionData, null);
      state.mappings = mappings;
      
      console.log('[AppyCrew OCR] Found mappings:', mappings.length);
      
      if (mappings.length > 0) {
        showToast(`Found ${mappings.length} matches!`, 'success');
        openPanel();
        renderMappings();
      } else {
        showToast('No fields matched. Try clearer image.', 'info');
        // Still open panel to show empty state
        openPanel();
        renderMappings();
      }
      
    } catch (error) {
      hideToast(loadingToast);
      console.error('[AppyCrew OCR] Image processing error:', error);
      showToast(`Processing failed: ${error.message}`, 'error', 5000);
    } finally {
      state.isProcessing = false;
      updateFabState();
    }
  }

  // ========== VOICE INPUT ==========

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return null;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    return recognition;
  }

  function startVoiceInput() {
    if (state.isListening) {
      stopVoiceInput();
      return;
    }
    
    if (!state.speechRecognition) {
      state.speechRecognition = initSpeechRecognition();
    }
    
    if (!state.speechRecognition) {
      showToast('Voice input not supported', 'error');
      return;
    }
    
    state.isListening = true;
    updateFabState();
    showToast('Listening... Speak now', 'info', 0);
    
    let finalTranscript = '';
    
    state.speechRecognition.onresult = (event) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Show interim results
      if (interimTranscript) {
        showToast(`Heard: "${interimTranscript}"`, 'info', 1000);
      }
    };
    
    state.speechRecognition.onend = () => {
      state.isListening = false;
      updateFabState();
      
      if (finalTranscript.trim()) {
        processVoiceInput(finalTranscript.trim());
      } else {
        showToast('No speech detected. Try again.', 'info');
      }
    };
    
    state.speechRecognition.onerror = (event) => {
      state.isListening = false;
      updateFabState();
      console.error('Speech recognition error:', event.error);
      showToast('Voice input failed. Try again.', 'error');
    };
    
    state.speechRecognition.start();
  }

  function stopVoiceInput() {
    if (state.speechRecognition && state.isListening) {
      state.speechRecognition.stop();
    }
    state.isListening = false;
    updateFabState();
  }

  function processVoiceInput(transcript) {
    showToast(`Processing: "${transcript}"`, 'info', 2000);
    
    // Parse voice input into structured data
    const voiceData = parseVoiceTranscript(transcript);
    state.voiceData = voiceData;
    state.lastText = transcript;
    
    // Build mappings
    const mappings = buildMappingsWithMultiPass(transcript, null, voiceData);
    state.mappings = mappings;
    
    if (mappings.length > 0) {
      showToast(`Found ${mappings.length} matches!`, 'success');
      openPanel();
      renderMappings();
    } else {
      showToast('Could not parse voice input.', 'info');
    }
  }

  function parseVoiceTranscript(transcript) {
    const data = {
      item: null,
      location: null,
      description: null,
      quantity: null,
      notes: null
    };
    
    // Split by common delimiters
    const parts = transcript.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
    
    // Try to identify each part
    for (const part of parts) {
      const partLower = part.toLowerCase();
      
      // Check for quantity
      const qtyMatch = partLower.match(/^(\d+)\s*(pieces?|items?|boxes?|units?)?$/i);
      if (qtyMatch && !data.quantity) {
        data.quantity = qtyMatch[1];
        continue;
      }
      
      // Check for location
      if (!data.location) {
        const locMatch = fuzzyMatch(partLower, LOCATION_KEYWORDS);
        if (locMatch) {
          data.location = part;
          continue;
        }
      }
      
      // Check for item
      if (!data.item) {
        const itemMatch = fuzzyMatch(partLower, ITEM_KEYWORDS);
        if (itemMatch) {
          data.item = part;
          continue;
        }
      }
      
      // Default to description/notes
      if (!data.description) {
        data.description = part;
      } else if (!data.notes) {
        data.notes = part;
      }
    }
    
    // If nothing matched, use whole transcript as description
    if (!data.item && !data.location && !data.description) {
      data.description = transcript;
    }
    
    return data;
  }

  // ========== UI COMPONENTS ==========

  function updateFabVisibility() {
    const container = document.getElementById(FAB_ID + '-container');
    if (!container) return;
    
    const hasForm = state.forms.length > 0;
    
    if (hasForm && state.fabVisible) {
      container.classList.remove('ac-fab-hidden');
    } else if (!hasForm) {
      container.classList.add('ac-fab-hidden');
    }
  }

  function updateFabState() {
    const fab = document.getElementById(FAB_ID);
    if (!fab) return;
    
    fab.classList.remove('ac-scanning', 'ac-listening');
    
    if (state.isProcessing) {
      fab.classList.add('ac-scanning');
      closeFabMenu();
    } else if (state.isListening) {
      fab.classList.add('ac-listening');
      closeFabMenu();
    }
  }

  function createFab() {
    if (document.getElementById(FAB_ID)) return;
    
    // Create FAB container for speed dial
    const fabContainer = document.createElement('div');
    fabContainer.id = FAB_ID + '-container';
    fabContainer.className = 'ac-fab-container';
    
    // Speed dial menu
    const speedDial = document.createElement('div');
    speedDial.className = 'ac-speed-dial';
    speedDial.innerHTML = `
      <button type="button" class="ac-speed-dial-btn ac-speed-dial-scan" aria-label="Scan Image">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6 8h1.5v1.5H13V13zm1.5 1.5H16V16h-1.5v-1.5zM16 13h1.5v1.5H16V13zm-3 3h1.5v1.5H13V16zm1.5 1.5H16V19h-1.5v-1.5zM16 16h1.5v1.5H16V16zm1.5-1.5H19V16h-1.5v-1.5zm0 3H19V19h-1.5v-1.5zM19 13h-1.5v1.5H19V13z"/>
        </svg>
        <span>Scan</span>
      </button>
      <button type="button" class="ac-speed-dial-btn ac-speed-dial-voice" aria-label="Voice Input">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
        <span>Voice</span>
      </button>
    `;
    
    // Main FAB button
    const fab = document.createElement('button');
    fab.id = FAB_ID;
    fab.type = 'button';
    fab.setAttribute('aria-label', 'OCR Scanner');
    fab.innerHTML = `
      <svg class="ac-fab-icon-default" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 0h-2v2h2v2h-2v2h2v-2h2v2h2v-2h-2v-2h2v-2h-2v2h-2v-2zm-2-2h2v2h-2v-2zm2-2h2v2h-2V9z"/>
      </svg>
      <svg class="ac-fab-icon-close" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    `;
    
    fab.addEventListener('click', handleFabClick);
    
    // Speed dial button handlers
    speedDial.querySelector('.ac-speed-dial-scan').addEventListener('click', (e) => {
      e.stopPropagation();
      closeFabMenu();
      openFileInput();
    });
    
    speedDial.querySelector('.ac-speed-dial-voice').addEventListener('click', (e) => {
      e.stopPropagation();
      closeFabMenu();
      startVoiceInput();
    });
    
    fabContainer.appendChild(speedDial);
    fabContainer.appendChild(fab);
    document.body.appendChild(fabContainer);
    
    // Smart auto-hide on scroll
    let lastScrollY = window.scrollY;
    let ticking = false;
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          
          // Always show near bottom
          if (currentScrollY >= maxScroll - 100) {
            state.fabVisible = true;
          } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
            // Scrolling down - hide
            state.fabVisible = false;
          } else {
            // Scrolling up - show
            state.fabVisible = true;
          }
          
          updateFabVisibility();
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      const container = document.getElementById(FAB_ID + '-container');
      if (container && !container.contains(e.target)) {
        closeFabMenu();
      }
    });
  }

  function toggleFabMenu() {
    const container = document.getElementById(FAB_ID + '-container');
    if (container) {
      container.classList.toggle('ac-fab-open');
    }
  }

  function closeFabMenu() {
    const container = document.getElementById(FAB_ID + '-container');
    if (container) {
      container.classList.remove('ac-fab-open');
    }
  }

  function handleFabClick(e) {
    e.stopPropagation();
    if (state.isProcessing) return;
    
    if (state.isPanelOpen) {
      closePanel();
    } else {
      toggleFabMenu();
    }
  }

  function openFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use rear camera on mobile
    
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        state.selectedFile = file;
        await processImage(file);
      }
    };
    
    input.click();
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="ac-header">
        <div class="ac-title">
          <div class="ac-title-main">OCR Results</div>
          <div class="ac-title-sub">Review and apply matches</div>
        </div>
        <button class="ac-close" type="button" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <div class="ac-body">
        <div class="ac-mappings"></div>
        <div class="ac-empty" style="display:none;">
          <p>No matches found. Try a clearer image or use voice input.</p>
        </div>
      </div>
      <div class="ac-footer">
        <button class="ac-btn ac-btn-ghost ac-btn-undo" type="button" disabled>Undo</button>
        <button class="ac-btn ac-btn-primary ac-btn-apply" type="button">Apply</button>
      </div>
    `;
    
    // Event listeners
    panel.querySelector('.ac-close').addEventListener('click', closePanel);
    panel.querySelector('.ac-btn-apply').addEventListener('click', handleApply);
    panel.querySelector('.ac-btn-undo').addEventListener('click', handleUndo);
    
    document.body.appendChild(panel);
  }

  function openPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      panel.classList.add('ac-open');
      state.isPanelOpen = true;
    }
  }

  function closePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      panel.classList.remove('ac-open');
      state.isPanelOpen = false;
    }
  }

  function renderMappings() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    
    const container = panel.querySelector('.ac-mappings');
    const emptyState = panel.querySelector('.ac-empty');
    
    if (!state.mappings || state.mappings.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }
    
    container.style.display = 'flex';
    emptyState.style.display = 'none';
    
    container.innerHTML = state.mappings.map((mapping, index) => {
      const confidence = Math.round((mapping.confidence || 0) * 100);
      const confidenceColor = confidence >= 90 ? '#22c55e' : confidence >= 80 ? '#eab308' : '#f97316';
      
      return `
        <div class="ac-map-row" data-index="${index}">
          <input type="checkbox" class="ac-map-check" ${mapping.checked ? 'checked' : ''} data-index="${index}">
          <div class="ac-map-main">
            <div class="ac-map-header">
              <span class="ac-map-label">${escapeHtml(mapping.label)}</span>
              <span class="ac-map-confidence">
                <span class="ac-confidence-dot" style="background:${confidenceColor}"></span>
                ${confidence}%
              </span>
            </div>
            <div class="ac-map-value">${escapeHtml(String(mapping.value))}</div>
          </div>
        </div>
      `;
    }).join('');
    
    // Add checkbox listeners
    container.querySelectorAll('.ac-map-check').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (state.mappings[index]) {
          state.mappings[index].checked = e.target.checked;
        }
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function handleApply() {
    const applied = applyMappings(state.mappings);
    
    if (applied > 0) {
      showToast(`Applied ${applied} field(s)`, 'success');
      
      // Enable undo button
      const undoBtn = document.querySelector('.ac-btn-undo');
      if (undoBtn) undoBtn.disabled = false;
      
      closePanel();
    } else {
      showToast('No fields to apply', 'info');
    }
  }

  function handleUndo() {
    const undone = undoMappings();
    
    if (undone > 0) {
      showToast(`Undone ${undone} field(s)`, 'success');
      
      // Disable undo button
      const undoBtn = document.querySelector('.ac-btn-undo');
      if (undoBtn) undoBtn.disabled = true;
    }
  }

  // ========== STYLES ==========

  function injectStyles() {
    if (document.getElementById(PANEL_ID + "-styles")) return;
    
    const style = document.createElement('style');
    style.id = PANEL_ID + "-styles";
    style.textContent = `
/* FAB Container */
.ac-fab-container {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.ac-fab-container.ac-fab-hidden {
  transform: translateY(100px);
  opacity: 0;
  pointer-events: none;
}

/* Speed Dial Menu */
.ac-speed-dial {
  display: flex;
  flex-direction: column;
  gap: 10px;
  opacity: 0;
  transform: translateY(20px) scale(0.8);
  pointer-events: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.ac-fab-container.ac-fab-open .ac-speed-dial {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.ac-speed-dial-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: white;
  border: none;
  border-radius: 24px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.15);
  cursor: pointer;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  transition: all 0.2s;
}

.ac-speed-dial-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
}

.ac-speed-dial-btn svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.ac-speed-dial-scan { color: #6366f1; }
.ac-speed-dial-voice { color: #ec4899; }

/* Main FAB Button - Smaller */
#${FAB_ID} {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  border: none;
  background: #111827;
  color: white;
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: system-ui, -apple-system, sans-serif;
  position: relative;
}

#${FAB_ID}:hover {
  transform: scale(1.08);
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
}

#${FAB_ID}:active {
  transform: scale(0.95);
}

#${FAB_ID} svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
  transition: all 0.3s;
}

#${FAB_ID} .ac-fab-icon-close {
  position: absolute;
  opacity: 0;
  transform: rotate(-90deg);
}

.ac-fab-container.ac-fab-open #${FAB_ID} {
  background: #374151;
}

.ac-fab-container.ac-fab-open #${FAB_ID} .ac-fab-icon-default {
  opacity: 0;
  transform: rotate(90deg);
}

.ac-fab-container.ac-fab-open #${FAB_ID} .ac-fab-icon-close {
  opacity: 1;
  transform: rotate(0);
}

#${FAB_ID}.ac-scanning {
  background: #6366f1;
  animation: ac-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

#${FAB_ID}.ac-listening {
  background: #ec4899;
  animation: ac-pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes ac-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 0 12px transparent; }
}

/* Panel */
#${PANEL_ID} {
  position: fixed;
  right: 16px;
  bottom: 76px;
  width: 360px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 100px);
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  font-family: system-ui, -apple-system, sans-serif;
  z-index: 2147483646;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateY(10px) scale(0.95);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
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
  flex-shrink: 0;
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
  overflow-y: auto;
  flex: 1;
  min-height: 0;
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
  flex-shrink: 0;
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
  gap: 8px;
}

#${PANEL_ID} .ac-map-label {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

#${PANEL_ID} .ac-map-confidence {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  flex-shrink: 0;
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

#${PANEL_ID} .ac-empty {
  text-align: center;
  padding: 30px 20px;
  color: #64748b;
}

#${PANEL_ID} .ac-footer {
  padding: 16px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

#${PANEL_ID} .ac-btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

#${PANEL_ID} .ac-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

#${PANEL_ID} .ac-btn-primary {
  background: #6366f1;
  color: white;
}

#${PANEL_ID} .ac-btn-primary:hover:not(:disabled) {
  background: #4f46e5;
  transform: translateY(-1px);
}

#${PANEL_ID} .ac-btn-ghost {
  background: transparent;
  color: #64748b;
}

#${PANEL_ID} .ac-btn-ghost:hover:not(:disabled) {
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
  transform: translateX(100px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
  font-family: system-ui, -apple-system, sans-serif;
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

.ac-toast-success .ac-toast-icon { color: #22c55e; }
.ac-toast-error .ac-toast-icon { color: #ef4444; }
.ac-toast-info .ac-toast-icon { color: #3b82f6; }
.ac-toast-loading .ac-toast-icon { color: #6366f1; }

.ac-spinner-sm {
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: ac-spin 0.8s linear infinite;
}

@keyframes ac-spin {
  to { transform: rotate(360deg); }
}

/* Mobile Responsive */
@media (max-width: 480px) {
  .ac-fab-container {
    right: 12px;
    bottom: 12px;
  }
  
  #${FAB_ID} {
    width: 44px;
    height: 44px;
  }
  
  #${FAB_ID} svg {
    width: 20px;
    height: 20px;
  }
  
  .ac-speed-dial-btn span {
    display: none;
  }
  
  .ac-speed-dial-btn {
    padding: 10px;
    border-radius: 50%;
  }
  
  #${PANEL_ID} {
    right: 8px;
    left: 8px;
    bottom: 72px;
    width: auto;
    max-width: none;
  }
  
  #${TOAST_CONTAINER_ID} {
    right: 8px;
    left: 8px;
  }
  
  .ac-toast {
    min-width: auto;
    max-width: none;
  }
}
    `;
    
    document.head.appendChild(style);
  }

  // ========== KEYBOARD SHORTCUTS ==========

  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+S - Quick scan
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (!state.isProcessing && state.forms.length > 0) {
          openFileInput();
        }
      }
      
      // Ctrl+Shift+V - Voice input
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        if (state.forms.length > 0) {
          startVoiceInput();
        }
      }
      
      // Escape - Close panel
      if (e.key === 'Escape') {
        if (state.isPanelOpen) {
          closePanel();
        }
        if (state.isListening) {
          stopVoiceInput();
        }
      }
    });
  }

  // ========== MUTATION OBSERVER ==========

  function initObserver() {
    if (state.observer) return;
    
    state.observer = new MutationObserver(() => {
      collectForms();
    });
    
    state.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ========== INITIALIZATION ==========

  function init() {
    // Load ML training data
    state.fieldClassifier.load();
    
    // Inject styles
    injectStyles();
    
    // Create UI
    createFab();
    createPanel();
    
    // Collect forms
    collectForms();
    
    // Init observers and shortcuts
    initObserver();
    initKeyboardShortcuts();
    
    // Initial visibility check
    updateFabVisibility();
    
    console.log('AppyCrew OCR Widget v10 initialized');
  }

  // Start when DOM is ready
  ready(init);
  
  // Expose for external control if needed
  window.AppyCrewOCR = {
    scan: openFileInput,
    voice: startVoiceInput,
    open: openPanel,
    close: closePanel,
    getState: () => ({ ...state })
  };

})();
