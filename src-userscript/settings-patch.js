/* ===== 綁 sidebar 收合按鈕（Notion-style 收合）+ 設定 modal 注入 ========== */
function applySettingsPatches(root) {
  // Sidebar 收合（desktop）
  const appShell = root.querySelector(".app-shell");
  const sideToggle = root.querySelector("#side-nav-toggle");
  if (appShell && sideToggle) {
    // 還原使用者偏好
    if (Store.get("side_nav_collapsed", false)) {
      appShell.classList.add("collapsed");
    }
    sideToggle.addEventListener("click", () => {
      const collapsed = !appShell.classList.contains("collapsed");
      appShell.classList.toggle("collapsed", collapsed);
      Store.set("side_nav_collapsed", collapsed);
    });
  }

  // Mobile sidebar 抽屜 toggle（hamburger button）
  const mobileToggle = root.querySelector("#mobile-side-toggle");
  if (appShell && mobileToggle) {
    mobileToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      appShell.classList.toggle("mobile-open");
    });
    // 點 sidebar 內任一 view button 或 settings 按鈕後自動關抽屜
    appShell.addEventListener("click", (e) => {
      if (!appShell.classList.contains("mobile-open")) return;
      if (e.target.closest("[data-side-view]") || e.target.closest("#settings-button")) {
        appShell.classList.remove("mobile-open");
        return;
      }
      // 點 sidebar 外（即 main shell 區域）也關抽屜
      if (!e.target.closest(".side-nav") && !e.target.closest("#mobile-side-toggle")) {
        appShell.classList.remove("mobile-open");
      }
    });
  }

  const modal = root.querySelector("#settings-modal");
  if (!modal) return;

  const tabBar = modal.querySelector(".settings-tabs");
  const body = modal.querySelector(".settings-modal-body");
  if (!tabBar || !body) return;

  // 插入 tab 按鈕（放在「關於」之前）
  const aboutTab = tabBar.querySelector('[data-settings-tab="about"]');
  const authTab = document.createElement("button");
  authTab.className = "settings-tab";
  authTab.dataset.settingsTab = "auth";
  authTab.setAttribute("role", "tab");
  authTab.textContent = "連線";
  tabBar.insertBefore(authTab, aboutTab);

  // 插入 section（放在 about section 之前）
  const aboutSection = body.querySelector('[data-settings-section="about"]');
  const section = document.createElement("section");
  section.className = "settings-group";
  section.dataset.settingsSection = "auth";
  section.innerHTML = `
    <div class="settings-group-hint">
      預設使用你的 Redmine 登入 session。若遇到 401/403 或 CSRF 錯誤，可在下方貼入個人 API Key 作為備援。
      API Key 可從 Redmine「我的帳號 → API 存取金鑰」頁面取得。
    </div>
    <label class="field-stack">
      <span>Redmine API Key（選填）</span>
      <input type="password" id="redmine-api-key-input" placeholder="留空則使用登入 session" autocomplete="off">
    </label>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button class="action-button" id="save-api-key">儲存</button>
      <button class="ghost-button" id="clear-api-key">清除</button>
      <button class="ghost-button" id="test-connection">連線測試</button>
    </div>
    <div id="api-key-status" class="muted" style="font-size:13px; margin-top:10px; min-height:18px;"></div>
  `;
  body.insertBefore(section, aboutSection);

  // Handlers
  const input = section.querySelector("#redmine-api-key-input");
  const statusEl = section.querySelector("#api-key-status");
  const existing = Store.get("api_key", "");
  if (existing) {
    input.placeholder = "已設定（隱藏），重填可覆蓋";
    statusEl.textContent = "目前使用 API Key 認證";
  } else {
    statusEl.textContent = "目前使用登入 session";
  }

  section.querySelector("#save-api-key").addEventListener("click", () => {
    const v = (input.value || "").trim();
    if (!v) { statusEl.textContent = "未輸入，請先貼上 API Key"; return; }
    Store.set("api_key", v);
    input.value = "";
    input.placeholder = "已設定（隱藏），重填可覆蓋";
    statusEl.textContent = "已儲存 API Key，後續請求會改用 API Key 認證";
  });

  section.querySelector("#clear-api-key").addEventListener("click", () => {
    Store.del("api_key");
    input.value = "";
    input.placeholder = "留空則使用登入 session";
    statusEl.textContent = "已清除，回到登入 session 認證";
  });

  section.querySelector("#test-connection").addEventListener("click", async () => {
    statusEl.textContent = "測試中...";
    try {
      const data = await window.__worklog_redmineFetch("/users/current.json");
      const u = data.user || {};
      const name = [u.firstname, u.lastname].filter(Boolean).join(" ") || u.login || `#${u.id}`;
      statusEl.textContent = `✓ 連線成功：${name}（${u.mail || "-"}）`;
    } catch (err) {
      statusEl.textContent = `✗ ${err.message}`;
    }
  });

  // ===== 對應每個 sidebar 主功能注入一個 settings tab =====
  // 順序：外觀 → SIDE_VIEWS filter(inSettings) → 連線 → 關於
  // 來源：menu-injector.js 的 SIDE_VIEWS（single source of truth）
  const VIEW_TABS = SIDE_VIEWS.filter((v) => v.inSettings);

  function renderViewSectionHtml(key) {
    if (key === "worklog") {
      const curRet = Number(Store.get("visit_retention_days", 7)) || 7;
      const rawLimit = Number(Store.get("daily_hour_limit", 6.5));
      const curLimit = (Number.isFinite(rawLimit) && rawLimit >= 3 && rawLimit <= 12)
        ? Math.round(rawLimit * 2) / 2 : 6.5;
      const rawOffset = Number(Store.get("default_spent_on_offset", 1));
      const curOffset = (Number.isFinite(rawOffset) && rawOffset >= 0 && rawOffset <= 30)
        ? Math.floor(rawOffset) : 1;
      const offsetLabels = ["今天","昨天","前天","3 天前","4 天前","5 天前","6 天前","7 天前"];
      const offsetOptions = offsetLabels
        .map((label, i) => `<option value="${i}" ${i === curOffset ? "selected" : ""}>${label}</option>`)
        .join("");
      return `
        <div class="settings-group-hint">「填寫工時」相關預設值。</div>
        <label class="field-stack">
          <span>近期查閱保留天數</span>
          <input type="number" id="setting-visit-retention-days" min="1" max="365" value="${curRet}">
          <span class="muted">在 Redmine 點開過的 issue 會被記錄這幾天，當作「近期查閱」來源。預設 7 天，範圍 1-365。</span>
        </label>
        <div id="visit-retention-days-status" class="muted" style="font-size:13px; min-height:18px; margin-top:6px;"></div>

        <label class="field-stack" style="margin-top:18px;">
          <span>每日工時上限（小時）</span>
          <input type="number" id="setting-daily-hour-limit" min="3" max="12" step="0.5" value="${curLimit}">
          <span class="muted">下方總時數 badge 與兩週排程演算法用，超出會以紅字標示。預設 6.5h，範圍 3-12，0.5 為一階。</span>
        </label>
        <div id="daily-hour-limit-status" class="muted" style="font-size:13px; min-height:18px; margin-top:6px;"></div>

        <label class="field-stack" style="margin-top:18px;">
          <span>預設工時日期偏移</span>
          <select id="setting-default-spent-on-offset">${offsetOptions}</select>
          <span class="muted">每次開啟「填寫工時」預帶的工時日期。改完下次開啟生效（不會覆蓋目前正在編輯的日期）。</span>
        </label>
        <div id="default-spent-on-offset-status" class="muted" style="font-size:13px; min-height:18px; margin-top:6px;"></div>
      `;
    }
    return `<div class="settings-group-hint">本功能尚無可設定的預設值，未來會陸續加入。</div>`;
  }

  const appearanceTabEl = tabBar.querySelector('[data-settings-tab="appearance"]');
  const appearanceSection = body.querySelector('[data-settings-section="appearance"]');
  let lastTab = appearanceTabEl;
  let lastSection = appearanceSection;

  for (const v of VIEW_TABS) {
    const tab = document.createElement("button");
    tab.className = "settings-tab";
    tab.dataset.settingsTab = v.key;
    tab.setAttribute("role", "tab");
    tab.textContent = v.label;
    lastTab.insertAdjacentElement("afterend", tab);
    lastTab = tab;

    const sec = document.createElement("section");
    sec.className = "settings-group";
    sec.dataset.settingsSection = v.key;
    sec.innerHTML = renderViewSectionHtml(v.key);
    lastSection.insertAdjacentElement("afterend", sec);
    lastSection = sec;
  }

  // worklog tab：接 visit_retention_days 控制項
  const retentionInput = body.querySelector("#setting-visit-retention-days");
  const retentionStatus = body.querySelector("#visit-retention-days-status");
  if (retentionInput) {
    const persist = () => {
      let v = Number(retentionInput.value);
      if (!Number.isFinite(v) || v < 1) v = 1;
      if (v > 365) v = 365;
      retentionInput.value = String(v);
      Store.set("visit_retention_days", v);
      if (retentionStatus) {
        retentionStatus.textContent = `已儲存：保留 ${v} 天（下次刷新生效）`;
      }
    };
    retentionInput.addEventListener("change", persist);
    retentionInput.addEventListener("blur", persist);
  }

  // worklog tab：接 daily_hour_limit 控制項（即時生效）
  const limitInput = body.querySelector("#setting-daily-hour-limit");
  const limitStatus = body.querySelector("#daily-hour-limit-status");
  if (limitInput) {
    const persistLimit = () => {
      let v = Number(limitInput.value);
      if (!Number.isFinite(v) || v < 3) v = 3;
      if (v > 12) v = 12;
      v = Math.round(v * 2) / 2;
      limitInput.value = String(v);
      Store.set("daily_hour_limit", v);
      if (typeof window.__worklog_applySettingChange === "function") {
        window.__worklog_applySettingChange("daily_hour_limit", v);
      }
      if (limitStatus) limitStatus.textContent = `已儲存：每日上限 ${v}h（已即時生效）`;
    };
    limitInput.addEventListener("change", persistLimit);
    limitInput.addEventListener("blur", persistLimit);
  }

  // worklog tab：接 default_spent_on_offset 控制項（下次開啟生效）
  const offsetSelect = body.querySelector("#setting-default-spent-on-offset");
  const offsetStatus = body.querySelector("#default-spent-on-offset-status");
  if (offsetSelect) {
    offsetSelect.addEventListener("change", () => {
      const v = Math.max(0, Math.min(30, Math.floor(Number(offsetSelect.value) || 0)));
      Store.set("default_spent_on_offset", v);
      const labels = ["今天","昨天","前天","3 天前","4 天前","5 天前","6 天前","7 天前"];
      const label = labels[v] || `${v} 天前`;
      if (offsetStatus) offsetStatus.textContent = `已儲存：預設「${label}」（下次開啟生效）`;
    });
  }

  // tab 切換 click 由既有 worklog_app.js 的 [data-settings-tab] querySelectorAll
  // 在 boot 階段（applySettingsPatches 之後）統一綁定，會自動涵蓋這些新 tab。
}
