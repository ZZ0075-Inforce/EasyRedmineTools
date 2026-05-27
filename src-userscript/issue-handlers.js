/* ===== Issue handlers：清單查詢 + 批次建立 + 套用排程日期 =================== */

const IssueHandlers = {
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
        // D 方案: cache > 1 hr stale 時 batch refresh subjects (回頭更新被異動的標題)
        const cutoff = dateStrDaysAgo(VisitedIssuesRegistry.getRetentionDays());
        let list = VisitedIssuesRegistry.isStale()
          ? await VisitedIssuesRegistry.refresh()
          : (Store.get("visited_issues", []) || []);
        list = list.filter(
          (x) => x && (x.last_visited_at || "") >= cutoff
        );
        if (dateFilter) list = list.filter((x) => x.last_visited_at === dateFilter);
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

  async "POST /api/issues/batch-create"(_params, body) {
    const projectId = Number(body && body.project_id);
    const trackerId = Number(body && body.tracker_id);
    const rows = Array.isArray(body && body.rows) ? body.rows : [];
    if (!Number.isFinite(projectId) || projectId <= 0) throw new Error("缺少有效的 project_id");
    if (!Number.isFinite(trackerId) || trackerId <= 0) throw new Error("缺少有效的 tracker_id");
    if (!rows.length) throw new Error("沒有要建立的 issue");

    // 抓本人 ID 作為預設指派人（部分 tracker 必填 assignee → 422）
    let assigneeId = null;
    try { assigneeId = await CurrentUserManager.get(); } catch {}

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
