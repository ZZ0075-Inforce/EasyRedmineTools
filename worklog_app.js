const STORAGE_KEY = "lawpj.worklog.v1";
const APP_VERSION = "1.2.0";
const APP_BUILD_TIME = "2026-04-24";

const state = {
  localToday: localDateString(new Date()),
  currentSource: { type: "mine" },
  savedQueries: [],
  filterDate: "",
  filterSearch: "",
  issues: [],
  draftEntries: [],
  previewToken: "",
  activities: [],
  manualActivityEntry: true,
  activityWarnings: [],
  issueWarnings: [],
  previewWarnings: [],
  commitResults: [],
  phrases: [],
  phrasesWarnings: [],
  sourcesWarnings: [],
  batchSpentOn: "",
  settingsOpen: false,
  settingsTab: "appearance",
  editingPhraseId: null,
  isLoading: false,
  loadingMessage: "",
  expandedProjects: new Set(),
  scheduleStage: "select",
  scheduleSelectedProjectIds: new Set(),
  scheduleProjectOrder: [],
  scheduleIssueOrder: {},
  scheduleBudgets: {},
  budgetEditIssueId: null,
  dailyHourLimit: 6.5,
  filterExpanded: false,
  theme: "light",
  scheduleCommitResults: [],
  mobileActiveTab: "issues",
};

let dragContext = null;
const THEME_KEY = "lawpj.theme";

let lastFocusedEntryId = null;

const elements = {
  issueCount: document.getElementById("issue-count"),
  selectedCount: document.getElementById("selected-count"),
  sourceTabs: document.getElementById("source-tabs"),
  filterDate: document.getElementById("filter-date"),
  filterClearDate: document.getElementById("filter-clear-date"),
  filterSearch: document.getElementById("filter-search"),
  filterToggleButton: document.getElementById("filter-toggle-button"),
  filterAdvanced: document.getElementById("filter-advanced"),
  filterDot: document.getElementById("filter-dot"),
  dailyTotalBadge: document.getElementById("daily-total-badge"),
  stickyActions: document.getElementById("sticky-actions"),
  stickySummary: document.getElementById("sticky-summary"),
  stickyActionsSchedule: document.getElementById("sticky-actions-schedule"),
  scheduleApplyButton: document.getElementById("schedule-apply-button"),
  issueSummary: document.getElementById("issue-summary"),
  workbenchSummary: document.getElementById("workbench-summary"),
  issueList: document.getElementById("issue-list"),
  alertStack: document.getElementById("alert-stack"),
  tableWrap: document.getElementById("table-wrap"),
  refreshButton: document.getElementById("refresh-button"),
  selectAllButton: document.getElementById("select-all-button"),
  clearSelectionButton: document.getElementById("clear-selection-button"),
  commitButton: document.getElementById("commit-button"),
  settingsButton: document.getElementById("settings-button"),
  settingsModal: document.getElementById("settings-modal"),
  settingsModalClose: document.getElementById("settings-modal-close"),
  batchSpentOn: document.getElementById("batch-spent-on"),
  batchDateHelper: document.getElementById("batch-date-helper"),
  phrasesList: document.getElementById("phrases-list"),
  phraseLabelInput: document.getElementById("phrase-label-input"),
  phraseHoursInput: document.getElementById("phrase-hours-input"),
  phraseActivityWrap: document.getElementById("phrase-activity-wrap"),
  phraseCommentsInput: document.getElementById("phrase-comments-input"),
  phraseAddButton: document.getElementById("phrase-add-button"),
  phraseCancelButton: document.getElementById("phrase-cancel-button"),
  queryNameInput: document.getElementById("query-name-input"),
  queryIdInput: document.getElementById("query-id-input"),
  queryAddButton: document.getElementById("query-add-button"),
  savedQueriesList: document.getElementById("saved-queries-list"),
  loadingMask: document.getElementById("loading-mask"),
  loadingMessage: document.getElementById("loading-message"),
  commitModal: document.getElementById("commit-modal"),
  commitModalDate: document.getElementById("commit-modal-date"),
  commitModalDateWarn: document.getElementById("commit-modal-date-warn"),
  commitModalSummary: document.getElementById("commit-modal-summary"),
  commitModalConfirm: document.getElementById("commit-modal-confirm"),
  commitModalCancel: document.getElementById("commit-modal-cancel"),
  commitModalClose: document.getElementById("commit-modal-close"),
};

function localDateString(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgoString(offset) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return localDateString(d);
}

function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const entries = Array.isArray(parsed.draftEntries) ? parsed.draftEntries : [];
    const cleanEntries = entries
      .filter((entry) => entry && Number.isFinite(Number(entry.issue_id)))
      .map((entry) => ({
        issue_id: Number(entry.issue_id),
        issue_subject: entry.issue_subject || `Issue #${entry.issue_id}`,
        issue_url: entry.issue_url || "",
        hours: entry.hours || "",
        activity_id: entry.activity_id || "",
        comments: entry.comments || "",
        selected: true,
        errors: {},
        duplicate: false,
        duplicate_entries: [],
      }));
    return {
      draftEntries: cleanEntries,
      batchSpentOn: typeof parsed.batchSpentOn === "string" ? parsed.batchSpentOn : "",
      currentSource:
        parsed.currentSource && typeof parsed.currentSource === "object"
          ? parsed.currentSource
          : { type: "mine" },
    };
  } catch {
    return null;
  }
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function applyTheme(theme) {
  state.theme = theme;
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

function persistState() {
  try {
    const payload = {
      draftEntries: state.draftEntries.map((entry) => ({
        issue_id: entry.issue_id,
        issue_subject: entry.issue_subject,
        issue_url: entry.issue_url,
        hours: entry.hours,
        activity_id: entry.activity_id,
        comments: entry.comments,
        selected: true,
      })),
      batchSpentOn: state.batchSpentOn,
      currentSource: state.currentSource,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage may be disabled — ignore */
  }
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const subjectOf = (issue) => issue.subject || `Issue #${issue.issue_id}`;

function issueById(issueId) {
  return state.issues.find((issue) => issue.issue_id === issueId);
}

function isIssueInDrafts(issueId) {
  return state.draftEntries.some((entry) => entry.issue_id === issueId);
}

function selectedCount() {
  return state.draftEntries.length;
}

function sourceKey(source) {
  if (source.type === "mine") return "mine";
  if (source.type === "mine-grouped") return "mine-grouped";
  if (source.type === "schedule") return "schedule";
  if (source.type === "query") return `query:${source.id}`;
  return "unknown";
}

function sourceLabel(source) {
  if (source.type === "mine") return "我的 issue";
  if (source.type === "mine-grouped") return "我的 project";
  if (source.type === "schedule") return "分配工時";
  if (source.type === "query") return `PJ：${source.name || `#${source.id}`}`;
  return "未知來源";
}

function sourceUsesMineApi(source) {
  return source.type === "mine" || source.type === "mine-grouped" || source.type === "schedule";
}

function clearEntryPreviewState(entry) {
  entry.errors = {};
  entry.duplicate = false;
  entry.duplicate_entries = [];
}

function invalidatePreview(clearResults = false) {
  state.previewToken = "";
  state.previewWarnings = [];
  if (clearResults) {
    state.commitResults = [];
  }
}

function clearAllEntryPreviewState() {
  for (const entry of state.draftEntries) {
    clearEntryPreviewState(entry);
  }
  invalidatePreview(true);
}

function sortDraftEntries() {
  state.draftEntries.sort((left, right) => left.issue_id - right.issue_id);
}

function buildDraftEntry(issueId, existing = null) {
  const issue = issueById(issueId);
  return {
    issue_id: issueId,
    issue_subject: issue ? subjectOf(issue) : `Issue #${issueId}`,
    issue_url: issue?.issue_url || "",
    hours: existing?.hours || "",
    activity_id: existing?.activity_id || "",
    comments: existing?.comments || "",
    selected: true,
    errors: {},
    duplicate: false,
    duplicate_entries: [],
  };
}

function upsertDraftEntry(issueId) {
  const existingIndex = state.draftEntries.findIndex((entry) => entry.issue_id === issueId);
  const existing = existingIndex >= 0 ? state.draftEntries[existingIndex] : null;
  const nextEntry = buildDraftEntry(issueId, existing);
  if (existingIndex >= 0) {
    state.draftEntries[existingIndex] = nextEntry;
  } else {
    state.draftEntries.push(nextEntry);
  }
  sortDraftEntries();
  invalidatePreview(true);
}

function removeDraftEntry(issueId) {
  state.draftEntries = state.draftEntries.filter((entry) => entry.issue_id !== issueId);
  if (lastFocusedEntryId === issueId) lastFocusedEntryId = null;
  invalidatePreview(true);
}

function clearAllDrafts() {
  state.draftEntries = [];
  lastFocusedEntryId = null;
  invalidatePreview(true);
}

function renderLoadingMask() {
  elements.loadingMask.classList.toggle("open", state.isLoading);
  elements.loadingMask.setAttribute("aria-hidden", state.isLoading ? "false" : "true");
  elements.loadingMessage.textContent = state.loadingMessage || "載入中...";
}

async function withLoading(message, action) {
  state.isLoading = true;
  state.loadingMessage = message;
  renderLoadingMask();
  updateButtons();
  try {
    return await action();
  } finally {
    state.isLoading = false;
    state.loadingMessage = "";
    renderLoadingMask();
    updateButtons();
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `${response.status} ${response.statusText}`);
  }
  return data;
}

async function fetchActivities() {
  const data = await fetchJson("/api/time-entry-activities");
  state.activities = data.activities || [];
  state.manualActivityEntry = Boolean(data.manual_entry);
  state.activityWarnings = data.warnings || [];
}

async function fetchSavedQueries() {
  const data = await fetchJson("/api/saved-queries");
  state.savedQueries = data.queries || [];
}

async function fetchPhrases() {
  const data = await fetchJson("/api/phrases");
  state.phrases = data.phrases || [];
}

function buildIssuesUrl() {
  const params = new URLSearchParams();
  if (sourceUsesMineApi(state.currentSource)) {
    params.set("source", "mine");
    if (state.filterDate) params.set("date", state.filterDate);
  } else if (state.currentSource.type === "query") {
    params.set("source", "query");
    params.set("query_id", String(state.currentSource.id));
    if (state.filterDate) params.set("date", state.filterDate);
  }
  return `/api/issues?${params.toString()}`;
}

async function fetchIssues() {
  const data = await fetchJson(buildIssuesUrl());
  state.issues = data.issues || [];
  state.issueWarnings = data.warnings || [];
  if (!state.batchSpentOn) {
    state.batchSpentOn = daysAgoString(1);
  }
}

function filteredIssues() {
  const query = state.filterSearch.trim().toLowerCase();
  if (!query) return state.issues;
  return state.issues.filter((issue) => {
    const title = (issue.subject || "").toLowerCase();
    const idStr = String(issue.issue_id);
    return title.includes(query) || idStr.includes(query);
  });
}

function renderSourceTabs() {
  const tabs = [
    { type: "mine", label: "我的 issue" },
    { type: "mine-grouped", label: "我的 project" },
  ];
  for (const query of state.savedQueries) {
    tabs.push({
      type: "query",
      id: query.query_id,
      label: query.name || `#${query.query_id}`,
    });
  }
  const activeKey = sourceKey(state.currentSource);
  const inner = tabs
    .map((tab) => {
      const payload = { type: tab.type, id: tab.id, name: tab.label };
      const isActive = sourceKey(payload) === activeKey;
      const data = `data-source='${JSON.stringify(payload).replaceAll("'", "&#39;")}'`;
      return `<button class="source-tab ${isActive ? "active" : ""}" ${data}>${escapeHtml(tab.label)}</button>`;
    })
    .join("");
  elements.sourceTabs.innerHTML = inner;

  for (const button of elements.sourceTabs.querySelectorAll(".source-tab")) {
    button.addEventListener("click", async (event) => {
      try {
        const source = JSON.parse(event.currentTarget.dataset.source);
        await switchSource(source);
      } catch (error) {
        state.issueWarnings = [error.message || String(error)];
        renderAll();
      }
    });
  }
}

async function switchSource(source) {
  state.currentSource = source;
  state.filterSearch = "";
  await withLoading("載入 issue 中...", fetchIssues);
  renderAll();
}

function renderTopTabs() {
  const isSchedule = state.currentSource.type === "schedule";
  for (const btn of document.querySelectorAll("#top-tabs [data-top-tab]")) {
    const active =
      (btn.dataset.topTab === "schedule" && isSchedule) ||
      (btn.dataset.topTab === "worklog" && !isSchedule);
    btn.classList.toggle("active", active);
  }
  const mainToolbar = document.getElementById("main-toolbar");
  if (mainToolbar) mainToolbar.style.display = isSchedule ? "none" : "";
}

function issueCardHtml(issue, { omitProjectTag = false } = {}) {
  const isSelected = isIssueInDrafts(issue.issue_id);
  return `
    <li>
      <div class="issue-card ${isSelected ? "selected" : ""}">
        <label class="issue-select">
          <input class="issue-checkbox" type="checkbox" data-issue-id="${issue.issue_id}" ${isSelected ? "checked" : ""}>
          <span>
            <span class="issue-heading-line">
              <span class="issue-id">#${issue.issue_id}</span>
              <span class="issue-title">${escapeHtml(subjectOf(issue))}</span>
              <span class="issue-date">${escapeHtml(issue.updated_on ? issue.updated_on.slice(0, 10) : "")}</span>
            </span>
            <span class="tag-row">
              ${issue.status ? `<span class="tag">${escapeHtml(issue.status)}</span>` : ""}
              ${!omitProjectTag && issue.project ? `<span class="tag optional">${escapeHtml(issue.project)}</span>` : ""}
              ${issue.tracker ? `<span class="tag optional">${escapeHtml(issue.tracker)}</span>` : ""}
              ${issue.assigned_to ? `<span class="tag optional">@${escapeHtml(issue.assigned_to)}</span>` : ""}
            </span>
          </span>
        </label>
      </div>
    </li>
  `;
}

function bindIssueCheckboxes() {
  for (const checkbox of elements.issueList.querySelectorAll("[data-issue-id]")) {
    checkbox.addEventListener("change", (event) => {
      const issueId = Number(event.target.dataset.issueId);
      if (event.target.checked) {
        upsertDraftEntry(issueId);
      } else {
        removeDraftEntry(issueId);
      }
      renderAll();
    });
  }
}

function renderGroupedIssueList(visible) {
  const groups = new Map();
  for (const issue of visible) {
    const name = issue.project || "(未指定)";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(issue);
  }
  const entries = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) {
    elements.issueList.innerHTML = `<li><div class="empty-state">搜尋條件下沒有符合的 issue。</div></li>`;
    return;
  }
  elements.issueList.innerHTML = entries
    .map(([name, issues]) => {
      const expanded = state.expandedProjects.has(name);
      const selectedInGroup = issues.filter((issue) => isIssueInDrafts(issue.issue_id)).length;
      return `
        <li class="project-group">
          <div class="project-header" data-toggle-group="${escapeHtml(name)}">
            <span class="group-arrow">${expanded ? "▼" : "▶"}</span>
            <strong class="group-name">${escapeHtml(name)}</strong>
            <span class="group-count">${issues.length}</span>
            ${selectedInGroup > 0 ? `<span class="group-selected">已選 ${selectedInGroup}</span>` : ""}
          </div>
          ${expanded ? `<ul class="group-issues">${issues.map((issue) => issueCardHtml(issue, { omitProjectTag: true })).join("")}</ul>` : ""}
        </li>
      `;
    })
    .join("");

  for (const header of elements.issueList.querySelectorAll("[data-toggle-group]")) {
    header.addEventListener("click", () => {
      const name = header.dataset.toggleGroup;
      if (state.expandedProjects.has(name)) state.expandedProjects.delete(name);
      else state.expandedProjects.add(name);
      renderAll();
    });
  }
  bindIssueCheckboxes();
}

function renderIssueList() {
  const visible = filteredIssues();
  elements.issueCount.textContent = `${state.issues.length}${state.filterSearch ? ` / 符合 ${visible.length}` : ""}`;
  elements.selectedCount.textContent = `${selectedCount()} 筆`;
  const pieces = [sourceLabel(state.currentSource)];
  if (state.filterDate) pieces.push(`更新於 ${state.filterDate}`);
  if (state.filterSearch) pieces.push(`搜尋: ${state.filterSearch}`);
  elements.issueSummary.textContent = pieces.join(" · ");

  if (state.currentSource.type === "schedule") {
    if (state.scheduleStage === "select") {
      renderScheduleSelectStage();
    } else {
      renderScheduleOrderingList();
    }
    return;
  }

  if (!state.issues.length) {
    elements.issueList.innerHTML = `
      <li><div class="empty-state">
        這個來源沒有符合條件的 issue。可以調整上方的更新日期，或切換到其他 PJ 篩選器。
      </div></li>
    `;
    return;
  }

  if (state.currentSource.type === "mine-grouped") {
    renderGroupedIssueList(visible);
    return;
  }

  if (!visible.length) {
    elements.issueList.innerHTML = `
      <li><div class="empty-state">搜尋條件下沒有符合的 issue，試著清空搜尋或調整關鍵字。</div></li>
    `;
    return;
  }
  elements.issueList.innerHTML = visible.map((issue) => issueCardHtml(issue)).join("");
  bindIssueCheckboxes();
}

function renderAlerts() {
  const alerts = [];
  if (state.issueWarnings.length) {
    alerts.push(`<div class="alert warn">${state.issueWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.activityWarnings.length) {
    alerts.push(`<div class="alert warn">${state.activityWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.phrasesWarnings.length) {
    alerts.push(`<div class="alert warn">${state.phrasesWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.sourcesWarnings.length) {
    alerts.push(`<div class="alert warn">${state.sourcesWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.previewWarnings.length) {
    alerts.push(`<div class="alert warn">${state.previewWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.previewToken) {
    alerts.push("<div class=\"alert\">已完成預覽。若修改全域日期或任何欄位，必須重新預覽後才能送出。</div>");
  }
  if (state.commitResults.length) {
    alerts.push(renderResults());
  }
  if (state.scheduleCommitResults.length) {
    alerts.push(renderScheduleResults());
  }
  elements.alertStack.innerHTML = alerts.join("");
}

function renderScheduleResults() {
  const ok = state.scheduleCommitResults.filter((r) => r.ok).length;
  const fail = state.scheduleCommitResults.filter((r) => r.error).length;
  const lines = state.scheduleCommitResults.map((r) => {
    if (r.ok) return `✓ #${r.issue_id}  ${r.start_date} → ${r.due_date}`;
    return `✗ #${r.issue_id ?? "?"}  ${r.error}`;
  });
  return `
    <div class="alert ${fail ? "warn" : ""}">
      <strong>Issue 起迄日更新結果 (${ok} 成功 / ${fail} 失敗)</strong>
      <ul class="result-list">
        ${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function activityOptionsHtml(currentValue) {
  return state.activities
    .map(
      (activity) =>
        `<option value="${activity.id}" ${String(currentValue || "") === String(activity.id) ? "selected" : ""}>${escapeHtml(activity.name)}</option>`
    )
    .join("");
}

function activityFieldHtml(entry) {
  if (state.manualActivityEntry) {
    return `<input type="number" min="1" value="${escapeHtml(entry.activity_id || "")}" data-row-field="activity_id" data-issue-id="${entry.issue_id}" placeholder="activity_id">`;
  }
  return `
    <select data-row-field="activity_id" data-issue-id="${entry.issue_id}">
      <option value="">選擇活動</option>
      ${activityOptionsHtml(entry.activity_id)}
    </select>
  `;
}

function renderRow(entry) {
  const issue = issueById(entry.issue_id);
  const issueLabel = issue ? subjectOf(issue) : entry.issue_subject;
  const errors = Object.values(entry.errors || {});
  const duplicateList = (entry.duplicate_entries || [])
    .map(
      (item) =>
        `<li>#${escapeHtml(item.id)} ${escapeHtml(item.hours)}h ${escapeHtml(item.activity_name || "")} ${escapeHtml(item.comments || "")}</li>`
    )
    .join("");
  const isFocused = lastFocusedEntryId === entry.issue_id;

  const phraseOptions = state.phrases.length
    ? `<select class="entry-phrase-select" data-apply-phrase-select data-issue-id="${entry.issue_id}" title="套用常用語句到此筆">
         <option value="">套用語句...</option>
         ${state.phrases.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label || "(未命名)")}</option>`).join("")}
       </select>`
    : "";

  return `
    <tbody data-entry-row="${entry.issue_id}" class="${isFocused ? "row-focused" : ""}">
      <tr class="entry-issue-row">
        <td colspan="5">
          <div class="entry-title-row">
            <div class="entry-title-text">
              <span class="entry-issue-id">#${entry.issue_id}</span>
              <span class="entry-issue-label">${escapeHtml(issueLabel)}</span>
              ${entry.issue_url ? `<a class="entry-issue-link" href="${escapeHtml(entry.issue_url)}" target="_blank" rel="noreferrer">↗</a>` : ""}
            </div>
            ${phraseOptions}
          </div>
        </td>
      </tr>
      <tr class="entry-fields-row">
        <td>
          <button class="draft-remove" data-remove-draft="${entry.issue_id}" title="從草稿移除">×</button>
        </td>
        <td>
          <span class="mobile-label">時數</span>
          <input class="hours-input" type="number" step="0.1" min="0.1" value="${escapeHtml(entry.hours || "")}" data-row-field="hours" data-issue-id="${entry.issue_id}" placeholder="例如 1.5">
        </td>
        <td>
          <span class="mobile-label">活動類型</span>
          ${activityFieldHtml(entry)}
        </td>
        <td class="comment-cell">
          <span class="mobile-label">工作描述</span>
          <textarea data-row-field="comments" data-issue-id="${entry.issue_id}" placeholder="今天做了什麼...">${escapeHtml(entry.comments || "")}</textarea>
        </td>
        <td>
          <span class="mobile-label">驗證</span>
          ${entry.duplicate ? '<div class="duplicate-chip">此 issue 同日期已有工時，已自動取消勾選</div>' : ""}
          ${duplicateList ? `<ul class="duplicate-list">${duplicateList}</ul>` : ""}
          ${errors.length ? `<ul class="row-errors">${errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<span class="muted">尚未送出或無錯誤</span>'}
        </td>
      </tr>
    </tbody>
  `;
}

function bindTableEvents() {
  for (const field of elements.tableWrap.querySelectorAll("[data-row-field]")) {
    field.addEventListener("change", (event) => {
      const issueId = Number(event.target.dataset.issueId);
      const fieldName = event.target.dataset.rowField;
      const entry = state.draftEntries.find((item) => item.issue_id === issueId);
      if (!entry) return;
      entry[fieldName] = event.target.value;
      clearEntryPreviewState(entry);
      invalidatePreview(true);
      renderAll();
    });
    field.addEventListener("focus", (event) => {
      lastFocusedEntryId = Number(event.target.dataset.issueId);
      highlightFocusedRow();
    });
  }

  for (const select of elements.tableWrap.querySelectorAll("[data-apply-phrase-select]")) {
    select.addEventListener("change", (event) => {
      const phraseId = event.target.value;
      if (!phraseId) return;
      const issueId = Number(event.target.dataset.issueId);
      const entry = state.draftEntries.find((item) => item.issue_id === issueId);
      const phrase = state.phrases.find((p) => p.id === phraseId);
      if (!entry || !phrase) return;
      applyPhraseFields(phrase, entry);
      clearEntryPreviewState(entry);
      invalidatePreview(true);
      event.target.value = "";
      renderAll();
    });
  }

  for (const btn of elements.tableWrap.querySelectorAll("[data-remove-draft]")) {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const issueId = Number(event.currentTarget.dataset.removeDraft);
      removeDraftEntry(issueId);
      renderAll();
    });
  }
}

function highlightFocusedRow() {
  for (const row of elements.tableWrap.querySelectorAll("[data-entry-row]")) {
    row.classList.toggle(
      "row-focused",
      Number(row.dataset.entryRow) === lastFocusedEntryId
    );
  }
}

function selectedValidRows() {
  return state.draftEntries.filter((entry) => !Object.keys(entry.errors || {}).length);
}

function updateButtons() {
  const isSchedule = state.currentSource.type === "schedule";
  const isArrange = isSchedule && state.scheduleStage === "arrange";
  if (elements.stickyActions) {
    elements.stickyActions.style.display = isSchedule ? "none" : "";
  }
  if (elements.stickyActionsSchedule) {
    elements.stickyActionsSchedule.style.display = isArrange ? "flex" : "none";
  }
  if (elements.scheduleApplyButton) {
    elements.scheduleApplyButton.disabled = state.isLoading || !isArrange;
  }
  if (elements.dailyTotalBadge) {
    elements.dailyTotalBadge.style.display = isSchedule ? "none" : "";
  }
  elements.refreshButton.disabled = state.isLoading;
  elements.selectAllButton.disabled = isSchedule || state.isLoading || filteredIssues().length === 0;
  elements.clearSelectionButton.disabled = state.isLoading || selectedCount() === 0;
  elements.commitButton.disabled = isSchedule || state.isLoading || selectedValidRows().length === 0 || !state.batchSpentOn;
  elements.filterDate.disabled = state.isLoading;
  elements.filterClearDate.disabled = state.isLoading || !state.filterDate;
  elements.filterSearch.disabled = state.isLoading;
  elements.selectedCount.textContent = `${selectedCount()} 筆`;
  elements.filterDate.value = state.filterDate || "";
  elements.filterDate.max = state.localToday;
  elements.filterSearch.value = state.filterSearch || "";
  elements.batchSpentOn.value = state.batchSpentOn || "";
  elements.batchSpentOn.disabled = state.isLoading;
  for (const btn of document.querySelectorAll("[data-spent-on-offset]")) {
    const offset = Number(btn.dataset.spentOnOffset);
    const match = state.batchSpentOn === daysAgoString(offset);
    btn.classList.toggle("active", match);
    btn.disabled = state.isLoading;
  }
}

function renderResults() {
  return `
    <div class="alert ${state.commitResults.some((item) => item.error) ? "warn" : ""}">
      <strong>送出結果</strong>
      <ul class="result-list">
        ${state.commitResults
          .map((item) => {
            const status = item.created_time_entry_id
              ? `建立成功，ID ${item.created_time_entry_id}`
              : item.error
                ? escapeHtml(item.error)
                : item.skipped
                  ? "未勾選，略過"
                  : "未送出";
            return `<li>Issue #${item.issue_id} / ${escapeHtml(item.spent_on)} : ${status}</li>`;
          })
          .join("")}
      </ul>
    </div>
  `;
}

function renderTable() {
  if (state.currentSource.type === "schedule") {
    if (state.scheduleStage === "select") {
      const count = state.scheduleSelectedProjectIds.size;
      elements.workbenchSummary.textContent =
        count > 0
          ? `已勾選 ${count} 個 project，按下方「開始排程 →」進入 Step 2`
          : "從左側勾選要排程的 project（可複選）";
      elements.tableWrap.innerHTML = `
        <div class="empty-state">
          <p><strong>分配工時流程</strong></p>
          <ol style="padding-left: 20px; line-height: 1.8;">
            <li>Step 1：在左側勾選想要排程的 project（可複選）</li>
            <li>Step 2：拖拉或 ↑/↓ 排序 project 與其內的 issue，點預算數字可覆寫</li>
            <li>系統會依你排的順序從本週一開始填，每日上限 ${state.dailyHourLimit}h</li>
          </ol>
          <button class="action-button" id="schedule-start-button" ${count === 0 ? "disabled" : ""}>
            開始排程 (已選 ${count}) →
          </button>
        </div>
      `;
      document.getElementById("schedule-start-button")?.addEventListener("click", () => {
        if (state.scheduleSelectedProjectIds.size === 0) return;
        state.scheduleStage = "arrange";
        renderAll();
      });
      return;
    }
    elements.workbenchSummary.textContent = `依序填入本週一到下週五，每日上限 ${state.dailyHourLimit}h`;
    elements.tableWrap.innerHTML = renderScheduleGantt();
    return;
  }
  if (state.draftEntries.length === 0) {
    elements.workbenchSummary.textContent = "先從左側勾選要補登工時的 issue。";
    elements.tableWrap.innerHTML = `
      <div class="empty-state">
        這裡會顯示批次工時表單。勾選 issue 後逐列填寫時數、活動與備註；備註可用側邊欄的常用語句一鍵套用。
      </div>
    `;
    return;
  }

  const focusedLabel = lastFocusedEntryId ? `目前列：#${lastFocusedEntryId}` : "未選定目前列（常用語句會要求先點任一列）";
  elements.workbenchSummary.textContent = `已選 ${state.draftEntries.length} 筆 issue · ${focusedLabel} · 工時日期：${state.batchSpentOn || "未設定"}`;
  elements.tableWrap.innerHTML = `
    <table>
      <colgroup>
        <col class="col-send">
        <col class="col-hours">
        <col class="col-activity">
        <col class="col-comments">
        <col class="col-check">
      </colgroup>
      <thead>
        <tr>
          <th>送出</th>
          <th>時數</th>
          <th>活動</th>
          <th>備註</th>
          <th>驗證</th>
        </tr>
      </thead>
      ${state.draftEntries.map((entry) => renderRow(entry)).join("")}
    </table>
  `;
  bindTableEvents();
}

function workingDays(minCount = 10) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);
  const days = [];
  const cursor = new Date(monday);
  const cap = 365;
  while (days.length < minCount) {
    const wd = cursor.getDay();
    if (wd >= 1 && wd <= 5) days.push(localDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (days.length >= cap) break;
  }
  return days;
}

function getIssueBudget(issue) {
  const override = state.scheduleBudgets[issue.issue_id];
  if (override !== undefined && override !== null && override !== "") {
    const n = Number(override);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  const est = Number(issue.estimated_hours) || 0;
  const spent = Number(issue.spent_hours) || 0;
  return Math.max(est - spent, 0);
}

function collectAllProjects() {
  const map = new Map();
  for (const issue of state.issues) {
    const pid = issue.project_id || 0;
    if (!map.has(pid)) {
      map.set(pid, {
        id: pid,
        name: issue.project || "(未指定)",
        issueIds: [],
        totalBudget: 0,
      });
    }
    const entry = map.get(pid);
    entry.issueIds.push(issue.issue_id);
    const est = Number(issue.estimated_hours) || 0;
    const spent = Number(issue.spent_hours) || 0;
    entry.totalBudget += Math.max(est - spent, 0);
  }
  return map;
}

function ensureScheduleOrder() {
  const projectMap = new Map();
  for (const issue of state.issues) {
    const pid = issue.project_id || 0;
    if (!state.scheduleSelectedProjectIds.has(pid)) continue;
    if (!projectMap.has(pid)) {
      projectMap.set(pid, {
        id: pid,
        name: issue.project || "(未指定)",
        issueIds: [],
      });
    }
    projectMap.get(pid).issueIds.push(issue.issue_id);
  }
  const currentPids = new Set(projectMap.keys());
  state.scheduleProjectOrder = state.scheduleProjectOrder.filter((pid) => currentPids.has(pid));
  for (const pid of currentPids) {
    if (!state.scheduleProjectOrder.includes(pid)) state.scheduleProjectOrder.push(pid);
  }
  for (const pid of currentPids) {
    const currentIids = new Set(projectMap.get(pid).issueIds);
    const existing = state.scheduleIssueOrder[pid] || [];
    const cleaned = existing.filter((iid) => currentIids.has(iid));
    for (const iid of projectMap.get(pid).issueIds) {
      if (!cleaned.includes(iid)) cleaned.push(iid);
    }
    state.scheduleIssueOrder[pid] = cleaned;
  }
  return projectMap;
}

function computeSchedule() {
  ensureScheduleOrder();
  const limit = state.dailyHourLimit;
  let totalDemand = 0;
  for (const pid of state.scheduleProjectOrder) {
    const issueOrder = state.scheduleIssueOrder[pid] || [];
    for (const iid of issueOrder) {
      const issue = state.issues.find((i) => i.issue_id === iid);
      if (!issue) continue;
      totalDemand += getIssueBudget(issue);
    }
  }
  const daysNeeded = Math.max(10, Math.ceil(totalDemand / limit) + 1);
  const days = workingDays(daysNeeded);
  const budgetsLeft = days.map(() => limit);
  const allocations = days.map(() => []);
  for (const pid of state.scheduleProjectOrder) {
    const issueOrder = state.scheduleIssueOrder[pid] || [];
    for (const iid of issueOrder) {
      const issue = state.issues.find((i) => i.issue_id === iid);
      if (!issue) continue;
      const total = getIssueBudget(issue);
      if (total <= 0) continue;
      let remaining = total;
      for (let di = 0; di < days.length && remaining > 0.01; di++) {
        const slot = Math.min(remaining, budgetsLeft[di]);
        if (slot > 0.01) {
          allocations[di].push({
            issue_id: iid,
            subject: issue.subject || "",
            project: issue.project || "",
            hours: +slot.toFixed(2),
          });
          budgetsLeft[di] = +(budgetsLeft[di] - slot).toFixed(2);
          remaining = +(remaining - slot).toFixed(2);
        }
      }
    }
  }
  return { days, allocations, budgetsLeft, limit };
}

function renderScheduleSelectStage() {
  const projectMap = collectAllProjects();
  const projects = Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  if (!projects.length) {
    elements.issueList.innerHTML = `<li><div class="empty-state">沒有可排程的 project。先確認「我的 issue」有資料。</div></li>`;
    return;
  }
  elements.issueList.innerHTML = `
    <li class="sched-breadcrumb muted">Step 1 / 2 · 勾選要排程的 project</li>
    ${projects
      .map((proj) => {
        const selected = state.scheduleSelectedProjectIds.has(proj.id);
        return `
          <li>
            <label class="sched-select-card ${selected ? "selected" : ""}">
              <input type="checkbox" ${selected ? "checked" : ""} data-select-project="${proj.id}">
              <span class="sched-select-main">
                <h3 class="sched-select-title">${escapeHtml(proj.name)}</h3>
                <div class="sched-select-meta">${proj.issueIds.length} issues · 預估剩 ${proj.totalBudget.toFixed(1)}h</div>
              </span>
            </label>
          </li>
        `;
      })
      .join("")}
  `;
  for (const input of elements.issueList.querySelectorAll("[data-select-project]")) {
    input.addEventListener("change", (event) => {
      const pid = Number(event.currentTarget.dataset.selectProject);
      if (event.currentTarget.checked) state.scheduleSelectedProjectIds.add(pid);
      else state.scheduleSelectedProjectIds.delete(pid);
      renderAll();
    });
  }
}

function renderScheduleOrderingList() {
  const projectMap = ensureScheduleOrder();
  if (!state.scheduleProjectOrder.length) {
    elements.issueList.innerHTML = `
      <li class="sched-breadcrumb">
        <button class="ghost-button tiny" id="sched-back-button">← 重新選 project</button>
      </li>
      <li><div class="empty-state">沒有已勾選的 project，請回到 Step 1 重新選擇。</div></li>
    `;
    document.getElementById("sched-back-button")?.addEventListener("click", () => {
      state.scheduleStage = "select";
      renderAll();
    });
    return;
  }
  const parts = state.scheduleProjectOrder.map((pid, pi) => {
    const project = projectMap.get(pid);
    if (!project) return "";
    const isFirstProject = pi === 0;
    const isLastProject = pi === state.scheduleProjectOrder.length - 1;
    const issueIds = state.scheduleIssueOrder[pid] || [];
    const issueBlocks = issueIds
      .map((iid, ii) => {
        const issue = state.issues.find((i) => i.issue_id === iid);
        if (!issue) return "";
        const isFirst = ii === 0;
        const isLast = ii === issueIds.length - 1;
        return `
          <div class="sched-issue" draggable="true" data-issue-drag="${pid}:${iid}">
            <div class="sched-issue-line">
              <button class="ghost-button tiny" ${isFirst ? "disabled" : ""} data-move-issue-up="${pid}:${iid}">↑</button>
              <button class="ghost-button tiny" ${isLast ? "disabled" : ""} data-move-issue-down="${pid}:${iid}">↓</button>
              <span class="issue-id">#${iid}</span>
              <span class="issue-title">${escapeHtml(issue.subject || "")}</span>
              ${renderBudgetCell(issue)}
            </div>
          </div>
        `;
      })
      .join("");
    return `
      <li class="sched-project" draggable="true" data-project-drag-id="${pid}">
        <div class="sched-project-head">
          <button class="ghost-button tiny" ${isFirstProject ? "disabled" : ""} data-move-project-up="${pid}">↑</button>
          <button class="ghost-button tiny" ${isLastProject ? "disabled" : ""} data-move-project-down="${pid}">↓</button>
          <strong>${escapeHtml(project.name)}</strong>
          <span class="muted">(${project.issueIds.length} issues)</span>
        </div>
        ${issueBlocks}
      </li>
    `;
  });
  elements.issueList.innerHTML = `
    <li class="sched-breadcrumb">
      <button class="ghost-button tiny" id="sched-back-button">← 重新選 project</button>
      <span class="muted" style="margin-left: 10px;">Step 2 / 2 · 拖拉或點 ↑/↓ 排序，點預算數字可改</span>
    </li>
    ${parts.join("")}
  `;
  document.getElementById("sched-back-button")?.addEventListener("click", () => {
    state.scheduleStage = "select";
    renderAll();
  });
  bindScheduleEvents();
  bindScheduleDrag();
  bindBudgetCells();
}

function renderBudgetCell(issue) {
  const iid = issue.issue_id;
  const override = state.scheduleBudgets[iid];
  const est = Number(issue.estimated_hours) || 0;
  const spent = Number(issue.spent_hours) || 0;
  const remaining = Math.max(est - spent, 0);
  const hasOverride = override !== undefined && override !== null && override !== "";
  const displayValue = hasOverride ? Number(override) : remaining;
  const isEditing = state.budgetEditIssueId === iid;
  if (isEditing) {
    return `<input type="number" step="0.5" min="0" class="budget-input" data-budget-input="${iid}" value="${escapeHtml(String(displayValue))}">`;
  }
  return `
    <button class="budget-badge ${hasOverride ? "override" : ""}" data-budget-toggle="${iid}" title="點擊編輯預算 (est ${est}h · spent ${spent}h)">
      ${displayValue}h${hasOverride ? ` <span class="clear-override" data-budget-clear="${iid}" title="清除覆寫">⟲</span>` : ""}
    </button>
  `;
}

function bindBudgetCells() {
  for (const btn of elements.issueList.querySelectorAll("[data-budget-toggle]")) {
    btn.addEventListener("click", (event) => {
      if (event.target.closest("[data-budget-clear]")) return;
      const iid = Number(event.currentTarget.dataset.budgetToggle);
      state.budgetEditIssueId = iid;
      renderAll();
      const input = document.querySelector(`[data-budget-input="${iid}"]`);
      if (input) {
        input.focus();
        input.select();
      }
    });
  }
  for (const btn of elements.issueList.querySelectorAll("[data-budget-clear]")) {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const iid = Number(event.currentTarget.dataset.budgetClear);
      delete state.scheduleBudgets[iid];
      renderAll();
    });
  }
  for (const input of elements.issueList.querySelectorAll("[data-budget-input]")) {
    input.addEventListener("blur", (event) => {
      const iid = Number(event.currentTarget.dataset.budgetInput);
      const val = event.currentTarget.value.trim();
      if (val === "") delete state.scheduleBudgets[iid];
      else state.scheduleBudgets[iid] = val;
      state.budgetEditIssueId = null;
      renderAll();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") event.currentTarget.blur();
      else if (event.key === "Escape") {
        state.budgetEditIssueId = null;
        renderAll();
      }
    });
  }
}

function bindScheduleDrag() {
  for (const el of elements.issueList.querySelectorAll("[data-project-drag-id]")) {
    el.addEventListener("dragstart", (event) => {
      if (event.target.closest("[data-issue-drag]")) return;
      dragContext = { kind: "project", projectId: Number(el.dataset.projectDragId) };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(dragContext.projectId));
    });
    el.addEventListener("dragover", (event) => {
      if (dragContext?.kind !== "project") return;
      event.preventDefault();
      el.classList.add("drag-over");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
    el.addEventListener("drop", (event) => {
      event.preventDefault();
      el.classList.remove("drag-over");
      if (dragContext?.kind !== "project") return;
      const targetId = Number(el.dataset.projectDragId);
      if (dragContext.projectId !== targetId) reorderProjectTo(dragContext.projectId, targetId);
      dragContext = null;
    });
    el.addEventListener("dragend", () => {
      dragContext = null;
      for (const n of elements.issueList.querySelectorAll(".drag-over")) n.classList.remove("drag-over");
    });
  }
  for (const el of elements.issueList.querySelectorAll("[data-issue-drag]")) {
    el.addEventListener("dragstart", (event) => {
      const [pid, iid] = el.dataset.issueDrag.split(":").map(Number);
      dragContext = { kind: "issue", projectId: pid, issueId: iid };
      event.dataTransfer.effectAllowed = "move";
      event.stopPropagation();
    });
    el.addEventListener("dragover", (event) => {
      if (dragContext?.kind !== "issue") return;
      const [pid] = el.dataset.issueDrag.split(":").map(Number);
      if (pid !== dragContext.projectId) return;
      event.preventDefault();
      event.stopPropagation();
      el.classList.add("drag-over");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
    el.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      el.classList.remove("drag-over");
      if (dragContext?.kind !== "issue") return;
      const [pid, iid] = el.dataset.issueDrag.split(":").map(Number);
      if (pid !== dragContext.projectId) return;
      if (dragContext.issueId !== iid) reorderIssueTo(pid, dragContext.issueId, iid);
      dragContext = null;
    });
  }
}

function reorderProjectTo(draggedId, targetId) {
  const arr = state.scheduleProjectOrder;
  const from = arr.indexOf(draggedId);
  const to = arr.indexOf(targetId);
  if (from < 0 || to < 0) return;
  arr.splice(from, 1);
  arr.splice(to, 0, draggedId);
  renderAll();
}

function reorderIssueTo(pid, draggedId, targetId) {
  const arr = state.scheduleIssueOrder[pid];
  if (!arr) return;
  const from = arr.indexOf(draggedId);
  const to = arr.indexOf(targetId);
  if (from < 0 || to < 0) return;
  arr.splice(from, 1);
  arr.splice(to, 0, draggedId);
  renderAll();
}

function bindScheduleEvents() {
  for (const btn of elements.issueList.querySelectorAll("[data-move-project-up]")) {
    btn.addEventListener("click", (e) => moveProject(Number(e.currentTarget.dataset.moveProjectUp), -1));
  }
  for (const btn of elements.issueList.querySelectorAll("[data-move-project-down]")) {
    btn.addEventListener("click", (e) => moveProject(Number(e.currentTarget.dataset.moveProjectDown), 1));
  }
  for (const btn of elements.issueList.querySelectorAll("[data-move-issue-up]")) {
    btn.addEventListener("click", (e) => {
      const [pid, iid] = e.currentTarget.dataset.moveIssueUp.split(":").map(Number);
      moveIssue(pid, iid, -1);
    });
  }
  for (const btn of elements.issueList.querySelectorAll("[data-move-issue-down]")) {
    btn.addEventListener("click", (e) => {
      const [pid, iid] = e.currentTarget.dataset.moveIssueDown.split(":").map(Number);
      moveIssue(pid, iid, 1);
    });
  }
  for (const input of elements.issueList.querySelectorAll("[data-issue-budget]")) {
    input.addEventListener("change", (e) => {
      const iid = Number(e.currentTarget.dataset.issueBudget);
      const val = e.currentTarget.value;
      if (val === "") delete state.scheduleBudgets[iid];
      else state.scheduleBudgets[iid] = val;
      renderAll();
    });
  }
}

function moveProject(pid, delta) {
  const arr = state.scheduleProjectOrder;
  const idx = arr.indexOf(pid);
  if (idx < 0) return;
  const ni = idx + delta;
  if (ni < 0 || ni >= arr.length) return;
  arr.splice(idx, 1);
  arr.splice(ni, 0, pid);
  renderAll();
}

function moveIssue(pid, iid, delta) {
  const arr = state.scheduleIssueOrder[pid] || [];
  const idx = arr.indexOf(iid);
  if (idx < 0) return;
  const ni = idx + delta;
  if (ni < 0 || ni >= arr.length) return;
  arr.splice(idx, 1);
  arr.splice(ni, 0, iid);
  renderAll();
}

function deriveIssueDatesFromSchedule(schedule) {
  const map = new Map();
  for (let i = 0; i < schedule.days.length; i++) {
    const date = schedule.days[i];
    for (const item of schedule.allocations[i]) {
      const existing = map.get(item.issue_id);
      if (!existing) {
        map.set(item.issue_id, {
          issue_id: item.issue_id,
          subject: item.subject,
          start_date: date,
          due_date: date,
        });
      } else {
        existing.due_date = date;
      }
    }
  }
  return Array.from(map.values());
}

async function applyScheduleDates() {
  const schedule = computeSchedule();
  const entries = deriveIssueDatesFromSchedule(schedule);
  if (entries.length === 0) {
    alert("目前沒有排入工時的 issue，無法送出。");
    return;
  }
  const preview = entries
    .map((e) => `  #${e.issue_id} ${e.subject}  ${e.start_date} → ${e.due_date}`)
    .join("\n");
  if (!confirm(`將更新 ${entries.length} 個 issue 的起迄日期：\n\n${preview}\n\n確定送出？`)) return;
  const payload = {
    entries: entries.map((e) => ({
      issue_id: e.issue_id,
      start_date: e.start_date,
      due_date: e.due_date,
    })),
  };
  await withLoading("更新 issue 起迄日期中...", async () => {
    const data = await fetchJson("/api/schedule/apply-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.scheduleCommitResults = data.results || [];
  });
  renderAll();
}

function renderScheduleGantt() {
  const { days, allocations, budgetsLeft, limit } = computeSchedule();
  const weekdayNames = ["日", "一", "二", "三", "四", "五", "六"];
  const dayCards = days
    .map((date, i) => {
      const items = allocations[i];
      if (items.length === 0) return "";
      const used = +(limit - budgetsLeft[i]).toFixed(2);
      const statusClass = budgetsLeft[i] <= 0.01 ? "full" : "partial";
      const dateObj = new Date(`${date}T12:00:00`);
      const weekday = weekdayNames[dateObj.getDay()];
      const itemList = `<ul class="gantt-items">${items
        .map(
          (item) => `
            <li>
              <span class="gantt-hours">${item.hours}h</span>
              <span class="gantt-issue">#${item.issue_id} ${escapeHtml(item.subject)}</span>
              ${item.project ? `<span class="tag">${escapeHtml(item.project)}</span>` : ""}
            </li>`
        )
        .join("")}</ul>`;
      return `
        <div class="gantt-day ${statusClass}">
          <div class="gantt-day-head">
            <strong>${date} (週${weekday})</strong>
            <span>${used} / ${limit} h</span>
          </div>
          ${itemList}
        </div>
      `;
    })
    .filter(Boolean)
    .join("");
  if (!dayCards) {
    return `<div class="empty-state">沒有需要排程的 issue（預算皆為 0），或還沒勾選任何 project。</div>`;
  }
  return `<div class="gantt-days">${dayCards}</div>`;
}

function phrasePresetLabel(phrase) {
  const chips = [];
  if (phrase.hours) chips.push(`<span class="preset-chip">${escapeHtml(phrase.hours)}h</span>`);
  if (phrase.activity_id) {
    const activity = state.activities.find((a) => String(a.id) === String(phrase.activity_id));
    const name = activity ? activity.name : `activity ${phrase.activity_id}`;
    chips.push(`<span class="preset-chip">${escapeHtml(name)}</span>`);
  }
  if (phrase.comments) chips.push(`<span class="preset-chip">備註</span>`);
  return chips.join("");
}

function renderPhrasesDrawer() {
  renderPhraseActivityField();
  if (!state.phrases.length) {
    elements.phrasesList.innerHTML = `<div class="empty-state">還沒有常用語句。用上方表單新增後，按「套用」即可一次帶入時數 / 活動 / 備註到目前列。</div>`;
    return;
  }
  elements.phrasesList.innerHTML = state.phrases
    .map(
      (phrase) => `
        <div class="item-card" data-phrase-id="${escapeHtml(phrase.id)}">
          <div class="item-head">
            <h3 class="item-title">${escapeHtml(phrase.label || "(未命名)")}</h3>
            <div class="phrase-actions">
              <button class="ghost-button" data-edit-phrase="${escapeHtml(phrase.id)}">編輯</button>
              <button class="danger-button" data-delete-phrase="${escapeHtml(phrase.id)}">刪除</button>
            </div>
          </div>
          <div class="phrase-preset-row">${phrasePresetLabel(phrase)}</div>
          ${phrase.comments ? `<div class="phrase-text">${escapeHtml(phrase.comments)}</div>` : ""}
        </div>
      `
    )
    .join("");

  for (const btn of elements.phrasesList.querySelectorAll("[data-edit-phrase]")) {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      startEditPhrase(event.currentTarget.dataset.editPhrase);
    });
  }
  for (const btn of elements.phrasesList.querySelectorAll("[data-delete-phrase]")) {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const phraseId = event.currentTarget.dataset.deletePhrase;
      if (!confirm("確定要刪除這筆常用語句？")) return;
      try {
        await withLoading("刪除常用語句中...", () => deletePhraseById(phraseId));
        renderPhrasesDrawer();
      } catch (error) {
        state.phrasesWarnings = [error.message || String(error)];
        renderAlerts();
      }
    });
  }
}

function renderPhraseActivityField() {
  const current = elements.phraseActivityWrap.dataset.value || "";
  if (state.manualActivityEntry) {
    elements.phraseActivityWrap.innerHTML = `<input type="number" min="1" id="phrase-activity-input" value="${escapeHtml(current)}" placeholder="activity_id">`;
  } else {
    elements.phraseActivityWrap.innerHTML = `
      <select id="phrase-activity-input">
        <option value="">不指定</option>
        ${activityOptionsHtml(current)}
      </select>
    `;
  }
}

function getPhraseActivityInput() {
  return document.getElementById("phrase-activity-input");
}

function setPhraseActivityValue(value) {
  elements.phraseActivityWrap.dataset.value = value || "";
  const input = getPhraseActivityInput();
  if (input) input.value = value || "";
}

function startEditPhrase(phraseId) {
  const phrase = state.phrases.find((item) => item.id === phraseId);
  if (!phrase) return;
  state.editingPhraseId = phraseId;
  elements.phraseLabelInput.value = phrase.label || "";
  elements.phraseHoursInput.value = phrase.hours || "";
  setPhraseActivityValue(phrase.activity_id || "");
  elements.phraseCommentsInput.value = phrase.comments || "";
  elements.phraseAddButton.textContent = "儲存修改";
  elements.phraseCancelButton.style.display = "";
  elements.phraseCommentsInput.focus();
}

function resetPhraseForm() {
  state.editingPhraseId = null;
  elements.phraseLabelInput.value = "";
  elements.phraseHoursInput.value = "";
  setPhraseActivityValue("");
  elements.phraseCommentsInput.value = "";
  elements.phraseAddButton.textContent = "儲存語句";
  elements.phraseCancelButton.style.display = "none";
}

function applyPhraseFields(phrase, entry) {
  if (phrase.hours) entry.hours = phrase.hours;
  if (phrase.activity_id) entry.activity_id = phrase.activity_id;
  if (phrase.comments) entry.comments = phrase.comments;
  clearEntryPreviewState(entry);
}

function renderSourcesDrawer() {
  if (!state.savedQueries.length) {
    elements.savedQueriesList.innerHTML = `<div class="empty-state">尚未加入任何 PJ 篩選器。先去 Redmine 建立自訂查詢，從網址 <code>?query_id=X</code> 抓 ID 加入這裡。</div>`;
  } else {
    elements.savedQueriesList.innerHTML = state.savedQueries
      .map(
        (query) => `
          <div class="item-card">
            <div class="item-head">
              <div>
                <h3 class="item-title">${escapeHtml(query.name)}</h3>
                <div class="muted">query_id: ${query.query_id}</div>
              </div>
              <button class="danger-button" data-remove-query="${query.query_id}">移除</button>
            </div>
          </div>
        `
      )
      .join("");
  }

  for (const btn of elements.savedQueriesList.querySelectorAll("[data-remove-query]")) {
    btn.addEventListener("click", async (event) => {
      const qid = Number(event.currentTarget.dataset.removeQuery);
      try {
        await withLoading("移除 PJ 篩選器...", () => removeSavedQuery(qid));
        renderSourceTabs();
        renderSourcesDrawer();
      } catch (error) {
        state.sourcesWarnings = [error.message || String(error)];
        renderAlerts();
      }
    });
  }
}

function openSettings() {
  state.settingsOpen = true;
  elements.settingsModal.hidden = false;
  elements.settingsModal.removeAttribute("aria-hidden");
  applySettingsTab();
  renderPhrasesDrawer();
  renderSourcesDrawer();
}

function closeSettings() {
  state.settingsOpen = false;
  elements.settingsModal.hidden = true;
  elements.settingsModal.setAttribute("aria-hidden", "true");
}

function applySettingsTab() {
  for (const btn of elements.settingsModal.querySelectorAll("[data-settings-tab]")) {
    btn.classList.toggle("active", btn.dataset.settingsTab === state.settingsTab);
  }
  for (const sec of elements.settingsModal.querySelectorAll("[data-settings-section]")) {
    sec.classList.toggle("active", sec.dataset.settingsSection === state.settingsTab);
  }
}

function updateMobileNav() {
  const tab = state.mobileActiveTab;
  document.body.setAttribute("data-mobile-tab", tab);
  for (const btn of document.querySelectorAll("#mobile-nav [data-tab]")) {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  }
}

function updateDraftBadge() {
  const badge = document.getElementById("draft-badge");
  if (!badge) return;
  const count = state.draftEntries.length;
  badge.textContent = String(count);
  badge.style.display = count > 0 ? "" : "none";
}

function updateSettingsTheme() {
  for (const btn of document.querySelectorAll("[data-theme-value]")) {
    btn.classList.toggle("active", btn.dataset.themeValue === state.theme);
  }
}

function updateAboutInfo() {
  const v = document.getElementById("app-version");
  const b = document.getElementById("app-build-time");
  if (v) v.textContent = APP_VERSION;
  if (b) b.textContent = APP_BUILD_TIME;
}

function openCommitModal() {
  const rows = selectedValidRows();
  if (!rows.length) return;
  elements.commitModalDate.value = state.batchSpentOn;
  updateCommitModalDateWarn();
  const totalHours = rows.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
  elements.commitModalSummary.textContent =
    `即將送出 ${rows.length} 筆工時，共 ${totalHours.toFixed(1)} 小時`;
  elements.commitModal.hidden = false;
  elements.commitModal.removeAttribute("aria-hidden");
  elements.commitModalDate.focus();
}

function closeCommitModal() {
  elements.commitModal.hidden = true;
  elements.commitModal.setAttribute("aria-hidden", "true");
}

function updateCommitModalDateWarn() {
  const selected = elements.commitModalDate.value;
  const today = daysAgoString(0);
  const yesterday = daysAgoString(1);
  if (selected && selected !== today && selected !== yesterday) {
    elements.commitModalDateWarn.textContent =
      `注意：所選日期 ${selected} 不是今天或昨天，請確認是否正確`;
    elements.commitModalDateWarn.hidden = false;
  } else {
    elements.commitModalDateWarn.hidden = true;
  }
}

function initMobileNav() {
  for (const btn of document.querySelectorAll("#mobile-nav [data-tab]")) {
    btn.addEventListener("click", async () => {
      const tab = btn.dataset.tab;
      if (tab === "settings") {
        openSettings();
        return;
      }
      state.mobileActiveTab = tab;
      if (tab === "schedule" && state.currentSource.type !== "schedule") {
        try {
          await switchSource({ type: "schedule" });
        } catch (err) {
          state.issueWarnings = [err.message || String(err)];
        }
      } else if (tab === "issues" && state.currentSource.type === "schedule") {
        try {
          await switchSource({ type: "mine" });
        } catch (err) {
          state.issueWarnings = [err.message || String(err)];
        }
      }
      updateMobileNav();
      updateDraftBadge();
      updateSettingsTheme();
      renderAll();
    });
  }
  for (const btn of document.querySelectorAll("[data-theme-value]")) {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.themeValue);
      updateSettingsTheme();
    });
  }
}

function renderAll() {
  renderTopTabs();
  renderSourceTabs();
  renderIssueList();
  renderAlerts();
  renderTable();
  if (state.settingsOpen) {
    renderPhrasesDrawer();
    renderSourcesDrawer();
  }
  renderLoadingMask();
  updateButtons();
  updateDailyTotalBadge();
  updateFilterBadge();
  updateMobileNav();
  updateDraftBadge();
  updateSettingsTheme();
  persistState();
}

async function previewEntries() {
  if (!state.draftEntries.length) return;
  const data = await fetchJson("/api/time-entries/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spent_on: state.batchSpentOn, entries: state.draftEntries }),
  });
  state.previewToken = data.preview_token || "";
  state.previewWarnings = data.warnings || [];
  state.commitResults = [];
  state.batchSpentOn = data.spent_on || state.batchSpentOn;
  state.draftEntries = data.entries || [];
}

async function commitEntries() {
  if (!state.previewToken) return;
  const data = await fetchJson("/api/time-entries/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      preview_token: state.previewToken,
      spent_on: state.batchSpentOn,
      entries: state.draftEntries,
    }),
  });
  state.commitResults = data.results || [];
  state.previewToken = "";
  const successIds = new Set(
    state.commitResults
      .filter((r) => r && r.created_time_entry_id)
      .map((r) => r.issue_id)
  );
  if (successIds.size > 0) {
    state.draftEntries = state.draftEntries.filter((entry) => !successIds.has(entry.issue_id));
    if (successIds.has(lastFocusedEntryId)) lastFocusedEntryId = null;
  }
}

function computeDailyTotal() {
  let total = 0;
  for (const entry of state.draftEntries) {
    if (!entry.selected) continue;
    const h = parseFloat(entry.hours);
    if (Number.isFinite(h)) total += h;
  }
  return total;
}

function updateDailyTotalBadge() {
  if (!elements.dailyTotalBadge) return;
  const total = computeDailyTotal();
  const limit = state.dailyHourLimit;
  elements.dailyTotalBadge.textContent = `${total.toFixed(1)} / ${limit} h`;
  elements.dailyTotalBadge.classList.toggle("overflow", total > limit + 0.001);
}

function updateFilterBadge() {
  if (!elements.filterAdvanced) return;
  elements.filterAdvanced.classList.toggle("open", state.filterExpanded);
  if (elements.filterToggleButton) {
    elements.filterToggleButton.setAttribute("aria-expanded", String(state.filterExpanded));
  }
  if (elements.filterDot) {
    elements.filterDot.style.display = state.filterDate ? "" : "none";
  }
}

function collectPhraseFormPayload() {
  const activityInput = getPhraseActivityInput();
  return {
    label: elements.phraseLabelInput.value.trim(),
    hours: elements.phraseHoursInput.value.trim(),
    activity_id: activityInput ? activityInput.value.trim() : "",
    comments: elements.phraseCommentsInput.value.trim(),
  };
}

async function addOrUpdatePhrase() {
  const payload = collectPhraseFormPayload();
  if (!payload.hours && !payload.activity_id && !payload.comments) {
    state.phrasesWarnings = ["至少要設定工時、活動或備註其中一項。"];
    renderAlerts();
    return;
  }
  const editingId = state.editingPhraseId;
  if (editingId) {
    const data = await fetchJson(`/api/phrases/${encodeURIComponent(editingId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const index = state.phrases.findIndex((item) => item.id === editingId);
    if (index >= 0) state.phrases[index] = data.phrase;
  } else {
    const data = await fetchJson("/api/phrases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.phrases.push(data.phrase);
  }
  state.phrasesWarnings = [];
  resetPhraseForm();
}

async function deletePhraseById(phraseId) {
  await fetchJson(`/api/phrases/${encodeURIComponent(phraseId)}`, { method: "DELETE" });
  state.phrases = state.phrases.filter((item) => item.id !== phraseId);
}

async function addSavedQuery() {
  const name = elements.queryNameInput.value.trim();
  const rawId = elements.queryIdInput.value.trim();
  if (!name) {
    state.sourcesWarnings = ["請填寫 PJ 篩選器名稱。"];
    renderAlerts();
    return;
  }
  if (!rawId) {
    state.sourcesWarnings = ["請填寫 query_id。"];
    renderAlerts();
    return;
  }
  const data = await fetchJson("/api/saved-queries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, query_id: Number(rawId) }),
  });
  const query = data.query;
  const existingIndex = state.savedQueries.findIndex((item) => item.query_id === query.query_id);
  if (existingIndex >= 0) {
    state.savedQueries[existingIndex] = query;
  } else {
    state.savedQueries.push(query);
  }
  state.sourcesWarnings = [];
  elements.queryNameInput.value = "";
  elements.queryIdInput.value = "";
}

async function removeSavedQuery(queryId) {
  await fetchJson(`/api/saved-queries/${queryId}`, { method: "DELETE" });
  state.savedQueries = state.savedQueries.filter((item) => item.query_id !== queryId);
  if (state.currentSource.type === "query" && state.currentSource.id === queryId) {
    state.currentSource = { type: "mine" };
    await fetchIssues({ resetSelected: true });
  }
}

async function initializeApp() {
  const stored = loadStoredState();
  if (stored) {
    state.draftEntries = stored.draftEntries;
    state.batchSpentOn = stored.batchSpentOn || daysAgoString(1);
    state.currentSource = stored.currentSource || { type: "mine" };
  } else {
    state.batchSpentOn = daysAgoString(1);
  }
  if (state.mobileActiveTab === "settings") {
    state.mobileActiveTab = "issues";
  }
  updateAboutInfo();
  await withLoading("初始化中...", async () => {
    await Promise.all([fetchActivities(), fetchSavedQueries(), fetchPhrases()]);
    if (
      state.currentSource.type === "query" &&
      !state.savedQueries.some((q) => q.query_id === state.currentSource.id)
    ) {
      state.currentSource = { type: "mine" };
    }
    await fetchIssues();
  });
  initMobileNav();
  renderAll();
}

elements.refreshButton.addEventListener("click", async () => {
  try {
    await withLoading("重新載入 issue 中...", () => fetchIssues({ resetSelected: false }));
    renderAll();
  } catch (error) {
    state.issueWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.filterDate.addEventListener("change", async (event) => {
  state.filterDate = event.target.value || "";
  try {
    await withLoading("套用篩選中...", () => fetchIssues({ resetSelected: false }));
    renderAll();
  } catch (error) {
    state.issueWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.filterClearDate.addEventListener("click", async () => {
  if (!state.filterDate) return;
  state.filterDate = "";
  try {
    await withLoading("套用篩選中...", () => fetchIssues({ resetSelected: false }));
    renderAll();
  } catch (error) {
    state.issueWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.filterSearch.addEventListener("input", (event) => {
  state.filterSearch = event.target.value || "";
  renderIssueList();
  updateButtons();
});

elements.selectAllButton.addEventListener("click", () => {
  for (const issue of filteredIssues()) {
    if (!isIssueInDrafts(issue.issue_id)) {
      upsertDraftEntry(issue.issue_id);
    }
  }
  renderAll();
});

elements.clearSelectionButton.addEventListener("click", () => {
  clearAllDrafts();
  renderAll();
});

for (const btn of document.querySelectorAll("#top-tabs [data-top-tab]")) {
  btn.addEventListener("click", async () => {
    const target = btn.dataset.topTab;
    const isSchedule = state.currentSource.type === "schedule";
    try {
      if (target === "schedule" && !isSchedule) {
        await switchSource({ type: "schedule" });
        state.mobileActiveTab = "schedule";
      } else if (target === "worklog" && isSchedule) {
        await switchSource({ type: "mine" });
        state.mobileActiveTab = "issues";
      }
    } catch (err) {
      state.issueWarnings = [err.message || String(err)];
      renderAll();
    }
  });
}

elements.settingsButton.addEventListener("click", () => openSettings());
elements.settingsModalClose.addEventListener("click", () => closeSettings());
elements.settingsModal.addEventListener("click", (e) => {
  if (e.target === elements.settingsModal) closeSettings();
});
for (const btn of elements.settingsModal.querySelectorAll("[data-settings-tab]")) {
  btn.addEventListener("click", () => {
    state.settingsTab = btn.dataset.settingsTab;
    applySettingsTab();
  });
}

elements.phraseAddButton.addEventListener("click", async () => {
  try {
    await withLoading("儲存常用語句中...", addOrUpdatePhrase);
    renderPhrasesDrawer();
    renderAlerts();
  } catch (error) {
    state.phrasesWarnings = [error.message || String(error)];
    renderAlerts();
  }
});

elements.phraseCancelButton.addEventListener("click", () => {
  resetPhraseForm();
});

elements.queryAddButton.addEventListener("click", async () => {
  try {
    await withLoading("加入 PJ 篩選器中...", addSavedQuery);
    renderSourceTabs();
    renderSourcesDrawer();
  } catch (error) {
    state.sourcesWarnings = [error.message || String(error)];
    renderAlerts();
  }
});

elements.commitButton.addEventListener("click", () => {
  openCommitModal();
});

elements.commitModalConfirm.addEventListener("click", async () => {
  const selectedDate = elements.commitModalDate.value;
  if (selectedDate !== state.batchSpentOn) {
    state.batchSpentOn = selectedDate;
    clearAllEntryPreviewState();
  }
  closeCommitModal();
  try {
    await withLoading("送出到 Redmine 中...", async () => {
      await previewEntries();
      const hasFieldErrors = state.draftEntries.some(
        (e) => Object.keys(e.errors || {}).length > 0
      );
      if (!state.previewToken || hasFieldErrors) {
        throw new Error("驗證未通過，請檢查欄位後再送出");
      }
      await commitEntries();
    });
    renderAll();
  } catch (error) {
    state.commitResults = [];
    state.previewWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.commitModalCancel.addEventListener("click", closeCommitModal);
elements.commitModalClose.addEventListener("click", closeCommitModal);
elements.commitModal.addEventListener("click", (e) => {
  if (e.target === elements.commitModal) closeCommitModal();
});
elements.commitModalDate.addEventListener("change", updateCommitModalDateWarn);
for (const btn of document.querySelectorAll("[data-modal-offset]")) {
  btn.addEventListener("click", (e) => {
    const offset = Number(e.currentTarget.dataset.modalOffset);
    elements.commitModalDate.value = daysAgoString(offset);
    updateCommitModalDateWarn();
  });
}

elements.batchSpentOn.addEventListener("change", (event) => {
  state.batchSpentOn = event.target.value;
  clearAllEntryPreviewState();
  renderAll();
});

for (const btn of document.querySelectorAll("[data-spent-on-offset]")) {
  btn.addEventListener("click", (event) => {
    const offset = Number(event.currentTarget.dataset.spentOnOffset);
    state.batchSpentOn = daysAgoString(offset);
    clearAllEntryPreviewState();
    renderAll();
  });
}

if (elements.scheduleApplyButton) {
  elements.scheduleApplyButton.addEventListener("click", async () => {
    try {
      await applyScheduleDates();
    } catch (error) {
      state.issueWarnings = [error.message || String(error)];
      renderAll();
    }
  });
}

if (elements.filterToggleButton) {
  elements.filterToggleButton.addEventListener("click", () => {
    state.filterExpanded = !state.filterExpanded;
    updateFilterBadge();
  });
}

applyTheme(loadTheme());

initializeApp().catch((error) => {
  state.issueWarnings = [error.message || String(error)];
  renderAll();
});
