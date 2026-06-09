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

  // 若該 view 對應有 AI Agent，回傳 collapsible AI section HTML；無則回空字串
  // AGENT_TYPES / AgentSettings / AGENT_MODEL_OPTIONS / findAgentForView 由
  // runtime.js (outer scope) 提供，直接 lexical lookup。
  function renderViewAiSectionHtml(viewKey) {
    if (typeof AGENT_TYPES === "undefined" || typeof AgentSettings === "undefined") return "";
    const agentId = findAgentForView(viewKey);
    if (!agentId) return "";
    const type = AGENT_TYPES[agentId];
    const cfg = AgentSettings.get(agentId);
    // 模型下拉來源依當前供應商：custom 用 /v1/models 抓回的清單，gemini 用寫死清單
    const modelList = (typeof AIProvider !== "undefined" ? AIProvider.getModelOptions() : AGENT_MODEL_OPTIONS) || [];
    // override=""→跟隨全域預設。follow 標籤要顯示「真正的全域預設」而非已解析值
    // （cfg.model 在有覆寫時等於覆寫值，拿來當 follow 標籤會誤導）
    const override = cfg.modelOverride || "";
    const inOptions = override && modelList.includes(override);
    const def = (typeof AIProvider !== "undefined" && AIProvider.getDefaultModel()) || type.defaultModel;
    const followOpt = `<option value="" ${override ? "" : "selected"}>（跟隨全域預設：${def || "未設定"}）</option>`;
    const modelOptions = followOpt + modelList
      .map((m) => `<option value="${m}" ${m === override ? "selected" : ""}>${m}</option>`)
      .join("");
    const customModel = (override && !inOptions) ? override : "";
    const safeSysprompt = (cfg.sysprompt || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `
      <details class="settings-ai-section" style="margin-top: 24px;">
        <summary>✨ AI Agent 設定</summary>
        <div class="field-stack" style="margin-top: 12px;">
          <span class="muted">Agent: <strong>${type.label}</strong></span>
          <label class="field-stack" style="margin-top: 12px;">
            <span>模型（覆寫全域預設，留空＝跟隨）</span>
            <select data-ai-agent-model="${agentId}">${modelOptions}</select>
          </label>
          <label class="field-stack" style="margin-top: 12px;">
            <span>自訂模型 ID（覆寫上方選擇，可留空）</span>
            <input type="text" data-ai-agent-custom-model="${agentId}" value="${customModel}" placeholder="例如 gemini-2.5-pro 或新發布的 model id">
          </label>
          <label class="field-stack" style="margin-top: 12px;">
            <span>Sysprompt</span>
            <textarea data-ai-agent-sysprompt="${agentId}" rows="8">${safeSysprompt}</textarea>
          </label>
          <div class="ai-settings-actions" style="display:flex; gap:8px; align-items:center; margin-top: 12px;">
            <button type="button" class="action-button" data-ai-agent-save="${agentId}">儲存</button>
            <button type="button" class="ghost-button" data-ai-agent-reset="${agentId}">重設為預設</button>
            <span class="muted" data-ai-agent-status="${agentId}" style="font-size:13px;"></span>
          </div>
        </div>
      </details>
    `;
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
    sec.innerHTML = renderViewSectionHtml(v.key) + renderViewAiSectionHtml(v.key);
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

  // ===== AI 助手 tab：Gemini API Key bind =====
  const aiKeyInput = body.querySelector("#setting-gemini-api-key");
  const aiKeyStatus = body.querySelector("#setting-gemini-api-key-status");
  if (aiKeyInput) {
    aiKeyInput.value = String(Store.get("gemini_api_key", "") || "");
    const persistAiKey = () => {
      Store.set("gemini_api_key", aiKeyInput.value.trim());
      if (aiKeyStatus) {
        aiKeyStatus.textContent = aiKeyInput.value.trim()
          ? "已儲存（所有 AI Agent 共用）"
          : "已清除 API Key";
      }
    };
    aiKeyInput.addEventListener("change", persistAiKey);
    aiKeyInput.addEventListener("blur", persistAiKey);
  }

  // ===== AI 助手 tab：供應商選擇 + 自訂供應商（Base URL / Key / 載入模型）bind =====
  // AIProvider / DEFAULT_CUSTOM_BASE_URL 由 runtime.js (outer scope) 提供。
  const providerSelect = body.querySelector("#setting-ai-provider");
  const geminiBlock = body.querySelector("#ai-provider-gemini");
  const customBlock = body.querySelector("#ai-provider-custom");
  const baseUrlInput = body.querySelector("#setting-ai-custom-base-url");
  const customKeyInput = body.querySelector("#setting-ai-custom-api-key");
  const loadModelsBtn = body.querySelector("#setting-ai-load-models");
  const modelsStatus = body.querySelector("#setting-ai-models-status");

  // 供應商切換 / 載入模型 / 改全域預設後，重建各功能 Agent 的「模型」下拉
  // 首選項＝跟隨全域預設（value=""），其餘為可選模型；保留現有覆寫值不被洗掉。
  function refreshAgentModelSelects() {
    if (typeof AIProvider === "undefined") return;
    const list = AIProvider.getModelOptions() || [];
    for (const sel of body.querySelectorAll("[data-ai-agent-model]")) {
      const cur = sel.value;  // ""=跟隨全域預設，或某個覆寫 model id
      const agentId = sel.getAttribute("data-ai-agent-model");
      const def = AIProvider.getDefaultModel()
        || (typeof AGENT_TYPES !== "undefined" && AGENT_TYPES[agentId] ? AGENT_TYPES[agentId].defaultModel : "");
      const opts = list.slice();
      if (cur && !opts.includes(cur)) opts.unshift(cur);  // 保留覆寫值
      sel.innerHTML =
        `<option value="" ${cur ? "" : "selected"}>（跟隨全域預設：${def || "未設定"}）</option>` +
        opts.map((m) => `<option value="${m}" ${m === cur ? "selected" : ""}>${m}</option>`).join("");
    }
  }

  function syncProviderBlocks(provider) {
    if (geminiBlock) geminiBlock.hidden = provider !== "gemini";
    if (customBlock) customBlock.hidden = provider !== "custom";
  }

  if (providerSelect) {
    const cur = Store.get("ai_provider", "gemini") === "custom" ? "custom" : "gemini";
    providerSelect.value = cur;
    syncProviderBlocks(cur);
    providerSelect.addEventListener("change", () => {
      const p = providerSelect.value === "custom" ? "custom" : "gemini";
      Store.set("ai_provider", p);
      syncProviderBlocks(p);
      refreshAgentModelSelects();
    });
  }

  if (baseUrlInput) {
    baseUrlInput.value = String(Store.get("ai_custom_base_url", "") || "");
    if (!baseUrlInput.value && typeof DEFAULT_CUSTOM_BASE_URL !== "undefined") {
      // 首次預填預設值並落地，讓切到自訂供應商時 configError 直接通過
      baseUrlInput.value = DEFAULT_CUSTOM_BASE_URL;
      Store.set("ai_custom_base_url", DEFAULT_CUSTOM_BASE_URL);
    }
    const persist = () => Store.set("ai_custom_base_url", baseUrlInput.value.trim());
    baseUrlInput.addEventListener("change", persist);
    baseUrlInput.addEventListener("blur", persist);
  }

  if (customKeyInput) {
    customKeyInput.value = String(Store.get("ai_custom_api_key", "") || "");
    const persist = () => Store.set("ai_custom_api_key", customKeyInput.value.trim());
    customKeyInput.addEventListener("change", persist);
    customKeyInput.addEventListener("blur", persist);
  }

  // ===== 全域預設模型（每供應商各一個）bind =====
  const geminiDefaultSelect = body.querySelector("#setting-ai-gemini-default-model");
  const geminiDefaultCustom = body.querySelector("#setting-ai-gemini-default-custom");
  const customDefaultSelect = body.querySelector("#setting-ai-custom-default-model");
  const customDefaultCustom = body.querySelector("#setting-ai-custom-default-custom");

  // 依清單重建某供應商的「預設模型」下拉，選回已存值（不在清單則放 custom input）
  function rebuildDefaultModelSelect(provider, selectEl, customEl, list) {
    if (typeof AIProvider === "undefined" || !selectEl) return;
    const cur = AIProvider.getDefaultModel(provider);
    const opts = (list || []).slice();
    const inList = cur && opts.includes(cur);
    selectEl.innerHTML =
      `<option value="">（未設定／用內建預設）</option>` +
      opts.map((m) => `<option value="${m}" ${m === cur ? "selected" : ""}>${m}</option>`).join("");
    if (customEl) customEl.value = (cur && !inList) ? cur : "";
  }

  function bindDefaultModelPicker(provider, selectEl, customEl) {
    if (typeof AIProvider === "undefined") return;
    const persist = () => {
      const custom = customEl ? customEl.value.trim() : "";
      const model = custom || (selectEl ? selectEl.value : "");
      AIProvider.setDefaultModel(provider, model);
      refreshAgentModelSelects();  // 改全域預設後，未覆寫的 Agent follow 標籤同步
    };
    if (selectEl) selectEl.addEventListener("change", persist);
    if (customEl) {
      customEl.addEventListener("change", persist);
      customEl.addEventListener("blur", persist);
    }
  }

  rebuildDefaultModelSelect("gemini", geminiDefaultSelect, geminiDefaultCustom,
    (typeof AGENT_MODEL_OPTIONS !== "undefined" ? AGENT_MODEL_OPTIONS : []));
  rebuildDefaultModelSelect("custom", customDefaultSelect, customDefaultCustom,
    (typeof AIProvider !== "undefined" ? AIProvider.getCustomModels() : []));
  bindDefaultModelPicker("gemini", geminiDefaultSelect, geminiDefaultCustom);
  bindDefaultModelPicker("custom", customDefaultSelect, customDefaultCustom);

  if (loadModelsBtn) {
    loadModelsBtn.addEventListener("click", async () => {
      if (typeof AIProvider === "undefined") return;
      // 先把當前輸入落地再抓（避免使用者改了 URL / key 還沒 blur）
      if (baseUrlInput) Store.set("ai_custom_base_url", baseUrlInput.value.trim());
      if (customKeyInput) Store.set("ai_custom_api_key", customKeyInput.value.trim());
      loadModelsBtn.disabled = true;
      if (modelsStatus) modelsStatus.textContent = "載入中…";
      try {
        const ids = await AIProvider.loadModels();
        if (modelsStatus) {
          modelsStatus.textContent = ids.length
            ? `已載入 ${ids.length} 個模型`
            : "連線成功但沒有可用模型";
        }
        // 載入後同步：自訂供應商「預設模型」下拉 + 各功能 Agent 下拉
        rebuildDefaultModelSelect("custom", customDefaultSelect, customDefaultCustom, ids);
        refreshAgentModelSelects();
      } catch (err) {
        if (modelsStatus) {
          modelsStatus.textContent = "載入失敗：" + (err && err.message ? err.message : String(err));
        }
      } finally {
        loadModelsBtn.disabled = false;
      }
    });
  }

  // ===== Per-view AI Agent section：sysprompt / model bind =====
  // AgentSettings / AGENT_TYPES / AGENT_MODEL_OPTIONS 由 runtime.js 提供 (outer
  // scope), 直接 lexical lookup。
  if (typeof AgentSettings !== "undefined" && typeof AGENT_TYPES !== "undefined") {
    for (const saveBtn of body.querySelectorAll("[data-ai-agent-save]")) {
      saveBtn.addEventListener("click", () => {
        const agentId = saveBtn.dataset.aiAgentSave;
        const sysprompt = body.querySelector(`[data-ai-agent-sysprompt="${agentId}"]`)?.value || "";
        const customInput = body.querySelector(`[data-ai-agent-custom-model="${agentId}"]`);
        const modelSelect = body.querySelector(`[data-ai-agent-model="${agentId}"]`);
        const custom = customInput ? customInput.value.trim() : "";
        const model = custom || (modelSelect ? modelSelect.value : "");
        AgentSettings.save(agentId, { sysprompt, model });
        refreshAgentModelSelects();  // 同步 follow 標籤 / 選取狀態
        const status = body.querySelector(`[data-ai-agent-status="${agentId}"]`);
        if (status) status.textContent = model ? `已儲存（覆寫模型：${model}）` : "已儲存（跟隨全域預設）";
      });
    }
    for (const resetBtn of body.querySelectorAll("[data-ai-agent-reset]")) {
      resetBtn.addEventListener("click", () => {
        const agentId = resetBtn.dataset.aiAgentReset;
        AgentSettings.reset(agentId);
        const cfg = AgentSettings.get(agentId);
        const sysprompt = body.querySelector(`[data-ai-agent-sysprompt="${agentId}"]`);
        const customInput = body.querySelector(`[data-ai-agent-custom-model="${agentId}"]`);
        const modelSelect = body.querySelector(`[data-ai-agent-model="${agentId}"]`);
        if (sysprompt) sysprompt.value = cfg.sysprompt;
        // reset 已刪除 per-agent 覆寫 → 模型回到「跟隨全域預設」
        if (modelSelect) modelSelect.value = "";
        if (customInput) customInput.value = "";
        refreshAgentModelSelects();  // 重建下拉並更新 follow 標籤
        const status = body.querySelector(`[data-ai-agent-status="${agentId}"]`);
        if (status) status.textContent = "已重設為預設";
      });
    }
  }

  // tab 切換 click 由既有 worklog_app.js 的 [data-settings-tab] querySelectorAll
  // 在 boot 階段（applySettingsPatches 之後）統一綁定，會自動涵蓋這些新 tab。
}
