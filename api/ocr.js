/**
 * AppyCrew OCR API Endpoint
 * Vercel Serverless Function
 * 
 * Supports:
 * - Google Cloud Vision API (primary)
 * - OCR.space API (fallback)
 * 
 * Environment Variables Required:
 * - GOOGLE_VISION_API_KEY (for Google Cloud Vision)
 * - OCR_SPACE_API_KEY (for OCR.space fallback)
 * 
 * At least one API key must be configured.
 */

// CORS headers for cross-origin requests
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

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Only allow POST
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

    // Extract base64 data from data URL
    const base64Data = extractBase64(image);
    if (!base64Data) {
      return res.status(400).json({ 
        error: 'Invalid image format',
        message: 'Image must be a valid base64 data URL (e.g., data:image/jpeg;base64,...)'
      });
    }

    let result = null;
    let provider = null;

    // Try Google Vision API first
    if (process.env.GOOGLE_VISION_API_KEY) {
      try {
        result = await callGoogleVision(base64Data);
        provider = 'google-vision';
      } catch (error) {
        console.error('Google Vision API error:', error.message);
      }
    }

    // Fallback to OCR.space
    if (!result && process.env.OCR_SPACE_API_KEY) {
      try {
        result = await callOcrSpace(base64Data);
        provider = 'ocr-space';
      } catch (error) {
        console.error('OCR.space API error:', error.message);
      }
    }

    // If no API keys configured or all failed
    if (!result) {
      const hasGoogleKey = !!process.env.GOOGLE_VISION_API_KEY;
      const hasOcrSpaceKey = !!process.env.OCR_SPACE_API_KEY;
      
      if (!hasGoogleKey && !hasOcrSpaceKey) {
        return res.status(500).json({
          error: 'No OCR service configured',
          message: 'Set GOOGLE_VISION_API_KEY or OCR_SPACE_API_KEY in environment variables'
        });
      }
      
      return res.status(500).json({
        error: 'OCR processing failed',
        message: 'All OCR providers failed. Check API keys and try again.'
      });
    }

    // Clean the result text
    const cleanedText = cleanOcrText(result);

    return res.status(200).json({
      success: true,
      text: cleanedText,
      rawText: result,
      provider: provider
    });

  } catch (error) {
    console.error('OCR API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred'
    });
  }
}

/**
 * Extract base64 data from data URL
 */
function extractBase64(dataUrl) {
  if (!dataUrl) return null;
  
  // If it's already raw base64 (no prefix)
  if (!dataUrl.includes(',') && !dataUrl.includes(':')) {
    return dataUrl;
  }
  
  // Extract from data URL format
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (match) {
    return match[1];
  }
  
  // Try splitting by comma as fallback
  const parts = dataUrl.split(',');
  if (parts.length === 2) {
    return parts[1];
  }
  
  return null;
}

/**
 * Call Google Cloud Vision API
 */
async function callGoogleVision(base64Data) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  const requestBody = {
    requests: [{
      image: {
        content: base64Data
      },
      features: [
        { type: 'TEXT_DETECTION', maxResults: 10 },
        { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
      ]
    }]
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Google Vision API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  
  // Try to get full text annotation first (better for documents)
  const fullTextAnnotation = data.responses?.[0]?.fullTextAnnotation?.text;
  if (fullTextAnnotation) {
    return fullTextAnnotation;
  }
  
  // Fallback to text annotations
  const textAnnotations = data.responses?.[0]?.textAnnotations;
  if (textAnnotations && textAnnotations.length > 0) {
    return textAnnotations[0].description;
  }

  return '';
}

/**
 * Call OCR.space API
 */
async function callOcrSpace(base64Data) {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  const endpoint = 'https://api.ocr.space/parse/image';

  const formData = new URLSearchParams();
  formData.append('apikey', apiKey);
  formData.append('base64Image', `data:image/jpeg;base64,${base64Data}`);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2'); // Engine 2 is better for most cases

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString()
  });

  if (!response.ok) {
    throw new Error(`OCR.space API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.IsErroredOnProcessing) {
    throw new Error(`OCR.space processing error: ${data.ErrorMessage || 'Unknown error'}`);
  }

  // Extract text from parsed results
  const parsedResults = data.ParsedResults;
  if (parsedResults && parsedResults.length > 0) {
    return parsedResults.map(r => r.ParsedText).join('\n');
  }

  return '';
}

/**
 * Clean OCR text - remove noise and normalize
 */
function cleanOcrText(text) {
  if (!text) return '';
  
  // Brand/noise words to remove
  const noisePatterns = [
    /\bappycrew\b/gi,
    /\bfragile\b/gi,
    /\bhandle with care\b/gi,
    /\bthis side up\b/gi,
    /\bheavy\b/gi,
    /\bdo not stack\b/gi,
    /\bkeep dry\b/gi,
  ];
  
  let cleaned = text;
  
  // Remove noise patterns
  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Normalize whitespace
  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^ +| +$/gm, '')
    .trim();
  
  return cleaned;
}
