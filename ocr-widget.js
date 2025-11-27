const OCR_API_URL =
  process.env.OCR_SPACE_API_URL || "https://api.ocr.space/parse/image";
const OCR_API_KEY = process.env.OCR_SPACE_API_KEY || null;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const VISION_PROVIDER = (process.env.VISION_PROVIDER || "openai").toLowerCase();
const VISION_MODE = (process.env.VISION_MODE || "fallback").toLowerCase();

// 🔹 BRAND NOISE FILTER: words/lines from tapes & logos we want to ignore
const BRAND_PATTERNS = [
  /appy\s*crew/i,
  /appycrew/i,
  /fragile/i,
  /handle\s+with\s+care/i
];

const BRAND_TOKENS = [
  "appycrew",
  "appy",
  "crew",
  "fragile",
  "handle",
  "care"
].map((t) => t.toLowerCase());

function stripBrandText(rawText) {
  if (!rawText) return "";
  const lines = rawText.split(/\r?\n/);
  const cleanedLines = [];

  lines.forEach((line) => {
    let l = line.trim();
    if (!l) return;

    // Drop full lines that clearly look like branding
    if (BRAND_PATTERNS.some((re) => re.test(l))) {
      return;
    }

    const tokens = l.split(/\s+/);
    const keptTokens = tokens.filter((t) => {
      const norm = t.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (!norm) return false;
      if (BRAND_TOKENS.includes(norm)) return false;
      return true;
    });

    if (!keptTokens.length) {
      // Line was only branding
      return;
    }

    const cleanedLine = keptTokens.join(" ");
    if (cleanedLine.trim()) {
      cleanedLines.push(cleanedLine);
    }
  });

  return cleanedLines.join("\n");
}

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
  "screen",
  "computer",
  "pc",
  "laptop",
  "bookcase",
  "shelf",
  "shelving",
  "cupboard",
  "cabinet",
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
];

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
    // Demo mode – just return placeholder text
    return {
      text: "Demo OCR mode – please configure OCR_SPACE_API_KEY"
    };
  }

  const base64Data = extractBase64Data(imageBase64);
  const formData = new URLSearchParams();
  formData.append("base64Image", "data:image/jpeg;base64," + base64Data);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");

  const resp = await fetch(OCR_API_URL, {
    method: "POST",
    headers: {
      apikey: OCR_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData.toString()
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("AppyCrew OCR HTTP error", resp.status, text);
    throw new Error("OCR HTTP error " + resp.status);
  }

  const data = await resp.json();
  if (!data || !data.ParsedResults || !data.ParsedResults.length) {
    console.error("AppyCrew OCR logical error", data);
    throw new Error("No OCR results");
  }

  const parsed = data.ParsedResults[0];
  const text = parsed.ParsedText || "";
  return { text };
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  let raw = req.body;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  return {};
}

async function callOpenAIVision(imageBase64) {
  if (!OPENAI_API_KEY) return null;

  const body = {
    model: OPENAI_MODEL,
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
              'Respond ONLY with JSON. Example: {"item":"chair","colour":"blue","description":"blue fabric chair"}'
          },
          {
            type: "image_url",
            image_url: { url: imageBase64 }
          }
        ]
      }
    ]
  };

  try {
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
      console.error("AppyCrew OpenAI vision HTTP error", resp.status, text);
      return null;
    }

    const data = await resp.json();
    const choice = data.choices && data.choices[0] && data.choices[0].message;
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

async function callGeminiVision(imageBase64) {
  if (!GEMINI_API_KEY) return null;

  const base64Data = extractBase64Data(imageBase64);

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "You are a vision assistant for a moving company inventory system. " +
              "Given a photo, identify the main object that would be added to an inventory, " +
              "its dominant colour, and a short human-friendly description. " +
              "Respond ONLY with JSON: {\"item\":\"...\",\"colour\":\"...\",\"description\":\"...\"}"
          },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Data
            }
          }
        ]
      }
    ]
  };

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify(body)
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      console.error("AppyCrew Gemini vision HTTP error", resp.status, text);
      return null;
    }

    const data = await resp.json();
    const c =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0];

    if (!c || !c.text) return null;

    let parsed;
    try {
      parsed = JSON.parse(c.text);
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

function extractBase64Data(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== "string") return null;
  const comma = imageBase64.indexOf(",");
  if (comma === -1) return imageBase64;
  return imageBase64.slice(comma + 1);
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
    const ocrResult = await callOcrSpace(imageBase64);
    const textRaw = (ocrResult && ocrResult.text) || "";
    const text = stripBrandText(textRaw); // 🔹 clean branding noise here
    const visionResult = await callVision(imageBase64, text);

    res.status(200).json({
      success: true,
      text: text,
      vision: visionResult || null,
      meta: {
        formType,
        ocrProvider: OCR_API_KEY ? "ocr.space" : "demo",
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
