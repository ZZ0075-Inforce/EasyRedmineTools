/* ===== Inline tools 注入到 /issues/{id} 頁面 (整合自 PJ_startToEndDate + PJ_workingHours) === */

const INLINE_FORM_ID = "__worklog_inline_form";
const INLINE_TOOLBAR_ID = "__worklog_inline_toolbar";
const INLINE_MODAL_ID = "__worklog_inline_modal";
const INLINE_TOAST_ID = "__worklog_inline_toast";

function isIssueDetailPage() {
  return /^\/issues\/\d+\/?$/.test(location.pathname);
}

function getIssueIdFromPath() {
  const m = location.pathname.match(/^\/issues\/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

/* ----- 入口：boot 階段呼叫 / toggle ON 立即呼叫 ----- */
function installInlineTools() {
  if (!isIssueDetailPage()) return;
  // 兩個獨立 toggle: quick edit form 與 worktime toolbar 各自 default true
  if (Store.get("inline_quick_edit_enabled", true) !== false) {
    installQuickEditForm();
  }
  if (Store.get("inline_toolbar_enabled", true) !== false) {
    installWorktimeToolbar();
  }
}

/* ----- 反向：個別 unmount ----- */
function uninstallQuickEditForm() {
  const form = document.getElementById(INLINE_FORM_ID);
  if (form) form.remove();
}

function uninstallWorktimeToolbar() {
  const marker = document.getElementById(INLINE_TOOLBAR_ID);
  if (marker) marker.remove();
  for (const li of document.querySelectorAll('[data-worklog-inline-toolbar-item="1"]')) {
    li.remove();
  }
}

function uninstallInlineTools() {
  // 全部 unmount (保留作為公用 API, 內部呼叫個別 uninstall)
  uninstallQuickEditForm();
  uninstallWorktimeToolbar();
  // 注意:不移除 #__worklog_inline_modal 與 toast container (race + 惰性元素)
}

/* ----- inline toast（self-contained，因為 worklog_app.js 的 showToast 在 __initWorklogApp wrap 內取不到） ----- */
function inlineToast(message, opts) {
  opts = opts || {};
  const type = opts.type || "success";
  const duration = opts.duration || 2500;
  let container = document.getElementById(INLINE_TOAST_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = INLINE_TOAST_ID;
    container.className = "pj-inline-toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `pj-inline-toast pj-inline-toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("pj-inline-toast-fading");
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

/* ----- Quick edit form（替代 PJ_startToEndDate）----- */
function installQuickEditForm() {
  const header = document.getElementById("issue_detail_header");
  if (!header || document.getElementById(INLINE_FORM_ID)) return;
  const issueId = getIssueIdFromPath();
  if (!issueId) return;

  const form = document.createElement("form");
  form.id = INLINE_FORM_ID;
  form.className = "pj-inline-form";
  form.setAttribute("autocomplete", "off");
  form.innerHTML = `
    <input type="text" data-field="estimated_hours" placeholder="預估工時" class="pj-inline-input pj-inline-input-narrow">
    <input type="text" data-field="start_date" placeholder="開始 yyyyMMdd" class="pj-inline-input">
    <input type="text" data-field="due_date" placeholder="完成 yyyyMMdd" class="pj-inline-input">
    <button type="submit" class="pj-inline-button">更新</button>
  `;
  header.prepend(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const get = (k) => form.querySelector(`[data-field="${k}"]`).value.trim();
    const startDate = normalizeInlineDate(get("start_date"));
    const dueDate = normalizeInlineDate(get("due_date"));
    const estimated = get("estimated_hours");
    if (!startDate || !dueDate) {
      inlineToast("日期格式錯誤（請用 yyyyMMdd 或 yyyy-MM-dd）", { type: "error" });
      return;
    }
    const payload = {
      issue: {
        id: issueId,
        estimated_hours: estimated,
        start_date: startDate,
        due_date: dueDate,
      },
    };
    // 若 issue UI 顯示無指派者，自動帶當前 user（取代原 PJ_ easy_autocompletes 搜尋）
    const uiAssigned = document.querySelector('span[data-name="issue[assigned_to_id]"]');
    const uiAssignedId = uiAssigned?.getAttribute("data-value");
    if (!uiAssignedId) {
      try {
        payload.issue.assigned_to_id = await getCurrentUserId();
      } catch {}
    }
    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "送出中...";
    try {
      await redmineFetch(`/issues/${issueId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      inlineToast(`已更新 issue #${issueId} 起迄日`);
      // 清空 input，視覺反饋已送出
      form.querySelectorAll(".pj-inline-input").forEach((el) => (el.value = ""));
    } catch (err) {
      inlineToast(`更新失敗：${err.message || err}`, { type: "error" });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "更新";
    }
  });
}

function normalizeInlineDate(input) {
  if (!input) return null;
  const m = input.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) input = `${m[1]}-${m[2]}-${m[3]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(input);
  const [y, mo, da] = input.split("-").map(Number);
  if (d.getFullYear() === y && d.getMonth() + 1 === mo && d.getDate() === da) return input;
  return null;
}

/* ----- Worktime toolbar（替代 PJ_workingHours）----- */
function installWorktimeToolbar() {
  const menu = document.querySelector(".menu-manager.menu-project-menu");
  if (!menu || document.getElementById(INLINE_TOOLBAR_ID)) return;
  const issueId = getIssueIdFromPath();
  if (!issueId) return;

  // settings 讀 offsets：array of numbers (例 [0, 1, 3])
  let offsets = Store.get("inline_toolbar_offsets", [0, 1, 3]);
  if (!Array.isArray(offsets)) offsets = [0, 1, 3];
  offsets = offsets
    .map((n) => Math.max(0, Math.min(30, Math.floor(Number(n)))))
    .filter((n) => Number.isFinite(n));
  if (!offsets.length) offsets = [0, 1, 3];

  const labels = ["今日", "昨日", "前天", "三日前", "四日前", "五日前", "六日前", "七日前"];

  // 用 <li> wrappers 各別 append 進 menu (menu 本身是 <ul>)
  const marker = document.createElement("li");
  marker.id = INLINE_TOOLBAR_ID;
  marker.style.display = "none";
  menu.appendChild(marker);

  for (const offset of offsets) {
    const label = labels[offset] || `${offset} 日前`;
    const li = document.createElement("li");
    li.dataset.worklogInlineToolbarItem = "1";
    const a = document.createElement("a");
    a.textContent = `${label}工時`;
    a.className = "pj-inline-toolbar-link";
    a.href = "#";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openWorktimeMiniModal(issueId, offset);
    });
    li.appendChild(a);
    menu.appendChild(li);
  }
}

/* ----- Worktime mini modal ----- */
let __currentModalConfirmHandler = null;
let __currentModalCancelHandler = null;
let __currentModalPhraseHandler = null;
let __phrasesCachedForInline = null;

async function fetchPhrasesForInline() {
  if (__phrasesCachedForInline) return __phrasesCachedForInline;
  try {
    // fetchJsonAdapter 在 runtime.js top-level，inline-injector.js 同層可直接呼叫
    const data = await fetchJsonAdapter("/api/phrases");
    __phrasesCachedForInline = (data && data.phrases) || [];
  } catch (err) {
    __phrasesCachedForInline = [];
  }
  return __phrasesCachedForInline;
}

function applyPhraseToInlineModal(modal, phrase) {
  if (!phrase) return;
  if (phrase.hours) modal.querySelector("[data-field='hours']").value = phrase.hours;
  if (phrase.activity_id) {
    const sel = modal.querySelector("[data-field='activity_id']");
    const matched = Array.from(sel.options).some((opt) => opt.value === String(phrase.activity_id));
    if (matched) sel.value = String(phrase.activity_id);
  }
  if (phrase.comments) modal.querySelector("[data-field='comments']").value = phrase.comments;
}

async function openWorktimeMiniModal(issueId, offset) {
  const modal = document.getElementById(INLINE_MODAL_ID);
  if (!modal) {
    inlineToast("modal 尚未初始化", { type: "error" });
    return;
  }
  const spentOn = dateStrDaysAgo(offset);
  modal.querySelector("[data-field='issue_id']").textContent = `#${issueId}`;
  modal.querySelector("[data-field='spent_on']").value = spentOn;
  modal.querySelector("[data-field='hours']").value = "";
  modal.querySelector("[data-field='comments']").value = "";

  // Activities (cached) + phrases (cached) 並行載入
  const activitySelect = modal.querySelector("[data-field='activity_id']");
  const phraseSelect = modal.querySelector("[data-field='phrase_id']");
  const [_, phrases] = await Promise.all([
    populateActivitiesSelect(activitySelect),
    fetchPhrasesForInline(),
  ]);

  // 填充 phrase select
  const defaultPhraseId = String(Store.get("inline_default_phrase_id", ""));
  phraseSelect.innerHTML =
    `<option value="">(不套用模板)</option>` +
    phrases
      .map((p) => {
        const label = p.label || `(未命名 - ${String(p.id).slice(0, 6)})`;
        const selected = String(p.id) === defaultPhraseId ? " selected" : "";
        return `<option value="${escapeForInline(String(p.id))}"${selected}>${escapeForInline(label)}</option>`;
      })
      .join("");

  // 若有預設 phrase 就套用一次
  if (defaultPhraseId) {
    const phrase = phrases.find((p) => String(p.id) === defaultPhraseId);
    if (phrase) applyPhraseToInlineModal(modal, phrase);
  }

  modal.hidden = false;
  modal.querySelector("[data-field='hours']").focus();

  // 拆掉舊 listener
  const confirmBtn = modal.querySelector("[data-action='confirm']");
  const cancelBtn = modal.querySelector("[data-action='cancel']");
  if (__currentModalConfirmHandler) confirmBtn.removeEventListener("click", __currentModalConfirmHandler);
  if (__currentModalCancelHandler) cancelBtn.removeEventListener("click", __currentModalCancelHandler);
  if (__currentModalPhraseHandler) phraseSelect.removeEventListener("change", __currentModalPhraseHandler);

  // Phrase 即時切換：套用該 phrase 的值（不清空既有 hours，user 已輸入的值用 applyPhraseToInlineModal 條件覆寫）
  __currentModalPhraseHandler = () => {
    const pid = phraseSelect.value;
    if (!pid) return;
    const phrase = phrases.find((p) => String(p.id) === pid);
    if (phrase) applyPhraseToInlineModal(modal, phrase);
  };
  phraseSelect.addEventListener("change", __currentModalPhraseHandler);

  __currentModalCancelHandler = () => {
    modal.hidden = true;
  };
  __currentModalConfirmHandler = async () => {
    const hours = modal.querySelector("[data-field='hours']").value.trim();
    const activity_id = activitySelect.value;
    const comments = modal.querySelector("[data-field='comments']").value;
    const spent = modal.querySelector("[data-field='spent_on']").value;
    if (!hours || !activity_id) {
      inlineToast("時數與活動必填", { type: "error" });
      return;
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = "送出中...";
    try {
      await redmineFetch("/time_entries.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          time_entry: { issue_id: issueId, spent_on: spent, hours, activity_id, comments },
        }),
      });
      inlineToast(`已送出 ${spent} ${hours}h 工時`);
      modal.hidden = true;
    } catch (err) {
      inlineToast(`送出失敗：${err.message || err}`, { type: "error" });
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "送出";
    }
  };
  confirmBtn.addEventListener("click", __currentModalConfirmHandler);
  cancelBtn.addEventListener("click", __currentModalCancelHandler);
}

let __activitiesCachedForInline = null;
async function populateActivitiesSelect(selectEl) {
  if (__activitiesCachedForInline) {
    selectEl.innerHTML = __activitiesCachedForInline;
    return;
  }
  try {
    const data = await redmineFetch("/enumerations/time_entry_activities.json");
    const activities = (data && data.time_entry_activities) || [];
    if (!activities.length) {
      selectEl.innerHTML = `<option value="">(無可用活動)</option>`;
      return;
    }
    const html = activities
      .map((a) => `<option value="${a.id}">${escapeForInline(a.name)}</option>`)
      .join("");
    __activitiesCachedForInline = html;
    selectEl.innerHTML = html;
  } catch (err) {
    selectEl.innerHTML = `<option value="">(載入失敗)</option>`;
  }
}

function escapeForInline(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

/* ----- 初始化 modal + 注入 CSS（boot 時一次性） ----- */
function installInlineModal() {
  if (document.getElementById(INLINE_MODAL_ID)) return;
  addCss(INLINE_CSS);
  const modal = document.createElement("div");
  modal.id = INLINE_MODAL_ID;
  modal.className = "pj-inline-modal-backdrop";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="pj-inline-modal-box" role="dialog" aria-modal="true">
      <h3 class="pj-inline-modal-title">快速填工時 <span data-field="issue_id"></span></h3>
      <label class="pj-inline-modal-label">
        <span>套用工時模板（可隨時切換）</span>
        <select data-field="phrase_id" class="pj-inline-input"></select>
      </label>
      <label class="pj-inline-modal-label">
        <span>日期</span>
        <input type="date" data-field="spent_on" class="pj-inline-input">
      </label>
      <label class="pj-inline-modal-label">
        <span>時數</span>
        <input type="number" step="0.1" min="0.1" data-field="hours" class="pj-inline-input">
      </label>
      <label class="pj-inline-modal-label">
        <span>活動</span>
        <select data-field="activity_id" class="pj-inline-input"></select>
      </label>
      <label class="pj-inline-modal-label">
        <span>備註</span>
        <textarea data-field="comments" class="pj-inline-textarea"></textarea>
      </label>
      <div class="pj-inline-modal-footer">
        <button data-action="cancel" type="button" class="pj-inline-button pj-inline-button-ghost">取消</button>
        <button data-action="confirm" type="button" class="pj-inline-button">送出</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // 點 backdrop 關閉；ESC 關閉
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) modal.hidden = true;
  });
}

const INLINE_CSS = `
.pj-inline-form { display: inline-flex; gap: 6px; margin: 6px 0; align-items: center; flex-wrap: wrap; }
.pj-inline-input, .pj-inline-textarea {
  padding: 6px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
  color: #2c2c2c;
  background: #fff;
  box-sizing: border-box;
}
.pj-inline-input { width: 130px; }
.pj-inline-input-narrow { width: 100px; }
.pj-inline-textarea { width: 100%; min-height: 64px; resize: vertical; }
.pj-inline-input:focus, .pj-inline-textarea:focus {
  outline: 2px solid #d13a3a;
  outline-offset: 1px;
  border-color: #d13a3a;
}
.pj-inline-button {
  padding: 6px 14px;
  border: 1px solid #d13a3a;
  background: #d13a3a;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}
.pj-inline-button:hover { background: #b92f2f; border-color: #b92f2f; }
.pj-inline-button:disabled { opacity: 0.55; cursor: not-allowed; filter: grayscale(0.4); }
.pj-inline-button-ghost { background: transparent; color: #2c2c2c; border-color: #ccc; }
.pj-inline-button-ghost:hover { background: #f3ede7; color: #2c2c2c; }
.pj-inline-toolbar-link { cursor: pointer; }

.pj-inline-modal-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55);
  z-index: 2147483647;
  display: flex; align-items: center; justify-content: center;
  font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
}
.pj-inline-modal-backdrop[hidden] { display: none !important; }
.pj-inline-modal-box {
  background: #fdfaf7;
  border-radius: 12px;
  padding: 22px 24px;
  min-width: 340px;
  max-width: 480px;
  width: 90vw;
  box-shadow: 0 12px 40px rgba(0,0,0,0.3);
  display: flex; flex-direction: column; gap: 12px;
  color: #2c2c2c;
}
.pj-inline-modal-title { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
.pj-inline-modal-label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #4a4540; }
.pj-inline-modal-label > span { font-weight: 500; }
.pj-inline-modal-label .pj-inline-input { width: 100%; }
.pj-inline-modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }

.pj-inline-toast-container {
  position: fixed; right: 24px; bottom: 24px;
  z-index: 2147483647;
  display: flex; flex-direction: column; gap: 8px;
  pointer-events: none;
  font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
}
.pj-inline-toast {
  background: #fdfaf7;
  border: 1px solid #e8e2da;
  border-left: 4px solid #d13a3a;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #2c2c2c;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  max-width: 320px;
  pointer-events: auto;
  animation: pj-inline-toast-in 200ms ease-out;
}
.pj-inline-toast-success { border-left-color: #4a9b6e; }
.pj-inline-toast-error { border-left-color: #d13a3a; }
.pj-inline-toast-fading { animation: pj-inline-toast-out 220ms ease-in forwards; }
@keyframes pj-inline-toast-in {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes pj-inline-toast-out {
  from { opacity: 1; }
  to   { opacity: 0; transform: translateX(20px); }
}
`;

window.__worklog_installInlineTools = installInlineTools;
window.__worklog_uninstallInlineTools = uninstallInlineTools;
window.__worklog_installQuickEditForm = installQuickEditForm;
window.__worklog_uninstallQuickEditForm = uninstallQuickEditForm;
window.__worklog_installWorktimeToolbar = installWorktimeToolbar;
window.__worklog_uninstallWorktimeToolbar = uninstallWorktimeToolbar;
window.__worklog_installInlineModal = installInlineModal;
window.__worklog_inlineToast = inlineToast;
