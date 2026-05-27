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

/* ===== 純日期 util（VisitedIssuesRegistry 與 handler module 都會用） ====== */
function todayStr() { return new Date().toISOString().slice(0, 10); }
function dateStrDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

/* ===== VisitedIssuesRegistry：訪問紀錄 + 1 小時 subject refresh =============
 * 當前頁是 /issues/{id} 就把這筆 issue 記到 GM 儲存，保留 N 天（使用者可在
 * 設定 → 填寫工時調整，預設 7 天），移除過期。subject refresh 用 1 小時
 * cache 回頭更新被異動的標題。
 */
const VisitedIssuesRegistry = (() => {
  const REFRESH_INTERVAL_MS = 60 * 60 * 1000;  // 1 hour

  function getRetentionDays() {
    const raw = Number(Store.get("visit_retention_days", 7));
    if (!Number.isFinite(raw) || raw < 1) return 7;
    return Math.min(raw, 365);
  }

  function isStale() {
    const last = Store.get("visited_subjects_refreshed_at", "");
    if (!last) return true;  // 從未 refresh 過 (含升版初次)
    const lastMs = new Date(last).getTime();
    if (!Number.isFinite(lastMs)) return true;
    return (Date.now() - lastMs) >= REFRESH_INTERVAL_MS;
  }

  async function recordVisit() {
    const m = location.pathname.match(/^\/issues\/(\d+)\/?$/);
    if (!m) return;
    const id = Number(m[1]);
    const today = todayStr();
    const cutoff = dateStrDaysAgo(getRetentionDays());

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

  async function refresh() {
    const list = Store.get("visited_issues", []) || [];
    if (!list.length) {
      Store.set("visited_subjects_refreshed_at", new Date().toISOString());
      return [];
    }
    const ids = list.map((x) => x.issue_id).filter((id) => Number.isFinite(id));
    if (!ids.length) return list;

    try {
      // status_id=* 含關閉的 issue (避免 default open filter 漏掉 user 看過再被關的)
      const path = `/issues.json?issue_id=${ids.join(",")}&status_id=*&limit=100`;
      const data = await redmineFetch(path);
      const fresh = (data?.issues || []).map(toIssueSummary);
      const freshById = new Map(fresh.map((it) => [it.issue_id, it]));

      // Merge: 保留 last_visited_at; 用 fresh 蓋掉其他 fields
      // 若 issue 不在 batch 回應 (可能已刪/權限關閉) 保留舊資料
      const updated = list.map((entry) => {
        const f = freshById.get(entry.issue_id);
        if (!f) return entry;
        return { ...f, last_visited_at: entry.last_visited_at };
      });

      Store.set("visited_issues", updated);
      Store.set("visited_subjects_refreshed_at", new Date().toISOString());
      return updated;
    } catch (err) {
      // Refresh 失敗 → 用既有 cached, 不更新時間戳 (下次仍會嘗試 refresh)
      return list;
    }
  }

  return { recordVisit, refresh, isStale, getRetentionDays };
})();

window.__worklog_recordVisit = VisitedIssuesRegistry.recordVisit;

/* ===== CurrentUserManager：目前使用者 id 的 memoization ====================
 * 避免依賴 Redmine "me" keyword（不同版本行為不一）。get() 第一次呼叫 fetch
 * /users/current.json，後續直接回 cached。reset() 預備將來 session 失效時
 * 強制 re-fetch（目前未掛 401 重 fetch hook，需要時再加）。
 */
const CurrentUserManager = (() => {
  let userId = null;
  let promise = null;

  async function get() {
    if (userId !== null) return userId;
    if (promise) return promise;
    promise = (async () => {
      try {
        const data = await redmineFetch("/users/current.json");
        userId = data.user?.id ?? null;
        if (!userId) {
          throw new Error("/users/current.json 未回傳 user.id（可能尚未登入或 session 已過期）");
        }
        return userId;
      } finally {
        promise = null;
      }
    })();
    return promise;
  }

  function reset() {
    userId = null;
    promise = null;
  }

  return { get, reset };
})();

/* ===== GeminiClient：Google Gemini API generateContent 包裝 ================
 * 公開 generate(modelId, sysprompt, userInput, responseSchema)，內部:
 * 1. 從 GM 抓 gemini_api_key
 * 2. POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * 3. systemInstruction + contents(user) + generationConfig.responseSchema 強制 JSON
 * 4. 從 candidates[0].content.parts[0].text 抽 JSON 字串並 parse
 * 失敗條件: 沒 API key / HTTP 非 2xx / parse 失敗 都 throw Error 帶說明。
 */
const GeminiClient = (() => {
  const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

  async function generate(modelId, sysprompt, userInput, responseSchema) {
    const apiKey = (Store.get("gemini_api_key", "") || "").trim();
    if (!apiKey) throw new Error("尚未設定 Gemini API Key");
    if (!modelId) throw new Error("尚未指定模型");
    const url = `${ENDPOINT_BASE}/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [{ role: "user", parts: [{ text: userInput }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };
    if (sysprompt && sysprompt.trim()) {
      body.systemInstruction = { parts: [{ text: sysprompt }] };
    }
    if (responseSchema) {
      body.generationConfig.responseSchema = responseSchema;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini ${res.status}：${text.slice(0, 240)}`);
    }
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!rawText) throw new Error("Gemini 回應內容為空");
    try {
      return JSON.parse(rawText);
    } catch (_) {
      throw new Error("Gemini 回應不是 JSON：" + rawText.slice(0, 160));
    }
  }

  return { generate };
})();

window.__worklog_GeminiClient = GeminiClient;

/* ===== Random token utility（preview session 與 issue-templates / saved-queries 共用） === */
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ===== Handler map：4 個 domain module spread merge ======================= */
const handlers = {
  ...TimeEntryHandlers,
  ...IssueHandlers,
  ...CatalogHandlers,
  ...StorageHandlers,
};

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
