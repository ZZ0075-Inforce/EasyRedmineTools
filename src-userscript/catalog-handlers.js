/* ===== Catalog handlers：projects / trackers 列表查詢 ====================== */

const CatalogHandlers = {
  async "GET /api/projects"(params) {
    // 單頁 forward (client side 自己 offset loop，方便漸進渲染)
    // Redmine /projects.json 預設只回 25 筆，limit 上限 100。
    const offset = Number(params.get("offset")) || 0;
    const limit = Math.min(Number(params.get("limit")) || 100, 100);
    const data = await redmineFetch(`/projects.json?limit=${limit}&offset=${offset}`);
    const list = Array.isArray(data.projects) ? data.projects : [];
    const projects = [];
    for (const p of list) {
      if (p && p.id) projects.push({
        id: Number(p.id),
        name: String(p.name || "").trim(),
        identifier: String(p.identifier || ""),
      });
    }
    return {
      projects,
      total_count: Number(data.total_count || projects.length),
      offset,
      limit,
    };
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
