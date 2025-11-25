# AppyCrew OCR + Vision Widget (v6)

Changes vs v5:

- Fix: Location is only filled when a clear location keyword is found.
  It no longer copies item/description text into Location as a fallback.
- Fix: Description avoids being just a carbon copy of the item name.
  If AI returns the same string for item & description, the widget prefers
  the full OCR text as the description.
- Faster capture flow:
  - When the widget button is tapped, the panel opens and the camera/file
    picker is triggered straight away.
  - As soon as an image is captured, the widget automatically runs
    OCR (+ AI if enabled) and shows suggested mappings.
  - The “Scan & match fields” button is still there as a backup.
- Directories & multi-item behaviour remain as in v5.
- Backend remains OCR-first, AI-second with OpenAI + Gemini options.

Deploy & usage are the same as previous versions.
