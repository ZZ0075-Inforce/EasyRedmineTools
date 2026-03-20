const state = {
  issueSourceDate: "",
  targetDate: "",
  localToday: localDateString(new Date()),
  batchSpentOn: "",
  issues: [],
  selectedIssueIds: new Set(),
  draftEntries: [],
  previewToken: "",
  activities: [],
  manualActivityEntry: true,
  activityWarnings: [],
  issueWarnings: [],
  defaultsWarnings: [],
  previewWarnings: [],
  commitResults: [],
  issueDefaultsById: {},
  drawerDrafts: {},
  drawerOpen: false,
  isLoading: false,
  loadingMessage: "",
};

const elements = {
  apiStatus: document.getElementById("api-status"),
  activityStatus: document.getElementById("activity-status"),
  issueCount: document.getElementById("issue-count"),
  selectedCount: document.getElementById("selected-count"),
  sourceList: document.getElementById("source-list"),
  sourceDateInput: document.getElementById("source-date-input"),
  sourcePrevButton: document.getElementById("source-prev-button"),
  sourceNextButton: document.getElementById("source-next-button"),
  issueSummary: document.getElementById("issue-summary"),
  workbenchSummary: document.getElementById("workbench-summary"),
  issueList: document.getElementById("issue-list"),
  alertStack: document.getElementById("alert-stack"),
  tableWrap: document.getElementById("table-wrap"),
  refreshButton: document.getElementById("refresh-button"),
  selectAllButton: document.getElementById("select-all-button"),
  clearSelectionButton: document.getElementById("clear-selection-button"),
  defaultsButton: document.getElementById("defaults-button"),
  previewButton: document.getElementById("preview-button"),
  commitButton: document.getElementById("commit-button"),
  batchSpentOn: document.getElementById("batch-spent-on"),
  batchDateHelper: document.getElementById("batch-date-helper"),
  drawerBackdrop: document.getElementById("drawer-backdrop"),
  defaultsDrawer: document.getElementById("defaults-drawer"),
  drawerCloseButton: document.getElementById("drawer-close-button"),
  drawerSummary: document.getElementById("drawer-summary"),
  drawerList: document.getElementById("drawer-list"),
  loadingMask: document.getElementById("loading-mask"),
  loadingMessage: document.getElementById("loading-message"),
};

function localDateString(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(dateString, offsetDays) {
  const baseDate = new Date(`${dateString}T12:00:00`);
  baseDate.setDate(baseDate.getDate() + offsetDays);
  return localDateString(baseDate);
}

const emptyMergedDefault = () => ({
  issue_id: 0,
  hours: "",
  activity_id: "",
  comments: "",
  source: "none",
  has_shared: false,
  has_local_override: false,
});

const fmtDateTime = (value) => {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const subjectOf = (issue) =>
  issue.redmine?.subject || issue.page_titles?.[0] || `Issue #${issue.issue_id}`;

const defaultSourceLabel = (source) =>
  ({
    shared: "shared",
    local: "local",
    "local override": "local override",
    none: "none",
  }[source] || "none");

function issueById(issueId) {
  return state.issues.find((issue) => issue.issue_id === issueId);
}

function selectedCount() {
  return state.selectedIssueIds.size;
}

function mergedDefaultForIssue(issueId) {
  return state.issueDefaultsById[String(issueId)] || { ...emptyMergedDefault(), issue_id: issueId };
}

function drawerDraftForIssue(issueId) {
  if (!state.drawerDrafts[String(issueId)]) {
    const merged = mergedDefaultForIssue(issueId);
    state.drawerDrafts[String(issueId)] = {
      hours: merged.hours || "",
      activity_id: merged.activity_id || "",
      comments: merged.comments || "",
    };
  }
  return state.drawerDrafts[String(issueId)];
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
  const mergedDefault = mergedDefaultForIssue(issueId);
  return {
    issue_id: issueId,
    issue_subject: issue ? subjectOf(issue) : `Issue #${issueId}`,
    issue_url: issue?.issue_url || "",
    hours: mergedDefault.hours || "",
    activity_id: mergedDefault.activity_id || "",
    comments: mergedDefault.comments || "",
    selected: existing?.selected ?? true,
    errors: {},
    duplicate: false,
    duplicate_entries: [],
  };
}

function syncDrawerDrafts() {
  const drafts = {};
  for (const issue of state.issues) {
    const merged = mergedDefaultForIssue(issue.issue_id);
    drafts[String(issue.issue_id)] = {
      hours: merged.hours || "",
      activity_id: merged.activity_id || "",
      comments: merged.comments || "",
    };
  }
  state.drawerDrafts = drafts;
}

function rebuildDraftEntriesFromDefaults() {
  const previous = new Map(state.draftEntries.map((entry) => [entry.issue_id, entry]));
  state.draftEntries = Array.from(state.selectedIssueIds)
    .map((issueId) => buildDraftEntry(issueId, previous.get(issueId)))
    .sort((left, right) => left.issue_id - right.issue_id);
  invalidatePreview(true);
}

function upsertDraftEntryFromDefaults(issueId) {
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
  invalidatePreview(true);
}

function resetWorkbenchForSourceDateChange() {
  state.selectedIssueIds = new Set();
  state.draftEntries = [];
  state.issueDefaultsById = {};
  state.drawerDrafts = {};
  state.batchSpentOn = "";
  state.drawerOpen = false;
  state.defaultsWarnings = [];
  state.previewWarnings = [];
  state.commitResults = [];
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

async function fetchConfig() {
  const data = await fetchJson("/api/config");
  elements.apiStatus.textContent = data.redmine_api_enabled
    ? "已設定 API key，允許唯讀與二段式提交"
    : "未設定 API key，僅能唯讀";
  if (data.available_sources.length === 0) {
    elements.sourceList.textContent = "找不到可讀的瀏覽器歷史檔";
    return;
  }
  elements.sourceList.innerHTML = data.available_sources
    .map((source) => `<div><strong>${escapeHtml(source.name)}</strong><br><span class="muted">${escapeHtml(source.path)}</span></div>`)
    .join("");
}

async function fetchActivities() {
  const data = await fetchJson("/api/time-entry-activities");
  state.activities = data.activities || [];
  state.manualActivityEntry = Boolean(data.manual_entry);
  state.activityWarnings = data.warnings || [];
  elements.activityStatus.textContent = state.manualActivityEntry
    ? "改用手動輸入 activity_id"
    : `已載入 ${state.activities.length} 個活動選項`;
}

async function fetchIssueDefaults() {
  if (!state.issues.length) {
    state.issueDefaultsById = {};
    state.defaultsWarnings = [];
    state.drawerDrafts = {};
    return;
  }
  const issueIds = state.issues.map((issue) => issue.issue_id).join(",");
  const data = await fetchJson(`/api/issue-defaults?issue_ids=${encodeURIComponent(issueIds)}`);
  state.issueDefaultsById = data.defaults || {};
  state.defaultsWarnings = data.warnings || [];
  syncDrawerDrafts();
}

async function fetchIssues({ issueDate, resetSelection = false, resetBatchDate = false } = {}) {
  const requestedDate = issueDate || state.issueSourceDate || state.localToday;
  const data = await fetchJson(`/api/issues?date=${encodeURIComponent(requestedDate)}`);
  state.issues = data.issues || [];
  state.targetDate = data.target_date || requestedDate;
  state.issueSourceDate = state.targetDate;
  state.issueWarnings = data.diagnostics?.warnings || [];
  await fetchIssueDefaults();

  if (resetSelection) {
    state.selectedIssueIds = new Set();
    state.draftEntries = [];
  } else {
    state.selectedIssueIds = new Set(
      Array.from(state.selectedIssueIds).filter((issueId) => state.issues.some((issue) => issue.issue_id === issueId))
    );
    rebuildDraftEntriesFromDefaults();
  }

  if (resetBatchDate || !state.batchSpentOn) {
    state.batchSpentOn = state.targetDate || "";
  }
}

function renderIssueList() {
  elements.issueCount.textContent = `${state.issues.length} 筆`;
  elements.selectedCount.textContent = `${selectedCount()} 筆`;
  elements.issueSummary.textContent = state.targetDate
    ? `${state.targetDate} 看過的 issue，可勾選後建立批次工時表單`
    : "尚未載入 issue";

  if (state.issues.length === 0) {
    elements.issueList.innerHTML = `
      <li>
        <div class="empty-state">
          這一天沒有抓到符合條件的 issue 瀏覽紀錄。若你是用無痕模式或其他瀏覽器，歷史紀錄可能不會被讀到。
        </div>
      </li>
    `;
    return;
  }

  elements.issueList.innerHTML = state.issues
    .map((issue) => {
      const isSelected = state.selectedIssueIds.has(issue.issue_id);
      const redmine = issue.redmine || {};
      return `
        <li>
          <div class="issue-card ${isSelected ? "selected" : ""}">
            <label class="issue-select">
              <input class="issue-checkbox" type="checkbox" data-issue-id="${issue.issue_id}" ${isSelected ? "checked" : ""}>
              <span>
                <span class="issue-headline">
                  <span>#${issue.issue_id}</span>
                  <span>${escapeHtml(fmtDateTime(issue.last_visited_at))}</span>
                </span>
                <span class="issue-title">${escapeHtml(subjectOf(issue))}</span>
                <span class="tag-row">
                  <span class="tag">${issue.visit_count} 次瀏覽</span>
                  <span class="tag">${escapeHtml(issue.browser_sources.join(", "))}</span>
                  ${redmine.status ? `<span class="tag">${escapeHtml(redmine.status)}</span>` : ""}
                  ${redmine.project ? `<span class="tag">${escapeHtml(redmine.project)}</span>` : ""}
                </span>
              </span>
            </label>
          </div>
        </li>
      `;
    })
    .join("");

  for (const checkbox of elements.issueList.querySelectorAll("[data-issue-id]")) {
    checkbox.addEventListener("change", (event) => {
      const issueId = Number(event.target.dataset.issueId);
      if (event.target.checked) {
        state.selectedIssueIds.add(issueId);
        upsertDraftEntryFromDefaults(issueId);
      } else {
        state.selectedIssueIds.delete(issueId);
        removeDraftEntry(issueId);
      }
      renderAll();
    });
  }
}

function renderAlerts() {
  const alerts = [];
  if (state.issueWarnings.length) {
    alerts.push(`<div class="alert warn">${state.issueWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.activityWarnings.length) {
    alerts.push(`<div class="alert warn">${state.activityWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.defaultsWarnings.length) {
    alerts.push(`<div class="alert warn">${state.defaultsWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.previewWarnings.length) {
    alerts.push(`<div class="alert warn">${state.previewWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.previewToken) {
    alerts.push("<div class=\"alert\">已完成預覽。若修改全域日期、工時欄位或 Issue 預設，必須重新預覽後才能送出。</div>");
  }
  if (state.commitResults.length) {
    alerts.push(renderResults());
  }
  elements.alertStack.innerHTML = alerts.join("");
}

function activityFieldHtml(entry, datasetPrefix) {
  if (state.manualActivityEntry) {
    return `<input type="number" min="1" value="${escapeHtml(entry.activity_id || "")}" data-${datasetPrefix}-field="activity_id" data-issue-id="${entry.issue_id}" placeholder="activity_id">`;
  }
  return `
    <select data-${datasetPrefix}-field="activity_id" data-issue-id="${entry.issue_id}">
      <option value="">選擇活動</option>
      ${state.activities
        .map(
          (activity) => `
            <option value="${activity.id}" ${String(entry.activity_id || "") === String(activity.id) ? "selected" : ""}>
              ${escapeHtml(activity.name)}
            </option>
          `
        )
        .join("")}
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

  return `
    <tr>
      <td>
        <input type="checkbox" data-row-select data-issue-id="${entry.issue_id}" ${entry.selected ? "checked" : ""}>
      </td>
      <td>
        <strong>#${entry.issue_id} ${escapeHtml(issueLabel)}</strong>
        ${entry.issue_url ? `<div><a href="${escapeHtml(entry.issue_url)}" target="_blank" rel="noreferrer">打開 issue</a></div>` : ""}
      </td>
      <td>
        <input class="hours-input" type="number" step="0.1" min="0.1" value="${escapeHtml(entry.hours || "")}" data-row-field="hours" data-issue-id="${entry.issue_id}" placeholder="1.5">
      </td>
      <td>${activityFieldHtml(entry, "row")}</td>
      <td>
        <textarea data-row-field="comments" data-issue-id="${entry.issue_id}" placeholder="可留空">${escapeHtml(entry.comments || "")}</textarea>
      </td>
      <td>
        ${entry.duplicate ? '<div class="duplicate-chip">同 issue / 同日期已有工時，預設不勾選</div>' : ""}
        ${duplicateList ? `<ul class="duplicate-list">${duplicateList}</ul>` : ""}
        ${errors.length ? `<ul class="row-errors">${errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<span class="muted">尚未預覽或無錯誤</span>'}
      </td>
    </tr>
  `;
}

function bindTableEvents() {
  for (const field of elements.tableWrap.querySelectorAll("[data-row-field]")) {
    field.addEventListener("change", (event) => {
      const issueId = Number(event.target.dataset.issueId);
      const fieldName = event.target.dataset.rowField;
      const entry = state.draftEntries.find((item) => item.issue_id === issueId);
      if (!entry) {
        return;
      }
      entry[fieldName] = event.target.value;
      clearEntryPreviewState(entry);
      invalidatePreview(true);
      renderAll();
    });
  }

  for (const checkbox of elements.tableWrap.querySelectorAll("[data-row-select]")) {
    checkbox.addEventListener("change", (event) => {
      const issueId = Number(event.target.dataset.issueId);
      const entry = state.draftEntries.find((item) => item.issue_id === issueId);
      if (!entry) {
        return;
      }
      entry.selected = event.target.checked;
      updateButtons();
    });
  }
}

function selectedValidRows() {
  return state.draftEntries.filter((entry) => entry.selected && !Object.keys(entry.errors || {}).length);
}

function updateButtons() {
  const sourceDate = state.issueSourceDate || state.localToday;
  const isAtToday = sourceDate >= state.localToday;
  elements.sourceDateInput.value = sourceDate;
  elements.sourceDateInput.max = state.localToday;
  elements.sourceDateInput.disabled = state.isLoading;
  elements.sourcePrevButton.disabled = state.isLoading || !sourceDate;
  elements.sourceNextButton.disabled = state.isLoading || !sourceDate || isAtToday;
  elements.refreshButton.disabled = state.isLoading;
  elements.selectAllButton.disabled = state.isLoading || state.issues.length === 0;
  elements.clearSelectionButton.disabled = state.isLoading || selectedCount() === 0;
  elements.previewButton.disabled = state.isLoading || state.draftEntries.length === 0 || !state.batchSpentOn;
  elements.commitButton.disabled = state.isLoading || !state.previewToken || selectedValidRows().length === 0;
  elements.defaultsButton.disabled = state.isLoading || state.issues.length === 0;
  elements.drawerCloseButton.disabled = state.isLoading;
  elements.selectedCount.textContent = `${selectedCount()} 筆`;
  elements.batchSpentOn.value = state.batchSpentOn || "";
  elements.batchSpentOn.disabled = state.isLoading;
  elements.batchDateHelper.textContent = state.targetDate
    ? `切換 Issue Source 到 ${state.targetDate} 時，這個全域工時日期也會重設為同一天。`
    : "切換 Issue Source 日期時，這個全域工時日期會同步重設。";
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
                : "未送出";
            return `<li>Issue #${item.issue_id} / ${escapeHtml(item.spent_on)} : ${status}</li>`;
          })
          .join("")}
      </ul>
    </div>
  `;
}

function renderTable() {
  if (state.draftEntries.length === 0) {
    elements.workbenchSummary.textContent = "先從上方挑日期並勾選要補登工時的 issue。";
    elements.tableWrap.innerHTML = `
      <div class="empty-state">
        這裡會顯示批次工時表單。你可以先勾選多筆 issue，再逐列填寫時數、活動與備註；工時日期則在上方統一設定。
      </div>
    `;
    return;
  }

  elements.workbenchSummary.textContent = `已選 ${state.draftEntries.length} 筆 issue。這批工時日期會套用到全部列：${state.batchSpentOn || "未設定"}`;
  elements.tableWrap.innerHTML = `
    <table>
      <colgroup>
        <col class="col-send">
        <col>
        <col class="col-hours">
        <col class="col-activity">
        <col class="col-comments">
        <col class="col-check">
      </colgroup>
      <thead>
        <tr>
          <th>送出</th>
          <th>Issue</th>
          <th>時數</th>
          <th>活動</th>
          <th>備註</th>
          <th>檢查結果</th>
        </tr>
      </thead>
      <tbody>
        ${state.draftEntries.map((entry) => renderRow(entry)).join("")}
      </tbody>
    </table>
  `;
  bindTableEvents();
}

function renderDrawer() {
  elements.defaultsDrawer.classList.toggle("open", state.drawerOpen);
  elements.drawerBackdrop.classList.toggle("open", state.drawerOpen);
  elements.defaultsDrawer.setAttribute("aria-hidden", state.drawerOpen ? "false" : "true");
  elements.drawerSummary.innerHTML = `
    這裡只管理目前 Issue Source 清單中的 issue。儲存後只會改 <code>issue_defaults.local.json</code>，
    若同一筆也存在共享檔，畫面會標示為 <code>local override</code>。
  `;

  if (!state.issues.length) {
    elements.drawerList.innerHTML = `
      <div class="empty-state">
        先載入 Issue Source，抽屜才會列出可設定預設值的 issue。
      </div>
    `;
    return;
  }

  elements.drawerList.innerHTML = state.issues
    .map((issue) => {
      const mergedDefault = mergedDefaultForIssue(issue.issue_id);
      const draft = drawerDraftForIssue(issue.issue_id);
      return `
        <section class="default-card">
          <div class="default-head">
            <div>
              <h3 class="default-title">#${issue.issue_id} ${escapeHtml(subjectOf(issue))}</h3>
              <span class="source-chip">來源: ${escapeHtml(defaultSourceLabel(mergedDefault.source))}</span>
            </div>
            <div class="muted">${state.selectedIssueIds.has(issue.issue_id) ? "已在 Batch Worklog" : "尚未加入 Batch Worklog"}</div>
          </div>
          <div class="default-grid">
            <label class="default-field">
              <span>時數</span>
              <input class="hours-input" type="number" step="0.1" min="0.1" value="${escapeHtml(draft.hours || "")}" data-default-field="hours" data-issue-id="${issue.issue_id}" placeholder="1.0">
            </label>
            <label class="default-field">
              <span>活動</span>
              ${activityFieldHtml({ issue_id: issue.issue_id, activity_id: draft.activity_id || "" }, "default")}
            </label>
            <label class="default-field full">
              <span>備註</span>
              <textarea data-default-field="comments" data-issue-id="${issue.issue_id}" placeholder="可留空">${escapeHtml(draft.comments || "")}</textarea>
            </label>
          </div>
          <div class="default-actions">
            <div class="batch-meta-actions">
              <button class="action-button" data-save-default data-issue-id="${issue.issue_id}" ${state.isLoading ? "disabled" : ""}>儲存個人覆蓋</button>
              <button class="ghost-button" data-delete-default data-issue-id="${issue.issue_id}" ${(mergedDefault.has_local_override && !state.isLoading) ? "" : "disabled"}>清除個人覆蓋</button>
            </div>
            <div class="muted">shared: ${mergedDefault.has_shared ? "yes" : "no"} / local: ${mergedDefault.has_local_override ? "yes" : "no"}</div>
          </div>
        </section>
      `;
    })
    .join("");

  bindDrawerEvents();
}

function renderAll() {
  renderIssueList();
  renderAlerts();
  renderTable();
  renderDrawer();
  renderLoadingMask();
  updateButtons();
}

function bindDrawerEvents() {
  for (const field of elements.drawerList.querySelectorAll("[data-default-field]")) {
    field.addEventListener("change", (event) => {
      const issueId = String(event.target.dataset.issueId);
      const fieldName = event.target.dataset.defaultField;
      const draft = drawerDraftForIssue(issueId);
      draft[fieldName] = event.target.value;
    });
  }

  for (const button of elements.drawerList.querySelectorAll("[data-save-default]")) {
    button.addEventListener("click", async (event) => {
      const issueId = Number(event.target.dataset.issueId);
      try {
        await withLoading("儲存 Issue 預設中...", () => saveIssueDefault(issueId));
        renderAll();
      } catch (error) {
        state.defaultsWarnings = [error.message || String(error)];
        renderAll();
      }
    });
  }

  for (const button of elements.drawerList.querySelectorAll("[data-delete-default]")) {
    button.addEventListener("click", async (event) => {
      const issueId = Number(event.target.dataset.issueId);
      try {
        await withLoading("清除 Issue 預設中...", () => deleteIssueDefault(issueId));
        renderAll();
      } catch (error) {
        state.defaultsWarnings = [error.message || String(error)];
        renderAll();
      }
    });
  }
}

async function previewEntries() {
  if (!state.draftEntries.length) {
    return;
  }
  const data = await fetchJson("/api/time-entries/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      spent_on: state.batchSpentOn,
      entries: state.draftEntries,
    }),
  });
  state.previewToken = data.preview_token || "";
  state.previewWarnings = data.warnings || [];
  state.commitResults = [];
  state.batchSpentOn = data.spent_on || state.batchSpentOn;
  state.draftEntries = data.entries || [];
}

async function commitEntries() {
  if (!state.previewToken) {
    return;
  }
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
}

async function saveIssueDefault(issueId) {
  const draft = drawerDraftForIssue(issueId);
  const data = await fetchJson(`/api/issue-defaults/${issueId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  state.issueDefaultsById[String(issueId)] = data.default || { ...emptyMergedDefault(), issue_id: issueId };
  state.drawerDrafts[String(issueId)] = {
    hours: state.issueDefaultsById[String(issueId)].hours || "",
    activity_id: state.issueDefaultsById[String(issueId)].activity_id || "",
    comments: state.issueDefaultsById[String(issueId)].comments || "",
  };
  if (state.selectedIssueIds.has(issueId)) {
    upsertDraftEntryFromDefaults(issueId);
  }
  state.defaultsWarnings = [];
}

async function deleteIssueDefault(issueId) {
  const data = await fetchJson(`/api/issue-defaults/${issueId}`, {
    method: "DELETE",
  });
  state.issueDefaultsById[String(issueId)] = data.default || { ...emptyMergedDefault(), issue_id: issueId };
  state.drawerDrafts[String(issueId)] = {
    hours: state.issueDefaultsById[String(issueId)].hours || "",
    activity_id: state.issueDefaultsById[String(issueId)].activity_id || "",
    comments: state.issueDefaultsById[String(issueId)].comments || "",
  };
  if (state.selectedIssueIds.has(issueId)) {
    upsertDraftEntryFromDefaults(issueId);
  }
  state.defaultsWarnings = [];
}

function normalizedSourceDate(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return "";
  }
  return value > state.localToday ? state.localToday : value;
}

async function changeIssueSourceDate(nextDate) {
  const normalizedDate = normalizedSourceDate(nextDate);
  if (!normalizedDate) {
    return;
  }
  resetWorkbenchForSourceDateChange();
  state.issueSourceDate = normalizedDate;
  await withLoading("載入 issue 中...", async () => {
    await fetchIssues({ issueDate: normalizedDate, resetSelection: true, resetBatchDate: true });
  });
  renderAll();
}

async function reloadIssueSource() {
  const currentDate = normalizedSourceDate(state.issueSourceDate || state.localToday);
  await withLoading("載入 issue 中...", async () => {
    await fetchIssues({ issueDate: currentDate, resetSelection: false, resetBatchDate: false });
  });
  renderAll();
}

async function initializeApp() {
  state.issueSourceDate = state.localToday;
  await withLoading("載入 issue 中...", async () => {
    await Promise.all([fetchConfig(), fetchActivities()]);
    await fetchIssues({ issueDate: state.localToday, resetSelection: true, resetBatchDate: true });
  });
  renderAll();
}

elements.refreshButton.addEventListener("click", async () => {
  try {
    await reloadIssueSource();
  } catch (error) {
    state.issueWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.sourcePrevButton.addEventListener("click", async () => {
  try {
    await changeIssueSourceDate(shiftDate(state.issueSourceDate || state.localToday, -1));
  } catch (error) {
    state.issueWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.sourceNextButton.addEventListener("click", async () => {
  try {
    await changeIssueSourceDate(shiftDate(state.issueSourceDate || state.localToday, 1));
  } catch (error) {
    state.issueWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.sourceDateInput.addEventListener("change", async (event) => {
  try {
    await changeIssueSourceDate(event.target.value);
  } catch (error) {
    state.issueWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.selectAllButton.addEventListener("click", () => {
  for (const issue of state.issues) {
    if (!state.selectedIssueIds.has(issue.issue_id)) {
      state.selectedIssueIds.add(issue.issue_id);
      upsertDraftEntryFromDefaults(issue.issue_id);
    }
  }
  renderAll();
});

elements.clearSelectionButton.addEventListener("click", () => {
  state.selectedIssueIds = new Set();
  state.draftEntries = [];
  invalidatePreview(true);
  renderAll();
});

elements.defaultsButton.addEventListener("click", () => {
  state.drawerOpen = true;
  renderDrawer();
  updateButtons();
});

elements.drawerCloseButton.addEventListener("click", () => {
  state.drawerOpen = false;
  renderDrawer();
  updateButtons();
});

elements.drawerBackdrop.addEventListener("click", () => {
  state.drawerOpen = false;
  renderDrawer();
  updateButtons();
});

elements.previewButton.addEventListener("click", async () => {
  try {
    await withLoading("預覽工時中...", previewEntries);
    renderAll();
  } catch (error) {
    state.previewWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.commitButton.addEventListener("click", async () => {
  try {
    await withLoading("送出到 Redmine 中...", commitEntries);
    renderAll();
  } catch (error) {
    state.commitResults = [];
    state.previewWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.batchSpentOn.addEventListener("change", (event) => {
  state.batchSpentOn = event.target.value;
  clearAllEntryPreviewState();
  renderAll();
});

initializeApp().catch((error) => {
  state.issueWarnings = [error.message || String(error)];
  renderAll();
});
