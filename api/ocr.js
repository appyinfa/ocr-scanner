const OCR_API_URL =
  process.env.OCR_SPACE_API_URL || "https://api.ocr.space/parse/image";
const OCR_API_KEY = process.env.OCR_SPACE_API_KEY || null;

const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY || null;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const VISION_PROVIDER = (process.env.VISION_PROVIDER || "openai").toLowerCase();
const VISION_MODE = (process.env.VISION_MODE || "fallback").toLowerCase();

const LOCATION_KEYWORDS = [
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
];

const ITEM_KEYWORDS = [
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
];


function stripBrandNoise(text) {
  if (!text) return "";
  const lowerBrands = [
    "appycrew",
    "fragile",
    "handle with care",
    "this way up",
    "this side up",
    "moving & storage",
    "moving and storage"
  ];

  const lines = text.split(/\r?\n/);
  const cleanedLines = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const lower = line.toLowerCase();
    const isBrandLine = lowerBrands.some((b) => lower.includes(b));
    if (isBrandLine) continue;

    cleanedLines.push(raw);
  }

  return cleanedLines.join("\n");
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function shouldCallVision(text) {
  if (VISION_MODE === "off") return false;
  if (!text || !text.trim()) return true;
  if (VISION_MODE === "always") return true;

  const lower = text.toLowerCase();
  const hasItem = ITEM_KEYWORDS.some((k) => lower.indexOf(k) !== -1);
  const hasLocation = LOCATION_KEYWORDS.some((k) => lower.indexOf(k) !== -1);
  if (hasItem || hasLocation) return false;
  if (text.trim().length < 10) return true;
  return false;
}

async function callOcrSpace(imageBase64) {
  if (!OCR_API_KEY) {
    return {
      text:
        "Demo mode: OCR_SPACE_API_KEY is not configured.\n" +
        "Add your OCR.space API key in the Vercel project settings to enable real text OCR."
    };
  }

  const params = new URLSearchParams();
  params.append("base64Image", imageBase64);
  params.append("language", "eng");
  params.append("isTable", "true");
  params.append("OCREngine", "2");

  const response = await fetch(OCR_API_URL, {
    method: "POST",
    headers: { apikey: OCR_API_KEY },
    body: params
  });

  const data = await response.json();

  if (!response.ok || !data || data.IsErroredOnProcessing) {
    const message =
      (data && (data.ErrorMessage || data.ErrorDetails)) || "OCR API error";
    throw new Error(message);
  }

  let text = "";
  if (Array.isArray(data.ParsedResults) && data.ParsedResults.length > 0) {
    text = data.ParsedResults.map((r) => r.ParsedText || "").join("\n\n");
  }
  return { text: (text || "").trim() };
}


async function callGoogleVision(imageBase64) {
  if (!GOOGLE_VISION_API_KEY) return null;

  let content = imageBase64 || "";
  if (content.startsWith("data:")) {
    const commaIndex = content.indexOf(",");
    if (commaIndex !== -1) {
      content = content.slice(commaIndex + 1);
    }
  }

  const body = {
    requests: [
      {
        image: { content },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
      }
    ]
  };

  const endpoint =
    "https://vision.googleapis.com/v1/images:annotate?key=" +
    encodeURIComponent(GOOGLE_VISION_API_KEY);

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    let errText = "";
    try {
      errText = await resp.text();
    } catch (e) {
      errText = "";
    }
    console.error(
      "Google Vision HTTP error:",
      resp.status,
      errText && errText.slice ? errText.slice(0, 500) : errText
    );
    throw new Error("Google Vision HTTP " + resp.status);
  }

  const json = await resp.json();
  const responses = json && json.responses ? json.responses : [];
  if (!responses.length) {
    return { text: "" };
  }

  const ann = responses[0] || {};
  let text = "";

  if (ann.fullTextAnnotation && ann.fullTextAnnotation.text) {
    text = ann.fullTextAnnotation.text;
  } else if (
    Array.isArray(ann.textAnnotations) &&
    ann.textAnnotations.length &&
    ann.textAnnotations[0].description
  ) {
    text = ann.textAnnotations[0].description;
  }

  return { text: (text || "").trim() };
}

async function callOpenAIVision(imageBase64) {
  if (!OPENAI_API_KEY) return null;

  try {
    const body = {
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a vision assistant for a moving company inventory system. " +
            "Given a photo, identify the main object that would be added to an inventory, " +
            "its dominant colour, and a short human-friendly description. " +
            "Always respond with a JSON object with keys: item, colour, description."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Look at this photo and extract inventory information. " +
                'Respond ONLY with JSON. Example: {\"item\":\"chair\",\"colour\":\"blue\",\"description\":\"blue fabric chair\"}'
            },
            {
              type: "image_url",
              image_url: { url: imageBase64 }
            }
          ]
        }
      ]
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + OPENAI_API_KEY
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("OpenAI vision error HTTP:", resp.status, text);
      return null;
    }

    const json = await resp.json();
    const choice = json.choices && json.choices[0] && json.choices[0].message;
    if (!choice || !choice.content) return null;

    let parsed;
    try {
      parsed =
        typeof choice.content === "string"
          ? JSON.parse(choice.content)
          : choice.content;
    } catch (err) {
      console.error("Failed to parse OpenAI JSON content:", err);
      return null;
    }

    const item =
      parsed.item || parsed.itemName || parsed.object || parsed.mainItem;
    const colour =
      parsed.colour || parsed.color || parsed.colourName || parsed.mainColour;
    const description = parsed.description || parsed.summary || null;

    if (!item && !colour && !description) return null;

    return { item: item || "", colour: colour || "", description: description || "" };
  } catch (err) {
    console.error("AppyCrew OpenAI vision error:", err);
    return null;
  }
}

function extractBase64Data(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== "string") return null;
  const comma = imageBase64.indexOf(",");
  if (comma === -1) return imageBase64;
  return imageBase64.slice(comma + 1);
}

async function callGeminiVision(imageBase64) {
  if (!GEMINI_API_KEY) return null;

  try {
    const base64Data = extractBase64Data(imageBase64);
    if (!base64Data) return null;

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      GEMINI_MODEL +
      ":generateContent?key=" +
      encodeURIComponent(GEMINI_API_KEY);

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "You are a vision assistant for a moving company inventory system. " +
                "Look at this image and respond with JSON describing the main inventory item. " +
                'Use this exact JSON shape: {\"item\":\"chair\",\"colour\":\"blue\",\"description\":\"blue fabric chair\"}. ' +
                "Use UK English for colour names."
            },
            {
              inline_data: { mime_type: "image/jpeg", data: base64Data }
            }
          ]
        }
      ],
      generationConfig: { response_mime_type: "application/json" }
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Gemini vision error HTTP:", resp.status, text);
      return null;
    }

    const json = await resp.json();
    const candidates = json.candidates || [];
    if (!candidates.length) return null;
    const parts = (candidates[0].content && candidates[0].content.parts) || [];
    if (!parts.length || !parts[0].text) return null;

    let parsed;
    try {
      parsed =
        typeof parts[0].text === "string"
          ? JSON.parse(parts[0].text)
          : parts[0].text;
    } catch (err) {
      console.error("Failed to parse Gemini JSON content:", err);
      return null;
    }

    const item =
      parsed.item || parsed.itemName || parsed.object || parsed.mainItem;
    const colour =
      parsed.colour || parsed.color || parsed.colourName || parsed.mainColour;
    const description = parsed.description || parsed.summary || null;

    if (!item && !colour && !description) return null;

    return { item: item || "", colour: colour || "", description: description || "" };
  } catch (err) {
    console.error("AppyCrew Gemini vision error:", err);
    return null;
  }
}

async function callVision(imageBase64, textFromOcr) {
  if (VISION_MODE === "off") return null;

  const hasOpenAI = !!OPENAI_API_KEY;
  const hasGemini = !!GEMINI_API_KEY;

  if (!hasOpenAI && !hasGemini) return null;
  if (!shouldCallVision(textFromOcr || "")) return null;

  if (VISION_PROVIDER === "gemini" && hasGemini)
    return await callGeminiVision(imageBase64);
  if (VISION_PROVIDER === "openai" && hasOpenAI)
    return await callOpenAIVision(imageBase64);
  if (hasOpenAI) return await callOpenAIVision(imageBase64);
  if (hasGemini) return await callGeminiVision(imageBase64);
  return null;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const body = parseBody(req);
  const imageBase64 = body.imageBase64;
  const formType = body.formType || null;

  if (!imageBase64 || typeof imageBase64 !== "string") {
    res.status(400).json({ success: false, error: "Missing imageBase64" });
    return;
  }

  try {
    let text = "";
    let ocrProvider = "demo";

    // Prefer Google Vision when configured
    if (GOOGLE_VISION_API_KEY) {
      try {
        const gvResult = await callGoogleVision(imageBase64);
        text = (gvResult && gvResult.text) || "";
        if (text && text.trim()) {
          ocrProvider = "google-vision";
        }
      } catch (e) {
        console.error("Google Vision failed, falling back to OCR.space:", e);
      }
    }

    // Fallback to OCR.space if Google Vision is not configured or returned no useful text
    if ((!text || !text.trim()) && OCR_API_KEY) {
      const ocrResult = await callOcrSpace(imageBase64);
      const ocrText = (ocrResult && ocrResult.text) || "";
      if (ocrText && ocrText.trim()) {
        text = ocrText;
        ocrProvider = "ocr.space";
      } else if (!text) {
        text = ocrText;
      }
    }

    // If we still have nothing and no providers are configured, return demo message
    if (!text || !text.trim()) {
      if (!GOOGLE_VISION_API_KEY && !OCR_API_KEY) {
        text =
          "Demo mode: No OCR provider is configured.\n" +
          "Add GOOGLE_VISION_API_KEY or OCR_SPACE_API_KEY in the project settings to enable real text OCR.";
        ocrProvider = "demo";
      } else {
        text = "";
      }
    }

    // Strip common branding / tape noise
    text = stripBrandNoise(text || "");

    const visionResult = await callVision(imageBase64, text);

    res.status(200).json({
      success: true,
      text: text,
      vision: visionResult || null,
      meta: {
        formType,
        ocrProvider,
        aiProvider:
          visionResult && VISION_MODE !== "off"
            ? VISION_PROVIDER === "gemini"
              ? "gemini"
              : "openai"
            : null,
        aiEnabled: !!visionResult
      }
    });
  } catch (err) {
    console.error("AppyCrew OCR function error:", err);
    res
      .status(500)
      .json({ success: false, error: "Server error while running OCR / AI" });
  }
};
