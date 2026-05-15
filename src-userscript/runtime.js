/* ===== Storage layer (GM 或 localStorage fallback) ========================= */
const Store = {
  get(key, fallback) {
    try {
      if (typeof GM_getValue !== "undefined") {
        const v = GM_getValue(key, undefined);
        return v === undefined ? fallback : v;
      }
    } catch {}
    try {
      const raw = localStorage.getItem("__worklog__" + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (typeof GM_setValue !== "undefined") { GM_setValue(key, value); return; }
    } catch {}
    try { localStorage.setItem("__worklog__" + key, JSON.stringify(value)); } catch {}
  },
  del(key) {
    try {
      if (typeof GM_deleteValue !== "undefined") { GM_deleteValue(key); return; }
    } catch {}
    try { localStorage.removeItem("__worklog__" + key); } catch {}
  },
};

/* ===== Redmine 直接呼叫（session + CSRF / API Key 雙模式） ================== */
function getAuthHeaders() {
  const apiKey = (Store.get("api_key", "") || "").trim();
  if (apiKey) {
    return { "X-Redmine-API-Key": apiKey };
  }
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  const headers = { "X-Requested-With": "XMLHttpRequest" };
  if (csrf) headers["X-CSRF-Token"] = csrf;
  return headers;
}

function extractHttpErrorDetail(status, bodyText) {
  if (!bodyText || !bodyText.trim()) return `HTTP ${status}`;
  let body;
  try { body = JSON.parse(bodyText); }
  catch { return `HTTP ${status}: ` + bodyText.trim().replace(/\s+/g, " ").slice(0, 200); }
  const errs = body && body.errors;
  const msgs = [];
  if (Array.isArray(errs)) {
    for (const e of errs) msgs.push(typeof e === "string" ? e : JSON.stringify(e));
  } else if (errs && typeof errs === "object") {
    for (const [field, v] of Object.entries(errs)) {
      const m = Array.isArray(v) ? v.join("; ") : String(v);
      msgs.push(`${field}: ${m}`);
    }
  }
  if (!msgs.length) {
    return `HTTP ${status}: ` + bodyText.trim().replace(/\s+/g, " ").slice(0, 200);
  }
  return `HTTP ${status}: ` + msgs.join("; ");
}

async function redmineFetch(path, options = {}) {
  const headers = {
    "Accept": "application/json",
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(location.origin + path, {
    method: options.method || "GET",
    headers,
    body: options.body,
    credentials: "include",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(extractHttpErrorDetail(response.status, text));
  }
  if (!text.trim()) return {};
  try { return JSON.parse(text); }
  catch { throw new Error("回應非 JSON：" + text.slice(0, 120)); }
}

/* ===== Issue 轉換（對齊 Python normalize_issue_summary 的 14 欄位） ========= */
function toIssueSummary(raw) {
  const s = raw.status || {};
  const p = raw.project || {};
  const t = raw.tracker || {};
  const pr = raw.priority || {};
  const a = raw.assigned_to || {};
  return {
    issue_id: raw.id,
    subject: String(raw.subject || "").trim(),
    status: String(s.name || "").trim(),
    status_id: s.id ?? null,
    is_closed: Boolean(s.is_closed || false),
    project: String(p.name || "").trim(),
    project_id: p.id ?? null,
    tracker: String(t.name || "").trim(),
    priority: String(pr.name || "").trim(),
    assigned_to: String(a.name || "").trim(),
    assigned_to_id: a.id ?? null,
    updated_on: raw.updated_on || "",
    done_ratio: Number(raw.done_ratio || 0),
    spent_hours: Number(raw.spent_hours || 0),
    estimated_hours: Number(raw.estimated_hours || 0),
    issue_url: location.origin + "/issues/" + raw.id,
  };
}

/* ===== Activity 快取（整頁共用） =========================================== */
let __activitiesCache = null;

/* ===== 訪問紀錄：當前頁是 /issues/{id} 就把這筆 issue 記到 GM 儲存
        保留 N 天（使用者可在設定 → 填寫工時調整，預設 7 天），移除過期。  === */
function getVisitRetentionDays() {
  const raw = Number(Store.get("visit_retention_days", 7));
  if (!Number.isFinite(raw) || raw < 1) return 7;
  return Math.min(raw, 365);
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function dateStrDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

async function recordIssueVisit() {
  const m = location.pathname.match(/^\/issues\/(\d+)\/?$/);
  if (!m) return;
  const id = Number(m[1]);
  const today = todayStr();
  const cutoff = dateStrDaysAgo(getVisitRetentionDays());

  let list = (Store.get("visited_issues", []) || []).filter(
    (x) => x && (x.last_visited_at || "") >= cutoff
  );

  // 已有今天的紀錄就不重抓（節省 API 呼叫）
  const existing = list.find((x) => x.issue_id === id && x.last_visited_at === today);
  if (existing && existing.subject) {
    Store.set("visited_issues", list);
    return;
  }

  // 嘗試抓完整資料；失敗就存最小資訊
  let entry;
  try {
    const data = await redmineFetch(`/issues/${id}.json`);
    if (data && data.issue) {
      entry = { ...toIssueSummary(data.issue), last_visited_at: today };
    }
  } catch {}
  if (!entry) {
    entry = {
      issue_id: id,
      subject: `Issue #${id}`,
      issue_url: location.origin + "/issues/" + id,
      last_visited_at: today,
    };
  }
  list = list.filter((x) => x.issue_id !== id);
  list.unshift(entry);
  Store.set("visited_issues", list);
}

window.__worklog_recordVisit = recordIssueVisit;

/* ===== 目前使用者 id：避免依賴 Redmine "me" keyword（不同版本行為不一） ===== */
let __currentUserId = null;
let __currentUserPromise = null;
async function getCurrentUserId() {
  if (__currentUserId !== null) return __currentUserId;
  if (__currentUserPromise) return __currentUserPromise;
  __currentUserPromise = (async () => {
    try {
      const data = await redmineFetch("/users/current.json");
      __currentUserId = data.user?.id ?? null;
      if (!__currentUserId) {
        throw new Error("/users/current.json 未回傳 user.id（可能尚未登入或 session 已過期）");
      }
      return __currentUserId;
    } finally {
      __currentUserPromise = null;
    }
  })();
  return __currentUserPromise;
}

/* ===== Preview session（瀏覽器端 token + 內容簽章） ======================== */
const PREVIEW_SESSIONS = new Map();  // token → { spent_on, signature }

async function sha256Hex(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function canonicalSignature(spentOn, entries) {
  const canon = {
    spent_on: spentOn,
    entries: entries.map(e => ({
      issue_id: Number(e.issue_id),
      hours: String(e.hours || ""),
      activity_id: e.activity_id === "" || e.activity_id == null ? null : Number(e.activity_id),
      comments: String(e.comments || ""),
    })),
  };
  return sha256Hex(JSON.stringify(canon));
}

function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ===== 前端欄位驗證（對齊 Python normalize_preview_entry 的規則） =========== */
function validateEntry(entry, manualActivity) {
  const errors = {};
  const hours = Number(entry.hours);
  if (!entry.hours || !Number.isFinite(hours) || hours < 0.1) {
    errors.hours = "請輸入有效時數（≥ 0.1）";
  } else if (hours > 24) {
    errors.hours = "時數不可超過 24 小時";
  }
  if (entry.activity_id === "" || entry.activity_id == null) {
    errors.activity_id = "請選擇活動類型";
  } else if (manualActivity) {
    const aid = Number(entry.activity_id);
    if (!Number.isFinite(aid) || aid <= 0) errors.activity_id = "活動 ID 需為正整數";
  }
  return errors;
}

/* ===== Handler map：對映原 /api/* 路徑到 Redmine 直呼 ====================== */
const handlers = {
  async "GET /api/time-entry-activities"() {
    if (__activitiesCache) return __activitiesCache;
    const warnings = [];
    const paths = ["/enumerations/time_entry_activities.json", "/time_entry_activities.json"];
    for (const p of paths) {
      try {
        const data = await redmineFetch(p);
        const list = data.time_entry_activities || data.enumerations || [];
        const acts = list
          .filter(x => x && x.id && x.name)
          .map(x => ({ id: Number(x.id), name: String(x.name).trim(), is_default: Boolean(x.is_default) }))
          .sort((a, b) => (Number(b.is_default) - Number(a.is_default)) || a.name.localeCompare(b.name));
        if (acts.length) {
          __activitiesCache = { activities: acts, manual_entry: false, warnings };
          return __activitiesCache;
        }
        warnings.push(`${p} 回傳空陣列，改試下一個端點`);
      } catch (err) {
        warnings.push(`${p} 失敗：${err.message}`);
      }
    }
    __activitiesCache = { activities: [], manual_entry: true, warnings };
    return __activitiesCache;
  },

  async "GET /api/issues"(params) {
    const source = params.get("source") || "mine";
    const dateFilter = params.get("date");
    const queryId = params.get("query_id");
    try {
      // Easy Redmine session 模式下 /issues.json filter 必要組合：
      // assigned_to_id=me + status_id=o + set_filter=1（缺一不可）
      let path;
      if (source === "mine" || source === "mine-grouped" || source === "schedule") {
        const p = new URLSearchParams();
        p.set("assigned_to_id", "me");
        p.set("status_id", "o");
        p.set("set_filter", "1");
        p.set("limit", "100");
        p.set("sort", "updated_on:desc");
        if (dateFilter && source !== "schedule") p.set("updated_on", dateFilter);
        path = `/issues.json?${p.toString()}`;
      } else if (source === "query") {
        path = `/issues.json?query_id=${encodeURIComponent(queryId || "")}&set_filter=1&limit=100`;
      } else if (source === "visited") {
        // 從 GM 儲存讀「近 7 天 /issues/{id} 訪問過」的清單
        const cutoff = dateStrDaysAgo(getVisitRetentionDays());
        let list = (Store.get("visited_issues", []) || []).filter(
          (x) => x && (x.last_visited_at || "") >= cutoff
        );
        // dateFilter 進階篩選日期 → 只回那天看過的
        if (dateFilter) list = list.filter((x) => x.last_visited_at === dateFilter);
        // 由近至遠排序
        list.sort((a, b) =>
          (b.last_visited_at || "").localeCompare(a.last_visited_at || "")
        );
        return {
          source,
          target_date: dateFilter || "",
          issue_count: list.length,
          issues: list,
          warnings: list.length === 0
            ? ["近期查閱清單為空。在 Redmine 點開任一 issue 頁，userscript 會自動記錄。"]
            : [],
        };
      } else {
        return { issues: [], warnings: ["未知的來源類型：" + source] };
      }
      const data = await redmineFetch(path);
      let issues = (data.issues || []).map(toIssueSummary);
      if (dateFilter && (source === "mine" || source === "mine-grouped")) {
        issues = issues.filter(i => (i.updated_on || "").startsWith(dateFilter));
      }
      return {
        source,
        target_date: dateFilter || "",
        issue_count: issues.length,
        issues,
        warnings: [],
      };
    } catch (err) {
      return { issues: [], warnings: [err.message] };
    }
  },

  async "GET /api/projects"() {
    // Redmine /projects.json 預設只回 25 筆，分頁聚合所有可見專案
    const limit = 100;
    let offset = 0;
    const all = [];
    while (true) {
      const data = await redmineFetch(`/projects.json?limit=${limit}&offset=${offset}`);
      const list = Array.isArray(data.projects) ? data.projects : [];
      for (const p of list) {
        if (p && p.id) all.push({
          id: Number(p.id),
          name: String(p.name || "").trim(),
          identifier: String(p.identifier || ""),
        });
      }
      const total = Number(data.total_count || 0);
      offset += list.length;
      if (!list.length || offset >= total) break;
      if (offset > 2000) break;  // 安全閥
    }
    all.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    return { projects: all };
  },

  async "GET /api/trackers"() {
    const data = await redmineFetch("/trackers.json");
    const list = (data.trackers || [])
      .filter(t => t && t.id && t.name)
      .map(t => ({ id: Number(t.id), name: String(t.name).trim() }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    return { trackers: list };
  },

  "GET /api/issue-templates"() { return { templates: Store.get("issue_templates", []) }; },

  "POST /api/issue-templates"(_params, body) {
    const subject = String((body && body.subject) || "").trim();
    if (!subject) throw new Error("subject 不可為空");
    const list = Store.get("issue_templates", []);
    const item = { id: randomToken().slice(0, 11), subject };
    list.push(item);
    Store.set("issue_templates", list);
    return { template: item };
  },

  "PUT /api/issue-templates"(_params, body, pathRest) {
    const id = pathRest;
    const subject = String((body && body.subject) || "").trim();
    if (!subject) throw new Error("subject 不可為空");
    const list = Store.get("issue_templates", []);
    const idx = list.findIndex(t => t.id === id);
    if (idx < 0) throw new Error("找不到該 issue 模板");
    list[idx] = { id, subject };
    Store.set("issue_templates", list);
    return { template: list[idx] };
  },

  "DELETE /api/issue-templates"(_params, _body, pathRest) {
    const list = Store.get("issue_templates", []).filter(t => t.id !== pathRest);
    Store.set("issue_templates", list);
    return {};
  },

  // Per-issue default template snapshots (inline {hours, activity_id, comments})
  // 對映「⭐ 設為此 issue 的 default」功能。snapshot 而非 phrase_id reference,
  // 所以 phrase 刪除/改變不影響已設的 default。
  "GET /api/issue-template-defaults"() {
    return { defaults: Store.get("issue_template_defaults", {}) };
  },

  "PUT /api/issue-template-defaults"(_params, body, pathRest) {
    const issueId = String(pathRest || "").trim();
    if (!issueId) throw new Error("缺少 issue_id");
    const snap = {
      hours: String((body && body.hours) || ""),
      activity_id: String((body && body.activity_id) || ""),
      comments: String((body && body.comments) || ""),
    };
    const map = Store.get("issue_template_defaults", {});
    map[issueId] = snap;
    Store.set("issue_template_defaults", map);
    return { issue_id: issueId, snapshot: snap };
  },

  "DELETE /api/issue-template-defaults"(_params, _body, pathRest) {
    const issueId = String(pathRest || "").trim();
    if (!issueId) throw new Error("缺少 issue_id");
    const map = Store.get("issue_template_defaults", {});
    delete map[issueId];
    Store.set("issue_template_defaults", map);
    return { issue_id: issueId };
  },

  async "POST /api/issues/batch-create"(_params, body) {
    const projectId = Number(body && body.project_id);
    const trackerId = Number(body && body.tracker_id);
    const rows = Array.isArray(body && body.rows) ? body.rows : [];
    if (!Number.isFinite(projectId) || projectId <= 0) throw new Error("缺少有效的 project_id");
    if (!Number.isFinite(trackerId) || trackerId <= 0) throw new Error("缺少有效的 tracker_id");
    if (!rows.length) throw new Error("沒有要建立的 issue");

    // 抓本人 ID 作為預設指派人（部分 tracker 必填 assignee → 422）
    let assigneeId = null;
    try { assigneeId = await getCurrentUserId(); } catch {}

    const results = [];
    for (const row of rows) {
      const subject = String((row && row.subject) || "").trim();
      if (!subject) {
        results.push({ ok: false, subject: "", error: "subject 為空" });
        continue;
      }
      const issuePayload = { project_id: projectId, tracker_id: trackerId, subject };
      if (assigneeId) issuePayload.assigned_to_id = assigneeId;
      const hours = Number(row.estimated_hours);
      if (Number.isFinite(hours) && hours > 0) issuePayload.estimated_hours = hours;
      const start = String(row.start_date || "").trim();
      const due = String(row.due_date || "").trim();
      if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) issuePayload.start_date = start;
      if (due && /^\d{4}-\d{2}-\d{2}$/.test(due)) issuePayload.due_date = due;
      if (issuePayload.start_date && issuePayload.due_date && issuePayload.start_date > issuePayload.due_date) {
        results.push({ ok: false, subject, error: "起始日不得晚於結束日" });
        continue;
      }
      try {
        const resp = await redmineFetch("/issues.json", {
          method: "POST",
          body: JSON.stringify({ issue: issuePayload }),
        });
        const issue = resp.issue || {};
        const id = Number(issue.id);
        results.push({
          ok: true,
          subject,
          issue_id: id,
          issue_url: location.origin + "/issues/" + id,
        });
      } catch (err) {
        results.push({ ok: false, subject, error: err.message || String(err) });
      }
    }
    return { results };
  },

  "GET /api/saved-queries"() { return { queries: Store.get("saved_queries", []) }; },

  "POST /api/saved-queries"(_params, body) {
    const list = Store.get("saved_queries", []);
    const queryId = Number(body.query_id);
    const name = String(body.name || "").trim();
    if (!Number.isFinite(queryId) || queryId <= 0) throw new Error("query_id 需為正整數");
    if (!name) throw new Error("請填寫名稱");
    const idx = list.findIndex(q => Number(q.query_id) === queryId);
    const item = { query_id: queryId, name };
    if (idx >= 0) list[idx] = item; else list.push(item);
    Store.set("saved_queries", list);
    return { query: item };
  },

  "DELETE /api/saved-queries"(_params, _body, pathRest) {
    const qid = Number(pathRest);
    const list = Store.get("saved_queries", []).filter(q => Number(q.query_id) !== qid);
    Store.set("saved_queries", list);
    return {};
  },

  "GET /api/phrases"() { return { phrases: Store.get("phrases", []) }; },

  "POST /api/phrases"(_params, body) {
    const list = Store.get("phrases", []);
    const id = randomToken().slice(0, 11);
    const item = sanitizePhrase({ ...body, id });
    list.push(item);
    Store.set("phrases", list);
    return { phrase: item };
  },

  "PUT /api/phrases"(_params, body, pathRest) {
    const id = pathRest;
    const list = Store.get("phrases", []);
    const idx = list.findIndex(p => p.id === id);
    if (idx < 0) throw new Error("找不到該工時模板");
    list[idx] = sanitizePhrase({ ...body, id });
    Store.set("phrases", list);
    return { phrase: list[idx] };
  },

  "DELETE /api/phrases"(_params, _body, pathRest) {
    const list = Store.get("phrases", []).filter(p => p.id !== pathRest);
    Store.set("phrases", list);
    return {};
  },

  async "POST /api/time-entries/preview"(_params, body) {
    const spentOn = String(body.spent_on || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) throw new Error("spent_on 需為 YYYY-MM-DD");
    const acts = await handlers["GET /api/time-entry-activities"]();
    const manual = acts.manual_entry;

    const entries = (body.entries || []).map(raw => ({
      issue_id: Number(raw.issue_id),
      issue_subject: raw.issue_subject || "",
      issue_url: raw.issue_url || "",
      hours: raw.hours || "",
      activity_id: raw.activity_id === "" || raw.activity_id == null ? "" : Number(raw.activity_id),
      comments: raw.comments || "",
      selected: raw.selected !== false,
      errors: {},
      duplicate: false,
      duplicate_entries: [],
    }));

    // 欄位驗證
    for (const e of entries) {
      e.errors = validateEntry(e, manual);
    }

    // 查 duplicate（對每個有效 issue+spent_on 查一次）
    const warnings = [];
    let uid;
    try { uid = await getCurrentUserId(); } catch { uid = null; }
    for (const e of entries) {
      if (Object.keys(e.errors).length) continue;
      if (!uid) { warnings.push("無法確認目前使用者，跳過 duplicate 偵測"); continue; }
      try {
        const data = await redmineFetch(
          `/time_entries.json?issue_id=${e.issue_id}&spent_on=${spentOn}&user_id=${uid}&limit=10`
        );
        const existing = (data.time_entries || []).map(t => ({
          id: t.id,
          hours: t.hours,
          activity_name: t.activity?.name || "",
          comments: t.comments || "",
        }));
        if (existing.length) {
          e.duplicate = true;
          e.duplicate_entries = existing;
          e.selected = false;
        }
      } catch (err) {
        warnings.push(`Issue #${e.issue_id} duplicate 查詢失敗：${err.message}`);
      }
    }

    const token = randomToken();
    const signature = await canonicalSignature(spentOn, entries);
    PREVIEW_SESSIONS.set(token, { spent_on: spentOn, signature, ts: Date.now() });
    // 30 分鐘後自動回收
    setTimeout(() => PREVIEW_SESSIONS.delete(token), 30 * 60 * 1000);

    return { preview_token: token, spent_on: spentOn, entries, warnings };
  },

  async "POST /api/time-entries/commit"(_params, body) {
    const token = String(body.preview_token || "");
    const session = PREVIEW_SESSIONS.get(token);
    if (!session) throw new Error("預覽已過期，請重新預覽");
    if (session.spent_on !== body.spent_on) throw new Error("工時日期與預覽時不同，請重新預覽");
    const sig = await canonicalSignature(body.spent_on, body.entries);
    if (sig !== session.signature) throw new Error("內容與預覽時不同，請重新預覽");

    const results = [];
    for (const e of body.entries) {
      const base = { issue_id: Number(e.issue_id), spent_on: body.spent_on, selected: !!e.selected };
      if (!e.selected) { results.push({ ...base, skipped: true }); continue; }
      if (e.errors && Object.keys(e.errors).length) {
        results.push({ ...base, error: "這筆仍有欄位錯誤，請重新預覽。" });
        continue;
      }
      try {
        const payload = {
          time_entry: {
            issue_id: Number(e.issue_id),
            spent_on: body.spent_on,
            hours: Number(e.hours),
            activity_id: Number(e.activity_id),
            comments: String(e.comments || ""),
          },
        };
        const res = await redmineFetch("/time_entries.json", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        results.push({ ...base, created_time_entry_id: res.time_entry?.id });
      } catch (err) {
        results.push({ ...base, error: err.message });
      }
    }
    PREVIEW_SESSIONS.delete(token);
    return { spent_on: body.spent_on, results };
  },

  async "POST /api/schedule/apply-dates"(_params, body) {
    const results = [];
    for (const raw of (body.entries || [])) {
      const id = Number(raw.issue_id);
      const start = String(raw.start_date || "").trim();
      const due = String(raw.due_date || "").trim();
      if (!Number.isFinite(id) || id <= 0) { results.push({ issue_id: raw.issue_id, error: "issue_id 不正確" }); continue; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
        results.push({ issue_id: id, error: "日期格式需 YYYY-MM-DD" }); continue;
      }
      if (start > due) { results.push({ issue_id: id, error: "起始日不得晚於結束日" }); continue; }
      try {
        await redmineFetch(`/issues/${id}.json`, {
          method: "PUT",
          body: JSON.stringify({ issue: { start_date: start, due_date: due } }),
        });
        results.push({ issue_id: id, start_date: start, due_date: due, ok: true });
      } catch (err) {
        results.push({ issue_id: id, error: err.message });
      }
    }
    return { results };
  },
};

function sanitizePhrase(raw) {
  return {
    id: raw.id,
    label: String(raw.label || "").trim(),
    hours: raw.hours ? String(raw.hours) : "",
    activity_id: raw.activity_id === "" || raw.activity_id == null ? "" : Number(raw.activity_id),
    comments: String(raw.comments || ""),
  };
}

/* ===== fetchJson 轉接：app-core 呼叫 /api/... 會被攔到這裡 ================== */
async function fetchJsonAdapter(url, options = {}) {
  const [pathname, queryString] = url.split("?");
  const method = (options.method || "GET").toUpperCase();
  const params = new URLSearchParams(queryString || "");
  const body = options.body ? JSON.parse(options.body) : null;

  // 動態路徑：/api/phrases/{id}、/api/saved-queries/{qid}
  const matchKey = `${method} ${pathname}`;
  if (handlers[matchKey]) {
    return handlers[matchKey](params, body);
  }
  for (const prefix of ["/api/phrases/", "/api/saved-queries/", "/api/issue-templates/", "/api/issue-template-defaults/"]) {
    if (pathname.startsWith(prefix)) {
      const basePath = prefix.replace(/\/$/, "");
      const rest = pathname.slice(prefix.length);
      const key = `${method} ${basePath}`;
      if (handlers[key]) {
        return handlers[key](params, body, rest);
      }
    }
  }
  throw new Error(`Unknown endpoint: ${matchKey}`);
}

window.__worklog_fetchJson = fetchJsonAdapter;
window.__worklog_Store = Store;
window.__worklog_redmineFetch = redmineFetch;
