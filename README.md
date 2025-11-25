# AppyCrew OCR + Vision Widget (v4)

This folder is a drop-in project for GitHub + Vercel.
It gives you a floating “Scan with AppyCrew” widget that:

- Opens the camera / photo picker.
- Compresses the image on the client so it fits Vercel limits.
- Sends it to `/api/ocr`.
- `/api/ocr` calls:
  - **OCR.space** for text OCR.
  - **OpenAI** vision for object + colour + description.
- Suggests field mappings (Item, Description, Qty, etc.) and applies
  them into the current page’s form.

## Deploy steps

1. Create a new GitHub repo (or reuse your existing OCR widget repo).
2. Upload these files to the **root** of the repo:
   - `index.html`
   - `ocr-widget.js`
   - `api/ocr.js`
   - `README.md`
3. In Vercel, import this repo as a new project or point your existing
   widget project at it.
   - Framework preset: **Other**
   - Build command: **empty**
   - Output directory: **empty**
4. In Vercel → Project → Settings → Environment Variables, add:
   - `OCR_SPACE_API_KEY` – your OCR.space key.
   - `OPENAI_API_KEY` – your OpenAI key (optional but recommended).

After deploy you’ll have:

- Demo page: `https://YOUR-PROJECT.vercel.app/`
- Widget script: `https://YOUR-PROJECT.vercel.app/ocr-widget.js`
- API route: `https://YOUR-PROJECT.vercel.app/api/ocr`

## Use in your real app

On any page that has a `<form>`, include:

```html
<script src="https://YOUR-PROJECT.vercel.app/ocr-widget.js" defer></script>
```

The widget only appears if there is at least one `<form>` element.

## Notes

- Client-side compression keeps uploads to a reasonable size for Vercel.
- The backend is defensive about `req.body` being either a string or object.
- If keys are missing, you’ll get demo text (for OCR) and no AI vision.
