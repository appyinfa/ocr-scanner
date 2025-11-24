const OCR_API_URL = process.env.OCR_SPACE_API_URL || "https://api.ocr.space/parse/image";
const OCR_API_KEY = process.env.OCR_SPACE_API_KEY || null;

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
  const formType = body.formType || null; // reserved for future use

  if (!imageBase64 || typeof imageBase64 !== "string") {
    res.status(400).json({ success: false, error: "Missing imageBase64" });
    return;
  }

  if (!OCR_API_KEY) {
    // Demo mode without real OCR backend
    res.status(200).json({
      success: true,
      text:
        "Demo mode: OCR_SPACE_API_KEY is not configured.\n" +
        "Add your OCR.space API key in the Vercel project settings to enable real OCR."
    });
    return;
  }

  try {
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
        (data && (data.ErrorMessage || data.ErrorDetails)) ||
        "OCR API error";
      res.status(500).json({ success: false, error: message });
      return;
    }

    let text = "";
    if (Array.isArray(data.ParsedResults) && data.ParsedResults.length > 0) {
      text = data.ParsedResults
        .map((r) => r.ParsedText || "")
        .join("\n\n");
    }

    res.status(200).json({
      success: true,
      text: (text || "").trim()
    });
  } catch (err) {
    console.error("AppyCrew OCR function error:", err);
    res
      .status(500)
      .json({ success: false, error: "Server error while running OCR" });
  }
};
