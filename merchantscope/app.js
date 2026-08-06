import { safeDateLabel, safeDateTimeLabel } from "./formatters.js";

const $ = (selector) => document.querySelector(selector);
const status = $("#status");
const results = $("#search-results");
const searchInput = $("#search-input");
const searchCombobox = $("#search-combobox");
const workspace = $("#workspace");
const report = $("#report");
const deepDiveReport = $("#deep-dive-report");
const deepDiveReportDefaultHtml = deepDiveReport.innerHTML;
const reportTabButtons = [...document.querySelectorAll(".report-tab")];
let currentNumber = null;
let currentSource = null;
let currentAnalysis = null;
const credentialInput = $("#credential-input");
const credentialStatus = $("#credential-status");
const credentialSave = $("#credential-save");
const credentialRemove = $("#credential-remove");
const credentialPanel = $("#credential-panel");
const historyClearAll = $("#history-clear-all");
let sectionObserver = null;
let sectionScrollHandler = null;

// ---------------------------------------------------------------------------
// Fixture data layer. This demo is fully static (GitHub Pages, no backend) —
// every company report is one of four real, baked analyses pulled from the
// real acquisition-hub app's own output, not invented. Keyline additionally
// ships a "before" and "after" state plus a review payload, so the reconcile
// flow (see openReview/submitReview below) is a genuine before/after swap,
// not a simulation of numbers that were never real.
// ---------------------------------------------------------------------------
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
  const stored = sessionStorage.getItem(HISTORY_KEY);
  if (stored) return JSON.parse(stored);
  const seedResponse = await fetch("merchantscope/data/history-seed.json");
  const seed = await seedResponse.json();
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(seed));
  return seed;
}
function saveHistory(entries) {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}
function upsertHistory(entry) {
  const entries = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
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

// Credential setup used to be a collapsible popover under a mode chip on
// the old single-page hero; it now lives permanently on its own Settings
// page, so there is nothing left to collapse — this just guarantees it
// stays visible regardless of configuration state.
function setCredentialPanel() {
  credentialPanel.classList.remove("hidden");
}
setCredentialPanel();

const pages = { home: $("#page-home"), history: $("#page-history"), settings: $("#page-settings"), report: $("#page-report") };
const railLinks = [...document.querySelectorAll(".topnav a[data-route]")];

function showPage(name) {
  for (const [key, element] of Object.entries(pages)) element.classList.toggle("hidden", key !== name);
  for (const link of railLinks) {
    const active = link.dataset.route === name;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  }
}

// Hash-based routing — GitHub Pages is static hosting with no server-side
// rewrite, so a real pushState path like /company/SC042425 would 404 on a
// hard refresh or a shared link. #/company/SC042425 never leaves the page.
function navigate(path) {
  location.hash = `#${path}`;
}

async function renderRoute() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [path, queryString] = hash.split("?");
  const params = new URLSearchParams(queryString || "");
  const companyMatch = path.match(/^\/company\/([^/]+)$/);
  if (companyMatch) {
    showPage("report");
    const number = decodeURIComponent(companyMatch[1]);
    const source = params.get("source") || "live";
    if (number !== currentNumber || source !== currentSource) await loadCompany(number, source);
    return;
  }
  currentNumber = null;
  currentSource = null;
  if (path === "/history") { showPage("history"); await renderHistoryPage(); return; }
  if (path === "/settings") { showPage("settings"); await renderSettingsPage(); return; }
  showPage("home");
  await renderHomePage();
}

window.addEventListener("hashchange", () => void renderRoute());

const stanceTagClass = (stance) => ({ Proceed: "low", Investigate: "medium", Stop: "high" }[stance] || "");
const SEVERITY_METER_LEVEL = { low: 1, medium: 2, high: 3, critical: 4 };
const severityMeterHtml = (severity) => {
  const level = SEVERITY_METER_LEVEL[severity] ?? 0;
  const bars = Array.from({ length: 4 }, (_, i) => `<i class="${i < level ? "on" : ""}"></i>`).join("");
  return `<span class="signal-bars signal-bars-severity severity-${escapeHtml(severity)}" aria-hidden="true">${bars}</span>`;
};
const stanceReadoutClass = (stance) => ({ Proceed: "class-locked", Investigate: "class-tracking", Stop: "class-lost" }[stance] || "");

function recentListHtml(entries, { withRemove = false } = {}) {
  return `<div class="recent-list">${entries.map((entry) => `
    <div class="recent-row" role="button" tabindex="0" data-number="${escapeHtml(entry.companyNumber)}" data-source="${escapeHtml(entry.source)}">
      <span><span class="rr-name">${escapeHtml(entry.name)}</span><span class="rr-meta">${escapeHtml(entry.companyNumber)} &middot; screened ${escapeHtml(entry.screenedAt ? safeDateTimeLabel(entry.screenedAt) : "Unavailable")}</span></span>
      <span class="tag ${escapeHtml(stanceTagClass(entry.stance))}">${escapeHtml(entry.stance || "Unknown")}</span>
      <span>${entry.tier ? `Tier ${escapeHtml(entry.tier)}` : "—"}</span>
      <span class="rr-val">${Number.isFinite(entry.evLow) ? `${money(entry.evLow)}–${money(entry.evHigh)}` : "Unavailable"}</span>
      <span>${withRemove ? `<button type="button" class="text-button remove-history" data-number="${escapeHtml(entry.companyNumber)}" data-source="${escapeHtml(entry.source)}">Remove</button>` : ""}</span>
    </div>`).join("")}</div>`;
}

function wireRecentRows(container) {
  container.querySelectorAll(".recent-row").forEach((row) => {
    const open = () => navigate(`/company/${encodeURIComponent(row.dataset.number)}?source=${encodeURIComponent(row.dataset.source)}`);
    row.addEventListener("click", (event) => { if (!event.target.closest(".remove-history")) open(); });
    row.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && !event.target.closest(".remove-history")) { event.preventDefault(); open(); }
    });
  });
  container.querySelectorAll(".remove-history").forEach((button) => button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const { number, source } = event.currentTarget.dataset;
    const entries = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
    saveHistory(entries.filter((e) => !(e.companyNumber === number && e.source === source)));
    await renderRoute();
  }));
}

const HOME_FILTERS = [
  { key: "all", label: "All", cls: "" },
  { key: "Proceed", label: "Proceed", cls: "class-locked" },
  { key: "Investigate", label: "Investigate", cls: "class-tracking" },
  { key: "Stop", label: "Stop", cls: "class-lost" }
];
let homeFilterActive = "all";

function renderHomeList(entries) {
  const list = $("#dash-recent-list");
  const filtered = homeFilterActive === "all" ? entries : entries.filter((e) => e.stance === homeFilterActive);
  list.innerHTML = filtered.length
    ? recentListHtml(filtered.slice(0, 8))
    : `<p class="empty-note">${entries.length ? "No screenings match this filter." : "No companies screened yet — search above to begin."}</p>`;
  wireRecentRows(list);
}

function renderHomeFilters(entries) {
  const filters = $("#dash-filters");
  const counts = { all: entries.length, Proceed: 0, Investigate: 0, Stop: 0 };
  for (const entry of entries) if (counts[entry.stance] !== undefined) counts[entry.stance]++;
  filters.innerHTML = HOME_FILTERS.map((f) => `
    <button type="button" class="fchip ${f.cls} ${homeFilterActive === f.key ? "on" : ""}" data-filter="${escapeHtml(f.key)}">
      ${escapeHtml(f.label)} ${escapeHtml(String(counts[f.key]))}
    </button>`).join("");
  filters.querySelectorAll(".fchip").forEach((chip) => chip.addEventListener("click", () => {
    homeFilterActive = chip.dataset.filter;
    renderHomeFilters(entries);
    renderHomeList(entries);
  }));
}

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

historyClearAll.addEventListener("click", async () => {
  if (!window.confirm("Clear all screening history for this demo? This only clears your browser's local copy.")) return;
  saveHistory([]);
  await renderHistoryPage();
});

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

function closeSearchResults() {
  results.classList.add("hidden");
  searchInput.setAttribute("aria-expanded", "false");
}

function openSearchResults() {
  results.classList.remove("hidden");
  searchInput.setAttribute("aria-expanded", "true");
}

// Scoped to the visible tab panel only — with both "Initial review" and
// "Deep dive" side-navs present in the DOM at once (one hidden), tracking
// every link regardless of tab would observe sections nobody can see.
function initialiseSectionTracking() {
  sectionObserver?.disconnect();
  if (sectionScrollHandler) window.removeEventListener("scroll", sectionScrollHandler);
  const links = [...document.querySelectorAll(".tab-panel:not(.hidden) .side-nav a[href^='#']")];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  const activate = (id) => links.forEach((link) => {
    const active = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  if (!sections.length) return;
  const atDocumentBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  activate(sections[0].id);
  sectionObserver = new IntersectionObserver((entries) => {
    if (atDocumentBottom()) {
      activate(sections.at(-1).id);
      return;
    }
    const visible = entries.filter((entry) => entry.isIntersecting)
      .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
    if (visible) activate(visible.target.id);
  }, { rootMargin: "-18% 0px -68% 0px", threshold: 0 });
  sections.forEach((section) => sectionObserver.observe(section));
  sectionScrollHandler = () => {
    if (atDocumentBottom()) activate(sections.at(-1).id);
  };
  window.addEventListener("scroll", sectionScrollHandler, { passive: true });
}

function setReportTab(tab) {
  reportTabButtons.forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $("#tab-panel-initial").classList.toggle("hidden", tab !== "initial");
  $("#tab-panel-deepdive").classList.toggle("hidden", tab !== "deepdive");
  initialiseSectionTracking();
}
reportTabButtons.forEach((button) => button.addEventListener("click", () => setReportTab(button.dataset.tab)));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[char]));
const money = (value) => Number.isFinite(value)
  ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value)
  : "Unavailable";
const number = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : "Unavailable";
const date = (value) => value ? safeDateLabel(value) : "Unavailable";
// Unlike the valuation section (which falls back to bare operating profit
// when depreciation/amortisation are missing, since a size proxy is still
// useful), this raw data table never fabricates or substitutes — EBITDA
// shows "Unavailable" unless the depreciation/amortisation add-back was
// genuinely captured from the filing.
const ebitdaValue = (period) => {
  if (!Number.isFinite(period.operatingProfit)) return null;
  const hasCombined = Number.isFinite(period.depreciationAndAmortisation);
  const hasSplit = Number.isFinite(period.depreciationCharge) || Number.isFinite(period.amortisationCharge);
  if (!hasCombined && !hasSplit) return null;
  const dNa = hasCombined ? period.depreciationAndAmortisation
    : (Number.isFinite(period.depreciationCharge) ? period.depreciationCharge : 0) + (Number.isFinite(period.amortisationCharge) ? period.amortisationCharge : 0);
  return period.operatingProfit + dNa;
};
const observationPeriod = (item) => {
  const raw = item.period?.end;
  const label = safeDateLabel(raw);
  return `${escapeHtml(label)}${label === "Invalid/unavailable" && raw != null ? `<small>Raw: ${escapeHtml(raw)}</small>` : ""}`;
};
const renderDiagnostics = (failures = []) => failures.length
  ? `<details class="diagnostics"><summary>${failures.length} diagnostic${failures.length === 1 ? "" : "s"}</summary><ul>${failures.map((failure) => `<li>${escapeHtml(String(failure).replaceAll("_", " "))}</li>`).join("")}</ul></details>`
  : '<span class="diagnostics-clear">None</span>';
const pnlUnavailableReason = (company) => {
  const type = String(company?.accountsType || "").toLowerCase();
  if (type.includes("dormant")) return "The most recent filing was dormant accounts, which report no trading activity and do not include a profit and loss account.";
  if (type.includes("micro")) return "The company files micro-entity accounts, which UK law does not require to include a profit and loss account in the public record.";
  if (type.includes("abridged")) return "The company files abridged accounts, which UK law allows to omit the profit and loss account from the public record.";
  return "The profit and loss account was not captured from the available filing.";
};
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const RECONCILIATION_STATUS_LABELS = {
  pass: "Reconciled", fail: "Did not reconcile", incomplete: "Not enough evidence",
  not_applicable: "Not applicable", not_applicable_public_format: "Not applicable for this statement format",
  not_applicable_public_subtotal_chain: "Not applicable for this statement format",
  partial_no_cost_bridge: "Headline figures only; cost breakdown not verified",
  partial_no_provisions_bridge: "Headline figures only; full bridge not verified",
  human_reviewed: "Confirmed by human review"
};
const reconciliationLabel = (status) => RECONCILIATION_STATUS_LABELS[status]
  || (status ? String(status).replaceAll("_", " ") : "Not available");
// "Evidence confidence" - deliberately never "accuracy". It only reflects
// how much automated reconciliation/coverage checking a period passed
// through; it is not a claim that the figures are correct, so the copy here
// must keep prompting a human check rather than implying verification.
const CONFIDENCE_BAND_LABEL = { high: "High", medium: "Medium", low: "Low", human_confirmed: "Human reviewed" };
const CONFIDENCE_METER_LEVEL = { low: 1, medium: 3, high: 4, human_confirmed: 5 };
const confidenceMeterHtml = (band) => {
  const level = CONFIDENCE_METER_LEVEL[band] ?? 0;
  const bars = Array.from({ length: 5 }, (_, i) => `<i class="${i < level ? "on" : ""}"></i>`).join("");
  return `<span class="signal-bars confidence-${escapeHtml(band)}" aria-hidden="true">${bars}</span>`;
};
const confidenceReasonsText = (confidence) => (confidence?.reasons ?? []).map((reason) => String(reason).replaceAll("_", " ")).join("; ") || "No issues noted.";
const confidenceBadgeHtml = (confidence) => {
  if (!confidence?.band) return '<span class="tag">Not scored</span>';
  const band = confidence.band;
  const scoreSuffix = Number.isFinite(confidence.score) ? ` (${confidence.score})` : "";
  return `<span class="tag confidence-${escapeHtml(band)}" title="${escapeHtml(confidenceReasonsText(confidence))}">${confidenceMeterHtml(band)}${escapeHtml(CONFIDENCE_BAND_LABEL[band] || band)} confidence${band === "human_confirmed" ? "" : escapeHtml(scoreSuffix)}</span>`;
};
const confidenceCellHtml = (confidence) => {
  if (!confidence?.band) return '<span class="diagnostics-clear">Not scored</span>';
  if (confidence.band === "human_confirmed") return `<span class="tag confidence-human_confirmed">${confidenceMeterHtml("human_confirmed")}Human reviewed</span>`;
  const reasons = confidence.reasons ?? [];
  const scoreSuffix = Number.isFinite(confidence.score) ? ` (${confidence.score})` : "";
  return `<details class="diagnostics confidence-detail confidence-${escapeHtml(confidence.band)}"><summary title="${escapeHtml(confidenceReasonsText(confidence))}">${confidenceMeterHtml(confidence.band)}${escapeHtml(CONFIDENCE_BAND_LABEL[confidence.band] || confidence.band)}${escapeHtml(scoreSuffix)}</summary>${reasons.length ? `<ul>${reasons.map((reason) => `<li>${escapeHtml(String(reason).replaceAll("_", " "))}</li>`).join("")}</ul>` : '<p class="evidence-caption">No issues noted.</p>'}</details>`;
};
const humanizeCanonicalField = (field) => String(field ?? "").replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase());

// News lookup needs a live server, so it's a plain static note in this demo —
// see design spec: reproducing scraped articles here would also be a
// copyright/attribution risk this demo doesn't need to take on.
function newsSectionHtml() {
  return `<section id="news" class="section">
    <h2>What's been said publicly?</h2>
    <p class="section-lead">Recent public news mentions matched against the company's registered name, with a visible match-confidence flag on every result.</p>
    <p class="empty-note">News lookup isn't available in this hosted demo.</p>
  </section>`;
}

const TIMELINE_CATEGORY_LABELS = { incorporation: "Incorporation", accounts: "Accounts", officers: "Officers", pscs: "PSCs", charges: "Charges", filing: "Other filings" };
const timelineLegendHtml = () => `<div class="timeline-legend">${Object.entries(TIMELINE_CATEGORY_LABELS)
  .map(([key, label]) => `<span class="legend-item category-${key}">${escapeHtml(label)}</span>`).join("")}</div>`;
const timelineMarkerHtml = (item) => `<div class="timeline-marker category-${escapeHtml(item.category || "filing")}">
  <span class="timeline-dot"></span>
  <time>${escapeHtml(date(item.date))}</time>
  <p>${escapeHtml(item.event)}</p>
</div>`;
const timelineHtml = (events) => events.length
  ? `${timelineLegendHtml()}<div class="timeline-scroll" id="story-timeline"><div class="timeline-track">${events.map(timelineMarkerHtml).join("")}</div></div>`
  : "<p>No timeline events available.</p>";
// Fixed hue order validated against CVD/contrast checks (dataviz skill) for a
// 3-series categorical set — never reassign or cycle these per company, so a
// metric's colour stays stable whether or not the other two are present.
const TREND_SERIES = [
  { key: "turnover", label: "Turnover", color: "#3ee08a" },
  { key: "grossProfit", label: "Gross profit", color: "#6f9bc4" },
  { key: "operatingProfit", label: "Operating result", color: "#c97b4a" }
];
const compactMoney = (value) => Number.isFinite(value)
  ? new Intl.NumberFormat("en-GB", { notation: "compact", style: "currency", currency: "GBP", maximumFractionDigits: 1 }).format(value)
  : "";
const niceStep = (rawRange) => {
  const roughStep = (rawRange || 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const residual = roughStep / magnitude;
  return (residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1) * magnitude;
};
const financialsTrendChart = (financials) => {
  const points = [...financials].reverse();
  const series = TREND_SERIES.map((s) => ({ ...s, values: points.map((p) => (Number.isFinite(p[s.key]) ? p[s.key] : null)) }));
  const activeSeries = series.filter((s) => s.values.filter((v) => v !== null).length >= 2);
  if (points.length < 2 || !activeSeries.length) return "";
  const allValues = activeSeries.flatMap((s) => s.values.filter((v) => v !== null));
  const step = niceStep(Math.max(...allValues) - Math.min(0, ...allValues));
  const yMax = Math.max(step, Math.ceil(Math.max(0, ...allValues) / step) * step);
  const yMin = Math.min(0, Math.floor(Math.min(0, ...allValues) / step) * step);
  const width = 660, height = 240, padLeft = 68, padRight = 18, padTop = 20, padBottom = 30;
  const plotW = width - padLeft - padRight, plotH = height - padTop - padBottom;
  const xFor = (i) => padLeft + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yFor = (v) => padTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const gridCount = Math.round((yMax - yMin) / step);
  const gridlines = Array.from({ length: gridCount + 1 }, (_, i) => yMin + i * step);
  const gridHtml = gridlines.map((v) => `<line x1="${padLeft}" x2="${width - padRight}" y1="${yFor(v).toFixed(1)}" y2="${yFor(v).toFixed(1)}" stroke="rgba(255,255,255,.1)" stroke-width="1"/><text x="${padLeft - 8}" y="${(yFor(v) + 3.5).toFixed(1)}" font-size="10" fill="#8b95a1" text-anchor="end">${escapeHtml(compactMoney(v))}</text>`).join("");
  const xLabelsHtml = points.map((p, i) => `<text x="${xFor(i).toFixed(1)}" y="${height - 8}" font-size="10" fill="#8b95a1" text-anchor="middle">${escapeHtml(p.periodEnd?.slice(0, 4) ?? "")}</text>`).join("");

  const endLabels = activeSeries.map((s) => {
    const lastIndex = s.values.map((v, i) => (v !== null ? i : -1)).filter((i) => i >= 0).pop();
    return { ...s, lastIndex, value: s.values[lastIndex], y: yFor(s.values[lastIndex]) };
  }).sort((a, b) => a.y - b.y);
  const minGap = 14;
  for (let i = 1; i < endLabels.length; i++) if (endLabels[i].y - endLabels[i - 1].y < minGap) endLabels[i].y = endLabels[i - 1].y + minGap;

  const baselineY = yFor(Math.max(yMin, Math.min(yMax, 0)));
  const seriesHtml = activeSeries.map((s) => {
    const coords = s.values.map((v, i) => (v === null ? null : [xFor(i), yFor(v)]));
    const pathParts = [];
    const runs = [];
    let currentRun = null;
    let open = false;
    coords.forEach((point) => {
      if (!point) { open = false; currentRun = null; return; }
      pathParts.push(`${open ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`);
      if (!currentRun) { currentRun = []; runs.push(currentRun); }
      currentRun.push(point);
      open = true;
    });
    const areaHtml = runs.filter((run) => run.length > 1).map((run) => {
      const top = run.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L");
      return `<path d="M${top} L${run[run.length - 1][0].toFixed(1)} ${baselineY.toFixed(1)} L${run[0][0].toFixed(1)} ${baselineY.toFixed(1)} Z" fill="${s.color}" fill-opacity="0.08" stroke="none"/>`;
    }).join("");
    const dotsHtml = coords.map((point, i) => point
      ? `<circle cx="${point[0].toFixed(1)}" cy="${point[1].toFixed(1)}" r="4" fill="${s.color}" stroke="#0e1115" stroke-width="2"><title>${escapeHtml(s.label)}, ${escapeHtml(points[i].periodEnd?.slice(0, 4) ?? "")}: ${escapeHtml(money(s.values[i]))}</title></circle>`
      : "").join("");
    return `${areaHtml}<path d="${pathParts.join(" ")}" fill="none" stroke="${s.color}" stroke-width="2"/>${dotsHtml}`;
  }).join("");

  const labelsHtml = endLabels.map((s) => {
    const dotY = yFor(s.value);
    const leader = Math.abs(s.y - dotY) > 2
      ? `<line x1="${(xFor(s.lastIndex) + 6).toFixed(1)}" x2="${(width - padRight - 4).toFixed(1)}" y1="${dotY.toFixed(1)}" y2="${s.y.toFixed(1)}" stroke="#3a3f45" stroke-width="1"/>` : "";
    return `${leader}<text x="${(width - padRight).toFixed(1)}" y="${(s.y + 3.5).toFixed(1)}" font-size="11" font-weight="700" fill="#eef2f3" text-anchor="end" stroke="#0e1115" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${escapeHtml(money(s.value))}</text>`;
  }).join("");

  const legendHtml = activeSeries.map((s) => `<span class="trend-legend-item"><i style="background:${s.color}"></i>${escapeHtml(s.label)}</span>`).join("");

  return `<div class="trend-chart"><p class="chart-caption">Multi-year trend, oldest to newest. Only metrics with at least two captured periods are plotted.</p>
    <div class="trend-legend">${legendHtml}</div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Multi-year trend of turnover, gross profit and operating result">
      ${gridHtml}${seriesHtml}${labelsHtml}${xLabelsHtml}
    </svg>
  </div>`;
};
const valuationRangeChart = (valuation, settings) => {
  if (!Number.isFinite(valuation?.evLow) || !Number.isFinite(valuation?.evHigh)) return "";
  const axisMax = Math.max(valuation.evHigh, settings?.preferredEvMax ?? 0, settings?.hardEvCeiling ?? 0, 1) * 1.08;
  const width = 640, height = 96, padLeft = 12, padRight = 12, trackY = 44, trackH = 22;
  const plotW = width - padLeft - padRight;
  const xFor = (v) => padLeft + (Math.max(0, Math.min(v, axisMax)) / axisMax) * plotW;
  const targetBand = Number.isFinite(settings?.preferredEvMin) && Number.isFinite(settings?.preferredEvMax)
    ? `<rect x="${xFor(settings.preferredEvMin).toFixed(1)}" y="${trackY - 6}" width="${(xFor(settings.preferredEvMax) - xFor(settings.preferredEvMin)).toFixed(1)}" height="${trackH + 12}" fill="#3ee08a" opacity="0.12"/>
       <text x="${xFor(settings.preferredEvMin).toFixed(1)}" y="${trackY - 12}" font-size="10" fill="#8b95a1">Target range</text>` : "";
  const ceilingMarker = Number.isFinite(settings?.hardEvCeiling)
    ? `<line x1="${xFor(settings.hardEvCeiling).toFixed(1)}" x2="${xFor(settings.hardEvCeiling).toFixed(1)}" y1="${trackY - 10}" y2="${trackY + trackH + 10}" stroke="#ef5f6b" stroke-width="2"/>
       <text x="${xFor(settings.hardEvCeiling).toFixed(1)}" y="${trackY + trackH + 24}" font-size="10" fill="#ef5f6b" text-anchor="middle">Hard ceiling ${escapeHtml(compactMoney(settings.hardEvCeiling))}</text>` : "";
  const barX = xFor(valuation.evLow), barW = Math.max(2, xFor(valuation.evHigh) - xFor(valuation.evLow));
  return `<div class="valuation-chart">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Indicative enterprise value range">
      <line x1="${padLeft}" x2="${width - padRight}" y1="${(trackY + trackH / 2).toFixed(1)}" y2="${(trackY + trackH / 2).toFixed(1)}" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
      ${targetBand}
      <rect x="${barX.toFixed(1)}" y="${trackY}" width="${barW.toFixed(1)}" height="${trackH}" rx="4" fill="#3ee08a"><title>Indicative range ${escapeHtml(money(valuation.evLow))}–${escapeHtml(money(valuation.evHigh))}</title></rect>
      <text x="${(barX + barW / 2).toFixed(1)}" y="${(trackY - 4).toFixed(1)}" font-size="11" font-weight="700" fill="#eef2f3" text-anchor="middle">${escapeHtml(money(valuation.evLow))}–${escapeHtml(money(valuation.evHigh))}</text>
      ${ceilingMarker}
    </svg>
  </div>`;
};
// Two documents filed on the same date with the same processing status would
// otherwise render as byte-identical lines, reading like a duplicate-
// processing glitch even when they are legitimately two different filings.
// pageCount (when known, from the local PDF path) is a normal, user-meaningful
// detail that can tell two such documents apart without exposing any internal
// identifier as visible text.
const documentSummary = (doc) => {
  const filed = doc.filingDate ? ` filed ${date(doc.filingDate)}` : "";
  const pages = Number.isFinite(doc.pageCount) ? `, ${doc.pageCount} page${doc.pageCount === 1 ? "" : "s"}` : "";
  if (doc.status === "structured_extracted") return `Read directly from the filed accounts data${filed}.`;
  if (doc.status === "processed") {
    const scanned = doc.adapters?.ocr?.status === "available";
    return `Read from the filed accounts${filed}${pages}${scanned ? ", including scanned pages" : ""}.`;
  }
  return `Could not be read${filed}${doc.adapters?.nativeText?.status === "unavailable" ? " — the local reading tool was unavailable" : ""}.`;
};

// The only export wired up in this demo — a real PDF generated by the live
// acquisition-hub app from Keyline's own fully-reconciled report, attached as
// a static file. Every other company (and Keyline before it's reconciled)
// keeps the inert message, since there's no backend here to generate one.
const KEYLINE_EXPORT_PDF = "merchantscope/keyline-acquisition-summary.pdf";
let keylineReconciled = false;

function downloadSummaryPdf() {
  if (currentNumber === "SC042425" && keylineReconciled) {
    const link = document.createElement("a");
    link.href = KEYLINE_EXPORT_PDF;
    link.download = "keyline-civils-specialist-limited-sc042425-acquisition-summary.pdf";
    document.body.append(link);
    link.click();
    link.remove();
    status.className = "status";
    status.textContent = "Acquisition summary downloaded.";
    return;
  }
  status.className = "status";
  status.textContent = "PDF export isn't available in this hosted demo.";
}

credentialSave.addEventListener("click", (event) => {
  event.preventDefault();
  credentialStatus.textContent = "Credentials aren't used in this hosted demo — every result here is baked-in real data.";
});

$("#add-accounts-nav").addEventListener("click", () => openAddAccounts());

credentialRemove.addEventListener("click", (event) => {
  event.preventDefault();
  credentialStatus.textContent = "Credentials aren't used in this hosted demo — every result here is baked-in real data.";
});

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

results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-number]");
  if (button) {
    closeSearchResults();
    navigate(`/company/${encodeURIComponent(button.dataset.number)}?source=${encodeURIComponent(button.dataset.source)}`);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSearchResults();
    searchInput.focus();
  }
});

document.addEventListener("click", (event) => {
  if (!searchCombobox.contains(event.target)) closeSearchResults();
});

const approvedPeriods = new Set(); // "periodEnd|scope" keys, reset per company load

async function loadCompany(companyNumber, source = currentSource) {
  approvedPeriods.clear();
  keylineReconciled = false;
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

// A negative figure already carries its own non-colour cue (the leading
// minus money() formats in), so tinting it red is reinforcement, not the
// only signal — matches the standard accounting convention rather than
// inventing a new one.
const isNegativeMoney = (value) => typeof value === "string" && value.trim().startsWith("-");
function metric(label, value, note = "") {
  const negativeClass = isNegativeMoney(value) ? " negative" : "";
  return `<div class="readout-cell"><span class="l">${escapeHtml(label)}</span><span class="n${negativeClass}">${escapeHtml(value)}</span>${note ? `<span class="note">${escapeHtml(note)}</span>` : ""}</div>`;
}

function render(data) {
  const c = data.company;
  const v = data.valuation;
  const r = data.recommendation;
  const financials = [...(data.financials ?? [])].sort((left, right) => String(right.periodEnd ?? "").localeCompare(String(left.periodEnd ?? "")));
  const latest = financials[0] ?? {};
  const extraction = c.accountExtraction ?? { documents: [], observations: [], validationResults: [], reviewQueue: [], rejectedEvidence: [], findings: [], extractionDiagnostics: [] };
  const stanceClass = r.stance.toLowerCase();
  const officers = Array.isArray(c.officers) ? c.officers : null;
  const activeOfficers = officers?.filter((officer) => !officer.resignedOn) ?? [];
  const formerOfficers = officers?.filter((officer) => officer.resignedOn) ?? [];
  const pinValuation = Number.isFinite(v.evLow) && Number.isFinite(v.evHigh) ? `${money(v.evLow)}–${money(v.evHigh)}` : "Unavailable";
  const pinCriticalHigh = data.risks.filter((x) => ["critical", "high"].includes(x.severity)).length;
  report.innerHTML = `
    <header class="report-pin">
      <div class="report-pin-id"><strong>${escapeHtml(c.name)}</strong><span class="report-pin-number">${escapeHtml(c.companyNumber)}</span></div>
      <div class="report-pin-stance ${stanceReadoutClass(r.stance)}"><span class="pin-dot" aria-hidden="true"></span>${escapeHtml(r.stance)}</div>
      <div class="report-pin-metric"><span class="l">Indicative range</span><span class="n">${escapeHtml(pinValuation)}</span></div>
      <div class="report-pin-metric"><span class="l">Risk register</span><span class="n">${data.risks.length}<small> · ${pinCriticalHigh} critical/high</small></span></div>
    </header>
    <section id="brief" class="section">
      <div class="company-head">
        <div><h2>${escapeHtml(c.name)}</h2><p class="section-lead company-number">${escapeHtml(c.companyNumber)} · ${escapeHtml(c.status)} · Incorporated ${date(c.dateOfCreation)}</p></div>
        <div class="report-actions">
          <span class="tag">Live public record</span>
          <span class="value stance-tag ${stanceClass}">${escapeHtml(r.stance)}</span>
          <button id="export-summary" class="export-button" type="button">Export report</button>
        </div>
      </div>
      <p class="warning"><strong>This whole report is AI-generated from public data.</strong> Every stance, risk and figure is a starting point for diligence, not a decision — get independent professional review before acting on any of it.</p>
      ${c.liveLimitation ? `<p class="notice">${escapeHtml(c.liveLimitation)}</p>` : ""}
      <div class="readout-strip">
        ${metric("Latest turnover", money(latest.turnover), latest.periodEnd ? `${latest.scope === "group" ? "Consolidated group" : "Company"} · period to ${date(latest.periodEnd)}` : "")}
        ${metric("Operating result", money(latest.operatingProfit), "Filed—not maintainable EBITDA")}
        ${metric("Net assets", money(latest.netAssets), "Reference, not valuation floor")}
        ${metric("Public-record risks", String(data.risks.length), `${data.risks.filter((x) => ["critical","high"].includes(x.severity)).length} critical/high`)}
      </div>
      ${valuationRangeChart(v, data.settings) ? `<div class="brief-valuation"><span class="label">Indicative size range · evidence tier ${escapeHtml(v.tier)}</span>${valuationRangeChart(v, data.settings)}</div>` : ""}
      <h3>Why this stance</h3>
      <ul>${r.reasons.length ? r.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("") : "<li>No material rule fired.</li>"}</ul>
    </section>

    <section id="story" class="section">
      <h2>How the company got here</h2>
      <p class="section-lead">Every officer, PSC, charge and filing event visible in the public record, oldest to newest — scroll left for full history.</p>
      ${c.filingConsistency?.notable ? `<p class="warning">A ${Math.round(c.filingConsistency.longestGapDays / 30)}-month gap was found between accounts filings (${date(c.filingConsistency.gapStart)}–${date(c.filingConsistency.gapEnd)}) — worth asking about.</p>` : ""}
      ${timelineHtml([...(c.timeline ?? [])].sort((a, b) => a.date.localeCompare(b.date)))}
    </section>

    <section id="governance" class="section">
      <h2>Who controls the business?</h2>
      <div class="split">
        <div class="list-card"><h3>Active officers</h3><ul>${officers ? (activeOfficers.map((x) => `<li>${escapeHtml(x.name)}<small>${escapeHtml(x.role || "")}${x.appointedOn ? ` · appointed ${date(x.appointedOn)}` : ""}</small></li>`).join("") || "<li>No active officers returned.</li>") : "<li>Unavailable — source request failed; do not assume none.</li>"}</ul>${officers && formerOfficers.length ? `<details class="former-officers"><summary>${formerOfficers.length} former officer${formerOfficers.length === 1 ? "" : "s"}</summary><ul>${formerOfficers.map((x) => `<li>${escapeHtml(x.name)}<small>${escapeHtml(x.role || "")} · resigned ${date(x.resignedOn)}</small></li>`).join("")}</ul></details>` : ""}</div>
        <div class="list-card"><h3>Persons with significant control</h3><ul>${Array.isArray(c.pscs) ? (c.pscs.map((x) => `<li>${escapeHtml(x.name)}<small>${escapeHtml(x.control || "Control detail unavailable")}</small></li>`).join("") || "<li>No PSC records returned.</li>") : "<li>Unavailable — source request failed; do not assume none.</li>"}</ul></div>
      </div>
    </section>

    <section id="financials" class="section">
      <h2>What do the filed accounts show?</h2>
      <p class="section-lead">Showing ${financials.length} selected normalized period${financials.length === 1 ? "" : "s"}, newest first. Missing fields remain unavailable; they are never converted to zero or inferred from unrelated balances.</p>
      <div class="table-wrap"><table><thead><tr><th>Scope</th><th>Period end</th><th>Turnover</th><th>Gross profit</th><th>Operating result</th><th>EBITDA</th><th>Operating margin</th><th>Continuing result after tax</th><th>Discontinued result after tax</th><th>Statutory profit/loss for year</th><th>Evidence confidence</th></tr></thead>
      <tbody>${financials.map((x) => `<tr><td>${x.scope === "group" ? "Consolidated group" : "Company"}</td><td>${date(x.periodEnd)}</td><td>${money(x.turnover)}</td><td>${money(x.grossProfit)}</td><td>${money(x.operatingProfit)}</td><td>${money(ebitdaValue(x))}</td><td>${Number.isFinite(x.operatingMargin) ? `${number(x.operatingMargin * 100)}%` : "Unavailable"}</td><td>${money(x.profitAfterTaxContinuing)}</td><td>${x.profitAfterTaxDiscontinuedReportedNil ? "Reported nil (–)" : money(x.profitAfterTaxDiscontinued)}</td><td>${money(x.profitAfterTax)}</td><td>${confidenceBadgeHtml(x.validation?.confidence)}</td></tr>`).join("") || '<tr><td colspan="11">No structured profit and loss evidence available.</td></tr>'}</tbody></table></div>
      ${financialsTrendChart(financials)}
      <p class="notice">Statutory profit/loss for the year is the total result, including discontinued operations. Continuing and discontinued results remain separate; a filed dash is shown as reported nil and an empty cell is never converted to zero. EBITDA is only shown when depreciation and amortisation were genuinely captured from the filed notes — it is never estimated from operating profit alone.</p>
      <p class="notice">Evidence confidence reflects how much automated reconciliation and coverage checking a period passed — it is not a claim that the figures are correct. Always check the underlying evidence, especially where confidence is low.</p>
      ${!financials.length || financials.some((x) => !Number.isFinite(x.turnover)) ? `<p class="notice">${escapeHtml(pnlUnavailableReason(c))}</p>` : ""}
      ${financials.length ? `<p class="notice">Automated, deterministic checks validate statement structure and reconcile extracted facts. Only successfully reconciled periods may drive screening; valuation safeguards still apply.</p>` : ""}
    </section>

    <section id="resilience" class="section">
      <h2>Can the balance sheet carry the deal?</h2>
      <div class="readout-strip">
        ${metric("Current assets", money(latest.currentAssets))}
        ${metric("Current liabilities", money(latest.currentLiabilities))}
        ${metric("Current ratio", Number.isFinite(latest.currentRatio) ? `${number(latest.currentRatio, 2)}×` : "Unavailable")}
        ${metric("Outstanding charges", Array.isArray(c.charges) ? String(c.charges.filter((x) => x.status === "outstanding").length) : "Unavailable", Array.isArray(c.charges) ? "Public register count" : "Source request failed; unknown is not zero")}
        ${metric("Insolvency cases", Number.isInteger(c.insolvencyCases) ? String(c.insolvencyCases) : "Unavailable", Number.isInteger(c.insolvencyCases) ? "Public endpoint count" : "Source request failed; unknown is not zero")}
      </div>
      <p class="notice">Public accounts are historical and may be filleted. Liquidity, debt and working capital must be reconciled to current management information before an offer.</p>
    </section>

    <section id="account-reconciliation" class="section">
      <div class="company-head">
        <div><h2>Did the extracted accounts reconcile?</h2></div>
        <div class="report-actions">${financials.length || extraction.observations.length ? '<button type="button" id="open-review" class="export-button">Review and confirm figures</button>' : ""}</div>
      </div>
      <p class="warning"><strong>Automated extraction results may be wrong.</strong> Check the linked filing evidence before relying on any figure.</p>
      <p class="section-lead">An LLM may extract candidate facts only. Automated, deterministic checks then validate statement structure and reconciliation before any fact can drive the stance, risks or diligence actions.</p>
      <div class="table-wrap"><table><thead><tr><th>Scope</th><th>Period end</th><th>Profit and loss</th><th>Balance sheet</th><th>Reconciled</th><th>Valuation eligible</th><th>Confidence</th></tr></thead>
      <tbody>${financials.map((x) => `<tr><td>${x.scope === "group" ? "Consolidated group" : "Company"}</td><td>${date(x.periodEnd)}</td><td>${escapeHtml(reconciliationLabel(x.validation?.pnl))}</td><td>${escapeHtml(reconciliationLabel(x.validation?.balanceSheet))}</td><td>${x.validation?.reconciled ? "Yes" : "No"}</td><td>${x.validation?.valuationEligible ? "Yes" : "No"}</td><td>${confidenceCellHtml(x.validation?.confidence)}</td></tr>`).join("") || '<tr><td colspan="7">No periods were captured from the available filing.</td></tr>'}</tbody></table></div>
      <div class="readout-strip">
        ${metric("Documents inspected", String(extraction.documents.length))}
        ${metric("Candidate observations", String(extraction.observations.length))}
        ${metric("Unresolved candidates", String(extraction.reviewQueue.length))}
        ${metric("Rejected evidence", String(extraction.rejectedEvidence?.length ?? 0))}
        ${metric("Labels seen, not captured", String(extraction.extractionDiagnostics?.length ?? 0))}
      </div>
      ${extraction.documents.length ? `<ul class="document-summary">${extraction.documents.map((doc) => `<li>${escapeHtml(documentSummary(doc))}</li>`).join("")}</ul>` : ""}
      ${(() => {
        const visibleCount = 8;
        const rows = extraction.observations.map((item, index) => `<tr${index >= visibleCount ? ' class="reconciliation-extra-row hidden"' : ""}><td>${escapeHtml(item.reportedLabel || item.canonicalField)}</td><td>${observationPeriod(item)}</td><td>${money(item.value)}</td><td>${escapeHtml(reconciliationLabel(item.status?.validation) || "Pending")}</td><td class="evidence-cell">${item.location?.evidenceUrl ? `<button type="button" class="text-button zoom-image" data-image-url="${escapeHtml(item.location.evidenceUrl)}">Page ${item.location.page}</button>` : "Unavailable"}</td><td class="diagnostics-cell">${renderDiagnostics(item.status?.failures ?? [])}</td></tr>`);
        const remaining = rows.length - visibleCount;
        return `<div class="table-wrap"><table class="reconciliation-table"><thead><tr><th>Candidate</th><th>Period</th><th>Value</th><th>Reconciliation</th><th>Evidence</th><th>Diagnostics</th></tr></thead><tbody>
          ${rows.join("") || '<tr><td colspan="6">No schema-valid candidates were produced.</td></tr>'}
        </tbody></table></div>
        ${remaining > 0 ? `<button type="button" id="reconciliation-expand" class="text-button">Show ${remaining} more candidate${remaining === 1 ? "" : "s"}</button>` : ""}`;
      })()}
      ${(() => {
        const diagnostics = extraction.extractionDiagnostics ?? [];
        if (!diagnostics.length) return "";
        const visibleCount = 8;
        const rows = diagnostics.map((item, index) => `<tr${index >= visibleCount ? ' class="diagnostics-extra-row hidden"' : ""}><td>${escapeHtml(humanizeCanonicalField(item.canonicalField))}</td><td>${escapeHtml(item.statement === "balance_sheet" ? "Balance sheet" : "Profit and loss")}</td><td>${escapeHtml(item.type === "label_line_present" ? "Label line seen, no candidate" : "Field name mentioned, no candidate")}</td><td class="evidence-cell">${item.evidenceUrl ? `<button type="button" class="text-button zoom-image" data-image-url="${escapeHtml(item.evidenceUrl)}">Page ${escapeHtml(String(item.page))}</button>` : `Page ${escapeHtml(String(item.page))}`}</td></tr>`);
        const remaining = rows.length - visibleCount;
        return `<h3>Labels seen but not captured</h3>
        <p class="section-lead">A coverage signal, not a company fact: the field's label or name was visible on a routed statement page, but no candidate observation resulted. Worth checking whether a value was missed rather than genuinely absent.</p>
        <div class="table-wrap"><table class="reconciliation-table"><thead><tr><th>Field</th><th>Statement</th><th>Signal</th><th>Evidence</th></tr></thead><tbody>
          ${rows.join("")}
        </tbody></table></div>
        ${remaining > 0 ? `<button type="button" id="diagnostics-expand" class="text-button">Show ${remaining} more</button>` : ""}`;
      })()}
    </section>

    <section id="risks" class="section">
      <h2>What could change the deal?</h2>
      <p class="section-lead">Each flag shows the public evidence, likely buyer impact and the next diligence response.</p>
      ${(() => {
        const visibleCount = 3;
        const sortedRisks = [...data.risks].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4));
        const cards = sortedRisks.map((risk, index) => `<article class="risk risk-register-item severity-${escapeHtml(risk.severity)}${index >= visibleCount ? ' risk-extra hidden' : ""}"><span class="risk-severity">${severityMeterHtml(risk.severity)}<b>${escapeHtml(risk.severity)}</b></span><div><h3>${escapeHtml(risk.title)}</h3><p><strong>Evidence:</strong> ${escapeHtml(risk.evidence)}</p><p><strong>Buyer impact:</strong> ${escapeHtml(risk.impact)}</p><p><strong>Next action:</strong> ${escapeHtml(risk.action)}</p></div></article>`);
        const remaining = cards.length - visibleCount;
        return `${cards.join("") || "<p>No rule-based public-record risks fired. This is not proof that no acquisition risks exist.</p>"}
        ${remaining > 0 ? `<button type="button" id="risks-expand" class="text-button">Show ${remaining} more risk${remaining === 1 ? "" : "s"}</button>` : ""}`;
      })()}
    </section>

    <section id="valuation" class="section">
      <h2>Is this target in range?</h2>
      <p class="section-lead">An indicative screening range—not a formal offer price. The method degrades when filed evidence is incomplete.</p>
      <div class="valuation-grid">
        <span class="tag">Evidence tier ${escapeHtml(v.tier)}</span>
        <h3>${escapeHtml(v.method)}</h3>
        <div class="range">${Number.isFinite(v.evLow) ? `${money(v.evLow)}–${money(v.evHigh)}` : "Valuation unavailable"}</div>
        <p>${escapeHtml(v.formula || v.explanation || "")}</p>
        ${Number.isFinite(v.revenueCrossCheckLow) ? `<p><strong>Separate revenue cross-check:</strong> ${money(v.revenueCrossCheckLow)}–${money(v.revenueCrossCheckHigh)}</p>` : ""}
        <p>${escapeHtml(v.equityExplanation || "Equity value withheld because current cash, complete debt and transaction adjustments are not sufficiently supported.")}</p>
        ${Number.isFinite(v.netAssetsReference) ? `<p><strong>Net assets reference:</strong> ${money(v.netAssetsReference)}. This is not enterprise value or a valuation floor.</p>` : ""}
        <p class="hint">Screening assumptions (earnings/revenue multiples, preferred EV range, hard ceiling) are shown on the <a href="#/settings">Settings page</a> (not wired up in this hosted demo).</p>
      </div>
    </section>

    <section id="diligence" class="section">
      <h2>What must be answered next?</h2>
      <ol class="ordered">${data.diligence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
    </section>

    <section id="sources" class="section sources">
      <h2>Where did this come from?</h2>
      ${(c.sources ?? []).map((source) => `<p><strong>${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>` : escapeHtml(source.label)}</strong><br><span class="source-meta">Retrieved ${escapeHtml(source.retrievedAt || "unknown")} · external public-record fact</span></p>`).join("")}
      <p class="notice">Companies House data supports initial screening, not a purchase decision. Customer concentration, stock quality, normalized EBITDA, current debt, leases and trading performance require phase-two evidence.</p>
    </section>

    ${newsSectionHtml()}`;

  $("#export-summary").addEventListener("click", () => downloadSummaryPdf());
  $("#diagnostics-expand")?.addEventListener("click", (event) => {
    report.querySelectorAll(".diagnostics-extra-row").forEach((row) => row.classList.remove("hidden"));
    event.currentTarget.remove();
  });
  $("#reconciliation-expand")?.addEventListener("click", (event) => {
    report.querySelectorAll(".reconciliation-extra-row").forEach((row) => row.classList.remove("hidden"));
    event.currentTarget.remove();
  });
  $("#risks-expand")?.addEventListener("click", (event) => {
    report.querySelectorAll(".risk-extra").forEach((row) => row.classList.remove("hidden"));
    event.currentTarget.remove();
  });
  $("#open-review")?.addEventListener("click", () => void openReview());
  report.querySelectorAll(".zoom-image").forEach((button) => button.addEventListener("click", (event) => openImageLightbox(event.currentTarget.dataset.imageUrl)));
  const storyTimeline = $("#story-timeline");
  if (storyTimeline) requestAnimationFrame(() => { storyTimeline.scrollLeft = storyTimeline.scrollWidth; });
  initialiseSectionTracking();
}

let reviewOverlay = null;
function ensureReviewOverlay() {
  if (reviewOverlay) return reviewOverlay;
  reviewOverlay = document.createElement("div");
  reviewOverlay.className = "review-overlay hidden";
  reviewOverlay.innerHTML = `<div class="review-panel" role="dialog" aria-modal="true" aria-label="Review extracted figures">
    <div class="review-header"><h2>Review extracted figures</h2><button type="button" id="review-close" class="text-button">Close</button></div>
    <div id="review-body" class="review-body"></div>
  </div>`;
  document.body.append(reviewOverlay);
  reviewOverlay.querySelector("#review-close").addEventListener("click", closeReviewOverlay);
  reviewOverlay.addEventListener("click", (event) => { if (event.target === reviewOverlay) closeReviewOverlay(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !reviewOverlay.classList.contains("hidden")) closeReviewOverlay(); });
  return reviewOverlay;
}
function closeReviewOverlay() {
  reviewOverlay?.classList.add("hidden");
}

// Phase-two "deep dive" account sources scoped in docs/phase-two-accountant-scope.md
// section 1 — every connector here is a mock, exactly as in the real product.
// No real credential flow exists; connecting is simulated so the shape of the
// feature can be reviewed before any real integration work starts.
const MOCK_ACCOUNT_SOURCES = [
  { key: "sage50", name: "Sage 50 Accounts", detail: "Nominal ledger, audit trail, aged debtors and creditors." },
  { key: "sage200", name: "Sage 200", detail: "Cost-centre ledger, nominal transactions and stock valuation." },
  { key: "xero", name: "Xero", detail: "General ledger detail, tracking categories, aged receivables." },
  { key: "quickbooks", name: "QuickBooks Online", detail: "General ledger, classes and locations. Stretch target." },
  { key: "erp", name: "Trade ERP — BisTrack / Kerridge K8 / Intact iQ", detail: "Sales-line detail, branch trading, SKU-level margin." }
];
let addAccountsOverlay = null;
let deepDiveLoaded = false;
function resetDeepDiveTab() {
  deepDiveLoaded = false;
  $("#deep-dive-nav").innerHTML = "";
  deepDiveReport.innerHTML = deepDiveReportDefaultHtml;
  setReportTab("initial");
}
function ensureAddAccountsOverlay() {
  if (addAccountsOverlay) return addAccountsOverlay;
  addAccountsOverlay = document.createElement("div");
  addAccountsOverlay.className = "review-overlay hidden";
  addAccountsOverlay.innerHTML = `<div class="review-panel" role="dialog" aria-modal="true" aria-label="Add accounts for phase-two deep dive">
    <div class="review-header"><h2>Add accounts</h2><button type="button" id="add-accounts-close" class="text-button">Close</button></div>
    <div class="review-body">
      <p class="section-lead">Phase two reads the target's own books, not just the public record above. Connect the systems scoped for this deep dive — every connector below is a mock; nothing here uploads real data yet.</p>
      <div class="list-card">
        <h3>Connect a source</h3>
        <ul>${MOCK_ACCOUNT_SOURCES.map((source) => `
          <li class="add-account-row">
            <div><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.detail)}</small></div>
            <button type="button" class="text-button mock-connect" data-name="${escapeHtml(source.name)}">Connect</button>
          </li>`).join("")}
        </ul>
      </div>
      <p id="add-accounts-status" class="add-accounts-status hidden"></p>
      <div class="add-accounts-demo">
        <h3>Preview the finished capability</h3>
        <p class="hint">No target has connected accounts yet. Load a worked example — Thornbury Building Supplies Ltd — showing what a completed Deep Dive looks like once these sources are connected.</p>
        <button type="button" id="use-dummy-data" class="primary">Use dummy data — Thornbury demo</button>
      </div>
    </div>
  </div>`;
  document.body.append(addAccountsOverlay);
  addAccountsOverlay.querySelector("#add-accounts-close").addEventListener("click", closeAddAccountsOverlay);
  addAccountsOverlay.addEventListener("click", (event) => { if (event.target === addAccountsOverlay) closeAddAccountsOverlay(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !addAccountsOverlay.classList.contains("hidden")) closeAddAccountsOverlay(); });
  addAccountsOverlay.querySelectorAll(".mock-connect").forEach((button) => button.addEventListener("click", (event) => void mockConnectSource(event.currentTarget)));
  addAccountsOverlay.querySelector("#use-dummy-data").addEventListener("click", (event) => void useDeepDiveDummyData(event.currentTarget));
  return addAccountsOverlay;
}
function openAddAccounts() {
  ensureAddAccountsOverlay().classList.remove("hidden");
}
function closeAddAccountsOverlay() {
  addAccountsOverlay?.classList.add("hidden");
}
async function mockConnectSource(button) {
  const statusEl = $("#add-accounts-status");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Connecting…";
  statusEl.className = "add-accounts-status";
  statusEl.classList.remove("hidden");
  statusEl.textContent = `Connecting to ${button.dataset.name}…`;
  await new Promise((resolve) => setTimeout(resolve, 900));
  button.disabled = false;
  button.textContent = original;
  statusEl.textContent = `${button.dataset.name}: this is a scoping mock — no live connection exists yet. Use the demo below to preview the finished capability.`;
}
// The Deep Dive tab is its own view now (see setReportTab), so its section
// nav restarts at 01 rather than continuing the Initial review tab's 01-11.
const DEEP_DIVE_NAV = [
  ["dd-conclusion", "01 Combined conclusion"],
  ["dd-value", "02 Where the value is"],
  ["dd-sku", "03 Product & SKU margin"],
  ["dd-risk", "04 Where the risk is"],
  ["dd-reconciliation", "05 Reconciliation"],
  ["dd-coverage", "06 Evidence coverage"],
  ["dd-forecast", "07 Forecast"]
];
// Fetches and parses merchantscope/deep-dive-mock.html rather than reproducing
// its markup by hand, so the demo has one source of truth and stays in sync
// with the real product's own scoping mock.
async function injectDeepDiveMock() {
  const response = await fetch("merchantscope/deep-dive-mock.html");
  if (!response.ok) throw new Error("Could not load the Deep Dive demo content.");
  const html = await response.text();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const pin = parsed.querySelector(".report-pin");
  const mockWarning = parsed.querySelector(".status-mock");
  const sections = [...parsed.querySelectorAll("#report > section")];
  if (!pin || sections.length !== DEEP_DIVE_NAV.length) throw new Error("The Deep Dive demo content could not be read.");
  sections.forEach((section, index) => { section.id = DEEP_DIVE_NAV[index][0]; });
  deepDiveReport.innerHTML = "";
  if (mockWarning) deepDiveReport.append(mockWarning);
  deepDiveReport.append(pin, ...sections);
  const nav = $("#deep-dive-nav");
  nav.innerHTML = "";
  nav.append(...DEEP_DIVE_NAV.map(([id, label]) => {
    const link = document.createElement("a");
    link.href = `#${id}`;
    link.textContent = label;
    return link;
  }));
  initialiseSectionTracking();
}
async function useDeepDiveDummyData(button) {
  if (deepDiveLoaded) {
    closeAddAccountsOverlay();
    setReportTab("deepdive");
    $("#dd-conclusion")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const statusEl = $("#add-accounts-status");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Loading demo…";
  try {
    await injectDeepDiveMock();
    deepDiveLoaded = true;
    closeAddAccountsOverlay();
    setReportTab("deepdive");
    $("#dd-conclusion")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    statusEl.className = "add-accounts-status error";
    statusEl.classList.remove("hidden");
    statusEl.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

// Evidence images zoom in place rather than navigating to the image URL —
// a real navigation (even to a new tab, on some browsers/embedded views)
// tears down this single-page app's in-memory state, so "back" comes home
// to an empty screen instead of the report the user was reviewing.
let imageLightbox = null;
function ensureImageLightbox() {
  if (imageLightbox) return imageLightbox;
  imageLightbox = document.createElement("div");
  imageLightbox.className = "image-lightbox hidden";
  imageLightbox.innerHTML = `<button type="button" class="image-lightbox-close text-button">Close</button><img alt="Evidence, full size">`;
  document.body.append(imageLightbox);
  imageLightbox.addEventListener("click", (event) => { if (event.target !== imageLightbox.querySelector("img")) closeImageLightbox(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !imageLightbox.classList.contains("hidden")) closeImageLightbox(); });
  return imageLightbox;
}
function openImageLightbox(url) {
  const lightbox = ensureImageLightbox();
  lightbox.querySelector("img").src = url;
  lightbox.classList.remove("hidden");
}
function closeImageLightbox() {
  imageLightbox?.classList.add("hidden");
}

// Several figures on the same statement page (or the same structured filing)
// share one piece of evidence. Group by that shared source so the image is
// shown once, large enough to actually read, with its figures listed beside
// it — instead of repeating a tiny thumbnail once per field.
function shownFieldEvidence(field) {
  if (field.provenance?.evidenceUrl || field.provenance?.demoUnavailable) return field.provenance;
  const isUnresolved = field.value === null;
  const bestAlternate = isUnresolved ? (field.alternates ?? []).find((alt) => alt.evidenceUrl) : null;
  return bestAlternate ? { evidenceUrl: bestAlternate.evidenceUrl, page: bestAlternate.page, value: bestAlternate.value, unresolved: true } : field.provenance ?? null;
}
function fieldInputValue(field) {
  if (Number.isFinite(field.value)) return { value: field.value, suggested: false };
  const suggested = shownFieldEvidence(field)?.value;
  return Number.isFinite(suggested) ? { value: suggested, suggested: true } : { value: "", suggested: false };
}

function groupFieldsByEvidence(fields) {
  const groups = new Map();
  const order = [];
  for (const field of fields) {
    const evidence = shownFieldEvidence(field);
    const key = evidence?.evidenceUrl ? `pdf:${evidence.evidenceUrl}`
      : evidence?.demoUnavailable ? `demo:${field.provenance?.documentId ?? field.field}`
      : field.provenance?.documentId ? `xbrl:${field.provenance.documentId}`
      : field.provenance?.source === "Human review" ? "human"
      : "none";
    if (!groups.has(key)) { groups.set(key, { key, provenance: evidence, fields: [] }); order.push(key); }
    groups.get(key).fields.push(field);
  }
  return order.map((key) => groups.get(key));
}

function fieldAlternatesHtml(field, forceOpen = false) {
  const shownUrl = shownFieldEvidence(field)?.evidenceUrl;
  const others = (field.alternates ?? []).filter((alt) => alt.evidenceUrl && alt.evidenceUrl !== shownUrl);
  if (!others.length) return "";
  return `<details class="evidence-alternates"${forceOpen ? " open" : ""}><summary>${others.length} other candidate${others.length === 1 ? "" : "s"} found</summary>
    ${others.map((alt) => `<div class="evidence-candidate"><button type="button" class="zoom-image" data-image-url="${escapeHtml(alt.evidenceUrl)}"><img src="${escapeHtml(alt.evidenceUrl)}" alt="Alternate evidence" loading="lazy"></button><p class="evidence-caption">Page ${escapeHtml(String(alt.page ?? "?"))} · ${escapeHtml(money(alt.value))} · ${escapeHtml(String(alt.status ?? ""))} <button type="button" class="text-button use-alternate" data-value="${alt.value}">Use this value</button></p></div>`).join("")}
  </details>`;
}

// Two real static evidence images exist for this demo (2025-12-31 and
// 2024-12-31 P&L pages); the other periods show an honest note instead of a
// broken image link — see the design spec's "no live network calls" constraint.
function evidenceGroupVisualHtml(group, filingHistoryUrl) {
  const evidence = group.provenance;
  if (evidence?.demoUnavailable) {
    return `<p class="evidence-caption">Evidence imagery isn't available for every period in this hosted demo — the figures and page reference shown are exactly what the reconciliation engine captured.${Number.isFinite(evidence.page) ? ` (Page ${escapeHtml(String(evidence.page))}.)` : ""}</p>`;
  }
  if (group.key.startsWith("pdf:")) {
    return `<button type="button" class="review-evidence-link zoom-image" data-image-url="${escapeHtml(evidence.evidenceUrl)}">
        <img src="${escapeHtml(evidence.evidenceUrl)}" alt="Filed evidence page ${escapeHtml(String(evidence.page ?? "?"))}" loading="lazy">
      </button><p class="evidence-caption">Page ${escapeHtml(String(evidence.page ?? "?"))}${evidence.unresolved ? " · unreconciled candidate, not yet a confirmed value — check it against the figure before approving" : ""} · click the image to zoom in</p>`;
  }
  if (group.key.startsWith("xbrl:")) {
    return `<p class="evidence-caption">Structured filing data — no page image is available for this format.${evidence.filedOn ? ` Filed ${escapeHtml(evidence.filedOn)}.` : ""}${filingHistoryUrl ? ` <a href="${escapeHtml(filingHistoryUrl)}" target="_blank" rel="noreferrer">View filing history</a>` : ""}</p>`;
  }
  if (group.key === "human") return `<p class="evidence-caption">Set by human review${evidence?.reviewedAt ? ` on ${escapeHtml(safeDateLabel(evidence.reviewedAt))}` : ""}.</p>`;
  return '<p class="evidence-caption">No source evidence is available for these figures.</p>';
}

function evidenceGroupFieldsHtml(group, forceOpenAlternates = false) {
  return `<table class="review-evidence-fields"><thead><tr><th>Figure</th><th>Value</th></tr></thead><tbody>
    ${group.fields.map((field) => {
      const input = fieldInputValue(field);
      return `<tr><td>${escapeHtml(field.label)}${field.edited ? " <small>(edited)</small>" : ""}${input.suggested ? ' <small class="suggested-tag">(suggested from evidence, unconfirmed)</small>' : ""}${field.provenance?.concept ? `<br><code>${escapeHtml(field.provenance.concept)}</code>` : ""}</td>
      <td><input type="number" step="any" class="${input.suggested ? "suggested-value" : ""}" data-field="${escapeHtml(field.field)}" value="${input.value}">${fieldAlternatesHtml(field, forceOpenAlternates)}</td></tr>`;
    }).join("")}
  </tbody></table>`;
}

// "Approve & confirm" is the only action wired up in this demo — the real
// product's per-field editing is out of scope here (see the design spec's
// "Out of scope" section): approving always accepts the real captured
// values exactly as extracted, it never reads what's typed into the inputs.
function periodReviewHtml(period, filingHistoryUrl) {
  const groups = groupFieldsByEvidence(period.fields);
  const lowConfidence = period.confidence?.band === "low";
  return `<article class="review-period" data-period-end="${escapeHtml(period.periodEnd)}" data-scope="${escapeHtml(period.scope)}">
    <div class="review-period-head">
      <h3>${period.scope === "group" ? "Consolidated group" : "Company"} · ${escapeHtml(safeDateLabel(period.periodEnd))}</h3>
      <div class="review-period-badges">
        ${confidenceBadgeHtml(period.confidence)}
        <span class="tag ${period.reviewed ? "low" : ""}">${period.reviewed ? "Human reviewed" : "Not yet reviewed"}</span>
      </div>
    </div>
    ${lowConfidence ? '<p class="warning">Low evidence confidence for this period — the observation table and any alternate candidates below are shown in full; check them against the source before approving.</p>' : ""}
    ${groups.length ? groups.map((group) => `
      <div class="review-evidence-group">
        <div class="review-evidence-visual">${evidenceGroupVisualHtml(group, filingHistoryUrl)}</div>
        <div class="review-evidence-fields-wrap">${evidenceGroupFieldsHtml(group, lowConfidence)}</div>
      </div>`).join("") : '<p class="evidence-caption">No captured fields for this period.</p>'}
    <div class="review-actions">
      <button type="button" class="primary approve-review">Approve &amp; confirm</button>
    </div>
  </article>`;
}

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
    keylineReconciled = true;
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

void renderRoute();
