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
        maxOutputTokens: 8192,
      },
    };
    if (sysprompt && sysprompt.trim()) {
      body.systemInstruction = { parts: [{ text: sysprompt }] };
    }
    // Gemma 系列對 responseSchema 支援不穩定（schema constraint 反而導致
    // 損壞 JSON，例 finishReason: STOP 但 text 內混亂碼）。只給 Gemini 系列
    // 送 responseSchema；Gemma 走 responseMimeType + sysprompt 描述就好。
    if (responseSchema && !/^gemma-/i.test(modelId)) {
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
    // parts 可能有多個 (Gemma 4 / Gemini 2.5 thinking mode 會回 thought + output)
    // 跳過 thought: true 的 part，取第一個真正 output 的
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const outputPart = parts.find((p) => !p.thought) || parts[0];
    const rawText = outputPart?.text || "";
    if (!rawText) throw new Error("Gemini 回應內容為空");
    // Wrap fn: Gemma 未受 responseSchema 約束時會回純 array; 包成 {issues: arr}
    // 以符合 AGENT_TYPES.parseResponse 對 data.issues 的期望。
    // Gemini 回 object 形態時原樣返回，不影響行為。
    const wrap = (v) => Array.isArray(v) ? { issues: v } : v;
    // Layer 1: 直接 parse
    try { return wrap(JSON.parse(rawText)); } catch (_) {}
    // Layer 2: 剝 markdown fence 再 parse (` ```json {...} ``` ` 樣式)
    const stripped = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try { return wrap(JSON.parse(stripped)); } catch (_) {}
    // Layer 3: partial recovery — 從 raw text 用 regex 抽 "subject"
    const subjects = [...stripped.matchAll(/"subject"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g)]
      .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"))
      .filter((s) => s && s.trim());
    if (subjects.length) {
      console.warn("[GeminiClient] JSON parse failed, partial recovery extracted",
        subjects.length, "subjects from raw:", rawText.slice(0, 200));
      return { issues: subjects.map((s) => ({ subject: s })) };
    }
    throw new Error("Gemini 回應不是 JSON 也無法 partial recovery：" + rawText.slice(0, 160));
  }

  return { generate };
})();

window.__worklog_GeminiClient = GeminiClient;

/* ===== AGENT_TYPES：AI Agent registry (開發者預定義) ======================
 * 每個 agent 綁定一個 view 用途。Hard-code:
 * - defaultSysprompt: user 第一次用的 sysprompt（user 可改、改完存 GM）
 * - defaultModel: 預設模型
 * - outputSchema: Gemini responseSchema 強制 JSON 結構
 * - parseResponse: 從 Gemini 回的 data 抽出可用的 row array
 * User 在 AI 設定區只改 sysprompt + model；schema + parser 跟程式邏輯
 * 緊耦合，user 不能改。
 *
 * 放在 runtime.js (outer IIFE) 而非 worklog_app.js (__initWorklogApp 內)：
 * settings-patch.js 求值時要直接 lookup 這些 const，必須在它之前就緒。
 */
const AGENT_TYPES = {
  "batch-issue": {
    targetView: "issue-batch",
    label: "批次建 issue Agent",
    roles: [
      { code: "PG", label: "Programmer", desc: "工程師（前端/後端開發、bug 修復、技術實作）" },
      { code: "SD", label: "System Designer", desc: "系統設計師（系統流程、介面設計、模組規劃）" },
      { code: "SA", label: "System Analyst", desc: "系統分析師（需求分析、規格文件、流程梳理）" },
      { code: "PM", label: "Project Manager", desc: "專案經理（進度管理、會議協調、溝通對齊）" },
      { code: "QC", label: "Quality Control", desc: "品質管控（測試計畫、bug 驗證、上線檢查）" },
      { code: "BA", label: "Business Analyst", desc: "商業分析師（商業需求、流程梳理、流程文件）" },
    ],
    defaultSysprompt:
      "你是專案管理助手。根據 user 提供的角色、任務、背景，建議要建立的 Redmine issue。\n" +
      "請只回 JSON，符合提供的 schema。\n" +
      "每筆 issue 的 subject 必須以 user 指定的角色縮寫前綴開頭（例：[PG]開發前端 UI），≤80 字、簡潔具體、不重複。\n" +
      "如果能合理推估，再附 estimated_hours（小時，正數）/ start_date / due_date（YYYY-MM-DD）。\n" +
      "rationale 用一句話說明為何建議建這筆 issue（給 user 看的，繁體中文）。",
    defaultModel: "gemini-2.5-flash",
    outputSchema: {
      type: "object",
      properties: {
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              subject: { type: "string" },
              estimated_hours: { type: "number" },
              start_date: { type: "string" },
              due_date: { type: "string" },
              rationale: { type: "string" },
            },
            required: ["subject"],
          },
        },
      },
      required: ["issues"],
    },
    parseResponse: (data) => (data && Array.isArray(data.issues) ? data.issues : [])
      .filter((it) => it && typeof it.subject === "string" && it.subject.trim()),
  },
  // 未來: "schedule": {...}, "worklog": {...}
};

function findAgentForView(viewKey) {
  for (const [id, type] of Object.entries(AGENT_TYPES)) {
    if (type.targetView === viewKey) return id;
  }
  return null;
}

const AGENT_MODEL_OPTIONS = [
  "gemma-4-26b-it",
  "gemma-4-31b-it",
  "gemma-3-27b-it",
  "gemini-2.5-flash",
];

/* ===== AgentSettings：每個 agent 的 sysprompt + model 持久化 ===============
 * GM key: ai_agent_settings = { [agentTypeId]: { sysprompt, model } }
 * 沒設定的 agent 用 AGENT_TYPES[id].default*。
 */
const AgentSettings = (() => {
  const KEY = "ai_agent_settings";

  function loadAll() {
    return Store.get(KEY, {}) || {};
  }

  function get(agentTypeId) {
    const type = AGENT_TYPES[agentTypeId];
    if (!type) throw new Error(`unknown agent type: ${agentTypeId}`);
    const saved = loadAll()[agentTypeId] || {};
    return {
      sysprompt: typeof saved.sysprompt === "string" ? saved.sysprompt : type.defaultSysprompt,
      model: typeof saved.model === "string" && saved.model ? saved.model : type.defaultModel,
    };
  }

  function save(agentTypeId, { sysprompt, model }) {
    if (!AGENT_TYPES[agentTypeId]) throw new Error(`unknown agent type: ${agentTypeId}`);
    const all = loadAll();
    all[agentTypeId] = { sysprompt: sysprompt || "", model: model || "" };
    Store.set(KEY, all);
  }

  function reset(agentTypeId) {
    const all = loadAll();
    delete all[agentTypeId];
    Store.set(KEY, all);
  }

  return { get, save, reset };
})();

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
