/* ===== Storage handlers：phrases / saved-queries / issue-templates(/defaults) CRUD === */

function sanitizePhrase(raw) {
  return {
    id: raw.id,
    label: String(raw.label || "").trim(),
    hours: raw.hours ? String(raw.hours) : "",
    activity_id: raw.activity_id === "" || raw.activity_id == null ? "" : Number(raw.activity_id),
    comments: String(raw.comments || ""),
  };
}

const StorageHandlers = {
  // ---- phrases ----
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

  // ---- saved-queries ----
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

  // ---- issue-templates ----
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

  // ---- issue-template-defaults（keyed by issue_id; 無 list 也無 POST）----
  // Per-issue default template snapshots (inline {hours, activity_id, comments})
  // snapshot 而非 phrase_id reference, 所以 phrase 刪除/改變不影響已設的 default
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
};
