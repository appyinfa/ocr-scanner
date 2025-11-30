# AppyCrew OCR Widget v10

A smart OCR widget for form auto-filling, optimized for moving and storage inventory forms.

## Quick Start

### 1. Deploy to Vercel

Upload these files to your GitHub repository:

```
your-repo/
├── api/
│   ├── ocr.js          # OCR endpoint (required)
│   └── vision.js       # Vision AI endpoint (optional)
├── public/
│   └── ocr-widget-production.js   # The widget
└── package.json
```

### 2. Set Environment Variables

In your Vercel project settings, add at least one OCR API key:

#### Required (choose at least one):
| Variable | Description | Get it from |
|----------|-------------|-------------|
| `GOOGLE_VISION_API_KEY` | Google Cloud Vision API | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `OCR_SPACE_API_KEY` | OCR.space API (free tier available) | [OCR.space](https://ocr.space/ocrapi) |

#### Optional (for enhanced AI analysis):
| Variable | Description | Get it from |
|----------|-------------|-------------|
| `OPENAI_API_KEY` | OpenAI GPT-4 Vision | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `GOOGLE_GEMINI_API_KEY` | Google Gemini Vision | [Google AI Studio](https://aistudio.google.com/app/apikey) |

### 3. Embed the Widget

Add this to any webpage with a form:

```html
<script src="https://your-app.vercel.app/ocr-widget-production.js" defer></script>
```

That's it! The widget will automatically:
- Detect forms on the page
- Show a floating action button
- Extract text from images
- Map data to form fields

## Configuration Options

### Custom API Base

If your API is hosted separately:

```html
<script>
  window.APPYCREW_OCR_API_BASE = 'https://your-api-server.com';
</script>
<script src="https://cdn.example.com/ocr-widget-production.js" defer></script>
```

### Field Type Hints

Add `data-appycrew-type` attributes for better mapping accuracy:

```html
<input type="text" name="item" data-appycrew-type="item">
<input type="number" name="qty" data-appycrew-type="quantity">
<select name="room" data-appycrew-type="location">...</select>
<textarea name="desc" data-appycrew-type="description"></textarea>
<textarea name="notes" data-appycrew-type="notes"></textarea>
```

Supported type hints:
- `item` - Item name/type
- `quantity` - Number of items
- `location` - Room/area
- `description` - Item description
- `notes` - Additional notes

## Features

- 📷 **Image OCR** - Scan labels, documents, inventory sheets
- 🎤 **Voice Input** - Speak to fill forms
- 🎯 **Smart Mapping** - Fuzzy matching with confidence scores
- 📱 **Mobile Optimized** - Works great on phones
- ⌨️ **Keyboard Shortcuts** - Ctrl+Shift+S (scan), Ctrl+Shift+V (voice)
- ↩️ **Undo Support** - Revert changes with one click

## API Endpoints

### POST /api/ocr

Extract text from an image.

**Request:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Response:**
```json
{
  "success": true,
  "text": "Extracted text content",
  "provider": "google-vision"
}
```

### POST /api/vision

AI-powered structured data extraction (optional).

**Request:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Response:**
```json
{
  "success": true,
  "item": "Oak Wardrobe",
  "description": "Large wooden wardrobe with mirror doors",
  "location": "master bedroom",
  "quantity": 1,
  "condition": "Good, minor scratches",
  "provider": "openai"
}
```

## Troubleshooting

### "Processing failed" error

1. Open browser DevTools (F12) → Console tab
2. Look for `[AppyCrew OCR]` messages
3. Common issues:
   - **404**: API endpoint not found - check deployment
   - **CORS error**: API not allowing cross-origin requests
   - **500**: Check Vercel function logs for errors
   - **No API key**: Set environment variables in Vercel

### Widget not appearing

- Ensure there's at least one `<form>` on the page
- Check console for JavaScript errors
- Verify the script loaded (Network tab)

### Fields not mapping correctly

- Add `data-appycrew-type` attributes to inputs
- Ensure labels are properly associated with inputs
- Check that inputs are visible (not hidden/disabled)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 14+)
- Chrome Android

## License

Proprietary - AppyCrew

## Support

- Documentation: docs.appycrew.com
- Email: support@appycrew.com
