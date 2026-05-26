/* ===== Catalog handlers：projects / trackers 列表查詢 ====================== */

const CatalogHandlers = {
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
};
