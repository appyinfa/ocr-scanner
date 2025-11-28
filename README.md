# AppyCrew OCR + Vision Widget (v9)

This version addresses three concrete issues:

1. Select fields & radios not filling
2. Values disappearing from inputs after touch / re-render
3. Description field getting all text (item + location + qty)

## What’s changed

### 1. Select & radio support

- Selects are now filled using a **best-match** strategy instead of setting the
  value directly to the raw text:
    - Case-insensitive match against option `value` or label.
    - Fallback: selects the first option whose value or label appears inside the
      detected string.
- Radios are now supported:
    - The widget infers an `itemType` from the OCR/vision text (`box`,
      `furniture`, `flat-pack`) and checks the matching radio in that group.
    - This is primarily for "Type" groups like Box / Furniture / Flat Pack.

### 2. React-friendly value updates

Some React/SPA setups ignored programmatic `.value = ...` and overwrote it when
the UI re-rendered (making values “disappear” when you touch the screen).

- v9 uses a `setReactFriendlyValue(el, value)` helper:
    - Uses the native property setter on the input/textarea prototype when
      available.
    - Dispatches both `input` **and** `change` events so that controlled
      components, form libs, and vanilla JS listeners all see the update.

### 3. Cleaner description extraction

- Description is now derived like this:
    - Prefer AI vision description if available (short, object-focused).
    - Otherwise:
        - Only use special parsing for short, single-line OCR text.
        - Strip out:
            - The first quantity number.
            - Recognised item names (chair, sofa, box, etc.).
            - Recognised location phrase (living room, master bedroom…).
        - Clean up “x”, commas, dashes, and extra whitespace.
    - For longer multi-line text (true notes), we keep the full text.
- This means descriptions like `"2 x blue chairs – living room"` will become
  closer to `"blue chairs"` instead of duplicating item + location.

### 4. Other behaviour

- Still SPA-aware with `MutationObserver` watching for forms.
- Still targets **visible fields only** inside the active form.
- Still supports `data-appycrew-type` hints on fields.

## Deploying

1. Upload these files to your widget GitHub repo (overwriting previous version).
2. Let Vercel redeploy.
3. Ensure your SaaS app layout still includes:

    <Script
      src="https://YOUR-WIDGET-PROJECT.vercel.app/ocr-widget.js"
      strategy="afterInteractive"
    />

The widget will then use the new v9 behaviour across all tenants.
