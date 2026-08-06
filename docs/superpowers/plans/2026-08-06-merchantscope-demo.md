# MerchantScope Static Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `merchantscope.html` case-study page with a fully static, interactive recreation of the real acquisition-hub app (Home/History/Settings/Report), pre-loaded with three real reconciled companies in history and a live "search Keyline → reconcile → deep dive" demo flow — backed entirely by baked JSON, no server.

**Architecture:** A new `merchantscope/` asset folder holds a ported copy of the real app's own `styles.css`, `formatters.js` and `deep-dive-mock.html` (copied verbatim — they need no changes) plus a new `app.js` that starts from the real `acquisition-hub/public/app.js` and replaces every network call (`fetch`/`request()` against `/api/...`) with a lookup against baked JSON fixtures or `localStorage`. `merchantscope.html` at the repo root is the new entry shell. `projects.html` becomes a two-card picker; the current forecasting case study moves to `book-forecasting.html`.

**Tech Stack:** Static HTML/CSS/vanilla JS (ES modules), no build step, no framework — matching the rest of zechgeorge.github.io and the source app.

## Global Constraints

- No fabricated financial data: every figure for Avon Timber, Travis Perkins, MKM Leamington Spa and Keyline must come from the real acquisition-hub app's own output (already captured to `D:\zechgeorge.github.io\.staging\`), not invented.
- No live network calls from the demo — GitHub Pages is static hosting; every `/api/*` call in the ported `app.js` must be replaced or removed.
- Settings screen renders (per user request) but every control is inert — no fetch, no persistence beyond a client-side "not wired up in this demo" note.
- Keep the product's own dark-onyx/spring-green design system (`styles.css`) — do not reskin it to match the portfolio site's visual style.
- The disclaimer banner ("This whole report is AI-generated from public data... not a decision...") must remain, unchanged, on every report.
- Two real evidence images are available (`keyline-2025-pl-page18.png`, `keyline-2024-pl-page16.png`); the other two Keyline periods show a plain "evidence imagery isn't available for every period in this hosted demo" note instead of a broken image.

---

## File manifest

**New files (`zechgeorge.github.io/merchantscope/`):**
- `styles.css` — copied verbatim from `acquisition-hub/public/styles.css`.
- `formatters.js` — copied verbatim from `acquisition-hub/public/formatters.js`.
- `deep-dive-mock.html` — copied verbatim from `acquisition-hub/public/deep-dive-mock.html` (kept as the same generic, clearly-labelled "mock data" worked example the real product already shows on every Deep Dive tab — not reskinned to Keyline, since inventing a detailed fictional financial narrative under a real company's name is worse than keeping the existing honest fiction clearly separate).
- `app.js` — adapted from `acquisition-hub/public/app.js` (see Task 4).
- `data/avon-timber.json`, `data/travis-perkins.json`, `data/mkm-leamington.json`, `data/keyline-before.json`, `data/keyline-after.json`, `data/keyline-review-before.json` — sanitized/trimmed from the staged real API responses.
- `data/history-seed.json` — the three pre-loaded history rows (derived from the three fixture files above).
- `evidence/keyline-2025-pl-page18.png`, `evidence/keyline-2024-pl-page16.png` — copied from `.staging/evidence/`.

**Modified/replaced (repo root):**
- `merchantscope.html` — replaced entirely with the new demo shell.
- `projects.html` — replaced entirely with a two-card picker (Book Forecasting / MerchantScope).
- `book-forecasting.html` — new file, current `projects.html` content moved here verbatim, nav updated.
- `index.html` — nav drops the standalone MerchantScope link; Featured Work's "Book Forecasting" card now links to `book-forecasting.html`.
- `about.html` — nav drops the standalone MerchantScope link.

No changes needed to the site's own `style.css` — `merchantscope.html` loads only `merchantscope/styles.css`, not the portfolio site's stylesheet, since it needs to look like the real product, not like the rest of the portfolio.

---

### Task 1: Stage static assets and fixture data

**Files:**
- Create: `merchantscope/styles.css`, `merchantscope/formatters.js`, `merchantscope/deep-dive-mock.html`, `merchantscope/evidence/keyline-2025-pl-page18.png`, `merchantscope/evidence/keyline-2024-pl-page16.png`
- Create: `merchantscope/data/*.json` (six fixture files + history-seed.json, built by the script below)
- Source: `C:\Users\ZechGeorge\Documents\Building Merchants\acquisition-hub\public\{styles.css,formatters.js,deep-dive-mock.html}`, `D:\zechgeorge.github.io\.staging\{avon-timber.json,travis-perkins.json,mkm-leamington.json,keyline.json,keyline-after-approve.json,keyline-review.json,evidence\*.png}`

- [ ] **Step 1: Copy the three verbatim files and the two evidence images**

```bash
mkdir -p "/d/zechgeorge.github.io/merchantscope/data" "/d/zechgeorge.github.io/merchantscope/evidence"
cp "/c/Users/ZechGeorge/Documents/Building Merchants/acquisition-hub/public/styles.css" "/d/zechgeorge.github.io/merchantscope/styles.css"
cp "/c/Users/ZechGeorge/Documents/Building Merchants/acquisition-hub/public/formatters.js" "/d/zechgeorge.github.io/merchantscope/formatters.js"
cp "/c/Users/ZechGeorge/Documents/Building Merchants/acquisition-hub/public/deep-dive-mock.html" "/d/zechgeorge.github.io/merchantscope/deep-dive-mock.html"
cp "/d/zechgeorge.github.io/.staging/evidence/keyline-2025-pl-page18.png" "/d/zechgeorge.github.io/merchantscope/evidence/"
cp "/d/zechgeorge.github.io/.staging/evidence/keyline-2023-pl-page16.png" "/d/zechgeorge.github.io/merchantscope/evidence/keyline-2024-pl-page16.png"
```

- [ ] **Step 2: Write and run the fixture-sanitizing build script**

Create `D:\zechgeorge.github.io\.staging\build-fixtures.mjs`. This trims each staged API response down to what the demo needs, and rewrites every `evidenceUrl` — the real ones point at `/api/evidence/...`, which does not exist on a static host — to either the two real static PNGs or `null` with a `demoUnavailable: true` flag the renderer will use to show an honest note instead of a broken image.

```javascript
import { readFile, writeFile } from "node:fs/promises";

const STAGING = new URL("./", import.meta.url);
const OUT = new URL("../merchantscope/data/", import.meta.url);

const REAL_EVIDENCE = {
  "13ec9551f6cf1ee88ccaeb23ea304863ce62dc7e6a6dc560ac401d3b5fdf2e19": "../evidence/keyline-2025-pl-page18.png",
  "b2e2c59c3fd5d11c7815c2ac88ac2736101807ed89a56f3e37d1cda04e6ef8b2": "../evidence/keyline-2024-pl-page16.png"
};

function fixEvidenceUrl(url) {
  if (!url) return { evidenceUrl: null, demoUnavailable: false };
  const match = Object.keys(REAL_EVIDENCE).find((hash) => url.includes(hash));
  return match ? { evidenceUrl: REAL_EVIDENCE[match], demoUnavailable: false } : { evidenceUrl: null, demoUnavailable: true };
}

// Walk the whole object tree once, fixing every provenance/alternate/location
// evidenceUrl wherever it appears (company.accountExtraction.observations[].location,
// financials[].provenance[field], review payload fields[].provenance / .alternates[]).
function walk(node) {
  if (Array.isArray(node)) { node.forEach(walk); return; }
  if (!node || typeof node !== "object") return;
  if ("evidenceUrl" in node) {
    const fixed = fixEvidenceUrl(node.evidenceUrl);
    node.evidenceUrl = fixed.evidenceUrl;
    if (fixed.demoUnavailable) node.demoUnavailable = true;
  }
  for (const value of Object.values(node)) walk(value);
}

async function loadJson(name) {
  return JSON.parse(await readFile(new URL(name, STAGING), "utf8"));
}

async function writeJson(name, data) {
  walk(data);
  await writeFile(new URL(name, OUT), JSON.stringify(data, null, 2));
}

const avon = await loadJson("avon-timber.json");
const travis = await loadJson("travis-perkins.json");
const mkm = await loadJson("mkm-leamington.json");
const keylineBefore = await loadJson("keyline.json");
const keylineAfter = await loadJson("keyline-after-approve.json");
const keylineReview = await loadJson("keyline-review.json");

await writeJson("avon-timber.json", avon);
await writeJson("travis-perkins.json", travis);
await writeJson("mkm-leamington.json", mkm);
await writeJson("keyline-before.json", keylineBefore);
await writeJson("keyline-after.json", keylineAfter);
await writeJson("keyline-review-before.json", keylineReview);

const historyEntry = (analysis, source) => ({
  companyNumber: analysis.company.companyNumber,
  name: analysis.company.name,
  source,
  status: analysis.company.status,
  stance: analysis.recommendation.stance,
  sizeFit: analysis.recommendation.sizeFit,
  tier: analysis.valuation.tier,
  evLow: analysis.valuation.evLow,
  evHigh: analysis.valuation.evHigh,
  screenedAt: new Date().toISOString()
});

await writeFile(new URL("history-seed.json", OUT), JSON.stringify([
  historyEntry(avon, "live"),
  historyEntry(travis, "live"),
  historyEntry(mkm, "live")
], null, 2));

console.log("Fixtures written to merchantscope/data/");
```

Run it:

```bash
node "/d/zechgeorge.github.io/.staging/build-fixtures.mjs"
```

- [ ] **Step 3: Verify the fixtures**

```bash
node -e "
const files = ['avon-timber','travis-perkins','mkm-leamington','keyline-before','keyline-after','keyline-review-before','history-seed'];
for (const f of files) {
  const d = require('/d/zechgeorge.github.io/merchantscope/data/' + f + '.json');
  console.log(f, Array.isArray(d) ? d.length + ' entries' : (d.company?.name || d.name || 'ok'));
}
"
```

Expected: all six named fixtures print a company name; `history-seed` prints "3 entries".

- [ ] **Step 4: Confirm no `/api/` URLs survive in the fixtures**

```bash
grep -rl "/api/" "/d/zechgeorge.github.io/merchantscope/data/" && echo "FOUND STALE API URLS" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
cd "/d/zechgeorge.github.io"
git add merchantscope/styles.css merchantscope/formatters.js merchantscope/deep-dive-mock.html merchantscope/evidence merchantscope/data
git commit -m "Add MerchantScope demo static assets and real baked fixture data"
```

---

### Task 2: Build the demo shell (`merchantscope.html`)

**Files:**
- Create: `merchantscope.html` (replaces the current static case-study page)
- Reference: `acquisition-hub/public/index.html` for the real app's shell markup (topbar, search combobox, page-home/page-history/page-settings/page-report structure, report tabs)

**Interfaces:**
- Produces: the DOM hooks `app.js` (Task 4) binds to — same element IDs as the real app (`#search-input`, `#search-results`, `#dash-recent-list`, `#history-list`, `#report`, `#deep-dive-report`, `#workspace`, tab buttons with `data-tab`, nav links with `data-route`, etc.) so the ported rendering code needs no ID renames.

- [ ] **Step 1: Write `merchantscope.html`**

Adapt `acquisition-hub/public/index.html`'s `<body>` structure into the site's page shell: `<head>` uses the portfolio site's normal meta/favicon pattern (see `about.html`) but links `merchantscope/styles.css` instead of the root `style.css`. Add one link the real product doesn't have — a small "← zechgeorge.com" link in the topbar so a visitor can get back to the portfolio site — and a one-line badge noting this is a hosted portfolio demo with real public-record data, not the live product. Keep every element ID identical to the source `index.html` so `app.js` binds without changes to its `$()` selectors.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="MerchantScope — an interactive portfolio demo of a real acquisition-screening tool, using real UK Companies House data.">
  <link rel="icon" type="image/png" href="favicon.png">
  <title>MerchantScope — Acquisition Intelligence Hub | Zech George</title>
  <link rel="stylesheet" href="merchantscope/styles.css">
  <style>
    .portfolio-back { display: flex; align-items: center; gap: 8px; color: var(--muted); text-decoration: none; font-size: 13px; font-weight: 600; padding: 9px 12px; border-radius: 8px; }
    .portfolio-back:hover, .portfolio-back:focus-visible { color: var(--ink); background: rgba(255,255,255,.04); }
    .demo-banner { max-width: 1180px; margin: 0 auto 18px; padding: 10px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--muted); font-size: 13px; }
    .demo-banner strong { color: var(--ink); }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <a class="portfolio-back" href="projects.html">&larr; zechgeorge.com</a>
      <a class="brand" href="#/" data-link aria-label="MerchantScope — Acquisition Intelligence Hub, home">
        <span class="brand-mark">MerchantScope</span>
        <span class="brand-desc">Acquisition Intelligence Hub</span>
      </a>
      <nav class="topnav" aria-label="Primary">
        <a href="#/" data-link data-route="home"><i class="rail-dot" aria-hidden="true"></i><span class="label-text">Home</span></a>
        <a href="#/history" data-link data-route="history"><i class="rail-dot" aria-hidden="true"></i><span class="label-text">History</span></a>
        <a href="#/settings" data-link data-route="settings"><i class="rail-dot" aria-hidden="true"></i><span class="label-text">Settings</span></a>
      </nav>
      <div id="topbar-search-anchor" class="topbar-search">
        <div id="search-combobox" class="search-combobox">
          <form id="search-form" class="search">
            <label class="sr-only" for="search-input">Company name or number</label>
            <input id="search-input" name="q" autocomplete="off" placeholder="Search company name (try &quot;keyline&quot;)" required role="combobox" aria-autocomplete="list" aria-controls="search-results" aria-expanded="false">
            <button type="submit">Search</button>
          </form>
          <section id="search-results" class="results hidden" role="listbox" aria-label="Search results" aria-live="polite"></section>
        </div>
      </div>
    </header>

    <main class="view">
      <section id="page-home" class="page">
        <div class="demo-banner"><strong>Portfolio demo.</strong> This is a static, hosted stand-in for the real local MerchantScope app — same UI, same rendering logic, real public-record data for four real companies. No live search, no backend.</div>
        <div class="home-hero">
          <h1>Know the business before you buy it.</h1>
          <p class="hero-copy">Sweep a company's public record for identity, ownership, accounts, resilience and risk — evidence resolves into a stance you can trust and trace, not a guess.</p>
        </div>
        <div id="dash-filters" class="filter-row" role="group" aria-label="Filter recent screenings by stance"></div>
        <div id="dash-recent" class="dash-recent">
          <h2>Recent screenings</h2>
          <div id="dash-recent-list"></div>
        </div>
      </section>

      <section id="page-history" class="page hidden">
        <h1>All screenings</h1>
        <p class="hint" style="margin: 8px 0 20px">Every company screened in this demo, most recent first.</p>
        <div class="history-actions"><button id="history-clear-all" type="button" class="secondary">Clear all</button></div>
        <div id="history-list"></div>
      </section>

      <section id="page-settings" class="page hidden settings-view">
        <h1>Defaults and connection</h1>
        <div class="demo-banner">These settings are shown for completeness but aren't wired up in this hosted demo — nothing here changes what you see.</div>
        <div class="settings-section">
          <div id="credential-panel" class="credential-panel">
            <div>
              <h2 id="credential-title">Companies House REST key</h2>
              <p id="credential-status" class="hint">Not applicable — this demo uses baked-in data, not a live API key.</p>
            </div>
            <form id="credential-form" class="credential-form">
              <label for="credential-input">REST API key</label>
              <input id="credential-input" name="apiKey" type="password" autocomplete="new-password" maxlength="512">
              <button id="credential-save" type="button">Save and verify</button>
              <button id="credential-remove" type="button" class="secondary">Remove saved key</button>
            </form>
          </div>
        </div>
        <div class="settings-section">
          <h2>Default screening assumptions</h2>
          <p class="section-lead">These are the only valuation assumptions used — save changes here, then reload a report to see them applied.</p>
          <form id="defaults-form" class="defaults-form">
            <label>Earnings multiple low<input name="earningsMultipleLow" type="number" step=".1" min="0" value="3.0"></label>
            <label>Earnings multiple high<input name="earningsMultipleHigh" type="number" step=".1" min="0" value="6.0"></label>
            <label>Revenue multiple low<input name="revenueMultipleLow" type="number" step=".05" min="0" value="0.25"></label>
            <label>Revenue multiple high<input name="revenueMultipleHigh" type="number" step=".05" min="0" value="0.55"></label>
            <label>Preferred EV minimum<input name="preferredEvMin" type="number" step="50000" min="0"></label>
            <label>Preferred EV maximum<input name="preferredEvMax" type="number" step="50000" min="0"></label>
            <label>Hard EV ceiling<input name="hardEvCeiling" type="number" step="50000" min="0"></label>
            <button class="primary" type="submit">Save defaults</button>
          </form>
          <p id="defaults-save-note" class="settings-save-note hidden">Saved.</p>
        </div>
      </section>

      <section id="page-report" class="page hidden">
        <section id="status" class="status" aria-live="polite"></section>
        <div id="workspace" class="hidden">
          <div class="report-tabs" role="tablist" aria-label="Report view">
            <button type="button" class="report-tab active" data-tab="initial" role="tab" aria-selected="true" aria-controls="tab-panel-initial" id="tab-initial">Initial review</button>
            <button type="button" class="report-tab" data-tab="deepdive" role="tab" aria-selected="false" aria-controls="tab-panel-deepdive" id="tab-deepdive">Deep dive</button>
          </div>
          <div id="tab-panel-initial" class="tab-panel" role="tabpanel" aria-labelledby="tab-initial">
            <div class="workspace">
              <aside class="side-nav" aria-label="Company review sections">
                <nav>
                  <a href="#brief">01 Decision brief</a>
                  <a href="#story">02 Company story</a>
                  <a href="#governance">03 Ownership</a>
                  <a href="#financials">04 Financials</a>
                  <a href="#resilience">05 Resilience</a>
                  <a href="#account-reconciliation">06 Automated reconciliation</a>
                  <a href="#risks">07 Risk register</a>
                  <a href="#valuation">08 Valuation</a>
                  <a href="#diligence">09 Diligence plan</a>
                  <a href="#sources">10 Sources</a>
                  <a href="#news">11 News &amp; mentions</a>
                </nav>
              </aside>
              <article id="report"></article>
            </div>
          </div>
          <div id="tab-panel-deepdive" class="tab-panel hidden" role="tabpanel" aria-labelledby="tab-deepdive">
            <div class="workspace">
              <aside class="side-nav" aria-label="Deep Dive sections">
                <nav id="deep-dive-nav"></nav>
                <button type="button" id="add-accounts-nav" class="export-button side-nav-export side-nav-preview">Add accounts</button>
              </aside>
              <article id="deep-dive-report">
                <section class="section">
                  <h2>Phase two — the target's own books</h2>
                  <p class="section-lead">No accounts connected for this target yet. Connect a source, or preview the finished capability with a worked example.</p>
                  <p class="empty-note">Use "Add accounts" in the panel on the left to get started.</p>
                </section>
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script type="module" src="merchantscope/app.js"></script>
</body>
</html>
```

Note what was deliberately dropped from the real shell: `#analysis-loading` (the "building rises" loading scene — nothing async to wait on, fixture lookups are synchronous), `#export-summary-nav` (PDF export button in the side-nav — the inline `#export-summary` button inside the rendered report is kept but made inert, see Task 4).

- [ ] **Step 2: Open in a static server and confirm the shell renders**

```bash
npx --yes serve "/d/zechgeorge.github.io" -l 4500
```

Visit `http://localhost:4500/merchantscope.html` — expect the dark-onyx topbar, search box and "Recent screenings" heading to render (list itself will be empty until Task 4's `app.js` exists). No console errors about missing `styles.css`.

- [ ] **Step 3: Commit**

```bash
cd "/d/zechgeorge.github.io"
git add merchantscope.html
git commit -m "Add MerchantScope demo shell markup"
```

---

### Task 3: Site navigation restructure (Projects picker, Book Forecasting page, nav links)

**Files:**
- Create: `book-forecasting.html` (current `projects.html` content)
- Modify: `projects.html` (replace with two-card picker)
- Modify: `index.html:19-22` (nav), `index.html:118-165` (Featured Work "Book Forecasting" card href)
- Modify: `about.html:19-22` (nav)

- [ ] **Step 1: Move the current case study to `book-forecasting.html`**

```bash
cd "/d/zechgeorge.github.io"
cp projects.html book-forecasting.html
```

Then in `book-forecasting.html`, update the nav (same edit as Step 3 below — drop the MerchantScope link, no `class="active"` on Projects) and update its two "back" links at the bottom (`projects.html` → keep, they already point to the picker correctly since `projects.html` still exists as the picker).

- [ ] **Step 2: Replace `projects.html` with the two-card picker**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Projects | Zech George</title>
  <meta name="description" content="Forecasting and applied-AI project case studies by Zech George.">
  <link rel="icon" type="image/png" href="favicon.png">
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <div class="bg-glow bg-glow-1"></div>
  <div class="bg-glow bg-glow-2"></div>

  <nav class="top-nav">
    <a href="index.html" class="nav-logo">zg<span>.data</span></a>
    <div class="nav-links">
      <a href="index.html">Home</a>
      <a href="about.html">About</a>
      <a href="projects.html" class="active">Projects</a>
      <div class="nav-divider"></div>
      <a href="Zech_George_CV.pdf" download class="nav-cta">CV &darr;</a>
      <a href="https://github.com/zechvincent-lab/Projects" target="_blank">GitHub</a>
      <a href="https://www.linkedin.com/in/zech-george/" target="_blank">LinkedIn</a>
      <a href="mailto:zech.vincent@gmail.com">Email</a>
    </div>
  </nav>

  <div class="page-wrap" style="position:relative;z-index:1;">

    <header class="detail-header">
      <div class="section-label">Projects</div>
      <h1>Case studies</h1>
      <p class="detail-sub">Two projects: a forecasting model comparison, and an interactive demo of an applied-AI acquisition-screening product.</p>
    </header>

    <div class="divider"></div>

    <section>
      <a href="book-forecasting.html" class="project-card" style="max-width:780px;">
        <div class="card-vis">
          <svg viewBox="0 0 760 180" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="none">
            <polyline points="0,120 40,115 80,130 120,100 160,95 200,110 240,88 280,100 320,92 360,105" fill="none" stroke="#f0a500" stroke-width="2" opacity="0.6"/>
            <polyline points="360,105 400,98 440,92 480,97 520,90 560,94 600,88 640,91 680,86 720,89 760,85" fill="none" stroke="#00d4ff" stroke-width="2" stroke-dasharray="6 4" opacity="0.85"/>
          </svg>
        </div>
        <div class="card-body">
          <div class="card-meta">Time Series &middot; Forecasting &middot; Machine Learning</div>
          <h3 class="card-title">Book Sales Forecasting</h3>
          <p class="card-desc">Compared ARIMA, SARIMA, XGBoost, LSTM and hybrid models to forecast book demand across two datasets.</p>
          <div class="card-chips">
            <span class="chip">ARIMA</span>
            <span class="chip">SARIMA</span>
            <span class="chip">XGBoost</span>
            <span class="chip">LSTM</span>
          </div>
          <span class="card-link">Read case study &rarr;</span>
        </div>
      </a>

      <a href="merchantscope.html" class="project-card" style="max-width:780px;margin-top:1.5rem;">
        <div class="card-vis merchant-card-vis">
          <div class="merchant-mini-ui">
            <div class="mini-row"><span>Target</span><strong>Keyline Civils</strong></div>
            <div class="mini-row"><span>Stance</span><strong>Proceed</strong></div>
            <div class="mini-row"><span>Reconciled</span><strong>Yes</strong></div>
            <div class="mini-progress"><span></span></div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-meta">Applied AI &middot; Companies House &middot; Interactive demo</div>
          <h3 class="card-title">MerchantScope</h3>
          <p class="card-desc">An interactive, hosted demo of a real acquisition-screening tool &mdash; search, reconcile, deep dive, using real UK public-record data.</p>
          <div class="card-chips">
            <span class="chip">Companies House API</span>
            <span class="chip">OCR</span>
            <span class="chip">Financial Analysis</span>
          </div>
          <span class="card-link">Open the demo &rarr;</span>
        </div>
      </a>
    </section>

  </div>

  <footer>
    <p>&copy; 2026 <a href="index.html">Zech George</a> &middot; zechgeorge.com</p>
  </footer>

</body>
</html>
```

- [ ] **Step 3: Update `index.html` nav and Featured Work card**

Remove the MerchantScope top-nav link (`index.html:22`):

Old:
```html
      <a href="projects.html">Projects</a>
      <a href="merchantscope.html">MerchantScope</a>
      <div class="nav-divider"></div>
```
New:
```html
      <a href="projects.html">Projects</a>
      <div class="nav-divider"></div>
```

Point the "Book Sales Forecasting" card at the new page (it currently links to `projects.html`):

Old (around `index.html:118`):
```html
      <a href="projects.html" class="project-card" style="max-width:780px;">
```
New:
```html
      <a href="book-forecasting.html" class="project-card" style="max-width:780px;">
```

The MerchantScope card already links to `merchantscope.html` — leave it, but update its mini-preview copy to match the real demo instead of the old MKM-Rugby static mockup:

Old:
```html
          <div class="merchant-mini-ui">
            <div class="mini-row"><span>Target</span><strong>MKM Rugby</strong></div>
            <div class="mini-row"><span>Revenue</span><strong>GBP 5.9m</strong></div>
            <div class="mini-row"><span>Group</span><strong>Child company</strong></div>
            <div class="mini-progress"><span></span></div>
          </div>
```
New:
```html
          <div class="merchant-mini-ui">
            <div class="mini-row"><span>Target</span><strong>Keyline Civils</strong></div>
            <div class="mini-row"><span>Stance</span><strong>Proceed</strong></div>
            <div class="mini-row"><span>Reconciled</span><strong>Yes</strong></div>
            <div class="mini-progress"><span></span></div>
          </div>
```

- [ ] **Step 4: Update `about.html` nav** — same removal as `index.html`:

Old:
```html
      <a href="projects.html">Projects</a>
      <a href="merchantscope.html">MerchantScope</a>
      <div class="nav-divider"></div>
```
New:
```html
      <a href="projects.html">Projects</a>
      <div class="nav-divider"></div>
```

- [ ] **Step 5: Verify in the browser**

With the static server from Task 2 still running, visit `/index.html`, `/about.html`, `/projects.html`, `/book-forecasting.html`. Confirm: no "MerchantScope" link in the top nav on any of the four; `/projects.html` shows two cards; both cards' links resolve (no 404).

- [ ] **Step 6: Commit**

```bash
cd "/d/zechgeorge.github.io"
git add index.html about.html projects.html book-forecasting.html
git commit -m "Restructure Projects into a picker; move forecasting case study to its own page"
```

---

### Task 4: Port `app.js` — data layer, router, and inert chrome

**Files:**
- Create: `merchantscope/app.js` (starts as a full copy of `acquisition-hub/public/app.js`, then the edits below are applied)

**Interfaces:**
- Consumes: `merchantscope/data/*.json` (Task 1), DOM structure from `merchantscope.html` (Task 2).
- Produces: `render(analysis)` (unchanged signature/behavior from the source file — renders the 11-section report into `#report`), used by Task 5's reconcile-flow edits.

- [ ] **Step 1: Copy the source file as the starting point**

```bash
cp "/c/Users/ZechGeorge/Documents/Building Merchants/acquisition-hub/public/app.js" "/d/zechgeorge.github.io/merchantscope/app.js"
```

- [ ] **Step 2: Add the fixture data layer at the top of the file**

Insert immediately after the existing `import` line (`import { safeDateLabel, safeDateTimeLabel } from "/formatters.js";` — note this import path also needs updating, see Step 3):

```javascript
const FIXTURE_FILES = {
  "02497863": "avon-timber.json",
  "00824821": "travis-perkins.json",
  "10689579": "mkm-leamington.json",
  "SC042425": "keyline-before.json"
};
const fixtureCache = new Map();
async function loadFixture(companyNumber) {
  const file = FIXTURE_FILES[companyNumber];
  if (!file) throw new Error("No demo data is seeded for that company.");
  if (fixtureCache.has(file)) return structuredClone(fixtureCache.get(file));
  const response = await fetch(`merchantscope/data/${file}`);
  if (!response.ok) throw new Error("Could not load demo data.");
  const data = await response.json();
  fixtureCache.set(file, data);
  return structuredClone(data);
}
async function loadKeylineAfter() {
  const response = await fetch("merchantscope/data/keyline-after.json");
  return response.json();
}
async function loadKeylineReview() {
  const response = await fetch("merchantscope/data/keyline-review-before.json");
  return response.json();
}

const HISTORY_KEY = "merchantscope-demo-history";
async function loadHistory() {
  const stored = localStorage.getItem(HISTORY_KEY);
  if (stored) return JSON.parse(stored);
  const seedResponse = await fetch("merchantscope/data/history-seed.json");
  const seed = await seedResponse.json();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(seed));
  return seed;
}
function saveHistory(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}
function upsertHistory(entry) {
  const entries = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  const filtered = entries.filter((e) => !(e.companyNumber === entry.companyNumber && e.source === entry.source));
  filtered.unshift(entry);
  saveHistory(filtered);
}
function historyEntryFrom(analysis, source) {
  return {
    companyNumber: analysis.company.companyNumber, name: analysis.company.name, source,
    status: analysis.company.status, stance: analysis.recommendation.stance,
    sizeFit: analysis.recommendation.sizeFit, tier: analysis.valuation.tier,
    evLow: analysis.valuation.evLow, evHigh: analysis.valuation.evHigh,
    screenedAt: new Date().toISOString()
  };
}
```

- [ ] **Step 3: Fix the formatters import path**

Old:
```javascript
import { safeDateLabel, safeDateTimeLabel } from "/formatters.js";
```
New:
```javascript
import { safeDateLabel, safeDateTimeLabel } from "./formatters.js";
```

Also remove the now-unused request-cancellation import (a static demo has nothing to cancel):

Old:
```javascript
import { createLatestRequestController } from "/latest-request.js";
import { safeDateLabel, safeDateTimeLabel } from "./formatters.js";
```
New:
```javascript
import { safeDateLabel, safeDateTimeLabel } from "./formatters.js";
```

And remove its one usage:

Old:
```javascript
const companyLoads = createLatestRequestController();
```
New: delete this line entirely.

- [ ] **Step 4: Switch routing from pushState paths to hash routing**

GitHub Pages has no server-side rewrite, so a hard refresh on `/company/SC042425` would 404. Hash routing avoids that entirely.

Old:
```javascript
function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  void renderRoute();
}

async function renderRoute() {
  const path = location.pathname;
  const params = new URLSearchParams(location.search);
  const companyMatch = path.match(/^\/company\/([^/]+)$/);
```
New:
```javascript
function navigate(path) {
  location.hash = `#${path}`;
}

async function renderRoute() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [path, queryString] = hash.split("?");
  const params = new URLSearchParams(queryString || "");
  const companyMatch = path.match(/^\/company\/([^/]+)$/);
```

Old:
```javascript
window.addEventListener("popstate", () => void renderRoute());

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link]");
  if (link && link.origin === location.origin) {
    event.preventDefault();
    navigate(link.pathname + link.search);
  }
});
```
New:
```javascript
window.addEventListener("hashchange", () => void renderRoute());
void renderRoute();
```

(The `data-link` click interceptor is no longer needed — `href="#/history"` etc. navigate natively via the browser's own hash handling, which fires `hashchange`. Delete the `document.addEventListener("click", ...)` block above entirely; `merchantscope.html`'s nav links already use `#/...` hrefs from Task 2.)

Old (at the very end of the file):
```javascript
void renderRoute();
```
New: delete — already called once above, right after the `hashchange` listener is attached, so routing works on first load too.

Update every internal navigation call site from path strings to the same strings (they already start with `/`, e.g. `navigate('/history')`, `` navigate(`/company/${...}`) `` — no change needed there, `navigate()`'s new body just prefixes `#`). Search the file for `navigate(` and `data-link` after this edit to confirm none were missed — the only remaining `data-link` attributes should be in `merchantscope.html` itself (Task 2), not in `app.js`.

One more: the Settings link inside the rendered report (`valuation` section) uses a real path — update it too:

Old:
```javascript
<p class="hint">Screening assumptions (earnings/revenue multiples, preferred EV range, hard ceiling) are set on the <a href="/settings" data-link>Settings page</a> and apply to every new screening.</p>
```
New:
```javascript
<p class="hint">Screening assumptions (earnings/revenue multiples, preferred EV range, hard ceiling) are shown on the <a href="#/settings">Settings page</a> (not wired up in this hosted demo).</p>
```

- [ ] **Step 5: Replace history rendering/mutation (no `/api/history`)**

Old:
```javascript
async function renderHomePage() {
  const list = $("#dash-recent-list");
  list.innerHTML = "<p class=\"empty-note\">Loading…</p>";
  try {
    const { entries } = await request("/api/history");
    homeFilterActive = "all";
    renderHomeFilters(entries);
    renderHomeList(entries);
  } catch (error) {
    $("#dash-filters").innerHTML = "";
    list.innerHTML = `<p class="empty-note">${escapeHtml(error.message)}</p>`;
  }
}

async function renderHistoryPage() {
  const container = $("#history-list");
  container.innerHTML = "<p class=\"empty-note\">Loading…</p>";
  historyClearAll.disabled = true;
  try {
    const { entries } = await request("/api/history");
    container.innerHTML = entries.length ? recentListHtml(entries, { withRemove: true }) : '<p class="empty-note">No companies screened yet.</p>';
    wireRecentRows(container);
    historyClearAll.disabled = entries.length === 0;
  } catch (error) {
    container.innerHTML = `<p class="empty-note">${escapeHtml(error.message)}</p>`;
  }
}
```
New:
```javascript
async function renderHomePage() {
  const entries = await loadHistory();
  homeFilterActive = "all";
  renderHomeFilters(entries);
  renderHomeList(entries);
}

async function renderHistoryPage() {
  const container = $("#history-list");
  const entries = await loadHistory();
  container.innerHTML = entries.length ? recentListHtml(entries, { withRemove: true }) : '<p class="empty-note">No companies screened yet.</p>';
  wireRecentRows(container);
  historyClearAll.disabled = entries.length === 0;
}
```

Old (the `remove-history` handler inside `wireRecentRows`):
```javascript
  container.querySelectorAll(".remove-history").forEach((button) => button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const { number, source } = event.currentTarget.dataset;
    try {
      await request(`/api/history/${encodeURIComponent(number)}?source=${encodeURIComponent(source)}`, { method: "DELETE" });
      await renderRoute();
    } catch { /* leave the row in place; the next refresh will retry */ }
  }));
```
New:
```javascript
  container.querySelectorAll(".remove-history").forEach((button) => button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const { number, source } = event.currentTarget.dataset;
    const entries = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    saveHistory(entries.filter((e) => !(e.companyNumber === number && e.source === source)));
    await renderRoute();
  }));
```

Old (`historyClearAll` click handler):
```javascript
historyClearAll.addEventListener("click", async () => {
  if (!window.confirm("Clear all screening history? This cannot be undone.")) return;
  historyClearAll.disabled = true;
  try {
    await request("/api/history", { method: "DELETE" });
    await renderHistoryPage();
  } catch {
    historyClearAll.disabled = false;
  }
});
```
New:
```javascript
historyClearAll.addEventListener("click", async () => {
  if (!window.confirm("Clear all screening history for this demo? This only clears your browser's local copy.")) return;
  saveHistory([]);
  await renderHistoryPage();
});
```

- [ ] **Step 6: Make Settings inert**

Old:
```javascript
async function renderSettingsPage() {
  await refreshCredentialStatus().catch(() => {});
  try {
    const defaults = await request("/api/settings/defaults");
    const form = $("#defaults-form");
    for (const [key, value] of Object.entries(defaults)) {
      const input = form.elements.namedItem(key);
      if (input) input.value = value;
    }
  } catch { /* the form keeps its last values; saving still works independently */ }
}

$("#defaults-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, Number(value)]));
  const note = $("#defaults-save-note");
  try {
    await request("/api/settings/defaults", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    note.classList.remove("hidden");
    note.className = "settings-save-note";
    note.textContent = "Saved. Applies to new screenings and any report you reload.";
  } catch (error) {
    note.classList.remove("hidden");
    note.className = "settings-save-note error";
    note.textContent = error.message;
  }
});
```
New:
```javascript
async function renderSettingsPage() {
  // Inert in this hosted demo — the form already carries illustrative
  // default values from merchantscope.html, nothing to fetch.
}

$("#defaults-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const note = $("#defaults-save-note");
  note.classList.remove("hidden");
  note.className = "settings-save-note";
  note.textContent = "Settings aren't wired up in this hosted demo.";
});
```

Old (credential status/save/remove — three separate blocks):
```javascript
async function refreshCredentialStatus() {
  const credential = await request("/api/credentials/companies-house");
  credentialStatus.textContent = credential.configured
    ? credential.source === "environment" ? "Live key supplied by the server environment." : "Encrypted key saved for this Windows user."
    : "No live key configured. Fixture search remains available.";
  credentialInput.disabled = !credential.canModify;
  credentialSave.disabled = !credential.canModify;
  credentialRemove.disabled = !credential.configured || !credential.canModify;
  setCredentialPanel(!credential.configured);
  return credential;
}

refreshCredentialStatus().catch(() => {
  credentialStatus.textContent = "Credential status is unavailable.";
  setCredentialPanel(true);
});

$("#credential-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  credentialStatus.textContent = "Verifying with Companies Houseâ€¦";
  credentialSave.disabled = true;
  try {
    await request("/api/credentials/companies-house", {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey: credentialInput.value })
    });
    await refreshCredentialStatus();
  } catch (error) {
    credentialStatus.textContent = error.message;
    credentialSave.disabled = false;
    setCredentialPanel(true);
  } finally {
    credentialInput.value = "";
  }
});

credentialSave.addEventListener("click", () => {
  $("#credential-form").requestSubmit();
});

$("#export-summary-nav").addEventListener("click", (event) => void downloadSummaryPdf(event.currentTarget));
$("#add-accounts-nav").addEventListener("click", () => openAddAccounts());

credentialRemove.addEventListener("click", async () => {
  credentialStatus.textContent = "Removing encrypted keyâ€¦";
  try {
    await request("/api/credentials/companies-house", {
      method: "DELETE", headers: { "content-type": "application/json" }, body: "{}"
    });
    await refreshCredentialStatus();
  } catch (error) {
    credentialStatus.textContent = error.message;
    setCredentialPanel(true);
  } finally {
    credentialInput.value = "";
  }
});
```
New:
```javascript
credentialSave.addEventListener("click", (event) => {
  event.preventDefault();
  credentialStatus.textContent = "Credentials aren't used in this hosted demo — every result here is baked-in real data.";
});

$("#add-accounts-nav").addEventListener("click", () => openAddAccounts());

credentialRemove.addEventListener("click", (event) => {
  event.preventDefault();
  credentialStatus.textContent = "Credentials aren't used in this hosted demo — every result here is baked-in real data.";
});
```

(`setCredentialPanel()` stays defined but is simply never called with `true`/`false` toggling logic — the panel is always visible by default per its original module-load behavior, which is fine since it's static now. `$("#export-summary-nav")` no longer exists in the Task 2 markup, since the side-nav "Export report" button was dropped there — so its listener line above is deleted, not ported.)

- [ ] **Step 7: Replace search with a client-side filter over the four seeded companies**

Old:
```javascript
$("#search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = $("#search-input").value.trim();
  status.className = "status";
  status.textContent = "Searching and checking legal entities…";
  results.innerHTML = "";
  closeSearchResults();
  workspace.classList.add("hidden");
  try {
    const data = await request(`/api/search?q=${encodeURIComponent(query)}`);
    status.textContent = data.results.length ? "" : "No matching companies found.";
    results.innerHTML = data.results.map((item) => `
      <button class="result" type="button" role="option" data-number="${escapeHtml(item.companyNumber)}" data-source="${escapeHtml(item.source)}">
        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.companyNumber)} · ${escapeHtml(item.address || "Address unavailable")}</small></span>
        <span><span class="tag">${escapeHtml(item.status || "unknown")}</span> ${item.fixture ? '<span class="tag">fixture</span>' : ""}</span>
      </button>`).join("");
    if (data.results.length) openSearchResults();
  } catch (error) {
    status.className = "status error";
    status.textContent = error.message;
  }
});
```
New:
```javascript
const SEARCHABLE_COMPANIES = [
  { companyNumber: "02497863", name: "Avon Timber Merchants Limited", address: "Stonebridge Industrial Estate, Coventry", status: "active" },
  { companyNumber: "00824821", name: "Travis Perkins PLC", address: "Lodge Farm Industrial Estate, Northampton", status: "active" },
  { companyNumber: "10689579", name: "M.K.M. Building Supplies (Leamington Spa) Limited", address: "Stoneferry Road, Hull", status: "active" },
  { companyNumber: "SC042425", name: "Keyline Civils Specialist Limited", address: "Mauchline Street, Glasgow", status: "active" }
];

$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = $("#search-input").value.trim().toLowerCase();
  status.className = "status";
  results.innerHTML = "";
  workspace.classList.add("hidden");
  const matches = query ? SEARCHABLE_COMPANIES.filter((c) => c.name.toLowerCase().includes(query)) : [];
  status.textContent = matches.length ? "" : "No matching companies found in this demo. Try \"keyline\", \"avon\", \"travis perkins\" or \"mkm\".";
  results.innerHTML = matches.map((item) => `
    <button class="result" type="button" role="option" data-number="${escapeHtml(item.companyNumber)}" data-source="live">
      <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.companyNumber)} · ${escapeHtml(item.address)}</small></span>
      <span><span class="tag">${escapeHtml(item.status)}</span></span>
    </button>`).join("");
  if (matches.length) openSearchResults(); else closeSearchResults();
});
```

- [ ] **Step 8: Replace `loadCompany` with a fixture lookup (drop the polling branch entirely)**

Old:
```javascript
async function loadCompany(companyNumber, source = currentSource) {
  accountPollGeneration++;
  // Captured once, up front — before either render() call site below is even
  // reachable — so a still-in-flight news fetch from whatever company was
  // previously on screen is invalidated the instant a new load begins, not
  // merely once the new company's report actually renders.
  const thisNewsGeneration = ++newsGeneration;
  if (accountPollTimer) clearTimeout(accountPollTimer);
  // The Deep Dive tab is per-company demo state — reset it and return to
  // "Initial review" so a company switch never leaves a stale Deep Dive
  // dashboard (from whatever company was previously loaded) on screen.
  resetDeepDiveTab();
  const load = companyLoads.begin();
  const previousReport = report.innerHTML;
  const restorePreviousReport = !workspace.classList.contains("hidden") && Boolean(previousReport);
  const previousSelection = { number: currentNumber, source: currentSource, analysis: currentAnalysis };
  status.className = "status";
  status.textContent = "";
  workspace.classList.add("hidden");
  workspace.setAttribute("aria-busy", "true");
  showAnalysisLoading(null, "queued");
  let handedOffToPoll = false;
  try {
    const analysis = await request(`/api/company/${encodeURIComponent(companyNumber)}?source=${encodeURIComponent(source || "live")}`, { signal: load.signal });
    if (!load.isLatest()) return;
    currentNumber = companyNumber;
    currentSource = source;
    currentAnalysis = analysis;
    results.innerHTML = "";
    if (analysis.accountAnalysis?.jobId && analysis.accountAnalysis.status !== "complete") {
      handedOffToPoll = true;
      showAnalysisLoading(analysis.company?.name, analysis.accountAnalysis.stage || "queued");
      startAccountPolling(analysis.accountAnalysis.jobId, companyNumber, source, {
        previousReport, restorePreviousReport, previousSelection
      }, thisNewsGeneration);
    } else {
      render(analysis);
      status.textContent = "";
      workspace.classList.remove("hidden");
      workspace.scrollIntoView({ behavior: "smooth", block: "start" });
      kickOffCompanyNews(analysis, companyNumber, source, thisNewsGeneration);
    }
  } catch (error) {
    if (!load.isLatest()) return;
    currentNumber = previousSelection.number;
    currentSource = previousSelection.source;
    currentAnalysis = previousSelection.analysis;
    status.className = "status error";
    status.textContent = error.message;
    if (restorePreviousReport) {
      report.innerHTML = previousReport;
      workspace.classList.remove("hidden");
    }
  } finally {
    if (!load.finish()) return;
    if (!handedOffToPoll) {
      analysisLoading.classList.add("hidden");
      workspace.removeAttribute("aria-busy");
    }
  }
}
```
New:
```javascript
async function loadCompany(companyNumber, source = currentSource) {
  resetDeepDiveTab();
  status.className = "status";
  status.textContent = "";
  workspace.classList.add("hidden");
  try {
    const analysis = await loadFixture(companyNumber);
    currentNumber = companyNumber;
    currentSource = source || "live";
    currentAnalysis = analysis;
    results.innerHTML = "";
    upsertHistory(historyEntryFrom(analysis, currentSource));
    render(analysis);
    workspace.classList.remove("hidden");
    workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    status.className = "status error";
    status.textContent = error.message;
  }
}
```

Delete `startAccountPolling` entirely (dead code — nothing calls it anymore) and delete the `showAnalysisLoading`/`analysisLoading`/`loadingCompany`/`loadingStage` element lookups at the top of the file along with `stageLabel` (only `startAccountPolling` used it) — Task 2's markup has no `#analysis-loading` element for these to find. Also delete `accountPollGeneration`, `accountPollTimer`, `newsGeneration`, `newsRefreshCooldownActive`, and the `companyLoads`/`createLatestRequestController` remnants already removed in Step 3.

- [ ] **Step 9: Make export/PDF inert**

Old:
```javascript
async function downloadSummaryPdf(button) {
  if (!currentAnalysis || !currentNumber) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Building PDF...";
  try {
    const response = await fetch(`/api/company/${encodeURIComponent(currentNumber)}/export-summary?source=${encodeURIComponent(currentSource || "live")}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(currentAnalysis.settings ?? {})
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `PDF export failed (HTTP ${response.status}).`);
    }
    if (!(response.headers.get("content-type") || "").toLowerCase().includes("application/pdf")) throw new Error("The server returned an invalid PDF response.");
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const filename = disposition.match(/filename="([^"]+)"/i)?.[1] || `${currentNumber}-acquisition-summary.pdf`;
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    status.className = "status";
    status.textContent = "Acquisition summary downloaded.";
  } catch (error) {
    status.className = "status error";
    status.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}
```
New:
```javascript
function downloadSummaryPdf(button) {
  status.className = "status";
  status.textContent = "PDF export isn't available in this hosted demo.";
}
```

- [ ] **Step 10: Make News always render the static note**

Old:
```javascript
function newsSectionHtml(company) {
  if (company.fixture) {
    return `<section id="news" class="section">
      <h2>What's been said publicly?</h2>
      <p class="section-lead">Recent public news mentions matched against the company's registered name, with a visible match-confidence flag on every result.</p>
      <p class="empty-note">News search is only available for live company records.</p>
    </section>`;
  }
  return `<section id="news" class="section">
    <div class="company-head">
      <div><h2>What's been said publicly?</h2></div>
      <div class="report-actions"><button type="button" id="news-refresh" class="export-button" disabled>Refresh</button></div>
    </div>
    <p class="section-lead">Recent public news mentions matched against the company's registered name, with a visible match-confidence flag on every result. Automated matching can surface unrelated results — always check the source before relying on it.</p>
    <div id="news-body">${newsLoadingHtml()}</div>
  </section>`;
}
```
New:
```javascript
function newsSectionHtml() {
  return `<section id="news" class="section">
    <h2>What's been said publicly?</h2>
    <p class="section-lead">Recent public news mentions matched against the company's registered name, with a visible match-confidence flag on every result.</p>
    <p class="empty-note">News lookup isn't available in this hosted demo.</p>
  </section>`;
}
```

And remove the now-dead call site in `loadCompany` (already done implicitly — Step 8's replacement `loadCompany` never calls `kickOffCompanyNews`). Delete `kickOffCompanyNews`, `loadCompanyNews`, `renderNewsResult`, `newsResultBodyHtml`, `newsCardHtml`, `newsLoadingHtml`, `newsApiUrl`, `beginNewsRefreshCooldown`, `setNewsRefreshEnabled`, `newsPublishedLabel`, `NEWS_MATCH_*` constants, and the `report.addEventListener("click", ...)` block that wires `#news-expand`/`#news-retry`/`#news-refresh` (all now unreachable since the news section never renders those buttons).

- [ ] **Step 11: Delete the now-unused `request()` helper**

Every remaining caller from the original file has been replaced above. Confirm nothing still calls `request(` (grep the file), then delete the function:

```javascript
async function request(url, options = {}) { /* ... */ }
```

- [ ] **Step 12: Run through the checklist for anything still referencing `/api/`**

```bash
grep -n "/api/\|fetch(\`/\|request(" "/d/zechgeorge.github.io/merchantscope/app.js"
```

Expected at this point: only the two new `fetch("merchantscope/data/...")` / `fetch("merchantscope/deep-dive-mock.html")` calls from Step 2 and the existing (unmodified, still needed — see Task 5) deep-dive-mock fetch. No `/api/` substrings should remain.

- [ ] **Step 13: Manual browser verification**

With the static server running, hard-refresh `http://localhost:4500/merchantscope.html`. Confirm:
- "Recent screenings" shows Avon Timber Merchants, Travis Perkins PLC, MKM Building Supplies (Leamington Spa) — no console errors.
- Clicking a history row opens its report (URL becomes `#/company/02497863?source=live` etc.), sections render, no broken images beyond the intentionally-unavailable evidence periods.
- Typing "keyline" in the search box and clicking the result opens Keyline's report in its unreconciled state (stance Investigate, tier D, "Valuation unavailable").
- History and Settings nav links work; Settings shows the inert note; the "Export report" button shows the inert status message instead of erroring.
- Hard-refreshing on a `#/company/...` URL still lands on the right report (confirms hash routing survives a reload, unlike the original pushState routing would have on static hosting).

- [ ] **Step 14: Commit**

```bash
cd "/d/zechgeorge.github.io"
git add merchantscope/app.js
git commit -m "Port MerchantScope app.js to run entirely off static fixtures"
```

---

### Task 5: The Keyline reconcile flow

**Files:**
- Modify: `merchantscope/app.js` (review overlay + evidence rendering)

**Interfaces:**
- Consumes: `merchantscope/data/keyline-review-before.json` (Task 1), `merchantscope/data/keyline-after.json` (Task 1), `loadKeylineAfter()`/`loadKeylineReview()` (Task 4 Step 2), `render()` (unchanged from source).

- [ ] **Step 1: Replace `openReview` to read the baked review payload and track local approval state**

Old:
```javascript
async function openReview() {
  if (!currentNumber) return;
  const overlay = ensureReviewOverlay();
  const body = overlay.querySelector("#review-body");
  overlay.classList.remove("hidden");
  body.innerHTML = "<p>Loading review data…</p>";
  try {
    const payload = await request(`/api/company/${encodeURIComponent(currentNumber)}/review?source=${encodeURIComponent(currentSource || "live")}`);
    const filingHistoryUrl = currentAnalysis?.company?.sources?.find((source) => /filing-history/.test(source.url || ""))?.url ?? null;
    body.innerHTML = payload.periods.length
      ? payload.periods.map((period) => periodReviewHtml(period, filingHistoryUrl)).join("")
      : "<p>No captured periods are available to review.</p>";
    body.querySelectorAll(".use-alternate").forEach((button) => button.addEventListener("click", (event) => {
      const input = event.currentTarget.closest("td").querySelector("input[data-field]");
      input.value = event.currentTarget.dataset.value;
    }));
    body.querySelectorAll(".zoom-image").forEach((button) => button.addEventListener("click", (event) => openImageLightbox(event.currentTarget.dataset.imageUrl)));
    body.querySelectorAll(".save-review, .approve-review").forEach((button) => button.addEventListener("click", (event) => void submitReview(event.currentTarget)));
  } catch (error) {
    body.innerHTML = `<p class="status error">${escapeHtml(error.message)}</p>`;
  }
}
```
New:
```javascript
const approvedPeriods = new Set(); // "periodEnd|scope" keys, reset per company load

async function openReview() {
  if (!currentNumber) return;
  const overlay = ensureReviewOverlay();
  if (currentNumber !== "SC042425") {
    // Avon Timber, Travis Perkins and MKM Leamington Spa are already reconciled
    // in their baked fixtures — only Keyline ships a review payload, since it's
    // the one company this demo walks through the reconcile flow for.
    overlay.classList.remove("hidden");
    overlay.querySelector("#review-body").innerHTML = "<p>This company's accounts are already reconciled — there is nothing to review. The demo's reconcile walkthrough is available on Keyline Civils Specialist Limited.</p>";
    return;
  }
  const body = overlay.querySelector("#review-body");
  overlay.classList.remove("hidden");
  body.innerHTML = "<p>Loading review data…</p>";
  try {
    const payload = await loadKeylineReview();
    for (const period of payload.periods) period.reviewed = approvedPeriods.has(`${period.periodEnd}|${period.scope}`);
    const filingHistoryUrl = currentAnalysis?.company?.sources?.find((source) => /filing-history/.test(source.url || ""))?.url ?? null;
    body.innerHTML = payload.periods.length
      ? payload.periods.map((period) => periodReviewHtml(period, filingHistoryUrl)).join("")
      : "<p>No captured periods are available to review.</p>";
    body.querySelectorAll(".zoom-image").forEach((button) => button.addEventListener("click", (event) => openImageLightbox(event.currentTarget.dataset.imageUrl)));
    body.querySelectorAll(".approve-review").forEach((button) => button.addEventListener("click", (event) => void submitReview(event.currentTarget)));
  } catch (error) {
    body.innerHTML = `<p class="status error">${escapeHtml(error.message)}</p>`;
  }
}
```

- [ ] **Step 2: Replace `submitReview` to approve locally and swap in the real reconciled fixture once every period is approved**

Old:
```javascript
async function submitReview(button) {
  const article = button.closest(".review-period");
  const periodEnd = article.dataset.periodEnd;
  const scope = article.dataset.scope;
  const approve = button.dataset.approve === "true";
  const edits = {};
  article.querySelectorAll("input[data-field]").forEach((input) => {
    if (input.value !== "" && Number.isFinite(Number(input.value))) edits[input.dataset.field] = Number(input.value);
  });
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "Saving…";
  try {
    const analysis = await request(`/api/company/${encodeURIComponent(currentNumber)}/review?source=${encodeURIComponent(currentSource || "live")}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ periodEnd, scope, edits, approve, settings: currentAnalysis?.settings })
    });
    currentAnalysis = analysis;
    render(analysis);
    const reviewBody = ensureReviewOverlay().querySelector("#review-body");
    const scrollTop = reviewBody.scrollTop;
    await openReview();
    reviewBody.scrollTop = scrollTop;
  } catch (error) {
    status.className = "status error";
    status.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}
```
New:
```javascript
const KEYLINE_PERIOD_COUNT = 4; // 2025-12-31, 2024-12-31, 2023-12-31, 2022-12-31 — see keyline-review-before.json

async function submitReview(button) {
  const article = button.closest(".review-period");
  const periodEnd = article.dataset.periodEnd;
  const scope = article.dataset.scope;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "Saving…";
  approvedPeriods.add(`${periodEnd}|${scope}`);
  if (approvedPeriods.size >= KEYLINE_PERIOD_COUNT) {
    const analysis = await loadKeylineAfter();
    currentAnalysis = analysis;
    upsertHistory(historyEntryFrom(analysis, currentSource));
    render(analysis);
    status.className = "status";
    status.textContent = "All periods reconciled — the report has been updated.";
  }
  const reviewBody = ensureReviewOverlay().querySelector("#review-body");
  const scrollTop = reviewBody.scrollTop;
  await openReview();
  reviewBody.scrollTop = scrollTop;
  button.disabled = false;
  button.textContent = original;
}
```

- [ ] **Step 3: Reset `approvedPeriods` on every company load**

In the `loadCompany()` function written in Task 4 Step 8, add one line clearing the set (a stale approval from a previous visit to Keyline must not silently carry over):

Old:
```javascript
async function loadCompany(companyNumber, source = currentSource) {
  resetDeepDiveTab();
```
New:
```javascript
async function loadCompany(companyNumber, source = currentSource) {
  approvedPeriods.clear();
  resetDeepDiveTab();
```

- [ ] **Step 4: Drop the "Save edits" button and per-field editing — the demo only supports approving real captured values as-is**

Old (inside `periodReviewHtml`):
```javascript
    <div class="review-actions">
      <button type="button" class="text-button save-review" data-approve="false">Save edits</button>
      <button type="button" class="primary approve-review" data-approve="true">Approve &amp; save</button>
    </div>
```
New:
```javascript
    <div class="review-actions">
      <button type="button" class="primary approve-review">Approve &amp; confirm</button>
    </div>
```

The `evidenceGroupFieldsHtml` function still renders each field's value in a (now read-only-in-spirit, still technically editable) `<input>` — leave the inputs as-is visually (matches the real product's look), just note in Step 2 above that `submitReview` no longer reads their values at all, so editing them has no effect. This is a deliberate, documented simplification (see the design spec's "Out of scope" section) — do not attempt to wire per-field edits into the fixture swap.

- [ ] **Step 5: Handle the two periods with no static evidence image**

The `demoUnavailable: true` flag was written onto affected `evidenceUrl`-bearing nodes by Task 1's build script. Add a branch for it in `evidenceGroupVisualHtml`:

Old:
```javascript
function evidenceGroupVisualHtml(group, filingHistoryUrl) {
  const evidence = group.provenance;
  if (group.key.startsWith("pdf:")) {
```
New:
```javascript
function evidenceGroupVisualHtml(group, filingHistoryUrl) {
  const evidence = group.provenance;
  if (evidence?.demoUnavailable) {
    return `<p class="evidence-caption">Evidence imagery isn't available for every period in this hosted demo — the figures and page reference shown are exactly what the reconciliation engine captured.${Number.isFinite(evidence.page) ? ` (Page ${escapeHtml(String(evidence.page))}.)` : ""}</p>`;
  }
  if (group.key.startsWith("pdf:")) {
```

Also check `groupFieldsByEvidence` (unchanged) still groups correctly when `evidenceUrl` is `null` but `demoUnavailable` is `true` — its grouping key falls through to `field.provenance?.documentId ? "xbrl:..." : "none"` in that case since `evidence?.evidenceUrl` is falsy. That's fine functionally (fields still group together by shared `documentId`), but it means the `xbrl:` branch's copy ("Structured filing data — no page image is available for this format") would render instead of the new `demoUnavailable` copy above, because `evidenceGroupVisualHtml` checks `group.key.startsWith("pdf:")` first and `demoUnavailable` second only inside that path. Fix the ordering — check `demoUnavailable` before the key-prefix branches:

Old (the fix above already shows the corrected order — `demoUnavailable` check is first). No further change needed as long as Step 5's edit is applied before, not after, the `pdf:`/`xbrl:` checks, which it is.

- [ ] **Step 6: Manual browser verification of the full reconcile flow**

With the static server running:
1. Search "keyline", open the result. Confirm: stance "Investigate", tier D, "Valuation unavailable", and the Automated Reconciliation section (§06) shows "Did not reconcile" for all four periods with a "Review and confirm figures" button.
2. Click "Review and confirm figures". Confirm the overlay opens with four period cards; the 2025 and 2024 cards show the real scanned evidence image (click to zoom, confirm the lightbox opens); the 2023 and 2022 cards show the "evidence imagery isn't available" note instead of a broken image.
3. Click "Approve & confirm" on all four periods one at a time. Confirm each click updates that period's "Not yet reviewed" → "Human reviewed" badge, and after the fourth, the overlay's periods all show reviewed, the underlying report re-renders with stance "Proceed", tier A, EV range roughly £29.7m–£59.4m, and a status message confirming the update.
4. Close the overlay, click the "Deep dive" tab, click "Add accounts" → "Use dummy data — Thornbury demo". Confirm the deep-dive-mock content loads into the tab.
5. Reload the page and repeat step 1 — confirm Keyline is back to its unreconciled starting state (the fixture swap must not leak into `localStorage` or otherwise persist across a fresh load, only the history entry should persist).

- [ ] **Step 7: Commit**

```bash
cd "/d/zechgeorge.github.io"
git add merchantscope/app.js
git commit -m "Wire the Keyline reconcile-and-deep-dive demo flow"
```

---

### Task 6: Final cross-page smoke test and cleanup

**Files:**
- Delete: `D:\zechgeorge.github.io\.staging\` (once Task 1–5 are committed, this scratch directory is no longer needed — its outputs live in `merchantscope/data/` and `merchantscope/evidence/`)

- [ ] **Step 1: Remove the staging directory**

```bash
rm -rf "/d/zechgeorge.github.io/.staging"
```

- [ ] **Step 2: Full click-through with the static server**

Visit `index.html` → click "Explore Projects" → confirm the picker shows both cards → open MerchantScope → run the full Task 5 Step 6 flow again from a clean load → click "&larr; zechgeorge.com" → confirm it returns to `projects.html`. Then separately open `book-forecasting.html` directly and confirm the forecasting case study renders unchanged from before this project started.

- [ ] **Step 3: Check for leftover dead references**

```bash
grep -rn "merchantscope.html\" class=\"active\"\|MerchantScope</a>" "/d/zechgeorge.github.io/index.html" "/d/zechgeorge.github.io/about.html" "/d/zechgeorge.github.io/projects.html" "/d/zechgeorge.github.io/book-forecasting.html"
```

Expected: no output (the standalone nav link is gone everywhere).

- [ ] **Step 4: Commit**

```bash
cd "/d/zechgeorge.github.io"
git add -A
git commit -m "Remove MerchantScope demo staging scratch directory"
git status
```

Expected: working tree clean.
