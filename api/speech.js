/**
 * AppyCrew Speech-to-Text API Endpoint
 * Vercel Serverless Function
 * 
 * Uses Google Cloud Speech-to-Text API for reliable voice transcription
 * across all devices including iOS.
 * 
 * Environment Variables Required:
 * - GOOGLE_SPEECH_API_KEY (Google Cloud API key with Speech-to-Text enabled)
 * 
 * Alternative (using service account):
 * - GOOGLE_SERVICE_ACCOUNT_JSON (full JSON service account credentials)
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
      message: 'Use POST with { "audio": "base64_audio_data", "mimeType": "audio/webm" }'
    });
  }

  try {
    const { audio, mimeType = 'audio/webm', languageCode = 'en-US' } = req.body;

    if (!audio) {
      return res.status(400).json({ 
        error: 'Missing audio',
        message: 'Request body must include "audio" field with base64 audio data'
      });
    }

    // Extract base64 data if it's a data URL
    const base64Audio = extractBase64(audio);
    if (!base64Audio) {
      return res.status(400).json({ 
        error: 'Invalid audio format',
        message: 'Audio must be base64 encoded'
      });
    }

    // Determine encoding from mimeType
    const encoding = getAudioEncoding(mimeType);
    
    let result = null;

    // Try Google Speech-to-Text API
    if (process.env.GOOGLE_SPEECH_API_KEY) {
      result = await callGoogleSpeechToText(base64Audio, encoding, languageCode);
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      result = await callGoogleSpeechWithServiceAccount(base64Audio, encoding, languageCode);
    }

    if (!result) {
      if (!process.env.GOOGLE_SPEECH_API_KEY && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        return res.status(500).json({
          error: 'Speech API not configured',
          message: 'Set GOOGLE_SPEECH_API_KEY in environment variables'
        });
      }
      
      return res.status(500).json({
        error: 'Speech recognition failed',
        message: 'Could not transcribe audio. Try speaking more clearly.'
      });
    }

    return res.status(200).json({
      success: true,
      text: result.text,
      confidence: result.confidence,
      languageCode: languageCode
    });

  } catch (error) {
    console.error('Speech API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred'
    });
  }
}

/**
 * Extract base64 data from data URL or raw base64
 */
function extractBase64(data) {
  if (!data) return null;
  
  // If it's a data URL, extract the base64 part
  if (data.includes(',')) {
    return data.split(',')[1];
  }
  
  // Already raw base64
  return data;
}

/**
 * Map MIME type to Google Speech encoding
 */
function getAudioEncoding(mimeType) {
  const encodingMap = {
    'audio/webm': 'WEBM_OPUS',
    'audio/webm;codecs=opus': 'WEBM_OPUS',
    'audio/ogg': 'OGG_OPUS',
    'audio/ogg;codecs=opus': 'OGG_OPUS',
    'audio/mp3': 'MP3',
    'audio/mpeg': 'MP3',
    'audio/wav': 'LINEAR16',
    'audio/x-wav': 'LINEAR16',
    'audio/flac': 'FLAC',
    'audio/mp4': 'MP3', // Approximation
    'audio/aac': 'MP3', // Approximation
    'audio/m4a': 'MP3', // Approximation
  };
  
  return encodingMap[mimeType.toLowerCase()] || 'WEBM_OPUS';
}

/**
 * Call Google Cloud Speech-to-Text API with API key
 */
async function callGoogleSpeechToText(base64Audio, encoding, languageCode) {
  const apiKey = process.env.GOOGLE_SPEECH_API_KEY;
  const endpoint = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

  const requestBody = {
    config: {
      encoding: encoding,
      sampleRateHertz: encoding === 'WEBM_OPUS' ? 48000 : 16000,
      languageCode: languageCode,
      enableAutomaticPunctuation: true,
      model: 'latest_short', // Optimized for short utterances
      useEnhanced: true,
      // Alternative languages for better recognition
      alternativeLanguageCodes: languageCode === 'en-US' ? ['en-GB', 'en-AU'] : [],
      // Speech context for inventory-related words
      speechContexts: [{
        phrases: [
          // Items
          'wardrobe', 'sofa', 'couch', 'table', 'chair', 'desk', 'bed', 'mattress',
          'dresser', 'cabinet', 'bookcase', 'shelf', 'lamp', 'mirror', 'box', 'carton',
          // Locations
          'bedroom', 'living room', 'kitchen', 'bathroom', 'garage', 'attic', 'basement',
          'dining room', 'office', 'study', 'hallway', 'master bedroom', 'guest room',
          // Descriptors
          'wooden', 'metal', 'glass', 'leather', 'fabric', 'antique', 'modern',
          'large', 'small', 'heavy', 'fragile', 'scratched', 'damaged', 'good condition'
        ],
        boost: 10
      }]
    },
    audio: {
      content: base64Audio
    }
  };

  console.log('[Speech API] Calling Google Speech-to-Text, encoding:', encoding);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Speech API] Google error:', response.status, errorData);
    throw new Error(`Google Speech API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[Speech API] Response:', JSON.stringify(data).substring(0, 200));

  // Extract transcription
  const results = data.results;
  if (!results || results.length === 0) {
    console.log('[Speech API] No results returned');
    return null;
  }

  // Combine all transcriptions
  let fullText = '';
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const result of results) {
    const alternative = result.alternatives?.[0];
    if (alternative) {
      fullText += alternative.transcript + ' ';
      if (alternative.confidence) {
        totalConfidence += alternative.confidence;
        confidenceCount++;
      }
    }
  }

  fullText = fullText.trim();
  const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0.8;

  if (!fullText) {
    return null;
  }

  return {
    text: fullText,
    confidence: avgConfidence
  };
}

/**
 * Call Google Speech-to-Text with Service Account (for higher quotas)
 */
async function callGoogleSpeechWithServiceAccount(base64Audio, encoding, languageCode) {
  // Parse service account JSON
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    console.error('[Speech API] Invalid service account JSON');
    throw new Error('Invalid service account configuration');
  }

  // Get access token using service account
  const accessToken = await getAccessToken(serviceAccount);
  
  const endpoint = 'https://speech.googleapis.com/v1/speech:recognize';
  
  const requestBody = {
    config: {
      encoding: encoding,
      sampleRateHertz: encoding === 'WEBM_OPUS' ? 48000 : 16000,
      languageCode: languageCode,
      enableAutomaticPunctuation: true,
      model: 'latest_short',
      useEnhanced: true
    },
    audio: {
      content: base64Audio
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Google Speech API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const results = data.results;
  
  if (!results || results.length === 0) {
    return null;
  }

  let fullText = '';
  for (const result of results) {
    const alternative = result.alternatives?.[0];
    if (alternative) {
      fullText += alternative.transcript + ' ';
    }
  }

  return {
    text: fullText.trim(),
    confidence: 0.9
  };
}

/**
 * Get OAuth2 access token from service account
 */
async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  // Create JWT (simplified - in production use a proper JWT library)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  // Note: This requires the 'crypto' module for signing
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${claims}`);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');
  
  const jwt = `${header}.${claims}.${signature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to get access token');
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}
