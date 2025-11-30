/**
 * AppyCrew Vision API Endpoint
 * Vercel Serverless Function
 * 
 * Uses AI vision models to intelligently extract structured data from images.
 * 
 * Supports:
 * - OpenAI GPT-4 Vision (primary)
 * - Google Gemini Vision (fallback)
 * 
 * Environment Variables:
 * - OPENAI_API_KEY (for GPT-4 Vision)
 * - GOOGLE_GEMINI_API_KEY (for Gemini Vision)
 * 
 * This endpoint is optional - the widget works with just OCR,
 * but Vision provides better structured data extraction.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// System prompt for extracting inventory data
const EXTRACTION_PROMPT = `You are an expert at analyzing images of furniture, household items, and moving inventory. 

Analyze this image and extract the following information:
- item: The main item name (e.g., "Oak Wardrobe", "Blue Sofa", "Dining Table")
- description: Physical description including color, material, size, condition
- location: If visible or can be inferred, where the item might be located (e.g., "bedroom", "living room")
- quantity: Number of items if multiple are visible (default to 1)
- condition: Any visible damage, wear, or notable condition details
- notes: Any other relevant observations

Respond ONLY with valid JSON in this exact format:
{
  "item": "string or null",
  "description": "string or null", 
  "location": "string or null",
  "quantity": number or null,
  "condition": "string or null",
  "notes": "string or null"
}

If you cannot identify something, use null for that field. Be concise but accurate.`;

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Use POST with { "image": "base64_data_url" }'
    });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ 
        error: 'Missing image',
        message: 'Request body must include "image" field with base64 data URL'
      });
    }

    let result = null;
    let provider = null;

    // Try OpenAI GPT-4 Vision first
    if (process.env.OPENAI_API_KEY) {
      try {
        result = await callOpenAIVision(image);
        provider = 'openai';
      } catch (error) {
        console.error('OpenAI Vision error:', error.message);
      }
    }

    // Fallback to Google Gemini
    if (!result && process.env.GOOGLE_GEMINI_API_KEY) {
      try {
        result = await callGeminiVision(image);
        provider = 'gemini';
      } catch (error) {
        console.error('Gemini Vision error:', error.message);
      }
    }

    // If no API keys configured
    if (!result) {
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasGemini = !!process.env.GOOGLE_GEMINI_API_KEY;
      
      if (!hasOpenAI && !hasGemini) {
        return res.status(200).json({
          success: false,
          message: 'Vision API not configured (optional)',
          item: null,
          description: null
        });
      }
      
      return res.status(200).json({
        success: false,
        message: 'Vision processing failed',
        item: null,
        description: null
      });
    }

    return res.status(200).json({
      success: true,
      provider: provider,
      ...result
    });

  } catch (error) {
    console.error('Vision API Error:', error);
    return res.status(200).json({
      success: false,
      error: error.message,
      item: null,
      description: null
    });
  }
}

/**
 * Call OpenAI GPT-4 Vision API
 */
async function callOpenAIVision(imageDataUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Cost-effective vision model
      messages: [
        {
          role: 'system',
          content: EXTRACTION_PROMPT
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
                detail: 'low' // Use low detail for faster/cheaper processing
              }
            },
            {
              type: 'text',
              text: 'Analyze this image and extract inventory item details.'
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.2 // Lower temperature for more consistent extraction
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  // Parse JSON from response
  return parseJsonResponse(content);
}

/**
 * Call Google Gemini Vision API
 */
async function callGeminiVision(imageDataUrl) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  // Extract base64 and mime type
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image data URL format');
  }
  const [, mimeType, base64Data] = match;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            text: EXTRACTION_PROMPT + '\n\nAnalyze this image and extract inventory item details.'
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('No response from Gemini');
  }

  return parseJsonResponse(content);
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
function parseJsonResponse(content) {
  let jsonStr = content.trim();
  
  // Remove markdown code blocks if present
  jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  
  try {
    const parsed = JSON.parse(jsonStr);
    
    // Ensure all expected fields exist
    return {
      item: parsed.item || null,
      description: parsed.description || null,
      location: parsed.location || null,
      quantity: parsed.quantity || null,
      condition: parsed.condition || null,
      notes: parsed.notes || null
    };
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    throw new Error('Failed to parse AI response as JSON');
  }
}
