# MerchantScope static demo — design

Date: 2026-08-06

## Context

zechgeorge.github.io currently has a `merchantscope.html` page that is a static marketing/case-study page about the MerchantScope product (a local Node app at `acquisition-hub/` that screens UK building-merchant acquisition targets against Companies House data). It is not interactive — it's copy plus one static mockup screenshot-style block.

Zech wants a backup demo he can show from any browser (not just his own PC, in case the real local app isn't available) that is actually interactive: real navigation, a real search, a real "reconcile the accounts" action that changes the screen, and a real deep dive. It should live at the same URL (`merchantscope.html`), replacing the current static page in place.

## Goals

- A fully static (GitHub Pages, no backend) interactive recreation of the real acquisition-hub app's core flow: Home (search + recent screenings) → Report (tabs: Initial review, Deep dive) → History.
- Pre-loaded "recent screenings" / history containing three real, already-resolved companies: Avon Timber Merchants Ltd, Travis Perkins PLC, MKM Building Supplies (Leamington Spa) Ltd.
- A live demo flow for a fourth company, Keyline Civils Specialist Ltd: search for it, open its report in its real *unreconciled* state, use the "Review and confirm figures" action to reconcile its accounts, watch the stance/tier/valuation update in place, then open the Deep dive tab.
- Visually and structurally faithful to the real product (its own dark-onyx/spring-green design system), since this is meant to stand in for the real thing.
- Settings screen present for completeness (matches the real app's Settings page) but inert — not wired to anything.

## Non-goals

- No real backend, no real Companies House API calls, no real OCR/extraction pipeline.
- No authentication, no persistence beyond the visitor's own browser (`localStorage`), no working credential/API-key flow.
- No live news fetch (copyright/attribution risk reproducing scraped articles, plus another live dependency) — News & mentions renders as a static "not available in this hosted demo" note.
- No PDF export (needs server-side rendering) — button present, inert.
- Not trying to reproduce every one of the real report's 11 sections pixel-for-pixel from scratch — reuse the real product's own markup/CSS/rendering logic wherever practical, adapted to run off static JSON instead of a live API.

## Data: real, not fabricated

All figures are pulled from the real acquisition-hub app running locally today (2026-08-06), via its own `/api/company/:number` and `/api/company/:number/review` endpoints — not invented. This matters because these are real, named companies; illustrative numbers under their names would be misleading on a public site.

Captured and staged at `D:\zechgeorge.github.io\.staging\` (to be moved into the final repo layout during implementation):

- `avon-timber.json` — Avon Timber Merchants Ltd, reconciled: **Investigate, Tier A, EV £2.44m–£4.88m**.
- `travis-perkins.json` — Travis Perkins PLC, reconciled: **Stop, Tier B, EV £1.14bn–£2.51bn**.
- `mkm-leamington.json` — MKM Building Supplies (Leamington Spa) Ltd, reconciled: **Investigate, Tier A, EV £668k–£1.34m**.
- `keyline.json` — Keyline Civils Specialist Ltd, **before** state (real): Investigate, Tier D, "did not reconcile", no EV.
- `keyline-after-approve.json` — Keyline Civils Specialist Ltd, **after** state (real, produced by actually approving its review through the live app's own reconciliation logic): **Proceed, Tier A, EV £29.7m–£59.4m**.
- `keyline-review.json` / `keyline-review-after.json` — the review payloads (candidate figures per period, before/after) used to build the reconciliation UI.
- `evidence/keyline-2025-pl-page18.png`, `evidence/keyline-2023-pl-page16.png` — two real scanned filing-page images (the actual evidence pages behind Keyline's 2025 and 2024 P&L figures), pulled from the app's own evidence renderer. Used on two of the four reconciliation period cards; the other two periods show a plain "evidence imagery isn't available for every period in this hosted demo" note rather than a fake image.

Sanitization: exported JSON checked for leaked secrets/paths — none found (only false-positive matches on the word "secretary").

## Site structure changes

- `projects.html` becomes a picker page: two cards, "Book Forecasting" and "MerchantScope", replacing its current single-case-study content.
- `book-forecasting.html` (new) receives the current `projects.html` content unchanged.
- `merchantscope.html` is replaced in place with the interactive demo shell.
- Top nav (`index.html`, `about.html`, `projects.html`, `book-forecasting.html`, `merchantscope.html`) drops the standalone "MerchantScope" link; "Projects" remains and leads to the picker.
- `index.html`'s "Featured Work" cards link directly to `book-forecasting.html` and `merchantscope.html`.

## Demo architecture

- `merchantscope.html` — entry shell (kept at the existing URL), loads the demo's own assets.
- `merchantscope/app.js` — client-side app logic, adapted from `acquisition-hub/public/app.js`: same view-rendering functions (report sections, financials, reconciliation, risks, valuation, diligence, sources), reworked to read from static JSON fixtures instead of fetching a live API, with client-side search (filters the 4 seeded companies by name), client-side routing (Home / History / Settings / Report), and `localStorage`-backed history instead of a server history file.
- `merchantscope/styles.css`, `merchantscope/formatters.js` — ported from the real app's own files (small: ~520 and ~18 lines respectively) so the demo uses the product's real dark-onyx/spring-green design system, not the portfolio site's visual style.
- `merchantscope/data/*.json` — the fixtures listed above, trimmed of anything server-only (job IDs, internal file-system evidence paths that won't resolve statically) and with evidence URLs repointed at the two static PNGs where available.
- `merchantscope/deep-dive-keyline.html` — adapted from `acquisition-hub/public/deep-dive-mock.html` (already a self-contained "preview the finished capability" mock, currently branded for a fictional "Thornbury Building Supplies"), reskinned for Keyline and its real reconciled headline numbers. This is the same "offline mode" pattern already used by the real product for this exact tab.
- `merchantscope/evidence/*.png` — the two real evidence images.

## Screens

**Home** — search box + "Recent screenings" list seeded with Avon Timber, Travis Perkins, MKM Leamington Spa (their real reconciled result cards: name, stance, tier, EV). Typing "keyline" filters to the one match.

**History** — same three, in a full list view, matching the real app's History page. Clicking any card opens its Report.

**Settings** — present in the nav, renders the real app's settings markup (credential panel + valuation-assumption defaults form) but every control is inert; clicking Save shows a small inline "Settings aren't wired up in this hosted demo" note instead of doing anything.

**Report — Initial review tab** — decision brief, company story, ownership, financials, resilience, automated reconciliation, risk register, valuation, diligence plan, sources, news (news renders the static "not available" note; export-report button is present but inert). For Avon/Travis/MKM this renders already-reconciled. For Keyline it renders the real unreconciled state, including the "Did the extracted accounts reconcile?" panel showing "Did not reconcile" and a working "Review and confirm figures" button.

**Reconcile flow (Keyline only)** — clicking "Review and confirm figures" opens the real review overlay: four periods, each showing extracted candidate values (real, from `keyline-review.json`), two of the four periods showing their real evidence page image, "Approve & save" per period. Approving all four swaps the in-memory analysis over to `keyline-after-approve.json` and re-renders the report in place: stance chip Investigate → Proceed, tier D → A, EV null → £29.7m–£59.4m, reconciliation panel badges flip to "Human reviewed", and the Deep dive tab (previously locked/empty) becomes available.

**Report — Deep dive tab** — `deep-dive-keyline.html` content, embedded/linked in-place once unlocked.

## Out of scope for this build

- Editing individual reconciliation field values (the real review UI lets you type a corrected number before approving — the demo's "Approve & save" just accepts the real captured values as-is).
- Any company other than the four seeded ones — no free-text live search beyond filtering those four.
- Mobile-specific redesign beyond whatever responsiveness the real app's own `styles.css` already provides.
