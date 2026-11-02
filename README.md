# DOAS Get BOM Dashboard — GitHub-hosted bookmarklet

**Release:** v0.14 (2 Nov 2026)  
**GitHub repository:** https://github.com/jhongng1212dveloper/get-bom-dashboard  
**GitHub Pages installer (after publication):** https://jhongng1212dveloper.github.io/get-bom-dashboard/

A browser bookmarklet reads BOM records already loaded in the DOAS webpage and creates a self-contained, offline HTML procurement dashboard. Module 7000 is excluded **by default** but remains available through the dashboard toggle.

## Release changes — v0.14

**UI-DENSITY-01 — Compact row spacing:** Reduced vertical space in both Module and Manufacturer task-pane selections, and in Parts Explorer table rows and group headers. Preserved the same font sizes, supplier part-number sort order, module-isolated merging, 400 px status allocation, badge text and exact procurement-status palette. Tested at 700/1024/1366/1536/1920 CSS px with synthetic data. Live DOAS acceptance pending.

## Preserved v0.13 features

### DATA-05 — Module-isolated merging (correctness fix)

When Merge is switched ON, lines **never merge across modules**. Standard item identity is `(Module, Manufacturer, ManufacturerPN)`; fabrication identity is `(Module, ManufacturerPN, Description)`. Identical parts within the same module can aggregate quantity and status counts, but the same part number in different modules remains a separate merged row. All figures described as unique parts in the part-type panel now use module-scoped keys.

The source currently **does not contain a CSV export/merge path**; the new boundary applies to the dashboard's Merge ON feature and is a requirement for any future CSV export. Merge remains **OFF by default**.

### SLICE-01 — Matching module and manufacturer side task panes

- After the Modules summary scrolls out of view, **two matching task panes** share the left rail on desktop: `Filter by module` above `Filter by manufacturer`.
- Both have search, line counts, All/clear, selection highlighting and click-again-to-clear. Manufacturer options include all manufacturers in the loaded dataset, including `PIXEL` for fabrication rows.
- On widths up to 1100 CSS px, compact **Modules** and **Brands** tabs open one overlay pane at a time.
- Selecting module, brand, or procurement status **combines filters** without clearing the other two; original module/manufacturer summary clicks are synchronized too.
- The approved upper dashboard layout and the eleven original procurement-status colors are unchanged.

**Hosted-bookmark compatibility:** The reserved preview tab key is intentionally left at `__DOAS_BOM_PREVIEW_V012__` so already-installed v0.12 hosted bookmarks remain compatible when GitHub serves v0.14. The loader script URL remains unchanged.

### Previous v0.12 features (preserved)


**UI-13 — Always-on Supplier Part No. order:** Every Parts Explorer group (standard manufacturers and internal fabrication) always sorts its Supplier Part No. rows by the embedded module number, then the part identifier after optional `-6000-`, then revision. E.g. `T-001707-01-6309-6000-N_0` sorts by `(6309, N, 0)`. This works without any filters and with module, manufacturer, status or search filters, in both merge OFF and ON. Manufacturer groups remain grouped and keep their existing group ordering; rows inside each group are sorted. The full list of Supplier Part No. values in a merged item is also sorted.

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

1. Extract `DOAS_BOM_GitHub_Repository_v0.14.zip` to a local folder.
2. Open the existing repository: https://github.com/jhongng1212dveloper/get-bom-dashboard .
3. Select **Add file → Upload files**. Upload the extracted **files and directories** to the `main` branch's root (do not upload only the ZIP). Replace older files, particularly `bookmarklet.js` and `index.html`.
4. Confirm `index.html`, `bookmarklet.js`, `.nojekyll`, and `.gitignore` are at the repository root.
5. Enable **Settings → Pages → Deploy from a branch → main → /(root)**, then Save. If Pages is already enabled, keep its existing configuration.
6. Verify these two URLs return content (not 404):
   - https://jhongng1212dveloper.github.io/get-bom-dashboard/
   - https://jhongng1212dveloper.github.io/get-bom-dashboard/bookmarklet.js
7. Open the Pages installer. Drag **Generate DOAS Dashboard — Hosted** to Chrome's bookmarks bar. Existing hosted bookmarks keep working after updating `bookmarklet.js` and do not need replacement.

You can also open the downloaded `DOAS_BOM_GitHub_Hosted_Installer_v0.14.html` locally and install the hosted bookmark. It still loads the published GitHub Pages JavaScript at run time. The same installer offers a **standalone fallback** bookmark that contains the whole generator but needs replacing when code changes.

## Everyday usage

1. Open DOAS. Click the hosted bookmark. If the BOM table is not present but **BOM Import** is available, the script clicks that navigation control and waits for records (a full page reload may require clicking the bookmark again).
2. With the table loaded, the bookmark extracts the rows, requests a downloaded `DOAS_BOM_Dashboard_..._v0.14.html` file, and attempts to open the same generated HTML in a new browser tab.
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

Browser tests (Python, Playwright and Chromium required): `python tests/test_release.py`, `python tests/test_module_pane.py`, `python tests/test_supplier_sort.py`, and `python tests/test_module_merge_brand_pane.py` (new v0.14 merge/panes acceptance test). The fictional fixtures assert: all 11 original pipeline/status colors; 5-column Parts Explorer; readable supplier PNs; merge default/off/on; sticky status filter; viewport stability; module 7000 toggle; 700–1536px responsive handling; hosted popup/download; popup-block fallback; standalone bookmark; and BOM Import navigation.

**Tested locally:** Chromium browser simulation using fictitious BOM data. **Pending:** Testing on the live DOAS application and confirming the real GitHub Pages deployment serves v0.14.

## Security

- The hosted bookmark executes **public** GitHub Pages JavaScript within the DOAS page, so review changes before publishing. Do not give repository write access to untrusted users.
- Keep confidential BOM data, generated dashboards, exports and credentials out of the GitHub repository. `.gitignore` does not protect against manual GitHub website uploads.
- DOAS Content Security Policy can block remote script injection. Use the **standalone fallback** if this happens.
- Browser pop-up and multiple-download restrictions are browser security controls and cannot be bypassed by the application.

## Release acceptance gates

- Local simulated Chromium tests: rerun on each source change.
- Live DOAS data extraction/completeness: **PENDING**.
- Real GitHub Pages deployment of v0.14 and installed hosted bookmark: **PENDING**.
- Company policy for externally hosted JavaScript: **PENDING**.
- No real BOM, CSV, or customer export is included in the repository.
