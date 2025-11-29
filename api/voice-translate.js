// Simple translation endpoint for AppyCrew Voice.
// Uses OpenAI to translate any language → concise English inventory phrases.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res
        .status(405)
        .json({ success: false, error: "Method not allowed" });
      return;
    }

    const body = req.body || {};
    const text = (body.text || "").toString();
    if (!text) {
      res
        .status(400)
        .json({ success: false, error: "Missing text" });
      return;
    }

    // If no OpenAI key, just echo the original text back
    if (!OPENAI_API_KEY) {
      res.status(200).json({ success: false, text });
      return;
    }

    const prompt =
      "You are helping a moving-company inventory system.\n" +
      "Translate the following text into clear, concise English suitable for item, description, location and notes fields.\n" +
      "Keep item names, colours and room names. Do NOT add explanations. " +
      "Return ONLY the translated text, nothing else.\n\n" +
      text;

    const resp = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + OPENAI_API_KEY
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        })
      }
    );

    if (!resp.ok) {
      let errTxt = "";
      try {
        errTxt = await resp.text();
      } catch (e) {
        errTxt = "";
      }
      console.error(
        "voice-translate OpenAI error:",
        resp.status,
        errTxt && errTxt.slice ? errTxt.slice(0, 400) : errTxt
      );
      res.status(200).json({ success: false, text });
      return;
    }

    const data = await resp.json();
    const choice =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;
    const translated = (choice || "").toString().trim() || text;

    res.status(200).json({ success: true, text: translated });
  } catch (err) {
    console.error("voice-translate handler error:", err);
    res.status(200).json({ success: false, text: req.body?.text || "" });
  }
};
