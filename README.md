# DOAS Get BOM Dashboard — GitHub-hosted bookmarklet

**Release:** v0.11 (29 Oct 2026)  
**GitHub repository:** https://github.com/jhongng1212dveloper/get-bom-dashboard  
**GitHub Pages installer (after publication):** https://jhongng1212dveloper.github.io/get-bom-dashboard/

A browser bookmarklet reads BOM records already loaded in the DOAS webpage and creates a self-contained, offline HTML procurement dashboard. Module 7000 is excluded **by default** but remains available through the dashboard toggle.

## Release changes — v0.11

**UI-13 — Brand-filtered Supplier Part No. order:** Clicking a standard-part manufacturer (SMC/MISUMI/etc.) sorts that manufacturer's Parts Explorer rows by the module embedded in Supplier Part No. (green in user's example), then the part identifier after optional `-6000-` (yellow), then revision. For example, `T-001707-01-6309-6000-N_0` is keyed as `(6309, N, 0)`. Supports natural alphanumeric sorting and both merge OFF and ON, without changing status-filter or module-7000 behavior. No brand selected → prior ordering retained.

**Baseline preserved from v0.10:**
| Item | Behavior |
|---|---|
| UI-08 | Supplier Part No. displayed in a **dedicated table column** with dark legible text and the same font size as Manufacturer Part No.; grouped items with multiple supplier part numbers can expand to show the complete list. |
| UI-09 | **Merge on ManufacturerPN OFF by default**, user can toggle ON. |
| UX-10 | On bookmark click, request the HTML download and attempt to **open the identical generated HTML in a new browser tab**. The hosted launcher reserves a blank tab during the user's click. If a pop-up is blocked, the DOAS page retains **Open dashboard** and **Download again** links. Browsers cannot directly open a downloaded `file://` file automatically. |
| UI-11 | Once the original pipeline scrolls out of view, a **compact sticky status-filter strip** appears along the top edge. It uses the **same status colors**, supports filter/clear, and does **not auto-jump** to Parts Explorer. Horizontal scrolling exposes further statuses on smaller displays. |

Existing functions preserved: BOM Import navigation, loaded DOM extraction, 7000 toggle, original full pipeline/legend colors, module/manufacturer/status filters, explicit **Show the list**, parts-group expand/collapse, complete status badges, floating **Top** control.

| UI-12 | **Left module task pane** appears once Modules summary scrolls away. Search module numbers and click to filter Parts Explorer without jumping; combines with the active status filter. Narrow widths use a collapsible Modules tab. Module 7000 respects the existing exclusion toggle. |

## Deploy to GitHub

1. Extract `DOAS_BOM_GitHub_Repository_v0.11.zip` to a local folder.
2. Open the existing repository: https://github.com/jhongng1212dveloper/get-bom-dashboard .
3. Select **Add file → Upload files**. Upload the extracted **files and directories** to the `main` branch's root (do not upload only the ZIP). Replace older files, particularly `bookmarklet.js` and `index.html`.
4. Confirm `index.html`, `bookmarklet.js`, `.nojekyll`, and `.gitignore` are at the repository root.
5. Enable **Settings → Pages → Deploy from a branch → main → /(root)**, then Save. If Pages is already enabled, keep its existing configuration.
6. Verify these two URLs return content (not 404):
   - https://jhongng1212dveloper.github.io/get-bom-dashboard/
   - https://jhongng1212dveloper.github.io/get-bom-dashboard/bookmarklet.js
7. Open the Pages installer. Drag **Generate DOAS Dashboard — Hosted** to Chrome's bookmarks bar. Existing hosted bookmarks keep working after updating `bookmarklet.js` and do not need replacement.

You can also open the downloaded `DOAS_BOM_GitHub_Hosted_Installer_v0.11.html` locally and install the hosted bookmark. It still loads the published GitHub Pages JavaScript at run time. The same installer offers a **standalone fallback** bookmark that contains the whole generator but needs replacing when code changes.

## Everyday usage

1. Open DOAS. Click the hosted bookmark. If the BOM table is not present but **BOM Import** is available, the script clicks that navigation control and waits for records (a full page reload may require clicking the bookmark again).
2. With the table loaded, the bookmark extracts the rows, requests a downloaded `DOAS_BOM_Dashboard_..._v0.11.html` file, and attempts to open the same generated HTML in a new browser tab.
3. Chrome may suppress automatic download or pop-ups due to its security settings. If automatic opening is blocked, click **Open dashboard** in the floating result panel on the DOAS page; **Download again** is also available. The persistent downloaded `.html` file can be opened independently.
4. Use the compact status controls while reviewing the Modules and Parts Explorer. Filter by status first, then optionally by module/manufacturer. Default merge is OFF; module 7000 is excluded by default.

**Important:** The bookmarklet accesses only DOM rows loaded in the active DOAS page, not unrendered pagination/server data. It does **not** write to DOAS or send BOM rows to GitHub.

## Repository files

| Path | Purpose |
|---|---|
| `index.html` | Drag-to-install page for hosted and standalone bookmarks |
| `bookmarklet.js` | **Required** hosted bookmarklet executable; GitHub Pages serves it |
| `bookmark-url.txt` | Bookmark URL for manual installation |
| `bookmarks-import.html` | Alternative importable Chrome bookmark file |
| `src/bookmarklet_source.js` | Source code: extraction and local HTML output |
| `src/dashboard_template.html` | Source code: standalone dashboard UI |
| `src/installer_template.html` | Source code: installer template |
| `tools/build.py` | Generates all executable/installer files from sources |
| `tests/mock_doas.html` | Fake, non-confidential DOM for BOM Import testing |
| `tests/test_release.py` | Chromium / Playwright regression tests |
| `.gitignore` | Prevents accidental Git addition of generated BOM exports |
| `.nojekyll` | Empty marker to disable GitHub Pages Jekyll preprocessing |

## Development & validation

For a new revision: edit `src/`, then run `python tools/build.py`. Upload regenerated `bookmarklet.js`, `index.html`, and relevant source changes to the repository. The hosted bookmark loads the updated file on the next click (a cache-busting query is added).

Optional browser tests (Python, Playwright and Chromium required): `python tests/test_release.py`. The fictional fixtures assert: all 11 original pipeline/status colors; 5-column Parts Explorer; readable supplier PNs; merge default/off/on; sticky status filter; viewport stability; module 7000 toggle; 700–1536px responsive handling; hosted popup/download; popup-block fallback; standalone bookmark; and BOM Import navigation.

**Tested locally:** Chromium browser simulation using fictitious BOM data. **Pending:** Testing on the live DOAS application and confirming the real GitHub Pages deployment serves v0.11.

## Security

- The hosted bookmark executes **public** GitHub Pages JavaScript within the DOAS page, so review changes before publishing. Do not give repository write access to untrusted users.
- Keep confidential BOM data, generated dashboards, exports and credentials out of the GitHub repository. `.gitignore` does not protect against manual GitHub website uploads.
- DOAS Content Security Policy can block remote script injection. Use the **standalone fallback** if this happens.
- Browser pop-up and multiple-download restrictions are browser security controls and cannot be bypassed by the application.
