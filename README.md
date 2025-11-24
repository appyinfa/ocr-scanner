# AppyCrew OCR + Vision Widget (v2)

A lightweight, branded widget that you can drop onto any form page.
It shows a floating “Scan with AppyCrew” button, opens the camera,
sends the image to a backend API, and then:

- Uses **OCR.space** to extract text.
- Uses **OpenAI vision** to recognise the main object, colour and description
  (e.g. “blue chair” → item: chair, colour: blue, description: "blue chair").
- Tries to **auto-match** the results to your form fields
  (item, qty, description, name, email, address, etc.).
- Lets the user review and apply the values in one click.

You do **not** need to run anything locally. Just upload this folder to
GitHub and connect it to Vercel.

## 1. Deploying (GitHub + Vercel)

1. Create a new GitHub repo (or reuse the old one).
2. Upload these files to the repo root (not inside another folder):
   - `index.html`
   - `ocr-widget.js`
   - `api/ocr.js`
   - `README.md`
3. In Vercel, create/import a project from this repo.
   - Framework preset: **Other** (or None)
   - Build command: **empty**
   - Output directory: **empty**
4. Deploy. You’ll get a URL like:
   - `https://YOUR-PROJECT.vercel.app`

Environment variables in Vercel → Project → Settings → Environment Variables:

- `OCR_SPACE_API_KEY` – your OCR.space key (for text OCR).
- `OPENAI_API_KEY` – your OpenAI key (for image recognition + AI).
- `OPENAI_MODEL` (optional) – defaults to `gpt-4o-mini`.

Deploy again after adding these.

## 2. Embedding the widget

Once deployed, your widget URL is:

```html
<script src="https://YOUR-PROJECT.vercel.app/ocr-widget.js" defer></script>
```

Add that line on any page that has a `<form>` (e.g. in your layout/footer).

- If at least one `<form>` exists → a “Scan with AppyCrew” button appears.
- If there are no forms → widget stays hidden.

## 3. How it treats a photo (example: blue chair)

When you scan a **blue chair** in your Items form:

- OCR.space reads any visible text in the image (labels, notes, etc.).
- OpenAI vision analyses the pixels and returns JSON, for example:

  ```json
  {
    "item": "chair",
    "colour": "blue",
    "description": "blue fabric chair"
  }
  ```

The widget then looks at each field on the page:

- If its label/name contains “Item” → uses `item` (chair).
- If it contains “Description / Notes” → uses `description` (“blue fabric chair”).
- If it contains “Qty / Quantity” → tries to take the first number from the text.
- If it contains “Location / Room” → uses location-like text from OCR.

For generic forms, it still does the v1 logic:

- “Email” → email address.
- “Phone / Mobile” → phone number.
- “Postcode / ZIP” → UK-style postcode.
- “Name / Company” → first line(s) of OCR text.
- “Address” → address-like lines.
- “Notes / Description / Comments / Job” → full OCR text.

All suggestions are shown in a review list where the user can untick any
mapping before clicking **Apply to form**.

## 4. Demo page

Visiting `https://YOUR-PROJECT.vercel.app/` will show:

- A demo inventory item form (Item, Type, Quantity, Description, Location).
- The floating “Scan with AppyCrew” button using this widget.

Use that to test before wiring it into your real AppyCrew forms.

## 5. Good labels for your Items form

For best results, name/label your fields like this:

- Item: label or name includes **"Item"** (e.g. `Item`, `Item Name`).
- Quantity: label includes **"Quantity"** or `Qty`.
- Description: label includes **"Description"** or **"Notes"**.
- Location: label includes **"Location"** or **"Room"**.

That makes it easier for the widget to know what should receive
`item`, `colour`, `description`, and any quantities.

## 6. Troubleshooting

- If you see a Vercel 404 page, check that `index.html` is at the repo root.
- If the widget doesn’t appear, make sure there is a `<form>` element
  on the page when the script runs.
- If text works but image recognition doesn’t, ensure `OPENAI_API_KEY`
  is set in Vercel and redeploy.
