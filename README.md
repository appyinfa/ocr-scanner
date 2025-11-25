# AppyCrew OCR + Vision Widget (v7)

Key changes for SPAs / web apps:

- The widget no longer only runs once on page load.
- It now:
  - Watches the DOM for forms using `MutationObserver`.
  - Shows the floating button whenever at least one `<form>` is present.
  - Hides the button when there are no forms in the DOM.
- It also tracks which form is **most visible in the viewport** and prefers
  filling that one (great for long pages with multiple inventory sections).
- You can still mark forms explicitly with:
    `<form data-appycrew-ocr="true">`
  and the widget will prefer those over unmarked forms.

Other behaviour preserved from v6:

- OCR-first, AI-second backend with OpenAI + Gemini support.
- Directories for common moving-company locations and items.
- Better description logic (no more description == item name).
- Location is only filled when a proper location keyword is found.
- Auto camera open when the widget panel is opened.
- Undo last apply inside the widget.

Deployment is unchanged – just upload these files to your GitHub repo
and redeploy on Vercel. The script URL stays:

    https://YOUR-PROJECT.vercel.app/ocr-widget.js
