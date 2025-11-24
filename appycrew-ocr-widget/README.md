# AppyCrew OCR Widget

A lightweight, branded OCR widget that you can drop onto any form page.
It shows a floating “Scan with AppyCrew” button, opens the camera, sends
the image to a backend OCR API (OCR.space), and then auto-matches the
text to your form fields.

This project is designed so you **do not need to run anything locally**.
You can upload it directly to GitHub and connect it to Vercel.

---

## 1. What you get

This folder contains:

- `index.html` – demo page and quick documentation.
- `ocr-widget.js` – the actual widget that you embed on any site.
- `api/ocr.js` – Vercel Serverless Function that talks to OCR.space.

When deployed, you will have:

- A live demo at:  
  `https://YOUR-PROJECT.vercel.app/`
- The embeddable widget at:  
  `https://YOUR-PROJECT.vercel.app/ocr-widget.js`
- The backend OCR endpoint at:  
  `https://YOUR-PROJECT.vercel.app/api/ocr`

---

## 2. One-time setup (GitHub + Vercel)

### Step 1 – Create a GitHub repo

1. Go to GitHub and create a new, **empty** repository.  
   Suggested name: `appycrew-ocr-widget`.
2. Upload the contents of this folder to that repo (you can drag & drop
   the unzipped folder in the GitHub web UI).

### Step 2 – Connect to Vercel

1. Go to Vercel and click **Add New → Project**.
2. Choose **Import Git Repository** and select your new repo.
3. When asked for a framework, choose **“Other”** (or leave as auto-detected).
4. Build settings:
   - **Build Command:** _leave empty_
   - **Output Directory:** _leave empty (root)_
5. Click **Deploy**.
6. After deploy you will get a URL like:
   - `https://your-project-name.vercel.app`

### Step 3 – Get a free OCR API key

This project uses the OCR.space API.

1. Visit the OCR.space “Free OCR API key” page.
2. Register and you will receive an API key via email.
3. Copy your API key.

### Step 4 – Add the key in Vercel

1. In Vercel, open your project → **Settings → Environment Variables**.
2. Add a new variable:
   - Name: `OCR_SPACE_API_KEY`
   - Value: _your key from OCR.space_
3. Click **Save** and then **Redeploy** the project (or trigger a new deploy).

If the key is **not** set, the widget still works but uses demo text
and will tell you that OCR is in “demo mode”.

---

## 3. Using the widget in your app (AppyCrew or any site)

Once deployed, your widget URL will be:

```text
https://YOUR-PROJECT.vercel.app/ocr-widget.js
```

On any page that has a `<form>`, add this snippet near the end of `<body>`
or in your global layout:

```html
<script src="https://YOUR-PROJECT.vercel.app/ocr-widget.js" defer></script>
```

That’s it:

- If the page **has at least one `<form>`**, a floating
  **“Scan with AppyCrew”** button appears in the bottom-right corner.
- If there is **no form**, the widget stays hidden.

This works in:
- Normal websites
- PWAs
- WebViews / wrappers (e.g. AppMySite) as long as the page can load
  external scripts and call HTTPS APIs.

---

## 4. How the widget behaves

1. User clicks the floating **Scan with AppyCrew** button.
2. A small AppyCrew-branded panel opens.
3. User chooses/takes a photo of a document, ID, notes, etc.
4. The image is converted to Base64 and sent to your backend at `/api/ocr`.
5. The backend calls the OCR.space API and gets the extracted text.
6. The widget:
   - Tries to match the OCR text to fields like **Name, Email, Phone,
     Postcode, Address, Job Notes**, based on the field’s label/name/
     placeholder.
   - Shows a “Review” list of suggested mappings.
7. User clicks **“Apply to form”** and the values are filled in.

If no obvious matches are found, the widget shows the full text in a
textarea so the user can copy/paste manually.

---

## 5. Custom fields (inventory, job notes, etc.)

This first version focuses on:

- Names
- Email
- Phone
- Postcode
- Address
- Notes / description / job notes

It uses simple heuristics based on:

- The field’s `<label>` text
- `name` attribute
- `id` attribute
- `placeholder`

For example:

- Any field whose label/name includes “email” gets the detected email
  address (if any).
- Fields with “phone / mobile / tel” get the detected phone number.
- Fields with “postcode / zip” get a UK-style postcode.
- Fields with “notes / description / comments / job” get the full
  OCR text.
- Fields with “name” or “company” get the first line of text.

### Making mapping more reliable

Over time, you (or a developer later) can make things more precise by:

- Choosing descriptive labels and `name` attributes.
- Using a consistent naming pattern like:
  - `customer_name`, `customer_email`, `job_notes`, etc.

The backend (`api/ocr.js`) is already prepared to receive a
`formType` field, so you can later send extra hints for special forms
(e.g. inventory-only flows) without changing the widget interface.

---

## 6. Notes & limitations

- **Object / item recognition** (e.g. “sofa, TV, boxes”) is not enabled
  yet in this version – the widget focuses on text OCR and smart field
  filling.
- Accuracy depends on:
  - Photo quality
  - The OCR engine (OCR.space)
  - How clear the labels/field names are
- For high-volume or mission‑critical use, you can switch to the OCR.space
  PRO endpoints by changing `OCR_SPACE_API_URL` in `api/ocr.js` and
  updating your API key.

---

## 7. Where to change things (for future dev help)

If you ever work with a developer in future, they’ll likely touch:

- **Frontend widget behaviour & matching logic**
  - `ocr-widget.js`
- **OCR provider or parsing rules**
  - `api/ocr.js`

You (non‑developer) can safely manage:

- GitHub repo (uploading files, viewing history)
- Vercel project (connecting repo, adding environment variables)
- OCR.space account & API key

---

## 8. Quick test checklist

1. Visit your deployed Vercel URL in a browser.
2. You should see the demo form from `index.html`.
3. The floating “Scan with AppyCrew” button should be visible.
4. Click it, pick an image, and check that:
   - You see status messages in the panel.
   - After adding `OCR_SPACE_API_KEY`, real text comes back.
   - Some fields auto-fill after clicking “Apply to form”.

If anything looks off, you can always:

- Re-deploy from Vercel,
- Check the **Functions / Logs** tab in Vercel for any errors,
- Or tweak text labels/placeholders in your forms to help the matcher.
