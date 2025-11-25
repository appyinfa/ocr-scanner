# AppyCrew OCR + Vision Widget (v5)

This version adds:

- Better UX:
  - Smaller, icon-style button on mobile (text hidden under 480px wide).
  - Status messages during scan.
  - Auto-close panel shortly after applying values.
  - Simple "Undo last apply" to restore previous field values.
- OCR-first, AI-second flow:
  - Always runs OCR.space first.
  - Uses simple directories (items, locations) to decide if AI is needed.
  - Only calls AI when `VISION_MODE=fallback` and OCR text doesn’t clearly contain known
    item/location words or is very short.
- Directories:
  - Location words (e.g. “living room”, “MBR”, “kitchen”, etc.).
  - Item words (e.g. “wardrobe”, “mattress”, “chair”, “TV”, etc.).
  - Used both for field mapping and for deciding whether to call AI.
- Multi-item support:
  - When multiple known item words are detected in the text, they are joined
    into a comma-separated list and used for “Item” fields (e.g. `Chair, Table`).
- Gemini support:
  - Optional Gemini Vision support alongside OpenAI.
  - Provider controlled via `VISION_PROVIDER` env var.

## Files

- `index.html` – Demo page with an inventory-style form.
- `ocr-widget.js` – The floating widget injected on any form page.
- `api/ocr.js` – Vercel serverless function that calls OCR.space + OpenAI or Gemini.
- `README.md` – This file.

## Deploy (GitHub + Vercel)

1. Create or reuse a GitHub repo.
2. Upload these files into the **root** of the repo (not inside a subfolder).
3. In Vercel:
   - Import the repo as a project.
   - Framework preset: **Other**.
   - Build command: leave blank.
   - Output directory: leave blank.

In **Vercel → Project → Settings → Environment Variables**:

- `OCR_SPACE_API_KEY` – your OCR.space key (required for real OCR).
- `OPENAI_API_KEY` – your OpenAI key (optional, for OpenAI Vision).
- `OPENAI_MODEL` – defaults to `gpt-4o-mini`.
- `GEMINI_API_KEY` – your Gemini key (optional, for Gemini Vision).
- `GEMINI_MODEL` – defaults to `gemini-1.5-flash`.
- `VISION_PROVIDER` – `openai` or `gemini` (default `openai`).
- `VISION_MODE` –
  - `fallback` (default): only call AI when OCR text doesn’t clearly contain known
    item/location words or is very short.
  - `always`: always call AI as well as OCR.
  - `off`: never call AI, OCR-only mode.

After deployment you should have:

- Demo page: `https://YOUR-PROJECT.vercel.app/`
- Widget script: `https://YOUR-PROJECT.vercel.app/ocr-widget.js`
- API route: `https://YOUR-PROJECT.vercel.app/api/ocr`

## Use in your real app

On any page that has a `<form>`, add:

```html
<script src="https://YOUR-PROJECT.vercel.app/ocr-widget.js" defer></script>
```

The widget will:

- Only appear if there is at least one `<form>`.
- Let the user pick or capture an image.
- Compress the image client-side.
- Send it to `/api/ocr` (OCR-first, AI-second).
- Suggest mappings for fields like Item, Quantity, Description, Location,
  Email, Phone, Address, etc.
- Allow the user to review, untick anything, and apply in one click.
- Provide an "Undo last apply" within the same panel.

## Notes on directories and multi-items

- Directories (items & locations) are currently hard-coded in both the widget
  and the backend. In a future phase, these could come from a database and
  be managed via an admin panel.
- When the OCR text contains several known items (e.g. “2 chairs, 1 table”),
  they are combined like `Chair, Table` for fields labelled “Item”. This is a
  safe generic behaviour that works even when the host form only has a single
  Item field.
