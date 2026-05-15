const STORAGE_KEY = "lawpj.worklog.v1";
const APP_VERSION = "1.2.0";
const APP_BUILD_TIME = "2026-04-24";

const state = {
  localToday: localDateString(new Date()),
  currentSource: { type: "mine" },
  savedQueries: [],
  filterDate: "",
  filterSearch: "",
  sideView: "worklog",  // sidebar 切換的 view: worklog / schedule / phrases / sources / issue-templates / issue-batch
  issueTemplates: [],
  editingIssueTemplateId: null,
  issueTemplatesWarnings: [],
  projectsList: [],
  projectsLoaded: false,
  trackersList: [],
  trackersLoaded: false,
  batchProjectId: null,
  batchProjectInputValue: "",
  batchTrackerId: null,
  batchSelectedTemplateIds: new Set(),
  batchRows: [],
  batchResults: [],
  batchWarnings: [],
  batchPrereqLoading: false,
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
  issueTemplateDefaults: {},  // { [issue_id]: { hours, activity_id, comments } } inline snapshot
  openPhraseMenuFor: null,    // 目前打開哪個 entry 的 phrase menu (issue_id 或 null)
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
  theme: "light",
  scheduleCommitResults: [],
};

let dragContext = null;
const THEME_KEY = "lawpj.theme";

let lastFocusedEntryId = null;

const elements = {
  issueCount: document.getElementById("issue-count"),
  selectedCount: document.getElementById("selected-count"),
  sourceTabs: document.getElementById("source-tabs"),
  filterDate: document.getElementById("filter-date"),
  filterSearch: document.getElementById("filter-search"),
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
  issueTemplateSubjectInput: document.getElementById("issue-template-subject-input"),
  issueTemplateAddButton: document.getElementById("issue-template-add-button"),
  issueTemplateCancelButton: document.getElementById("issue-template-cancel-button"),
  batchEditBanner: document.getElementById("batch-edit-banner"),
  batchEditBannerSubject: document.getElementById("batch-edit-banner-subject"),
  batchEditBannerCancel: document.getElementById("batch-edit-banner-cancel"),
  batchProjectInput: document.getElementById("batch-project-input"),
  batchProjectsDatalist: document.getElementById("batch-projects-datalist"),
  batchProjectHint: document.getElementById("batch-project-hint"),
  batchTrackerSelect: document.getElementById("batch-tracker-select"),
  batchTemplatesPicker: document.getElementById("batch-templates-picker"),
  batchAddBlankRowButton: document.getElementById("batch-add-blank-row-button"),
  batchClearRowsButton: document.getElementById("batch-clear-rows-button"),
  batchRowsTbody: document.getElementById("batch-rows-tbody"),
  batchAlertStack: document.getElementById("batch-alert-stack"),
  batchSummary: document.getElementById("batch-summary"),
  batchCreateButton: document.getElementById("batch-create-button"),
  batchResultsList: document.getElementById("batch-results-list"),
  phrasesAlertStack: document.getElementById("phrases-alert-stack"),
  sourcesAlertStack: document.getElementById("sources-alert-stack"),
  inlineToolbarOffsetsInput: document.getElementById("inline-toolbar-offsets-input"),
  inlineToolbarOffsetsStatus: document.getElementById("inline-toolbar-offsets-status"),
  inlineDefaultPhraseSelect: document.getElementById("inline-default-phrase-select"),
  inlineDefaultPhraseStatus: document.getElementById("inline-default-phrase-status"),
  inlineToolsEnabledToggle: document.getElementById("inline-tools-enabled-toggle"),
  inlineToolsEnabledStatus: document.getElementById("inline-tools-enabled-status"),
};

/* ===== Toast：短暫操作反饋 (success / error / info)，自動消失 ============== */
function showToast(message, { type = "success", duration = 2500 } = {}) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fading");
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

/* ===== Confirm modal：取代 browser confirm()，回傳 Promise<boolean> ======== */
function showConfirmModal({ title = "確認操作", body = "確定要執行此操作嗎？", confirmText = "確認", cancelText = "取消", danger = true } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    if (!modal) { resolve(window.confirm(body)); return; }
    document.getElementById("confirm-modal-title").textContent = title;
    document.getElementById("confirm-modal-body").textContent = body;
    const confirmBtn = document.getElementById("confirm-modal-confirm");
    const cancelBtn = document.getElementById("confirm-modal-cancel");
    const closeBtn = document.getElementById("confirm-modal-close");
    confirmBtn.textContent = confirmText;
    confirmBtn.className = danger ? "danger-button" : "action-button";
    cancelBtn.textContent = cancelText;
    modal.hidden = false;
    modal.removeAttribute("aria-hidden");
    const cleanup = (val) => {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      closeBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(val);
    };
    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onBackdrop = (e) => { if (e.target === modal) cleanup(false); };
    const onKey = (e) => {
      if (e.key === "Escape") cleanup(false);
      else if (e.key === "Enter") cleanup(true);
    };
    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    closeBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
    confirmBtn.focus();
  });
}

/* ===== Helper: 按鈕 disabled 時動態設 title 解釋為何不可按 ================ */
function setBtnTitle(btn, text) {
  if (!btn) return;
  if (text) btn.title = text;
  else btn.removeAttribute("title");
}

/* ===== Empty state HTML helper（各 view 通用結構） ========================= */
function emptyStateHtml({ icon = "📋", title = "", hint = "" } = {}) {
  return `<div class="empty-state">
    ${icon ? `<div class="empty-state-icon" aria-hidden="true">${icon}</div>` : ""}
    ${title ? `<div class="empty-state-title">${escapeHtml(title)}</div>` : ""}
    ${hint ? `<div class="empty-state-hint">${escapeHtml(hint)}</div>` : ""}
  </div>`;
}

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
  if (source.type === "visited") return "近期查閱";
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
  // D5 guard: 只在 new entry 套用 default (snapshot)。Existing entry re-upsert
  // 保留 user 既有 fields (含手動修改)，避免 select-all 覆蓋手改值。
  if (existingIndex < 0) {
    const snap = state.issueTemplateDefaults[issueId];
    if (snap) applyPhraseFields(snap, nextEntry);
  }
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

async function fetchIssueTemplates() {
  const data = await fetchJson("/api/issue-templates");
  state.issueTemplates = data.templates || [];
}

async function fetchIssueTemplateDefaults() {
  const data = await fetchJson("/api/issue-template-defaults");
  state.issueTemplateDefaults = data.defaults || {};
}

async function fetchProjects() {
  const data = await fetchJson("/api/projects");
  state.projectsList = data.projects || [];
  state.projectsLoaded = true;
}

async function fetchTrackers() {
  const data = await fetchJson("/api/trackers");
  state.trackersList = data.trackers || [];
  state.trackersLoaded = true;
}

async function loadBatchPrerequisites() {
  if (state.batchPrereqLoading) return;
  if (state.projectsLoaded && state.trackersLoaded) return;
  state.batchPrereqLoading = true;
  try {
    const tasks = [];
    if (!state.projectsLoaded) tasks.push(fetchProjects());
    if (!state.trackersLoaded) tasks.push(fetchTrackers());
    await Promise.all(tasks);
    if (state.trackersLoaded && !state.batchTrackerId && state.trackersList.length === 1) {
      state.batchTrackerId = state.trackersList[0].id;
    }
  } finally {
    state.batchPrereqLoading = false;
  }
}

function buildIssuesUrl() {
  const params = new URLSearchParams();
  if (state.currentSource.type === "visited") {
    params.set("source", "visited");
    if (state.filterDate) params.set("date", state.filterDate);
  } else if (sourceUsesMineApi(state.currentSource)) {
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
  const start = performance.now();
  const data = await fetchJson(buildIssuesUrl());
  state.issues = data.issues || [];
  state.issueWarnings = data.warnings || [];
  if (!state.batchSpentOn) {
    state.batchSpentOn = daysAgoString(1);
  }
  // visited 純讀 GM 通常 <5ms，loading mask 還沒淡入就被關掉，使用者看不到刷新動畫。
  // 保證最小 300ms 可見時間，讓 spinner 至少完整跑一輪。
  if (state.currentSource.type === "visited") {
    const elapsed = performance.now() - start;
    if (elapsed < 300) {
      await new Promise((r) => setTimeout(r, 300 - elapsed));
    }
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
    { type: "visited", label: "近期查閱" },
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
  // 計算當前的 sidebar view：worklog / schedule / phrases / sources
  const isSchedule = state.currentSource.type === "schedule";
  const sideView = state.sideView ||
    (isSchedule ? "schedule" : "worklog");
  for (const btn of document.querySelectorAll("[data-side-view]")) {
    btn.classList.toggle("active", btn.dataset.sideView === sideView);
  }
  // schedule 共用 worklog view 容器（內部 renderTable / renderIssueList
  // 會依 currentSource 自動切換 schedule 排程 UI）
  const visibleView = sideView === "schedule" ? "worklog" : sideView;
  for (const v of document.querySelectorAll(".main-view")) {
    v.hidden = v.dataset.view !== visibleView;
  }
  // source-tabs 列只在「填寫工時」顯示
  const mainToolbar = document.getElementById("main-toolbar");
  if (mainToolbar) {
    mainToolbar.style.display = sideView === "worklog" ? "" : "none";
  }
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

  // 動態日期 filter label（mine/mine-grouped 顯示「更新日期」、visited 顯示「查閱日期」）
  const dateLabel = document.getElementById("date-filter-label");
  if (dateLabel) {
    dateLabel.textContent =
      state.currentSource.type === "visited" ? "查閱日期" : "更新日期";
  }
  // day-filter 快選按鈕 active 狀態
  for (const btn of document.querySelectorAll("[data-day-filter]")) {
    const offset = btn.dataset.dayFilter;
    const targetDate = offset === "" ? "" : daysAgoString(Number(offset));
    btn.classList.toggle("active", (state.filterDate || "") === targetDate);
  }

  if (state.currentSource.type === "schedule") {
    if (state.scheduleStage === "select") {
      renderScheduleSelectStage();
    } else {
      renderScheduleOrderingList();
    }
    return;
  }

  if (!state.issues.length) {
    const icon = state.currentSource.type === "visited" ? "🕒"
      : state.currentSource.type === "query" ? "🔍"
      : "📋";
    const hint = state.currentSource.type === "visited"
      ? "在 Redmine 點開任一 issue 頁面，userscript 會自動把它記進清單。"
      : "可以調整上方的更新日期，或切換到其他 PJ 篩選器。";
    elements.issueList.innerHTML = `<li>${emptyStateHtml({
      icon,
      title: "這個來源沒有符合條件的 issue",
      hint,
    })}</li>`;
    return;
  }

  if (state.currentSource.type === "mine-grouped") {
    renderGroupedIssueList(visible);
    return;
  }

  if (!visible.length) {
    elements.issueList.innerHTML = `<li>${emptyStateHtml({
      icon: "🔎",
      title: "搜尋條件下沒有符合的 issue",
      hint: "試著清空搜尋或調整關鍵字。",
    })}</li>`;
    return;
  }
  elements.issueList.innerHTML = visible.map((issue) => issueCardHtml(issue)).join("");
  bindIssueCheckboxes();
}

function renderAlerts() {
  // 主 alert-stack（worklog/schedule view 內）：issue/activity/preview 相關 + 送出結果
  const main = [];
  if (state.issueWarnings.length) {
    main.push(`<div class="alert warn">${state.issueWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.activityWarnings.length) {
    main.push(`<div class="alert warn">${state.activityWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.previewWarnings.length) {
    main.push(`<div class="alert warn">${state.previewWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.previewToken) {
    main.push("<div class=\"alert\">已完成預覽。若修改全域日期或任何欄位，必須重新預覽後才能送出。</div>");
  }
  if (state.commitResults.length) {
    main.push(renderResults());
  }
  if (state.scheduleCommitResults.length) {
    main.push(renderScheduleResults());
  }
  if (elements.alertStack) elements.alertStack.innerHTML = main.join("");

  // 分流到各 view 自己的 alert container；找不到容器則 fallback 推回主 stack
  const phrasesHtml = state.phrasesWarnings.length
    ? `<div class="alert warn">${state.phrasesWarnings.map(escapeHtml).join("<br>")}</div>` : "";
  if (elements.phrasesAlertStack) {
    elements.phrasesAlertStack.innerHTML = phrasesHtml;
  } else if (phrasesHtml && elements.alertStack) {
    elements.alertStack.insertAdjacentHTML("beforeend", phrasesHtml);
  }

  const sourcesHtml = state.sourcesWarnings.length
    ? `<div class="alert warn">${state.sourcesWarnings.map(escapeHtml).join("<br>")}</div>` : "";
  if (elements.sourcesAlertStack) {
    elements.sourcesAlertStack.innerHTML = sourcesHtml;
  } else if (sourcesHtml && elements.alertStack) {
    elements.alertStack.insertAdjacentHTML("beforeend", sourcesHtml);
  }
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
  const hasDefault = !!state.issueTemplateDefaults[entry.issue_id];
  const menuOpen = state.openPhraseMenuFor === entry.issue_id;

  const defaultStar = hasDefault
    ? `<span class="entry-default-star" title="此 issue 已設 default — 勾入時自動套用">⭐</span>`
    : "";

  const phraseOptions = renderPhraseMenu(entry.issue_id, menuOpen, hasDefault);

  return `
    <tbody data-entry-row="${entry.issue_id}" class="${isFocused ? "row-focused" : ""}">
      <tr class="entry-issue-row">
        <td colspan="5">
          <div class="entry-title-row">
            <div class="entry-title-text">
              <span class="entry-issue-id">#${entry.issue_id}</span>
              ${defaultStar}
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
          <div class="hours-stepper">
            <button type="button" class="stepper-btn" data-hours-step="-0.5" data-issue-id="${entry.issue_id}" aria-label="減 0.5 小時">−</button>
            <input class="hours-input" type="number" step="0.5" min="0" max="24" value="${escapeHtml(entry.hours || "")}" data-row-field="hours" data-issue-id="${entry.issue_id}" placeholder="1.5">
            <button type="button" class="stepper-btn" data-hours-step="0.5" data-issue-id="${entry.issue_id}" aria-label="加 0.5 小時">+</button>
          </div>
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

  // Phrase menu: toggle popup open/close
  for (const btn of elements.tableWrap.querySelectorAll("[data-phrase-menu-toggle]")) {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const issueId = Number(event.currentTarget.dataset.issueId);
      state.openPhraseMenuFor = state.openPhraseMenuFor === issueId ? null : issueId;
      renderAll();
    });
  }
  // Phrase menu: apply phrase item
  for (const btn of elements.tableWrap.querySelectorAll("[data-phrase-apply]")) {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const phraseId = event.currentTarget.dataset.phraseApply;
      const issueId = Number(event.currentTarget.dataset.issueId);
      const entry = state.draftEntries.find((item) => item.issue_id === issueId);
      const phrase = state.phrases.find((p) => p.id === phraseId);
      if (!entry || !phrase) return;
      applyPhraseFields(phrase, entry);
      invalidatePreview(true);
      state.openPhraseMenuFor = null;
      renderAll();
    });
  }
  // Phrase menu: toggle default (set / remove)
  for (const btn of elements.tableWrap.querySelectorAll("[data-toggle-default]")) {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const issueId = Number(event.currentTarget.dataset.issueId);
      state.openPhraseMenuFor = null;
      try {
        await toggleIssueDefault(issueId);
      } catch (err) {
        showToast("操作失敗：" + (err.message || String(err)), { type: "error" });
      }
      renderAll();
    });
  }

  for (const btn of elements.tableWrap.querySelectorAll("[data-hours-step]")) {
    btn.addEventListener("click", (event) => {
      const issueId = Number(event.currentTarget.dataset.issueId);
      const step = parseFloat(event.currentTarget.dataset.hoursStep);
      const entry = state.draftEntries.find((item) => item.issue_id === issueId);
      if (!entry) return;
      const current = parseFloat(entry.hours) || 0;
      let next = Math.max(0, Math.min(24, current + step));
      next = Math.round(next * 10) / 10;
      entry.hours = next === 0 ? "" : String(next);
      clearEntryPreviewState(entry);
      invalidatePreview(true);
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
  const batchLabel = document.getElementById("batch-spent-on-label");
  if (batchLabel) batchLabel.textContent = isSchedule ? "開始排程日期" : "工時日期";
  const quickBtns = document.getElementById("date-quick-buttons");
  if (quickBtns) quickBtns.style.display = isSchedule ? "none" : "";
  elements.refreshButton.disabled = state.isLoading;
  setBtnTitle(elements.refreshButton, state.isLoading && "載入中，請稍候");
  elements.selectAllButton.disabled = isSchedule || state.isLoading || filteredIssues().length === 0;
  setBtnTitle(elements.selectAllButton,
    isSchedule ? "排程模式不支援全選"
    : state.isLoading ? "載入中，請稍候"
    : filteredIssues().length === 0 ? "目前沒有符合條件的 issue 可選"
    : null);
  elements.clearSelectionButton.disabled = state.isLoading || selectedCount() === 0;
  setBtnTitle(elements.clearSelectionButton,
    state.isLoading ? "載入中，請稍候"
    : selectedCount() === 0 ? "尚未勾選任何 issue"
    : null);
  elements.commitButton.disabled = isSchedule || state.isLoading || selectedValidRows().length === 0 || !state.batchSpentOn;
  setBtnTitle(elements.commitButton,
    isSchedule ? "排程模式不可送出工時"
    : state.isLoading ? "載入中，請稍候"
    : !state.batchSpentOn ? "請先選擇工時日期"
    : selectedValidRows().length === 0 ? "請先勾選至少一筆 issue 並填工時"
    : null);
  if (elements.scheduleApplyButton) {
    setBtnTitle(elements.scheduleApplyButton,
      state.isLoading ? "載入中，請稍候"
      : !isArrange ? "請先進入 Step 2 排程階段"
      : null);
  }
  elements.filterDate.disabled = state.isLoading;
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
    const startText = state.batchSpentOn || "請先設定開始排程日期";
    elements.workbenchSummary.textContent = `自 ${startText} 起連續十個工作日，每日上限 ${state.dailyHourLimit}h`;
    elements.tableWrap.innerHTML = `
      <div class="schedule-back-row">
        <button class="ghost-button schedule-back-button" id="schedule-back-button" type="button">← 重新選擇 Project</button>
      </div>
      ${renderScheduleGantt()}
    `;
    document.getElementById("schedule-back-button")?.addEventListener("click", () => {
      state.scheduleStage = "select";
      renderAll();
    });
    return;
  }
  if (state.draftEntries.length === 0) {
    elements.workbenchSummary.textContent = "先從左側勾選要補登工時的 issue。";
    elements.tableWrap.innerHTML = emptyStateHtml({
      icon: "📋",
      title: "尚未勾選任何 issue",
      hint: "← 從左側清單勾選 issue 後，這裡會顯示批次工時表單。每列右上角可快速套用工時模板。",
    });
    return;
  }

  elements.workbenchSummary.textContent = `已選 ${state.draftEntries.length} 筆 issue · 工時日期：${state.batchSpentOn || "未設定"}`;
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

function workingDays(minCount = 10, baseDateStr) {
  // baseDateStr (YYYY-MM-DD) = schedule base day. If omitted, fall back to
  // state.batchSpentOn or today's Monday (legacy behaviour).
  let start;
  if (baseDateStr) {
    const [y, m, d] = baseDateStr.split("-").map(Number);
    start = new Date(y, (m || 1) - 1, d || 1);
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    start = new Date(today);
    start.setDate(today.getDate() - daysFromMonday);
  }
  const days = [];
  const cursor = new Date(start);
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
  const days = workingDays(daysNeeded, state.batchSpentOn);
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
    elements.issueList.innerHTML = `<li>${emptyStateHtml({
      icon: "📅",
      title: "沒有可排程的 project",
      hint: "先確認「我的 issue」分頁有資料（自己被指派的進行中 issue）。",
    })}</li>`;
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
      <li>${emptyStateHtml({
        icon: "📅",
        title: "沒有已勾選的 project",
        hint: "請回到 Step 1 重新選擇要排程的 project。",
      })}</li>
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
    showToast("目前沒有排入工時的 issue，無法送出", { type: "error" });
    return;
  }
  const preview = entries
    .map((e) => `  #${e.issue_id} ${e.subject}  ${e.start_date} → ${e.due_date}`)
    .join("\n");
  const ok = await showConfirmModal({
    title: "確認送出排程",
    body: `將更新 ${entries.length} 個 issue 的起迄日期：\n\n${preview}\n\n確定送出？`,
    confirmText: "送出",
    danger: false,
  });
  if (!ok) return;
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
    return emptyStateHtml({
      icon: "📅",
      title: "沒有需要排程的 issue",
      hint: "預算皆為 0 或還沒勾選任何 project。可回 Step 1 重選或在預算欄位填入時數。",
    });
  }
  return `<div class="gantt-days">${dayCards}</div>`;
}

// Plain-text 摘要給 dropdown menu item 用 (避免 HTML chips 在 button 內巢狀)
function phrasePresetSummary(phrase) {
  const parts = [];
  if (phrase.hours) parts.push(`${phrase.hours}h`);
  if (phrase.activity_id) {
    const activity = state.activities.find((a) => String(a.id) === String(phrase.activity_id));
    parts.push(activity ? activity.name : `activity ${phrase.activity_id}`);
  }
  if (phrase.comments) parts.push("有備註");
  return parts.join(" · ");
}

function renderPhraseMenu(issueId, isOpen, hasDefault) {
  const buttonAttrs = `data-phrase-menu-toggle data-issue-id="${issueId}" aria-haspopup="true" aria-expanded="${isOpen}"`;
  const popup = isOpen ? `
    <div class="phrase-menu-popup" role="menu" data-phrase-menu-popup data-issue-id="${issueId}">
      ${state.phrases.length ? `
        <div class="phrase-menu-section-label">套用模板</div>
        ${state.phrases.map((p) => `
          <button class="phrase-menu-item" role="menuitem" type="button" data-phrase-apply="${escapeHtml(p.id)}" data-issue-id="${issueId}">
            ${escapeHtml(p.label || "(未命名)")}
            ${phrasePresetSummary(p) ? `<small>${escapeHtml(phrasePresetSummary(p))}</small>` : ""}
          </button>
        `).join("")}
        <div class="phrase-menu-divider"></div>
      ` : `<div class="phrase-menu-empty">尚未建立工時模板 — 在「工時模板」view 新增</div>`}
      <button class="phrase-menu-item phrase-menu-default-toggle" role="menuitem" type="button" data-toggle-default data-issue-id="${issueId}">
        ${hasDefault ? "⭐ 移除此 issue 的 default" : "⭐ 用目前值設為此 issue 的 default"}
      </button>
    </div>
  ` : "";
  return `
    <div class="phrase-menu-wrap" data-phrase-menu data-issue-id="${issueId}">
      <button class="phrase-menu-button" type="button" ${buttonAttrs} title="快速填入或設 default">
        <span class="phrase-menu-label">快速填入</span>
        <span class="phrase-menu-arrow" aria-hidden="true">▾</span>
      </button>
      ${popup}
    </div>
  `;
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
    elements.phrasesList.innerHTML = emptyStateHtml({
      icon: "✏️",
      title: "還沒有工時模板",
      hint: "用上方表單建立常用的時數 / 活動 / 備註組合，之後在每筆工時卡片右上角的「快速填入」下拉一鍵套用。",
    });
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
      const phrase = state.phrases.find((p) => p.id === phraseId);
      const name = phrase?.label || phrase?.comments?.slice(0, 30) || "此模板";
      const ok = await showConfirmModal({
        title: "刪除工時模板",
        body: `確定要刪除「${name}」嗎？\n此操作無法復原。`,
        confirmText: "刪除",
        danger: true,
      });
      if (!ok) return;
      try {
        await withLoading("刪除工時模板中...", () => deletePhraseById(phraseId));
        showToast("已刪除工時模板");
        renderAll();  // 整體刷新，entry 下拉同步少這筆
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
  elements.phraseAddButton.textContent = "儲存模板";
  elements.phraseCancelButton.style.display = "none";
}

// fields 可為 phrase 物件 ({id, label, hours, activity_id, comments}) 或
// inline snapshot ({hours, activity_id, comments}) — 只讀三個欄位，duck-typed。
function applyPhraseFields(fields, entry) {
  if (fields.hours) entry.hours = fields.hours;
  if (fields.activity_id) entry.activity_id = fields.activity_id;
  if (fields.comments) entry.comments = fields.comments;
  clearEntryPreviewState(entry);
}

// Toggle per-issue default：有就刪、沒就用 entry 當下 hours/activity/comments 設定快照。
async function toggleIssueDefault(issueId) {
  const existing = state.issueTemplateDefaults[issueId];
  if (existing) {
    await fetchJson(`/api/issue-template-defaults/${encodeURIComponent(issueId)}`, { method: "DELETE" });
    delete state.issueTemplateDefaults[issueId];
    showToast("已移除此 issue 的 default");
    return;
  }
  const entry = state.draftEntries.find((item) => item.issue_id === issueId);
  if (!entry) {
    showToast("找不到對應 entry，無法設 default", { type: "error" });
    return;
  }
  const snap = {
    hours: entry.hours || "",
    activity_id: entry.activity_id || "",
    comments: entry.comments || "",
  };
  if (!snap.hours && !snap.activity_id && !snap.comments) {
    showToast("entry 尚未填值，無法設為 default", { type: "error" });
    return;
  }
  const data = await fetchJson(`/api/issue-template-defaults/${encodeURIComponent(issueId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snap),
  });
  state.issueTemplateDefaults[issueId] = data.snapshot || snap;
  showToast("已設為此 issue 的 default — 下次勾入會自動套用");
}

function renderSourcesDrawer() {
  if (!state.savedQueries.length) {
    elements.savedQueriesList.innerHTML = emptyStateHtml({
      icon: "🔍",
      title: "尚未加入任何 PJ 篩選器",
      hint: "先去 Redmine 建立自訂查詢，從網址 ?query_id=X 抓 ID 與顯示名稱填進上方表單。",
    });
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
      const target = state.savedQueries.find((q) => q.query_id === qid);
      const name = target?.name || `#${qid}`;
      const ok = await showConfirmModal({
        title: "移除 PJ 篩選器",
        body: `確定要移除「${name}」嗎？此操作只會從工具裡拿掉，不會影響 Redmine 本身的查詢。`,
        confirmText: "移除",
        danger: true,
      });
      if (!ok) return;
      try {
        await withLoading("移除 PJ 篩選器...", () => removeSavedQuery(qid));
        showToast("已移除 PJ 篩選器");
        renderAll();  // source-tabs 與 saved-queries-list 同步刷新
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

function initThemeButtons() {
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
  if (state.sideView === "phrases") renderPhrasesDrawer();
  if (state.sideView === "inline-tools") renderInlineToolsView();
  if (state.sideView === "sources") renderSourcesDrawer();
  if (state.sideView === "issue-batch") renderIssueBatchView();
  renderLoadingMask();
  updateButtons();
  updateDailyTotalBadge();
  updateSettingsTheme();
  persistState();
}

let __batchRowUidCounter = 1;
function nextBatchRowUid() { return "br-" + (__batchRowUidCounter++); }

function makeBatchRow(subject = "", templateId = null) {
  return {
    uid: nextBatchRowUid(),
    subject: subject || "",
    estimated_hours: "",
    start_date: "",
    due_date: "",
    templateId,
  };
}

function startEditIssueTemplate(id) {
  const tpl = state.issueTemplates.find((t) => t.id === id);
  if (!tpl) return;
  state.editingIssueTemplateId = id;
  elements.issueTemplateSubjectInput.value = tpl.subject;
  elements.issueTemplateAddButton.textContent = "儲存修改";
  elements.issueTemplateCancelButton.style.display = "";
  elements.issueTemplateSubjectInput.focus();
  renderBatchTemplatesPicker();
}

function resetIssueTemplateForm() {
  state.editingIssueTemplateId = null;
  elements.issueTemplateSubjectInput.value = "";
  elements.issueTemplateAddButton.textContent = "儲存模板";
  elements.issueTemplateCancelButton.style.display = "none";
  renderBatchTemplatesPicker();
}

async function addOrUpdateIssueTemplate() {
  const subject = elements.issueTemplateSubjectInput.value.trim();
  if (!subject) {
    state.issueTemplatesWarnings = ["Subject 不可為空。"];
    renderBatchAlerts();
    return;
  }
  const editingId = state.editingIssueTemplateId;
  if (editingId) {
    const data = await fetchJson(`/api/issue-templates/${encodeURIComponent(editingId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    });
    const idx = state.issueTemplates.findIndex((t) => t.id === editingId);
    if (idx >= 0) state.issueTemplates[idx] = data.template;
  } else {
    const data = await fetchJson("/api/issue-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    });
    state.issueTemplates.push(data.template);
  }
  state.issueTemplatesWarnings = [];
  resetIssueTemplateForm();
}

async function deleteIssueTemplateById(id) {
  await fetchJson(`/api/issue-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
  state.issueTemplates = state.issueTemplates.filter((t) => t.id !== id);
  state.batchSelectedTemplateIds.delete(id);
}

/* ===== Inline 工具 view（toolbar offsets + 預設工時模板） ================= */
let __inlineToolsHandlersBound = false;

function renderInlineToolsView() {
  if (!elements.inlineToolbarOffsetsInput) return;

  // 0. Enabled toggle：從 Store 載入當前 checked 狀態（每次切到 view 都同步）
  if (elements.inlineToolsEnabledToggle) {
    const enabled = Store.get("inline_tools_enabled", true) !== false;
    elements.inlineToolsEnabledToggle.checked = enabled;
  }

  // 1. Toolbar offsets：從 Store 載入
  let offsets = Store.get("inline_toolbar_offsets", [0, 1, 3]);
  if (!Array.isArray(offsets)) offsets = [0, 1, 3];
  elements.inlineToolbarOffsetsInput.value = offsets.join(",");

  // 2. Phrase select：列出 state.phrases，selected based on Store
  const currentPhraseId = String(Store.get("inline_default_phrase_id", ""));
  const phrasesHtml = [`<option value="">(無 — 不預填，每次手動填)</option>`]
    .concat(
      state.phrases.map((p) => {
        const label = p.label || `(未命名 - ${p.id.slice(0, 6)})`;
        const summary = phrasePresetSummary(p);
        const display = summary ? `${label}  ·  ${summary}` : label;
        const selected = p.id === currentPhraseId ? " selected" : "";
        return `<option value="${escapeHtml(p.id)}"${selected}>${escapeHtml(display)}</option>`;
      })
    )
    .join("");
  elements.inlineDefaultPhraseSelect.innerHTML = phrasesHtml;

  // 3. 綁定 handlers (只綁一次)
  if (__inlineToolsHandlersBound) return;
  __inlineToolsHandlersBound = true;

  // Toggle: persist + 立即 install/uninstall
  if (elements.inlineToolsEnabledToggle) {
    elements.inlineToolsEnabledToggle.addEventListener("change", () => {
      const v = elements.inlineToolsEnabledToggle.checked;
      Store.set("inline_tools_enabled", v);
      const status = elements.inlineToolsEnabledStatus;
      if (v) {
        if (typeof window.__worklog_installInlineTools === "function") {
          window.__worklog_installInlineTools();
        }
        if (status) status.textContent = "已啟用：當前 issue 頁立即注入；非 issue 頁需切到 issue 頁才會看到";
      } else {
        if (typeof window.__worklog_uninstallInlineTools === "function") {
          window.__worklog_uninstallInlineTools();
        }
        if (status) status.textContent = "已停用：已移除 quick-edit form 與 toolbar items";
      }
    });
  }

  const persistOffsets = () => {
    const raw = elements.inlineToolbarOffsetsInput.value || "";
    const parts = raw.split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 30)
      .map((n) => Math.floor(n));
    const deduped = Array.from(new Set(parts));
    const status = elements.inlineToolbarOffsetsStatus;
    if (!deduped.length) {
      if (status) status.textContent = "格式錯誤或全部無效，未儲存（請用 0,1,3 這種格式）";
      return;
    }
    Store.set("inline_toolbar_offsets", deduped);
    elements.inlineToolbarOffsetsInput.value = deduped.join(",");
    if (status) status.textContent = `已儲存：[${deduped.join(",")}]（下次重新整理 issue 頁生效）`;
  };
  elements.inlineToolbarOffsetsInput.addEventListener("change", persistOffsets);
  elements.inlineToolbarOffsetsInput.addEventListener("blur", persistOffsets);

  elements.inlineDefaultPhraseSelect.addEventListener("change", () => {
    const v = elements.inlineDefaultPhraseSelect.value || "";
    const status = elements.inlineDefaultPhraseStatus;
    if (v) {
      Store.set("inline_default_phrase_id", v);
      const phrase = state.phrases.find((p) => p.id === v);
      const name = phrase?.label || "(未命名模板)";
      if (status) status.textContent = `已儲存：預設套用「${name}」（下次開 mini modal 生效）`;
    } else {
      Store.del("inline_default_phrase_id");
      if (status) status.textContent = "已清除（不預填，每次手動填）";
    }
  });
}

function renderIssueBatchView() {
  if (!elements.batchProjectInput) return;
  renderBatchProjectsDatalist();
  renderBatchTrackerSelect();
  renderBatchTemplatesPicker();
  renderBatchRowsTable();
  renderBatchAlerts();
  renderBatchSummary();
  renderBatchResults();
}

function renderBatchProjectsDatalist() {
  const dl = elements.batchProjectsDatalist;
  if (!dl) return;
  dl.innerHTML = state.projectsList
    .map((p) => `<option value="${escapeHtml(p.name)}" data-id="${p.id}"></option>`)
    .join("");
  if (elements.batchProjectInput.value !== state.batchProjectInputValue) {
    elements.batchProjectInput.value = state.batchProjectInputValue || "";
  }
  syncBatchProjectHint();
}

function syncBatchProjectHint() {
  const hint = elements.batchProjectHint;
  if (!hint) return;
  if (!state.projectsLoaded) {
    hint.textContent = state.batchPrereqLoading ? "載入專案中…" : "";
    return;
  }
  const val = (state.batchProjectInputValue || "").trim();
  if (!val) { hint.textContent = `共 ${state.projectsList.length} 個可選專案`; return; }
  if (state.batchProjectId) {
    const p = state.projectsList.find((x) => x.id === state.batchProjectId);
    hint.textContent = p ? `已選 #${p.id}（${p.identifier}）` : "";
  } else {
    hint.textContent = "找不到符合的專案，請從清單挑選";
  }
}

function renderBatchTrackerSelect() {
  const sel = elements.batchTrackerSelect;
  if (!sel) return;
  if (!state.trackersLoaded) {
    sel.innerHTML = `<option value="">${state.batchPrereqLoading ? "載入 tracker 中…" : "（請先載入）"}</option>`;
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  const cur = state.batchTrackerId ? String(state.batchTrackerId) : "";
  const opts = [`<option value="">— 請選擇 —</option>`].concat(
    state.trackersList.map((t) => `<option value="${t.id}" ${String(t.id) === cur ? "selected" : ""}>${escapeHtml(t.name)}</option>`)
  );
  sel.innerHTML = opts.join("");
}

function updateBatchEditBanner() {
  const banner = elements.batchEditBanner;
  if (!banner) return;
  const editingId = state.editingIssueTemplateId;
  if (!editingId) {
    banner.hidden = true;
    return;
  }
  const tpl = state.issueTemplates.find((t) => t.id === editingId);
  if (elements.batchEditBannerSubject) {
    elements.batchEditBannerSubject.textContent = tpl ? tpl.subject : "";
  }
  banner.hidden = false;
}

function renderBatchTemplatesPicker() {
  const box = elements.batchTemplatesPicker;
  if (!box) {
    updateBatchEditBanner();
    return;
  }
  if (!state.issueTemplates.length) {
    box.innerHTML = `<div class="batch-empty-state">
      <div>尚未建立 issue 模板</div>
      <button type="button" class="ghost-button" id="batch-empty-add-cta">+ 新增第一個模板</button>
      <div class="muted">也可以略過模板，按下方「新增空白列」直接手動加列。</div>
    </div>`;
    const cta = box.querySelector("#batch-empty-add-cta");
    if (cta) {
      cta.addEventListener("click", () => {
        if (elements.issueTemplateSubjectInput) elements.issueTemplateSubjectInput.focus();
      });
    }
    updateBatchEditBanner();
    return;
  }
  const editingId = state.editingIssueTemplateId;
  box.innerHTML = state.issueTemplates.map((tpl) => {
    const checked = state.batchSelectedTemplateIds.has(tpl.id);
    const isEditing = editingId === tpl.id;
    return `
      <span class="batch-template-chip ${checked ? "checked" : ""} ${isEditing ? "editing" : ""}" data-tpl-id="${escapeHtml(tpl.id)}">
        <label class="batch-template-chip-toggle">
          <input type="checkbox" data-batch-template-toggle="${escapeHtml(tpl.id)}" ${checked ? "checked" : ""}>
          <span>${escapeHtml(tpl.subject)}</span>
        </label>
        <button class="batch-template-chip-action" title="編輯" data-edit-issue-template="${escapeHtml(tpl.id)}">✎</button>
        <button class="batch-template-chip-action" title="刪除" data-delete-issue-template="${escapeHtml(tpl.id)}">🗑</button>
      </span>
    `;
  }).join("");

  for (const cb of box.querySelectorAll("[data-batch-template-toggle]")) {
    cb.addEventListener("change", (e) => {
      const id = e.currentTarget.dataset.batchTemplateToggle;
      const wasAdded = e.currentTarget.checked;
      if (wasAdded) {
        state.batchSelectedTemplateIds.add(id);
        // 若還沒對應 row 才 push（避免重複勾選 → 重複觸發 → 重複加列）
        if (!state.batchRows.some((r) => r.templateId === id)) {
          const tpl = state.issueTemplates.find((t) => t.id === id);
          if (tpl) state.batchRows.push(makeBatchRow(tpl.subject, id));
        }
      } else {
        state.batchSelectedTemplateIds.delete(id);
        state.batchRows = state.batchRows.filter((r) => r.templateId !== id);
      }
      state.batchWarnings = [];
      renderBatchTemplatesPicker();
      renderBatchRowsTable();
      renderBatchSummary();
      renderBatchAlerts();
      // 套用模板加入新列後自動 scroll 到表格，讓使用者知道列已加入
      if (wasAdded) {
        requestAnimationFrame(() => {
          const tbl = document.getElementById("batch-rows-table");
          if (tbl) tbl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    });
  }
  for (const btn of box.querySelectorAll("[data-edit-issue-template]")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      startEditIssueTemplate(e.currentTarget.dataset.editIssueTemplate);
    });
  }
  for (const btn of box.querySelectorAll("[data-delete-issue-template]")) {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const tplId = e.currentTarget.dataset.deleteIssueTemplate;
      const tpl = state.issueTemplates.find((t) => t.id === tplId);
      const subj = tpl?.subject?.slice(0, 40) || "此模板";
      const ok = await showConfirmModal({
        title: "刪除 issue 模板",
        body: `確定要刪除「${subj}」嗎？\n此操作無法復原。`,
        confirmText: "刪除",
        danger: true,
      });
      if (!ok) return;
      try {
        await withLoading("刪除 issue 模板中...", () => deleteIssueTemplateById(tplId));
        showToast("已刪除 issue 模板");
        renderBatchTemplatesPicker();
      } catch (err) {
        state.issueTemplatesWarnings = [err.message || String(err)];
        renderBatchAlerts();
      }
    });
  }
  updateBatchEditBanner();
}

function renderBatchRowsTable() {
  const tbody = elements.batchRowsTbody;
  if (!tbody) return;
  if (!state.batchRows.length) {
    tbody.innerHTML = `<tr><td colspan="5">${emptyStateHtml({
      icon: "➕",
      title: "還沒有要建立的 issue",
      hint: "從上方勾選 issue 模板自動加入列，或按「新增空白列」直接手動加。",
    })}</td></tr>`;
    return;
  }
  tbody.innerHTML = state.batchRows.map((row) => `
    <tr data-batch-row-uid="${escapeHtml(row.uid)}">
      <td class="col-subject"><input type="text" data-batch-row-field="subject" value="${escapeHtml(row.subject)}" placeholder="subject"></td>
      <td class="col-hours">
        <div class="hours-stepper">
          <button type="button" class="stepper-btn" data-batch-row-step="-0.5" data-batch-row-uid="${escapeHtml(row.uid)}" aria-label="減 0.5 小時">−</button>
          <input class="hours-input" type="number" step="0.5" min="0" max="999" data-batch-row-field="estimated_hours" value="${escapeHtml(row.estimated_hours || "")}" placeholder="0">
          <button type="button" class="stepper-btn" data-batch-row-step="0.5" data-batch-row-uid="${escapeHtml(row.uid)}" aria-label="加 0.5 小時">＋</button>
        </div>
      </td>
      <td class="col-date"><input type="date" data-batch-row-field="start_date" value="${escapeHtml(row.start_date || "")}"></td>
      <td class="col-date"><input type="date" data-batch-row-field="due_date" value="${escapeHtml(row.due_date || "")}"></td>
      <td class="col-remove"><button class="danger-button" data-batch-row-remove="${escapeHtml(row.uid)}">刪除</button></td>
    </tr>
  `).join("");

  for (const inp of tbody.querySelectorAll("[data-batch-row-field]")) {
    inp.addEventListener("input", (e) => {
      const tr = e.currentTarget.closest("tr");
      const uid = tr && tr.dataset.batchRowUid;
      const field = e.currentTarget.dataset.batchRowField;
      const row = state.batchRows.find((r) => r.uid === uid);
      if (!row) return;
      row[field] = e.currentTarget.value;
      renderBatchSummary();
    });
  }
  for (const btn of tbody.querySelectorAll("[data-batch-row-step]")) {
    btn.addEventListener("click", (e) => {
      const uid = e.currentTarget.dataset.batchRowUid;
      const step = parseFloat(e.currentTarget.dataset.batchRowStep);
      const row = state.batchRows.find((r) => r.uid === uid);
      if (!row) return;
      const current = parseFloat(row.estimated_hours) || 0;
      let next = Math.max(0, current + step);
      next = Math.round(next * 10) / 10;
      row.estimated_hours = next === 0 ? "" : String(next);
      const tr = e.currentTarget.closest("tr");
      const input = tr && tr.querySelector('[data-batch-row-field="estimated_hours"]');
      if (input) input.value = row.estimated_hours;
      renderBatchSummary();
    });
  }
  for (const btn of tbody.querySelectorAll("[data-batch-row-remove]")) {
    btn.addEventListener("click", (e) => {
      const uid = e.currentTarget.dataset.batchRowRemove;
      const removed = state.batchRows.find((r) => r.uid === uid);
      state.batchRows = state.batchRows.filter((r) => r.uid !== uid);
      // 若此 row 是從某 template 來的，連動 uncheck chip
      if (removed && removed.templateId) {
        state.batchSelectedTemplateIds.delete(removed.templateId);
      }
      renderBatchTemplatesPicker();
      renderBatchRowsTable();
      renderBatchSummary();
    });
  }
}

function renderBatchAlerts() {
  const box = elements.batchAlertStack;
  if (!box) return;
  const warns = [
    ...(state.batchWarnings || []),
    ...(state.issueTemplatesWarnings || []),
  ];
  box.innerHTML = warns.length
    ? `<div class="alert warn">${warns.map(escapeHtml).join("<br>")}</div>`
    : "";
}

function renderBatchSummary() {
  const summary = elements.batchSummary;
  if (!summary) return;
  const n = state.batchRows.length;
  const projectName = (() => {
    const p = state.projectsList.find((x) => x.id === state.batchProjectId);
    return p ? p.name : "(未選)";
  })();
  const trackerName = (() => {
    const t = state.trackersList.find((x) => x.id === state.batchTrackerId);
    return t ? t.name : "(未選)";
  })();
  if (!n) {
    summary.textContent = "尚未加入任何列。";
    summary.classList.remove("has-rows");
    summary.classList.add("muted");
  } else {
    summary.textContent = `將在「${projectName}」以 tracker「${trackerName}」建立 ${n} 筆 issue。`;
    summary.classList.add("has-rows");
    summary.classList.remove("muted");
  }
  if (elements.batchCreateButton) {
    elements.batchCreateButton.textContent = n ? `建立 ${n} 筆 issue` : "建立";
    elements.batchCreateButton.disabled = !n;
  }
}

function renderBatchResults() {
  const box = elements.batchResultsList;
  if (!box) return;
  const results = state.batchResults || [];
  if (!results.length) { box.innerHTML = ""; return; }
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  const header = `<div class="muted">本次建立結果：✓ ${okCount} 筆成功 / ✗ ${failCount} 筆失敗</div>`;
  const items = results.map((r) => {
    if (r.ok) {
      return `<div class="batch-result-card ok">
        ✓ <strong>${escapeHtml(r.subject)}</strong>
        — <a href="${escapeHtml(r.issue_url || ("/issues/" + r.issue_id))}" target="_blank" rel="noopener">#${r.issue_id}</a>
      </div>`;
    }
    return `<div class="batch-result-card fail">
      ✗ <strong>${escapeHtml(r.subject || "(空 subject)")}</strong>
      — ${escapeHtml(r.error || "未知錯誤")}
    </div>`;
  }).join("");
  box.innerHTML = header + items;
}

async function submitBatchCreate() {
  state.batchWarnings = [];
  state.batchResults = [];
  if (!state.batchProjectId) {
    state.batchWarnings.push("請選擇 project。");
  }
  if (!state.batchTrackerId) {
    state.batchWarnings.push("請選擇 tracker。");
  }
  if (!state.batchRows.length) {
    state.batchWarnings.push("請至少加入一筆 issue。");
  }
  const emptySubjectCount = state.batchRows.filter((r) => !String(r.subject || "").trim()).length;
  if (emptySubjectCount) {
    state.batchWarnings.push(`有 ${emptySubjectCount} 列的 subject 為空，請填寫或刪除。`);
  }
  if (state.batchWarnings.length) {
    renderBatchAlerts();
    return;
  }
  const payload = {
    project_id: state.batchProjectId,
    tracker_id: state.batchTrackerId,
    rows: state.batchRows.map((r) => ({
      subject: String(r.subject || "").trim(),
      estimated_hours: r.estimated_hours,
      start_date: r.start_date,
      due_date: r.due_date,
    })),
  };
  const data = await fetchJson("/api/issues/batch-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  state.batchResults = data.results || [];
  const successUids = new Set();
  let okIdx = 0;
  for (const row of state.batchRows) {
    const r = state.batchResults[okIdx++];
    if (r && r.ok) {
      successUids.add(row.uid);
      // 成功送出 → 同時取消對應 chip 勾選
      if (row.templateId) state.batchSelectedTemplateIds.delete(row.templateId);
    }
  }
  state.batchRows = state.batchRows.filter((r) => !successUids.has(r.uid));
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

function loadStoreSettings() {
  const Store = window.__worklog_Store;
  if (!Store) return;
  const limit = Number(Store.get("daily_hour_limit", 6.5));
  if (Number.isFinite(limit) && limit >= 3 && limit <= 12) {
    state.dailyHourLimit = Math.round(limit * 2) / 2;
  }
}

function getDefaultSpentOnOffset() {
  const Store = window.__worklog_Store;
  if (!Store) return 1;
  const raw = Number(Store.get("default_spent_on_offset", 1));
  if (!Number.isFinite(raw) || raw < 0) return 1;
  return Math.min(Math.floor(raw), 30);
}

async function initializeApp() {
  loadStoreSettings();
  const stored = loadStoredState();
  const fallbackOffset = getDefaultSpentOnOffset();
  if (stored) {
    state.draftEntries = stored.draftEntries;
    state.batchSpentOn = stored.batchSpentOn || daysAgoString(fallbackOffset);
    state.currentSource = stored.currentSource || { type: "mine" };
  } else {
    state.batchSpentOn = daysAgoString(fallbackOffset);
  }
  updateAboutInfo();
  await withLoading("初始化中...", async () => {
    await Promise.all([fetchActivities(), fetchSavedQueries(), fetchPhrases(), fetchIssueTemplates(), fetchIssueTemplateDefaults()]);
    if (
      state.currentSource.type === "query" &&
      !state.savedQueries.some((q) => q.query_id === state.currentSource.id)
    ) {
      state.currentSource = { type: "mine" };
    }
    await fetchIssues();
  });
  initThemeButtons();
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

// Phrase menu: 點外部關閉 + ESC 關閉 (全域 listener 註冊一次)
document.addEventListener("click", (event) => {
  if (state.openPhraseMenuFor === null) return;
  if (event.target.closest && event.target.closest("[data-phrase-menu]")) return;
  state.openPhraseMenuFor = null;
  renderAll();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.openPhraseMenuFor !== null) {
    state.openPhraseMenuFor = null;
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

for (const btn of document.querySelectorAll("[data-side-view]")) {
  btn.addEventListener("click", async () => {
    const target = btn.dataset.sideView;
    state.sideView = target;
    const isSchedule = state.currentSource.type === "schedule";
    try {
      if (target === "schedule" && !isSchedule) {
        await switchSource({ type: "schedule" });
      } else if (target === "worklog" && isSchedule) {
        await switchSource({ type: "mine" });
      } else if (target === "issue-batch") {
        renderAll();
        if (!state.projectsLoaded || !state.trackersLoaded) {
          try {
            await withLoading("載入專案 / tracker 中...", loadBatchPrerequisites);
          } catch (e) {
            state.batchWarnings = ["載入專案 / tracker 失敗：" + (e.message || String(e))];
          }
          renderAll();
        }
      } else {
        // phrases / sources / issue-templates 純 view 切換，不動 source
        renderAll();
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
  const wasEditing = !!state.editingPhraseId;
  try {
    await withLoading("儲存工時模板中...", addOrUpdatePhrase);
    if (!state.phrasesWarnings.length) {
      showToast(wasEditing ? "已更新工時模板" : "已新增工時模板");
    }
    renderAll();  // 整體 re-render 讓 entry 下拉、phrases-list 同步
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
    if (!state.sourcesWarnings.length) showToast("已新增 PJ 篩選器");
    renderAll();  // source-tabs、saved-queries-list、view 都同步
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

// 統一的日期快選按鈕（mine / visited 共用）
for (const btn of document.querySelectorAll("[data-day-filter]")) {
  btn.addEventListener("click", async () => {
    const offset = btn.dataset.dayFilter;
    state.filterDate = offset === "" ? "" : daysAgoString(Number(offset));
    try {
      await withLoading("套用篩選中...", () => fetchIssues({ resetSelected: false }));
    } catch (err) {
      state.issueWarnings = [err.message || String(err)];
    }
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


if (elements.issueTemplateAddButton) {
  elements.issueTemplateAddButton.addEventListener("click", async () => {
    const wasEditing = !!state.editingIssueTemplateId;
    try {
      await withLoading("儲存 issue 模板中...", addOrUpdateIssueTemplate);
      if (!(state.issueTemplatesWarnings && state.issueTemplatesWarnings.length)) {
        showToast(wasEditing ? "已更新 issue 模板" : "已新增 issue 模板");
      }
      renderBatchTemplatesPicker();
      renderBatchAlerts();
    } catch (err) {
      state.issueTemplatesWarnings = [err.message || String(err)];
      renderBatchAlerts();
    }
  });
}
if (elements.issueTemplateCancelButton) {
  elements.issueTemplateCancelButton.addEventListener("click", () => {
    resetIssueTemplateForm();
  });
}
if (elements.batchEditBannerCancel) {
  elements.batchEditBannerCancel.addEventListener("click", () => {
    resetIssueTemplateForm();
  });
}
if (elements.issueTemplateSubjectInput) {
  elements.issueTemplateSubjectInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      elements.issueTemplateAddButton.click();
    }
  });
}

if (elements.batchProjectInput) {
  const matchProject = () => {
    const val = elements.batchProjectInput.value.trim();
    state.batchProjectInputValue = val;
    if (!val) { state.batchProjectId = null; syncBatchProjectHint(); return; }
    const exact = state.projectsList.find((p) => p.name === val);
    state.batchProjectId = exact ? exact.id : null;
    syncBatchProjectHint();
    renderBatchSummary();
  };
  elements.batchProjectInput.addEventListener("input", matchProject);
  elements.batchProjectInput.addEventListener("change", matchProject);
}
if (elements.batchTrackerSelect) {
  elements.batchTrackerSelect.addEventListener("change", (e) => {
    const v = Number(e.target.value);
    state.batchTrackerId = Number.isFinite(v) && v > 0 ? v : null;
    renderBatchSummary();
  });
}
if (elements.batchAddBlankRowButton) {
  elements.batchAddBlankRowButton.addEventListener("click", () => {
    state.batchRows.push(makeBatchRow());
    state.batchWarnings = [];
    renderBatchRowsTable();
    renderBatchSummary();
    renderBatchAlerts();
  });
}
if (elements.batchClearRowsButton) {
  elements.batchClearRowsButton.addEventListener("click", async () => {
    if (!state.batchRows.length) return;
    const ok = await showConfirmModal({
      title: "清空所有列",
      body: `確定要清空目前 ${state.batchRows.length} 列待建 issue？\n此操作無法復原。`,
      confirmText: "清空",
      danger: true,
    });
    if (!ok) return;
    state.batchRows = [];
    state.batchSelectedTemplateIds.clear();
    state.batchWarnings = [];
    renderBatchTemplatesPicker();
    renderBatchRowsTable();
    renderBatchSummary();
    renderBatchAlerts();
  });
}
if (elements.batchCreateButton) {
  elements.batchCreateButton.addEventListener("click", async () => {
    try {
      await withLoading("批次建立 issue 中...", submitBatchCreate);
      renderBatchTemplatesPicker();
      renderBatchAlerts();
      renderBatchRowsTable();
      renderBatchSummary();
      renderBatchResults();
    } catch (err) {
      state.batchWarnings = [err.message || String(err)];
      renderBatchAlerts();
    }
  });
}

// 給 settings-patch.js 設定即時生效用：worklog tab 改 daily_hour_limit 可立刻反映在 badge / summary
window.__worklog_applySettingChange = function (key, value) {
  if (key === "daily_hour_limit") {
    const v = Number(value);
    if (Number.isFinite(v) && v >= 3 && v <= 12) {
      state.dailyHourLimit = Math.round(v * 2) / 2;
      renderAll();
    }
  }
  // visit_retention_days 不需即時 mutate（下次 fetch issues source=visited 自動套用）
  // default_spent_on_offset 故意不即時改 state.batchSpentOn，避免 user 正在編輯時日期被覆蓋
};

applyTheme(loadTheme());

initializeApp().catch((error) => {
  state.issueWarnings = [error.message || String(error)];
  renderAll();
});
