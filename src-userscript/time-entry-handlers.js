/* ===== Time entry handlers：activity cache + preview + commit ============== */

let __activitiesCache = null;

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

async function _fetchActivities() {
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
}

const TimeEntryHandlers = {
  async "GET /api/time-entry-activities"() {
    return _fetchActivities();
  },

  async "POST /api/time-entries/preview"(_params, body) {
    const spentOn = String(body.spent_on || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) throw new Error("spent_on 需為 YYYY-MM-DD");
    const acts = await _fetchActivities();
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

    for (const e of entries) {
      e.errors = validateEntry(e, manual);
    }

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

    const { token } = await TimeEntryPreviewSession.create(spentOn, entries);
    return { preview_token: token, spent_on: spentOn, entries, warnings };
  },

  async "POST /api/time-entries/commit"(_params, body) {
    const token = String(body.preview_token || "");
    await TimeEntryPreviewSession.validate(token, body.spent_on, body.entries);

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
    TimeEntryPreviewSession.consume(token);
    return { spent_on: body.spent_on, results };
  },
};
