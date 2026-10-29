# DOAS BOM Dashboard — GitHub-hosted bookmarklet

**Repository:** https://github.com/jhongng1212dveloper/get-bom-dashboard  
**Expected GitHub Pages installer:** https://jhongng1212dveloper.github.io/get-bom-dashboard/  
**Package version:** v0.08.1 — **Dashboard engine:** v0.08 (no functionality changes)

## Publish or repair the existing GitHub repository

1. Open https://github.com/jhongng1212dveloper/get-bom-dashboard .
2. Use **Add file → Upload files** and upload the contents of this ZIP to the **root** of the `main` branch. You can upload nested folders in a ZIP using the web interface only after extracting the ZIP. Confirm `index.html` and **`bookmarklet.js`** appear alongside `README.md` in the root. Do not upload the ZIP itself as your only file.
3. In **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/(root)`, then Save.
4. Open https://jhongng1212dveloper.github.io/get-bom-dashboard/ . It should display the bookmark installer. Also verify https://jhongng1212dveloper.github.io/get-bom-dashboard/bookmarklet.js returns JavaScript rather than 404.
5. Show Chrome bookmarks bar (`Ctrl+Shift+B`). Drag **Generate DOAS Dashboard — Hosted** onto it. Or click **Copy hosted bookmark URL**, then create a bookmark and paste it in the URL field.
6. Open DOAS and click the bookmark. It loads the current `bookmarklet.js` each time, so replacing the script on GitHub updates existing bookmarks without reinstallation.

**Offline shortcut:** You can open `index.html` locally and drag the same hosted bookmark; its URL is already preconfigured for this exact repository. It still requires the Pages JavaScript to be published before it can execute on DOAS.

## Included files

| File | Purpose |
|---|---|
| `index.html` | Drag-to-install GitHub-hosted and standalone bookmarks, preconfigured for this repository |
| `bookmarklet.js` | Hosted executable code, **required for hosted bookmark** |
| `bookmark-url.txt` | Compact hosted bookmark URL for manual installation |
| `bookmarks-import.html` | Alternative Chrome bookmarks HTML import |
| `src/bookmarklet_source.js` | Editable DOAS extraction script with template placeholder |
| `src/dashboard_template.html` | Editable dashboard; no company data embedded |
| `src/installer_template.html` | Editable installer template |
| `tools/build.py` | Rebuild generated files using Python 3.10+ (`python tools/build.py`) |
| `tests/mock_doas.html` | Fictitious demo BOM Import page for local testing |
| `.nojekyll` | GitHub Pages static hosting compatibility |

## Existing engine v0.08 preserved

- Detects the loaded DOAS BOM table or clicks the **BOM Import** button and waits for it within the page (full-page navigation requires a second click).
- Exports all loaded DOM rows, including module 7000 data. Dashboard hides module 7000 by default, with a toggle to include it.
- Pipeline status click filters **without automatically scrolling**. **Show the list** is the explicit navigation action.
- Parts Explorer status column is 400 px with original procurement colors. Floating **Go to top** button is retained.
- Generates a downloadable self-contained dashboard HTML snapshot; does not synchronize with DOAS.

## Security / limitations

- The hosted bookmarklet downloads JavaScript from the **public** Pages site and executes it in the active DOAS page. It does not intentionally upload BOM records, but anyone who can modify the hosted code can change its behavior. Review changes before publishing.
- **Keep company BOM data, generated reports and login credentials out of the public GitHub repository.** Only code and the fictional fixture belong here.
- DOAS Content Security Policy (CSP) may block injecting remote scripts, even if the GitHub Pages site works. In that case install the **standalone** bookmark from the same installer.
- The extractor only sees currently loaded DOM rows, not unseen pagination or virtualized records.
- Chrome may block automatic downloads; allow downloads for your DOAS site if necessary.
- Neither live DOAS behavior nor the published Pages site is validated by the local tests.

## Updating later

Modify `src/` files, run `python tools/build.py`, and publish the updated `bookmarklet.js` and `index.html` to GitHub. **Hosted bookmarks do not need reinstalling.** Standalone bookmarks must be replaced after a functional update.
