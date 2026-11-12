# Building and deploying DOAS Dashboard v0.16 (2026-11-12)

This is a complete repository-root upload package for:
https://github.com/jhongng1212dveloper/get-bom-dashboard

1. Compare against current GitHub branch and commits before replacing. Do not overwrite newer unreviewed changes.
2. Extract this ZIP, upload its **contents** to the repository root (not the ZIP itself). Preserve `src/`, `tools/`, `tests/`, `docs/`, `.gitignore` and `.nojekyll`.
3. Pages source should be set to `main` / `(root)` if using branch deployment.
4. Confirm `https://jhongng1212dveloper.github.io/get-bom-dashboard/` and `/bookmarklet.js` load and serve v0.16.
5. Use the website's drag-to-install hosted bookmark or install with `bookmark-url.txt` / `bookmarks-import.html`. An existing v0.12 **hosted** bookmark remains compatible; standalone one must be reinstalled.
6. On a sanctioned DOAS BOM page, check BOM Import → Clear filters sequence, reconciliation against DOAS full row count, download + preview, module-isolated merge, both side panes, all filter combinations, and actual BOM line counts.

To rebuild locally: `python tools/build.py`, then run all six `tests/test_*.py` scripts. Python Playwright and Chromium are needed for browser tests, not for running the bookmarklet.

`.gitignore` and `.nojekyll` are normal dotfiles. They are included in the ZIP. Protect confidential BOM data; `.gitignore` does not stop manual upload through the GitHub website.
