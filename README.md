# AppyCrew OCR + Vision Widget (v8)

This version focuses on:
- Speed & SPA reliability
- Field-level accuracy on long multi-section forms
- Cleaner text extraction from OCR (no more copying labels like "Name:")

## Key Improvements

**1. SPA-aware form detection**
- Uses `MutationObserver` to watch for `<form>` elements being added/removed.
- Works well with Next.js / single-page app navigation and mobile webviews.
- The floating button only shows when at least one form is present.

**2. Visible-field targeting**
- The widget now only maps into fields that are actually visible in the viewport.
- This is ideal for large forms where different sections (e.g. Items vs Job details)
  are visible at different scroll positions.

**3. Smarter label/value extraction**
- OCR text is pre-processed to remove pure labels and keep only the value part.
- Examples:
    - "Name: John" -> "John"
    - "Job No - 1042" -> "1042"
    - A line that is just "Description" or "Location" is discarded.
- This prevents titles/headings from being copied into fields.

**4. Optional per-field hints**
- You can guide the widget by adding `data-appycrew-type` on fields:
    - `data-appycrew-type="item"`
    - `data-appycrew-type="location"`
    - `data-appycrew-type="qty"`
    - `data-appycrew-type="notes"`
    - `data-appycrew-type="name"`
    - `data-appycrew-type="job-id"`
- These hints are used before generic heuristics to choose the best value.

**5. OCR-first, AI-second backend (OpenAI or Gemini)**
- Same API contract as previous versions:
    - `POST /api/ocr { imageBase64 }`
    - Returns `{ success, text, vision, meta }`
- VISION_MODE & VISION_PROVIDER environment variables control when and which
  vision provider is used (OpenAI or Gemini).

## Deploying

1. Upload these files to a GitHub repo.
2. Import into Vercel as framework "Other".
3. Set environment variables:
    - `OCR_SPACE_API_KEY`
    - `OPENAI_API_KEY` (optional)
    - `GEMINI_API_KEY` (optional)
    - `VISION_PROVIDER` = `openai` or `gemini`
    - `VISION_MODE` = `fallback` (default), `always`, or `off`
4. After deploy, your widget URL is:

    https://YOUR-PROJECT.vercel.app/ocr-widget.js

5. In your SaaS app layout, include:

    <Script
      src="https://YOUR-PROJECT.vercel.app/ocr-widget.js"
      strategy="afterInteractive"
    />

The widget will appear on any page that has at least one <form>, and will
target the fields currently visible on screen.
