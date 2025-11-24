const OCR_API_URL =
  process.env.OCR_SPACE_API_URL || "https://api.ocr.space/parse/image";
const OCR_API_KEY = process.env.OCR_SPACE_API_KEY || null;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

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
    headers: {
      apikey: OCR_API_KEY
    },
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

async function callOpenAIVision(imageBase64) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  try {
    const body = {
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a vision assistant for a moving company inventory system. " +
            "Given a photo, identify the single main object that would be added to an inventory, " +
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
                "Respond ONLY with JSON. Example: {"item":"chair","colour":"blue","description":"blue fabric dining chair"}"
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64
              }
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
    const choice =
      json.choices && json.choices[0] && json.choices[0].message;
    if (!choice || !choice.content) {
      return null;
    }

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

    if (!item && !colour && !description) {
      return null;
    }

    return {
      item: item || "",
      colour: colour || "",
      description: description || ""
    };
  } catch (err) {
    console.error("AppyCrew OpenAI vision error:", err);
    return null;
  }
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

  const body = req.body || {};
  const imageBase64 = body.imageBase64;
  const formType = body.formType || null; // reserved for future use / AI hints

  if (!imageBase64 || typeof imageBase64 !== "string") {
    res.status(400).json({ success: false, error: "Missing imageBase64" });
    return;
  }

  try {
    const [ocrResult, visionResult] = await Promise.all([
      callOcrSpace(imageBase64),
      callOpenAIVision(imageBase64)
    ]);

    res.status(200).json({
      success: true,
      text: (ocrResult && ocrResult.text) || "",
      vision: visionResult || null,
      meta: {
        formType: formType,
        ocrProvider: OCR_API_KEY ? "ocr.space" : "demo",
        aiEnabled: !!OPENAI_API_KEY
      }
    });
  } catch (err) {
    console.error("AppyCrew OCR function error:", err);
    res
      .status(500)
      .json({ success: false, error: "Server error while running OCR / AI" });
  }
};
