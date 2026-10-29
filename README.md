# DOAS BOM Dashboard — GitHub Pages bookmarklet v0.08

One-click DOM extraction from the DOAS **BOM Import** table into a standalone HTML procurement dashboard.

## What changed from v0.07

- Clicking a procurement status stage/legend **filters without jumping**. The explicit **Show the list** button still scrolls to Parts Explorer.
- Floating **Top** button appears after scrolling down 260 px and smoothly returns to the top.
- If the BOM table is absent, the bookmarklet finds and clicks the DOAS **BOM Import** button, then waits up to 15 seconds for the table to appear **in the same page**.
- The original pipeline palette, module 7000 toggle, Parts Explorer status badges, and 400 px status column are preserved.

## Install GitHub Pages (hosted bookmarklet)

1. Create a GitHub repository, e.g. `doas-bom-dashboard`. **Keep DOAS BOM exports out of the repository**; private BOM data must not be uploaded.
2. Upload the full contents of this ZIP into the repository root, including `index.html` and `bookmarklet.js`.
3. GitHub repository → **Settings → Pages → Build and deployment** → Deploy from a branch → `main` / `(root)` → Save.
4. Open the published URL `https://YOUR-USERNAME.github.io/YOUR-REPO/` using HTTPS.
5. Drag **Generate DOAS Dashboard — hosted** to your bookmarks bar.
6. Open DOAS and click the bookmark. It loads the latest `bookmarklet.js` from your published Pages site and extracts the BOM locally.

**CSP compatibility:** Some websites block loading external scripts from GitHub Pages. If DOAS blocks it, use the **standalone** bookmarklet from the same installer; it embeds the full generator and never loads a remote script. Local `index.html` enables only the standalone link.

## Source layout

| Path | Function |
|---|---|
| `index.html` | GitHub Pages installer (and offline standalone installer) |
| `bookmarklet.js` | Hosted executable JavaScript (also the inline bookmarklet payload) |
| `src/dashboard_template.html` | Editable standalone dashboard template (no real BOM data) |
| `src/bookmarklet_source.js` | Extractor source with template placeholder |
| `src/installer_template.html` | Installer source with bookmark URL placeholders |
| `tools/build.py` | Rebuild hosted script and installer with Python 3.10+ |
| `tests/mock_doas.html` | Fictitious BOM Import page for local testing |

After source changes, run `python tools/build.py`, commit the updated `bookmarklet.js` and `index.html`, then refresh GitHub Pages. **Hosted bookmarks retrieve updates without reinstalling.** Standalone bookmarks must be replaced for updates.

## Usage and limitations

- Click the bookmark on the DOAS site. If the BOM table is not open, the script tries the `BOM Import` button and waits for the loaded table.
- If DOAS uses full-page navigation, the browser stops the running script when it leaves the page: open the resulting BOM page, then **click the bookmark a second time**.
- Only rows **currently loaded in the page DOM** are included. Virtual scrolling or server-side pagination can lead to incomplete exports.
- Module `7000` is **excluded by default** but included in the exported dashboard data so it can be toggled on.
- The dashboard is a **static snapshot**; it does not write to DOAS or synchronize with it.
- Downloads may be blocked by browser permissions. Check Chrome's download icon if no file appears.
- The hosted bookmarklet requests public JavaScript from GitHub Pages; data processing and the file download happen locally on the DOAS page. Don't publish the generated dashboard or paste proprietary BOM data into GitHub.

## Test status

- JavaScript syntax and local Chromium checks are performed at release build.
- Real DOAS page, navigation behavior and GitHub Pages deployment are **not tested** against your account.
