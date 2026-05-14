// ==UserScript==
// @name         LawPJ Worklog Helper
// @namespace    https://github.com/ZZ0075-Inforce/EasyRedmineTools
// @version      1.0.202605141004
// @description  Easy Redmine 工時批次補登工具（Tampermonkey 版，session 免 API Key）
// @author       ZZ0075-Inforce
// @match        https://lawpj.lawbroker.com.tw/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/ZZ0075-Inforce/EasyRedmineTools/tampermonkey/dist/worklog.user.js
// @downloadURL  https://raw.githubusercontent.com/ZZ0075-Inforce/EasyRedmineTools/tampermonkey/dist/worklog.user.js
// ==/UserScript==

(function () {
  'use strict';

const APP_HTML = `<div class="pj-app-shell">
      <!-- Mobile only: hamburger to toggle sidebar drawer -->
      <button class="pj-mobile-side-toggle" id="pj-mobile-side-toggle" type="button" aria-label="開啟側邊欄">☰</button>
      <aside class="pj-side-nav" id="pj-side-nav">
        <div class="pj-side-nav-head">
          <span class="pj-side-nav-brand">⏱ Worklog</span>
          <button class="pj-side-nav-toggle" id="pj-side-nav-toggle" title="收合" aria-label="收合側邊欄">‹</button>
        </div>
        <nav class="pj-side-nav-body">
          <button class="pj-side-tab active" data-side-view="worklog">
            <span class="pj-side-tab-icon">📝</span>
            <span class="pj-side-tab-label">填寫工時</span>
          </button>
          <button class="pj-side-tab" data-side-view="schedule">
            <span class="pj-side-tab-icon">📅</span>
            <span class="pj-side-tab-label">兩週排程</span>
          </button>
          <button class="pj-side-tab" data-side-view="phrases">
            <span class="pj-side-tab-icon">✏️</span>
            <span class="pj-side-tab-label">工時模板</span>
          </button>
          <button class="pj-side-tab" data-side-view="sources">
            <span class="pj-side-tab-icon">🔍</span>
            <span class="pj-side-tab-label">PJ 篩選器</span>
          </button>
          <button class="pj-side-tab" data-side-view="issue-batch">
            <span class="pj-side-tab-icon">➕</span>
            <span class="pj-side-tab-label">批次建 issue</span>
          </button>
        </nav>
        <div class="pj-side-nav-foot">
          <button class="pj-side-tab" id="settings-button" title="設定">
            <span class="pj-side-tab-icon">⚙️</span>
            <span class="pj-side-tab-label">設定</span>
          </button>
        </div>
      </aside>
    <div class="shell">
      <section class="panel pj-main-toolbar" id="pj-main-toolbar">
        <div class="pj-source-tabs" id="pj-source-tabs"></div>
      </section>

      <div class="pj-main-view" data-view="worklog">
      <section class="layout">
        <article class="panel pj-list-panel">
          <div class="pj-workbench-header">
            <div>
              <span class="pj-section-title">
                Issue List <span class="pj-count-badge" id="issue-count">-</span>
              </span>
              <div class="muted" id="issue-summary">尚未載入</div>
            </div>
            <div class="muted">已選 <span id="selected-count">0 筆</span></div>
          </div>
          <div class="pj-list-toolbar">
            <input id="filter-search" type="text" placeholder="🔍 搜尋標題..." class="pj-filter-search-input">
            <div class="pj-toolbar-actions">
              <button class="pj-ghost-button" id="select-all-button">全選</button>
              <button class="pj-ghost-button" id="clear-selection-button">清空勾選</button>
              <button class="pj-action-button" id="refresh-button">重新整理</button>
            </div>
          </div>
          <div class="pj-date-filter-row">
            <span class="pj-date-filter-label" id="pj-date-filter-label">更新日期</span>
            <div class="pj-date-filter-buttons">
              <button class="pj-quick-btn active" data-day-filter="">全部</button>
              <button class="pj-quick-btn" data-day-filter="0">今天</button>
              <button class="pj-quick-btn" data-day-filter="1">昨天</button>
              <button class="pj-quick-btn" data-day-filter="2">前天</button>
            </div>
            <input id="filter-date" type="date" class="pj-date-filter-pick" title="自選日期">
          </div>
          <ul class="pj-issue-list" id="pj-issue-list"></ul>
        </article>

        <aside class="panel pj-details-panel">
          <div class="pj-workbench-header">
            <div>
              <span class="pj-section-title">工時填寫</span>
              <div class="muted" id="workbench-summary">先從左側勾選要補登工時的 issue。</div>
            </div>
          </div>
          <div class="pj-batch-meta">
            <label class="pj-field-stack">
              <span id="batch-spent-on-label">工時日期</span>
              <input id="batch-spent-on" type="date">
            </label>
            <div class="pj-date-quick-buttons" id="pj-date-quick-buttons">
              <button class="pj-quick-btn" data-spent-on-offset="1">昨天</button>
              <button class="pj-quick-btn" data-spent-on-offset="2">前天</button>
              <button class="pj-quick-btn" data-spent-on-offset="3">三天前</button>
            </div>
            <div class="pj-daily-total-badge" id="pj-daily-total-badge" title="已勾選送出的時數加總">0 / 6.5 h</div>
          </div>
          <div class="pj-alert-stack" id="pj-alert-stack"></div>
          <div class="pj-table-wrap" id="pj-table-wrap"></div>
          <div class="pj-sticky-actions" id="pj-sticky-actions">
            <span class="muted" id="sticky-summary">至少填入一筆工時後即可送出。</span>
            <button class="pj-action-button" id="commit-button">送出工時</button>
          </div>
          <div class="pj-sticky-actions" id="sticky-actions-schedule" style="display:none;">
            <span class="muted">送出會用目前的甘特分配，更新每筆 issue 的起迄日期</span>
            <button class="pj-action-button" id="schedule-apply-button">送出更新起迄日 →</button>
          </div>
        </aside>
      </section>
      </div><!-- /pj-main-view worklog -->

      <!-- 兩週排程使用相同 layout，但 pj-source-tabs 隱藏。重複一個 wrapper 不必，
           讓 schedule 共用 worklog view 容器即可（renderTopTabs 會切換 pj-main-toolbar 顯示） -->

      <div class="pj-main-view" data-view="phrases" hidden>
        <article class="panel pj-main-card-view">
          <div class="pj-view-head">
            <h2 class="pj-view-title">✏️ 工時模板</h2>
            <p class="muted">每筆工時卡片右上角的「快速填入」可一鍵套用模板。內容存在瀏覽器 GM 儲存。</p>
          </div>
          <div class="pj-alert-stack" id="phrases-alert-stack"></div>
          <div class="pj-add-form">
            <label class="pj-field-stack">
              <span>標籤 (選填)</span>
              <input type="text" id="phrase-label-input" placeholder="例：日常維運">
            </label>
            <div class="pj-phrase-field-grid">
              <label class="pj-field-stack compact">
                <span>預設時數 (選填)</span>
                <input type="number" step="0.1" min="0.1" id="phrase-hours-input">
              </label>
              <label class="pj-field-stack compact">
                <span>預設活動 (選填)</span>
                <span id="phrase-activity-wrap"></span>
              </label>
            </div>
            <label class="pj-field-stack">
              <span>預設備註 (選填)</span>
              <textarea id="phrase-comments-input"></textarea>
            </label>
            <div>
              <button class="pj-action-button" id="phrase-add-button">儲存模板</button>
              <button class="pj-ghost-button" id="phrase-cancel-button" style="display:none;">取消編輯</button>
            </div>
          </div>
          <div class="pj-drawer-list" id="phrases-list"></div>
        </article>
      </div><!-- /pj-main-view phrases -->

      <div class="pj-main-view" data-view="sources" hidden>
        <article class="panel pj-main-card-view">
          <div class="pj-view-head">
            <h2 class="pj-view-title">🔍 PJ 篩選器</h2>
            <p class="muted">把你在 Redmine 建好的自訂查詢（Custom Query）加入這裡作為「填寫工時」分頁。從 Redmine 網址列抓 <code>?query_id=X</code> 與顯示名稱貼進來即可。</p>
          </div>
          <div class="pj-alert-stack" id="sources-alert-stack"></div>
          <div class="pj-add-form">
            <label class="pj-field-stack">
              <span>顯示名稱</span>
              <input type="text" id="query-name-input" placeholder="例：我的任務分組">
            </label>
            <label class="pj-field-stack">
              <span>Query ID</span>
              <input type="number" min="1" id="query-id-input" placeholder="例：762">
            </label>
            <div>
              <button class="pj-action-button" id="query-add-button">新增 PJ 篩選器</button>
            </div>
          </div>
          <div class="pj-drawer-list" id="saved-queries-list"></div>
        </article>
      </div><!-- /pj-main-view sources -->

      <div class="pj-main-view" data-view="issue-batch" hidden>
        <article class="panel pj-batch-create-panel">
          <div class="pj-view-head">
            <h2 class="pj-view-title">批次建 issue</h2>
            <p class="muted">選一個專案 + 整批 tracker，從模板套用或手動新增列，一鍵建立多筆 issue。指派人預設為自己。</p>
          </div>

          <section class="pj-batch-section">
            <div class="pj-batch-issue-meta">
              <label class="pj-field-stack">
                <span>Project</span>
                <input type="text" id="batch-project-input" list="batch-projects-datalist" placeholder="搜尋專案名稱…" autocomplete="off">
                <datalist id="batch-projects-datalist"></datalist>
                <span class="muted pj-batch-project-hint" id="pj-batch-project-hint"></span>
              </label>
              <label class="pj-field-stack">
                <span>Tracker（整批套用）</span>
                <select id="batch-tracker-select"></select>
              </label>
            </div>
          </section>

          <section class="pj-batch-section">
            <div class="pj-batch-section-header">
              <h3 class="pj-section-subtitle">Issue 模板</h3>
              <span class="muted">勾選即加入下方表格；取消勾選即移除；點 ✎ 編輯、🗑 刪除</span>
            </div>
            <div id="batch-templates-picker" class="pj-batch-templates-picker-list"></div>
            <div class="pj-batch-edit-banner" id="pj-batch-edit-banner" hidden>
              <span>編輯中：<strong id="batch-edit-banner-subject"></strong></span>
              <button type="button" class="pj-ghost-button" id="batch-edit-banner-cancel">取消編輯</button>
            </div>
            <div class="pj-batch-template-add">
              <input type="text" id="issue-template-subject-input" placeholder="新增 / 編輯 subject（例：[SD]SD分析）">
              <button class="pj-action-button" id="issue-template-add-button">儲存模板</button>
              <button class="pj-ghost-button" id="issue-template-cancel-button" style="display:none;">取消</button>
            </div>
          </section>

          <section class="pj-batch-section">
            <div class="pj-batch-row-actions">
              <button class="pj-ghost-button" id="batch-add-blank-row-button">新增空白列</button>
              <button class="pj-ghost-button" id="batch-clear-rows-button">全部清空</button>
            </div>
            <div class="pj-table-wrap">
              <table class="pj-batch-rows-table" id="pj-batch-rows-table">
                <thead>
                  <tr>
                    <th class="pj-col-subject">Subject</th>
                    <th class="pj-col-hours">估計工時</th>
                    <th class="pj-col-date">開始日期</th>
                    <th class="pj-col-date">完成日期</th>
                    <th class="pj-col-remove"></th>
                  </tr>
                </thead>
                <tbody id="batch-rows-tbody"></tbody>
              </table>
            </div>
          </section>

          <div class="pj-alert-stack" id="batch-alert-stack"></div>

          <div class="pj-sticky-actions">
            <span class="muted" id="batch-summary">尚未加入任何列。</span>
            <button class="pj-action-button" id="batch-create-button">建立</button>
          </div>

          <div class="pj-drawer-list" id="batch-results-list"></div>
        </article>
      </div><!-- /pj-main-view issue-batch -->
    </div>
    </div>

    <!-- Settings Modal -->
    <div id="settings-modal" class="pj-modal-overlay" hidden aria-hidden="true">
      <div class="pj-modal-box pj-settings-modal-box" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div class="pj-modal-header">
          <h3 id="settings-modal-title">設定</h3>
          <button class="pj-modal-x" id="settings-modal-close" aria-label="關閉">&times;</button>
        </div>
        <div class="pj-settings-modal-content">
          <div class="pj-settings-tabs" role="tablist" aria-orientation="vertical">
            <button class="pj-settings-tab active" data-settings-tab="appearance" role="tab">外觀</button>
            <button class="pj-settings-tab" data-settings-tab="about" role="tab">關於</button>
          </div>
          <div class="pj-modal-body pj-settings-modal-body">

            <section class="pj-settings-group active" data-settings-section="appearance">
              <div class="pj-theme-option-group">
                <button class="pj-theme-option" data-theme-value="light">淺色</button>
                <button class="pj-theme-option" data-theme-value="dark">深色</button>
              </div>
            </section>

            <section class="pj-settings-group" data-settings-section="about">
              <div class="pj-about-row"><span class="muted">版本</span><span id="app-version">-</span></div>
              <div class="pj-about-row"><span class="muted">更新</span><span id="app-build-time">-</span></div>
            </section>

          </div>
        </div>
      </div>
    </div>

    <div class="pj-loading-mask" id="pj-loading-mask" aria-hidden="true">
      <div class="pj-loading-card">
        <div class="spinner" aria-hidden="true"></div>
        <strong id="loading-message">載入中...</strong>
      </div>
    </div>

    <!-- Commit Confirmation Modal -->
    <!-- Generic Confirm Modal（取代 browser confirm()） -->
    <div id="confirm-modal" class="pj-modal-overlay" hidden aria-hidden="true">
      <div class="pj-modal-box pj-modal-box-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <div class="pj-modal-header">
          <h3 id="confirm-modal-title">確認操作</h3>
          <button class="pj-modal-x" id="confirm-modal-close" aria-label="關閉">&times;</button>
        </div>
        <div class="pj-modal-body">
          <p id="pj-confirm-modal-body" class="pj-confirm-modal-body">確定要執行此操作嗎？</p>
        </div>
        <div class="pj-modal-footer">
          <button class="pj-ghost-button" id="confirm-modal-cancel">取消</button>
          <button class="pj-danger-button" id="confirm-modal-confirm">確認</button>
        </div>
      </div>
    </div>

    <!-- Toast container（短暫操作反饋） -->
    <div id="pj-toast-container" class="pj-toast-container" aria-live="polite" aria-atomic="false"></div>

    <div id="commit-modal" class="pj-modal-overlay" hidden aria-hidden="true">
      <div class="pj-modal-box" role="dialog" aria-modal="true" aria-labelledby="commit-modal-title">
        <div class="pj-modal-header">
          <h3 id="commit-modal-title">確認送出工時</h3>
          <button class="pj-modal-x" id="commit-modal-close" aria-label="關閉">&times;</button>
        </div>
        <div class="pj-modal-body">
          <div class="pj-modal-date-row">
            <label class="pj-modal-date-label" for="commit-modal-date">工時日期</label>
            <input type="date" id="commit-modal-date" class="input">
          </div>
          <div class="pj-modal-quick-dates">
            <button data-modal-offset="0">今天</button>
            <button data-modal-offset="1">昨天</button>
            <button data-modal-offset="2">前天</button>
          </div>
          <div id="commit-modal-date-warn" class="pj-modal-date-warn" hidden></div>
          <p id="commit-modal-summary" class="pj-modal-summary"></p>
        </div>
        <div class="pj-modal-footer">
          <button class="btn btn-secondary" id="commit-modal-cancel">取消</button>
          <button class="btn btn-primary" id="commit-modal-confirm">確認送出</button>
        </div>
      </div>
    </div>`;
const APP_CSS = `#__worklog_root {
        --bg: #f9f5f1;
        --panel: #fdfaf7;
        --panel-border: #e8e2da;
        --divider: #efe8e1;
        --ink: #2c2c2c;
        --muted: #4a4540;
        --accent: #d13a3a;
        --accent-hover: #b92f2f;
        --accent-soft: rgba(209, 58, 58, 0.08);
        --selected-bg: rgba(209, 58, 58, 0.06);
        --selected-border: rgba(209, 58, 58, 0.28);
        --success: #5c7a5a;
        --success-soft: rgba(92, 122, 90, 0.10);
        --danger: #b93838;
        --danger-soft: rgba(185, 56, 56, 0.08);
        --warn-bg: rgba(183, 121, 31, 0.08);
        --warn-bg-strong: rgba(183, 121, 31, 0.14);
        --warn-border: rgba(183, 121, 31, 0.24);
        --warn-text: #b7791f;
        --shadow: 0 1px 2px rgba(44,44,44,.04);
        --shadow-md: 0 2px 8px rgba(44,44,44,.06);
        --backdrop: rgba(15, 23, 42, 0.45);
        --input-bg: #fdfaf7;
        --hover-bg: rgba(44, 44, 44, 0.04);
        --card-bg: #fdfaf7;
        --subtle: #f3ede7;
      }#__worklog_root[data-theme="dark"] {
        color-scheme: dark;
        --bg: #1c1a17;
        --panel: #252220;
        --panel-border: #3a3531;
        --divider: #302c29;
        --ink: #f2ede7;
        --muted: #a8a29a;
        --accent: #e85454;
        --accent-hover: #d13a3a;
        --accent-soft: rgba(232, 84, 84, 0.1);
        --selected-bg: rgba(232, 84, 84, 0.1);
        --selected-border: rgba(232, 84, 84, 0.35);
        --success: #86a384;
        --success-soft: rgba(134, 163, 132, 0.14);
        --danger: #e85454;
        --danger-soft: rgba(232, 84, 84, 0.12);
        --warn-bg: rgba(218, 165, 32, 0.1);
        --warn-bg-strong: rgba(218, 165, 32, 0.18);
        --warn-border: rgba(218, 165, 32, 0.28);
        --warn-text: #dcb671;
        --shadow: 0 1px 2px rgba(0,0,0,.3);
        --shadow-md: 0 2px 8px rgba(0,0,0,.4);
        --backdrop: rgba(0, 0, 0, 0.65);
        --input-bg: #252220;
        --hover-bg: rgba(242, 237, 231, 0.05);
        --card-bg: #2a2624;
        --subtle: #302c29;
      }#__worklog_root * { box-sizing: border-box; }#__worklog_root {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--ink);
        font-family: "Noto Sans TC", "Inter", "PingFang TC", "Segoe UI", sans-serif;
        font-size: 15px;
        line-height: 1.55;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }#__worklog_root .pj-serif-heading {
        font-family: "Noto Serif TC", Georgia, serif;
        font-weight: 600;
        letter-spacing: -0.01em;
      }#__worklog_root button, #__worklog_root input, #__worklog_root select, #__worklog_root textarea { font: inherit; }#__worklog_root a { color: var(--accent); }#__worklog_root a:hover { color: var(--accent-hover); }#__worklog_root .shell {
        max-width: 1280px;
        margin: 0 auto;
        padding: 24px 16px 44px;
      }#__worklog_root .panel {
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        box-shadow: var(--shadow);
      }#__worklog_root .pj-main-view[hidden] { display: none !important; }#__worklog_root .pj-main-card-view {
        display: grid;
        grid-template-columns: minmax(320px, 380px) 1fr;
        grid-template-rows: auto 1fr;
        gap: 16px 24px;
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
        align-items: start;
      }#__worklog_root .pj-main-card-view .pj-view-head { grid-column: 1 / -1; margin-bottom: 4px; }#__worklog_root .pj-main-card-view .pj-add-form {
        grid-column: 1;
        align-self: start;
        position: sticky;
        top: 0;
      }#__worklog_root .pj-main-card-view .pj-drawer-list {
        grid-column: 2;
        gap: 8px;
      }#__worklog_root .pj-view-title {
        font-family: "Noto Serif TC", Georgia, serif;
        font-size: 22px;
        font-weight: 600;
        margin: 0 0 6px;
        letter-spacing: -0.01em;
      }@media (max-width: 760px) {#__worklog_root .pj-main-card-view {
          grid-template-columns: 1fr;
          gap: 16px;
          padding: 16px;
        }#__worklog_root .pj-main-card-view .pj-add-form, #__worklog_root .pj-main-card-view .pj-drawer-list { grid-column: 1; }#__worklog_root .pj-main-card-view .pj-add-form { position: static; }
      }#__worklog_root .pj-batch-create-panel {
        display: grid;
        gap: 20px;
        padding: 24px;
        max-width: 1100px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
      }#__worklog_root .pj-batch-create-panel .pj-view-head { margin-bottom: 0; }#__worklog_root .pj-batch-section { display: grid; gap: 12px; }#__worklog_root .pj-batch-section-header {
        display: flex;
        align-items: baseline;
        gap: 12px;
        flex-wrap: wrap;
      }#__worklog_root .pj-batch-issue-meta {
        display: grid;
        grid-template-columns: minmax(280px, 2fr) minmax(180px, 1fr);
        gap: 16px;
        align-items: end;
      }#__worklog_root .pj-batch-project-hint { font-size: 12px; }#__worklog_root .pj-batch-create-panel .pj-section-subtitle {
        font-size: 14px;
        font-weight: 600;
        margin: 0;
        color: var(--ink);
        border-left: 3px solid var(--accent);
        padding-left: 10px;
        line-height: 1.2;
      }#__worklog_root .pj-batch-templates-picker-list {
        display: flex; flex-wrap: wrap; gap: 8px;
        min-height: 44px;
        padding: 8px;
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        background: var(--subtle);
      }#__worklog_root .pj-batch-template-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 4px 2px 10px;
        border-radius: 18px;
        background: var(--panel);
        border: 1px solid var(--panel-border);
        font-size: 13px;
        white-space: nowrap;
      }#__worklog_root .pj-batch-template-chip.checked {
        background: var(--accent-soft);
        border-color: var(--accent);
      }#__worklog_root .pj-batch-template-chip.editing {
        background: var(--warn-bg);
        border-color: var(--warn-border);
      }#__worklog_root .pj-batch-template-chip-toggle {
        display: inline-flex; align-items: center; gap: 6px;
        cursor: pointer; user-select: none;
      }#__worklog_root .pj-batch-template-chip-toggle input { margin: 0; }#__worklog_root .pj-batch-template-chip-action {
        position: relative;
        display: inline-flex; align-items: center; justify-content: center;
        width: 28px; height: 28px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 50%;
        cursor: pointer;
        color: var(--muted);
        font-size: 14px;
        font-family: system-ui, -apple-system, "Segoe UI Symbol", "Apple Color Emoji", sans-serif;
        line-height: 1;
        padding: 0;
        transition: border-color 150ms ease-out, background 150ms ease-out, color 150ms ease-out;
      }#__worklog_root .pj-batch-template-chip-action:hover {
        background: var(--subtle);
        border-color: var(--panel-border);
        color: var(--ink);
      }#__worklog_root .pj-batch-edit-banner {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 12px;
        background: var(--warn-bg);
        border-left: 3px solid var(--warn-border);
        color: var(--warn-text);
        font-size: 13px;
        border-radius: 4px;
      }#__worklog_root .pj-batch-edit-banner strong { color: var(--ink); }#__worklog_root .pj-batch-edit-banner button { margin-left: auto; }#__worklog_root .pj-batch-template-add {
        display: flex; gap: 8px; align-items: center;
      }#__worklog_root .pj-batch-template-add input[type="text"] {
        flex: 1; min-width: 200px;
        
      }#__worklog_root .pj-batch-row-actions { display: flex; flex-wrap: wrap; gap: 8px; }#__worklog_root .pj-batch-rows-table { width: 100%; border-collapse: collapse; }#__worklog_root .pj-batch-rows-table th {
        text-align: left; font-size: 12px; font-weight: 600;
        color: var(--muted);
        padding: 8px 10px; border-bottom: 1px solid var(--panel-border);
      }#__worklog_root .pj-batch-rows-table td {
        padding: 8px 10px; vertical-align: middle;
        border-bottom: 1px solid var(--divider);
      }#__worklog_root .pj-batch-rows-table input {
        width: 100%; box-sizing: border-box;
        
      }#__worklog_root .pj-batch-rows-table .pj-hours-stepper { width: 100%; }#__worklog_root .pj-batch-rows-table th.pj-col-subject, #__worklog_root .pj-batch-rows-table td.pj-col-subject { min-width: 280px; }#__worklog_root .pj-batch-rows-table th.pj-col-hours, #__worklog_root .pj-batch-rows-table td.pj-col-hours { width: 130px; }#__worklog_root .pj-batch-rows-table th.pj-col-date, #__worklog_root .pj-batch-rows-table td.pj-col-date { width: 160px; }#__worklog_root .pj-batch-rows-table th.pj-col-remove, #__worklog_root .pj-batch-rows-table td.pj-col-remove { width: 80px; text-align: right; }#__worklog_root .pj-batch-empty-state {
        padding: 20px;
        text-align: center;
        color: var(--muted);
        font-size: 13px;
        display: grid;
        gap: 10px;
        justify-items: center;
      }#__worklog_root .pj-batch-result-card { padding: 8px 12px; border-radius: 6px; font-size: 13px; }#__worklog_root .pj-batch-result-card.ok {
        background: var(--success-soft);
        border-left: 3px solid var(--success);
      }#__worklog_root .pj-batch-result-card.fail {
        background: var(--danger-soft);
        border-left: 3px solid var(--danger);
      }#__worklog_root .pj-batch-create-panel .pj-sticky-actions {
        justify-content: space-between;
        max-width: 1100px;
        box-sizing: border-box;
      }#__worklog_root .pj-batch-create-panel #batch-summary {
        flex: 1;
        text-align: left;
      }#__worklog_root .pj-batch-create-panel #batch-summary.pj-has-rows {
        color: var(--ink);
        font-weight: 500;
      }@media (max-width: 760px) {#__worklog_root .pj-batch-create-panel { padding: 16px; }#__worklog_root .pj-batch-issue-meta { grid-template-columns: 1fr; }#__worklog_root .pj-batch-template-add { flex-wrap: wrap; }
      }#__worklog_root .pj-app-shell {
        display: grid;
        grid-template-columns: var(--side-nav-w, 200px) 1fr;
        height: 100%;
        min-height: 100%;
      }#__worklog_root .pj-app-shell.collapsed { --side-nav-w: 56px; }#__worklog_root .pj-side-nav {
        background: var(--panel);
        border-right: 1px solid var(--panel-border);
        display: flex;
        flex-direction: column;
        padding: 12px 8px;
        gap: 4px;
        overflow: hidden;
        transition: width 200ms ease;
      }#__worklog_root .pj-side-nav-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px 12px;
        border-bottom: 1px solid var(--divider);
        margin-bottom: 8px;
      }#__worklog_root .pj-side-nav-brand {
        font-family: "Noto Serif TC", Georgia, serif;
        font-weight: 600;
        font-size: 15px;
        color: var(--ink);
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }#__worklog_root .pj-side-nav-toggle {
        flex-shrink: 0;
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 150ms ease-out;
      }#__worklog_root .pj-side-nav-toggle:hover { background: var(--subtle); color: var(--ink); }#__worklog_root .pj-app-shell.collapsed .pj-side-nav-toggle { transform: rotate(180deg); }#__worklog_root .pj-app-shell.collapsed .pj-side-nav-brand { display: none; }#__worklog_root .pj-app-shell.collapsed .pj-side-nav-head {
        justify-content: center;
        border-bottom: 0;
        padding: 4px 0 12px;
      }#__worklog_root .pj-side-nav-body, #__worklog_root .pj-side-nav-foot { display: flex; flex-direction: column; gap: 2px; }#__worklog_root .pj-side-nav-body { flex: 1 1 auto; }#__worklog_root .pj-side-nav-foot { border-top: 1px solid var(--divider); padding-top: 8px; }#__worklog_root .pj-side-tab {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 8px 10px;
        border: 0;
        background: transparent;
        color: var(--ink);
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        text-align: left;
        border-radius: 6px;
        transition: background 150ms ease-out, color 150ms ease-out;
        white-space: nowrap;
      }#__worklog_root .pj-side-tab:hover { background: var(--subtle); }#__worklog_root .pj-side-tab.active { background: var(--accent-soft); color: var(--accent); }#__worklog_root .pj-side-tab-icon {
        flex-shrink: 0;
        font-size: 16px;
        line-height: 1;
        width: 22px;
        text-align: center;
      }#__worklog_root .pj-side-tab-label { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }#__worklog_root .pj-app-shell.collapsed .pj-side-tab-label { display: none; }#__worklog_root .pj-app-shell.collapsed .pj-side-tab { justify-content: center; padding: 10px 8px; }#__worklog_root .pj-main-toolbar { margin-bottom: 12px; overflow: hidden; }#__worklog_root .pj-main-toolbar .pj-source-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px 14px;
        align-items: center;
      }#__worklog_root .pj-list-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        padding: 0 0 10px;
        margin-bottom: 10px;
      }#__worklog_root .pj-filter-search-input {
        flex: 1 1 200px;
        min-width: 160px;
      }#__worklog_root .pj-date-filter-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        margin-bottom: 12px;
        border-radius: 8px;
        background: var(--subtle);
        border: 1px solid var(--panel-border);
      }#__worklog_root .pj-date-filter-label {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        margin-right: 4px;
      }#__worklog_root .pj-date-filter-buttons { display: flex; gap: 4px; flex-wrap: wrap; }#__worklog_root .pj-date-filter-pick {
        flex: 0 0 auto;
        width: auto !important;
        height: 32px !important;
        max-width: 160px;
        font-size: 12px;
        margin-left: auto;
      }#__worklog_root .pj-source-tab {
        border: 1px solid var(--panel-border);
        background: transparent;
        border-radius: 6px;
        padding: 8px 14px;
        cursor: pointer;
        font-size: 14px;
        color: var(--ink);
        white-space: nowrap;
        transition: background 150ms ease-out, border-color 150ms ease-out;
      }#__worklog_root .pj-source-tab:hover { background: var(--subtle); }#__worklog_root .pj-source-tab.active { background: var(--accent); color: white; border-color: var(--accent); }#__worklog_root .pj-source-tab .remove { margin-left: 6px; opacity: 0.7; cursor: pointer; }#__worklog_root .pj-source-spacer { flex: 1; }#__worklog_root .pj-filter-group {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 8px;
      }#__worklog_root .pj-toolbar-actions, #__worklog_root .pj-workbench-actions, #__worklog_root .pj-batch-meta-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }#__worklog_root .pj-nav-button, #__worklog_root .pj-action-button, #__worklog_root .pj-ghost-button, #__worklog_root .pj-danger-button {
        border: 0;
        border-radius: 6px;
        height: 40px;
        padding: 0 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        line-height: 1;
        transition: background 150ms ease-out, border-color 150ms ease-out;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }#__worklog_root .pj-action-button { background: var(--accent); color: white; }#__worklog_root .pj-action-button:hover { background: var(--accent-hover); }#__worklog_root .pj-ghost-button {
        background: transparent;
        color: var(--ink);
        border: 1px solid var(--panel-border);
      }#__worklog_root .pj-ghost-button:hover { background: var(--subtle); }#__worklog_root .pj-danger-button { background: transparent; color: var(--danger); border: 1px solid var(--panel-border); }#__worklog_root .pj-danger-button:hover { background: var(--danger-soft); border-color: var(--danger); }#__worklog_root button:disabled {
        opacity: 0.55;
        filter: grayscale(0.4);
        cursor: not-allowed;
      }#__worklog_root button:focus-visible, #__worklog_root[role="button"]:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }#__worklog_root .pj-theme-toggle {
        border: 0;
        background: transparent;
        font-size: 18px;
        cursor: pointer;
        padding: 8px;
        border-radius: 6px;
        height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }#__worklog_root .pj-theme-toggle:hover { background: var(--subtle); }#__worklog_root .pj-filter-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 40px;
        padding: 0 14px;
        border-radius: 6px;
        border: 1px solid var(--panel-border);
        background: var(--input-bg);
        color: var(--ink);
        cursor: pointer;
        font-size: 14px;
      }#__worklog_root .pj-filter-toggle:hover { background: var(--subtle); }#__worklog_root .pj-filter-toggle .pj-badge-dot {
        display: inline-block;
        width: 6px; height: 6px;
        border-radius: 50%;
        background: var(--accent);
      }#__worklog_root .pj-visited-quickdates {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px 12px;
        margin-bottom: 12px;
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        background: var(--subtle);
      }#__worklog_root .pj-visited-quickdates-label {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        margin-right: 4px;
      }#__worklog_root .pj-quick-btn {
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid var(--panel-border);
        background: var(--input-bg);
        color: var(--muted);
        cursor: pointer;
        font-size: 13px;
        transition: background 120ms;
      }#__worklog_root .pj-quick-btn:hover { background: var(--accent-soft); color: var(--accent); }#__worklog_root .pj-quick-btn.active { background: var(--accent); color: white; border-color: var(--accent); }#__worklog_root .tiny {
        padding: 4px 8px;
        font-size: 12px;
        border-radius: 6px;
        min-width: 28px;
      }#__worklog_root .layout { display: grid; grid-template-columns: 1fr; gap: 12px; }#__worklog_root .pj-list-panel, #__worklog_root .pj-details-panel { padding: 16px; }#__worklog_root .pj-workbench-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
      }#__worklog_root .pj-section-title {
        display: block;
        margin-bottom: 6px;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }#__worklog_root .pj-issue-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        max-height: 620px;
        overflow-y: auto;
      }#__worklog_root .pj-issue-card {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        background: var(--card-bg);
        padding: 10px 12px;
        box-shadow: var(--shadow);
        transition: border-color 120ms;
      }#__worklog_root .pj-issue-card.selected {
        background: var(--selected-bg);
        border-color: var(--selected-border);
      }#__worklog_root .pj-issue-select {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 10px;
        align-items: start;
        cursor: pointer;
        width: 100%;
      }#__worklog_root .pj-issue-select > span { display: block; min-width: 0; }#__worklog_root .pj-issue-checkbox {
        width: 18px; height: 18px;
        margin-top: 2px;
        cursor: pointer;
        accent-color: var(--accent);
      }#__worklog_root .pj-issue-heading-line {
        display: flex;
        align-items: baseline;
        gap: 6px;
        flex-wrap: wrap;
      }#__worklog_root .pj-issue-id { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }#__worklog_root .pj-issue-date { color: var(--muted); font-size: 12px; margin-left: auto; }#__worklog_root .pj-issue-title { font-size: 14px; line-height: 1.4; flex: 1 1 auto; }#__worklog_root .pj-tag-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }#__worklog_root .tag {
        display: inline-flex;
        padding: 2px 8px;
        border-radius: 6px;
        background: var(--subtle);
        color: var(--muted);
        font-size: 11px;
      }#__worklog_root .pj-count-badge {
        display: inline-flex;
        padding: 1px 8px;
        border-radius: 6px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        margin-left: 6px;
      }#__worklog_root .pj-project-group { list-style: none; }#__worklog_root .pj-project-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: var(--selected-bg);
        border-radius: 8px;
        cursor: pointer;
        user-select: none;
        margin-bottom: 6px;
        border: 1px solid transparent;
      }#__worklog_root .pj-project-header:hover { background: var(--accent-hover); border-color: var(--selected-border); }#__worklog_root .pj-group-arrow { color: var(--accent); font-size: 12px; width: 12px; }#__worklog_root .pj-group-name { flex: 1 1 auto; font-size: 14px; }#__worklog_root .pj-group-count { padding: 1px 8px; border-radius: 6px; background: var(--subtle); color: var(--muted); font-size: 12px; }#__worklog_root .pj-group-selected { font-size: 12px; color: var(--accent); }#__worklog_root .pj-group-issues { list-style: none; padding: 0 0 0 12px; margin: 0 0 8px; display: grid; gap: 6px; }#__worklog_root .pj-sched-project {
        list-style: none;
        padding: 10px 12px;
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        background: var(--card-bg);
        margin-bottom: 8px;
        box-shadow: var(--shadow);
      }#__worklog_root .pj-sched-project-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }#__worklog_root .pj-sched-issue { padding: 6px 0; border-top: 1px dashed var(--panel-border); }#__worklog_root .pj-sched-issue-line { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }#__worklog_root .pj-sched-issue-budget { display: flex; align-items: center; gap: 8px; font-size: 12px; }#__worklog_root .pj-sched-budget-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }#__worklog_root .pj-sched-budget { width: 70px; padding: 4px 8px; }#__worklog_root .pj-gantt-days { display: grid; gap: 8px; }#__worklog_root .pj-gantt-day {
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        padding: 10px 12px;
        background: var(--card-bg);
        box-shadow: var(--shadow);
      }#__worklog_root .pj-gantt-day.full { border-color: var(--selected-border); background: var(--selected-bg); }#__worklog_root .pj-gantt-day.empty { opacity: 0.65; }#__worklog_root .pj-gantt-day.partial { border-color: var(--warn-border); }#__worklog_root .pj-gantt-day-head { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }#__worklog_root .pj-gantt-items { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }#__worklog_root .pj-gantt-items li { display: flex; align-items: center; gap: 8px; font-size: 13px; }#__worklog_root .pj-gantt-hours {
        display: inline-flex;
        padding: 2px 8px;
        border-radius: 6px;
        background: var(--accent-soft);
        color: var(--accent);
        font-weight: 600;
        min-width: 44px;
        justify-content: center;
        font-size: 12px;
      }#__worklog_root .pj-gantt-issue { flex: 1 1 auto; }#__worklog_root .pj-sched-select-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        background: var(--card-bg);
        cursor: pointer;
        transition: all 120ms;
        box-shadow: var(--shadow);
      }#__worklog_root .pj-sched-select-card:hover { background: var(--hover-bg); }#__worklog_root .pj-sched-select-card.selected { border-color: var(--accent); background: var(--selected-bg); }#__worklog_root .pj-sched-select-card input[type="checkbox"] { width: auto; transform: scale(1.2); cursor: pointer; accent-color: var(--accent); }#__worklog_root .pj-sched-select-main { flex: 1 1 auto; }#__worklog_root .pj-sched-select-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; }#__worklog_root .pj-sched-select-meta { font-size: 12px; color: var(--muted); }#__worklog_root .pj-sched-footer-bar {
        position: sticky;
        bottom: 0;
        margin-top: 12px;
        padding: 10px 14px;
        border-radius: 10px;
        background: var(--panel);
        border: 1px solid var(--panel-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        box-shadow: var(--shadow-md);
      }#__worklog_root .pj-sched-breadcrumb { margin-bottom: 10px; }#__worklog_root .pj-sched-project.pj-drag-over, #__worklog_root .pj-sched-issue.pj-drag-over { outline: 2px dashed var(--accent); outline-offset: 2px; }#__worklog_root .pj-sched-project[draggable="true"], #__worklog_root .pj-sched-issue[draggable="true"] { cursor: grab; }#__worklog_root .pj-sched-project[draggable="true"]:active, #__worklog_root .pj-sched-issue[draggable="true"]:active { cursor: grabbing; }#__worklog_root .pj-budget-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        border-radius: 6px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 13px;
        cursor: pointer;
        border: 0;
      }#__worklog_root .pj-budget-badge.override { background: var(--warn-bg); color: var(--warn-text); }#__worklog_root .pj-budget-badge .pj-clear-override { font-size: 11px; opacity: 0.7; }#__worklog_root .pj-budget-input { width: 80px !important; padding: 4px 8px !important; font-size: 13px; }#__worklog_root .pj-batch-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
        padding: 12px 14px;
        border-radius: 10px;
        background: var(--subtle);
        border: 1px solid var(--panel-border);
      }#__worklog_root .pj-date-quick-buttons { display: flex; gap: 6px; align-self: end; }#__worklog_root .pj-field-stack { display: grid; gap: 6px; min-width: 200px; }#__worklog_root .pj-field-stack.compact { min-width: 160px; }#__worklog_root .pj-field-stack span {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }#__worklog_root .pj-daily-total-badge {
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        border-radius: 6px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 13px;
        font-weight: 600;
        border: 1px solid var(--selected-border);
      }#__worklog_root .pj-daily-total-badge.overflow {
        background: var(--warn-bg-strong);
        color: var(--warn-text);
        border-color: var(--warn-border);
      }#__worklog_root .pj-alert-stack { display: grid; gap: 8px; margin-bottom: 12px; }#__worklog_root .alert {
        padding: 12px 14px;
        border-radius: 10px;
        border: 1px solid var(--panel-border);
        background: var(--card-bg);
        line-height: 1.6;
        font-size: 14px;
      }#__worklog_root .alert.warn { background: var(--warn-bg); border-color: var(--warn-border); }#__worklog_root .pj-table-wrap {
        overflow-x: auto;
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        background: var(--card-bg);
      }#__worklog_root table { width: 100%; border-collapse: collapse; min-width: 680px; }#__worklog_root .pj-col-send { width: 64px; }#__worklog_root .pj-col-hours { width: 170px; }#__worklog_root .pj-col-activity { width: 180px; }#__worklog_root .pj-col-comments { width: 300px; }#__worklog_root .pj-col-check { width: 180px; }#__worklog_root th, #__worklog_root td { padding: 10px 12px; border-bottom: 1px solid var(--panel-border); vertical-align: top; }#__worklog_root th {
        text-align: left;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        background: var(--subtle);
      }#__worklog_root .pj-entry-issue-row td {
        padding: 10px 14px 6px;
        background: var(--subtle);
        border-bottom: 0;
        font-size: 14px;
        line-height: 1.4;
      }#__worklog_root .pj-entry-issue-id { color: var(--muted); font-size: 12px; margin-right: 6px; font-variant-numeric: tabular-nums; }#__worklog_root .pj-entry-issue-label { font-weight: 500; word-break: break-word; }#__worklog_root .pj-entry-issue-link { color: var(--accent); font-size: 13px; margin-left: 8px; text-decoration: none; opacity: 0.8; }#__worklog_root .pj-entry-issue-link:hover { opacity: 1; }#__worklog_root .pj-entry-fields-row td { padding: 8px 12px 10px; border-bottom: 0; }#__worklog_root tbody + tbody .pj-entry-issue-row td { border-top: 1px solid var(--panel-border); }#__worklog_root tbody.pj-row-focused .pj-entry-issue-row td { background: var(--selected-bg); }#__worklog_root tbody.pj-row-focused .pj-entry-fields-row td { background: var(--accent-soft); }#__worklog_root input[type="date"], #__worklog_root input[type="number"], #__worklog_root input[type="text"], #__worklog_root select, #__worklog_root textarea {
        width: 100%;
        height: 40px;
        padding: 0 12px;
        border-radius: 6px;
        border: 1px solid var(--panel-border);
        background: var(--input-bg);
        color: var(--ink);
        transition: border-color 150ms ease-out;
      }#__worklog_root input:focus-visible, #__worklog_root select:focus-visible, #__worklog_root textarea:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
        border-color: var(--accent);
      }#__worklog_root input::placeholder, #__worklog_root textarea::placeholder { color: var(--muted); }#__worklog_root textarea { height: auto; min-height: 88px; padding: 10px 12px; resize: vertical; line-height: 1.55; }#__worklog_root .pj-comment-cell textarea {
        min-height: 40px;
        height: 40px;
        padding: 9px 12px;
        line-height: 1.4;
        resize: vertical;
      }#__worklog_root .pj-hours-stepper {
        display: inline-flex;
        align-items: stretch;
        height: 40px;
        max-width: 180px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        overflow: hidden;
        background: var(--input-bg);
        transition: border-color 150ms ease-out;
      }#__worklog_root .pj-hours-stepper:focus-within {
        border-color: var(--accent);
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }#__worklog_root .pj-stepper-btn {
        width: 40px;
        flex-shrink: 0;
        border: 0;
        background: var(--subtle);
        color: var(--ink);
        cursor: pointer;
        font-size: 18px;
        font-weight: 500;
        line-height: 1;
        padding: 0;
        transition: background 150ms ease-out;
      }#__worklog_root .pj-stepper-btn:hover { background: var(--hover-bg); }#__worklog_root .pj-stepper-btn:active { background: var(--accent-soft); color: var(--accent); }#__worklog_root .pj-stepper-btn:disabled { opacity: 0.3; cursor: not-allowed; }#__worklog_root .pj-hours-stepper .pj-hours-input {
        border: 0;
        border-radius: 0;
        height: 100%;
        width: auto;
        flex: 1;
        min-width: 0;
        max-width: 80px;
        padding: 0 4px;
        text-align: center;
        background: transparent;
      }#__worklog_root .pj-hours-stepper .pj-hours-input:focus { outline: none; border-color: transparent; }#__worklog_root .pj-hours-input::-webkit-outer-spin-button, #__worklog_root .pj-hours-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }#__worklog_root .pj-hours-input { -moz-appearance: textfield; appearance: textfield; }#__worklog_root .pj-row-errors { margin: 0; padding-left: 16px; color: var(--danger); font-size: 13px; line-height: 1.5; }#__worklog_root .pj-duplicate-chip {
        display: inline-flex;
        margin-bottom: 6px;
        padding: 4px 10px;
        border-radius: 6px;
        background: var(--warn-bg);
        color: var(--warn-text);
        font-size: 12px;
        border: 1px solid var(--warn-border);
      }#__worklog_root .pj-duplicate-list, #__worklog_root .pj-result-list { margin: 0; padding-left: 16px; color: var(--muted); line-height: 1.55; }#__worklog_root .pj-mobile-label { display: none; }#__worklog_root .pj-draft-remove {
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        font-size: 16px;
        padding: 4px 6px;
        border-radius: 6px;
        line-height: 1;
      }#__worklog_root .pj-draft-remove:hover { background: var(--danger-soft); color: var(--danger); }#__worklog_root .pj-sticky-actions {
        position: sticky;
        bottom: 0;
        padding: 12px 16px;
        margin: 16px -16px -16px;
        background: var(--panel);
        border-top: 1px solid var(--divider);
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        border-radius: 0 0 10px 10px;
        box-shadow: 0 -2px 8px rgba(44,44,44,.04);
      }#__worklog_root .pj-send-note { margin-top: 10px; color: var(--muted); font-size: 13px; }#__worklog_root .pj-empty-state {
        padding: 20px;
        border-radius: 10px;
        background: var(--hover-bg);
        color: var(--muted);
        line-height: 1.7;
        font-size: 14px;
      }#__worklog_root .muted { color: var(--muted); }#__worklog_root .pj-helper-copy { color: var(--muted); line-height: 1.6; }#__worklog_root .pj-project-picker-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: end; }#__worklog_root .pj-phrase-field-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; }#__worklog_root .pj-phrase-preset-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }#__worklog_root .pj-preset-chip {
        display: inline-flex;
        padding: 3px 8px;
        border-radius: 6px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
      }#__worklog_root .pj-insert-btn {
        display: inline-flex;
        padding: 5px 10px;
        border-radius: 6px;
        border: 0;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        cursor: pointer;
      }#__worklog_root .pj-comment-cell { position: relative; }#__worklog_root .pj-phrase-chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }#__worklog_root .pj-phrase-chip {
        display: inline-flex;
        padding: 3px 10px;
        border-radius: 6px;
        border: 1px solid var(--selected-border);
        background: var(--selected-bg);
        color: var(--accent);
        font-size: 12px;
        cursor: pointer;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }#__worklog_root .pj-drawer-backdrop {
        position: fixed;
        inset: 0;
        background: var(--backdrop);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
        z-index: 5;
      }#__worklog_root .pj-drawer-backdrop.open { opacity: 1; pointer-events: auto; }#__worklog_root .drawer {
        position: fixed;
        top: 0; right: 0; bottom: 0;
        width: min(480px, 100vw);
        padding: 20px 16px 24px;
        background: var(--panel);
        color: var(--ink);
        border-left: 1px solid var(--panel-border);
        box-shadow: var(--shadow-md);
        transform: translateX(100%);
        transition: transform 180ms ease;
        overflow-y: auto;
        z-index: 10;
      }#__worklog_root .drawer.open { transform: translateX(0); }#__worklog_root .pj-drawer-header { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }#__worklog_root .pj-drawer-title { margin: 0; font-size: 20px; }#__worklog_root .pj-drawer-summary { margin-bottom: 14px; color: var(--muted); line-height: 1.65; font-size: 14px; }#__worklog_root .pj-drawer-list { display: grid; gap: 10px; }#__worklog_root .pj-item-card {
        padding: 12px;
        border-radius: 10px;
        border: 1px solid var(--panel-border);
        background: var(--card-bg);
        display: grid;
        gap: 8px;
      }#__worklog_root .pj-item-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }#__worklog_root .pj-item-title { margin: 0; font-size: 14px; }#__worklog_root .pj-phrase-text {
        margin: 0;
        white-space: pre-wrap;
        color: var(--ink);
        background: var(--hover-bg);
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        line-height: 1.5;
        font-size: 14px;
      }#__worklog_root .pj-phrase-text:hover { background: var(--accent-soft); }#__worklog_root .pj-phrase-actions { display: flex; gap: 6px; flex-wrap: wrap; }#__worklog_root .pj-add-form {
        display: grid;
        gap: 10px;
        padding: 12px;
        border-radius: 10px;
        background: var(--accent-soft);
        border: 1px solid var(--selected-border);
        margin-bottom: 12px;
      }#__worklog_root .pj-loading-mask {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        background: var(--backdrop);
        opacity: 0;
        pointer-events: none;
        transition: opacity 140ms ease;
        z-index: 40;
      }#__worklog_root .pj-loading-mask.open { opacity: 1; pointer-events: auto; }#__worklog_root .pj-loading-card {
        display: grid;
        justify-items: center;
        gap: 12px;
        min-width: 220px;
        padding: 22px 28px;
        border-radius: 10px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        box-shadow: var(--shadow-md);
      }#__worklog_root .spinner {
        width: 32px; height: 32px;
        border-radius: 50%;
        border: 3px solid var(--accent-soft);
        border-top-color: var(--accent);
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }#__worklog_root .pj-modal-overlay {
        position: fixed; inset: 0; z-index: 50;
        background: var(--backdrop);
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
      }#__worklog_root .pj-modal-overlay[hidden] { display: none; }#__worklog_root .pj-modal-box {
        background: var(--panel); border: 1px solid var(--panel-border);
        border-radius: 14px; width: 100%; max-width: 400px;
        box-shadow: 0 12px 40px rgba(0,0,0,.22);
      }#__worklog_root .pj-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px 12px; border-bottom: 1px solid var(--panel-border);
      }#__worklog_root .pj-modal-header h3 { margin: 0; font-size: 15px; font-weight: 600; }#__worklog_root .pj-modal-x {
        background: none; border: none; cursor: pointer;
        font-size: 18px; color: var(--muted); line-height: 1;
        padding: 2px 7px; border-radius: 4px;
      }#__worklog_root .pj-modal-x:hover { background: var(--subtle); }#__worklog_root .pj-modal-body { padding: 16px 20px; }#__worklog_root .pj-modal-date-row {
        display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
      }#__worklog_root .pj-modal-date-label { font-size: 13px; font-weight: 500; white-space: nowrap; }#__worklog_root .pj-modal-date-row input[type="date"] { flex: 1; }#__worklog_root .pj-modal-quick-dates { display: flex; gap: 6px; margin-bottom: 14px; }#__worklog_root .pj-modal-quick-dates button {
        flex: 1; padding: 5px 0; font-size: 12px;
        border: 1px solid var(--panel-border); border-radius: 6px;
        background: var(--subtle); color: var(--ink); cursor: pointer;
      }#__worklog_root .pj-modal-quick-dates button:hover {
        background: var(--accent); color: #fff; border-color: var(--accent);
      }#__worklog_root .pj-modal-date-warn {
        background: var(--warn-bg-strong); border: 1px solid var(--warn-border);
        border-radius: 6px; padding: 8px 10px;
        font-size: 12px; color: var(--warn-text); margin-bottom: 12px;
      }#__worklog_root .pj-modal-summary { font-size: 13px; color: var(--muted); margin: 0; }#__worklog_root .pj-modal-footer {
        display: flex; justify-content: flex-end; gap: 8px;
        padding: 12px 20px 16px; border-top: 1px solid var(--panel-border);
      }#__worklog_root .pj-settings-modal-box {
        max-width: 720px;
        max-height: 88vh;
        display: flex;
        flex-direction: column;
      }#__worklog_root .pj-settings-modal-content {
        display: flex;
        flex-direction: row;
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }#__worklog_root .pj-settings-tabs {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 12px 8px;
        border-right: 1px solid var(--panel-border);
        width: 160px;
        flex-shrink: 0;
        overflow-y: auto;
        overflow-x: hidden;
      }#__worklog_root .pj-settings-tabs::-webkit-scrollbar { display: none; }#__worklog_root .pj-settings-tab {
        text-align: left;
        border: 0;
        background: transparent;
        padding: 8px 12px;
        font-size: 13px;
        cursor: pointer;
        color: var(--muted);
        border-left: 3px solid transparent;
        border-radius: 0 6px 6px 0;
        white-space: nowrap;
        transition: color 120ms, border-color 120ms, background 120ms;
      }#__worklog_root .pj-settings-tab:hover {
        color: var(--ink);
        background: var(--subtle);
      }#__worklog_root .pj-settings-tab.active {
        color: var(--accent);
        border-left-color: var(--accent);
        background: var(--accent-soft);
        font-weight: 500;
      }#__worklog_root .pj-settings-modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px 24px;
        min-width: 0;
      }#__worklog_root .pj-settings-modal-body > [data-settings-section] { display: none; }#__worklog_root .pj-settings-modal-body > [data-settings-section].active { display: block; }#__worklog_root .pj-settings-group { margin-bottom: 0; }#__worklog_root .pj-settings-group-hint {
        font-size: 12px; color: var(--muted);
        margin-bottom: 10px; line-height: 1.6;
      }#__worklog_root .pj-settings-group-hint code {
        background: var(--subtle); padding: 1px 5px;
        border-radius: 4px; font-size: 11px;
      }#__worklog_root .pj-about-row {
        display: flex; justify-content: space-between;
        padding: 6px 0; font-size: 13px;
        border-bottom: 1px solid var(--panel-border);
      }#__worklog_root .pj-about-row:last-child { border-bottom: 0; }@media (max-width: 767px) {#__worklog_root .pj-settings-modal-box {
          max-height: calc(100vh - 32px);
          max-width: 100%;
        }#__worklog_root .pj-settings-modal-content { flex-direction: column; }#__worklog_root .pj-settings-tabs {
          flex-direction: row;
          width: auto;
          border-right: 0;
          border-bottom: 1px solid var(--panel-border);
          overflow-x: auto;
          overflow-y: hidden;
          padding: 4px 12px 0;
        }#__worklog_root .pj-settings-tab {
          border-left: 0;
          border-bottom: 2px solid transparent;
          border-radius: 0;
          margin-bottom: -1px;
        }#__worklog_root .pj-settings-tab.active {
          background: transparent;
          border-bottom-color: var(--accent);
          border-left-color: transparent;
        }
      }#__worklog_root .pj-entry-title-row {
        display: flex; align-items: center;
        gap: 10px; justify-content: space-between;
      }#__worklog_root .pj-entry-title-text { flex: 1; min-width: 0; }#__worklog_root .pj-entry-phrase-select {
        flex-shrink: 0;
        width: auto;
        max-width: 180px;
        height: 32px;
        font-size: 12px;
        padding: 0 8px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel);
        color: var(--ink);
        cursor: pointer;
      }@media (max-width: 767px) {#__worklog_root .pj-entry-phrase-select { max-width: 140px; }
      }#__worklog_root .pj-settings-section {
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 12px;
        background: var(--panel);
        box-shadow: var(--shadow);
      }#__worklog_root .pj-settings-nav-item {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 14px 16px;
        border: 0;
        background: transparent;
        color: var(--ink);
        font-size: 15px;
        cursor: pointer;
        gap: 10px;
        text-align: left;
        border-bottom: 1px solid var(--panel-border);
      }#__worklog_root .pj-settings-nav-item:last-child { border-bottom: 0; }#__worklog_root .pj-settings-nav-item:hover { background: var(--hover-bg); }#__worklog_root .pj-settings-nav-label { flex: 1; }#__worklog_root .pj-settings-nav-meta { color: var(--muted); font-size: 13px; }#__worklog_root .pj-settings-nav-arrow { color: var(--muted); font-size: 16px; }#__worklog_root .pj-settings-theme-row {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        gap: 10px;
        font-size: 15px;
      }#__worklog_root .pj-settings-theme-label { flex: 1; }#__worklog_root .pj-theme-option-group { display: flex; gap: 6px; }#__worklog_root .pj-theme-option {
        padding: 7px 14px;
        border-radius: 6px;
        border: 1px solid var(--panel-border);
        background: transparent;
        color: var(--muted);
        font-size: 14px;
        cursor: pointer;
        transition: all 120ms;
      }#__worklog_root .pj-theme-option.active { background: var(--accent); color: white; border-color: var(--accent); }@media (max-width: 767px) {#__worklog_root .shell { padding: 12px; }#__worklog_root .pj-app-shell { grid-template-columns: 1fr; }#__worklog_root .pj-side-nav {
          position: fixed;
          left: 0; top: 0; bottom: 0;
          width: 240px;
          z-index: 30;
          transform: translateX(-100%);
          box-shadow: 4px 0 16px rgba(0,0,0,.2);
        }#__worklog_root .pj-app-shell.pj-mobile-open .pj-side-nav { transform: translateX(0); }#__worklog_root .pj-side-nav-toggle { display: none; }#__worklog_root .pj-issue-list { max-height: none; }#__worklog_root .pj-source-tabs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }#__worklog_root .pj-source-tabs::-webkit-scrollbar { display: none; }#__worklog_root .pj-source-tabs .pj-source-spacer { display: none; }#__worklog_root .pj-sticky-actions {
          position: fixed;
          bottom: 0;
          left: 0; right: 0;
          margin: 0;
          border-radius: 0;
          z-index: 15;
          padding: 8px 12px;
          justify-content: stretch;
        }#__worklog_root .pj-sticky-actions .pj-ghost-button, #__worklog_root .pj-sticky-actions .pj-danger-button, #__worklog_root .pj-sticky-actions .pj-action-button { flex: 1; justify-content: center; }#__worklog_root #sticky-summary { display: none; }#__worklog_root .pj-table-wrap {
          overflow-x: visible;
          border: 0;
          border-radius: 0;
          background: transparent;
        }#__worklog_root table, #__worklog_root thead, #__worklog_root tr, #__worklog_root td, #__worklog_root th { display: block; }#__worklog_root thead tr { display: none; }#__worklog_root tbody[data-entry-row] {
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          margin-bottom: 10px;
          background: var(--panel);
          box-shadow: var(--shadow);
          overflow: hidden;
        }#__worklog_root tbody.pj-row-focused { border-color: var(--accent) !important; }#__worklog_root tbody.pj-row-focused .pj-entry-issue-row td { background: var(--selected-bg); }#__worklog_root tbody.pj-row-focused .pj-entry-fields-row td { background: var(--selected-bg); }#__worklog_root .pj-entry-issue-row td {
          padding: 12px 12px 8px;
          background: var(--subtle);
          border-bottom: 1px solid var(--panel-border) !important;
        }#__worklog_root tbody + tbody .pj-entry-issue-row td { border-top: 0; }#__worklog_root .pj-entry-fields-row {
          display: grid !important;
          grid-template-areas:
            "hours activity"
            "comments comments"
            "check check"
            "send send";
          grid-template-columns: 1fr 1fr;
        }#__worklog_root .pj-entry-fields-row td:nth-child(1) {
          grid-area: send;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-top: 1px solid var(--panel-border);
        }#__worklog_root .pj-entry-fields-row td:nth-child(2) { grid-area: hours; padding: 8px 6px 6px 12px; }#__worklog_root .pj-entry-fields-row td:nth-child(3) { grid-area: activity; padding: 8px 12px 6px 6px; }#__worklog_root .pj-entry-fields-row td:nth-child(4) { grid-area: comments; padding: 4px 12px 8px; }#__worklog_root .pj-entry-fields-row td:nth-child(5) {
          grid-area: check;
          padding: 6px 12px 8px;
          border-top: 1px dashed var(--panel-border);
        }#__worklog_root td { border-bottom: 0; }#__worklog_root .pj-mobile-label {
          display: block;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 4px;
        }#__worklog_root .pj-hours-input { max-width: none; }#__worklog_root .pj-col-send, #__worklog_root .pj-col-hours, #__worklog_root .pj-col-activity, #__worklog_root .pj-col-comments, #__worklog_root .pj-col-check { width: auto; }#__worklog_root .pj-batch-meta { flex-direction: column; align-items: stretch; }#__worklog_root .pj-date-quick-buttons { width: 100%; }#__worklog_root .pj-date-quick-buttons .pj-quick-btn { flex: 1; text-align: center; }#__worklog_root .pj-details-panel { padding-bottom: 80px; }#__worklog_root .pj-action-button, #__worklog_root .pj-ghost-button, #__worklog_root .pj-danger-button { min-height: 44px; }#__worklog_root .pj-quick-btn { min-height: 40px; }#__worklog_root input[type="date"], #__worklog_root input[type="number"], #__worklog_root input[type="text"], #__worklog_root select { min-height: 44px; }
      }@media (min-width: 768px) {#__worklog_root .layout { grid-template-columns: 1fr 1.2fr; gap: 16px; }
      }#__worklog_root .pj-modal-box-sm { max-width: 360px; }#__worklog_root .pj-confirm-modal-body {
        margin: 0;
        font-size: 14px;
        color: var(--ink);
        line-height: 1.55;
        white-space: pre-line;
      }#__worklog_root .pj-empty-state {
        display: grid;
        justify-items: center;
        gap: 10px;
        padding: 36px 20px;
        text-align: center;
        color: var(--muted);
      }#__worklog_root .pj-empty-state-icon { font-size: 36px; line-height: 1; opacity: 0.5; }#__worklog_root .pj-empty-state-title { font-size: 15px; color: var(--ink); font-weight: 500; }#__worklog_root .pj-empty-state-hint { font-size: 13px; max-width: 320px; }#__worklog_root .pj-toast-container {
        position: absolute;
        bottom: 20px;
        right: 20px;
        z-index: 50;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }#__worklog_root .toast {
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-left: 4px solid var(--accent);
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 13px;
        color: var(--ink);
        box-shadow: var(--shadow);
        max-width: 320px;
        animation: toast-in 200ms ease-out;
        pointer-events: auto;
      }#__worklog_root .toast.success { border-left-color: #4a9b6e; }#__worklog_root .toast.error { border-left-color: var(--danger, var(--accent)); }#__worklog_root .toast.info { border-left-color: var(--accent); }#__worklog_root .toast.fading { animation: toast-out 200ms ease-in forwards; }
      @keyframes toast-in {
        from { transform: translateX(20px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes toast-out {
        from { opacity: 1; }
        to { opacity: 0; transform: translateX(20px); }
      }#__worklog_root .pj-mobile-side-toggle {
        display: none;
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 25;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        color: var(--ink);
        font-size: 18px;
        cursor: pointer;
        box-shadow: var(--shadow);
        align-items: center;
        justify-content: center;
      }#__worklog_root .pj-mobile-side-toggle:hover { background: var(--subtle); }#__worklog_root .pj-schedule-back-button {
        margin-bottom: 8px;
        font-size: 13px;
      }@media (max-width: 767px) {#__worklog_root .pj-main-view { padding-bottom: 76px; }#__worklog_root .pj-mobile-side-toggle { display: inline-flex; }#__worklog_root .shell { padding-top: 56px; }#__worklog_root .pj-app-shell.pj-mobile-open::before {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--backdrop);
          z-index: 20;
        }#__worklog_root .pj-app-shell.pj-mobile-open .pj-side-nav { z-index: 30; }#__worklog_root .pj-settings-tabs {
          mask-image: linear-gradient(to right, black 88%, transparent);
          -webkit-mask-image: linear-gradient(to right, black 88%, transparent);
        }#__worklog_root .pj-toast-container { right: 12px; left: 12px; bottom: 80px; align-items: flex-end; }#__worklog_root .toast { max-width: none; width: 100%; }#__worklog_root .pj-batch-template-chip-action::before {
          content: "";
          position: absolute;
          inset: -6px;
        }
      }`;

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
  for (const prefix of ["/api/phrases/", "/api/saved-queries/", "/api/issue-templates/"]) {
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


/* ===== 綁 sidebar 收合按鈕（Notion-style 收合）+ 設定 modal 注入 ========== */
function applySettingsPatches(root) {
  // Sidebar 收合（desktop）
  const appShell = root.querySelector(".pj-app-shell");
  const sideToggle = root.querySelector("#pj-side-nav-toggle");
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
  const mobileToggle = root.querySelector("#pj-mobile-side-toggle");
  if (appShell && mobileToggle) {
    mobileToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      appShell.classList.toggle("pj-mobile-open");
    });
    // 點 sidebar 內任一 view button 或 settings 按鈕後自動關抽屜
    appShell.addEventListener("click", (e) => {
      if (!appShell.classList.contains("pj-mobile-open")) return;
      if (e.target.closest("[data-side-view]") || e.target.closest("#settings-button")) {
        appShell.classList.remove("pj-mobile-open");
        return;
      }
      // 點 sidebar 外（即 main shell 區域）也關抽屜
      if (!e.target.closest(".pj-side-nav") && !e.target.closest("#pj-mobile-side-toggle")) {
        appShell.classList.remove("pj-mobile-open");
      }
    });
  }

  const modal = root.querySelector("#settings-modal");
  if (!modal) return;

  const tabBar = modal.querySelector(".pj-settings-tabs");
  const body = modal.querySelector(".pj-settings-modal-body");
  if (!tabBar || !body) return;

  // 插入 tab 按鈕（放在「關於」之前）
  const aboutTab = tabBar.querySelector('[data-settings-tab="about"]');
  const authTab = document.createElement("button");
  authTab.className = "pj-settings-tab";
  authTab.dataset.settingsTab = "auth";
  authTab.setAttribute("role", "tab");
  authTab.textContent = "連線";
  tabBar.insertBefore(authTab, aboutTab);

  // 插入 section（放在 about section 之前）
  const aboutSection = body.querySelector('[data-settings-section="about"]');
  const section = document.createElement("section");
  section.className = "pj-settings-group";
  section.dataset.settingsSection = "auth";
  section.innerHTML = `
    <div class="pj-settings-group-hint">
      預設使用你的 Redmine 登入 session。若遇到 401/403 或 CSRF 錯誤，可在下方貼入個人 API Key 作為備援。
      API Key 可從 Redmine「我的帳號 → API 存取金鑰」頁面取得。
    </div>
    <label class="pj-field-stack">
      <span>Redmine API Key（選填）</span>
      <input type="password" id="redmine-api-key-input" placeholder="留空則使用登入 session" autocomplete="off">
    </label>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button class="pj-action-button" id="save-api-key">儲存</button>
      <button class="pj-ghost-button" id="clear-api-key">清除</button>
      <button class="pj-ghost-button" id="test-connection">連線測試</button>
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
  // 順序：外觀 → [worklog/schedule/phrases/sources/issue-batch] → 連線 → 關於
  const VIEW_TABS = [
    { key: "worklog",      label: "填寫工時" },
    { key: "schedule",     label: "兩週排程" },
    { key: "phrases",      label: "工時模板" },
    { key: "sources",      label: "PJ 篩選器" },
    { key: "issue-batch",  label: "批次建 issue" },
  ];

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
        <div class="pj-settings-group-hint">「填寫工時」相關預設值。</div>
        <label class="pj-field-stack">
          <span>近期查閱保留天數</span>
          <input type="number" id="setting-visit-retention-days" min="1" max="365" value="${curRet}">
          <span class="muted">在 Redmine 點開過的 issue 會被記錄這幾天，當作「近期查閱」來源。預設 7 天，範圍 1-365。</span>
        </label>
        <div id="visit-retention-days-status" class="muted" style="font-size:13px; min-height:18px; margin-top:6px;"></div>

        <label class="pj-field-stack" style="margin-top:18px;">
          <span>每日工時上限（小時）</span>
          <input type="number" id="setting-daily-hour-limit" min="3" max="12" step="0.5" value="${curLimit}">
          <span class="muted">下方總時數 badge 與兩週排程演算法用，超出會以紅字標示。預設 6.5h，範圍 3-12，0.5 為一階。</span>
        </label>
        <div id="daily-hour-limit-status" class="muted" style="font-size:13px; min-height:18px; margin-top:6px;"></div>

        <label class="pj-field-stack" style="margin-top:18px;">
          <span>預設工時日期偏移</span>
          <select id="setting-default-spent-on-offset">${offsetOptions}</select>
          <span class="muted">每次開啟「填寫工時」預帶的工時日期。改完下次開啟生效（不會覆蓋目前正在編輯的日期）。</span>
        </label>
        <div id="default-spent-on-offset-status" class="muted" style="font-size:13px; min-height:18px; margin-top:6px;"></div>
      `;
    }
    return `<div class="pj-settings-group-hint">本功能尚無可設定的預設值，未來會陸續加入。</div>`;
  }

  const appearanceTabEl = tabBar.querySelector('[data-settings-tab="appearance"]');
  const appearanceSection = body.querySelector('[data-settings-section="appearance"]');
  let lastTab = appearanceTabEl;
  let lastSection = appearanceSection;

  for (const v of VIEW_TABS) {
    const tab = document.createElement("button");
    tab.className = "pj-settings-tab";
    tab.dataset.settingsTab = v.key;
    tab.setAttribute("role", "tab");
    tab.textContent = v.label;
    lastTab.insertAdjacentElement("afterend", tab);
    lastTab = tab;

    const sec = document.createElement("section");
    sec.className = "pj-settings-group";
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


/* ===== Overlay mount ======================================================= */
const OVERLAY_ROOT_ID = "__worklog_root";
const BACKDROP_ID = "__worklog_backdrop";
const CLOSE_BTN_ID = "__worklog_close";

const LAUNCHER_CSS = `
#${BACKDROP_ID} {
  position: fixed !important;
  inset: 0 !important;
  background: rgba(0,0,0,.45);
  z-index: 2147483646 !important;
  animation: __worklog_fade_in 150ms ease-out;
}
@keyframes __worklog_fade_in { from { opacity: 0; } to { opacity: 1; } }

#${OVERLAY_ROOT_ID} {
  position: fixed !important;
  top: 32px !important;
  left: 32px !important;
  right: 32px !important;
  bottom: 32px !important;
  /* 必須覆寫 body→__worklog_root scoping 帶來的 min-height: 100vh */
  min-height: 0 !important;
  height: auto !important;
  max-height: calc(100vh - 64px) !important;
  z-index: 2147483647 !important;
  background: var(--bg, #f9f5f1);
  border: 1px solid var(--panel-border, #e8e2da);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0,0,0,.3);
  overflow: hidden;  /* 外層不滾，內層 .shell 自己 scroll */
}
#${OVERLAY_ROOT_ID} .pj-app-shell {
  height: 100% !important;
  overflow: hidden !important;
}
#${OVERLAY_ROOT_ID} .shell {
  overflow-y: auto !important;
  height: 100% !important;
  min-height: 0 !important;
}
/* 強制 sticky 元素留在 overlay 內，覆寫原本 mobile 的 position:fixed */
#${OVERLAY_ROOT_ID} .pj-sticky-actions {
  position: sticky !important;
  bottom: 0 !important;
  left: auto !important;
  right: auto !important;
  margin: 0 !important;
  width: auto !important;
  z-index: 5;
}
/* pj-details-panel 在 master 為應對 mobile 底部 tab bar 加了 80px padding，
   但 overlay 模式下 pj-sticky-actions 已 sticky 到 overlay 底，不需要這麼大留白 */
#${OVERLAY_ROOT_ID} .pj-details-panel { padding-bottom: 0 !important; }
/* master 的 .shell { max-width: 1280px } 在 overlay 大螢幕下會強制鎖寬，
   right 側留下大空白 → overlay 模式取消 max-width 撐滿 */
#${OVERLAY_ROOT_ID} .shell {
  max-width: none !important;
  padding: 16px !important;
  margin: 0 !important;
}

/* 防禦 Easy Redmine 頁面對 ul/li/label 的全域樣式可能干擾 pj-issue-card 寬度。
   pj-list-panel 內整條 chain 強制滿寬。 */
#${OVERLAY_ROOT_ID} .pj-issue-list,
#${OVERLAY_ROOT_ID} .pj-issue-list > li,
#${OVERLAY_ROOT_ID} .pj-issue-card,
#${OVERLAY_ROOT_ID} .pj-issue-select {
  width: 100% !important;
  box-sizing: border-box !important;
  margin-left: 0 !important;
  padding-left: 0 !important;
}
#${OVERLAY_ROOT_ID} .pj-issue-card {
  padding: 10px 12px !important;
}
#${OVERLAY_ROOT_ID} .pj-issue-select {
  display: grid !important;
  grid-template-columns: auto 1fr !important;
}
#${OVERLAY_ROOT_ID} .pj-issue-select > span {
  display: block !important;
  width: auto !important;
  min-width: 0 !important;
}
#${OVERLAY_ROOT_ID}[hidden],
#${BACKDROP_ID}[hidden],
#${CLOSE_BTN_ID}[hidden] { display: none !important; }

#${CLOSE_BTN_ID} {
  position: fixed !important;
  top: 32px;
  right: 32px;
  z-index: 2147483648 !important;
  width: 40px; height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,.9);
  border: 1px solid rgba(0,0,0,.1);
  color: #2c2c2c;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
  transition: background 150ms ease-out, transform 150ms ease-out;
}
#${CLOSE_BTN_ID}:hover { background: #fff; transform: scale(1.05); }

@media (max-width: 600px) {
  #${OVERLAY_ROOT_ID} {
    top: 12px !important; left: 12px !important;
    right: 12px !important; bottom: 12px !important;
  }
  #${CLOSE_BTN_ID} {
    top: 16px; right: 16px;
    width: 44px; height: 44px;
  }
}
`;

let __overlayMounted = false;
let __overlayRoot = null;
let __backdrop = null;
let __closeBtn = null;

function addCss(text) {
  if (typeof GM_addStyle !== "undefined") { GM_addStyle(text); return; }
  const style = document.createElement("style");
  style.textContent = text;
  document.head.appendChild(style);
}

function mountOverlay() {
  if (__overlayMounted) {
    showOverlay();
    return;
  }

  // LAUNCHER_CSS 含 #__worklog_root 的 fixed 定位 + backdrop + close 按鈕樣式，
  // 必須在 mountOverlay 注入，否則 overlay 沒拿到 position: fixed 會掉到 body 末端。
  addCss(LAUNCHER_CSS);
  addCss(APP_CSS);

  // 半透明 backdrop（點擊可關閉）
  __backdrop = document.createElement("div");
  __backdrop.id = BACKDROP_ID;
  __backdrop.addEventListener("click", hideOverlay);
  document.body.appendChild(__backdrop);

  // Overlay root
  __overlayRoot = document.createElement("div");
  __overlayRoot.id = OVERLAY_ROOT_ID;
  __overlayRoot.innerHTML = APP_HTML;
  document.body.appendChild(__overlayRoot);

  // 關閉按鈕（永遠可見、最高 z-index）
  __closeBtn = document.createElement("button");
  __closeBtn.id = CLOSE_BTN_ID;
  __closeBtn.type = "button";
  __closeBtn.textContent = "✕";
  __closeBtn.title = "關閉（ESC）";
  __closeBtn.setAttribute("aria-label", "關閉工時助手");
  __closeBtn.addEventListener("click", hideOverlay);
  document.body.appendChild(__closeBtn);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && __overlayMounted && !__overlayRoot.hidden) {
      hideOverlay();
    }
  });

  // 用 SIDE_VIEWS 動態 render sidebar，跟 menu 子項共用同一份來源
  const sideBody = __overlayRoot.querySelector(".pj-side-nav-body");
  if (sideBody && Array.isArray(SIDE_VIEWS)) {
    sideBody.innerHTML = SIDE_VIEWS.map((v) => `
      <button class="pj-side-tab" data-side-view="${v.key}">
        <span class="pj-side-tab-icon">${v.icon}</span>
        <span class="pj-side-tab-label">${v.label}</span>
      </button>
    `).join("");
  }

  applySettingsPatches(__overlayRoot);
  __initWorklogApp();
  __overlayMounted = true;
}

function showOverlay() {
  if (!__overlayMounted) return;
  __overlayRoot.hidden = false;
  __backdrop.hidden = false;
  __closeBtn.hidden = false;
}

function hideOverlay() {
  if (!__overlayMounted) return;
  __overlayRoot.hidden = true;
  __backdrop.hidden = true;
  __closeBtn.hidden = true;
}

function toggleOverlay() {
  if (!__overlayMounted) { mountOverlay(); return; }
  if (__overlayRoot.hidden) showOverlay();
  else hideOverlay();
}


/* ===== 把工時助手入口注入到 Redmine 頂部 menu「問題清單」後面 ============= */
const MENU_LI_ID = "worklog-helper-menu-item";

/* Single source of truth：sidebar 與頂部 menu 子項共用此陣列。
   要加新功能項只改這裡，sidebar 跟 menu 都會自動同步。 */
const SIDE_VIEWS = [
  { key: "worklog",         icon: "📝", iconClass: "icon icon-time",   label: "填寫工時" },
  { key: "schedule",        icon: "📅", iconClass: "icon icon-stats",  label: "兩週排程" },
  { key: "phrases",         icon: "✏️", iconClass: "icon icon-edit",   label: "工時模板" },
  { key: "sources",         icon: "🔍", iconClass: "icon icon-filter", label: "PJ 篩選器" },
  { key: "issue-batch",     icon: "➕", iconClass: "icon icon-add",    label: "批次建 issue" },
];
window.__worklog_SIDE_VIEWS = SIDE_VIEWS;

function injectTopMenu() {
  const topMenu = document.getElementById("top-menu-container");
  if (!topMenu) return false;
  if (document.getElementById(MENU_LI_ID)) return true;

  // 找「問題清單」<li>（class 含 issues 的 a 標籤的 parent li）
  const issuesAnchor = topMenu.querySelector('a.issues');
  const issuesLi = issuesAnchor ? issuesAnchor.closest("li") : null;

  const li = document.createElement("li");
  li.id = MENU_LI_ID;
  li.className = "with-easy-submenu";
  const childrenHtml = SIDE_VIEWS.map((v) =>
    `<li><a href="#" class="${v.iconClass}" data-worklog-mode="${v.key}">${v.label}</a></li>`
  ).join("");
  li.innerHTML = `
    <a class="worklog issues" href="#" id="worklog-helper-menu-link">⏱ 工時助手</a>
    <span class="easy-top-menu-more-toggler" data-menu-toggle="true" id="worklog-helper-menu-toggler">
      <i class="icon-arrow down"></i>
    </span>
    <ul class="menu-children easy-menu-children" id="worklog-helper-menu-children" style="display:none">
      ${childrenHtml}
    </ul>
  `;

  if (issuesLi && issuesLi.parentNode === topMenu) {
    issuesLi.insertAdjacentElement("afterend", li);
  } else {
    topMenu.appendChild(li);
  }

  // 主連結 → 開 overlay 預設 worklog
  document.getElementById("worklog-helper-menu-link").addEventListener("click", (e) => {
    e.preventDefault();
    openOverlayAt("worklog");
    closeMenuChildren();
  });

  // 子選單項目 → 開 overlay 並切到對應模式
  for (const a of li.querySelectorAll("[data-worklog-mode]")) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openOverlayAt(a.dataset.worklogMode);
      closeMenuChildren();
    });
  }

  // 子選單展開/收合（複製 Redmine 行為）
  const toggler = document.getElementById("worklog-helper-menu-toggler");
  const children = document.getElementById("worklog-helper-menu-children");
  toggler.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    children.style.display = children.style.display === "none" ? "block" : "none";
  });

  function closeMenuChildren() {
    if (children) children.style.display = "none";
  }

  // 點選單外部 / 按 ESC 自動關閉子選單
  document.addEventListener("click", (e) => {
    if (children.style.display === "none") return;
    if (li.contains(e.target)) return;
    closeMenuChildren();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && children.style.display !== "none") {
      closeMenuChildren();
    }
  });

  return true;
}

/* 打開 overlay 並切到指定模式（worklog / schedule）。
   無 overlay 時 mountOverlay；已 mount 過則 showOverlay 然後找對應 sidebar tab click。 */
function openOverlayAt(mode) {
  if (typeof __overlayMounted !== "undefined" && !__overlayMounted) {
    mountOverlay();
  } else {
    showOverlay();
  }
  // 等下個 frame 確保 DOM 已就緒（特別是首次 mount）
  requestAnimationFrame(() => {
    const target = document.querySelector(
      `#__worklog_root [data-side-view="${mode}"]`
    );
    if (target) target.click();
  });
}

window.__worklog_openAt = openOverlayAt;
window.__worklog_injectTopMenu = injectTopMenu;


let __worklogAppInited = false;
function __initWorklogApp() {
  if (__worklogAppInited) return;
  __worklogAppInited = true;
const STORAGE_KEY = "lawpj.worklog.v1";
const APP_VERSION = "1.0.202605141004";
const APP_BUILD_TIME = "2026-05-14 10:04";

const state = {
  localToday: localDateString(new Date()),
  currentSource: { type: "mine" },
  savedQueries: [],
  filterDate: "",
  filterSearch: "",
  sideView: "worklog",  // sidebar 切換的 view: worklog / schedule / phrases / sources / issue-templates / issue-batch
  issueTemplates: [],
  editingIssueTemplateId: null,
  issueTemplatesWarnings: [],
  projectsList: [],
  projectsLoaded: false,
  trackersList: [],
  trackersLoaded: false,
  batchProjectId: null,
  batchProjectInputValue: "",
  batchTrackerId: null,
  batchSelectedTemplateIds: new Set(),
  batchRows: [],
  batchResults: [],
  batchWarnings: [],
  batchPrereqLoading: false,
  issues: [],
  draftEntries: [],
  previewToken: "",
  activities: [],
  manualActivityEntry: true,
  activityWarnings: [],
  issueWarnings: [],
  previewWarnings: [],
  commitResults: [],
  phrases: [],
  phrasesWarnings: [],
  sourcesWarnings: [],
  batchSpentOn: "",
  settingsOpen: false,
  settingsTab: "appearance",
  editingPhraseId: null,
  isLoading: false,
  loadingMessage: "",
  expandedProjects: new Set(),
  scheduleStage: "select",
  scheduleSelectedProjectIds: new Set(),
  scheduleProjectOrder: [],
  scheduleIssueOrder: {},
  scheduleBudgets: {},
  budgetEditIssueId: null,
  dailyHourLimit: 6.5,
  theme: "light",
  scheduleCommitResults: [],
};

let dragContext = null;
const THEME_KEY = "lawpj.theme";

let lastFocusedEntryId = null;

const elements = {
  issueCount: document.getElementById("issue-count"),
  selectedCount: document.getElementById("selected-count"),
  sourceTabs: document.getElementById("pj-source-tabs"),
  filterDate: document.getElementById("filter-date"),
  filterSearch: document.getElementById("filter-search"),
  dailyTotalBadge: document.getElementById("pj-daily-total-badge"),
  stickyActions: document.getElementById("pj-sticky-actions"),
  stickySummary: document.getElementById("sticky-summary"),
  stickyActionsSchedule: document.getElementById("sticky-actions-schedule"),
  scheduleApplyButton: document.getElementById("schedule-apply-button"),
  issueSummary: document.getElementById("issue-summary"),
  workbenchSummary: document.getElementById("workbench-summary"),
  issueList: document.getElementById("pj-issue-list"),
  alertStack: document.getElementById("pj-alert-stack"),
  tableWrap: document.getElementById("pj-table-wrap"),
  refreshButton: document.getElementById("refresh-button"),
  selectAllButton: document.getElementById("select-all-button"),
  clearSelectionButton: document.getElementById("clear-selection-button"),
  commitButton: document.getElementById("commit-button"),
  settingsButton: document.getElementById("settings-button"),
  settingsModal: document.getElementById("settings-modal"),
  settingsModalClose: document.getElementById("settings-modal-close"),
  batchSpentOn: document.getElementById("batch-spent-on"),
  batchDateHelper: document.getElementById("batch-date-helper"),
  phrasesList: document.getElementById("phrases-list"),
  phraseLabelInput: document.getElementById("phrase-label-input"),
  phraseHoursInput: document.getElementById("phrase-hours-input"),
  phraseActivityWrap: document.getElementById("phrase-activity-wrap"),
  phraseCommentsInput: document.getElementById("phrase-comments-input"),
  phraseAddButton: document.getElementById("phrase-add-button"),
  phraseCancelButton: document.getElementById("phrase-cancel-button"),
  queryNameInput: document.getElementById("query-name-input"),
  queryIdInput: document.getElementById("query-id-input"),
  queryAddButton: document.getElementById("query-add-button"),
  savedQueriesList: document.getElementById("saved-queries-list"),
  loadingMask: document.getElementById("pj-loading-mask"),
  loadingMessage: document.getElementById("loading-message"),
  commitModal: document.getElementById("commit-modal"),
  commitModalDate: document.getElementById("commit-modal-date"),
  commitModalDateWarn: document.getElementById("commit-modal-date-warn"),
  commitModalSummary: document.getElementById("commit-modal-summary"),
  commitModalConfirm: document.getElementById("commit-modal-confirm"),
  commitModalCancel: document.getElementById("commit-modal-cancel"),
  commitModalClose: document.getElementById("commit-modal-close"),
  issueTemplateSubjectInput: document.getElementById("issue-template-subject-input"),
  issueTemplateAddButton: document.getElementById("issue-template-add-button"),
  issueTemplateCancelButton: document.getElementById("issue-template-cancel-button"),
  batchEditBanner: document.getElementById("pj-batch-edit-banner"),
  batchEditBannerSubject: document.getElementById("batch-edit-banner-subject"),
  batchEditBannerCancel: document.getElementById("batch-edit-banner-cancel"),
  batchProjectInput: document.getElementById("batch-project-input"),
  batchProjectsDatalist: document.getElementById("batch-projects-datalist"),
  batchProjectHint: document.getElementById("pj-batch-project-hint"),
  batchTrackerSelect: document.getElementById("batch-tracker-select"),
  batchTemplatesPicker: document.getElementById("batch-templates-picker"),
  batchAddBlankRowButton: document.getElementById("batch-add-blank-row-button"),
  batchClearRowsButton: document.getElementById("batch-clear-rows-button"),
  batchRowsTbody: document.getElementById("batch-rows-tbody"),
  batchAlertStack: document.getElementById("batch-alert-stack"),
  batchSummary: document.getElementById("batch-summary"),
  batchCreateButton: document.getElementById("batch-create-button"),
  batchResultsList: document.getElementById("batch-results-list"),
  phrasesAlertStack: document.getElementById("phrases-alert-stack"),
  sourcesAlertStack: document.getElementById("sources-alert-stack"),
};

/* ===== Toast：短暫操作反饋 (success / error / info)，自動消失 ============== */
function showToast(message, { type = "success", duration = 2500 } = {}) {
  const container = document.getElementById("pj-toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fading");
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

/* ===== Confirm modal：取代 browser confirm()，回傳 Promise<boolean> ======== */
function showConfirmModal({ title = "確認操作", body = "確定要執行此操作嗎？", confirmText = "確認", cancelText = "取消", danger = true } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    if (!modal) { resolve(window.confirm(body)); return; }
    document.getElementById("confirm-modal-title").textContent = title;
    document.getElementById("pj-confirm-modal-body").textContent = body;
    const confirmBtn = document.getElementById("confirm-modal-confirm");
    const cancelBtn = document.getElementById("confirm-modal-cancel");
    const closeBtn = document.getElementById("confirm-modal-close");
    confirmBtn.textContent = confirmText;
    confirmBtn.className = danger ? "pj-danger-button" : "pj-action-button";
    cancelBtn.textContent = cancelText;
    modal.hidden = false;
    modal.removeAttribute("aria-hidden");
    const cleanup = (val) => {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      closeBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(val);
    };
    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onBackdrop = (e) => { if (e.target === modal) cleanup(false); };
    const onKey = (e) => {
      if (e.key === "Escape") cleanup(false);
      else if (e.key === "Enter") cleanup(true);
    };
    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    closeBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
    confirmBtn.focus();
  });
}

/* ===== Helper: 按鈕 disabled 時動態設 title 解釋為何不可按 ================ */
function setBtnTitle(btn, text) {
  if (!btn) return;
  if (text) btn.title = text;
  else btn.removeAttribute("title");
}

/* ===== Empty state HTML helper（各 view 通用結構） ========================= */
function emptyStateHtml({ icon = "📋", title = "", hint = "" } = {}) {
  return `<div class="pj-empty-state">
    ${icon ? `<div class="pj-empty-state-icon" aria-hidden="true">${icon}</div>` : ""}
    ${title ? `<div class="pj-empty-state-title">${escapeHtml(title)}</div>` : ""}
    ${hint ? `<div class="pj-empty-state-hint">${escapeHtml(hint)}</div>` : ""}
  </div>`;
}

function localDateString(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgoString(offset) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return localDateString(d);
}

function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const entries = Array.isArray(parsed.draftEntries) ? parsed.draftEntries : [];
    const cleanEntries = entries
      .filter((entry) => entry && Number.isFinite(Number(entry.issue_id)))
      .map((entry) => ({
        issue_id: Number(entry.issue_id),
        issue_subject: entry.issue_subject || `Issue #${entry.issue_id}`,
        issue_url: entry.issue_url || "",
        hours: entry.hours || "",
        activity_id: entry.activity_id || "",
        comments: entry.comments || "",
        selected: true,
        errors: {},
        duplicate: false,
        duplicate_entries: [],
      }));
    return {
      draftEntries: cleanEntries,
      batchSpentOn: typeof parsed.batchSpentOn === "string" ? parsed.batchSpentOn : "",
      currentSource:
        parsed.currentSource && typeof parsed.currentSource === "object"
          ? parsed.currentSource
          : { type: "mine" },
    };
  } catch {
    return null;
  }
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function applyTheme(theme) {
  state.theme = theme;
  if (theme === "dark") document.getElementById("__worklog_root")?.setAttribute("data-theme", "dark");
  else document.getElementById("__worklog_root")?.removeAttribute("data-theme");
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

function persistState() {
  try {
    const payload = {
      draftEntries: state.draftEntries.map((entry) => ({
        issue_id: entry.issue_id,
        issue_subject: entry.issue_subject,
        issue_url: entry.issue_url,
        hours: entry.hours,
        activity_id: entry.activity_id,
        comments: entry.comments,
        selected: true,
      })),
      batchSpentOn: state.batchSpentOn,
      currentSource: state.currentSource,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage may be disabled — ignore */
  }
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const subjectOf = (issue) => issue.subject || `Issue #${issue.issue_id}`;

function issueById(issueId) {
  return state.issues.find((issue) => issue.issue_id === issueId);
}

function isIssueInDrafts(issueId) {
  return state.draftEntries.some((entry) => entry.issue_id === issueId);
}

function selectedCount() {
  return state.draftEntries.length;
}

function sourceKey(source) {
  if (source.type === "mine") return "mine";
  if (source.type === "mine-grouped") return "mine-grouped";
  if (source.type === "schedule") return "schedule";
  if (source.type === "query") return `query:${source.id}`;
  return "unknown";
}

function sourceLabel(source) {
  if (source.type === "mine") return "我的 issue";
  if (source.type === "mine-grouped") return "我的 project";
  if (source.type === "visited") return "近期查閱";
  if (source.type === "schedule") return "分配工時";
  if (source.type === "query") return `PJ：${source.name || `#${source.id}`}`;
  return "未知來源";
}

function sourceUsesMineApi(source) {
  return source.type === "mine" || source.type === "mine-grouped" || source.type === "schedule";
}

function clearEntryPreviewState(entry) {
  entry.errors = {};
  entry.duplicate = false;
  entry.duplicate_entries = [];
}

function invalidatePreview(clearResults = false) {
  state.previewToken = "";
  state.previewWarnings = [];
  if (clearResults) {
    state.commitResults = [];
  }
}

function clearAllEntryPreviewState() {
  for (const entry of state.draftEntries) {
    clearEntryPreviewState(entry);
  }
  invalidatePreview(true);
}

function sortDraftEntries() {
  state.draftEntries.sort((left, right) => left.issue_id - right.issue_id);
}

function buildDraftEntry(issueId, existing = null) {
  const issue = issueById(issueId);
  return {
    issue_id: issueId,
    issue_subject: issue ? subjectOf(issue) : `Issue #${issueId}`,
    issue_url: issue?.issue_url || "",
    hours: existing?.hours || "",
    activity_id: existing?.activity_id || "",
    comments: existing?.comments || "",
    selected: true,
    errors: {},
    duplicate: false,
    duplicate_entries: [],
  };
}

function upsertDraftEntry(issueId) {
  const existingIndex = state.draftEntries.findIndex((entry) => entry.issue_id === issueId);
  const existing = existingIndex >= 0 ? state.draftEntries[existingIndex] : null;
  const nextEntry = buildDraftEntry(issueId, existing);
  if (existingIndex >= 0) {
    state.draftEntries[existingIndex] = nextEntry;
  } else {
    state.draftEntries.push(nextEntry);
  }
  sortDraftEntries();
  invalidatePreview(true);
}

function removeDraftEntry(issueId) {
  state.draftEntries = state.draftEntries.filter((entry) => entry.issue_id !== issueId);
  if (lastFocusedEntryId === issueId) lastFocusedEntryId = null;
  invalidatePreview(true);
}

function clearAllDrafts() {
  state.draftEntries = [];
  lastFocusedEntryId = null;
  invalidatePreview(true);
}

function renderLoadingMask() {
  elements.loadingMask.classList.toggle("open", state.isLoading);
  elements.loadingMask.setAttribute("aria-hidden", state.isLoading ? "false" : "true");
  elements.loadingMessage.textContent = state.loadingMessage || "載入中...";
}

async function withLoading(message, action) {
  state.isLoading = true;
  state.loadingMessage = message;
  renderLoadingMask();
  updateButtons();
  try {
    return await action();
  } finally {
    state.isLoading = false;
    state.loadingMessage = "";
    renderLoadingMask();
    updateButtons();
  }
}

async function fetchJson(url, options = {}) { return window.__worklog_fetchJson(url, options); }

async function fetchActivities() {
  const data = await fetchJson("/api/time-entry-activities");
  state.activities = data.activities || [];
  state.manualActivityEntry = Boolean(data.manual_entry);
  state.activityWarnings = data.warnings || [];
}

async function fetchSavedQueries() {
  const data = await fetchJson("/api/saved-queries");
  state.savedQueries = data.queries || [];
}

async function fetchPhrases() {
  const data = await fetchJson("/api/phrases");
  state.phrases = data.phrases || [];
}

async function fetchIssueTemplates() {
  const data = await fetchJson("/api/issue-templates");
  state.issueTemplates = data.templates || [];
}

async function fetchProjects() {
  const data = await fetchJson("/api/projects");
  state.projectsList = data.projects || [];
  state.projectsLoaded = true;
}

async function fetchTrackers() {
  const data = await fetchJson("/api/trackers");
  state.trackersList = data.trackers || [];
  state.trackersLoaded = true;
}

async function loadBatchPrerequisites() {
  if (state.batchPrereqLoading) return;
  if (state.projectsLoaded && state.trackersLoaded) return;
  state.batchPrereqLoading = true;
  try {
    const tasks = [];
    if (!state.projectsLoaded) tasks.push(fetchProjects());
    if (!state.trackersLoaded) tasks.push(fetchTrackers());
    await Promise.all(tasks);
    if (state.trackersLoaded && !state.batchTrackerId && state.trackersList.length === 1) {
      state.batchTrackerId = state.trackersList[0].id;
    }
  } finally {
    state.batchPrereqLoading = false;
  }
}

function buildIssuesUrl() {
  const params = new URLSearchParams();
  if (state.currentSource.type === "visited") {
    params.set("source", "visited");
    if (state.filterDate) params.set("date", state.filterDate);
  } else if (sourceUsesMineApi(state.currentSource)) {
    params.set("source", "mine");
    if (state.filterDate) params.set("date", state.filterDate);
  } else if (state.currentSource.type === "query") {
    params.set("source", "query");
    params.set("query_id", String(state.currentSource.id));
    if (state.filterDate) params.set("date", state.filterDate);
  }
  return `/api/issues?${params.toString()}`;
}

async function fetchIssues() {
  const start = performance.now();
  const data = await fetchJson(buildIssuesUrl());
  state.issues = data.issues || [];
  state.issueWarnings = data.warnings || [];
  if (!state.batchSpentOn) {
    state.batchSpentOn = daysAgoString(1);
  }
  // visited 純讀 GM 通常 <5ms，loading mask 還沒淡入就被關掉，使用者看不到刷新動畫。
  // 保證最小 300ms 可見時間，讓 spinner 至少完整跑一輪。
  if (state.currentSource.type === "visited") {
    const elapsed = performance.now() - start;
    if (elapsed < 300) {
      await new Promise((r) => setTimeout(r, 300 - elapsed));
    }
  }
}

function filteredIssues() {
  const query = state.filterSearch.trim().toLowerCase();
  if (!query) return state.issues;
  return state.issues.filter((issue) => {
    const title = (issue.subject || "").toLowerCase();
    const idStr = String(issue.issue_id);
    return title.includes(query) || idStr.includes(query);
  });
}

function renderSourceTabs() {
  const tabs = [
    { type: "visited", label: "近期查閱" },
    { type: "mine", label: "我的 issue" },
    { type: "mine-grouped", label: "我的 project" },
  ];
  for (const query of state.savedQueries) {
    tabs.push({
      type: "query",
      id: query.query_id,
      label: query.name || `#${query.query_id}`,
    });
  }
  const activeKey = sourceKey(state.currentSource);
  const inner = tabs
    .map((tab) => {
      const payload = { type: tab.type, id: tab.id, name: tab.label };
      const isActive = sourceKey(payload) === activeKey;
      const data = `data-source='${JSON.stringify(payload).replaceAll("'", "&#39;")}'`;
      return `<button class="pj-source-tab ${isActive ? "active" : ""}" ${data}>${escapeHtml(tab.label)}</button>`;
    })
    .join("");
  elements.sourceTabs.innerHTML = inner;

  for (const button of elements.sourceTabs.querySelectorAll(".pj-source-tab")) {
    button.addEventListener("click", async (event) => {
      try {
        const source = JSON.parse(event.currentTarget.dataset.source);
        await switchSource(source);
      } catch (error) {
        state.issueWarnings = [error.message || String(error)];
        renderAll();
      }
    });
  }
}

async function switchSource(source) {
  state.currentSource = source;
  state.filterSearch = "";
  await withLoading("載入 issue 中...", fetchIssues);
  renderAll();
}

function renderTopTabs() {
  // 計算當前的 sidebar view：worklog / schedule / phrases / sources
  const isSchedule = state.currentSource.type === "schedule";
  const sideView = state.sideView ||
    (isSchedule ? "schedule" : "worklog");
  for (const btn of document.querySelectorAll("[data-side-view]")) {
    btn.classList.toggle("active", btn.dataset.sideView === sideView);
  }
  // schedule 共用 worklog view 容器（內部 renderTable / renderIssueList
  // 會依 currentSource 自動切換 schedule 排程 UI）
  const visibleView = sideView === "schedule" ? "worklog" : sideView;
  for (const v of document.querySelectorAll(".pj-main-view")) {
    v.hidden = v.dataset.view !== visibleView;
  }
  // pj-source-tabs 列只在「填寫工時」顯示
  const mainToolbar = document.getElementById("pj-main-toolbar");
  if (mainToolbar) {
    mainToolbar.style.display = sideView === "worklog" ? "" : "none";
  }
}

function issueCardHtml(issue, { omitProjectTag = false } = {}) {
  const isSelected = isIssueInDrafts(issue.issue_id);
  return `
    <li>
      <div class="pj-issue-card ${isSelected ? "selected" : ""}">
        <label class="pj-issue-select">
          <input class="pj-issue-checkbox" type="checkbox" data-issue-id="${issue.issue_id}" ${isSelected ? "checked" : ""}>
          <span>
            <span class="pj-issue-heading-line">
              <span class="pj-issue-id">#${issue.issue_id}</span>
              <span class="pj-issue-title">${escapeHtml(subjectOf(issue))}</span>
              <span class="pj-issue-date">${escapeHtml(issue.updated_on ? issue.updated_on.slice(0, 10) : "")}</span>
            </span>
            <span class="pj-tag-row">
              ${issue.status ? `<span class="tag">${escapeHtml(issue.status)}</span>` : ""}
              ${!omitProjectTag && issue.project ? `<span class="tag optional">${escapeHtml(issue.project)}</span>` : ""}
              ${issue.tracker ? `<span class="tag optional">${escapeHtml(issue.tracker)}</span>` : ""}
              ${issue.assigned_to ? `<span class="tag optional">@${escapeHtml(issue.assigned_to)}</span>` : ""}
            </span>
          </span>
        </label>
      </div>
    </li>
  `;
}

function bindIssueCheckboxes() {
  for (const checkbox of elements.issueList.querySelectorAll("[data-issue-id]")) {
    checkbox.addEventListener("change", (event) => {
      const issueId = Number(event.target.dataset.issueId);
      if (event.target.checked) {
        upsertDraftEntry(issueId);
      } else {
        removeDraftEntry(issueId);
      }
      renderAll();
    });
  }
}

function renderGroupedIssueList(visible) {
  const groups = new Map();
  for (const issue of visible) {
    const name = issue.project || "(未指定)";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(issue);
  }
  const entries = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) {
    elements.issueList.innerHTML = `<li><div class="pj-empty-state">搜尋條件下沒有符合的 issue。</div></li>`;
    return;
  }
  elements.issueList.innerHTML = entries
    .map(([name, issues]) => {
      const expanded = state.expandedProjects.has(name);
      const selectedInGroup = issues.filter((issue) => isIssueInDrafts(issue.issue_id)).length;
      return `
        <li class="pj-project-group">
          <div class="pj-project-header" data-toggle-group="${escapeHtml(name)}">
            <span class="pj-group-arrow">${expanded ? "▼" : "▶"}</span>
            <strong class="pj-group-name">${escapeHtml(name)}</strong>
            <span class="pj-group-count">${issues.length}</span>
            ${selectedInGroup > 0 ? `<span class="pj-group-selected">已選 ${selectedInGroup}</span>` : ""}
          </div>
          ${expanded ? `<ul class="pj-group-issues">${issues.map((issue) => issueCardHtml(issue, { omitProjectTag: true })).join("")}</ul>` : ""}
        </li>
      `;
    })
    .join("");

  for (const header of elements.issueList.querySelectorAll("[data-toggle-group]")) {
    header.addEventListener("click", () => {
      const name = header.dataset.toggleGroup;
      if (state.expandedProjects.has(name)) state.expandedProjects.delete(name);
      else state.expandedProjects.add(name);
      renderAll();
    });
  }
  bindIssueCheckboxes();
}

function renderIssueList() {
  const visible = filteredIssues();
  elements.issueCount.textContent = `${state.issues.length}${state.filterSearch ? ` / 符合 ${visible.length}` : ""}`;
  elements.selectedCount.textContent = `${selectedCount()} 筆`;
  const pieces = [sourceLabel(state.currentSource)];
  if (state.filterDate) pieces.push(`更新於 ${state.filterDate}`);
  if (state.filterSearch) pieces.push(`搜尋: ${state.filterSearch}`);
  elements.issueSummary.textContent = pieces.join(" · ");

  // 動態日期 filter label（mine/mine-grouped 顯示「更新日期」、visited 顯示「查閱日期」）
  const dateLabel = document.getElementById("pj-date-filter-label");
  if (dateLabel) {
    dateLabel.textContent =
      state.currentSource.type === "visited" ? "查閱日期" : "更新日期";
  }
  // day-filter 快選按鈕 active 狀態
  for (const btn of document.querySelectorAll("[data-day-filter]")) {
    const offset = btn.dataset.dayFilter;
    const targetDate = offset === "" ? "" : daysAgoString(Number(offset));
    btn.classList.toggle("active", (state.filterDate || "") === targetDate);
  }

  if (state.currentSource.type === "schedule") {
    if (state.scheduleStage === "select") {
      renderScheduleSelectStage();
    } else {
      renderScheduleOrderingList();
    }
    return;
  }

  if (!state.issues.length) {
    const icon = state.currentSource.type === "visited" ? "🕒"
      : state.currentSource.type === "query" ? "🔍"
      : "📋";
    const hint = state.currentSource.type === "visited"
      ? "在 Redmine 點開任一 issue 頁面，userscript 會自動把它記進清單。"
      : "可以調整上方的更新日期，或切換到其他 PJ 篩選器。";
    elements.issueList.innerHTML = `<li>${emptyStateHtml({
      icon,
      title: "這個來源沒有符合條件的 issue",
      hint,
    })}</li>`;
    return;
  }

  if (state.currentSource.type === "mine-grouped") {
    renderGroupedIssueList(visible);
    return;
  }

  if (!visible.length) {
    elements.issueList.innerHTML = `<li>${emptyStateHtml({
      icon: "🔎",
      title: "搜尋條件下沒有符合的 issue",
      hint: "試著清空搜尋或調整關鍵字。",
    })}</li>`;
    return;
  }
  elements.issueList.innerHTML = visible.map((issue) => issueCardHtml(issue)).join("");
  bindIssueCheckboxes();
}

function renderAlerts() {
  // 主 pj-alert-stack（worklog/schedule view 內）：issue/activity/preview 相關 + 送出結果
  const main = [];
  if (state.issueWarnings.length) {
    main.push(`<div class="alert warn">${state.issueWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.activityWarnings.length) {
    main.push(`<div class="alert warn">${state.activityWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.previewWarnings.length) {
    main.push(`<div class="alert warn">${state.previewWarnings.map(escapeHtml).join("<br>")}</div>`);
  }
  if (state.previewToken) {
    main.push("<div class=\"alert\">已完成預覽。若修改全域日期或任何欄位，必須重新預覽後才能送出。</div>");
  }
  if (state.commitResults.length) {
    main.push(renderResults());
  }
  if (state.scheduleCommitResults.length) {
    main.push(renderScheduleResults());
  }
  if (elements.alertStack) elements.alertStack.innerHTML = main.join("");

  // 分流到各 view 自己的 alert container；找不到容器則 fallback 推回主 stack
  const phrasesHtml = state.phrasesWarnings.length
    ? `<div class="alert warn">${state.phrasesWarnings.map(escapeHtml).join("<br>")}</div>` : "";
  if (elements.phrasesAlertStack) {
    elements.phrasesAlertStack.innerHTML = phrasesHtml;
  } else if (phrasesHtml && elements.alertStack) {
    elements.alertStack.insertAdjacentHTML("beforeend", phrasesHtml);
  }

  const sourcesHtml = state.sourcesWarnings.length
    ? `<div class="alert warn">${state.sourcesWarnings.map(escapeHtml).join("<br>")}</div>` : "";
  if (elements.sourcesAlertStack) {
    elements.sourcesAlertStack.innerHTML = sourcesHtml;
  } else if (sourcesHtml && elements.alertStack) {
    elements.alertStack.insertAdjacentHTML("beforeend", sourcesHtml);
  }
}

function renderScheduleResults() {
  const ok = state.scheduleCommitResults.filter((r) => r.ok).length;
  const fail = state.scheduleCommitResults.filter((r) => r.error).length;
  const lines = state.scheduleCommitResults.map((r) => {
    if (r.ok) return `✓ #${r.issue_id}  ${r.start_date} → ${r.due_date}`;
    return `✗ #${r.issue_id ?? "?"}  ${r.error}`;
  });
  return `
    <div class="alert ${fail ? "warn" : ""}">
      <strong>Issue 起迄日更新結果 (${ok} 成功 / ${fail} 失敗)</strong>
      <ul class="pj-result-list">
        ${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function activityOptionsHtml(currentValue) {
  return state.activities
    .map(
      (activity) =>
        `<option value="${activity.id}" ${String(currentValue || "") === String(activity.id) ? "selected" : ""}>${escapeHtml(activity.name)}</option>`
    )
    .join("");
}

function activityFieldHtml(entry) {
  if (state.manualActivityEntry) {
    return `<input type="number" min="1" value="${escapeHtml(entry.activity_id || "")}" data-row-field="activity_id" data-issue-id="${entry.issue_id}" placeholder="activity_id">`;
  }
  return `
    <select data-row-field="activity_id" data-issue-id="${entry.issue_id}">
      <option value="">選擇活動</option>
      ${activityOptionsHtml(entry.activity_id)}
    </select>
  `;
}

function renderRow(entry) {
  const issue = issueById(entry.issue_id);
  const issueLabel = issue ? subjectOf(issue) : entry.issue_subject;
  const errors = Object.values(entry.errors || {});
  const duplicateList = (entry.duplicate_entries || [])
    .map(
      (item) =>
        `<li>#${escapeHtml(item.id)} ${escapeHtml(item.hours)}h ${escapeHtml(item.activity_name || "")} ${escapeHtml(item.comments || "")}</li>`
    )
    .join("");
  const isFocused = lastFocusedEntryId === entry.issue_id;

  const phraseOptions = state.phrases.length
    ? `<select class="pj-entry-phrase-select" data-apply-phrase-select data-issue-id="${entry.issue_id}" title="快速填入此筆">
         <option value="">快速填入...</option>
         ${state.phrases.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label || "(未命名)")}</option>`).join("")}
       </select>`
    : "";

  return `
    <tbody data-entry-row="${entry.issue_id}" class="${isFocused ? "pj-row-focused" : ""}">
      <tr class="pj-entry-issue-row">
        <td colspan="5">
          <div class="pj-entry-title-row">
            <div class="pj-entry-title-text">
              <span class="pj-entry-issue-id">#${entry.issue_id}</span>
              <span class="pj-entry-issue-label">${escapeHtml(issueLabel)}</span>
              ${entry.issue_url ? `<a class="pj-entry-issue-link" href="${escapeHtml(entry.issue_url)}" target="_blank" rel="noreferrer">↗</a>` : ""}
            </div>
            ${phraseOptions}
          </div>
        </td>
      </tr>
      <tr class="pj-entry-fields-row">
        <td>
          <button class="pj-draft-remove" data-remove-draft="${entry.issue_id}" title="從草稿移除">×</button>
        </td>
        <td>
          <span class="pj-mobile-label">時數</span>
          <div class="pj-hours-stepper">
            <button type="button" class="pj-stepper-btn" data-hours-step="-0.5" data-issue-id="${entry.issue_id}" aria-label="減 0.5 小時">−</button>
            <input class="pj-hours-input" type="number" step="0.5" min="0" max="24" value="${escapeHtml(entry.hours || "")}" data-row-field="hours" data-issue-id="${entry.issue_id}" placeholder="1.5">
            <button type="button" class="pj-stepper-btn" data-hours-step="0.5" data-issue-id="${entry.issue_id}" aria-label="加 0.5 小時">+</button>
          </div>
        </td>
        <td>
          <span class="pj-mobile-label">活動類型</span>
          ${activityFieldHtml(entry)}
        </td>
        <td class="pj-comment-cell">
          <span class="pj-mobile-label">工作描述</span>
          <textarea data-row-field="comments" data-issue-id="${entry.issue_id}" placeholder="今天做了什麼...">${escapeHtml(entry.comments || "")}</textarea>
        </td>
        <td>
          <span class="pj-mobile-label">驗證</span>
          ${entry.duplicate ? '<div class="pj-duplicate-chip">此 issue 同日期已有工時，已自動取消勾選</div>' : ""}
          ${duplicateList ? `<ul class="pj-duplicate-list">${duplicateList}</ul>` : ""}
          ${errors.length ? `<ul class="pj-row-errors">${errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<span class="muted">尚未送出或無錯誤</span>'}
        </td>
      </tr>
    </tbody>
  `;
}

function bindTableEvents() {
  for (const field of elements.tableWrap.querySelectorAll("[data-row-field]")) {
    field.addEventListener("change", (event) => {
      const issueId = Number(event.target.dataset.issueId);
      const fieldName = event.target.dataset.rowField;
      const entry = state.draftEntries.find((item) => item.issue_id === issueId);
      if (!entry) return;
      entry[fieldName] = event.target.value;
      clearEntryPreviewState(entry);
      invalidatePreview(true);
      renderAll();
    });
    field.addEventListener("focus", (event) => {
      lastFocusedEntryId = Number(event.target.dataset.issueId);
      highlightFocusedRow();
    });
  }

  for (const select of elements.tableWrap.querySelectorAll("[data-apply-phrase-select]")) {
    select.addEventListener("change", (event) => {
      const phraseId = event.target.value;
      if (!phraseId) return;
      const issueId = Number(event.target.dataset.issueId);
      const entry = state.draftEntries.find((item) => item.issue_id === issueId);
      const phrase = state.phrases.find((p) => p.id === phraseId);
      if (!entry || !phrase) return;
      applyPhraseFields(phrase, entry);
      clearEntryPreviewState(entry);
      invalidatePreview(true);
      event.target.value = "";
      renderAll();
    });
  }

  for (const btn of elements.tableWrap.querySelectorAll("[data-hours-step]")) {
    btn.addEventListener("click", (event) => {
      const issueId = Number(event.currentTarget.dataset.issueId);
      const step = parseFloat(event.currentTarget.dataset.hoursStep);
      const entry = state.draftEntries.find((item) => item.issue_id === issueId);
      if (!entry) return;
      const current = parseFloat(entry.hours) || 0;
      let next = Math.max(0, Math.min(24, current + step));
      next = Math.round(next * 10) / 10;
      entry.hours = next === 0 ? "" : String(next);
      clearEntryPreviewState(entry);
      invalidatePreview(true);
      renderAll();
    });
  }

  for (const btn of elements.tableWrap.querySelectorAll("[data-remove-draft]")) {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const issueId = Number(event.currentTarget.dataset.removeDraft);
      removeDraftEntry(issueId);
      renderAll();
    });
  }
}

function highlightFocusedRow() {
  for (const row of elements.tableWrap.querySelectorAll("[data-entry-row]")) {
    row.classList.toggle(
      "pj-row-focused",
      Number(row.dataset.entryRow) === lastFocusedEntryId
    );
  }
}

function selectedValidRows() {
  return state.draftEntries.filter((entry) => !Object.keys(entry.errors || {}).length);
}

function updateButtons() {
  const isSchedule = state.currentSource.type === "schedule";
  const isArrange = isSchedule && state.scheduleStage === "arrange";
  if (elements.stickyActions) {
    elements.stickyActions.style.display = isSchedule ? "none" : "";
  }
  if (elements.stickyActionsSchedule) {
    elements.stickyActionsSchedule.style.display = isArrange ? "flex" : "none";
  }
  if (elements.scheduleApplyButton) {
    elements.scheduleApplyButton.disabled = state.isLoading || !isArrange;
  }
  if (elements.dailyTotalBadge) {
    elements.dailyTotalBadge.style.display = isSchedule ? "none" : "";
  }
  const batchLabel = document.getElementById("batch-spent-on-label");
  if (batchLabel) batchLabel.textContent = isSchedule ? "開始排程日期" : "工時日期";
  const quickBtns = document.getElementById("pj-date-quick-buttons");
  if (quickBtns) quickBtns.style.display = isSchedule ? "none" : "";
  elements.refreshButton.disabled = state.isLoading;
  setBtnTitle(elements.refreshButton, state.isLoading && "載入中，請稍候");
  elements.selectAllButton.disabled = isSchedule || state.isLoading || filteredIssues().length === 0;
  setBtnTitle(elements.selectAllButton,
    isSchedule ? "排程模式不支援全選"
    : state.isLoading ? "載入中，請稍候"
    : filteredIssues().length === 0 ? "目前沒有符合條件的 issue 可選"
    : null);
  elements.clearSelectionButton.disabled = state.isLoading || selectedCount() === 0;
  setBtnTitle(elements.clearSelectionButton,
    state.isLoading ? "載入中，請稍候"
    : selectedCount() === 0 ? "尚未勾選任何 issue"
    : null);
  elements.commitButton.disabled = isSchedule || state.isLoading || selectedValidRows().length === 0 || !state.batchSpentOn;
  setBtnTitle(elements.commitButton,
    isSchedule ? "排程模式不可送出工時"
    : state.isLoading ? "載入中，請稍候"
    : !state.batchSpentOn ? "請先選擇工時日期"
    : selectedValidRows().length === 0 ? "請先勾選至少一筆 issue 並填工時"
    : null);
  if (elements.scheduleApplyButton) {
    setBtnTitle(elements.scheduleApplyButton,
      state.isLoading ? "載入中，請稍候"
      : !isArrange ? "請先進入 Step 2 排程階段"
      : null);
  }
  elements.filterDate.disabled = state.isLoading;
  elements.filterSearch.disabled = state.isLoading;
  elements.selectedCount.textContent = `${selectedCount()} 筆`;
  elements.filterDate.value = state.filterDate || "";
  elements.filterDate.max = state.localToday;
  elements.filterSearch.value = state.filterSearch || "";
  elements.batchSpentOn.value = state.batchSpentOn || "";
  elements.batchSpentOn.disabled = state.isLoading;
  for (const btn of document.querySelectorAll("[data-spent-on-offset]")) {
    const offset = Number(btn.dataset.spentOnOffset);
    const match = state.batchSpentOn === daysAgoString(offset);
    btn.classList.toggle("active", match);
    btn.disabled = state.isLoading;
  }
}

function renderResults() {
  return `
    <div class="alert ${state.commitResults.some((item) => item.error) ? "warn" : ""}">
      <strong>送出結果</strong>
      <ul class="pj-result-list">
        ${state.commitResults
          .map((item) => {
            const status = item.created_time_entry_id
              ? `建立成功，ID ${item.created_time_entry_id}`
              : item.error
                ? escapeHtml(item.error)
                : item.skipped
                  ? "未勾選，略過"
                  : "未送出";
            return `<li>Issue #${item.issue_id} / ${escapeHtml(item.spent_on)} : ${status}</li>`;
          })
          .join("")}
      </ul>
    </div>
  `;
}

function renderTable() {
  if (state.currentSource.type === "schedule") {
    if (state.scheduleStage === "select") {
      const count = state.scheduleSelectedProjectIds.size;
      elements.workbenchSummary.textContent =
        count > 0
          ? `已勾選 ${count} 個 project，按下方「開始排程 →」進入 Step 2`
          : "從左側勾選要排程的 project（可複選）";
      elements.tableWrap.innerHTML = `
        <div class="pj-empty-state">
          <p><strong>分配工時流程</strong></p>
          <ol style="padding-left: 20px; line-height: 1.8;">
            <li>Step 1：在左側勾選想要排程的 project（可複選）</li>
            <li>Step 2：拖拉或 ↑/↓ 排序 project 與其內的 issue，點預算數字可覆寫</li>
            <li>系統會依你排的順序從本週一開始填，每日上限 ${state.dailyHourLimit}h</li>
          </ol>
          <button class="pj-action-button" id="schedule-start-button" ${count === 0 ? "disabled" : ""}>
            開始排程 (已選 ${count}) →
          </button>
        </div>
      `;
      document.getElementById("schedule-start-button")?.addEventListener("click", () => {
        if (state.scheduleSelectedProjectIds.size === 0) return;
        state.scheduleStage = "arrange";
        renderAll();
      });
      return;
    }
    const startText = state.batchSpentOn || "請先設定開始排程日期";
    elements.workbenchSummary.textContent = `自 ${startText} 起連續十個工作日，每日上限 ${state.dailyHourLimit}h`;
    elements.tableWrap.innerHTML = `
      <div class="schedule-back-row">
        <button class="pj-ghost-button pj-schedule-back-button" id="pj-schedule-back-button" type="button">← 重新選擇 Project</button>
      </div>
      ${renderScheduleGantt()}
    `;
    document.getElementById("pj-schedule-back-button")?.addEventListener("click", () => {
      state.scheduleStage = "select";
      renderAll();
    });
    return;
  }
  if (state.draftEntries.length === 0) {
    elements.workbenchSummary.textContent = "先從左側勾選要補登工時的 issue。";
    elements.tableWrap.innerHTML = emptyStateHtml({
      icon: "📋",
      title: "尚未勾選任何 issue",
      hint: "← 從左側清單勾選 issue 後，這裡會顯示批次工時表單。每列右上角可快速套用工時模板。",
    });
    return;
  }

  elements.workbenchSummary.textContent = `已選 ${state.draftEntries.length} 筆 issue · 工時日期：${state.batchSpentOn || "未設定"}`;
  elements.tableWrap.innerHTML = `
    <table>
      <colgroup>
        <col class="pj-col-send">
        <col class="pj-col-hours">
        <col class="pj-col-activity">
        <col class="pj-col-comments">
        <col class="pj-col-check">
      </colgroup>
      <thead>
        <tr>
          <th>送出</th>
          <th>時數</th>
          <th>活動</th>
          <th>備註</th>
          <th>驗證</th>
        </tr>
      </thead>
      ${state.draftEntries.map((entry) => renderRow(entry)).join("")}
    </table>
  `;
  bindTableEvents();
}

function workingDays(minCount = 10, baseDateStr) {
  // baseDateStr (YYYY-MM-DD) = schedule base day. If omitted, fall back to
  // state.batchSpentOn or today's Monday (legacy behaviour).
  let start;
  if (baseDateStr) {
    const [y, m, d] = baseDateStr.split("-").map(Number);
    start = new Date(y, (m || 1) - 1, d || 1);
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    start = new Date(today);
    start.setDate(today.getDate() - daysFromMonday);
  }
  const days = [];
  const cursor = new Date(start);
  const cap = 365;
  while (days.length < minCount) {
    const wd = cursor.getDay();
    if (wd >= 1 && wd <= 5) days.push(localDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (days.length >= cap) break;
  }
  return days;
}

function getIssueBudget(issue) {
  const override = state.scheduleBudgets[issue.issue_id];
  if (override !== undefined && override !== null && override !== "") {
    const n = Number(override);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  const est = Number(issue.estimated_hours) || 0;
  const spent = Number(issue.spent_hours) || 0;
  return Math.max(est - spent, 0);
}

function collectAllProjects() {
  const map = new Map();
  for (const issue of state.issues) {
    const pid = issue.project_id || 0;
    if (!map.has(pid)) {
      map.set(pid, {
        id: pid,
        name: issue.project || "(未指定)",
        issueIds: [],
        totalBudget: 0,
      });
    }
    const entry = map.get(pid);
    entry.issueIds.push(issue.issue_id);
    const est = Number(issue.estimated_hours) || 0;
    const spent = Number(issue.spent_hours) || 0;
    entry.totalBudget += Math.max(est - spent, 0);
  }
  return map;
}

function ensureScheduleOrder() {
  const projectMap = new Map();
  for (const issue of state.issues) {
    const pid = issue.project_id || 0;
    if (!state.scheduleSelectedProjectIds.has(pid)) continue;
    if (!projectMap.has(pid)) {
      projectMap.set(pid, {
        id: pid,
        name: issue.project || "(未指定)",
        issueIds: [],
      });
    }
    projectMap.get(pid).issueIds.push(issue.issue_id);
  }
  const currentPids = new Set(projectMap.keys());
  state.scheduleProjectOrder = state.scheduleProjectOrder.filter((pid) => currentPids.has(pid));
  for (const pid of currentPids) {
    if (!state.scheduleProjectOrder.includes(pid)) state.scheduleProjectOrder.push(pid);
  }
  for (const pid of currentPids) {
    const currentIids = new Set(projectMap.get(pid).issueIds);
    const existing = state.scheduleIssueOrder[pid] || [];
    const cleaned = existing.filter((iid) => currentIids.has(iid));
    for (const iid of projectMap.get(pid).issueIds) {
      if (!cleaned.includes(iid)) cleaned.push(iid);
    }
    state.scheduleIssueOrder[pid] = cleaned;
  }
  return projectMap;
}

function computeSchedule() {
  ensureScheduleOrder();
  const limit = state.dailyHourLimit;
  let totalDemand = 0;
  for (const pid of state.scheduleProjectOrder) {
    const issueOrder = state.scheduleIssueOrder[pid] || [];
    for (const iid of issueOrder) {
      const issue = state.issues.find((i) => i.issue_id === iid);
      if (!issue) continue;
      totalDemand += getIssueBudget(issue);
    }
  }
  const daysNeeded = Math.max(10, Math.ceil(totalDemand / limit) + 1);
  const days = workingDays(daysNeeded, state.batchSpentOn);
  const budgetsLeft = days.map(() => limit);
  const allocations = days.map(() => []);
  for (const pid of state.scheduleProjectOrder) {
    const issueOrder = state.scheduleIssueOrder[pid] || [];
    for (const iid of issueOrder) {
      const issue = state.issues.find((i) => i.issue_id === iid);
      if (!issue) continue;
      const total = getIssueBudget(issue);
      if (total <= 0) continue;
      let remaining = total;
      for (let di = 0; di < days.length && remaining > 0.01; di++) {
        const slot = Math.min(remaining, budgetsLeft[di]);
        if (slot > 0.01) {
          allocations[di].push({
            issue_id: iid,
            subject: issue.subject || "",
            project: issue.project || "",
            hours: +slot.toFixed(2),
          });
          budgetsLeft[di] = +(budgetsLeft[di] - slot).toFixed(2);
          remaining = +(remaining - slot).toFixed(2);
        }
      }
    }
  }
  return { days, allocations, budgetsLeft, limit };
}

function renderScheduleSelectStage() {
  const projectMap = collectAllProjects();
  const projects = Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  if (!projects.length) {
    elements.issueList.innerHTML = `<li>${emptyStateHtml({
      icon: "📅",
      title: "沒有可排程的 project",
      hint: "先確認「我的 issue」分頁有資料（自己被指派的進行中 issue）。",
    })}</li>`;
    return;
  }
  elements.issueList.innerHTML = `
    <li class="pj-sched-breadcrumb muted">Step 1 / 2 · 勾選要排程的 project</li>
    ${projects
      .map((proj) => {
        const selected = state.scheduleSelectedProjectIds.has(proj.id);
        return `
          <li>
            <label class="pj-sched-select-card ${selected ? "selected" : ""}">
              <input type="checkbox" ${selected ? "checked" : ""} data-select-project="${proj.id}">
              <span class="pj-sched-select-main">
                <h3 class="pj-sched-select-title">${escapeHtml(proj.name)}</h3>
                <div class="pj-sched-select-meta">${proj.issueIds.length} issues · 預估剩 ${proj.totalBudget.toFixed(1)}h</div>
              </span>
            </label>
          </li>
        `;
      })
      .join("")}
  `;
  for (const input of elements.issueList.querySelectorAll("[data-select-project]")) {
    input.addEventListener("change", (event) => {
      const pid = Number(event.currentTarget.dataset.selectProject);
      if (event.currentTarget.checked) state.scheduleSelectedProjectIds.add(pid);
      else state.scheduleSelectedProjectIds.delete(pid);
      renderAll();
    });
  }
}

function renderScheduleOrderingList() {
  const projectMap = ensureScheduleOrder();
  if (!state.scheduleProjectOrder.length) {
    elements.issueList.innerHTML = `
      <li class="pj-sched-breadcrumb">
        <button class="pj-ghost-button tiny" id="sched-back-button">← 重新選 project</button>
      </li>
      <li>${emptyStateHtml({
        icon: "📅",
        title: "沒有已勾選的 project",
        hint: "請回到 Step 1 重新選擇要排程的 project。",
      })}</li>
    `;
    document.getElementById("sched-back-button")?.addEventListener("click", () => {
      state.scheduleStage = "select";
      renderAll();
    });
    return;
  }
  const parts = state.scheduleProjectOrder.map((pid, pi) => {
    const project = projectMap.get(pid);
    if (!project) return "";
    const isFirstProject = pi === 0;
    const isLastProject = pi === state.scheduleProjectOrder.length - 1;
    const issueIds = state.scheduleIssueOrder[pid] || [];
    const issueBlocks = issueIds
      .map((iid, ii) => {
        const issue = state.issues.find((i) => i.issue_id === iid);
        if (!issue) return "";
        const isFirst = ii === 0;
        const isLast = ii === issueIds.length - 1;
        return `
          <div class="pj-sched-issue" draggable="true" data-issue-drag="${pid}:${iid}">
            <div class="pj-sched-issue-line">
              <button class="pj-ghost-button tiny" ${isFirst ? "disabled" : ""} data-move-issue-up="${pid}:${iid}">↑</button>
              <button class="pj-ghost-button tiny" ${isLast ? "disabled" : ""} data-move-issue-down="${pid}:${iid}">↓</button>
              <span class="pj-issue-id">#${iid}</span>
              <span class="pj-issue-title">${escapeHtml(issue.subject || "")}</span>
              ${renderBudgetCell(issue)}
            </div>
          </div>
        `;
      })
      .join("");
    return `
      <li class="pj-sched-project" draggable="true" data-project-drag-id="${pid}">
        <div class="pj-sched-project-head">
          <button class="pj-ghost-button tiny" ${isFirstProject ? "disabled" : ""} data-move-project-up="${pid}">↑</button>
          <button class="pj-ghost-button tiny" ${isLastProject ? "disabled" : ""} data-move-project-down="${pid}">↓</button>
          <strong>${escapeHtml(project.name)}</strong>
          <span class="muted">(${project.issueIds.length} issues)</span>
        </div>
        ${issueBlocks}
      </li>
    `;
  });
  elements.issueList.innerHTML = `
    <li class="pj-sched-breadcrumb">
      <button class="pj-ghost-button tiny" id="sched-back-button">← 重新選 project</button>
      <span class="muted" style="margin-left: 10px;">Step 2 / 2 · 拖拉或點 ↑/↓ 排序，點預算數字可改</span>
    </li>
    ${parts.join("")}
  `;
  document.getElementById("sched-back-button")?.addEventListener("click", () => {
    state.scheduleStage = "select";
    renderAll();
  });
  bindScheduleEvents();
  bindScheduleDrag();
  bindBudgetCells();
}

function renderBudgetCell(issue) {
  const iid = issue.issue_id;
  const override = state.scheduleBudgets[iid];
  const est = Number(issue.estimated_hours) || 0;
  const spent = Number(issue.spent_hours) || 0;
  const remaining = Math.max(est - spent, 0);
  const hasOverride = override !== undefined && override !== null && override !== "";
  const displayValue = hasOverride ? Number(override) : remaining;
  const isEditing = state.budgetEditIssueId === iid;
  if (isEditing) {
    return `<input type="number" step="0.5" min="0" class="pj-budget-input" data-budget-input="${iid}" value="${escapeHtml(String(displayValue))}">`;
  }
  return `
    <button class="pj-budget-badge ${hasOverride ? "override" : ""}" data-budget-toggle="${iid}" title="點擊編輯預算 (est ${est}h · spent ${spent}h)">
      ${displayValue}h${hasOverride ? ` <span class="pj-clear-override" data-budget-clear="${iid}" title="清除覆寫">⟲</span>` : ""}
    </button>
  `;
}

function bindBudgetCells() {
  for (const btn of elements.issueList.querySelectorAll("[data-budget-toggle]")) {
    btn.addEventListener("click", (event) => {
      if (event.target.closest("[data-budget-clear]")) return;
      const iid = Number(event.currentTarget.dataset.budgetToggle);
      state.budgetEditIssueId = iid;
      renderAll();
      const input = document.querySelector(`[data-budget-input="${iid}"]`);
      if (input) {
        input.focus();
        input.select();
      }
    });
  }
  for (const btn of elements.issueList.querySelectorAll("[data-budget-clear]")) {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const iid = Number(event.currentTarget.dataset.budgetClear);
      delete state.scheduleBudgets[iid];
      renderAll();
    });
  }
  for (const input of elements.issueList.querySelectorAll("[data-budget-input]")) {
    input.addEventListener("blur", (event) => {
      const iid = Number(event.currentTarget.dataset.budgetInput);
      const val = event.currentTarget.value.trim();
      if (val === "") delete state.scheduleBudgets[iid];
      else state.scheduleBudgets[iid] = val;
      state.budgetEditIssueId = null;
      renderAll();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") event.currentTarget.blur();
      else if (event.key === "Escape") {
        state.budgetEditIssueId = null;
        renderAll();
      }
    });
  }
}

function bindScheduleDrag() {
  for (const el of elements.issueList.querySelectorAll("[data-project-drag-id]")) {
    el.addEventListener("dragstart", (event) => {
      if (event.target.closest("[data-issue-drag]")) return;
      dragContext = { kind: "project", projectId: Number(el.dataset.projectDragId) };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(dragContext.projectId));
    });
    el.addEventListener("dragover", (event) => {
      if (dragContext?.kind !== "project") return;
      event.preventDefault();
      el.classList.add("pj-drag-over");
    });
    el.addEventListener("dragleave", () => el.classList.remove("pj-drag-over"));
    el.addEventListener("drop", (event) => {
      event.preventDefault();
      el.classList.remove("pj-drag-over");
      if (dragContext?.kind !== "project") return;
      const targetId = Number(el.dataset.projectDragId);
      if (dragContext.projectId !== targetId) reorderProjectTo(dragContext.projectId, targetId);
      dragContext = null;
    });
    el.addEventListener("dragend", () => {
      dragContext = null;
      for (const n of elements.issueList.querySelectorAll(".pj-drag-over")) n.classList.remove("pj-drag-over");
    });
  }
  for (const el of elements.issueList.querySelectorAll("[data-issue-drag]")) {
    el.addEventListener("dragstart", (event) => {
      const [pid, iid] = el.dataset.issueDrag.split(":").map(Number);
      dragContext = { kind: "issue", projectId: pid, issueId: iid };
      event.dataTransfer.effectAllowed = "move";
      event.stopPropagation();
    });
    el.addEventListener("dragover", (event) => {
      if (dragContext?.kind !== "issue") return;
      const [pid] = el.dataset.issueDrag.split(":").map(Number);
      if (pid !== dragContext.projectId) return;
      event.preventDefault();
      event.stopPropagation();
      el.classList.add("pj-drag-over");
    });
    el.addEventListener("dragleave", () => el.classList.remove("pj-drag-over"));
    el.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      el.classList.remove("pj-drag-over");
      if (dragContext?.kind !== "issue") return;
      const [pid, iid] = el.dataset.issueDrag.split(":").map(Number);
      if (pid !== dragContext.projectId) return;
      if (dragContext.issueId !== iid) reorderIssueTo(pid, dragContext.issueId, iid);
      dragContext = null;
    });
  }
}

function reorderProjectTo(draggedId, targetId) {
  const arr = state.scheduleProjectOrder;
  const from = arr.indexOf(draggedId);
  const to = arr.indexOf(targetId);
  if (from < 0 || to < 0) return;
  arr.splice(from, 1);
  arr.splice(to, 0, draggedId);
  renderAll();
}

function reorderIssueTo(pid, draggedId, targetId) {
  const arr = state.scheduleIssueOrder[pid];
  if (!arr) return;
  const from = arr.indexOf(draggedId);
  const to = arr.indexOf(targetId);
  if (from < 0 || to < 0) return;
  arr.splice(from, 1);
  arr.splice(to, 0, draggedId);
  renderAll();
}

function bindScheduleEvents() {
  for (const btn of elements.issueList.querySelectorAll("[data-move-project-up]")) {
    btn.addEventListener("click", (e) => moveProject(Number(e.currentTarget.dataset.moveProjectUp), -1));
  }
  for (const btn of elements.issueList.querySelectorAll("[data-move-project-down]")) {
    btn.addEventListener("click", (e) => moveProject(Number(e.currentTarget.dataset.moveProjectDown), 1));
  }
  for (const btn of elements.issueList.querySelectorAll("[data-move-issue-up]")) {
    btn.addEventListener("click", (e) => {
      const [pid, iid] = e.currentTarget.dataset.moveIssueUp.split(":").map(Number);
      moveIssue(pid, iid, -1);
    });
  }
  for (const btn of elements.issueList.querySelectorAll("[data-move-issue-down]")) {
    btn.addEventListener("click", (e) => {
      const [pid, iid] = e.currentTarget.dataset.moveIssueDown.split(":").map(Number);
      moveIssue(pid, iid, 1);
    });
  }
  for (const input of elements.issueList.querySelectorAll("[data-issue-budget]")) {
    input.addEventListener("change", (e) => {
      const iid = Number(e.currentTarget.dataset.issueBudget);
      const val = e.currentTarget.value;
      if (val === "") delete state.scheduleBudgets[iid];
      else state.scheduleBudgets[iid] = val;
      renderAll();
    });
  }
}

function moveProject(pid, delta) {
  const arr = state.scheduleProjectOrder;
  const idx = arr.indexOf(pid);
  if (idx < 0) return;
  const ni = idx + delta;
  if (ni < 0 || ni >= arr.length) return;
  arr.splice(idx, 1);
  arr.splice(ni, 0, pid);
  renderAll();
}

function moveIssue(pid, iid, delta) {
  const arr = state.scheduleIssueOrder[pid] || [];
  const idx = arr.indexOf(iid);
  if (idx < 0) return;
  const ni = idx + delta;
  if (ni < 0 || ni >= arr.length) return;
  arr.splice(idx, 1);
  arr.splice(ni, 0, iid);
  renderAll();
}

function deriveIssueDatesFromSchedule(schedule) {
  const map = new Map();
  for (let i = 0; i < schedule.days.length; i++) {
    const date = schedule.days[i];
    for (const item of schedule.allocations[i]) {
      const existing = map.get(item.issue_id);
      if (!existing) {
        map.set(item.issue_id, {
          issue_id: item.issue_id,
          subject: item.subject,
          start_date: date,
          due_date: date,
        });
      } else {
        existing.due_date = date;
      }
    }
  }
  return Array.from(map.values());
}

async function applyScheduleDates() {
  const schedule = computeSchedule();
  const entries = deriveIssueDatesFromSchedule(schedule);
  if (entries.length === 0) {
    showToast("目前沒有排入工時的 issue，無法送出", { type: "error" });
    return;
  }
  const preview = entries
    .map((e) => `  #${e.issue_id} ${e.subject}  ${e.start_date} → ${e.due_date}`)
    .join("\n");
  const ok = await showConfirmModal({
    title: "確認送出排程",
    body: `將更新 ${entries.length} 個 issue 的起迄日期：\n\n${preview}\n\n確定送出？`,
    confirmText: "送出",
    danger: false,
  });
  if (!ok) return;
  const payload = {
    entries: entries.map((e) => ({
      issue_id: e.issue_id,
      start_date: e.start_date,
      due_date: e.due_date,
    })),
  };
  await withLoading("更新 issue 起迄日期中...", async () => {
    const data = await fetchJson("/api/schedule/apply-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.scheduleCommitResults = data.results || [];
  });
  renderAll();
}

function renderScheduleGantt() {
  const { days, allocations, budgetsLeft, limit } = computeSchedule();
  const weekdayNames = ["日", "一", "二", "三", "四", "五", "六"];
  const dayCards = days
    .map((date, i) => {
      const items = allocations[i];
      if (items.length === 0) return "";
      const used = +(limit - budgetsLeft[i]).toFixed(2);
      const statusClass = budgetsLeft[i] <= 0.01 ? "full" : "partial";
      const dateObj = new Date(`${date}T12:00:00`);
      const weekday = weekdayNames[dateObj.getDay()];
      const itemList = `<ul class="pj-gantt-items">${items
        .map(
          (item) => `
            <li>
              <span class="pj-gantt-hours">${item.hours}h</span>
              <span class="pj-gantt-issue">#${item.issue_id} ${escapeHtml(item.subject)}</span>
              ${item.project ? `<span class="tag">${escapeHtml(item.project)}</span>` : ""}
            </li>`
        )
        .join("")}</ul>`;
      return `
        <div class="pj-gantt-day ${statusClass}">
          <div class="pj-gantt-day-head">
            <strong>${date} (週${weekday})</strong>
            <span>${used} / ${limit} h</span>
          </div>
          ${itemList}
        </div>
      `;
    })
    .filter(Boolean)
    .join("");
  if (!dayCards) {
    return emptyStateHtml({
      icon: "📅",
      title: "沒有需要排程的 issue",
      hint: "預算皆為 0 或還沒勾選任何 project。可回 Step 1 重選或在預算欄位填入時數。",
    });
  }
  return `<div class="pj-gantt-days">${dayCards}</div>`;
}

function phrasePresetLabel(phrase) {
  const chips = [];
  if (phrase.hours) chips.push(`<span class="pj-preset-chip">${escapeHtml(phrase.hours)}h</span>`);
  if (phrase.activity_id) {
    const activity = state.activities.find((a) => String(a.id) === String(phrase.activity_id));
    const name = activity ? activity.name : `activity ${phrase.activity_id}`;
    chips.push(`<span class="pj-preset-chip">${escapeHtml(name)}</span>`);
  }
  if (phrase.comments) chips.push(`<span class="pj-preset-chip">備註</span>`);
  return chips.join("");
}

function renderPhrasesDrawer() {
  renderPhraseActivityField();
  if (!state.phrases.length) {
    elements.phrasesList.innerHTML = emptyStateHtml({
      icon: "✏️",
      title: "還沒有工時模板",
      hint: "用上方表單建立常用的時數 / 活動 / 備註組合，之後在每筆工時卡片右上角的「快速填入」下拉一鍵套用。",
    });
    return;
  }
  elements.phrasesList.innerHTML = state.phrases
    .map(
      (phrase) => `
        <div class="pj-item-card" data-phrase-id="${escapeHtml(phrase.id)}">
          <div class="pj-item-head">
            <h3 class="pj-item-title">${escapeHtml(phrase.label || "(未命名)")}</h3>
            <div class="pj-phrase-actions">
              <button class="pj-ghost-button" data-edit-phrase="${escapeHtml(phrase.id)}">編輯</button>
              <button class="pj-danger-button" data-delete-phrase="${escapeHtml(phrase.id)}">刪除</button>
            </div>
          </div>
          <div class="pj-phrase-preset-row">${phrasePresetLabel(phrase)}</div>
          ${phrase.comments ? `<div class="pj-phrase-text">${escapeHtml(phrase.comments)}</div>` : ""}
        </div>
      `
    )
    .join("");

  for (const btn of elements.phrasesList.querySelectorAll("[data-edit-phrase]")) {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      startEditPhrase(event.currentTarget.dataset.editPhrase);
    });
  }
  for (const btn of elements.phrasesList.querySelectorAll("[data-delete-phrase]")) {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const phraseId = event.currentTarget.dataset.deletePhrase;
      const phrase = state.phrases.find((p) => p.id === phraseId);
      const name = phrase?.label || phrase?.comments?.slice(0, 30) || "此模板";
      const ok = await showConfirmModal({
        title: "刪除工時模板",
        body: `確定要刪除「${name}」嗎？\n此操作無法復原。`,
        confirmText: "刪除",
        danger: true,
      });
      if (!ok) return;
      try {
        await withLoading("刪除工時模板中...", () => deletePhraseById(phraseId));
        showToast("已刪除工時模板");
        renderAll();  // 整體刷新，entry 下拉同步少這筆
      } catch (error) {
        state.phrasesWarnings = [error.message || String(error)];
        renderAlerts();
      }
    });
  }
}

function renderPhraseActivityField() {
  const current = elements.phraseActivityWrap.dataset.value || "";
  if (state.manualActivityEntry) {
    elements.phraseActivityWrap.innerHTML = `<input type="number" min="1" id="phrase-activity-input" value="${escapeHtml(current)}" placeholder="activity_id">`;
  } else {
    elements.phraseActivityWrap.innerHTML = `
      <select id="phrase-activity-input">
        <option value="">不指定</option>
        ${activityOptionsHtml(current)}
      </select>
    `;
  }
}

function getPhraseActivityInput() {
  return document.getElementById("phrase-activity-input");
}

function setPhraseActivityValue(value) {
  elements.phraseActivityWrap.dataset.value = value || "";
  const input = getPhraseActivityInput();
  if (input) input.value = value || "";
}

function startEditPhrase(phraseId) {
  const phrase = state.phrases.find((item) => item.id === phraseId);
  if (!phrase) return;
  state.editingPhraseId = phraseId;
  elements.phraseLabelInput.value = phrase.label || "";
  elements.phraseHoursInput.value = phrase.hours || "";
  setPhraseActivityValue(phrase.activity_id || "");
  elements.phraseCommentsInput.value = phrase.comments || "";
  elements.phraseAddButton.textContent = "儲存修改";
  elements.phraseCancelButton.style.display = "";
  elements.phraseCommentsInput.focus();
}

function resetPhraseForm() {
  state.editingPhraseId = null;
  elements.phraseLabelInput.value = "";
  elements.phraseHoursInput.value = "";
  setPhraseActivityValue("");
  elements.phraseCommentsInput.value = "";
  elements.phraseAddButton.textContent = "儲存模板";
  elements.phraseCancelButton.style.display = "none";
}

function applyPhraseFields(phrase, entry) {
  if (phrase.hours) entry.hours = phrase.hours;
  if (phrase.activity_id) entry.activity_id = phrase.activity_id;
  if (phrase.comments) entry.comments = phrase.comments;
  clearEntryPreviewState(entry);
}

function renderSourcesDrawer() {
  if (!state.savedQueries.length) {
    elements.savedQueriesList.innerHTML = emptyStateHtml({
      icon: "🔍",
      title: "尚未加入任何 PJ 篩選器",
      hint: "先去 Redmine 建立自訂查詢，從網址 ?query_id=X 抓 ID 與顯示名稱填進上方表單。",
    });
  } else {
    elements.savedQueriesList.innerHTML = state.savedQueries
      .map(
        (query) => `
          <div class="pj-item-card">
            <div class="pj-item-head">
              <div>
                <h3 class="pj-item-title">${escapeHtml(query.name)}</h3>
                <div class="muted">query_id: ${query.query_id}</div>
              </div>
              <button class="pj-danger-button" data-remove-query="${query.query_id}">移除</button>
            </div>
          </div>
        `
      )
      .join("");
  }

  for (const btn of elements.savedQueriesList.querySelectorAll("[data-remove-query]")) {
    btn.addEventListener("click", async (event) => {
      const qid = Number(event.currentTarget.dataset.removeQuery);
      const target = state.savedQueries.find((q) => q.query_id === qid);
      const name = target?.name || `#${qid}`;
      const ok = await showConfirmModal({
        title: "移除 PJ 篩選器",
        body: `確定要移除「${name}」嗎？此操作只會從工具裡拿掉，不會影響 Redmine 本身的查詢。`,
        confirmText: "移除",
        danger: true,
      });
      if (!ok) return;
      try {
        await withLoading("移除 PJ 篩選器...", () => removeSavedQuery(qid));
        showToast("已移除 PJ 篩選器");
        renderAll();  // pj-source-tabs 與 saved-queries-list 同步刷新
      } catch (error) {
        state.sourcesWarnings = [error.message || String(error)];
        renderAlerts();
      }
    });
  }
}

function openSettings() {
  state.settingsOpen = true;
  elements.settingsModal.hidden = false;
  elements.settingsModal.removeAttribute("aria-hidden");
  applySettingsTab();
  renderPhrasesDrawer();
  renderSourcesDrawer();
}

function closeSettings() {
  state.settingsOpen = false;
  elements.settingsModal.hidden = true;
  elements.settingsModal.setAttribute("aria-hidden", "true");
}

function applySettingsTab() {
  for (const btn of elements.settingsModal.querySelectorAll("[data-settings-tab]")) {
    btn.classList.toggle("active", btn.dataset.settingsTab === state.settingsTab);
  }
  for (const sec of elements.settingsModal.querySelectorAll("[data-settings-section]")) {
    sec.classList.toggle("active", sec.dataset.settingsSection === state.settingsTab);
  }
}

function updateSettingsTheme() {
  for (const btn of document.querySelectorAll("[data-theme-value]")) {
    btn.classList.toggle("active", btn.dataset.themeValue === state.theme);
  }
}

function updateAboutInfo() {
  const v = document.getElementById("app-version");
  const b = document.getElementById("app-build-time");
  if (v) v.textContent = APP_VERSION;
  if (b) b.textContent = APP_BUILD_TIME;
}

function openCommitModal() {
  const rows = selectedValidRows();
  if (!rows.length) return;
  elements.commitModalDate.value = state.batchSpentOn;
  updateCommitModalDateWarn();
  const totalHours = rows.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
  elements.commitModalSummary.textContent =
    `即將送出 ${rows.length} 筆工時，共 ${totalHours.toFixed(1)} 小時`;
  elements.commitModal.hidden = false;
  elements.commitModal.removeAttribute("aria-hidden");
  elements.commitModalDate.focus();
}

function closeCommitModal() {
  elements.commitModal.hidden = true;
  elements.commitModal.setAttribute("aria-hidden", "true");
}

function updateCommitModalDateWarn() {
  const selected = elements.commitModalDate.value;
  const today = daysAgoString(0);
  const yesterday = daysAgoString(1);
  if (selected && selected !== today && selected !== yesterday) {
    elements.commitModalDateWarn.textContent =
      `注意：所選日期 ${selected} 不是今天或昨天，請確認是否正確`;
    elements.commitModalDateWarn.hidden = false;
  } else {
    elements.commitModalDateWarn.hidden = true;
  }
}

function initThemeButtons() {
  for (const btn of document.querySelectorAll("[data-theme-value]")) {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.themeValue);
      updateSettingsTheme();
    });
  }
}

function renderAll() {
  renderTopTabs();
  renderSourceTabs();
  renderIssueList();
  renderAlerts();
  renderTable();
  if (state.sideView === "phrases") renderPhrasesDrawer();
  if (state.sideView === "sources") renderSourcesDrawer();
  if (state.sideView === "issue-batch") renderIssueBatchView();
  renderLoadingMask();
  updateButtons();
  updateDailyTotalBadge();
  updateSettingsTheme();
  persistState();
}

let __batchRowUidCounter = 1;
function nextBatchRowUid() { return "br-" + (__batchRowUidCounter++); }

function makeBatchRow(subject = "", templateId = null) {
  return {
    uid: nextBatchRowUid(),
    subject: subject || "",
    estimated_hours: "",
    start_date: "",
    due_date: "",
    templateId,
  };
}

function startEditIssueTemplate(id) {
  const tpl = state.issueTemplates.find((t) => t.id === id);
  if (!tpl) return;
  state.editingIssueTemplateId = id;
  elements.issueTemplateSubjectInput.value = tpl.subject;
  elements.issueTemplateAddButton.textContent = "儲存修改";
  elements.issueTemplateCancelButton.style.display = "";
  elements.issueTemplateSubjectInput.focus();
  renderBatchTemplatesPicker();
}

function resetIssueTemplateForm() {
  state.editingIssueTemplateId = null;
  elements.issueTemplateSubjectInput.value = "";
  elements.issueTemplateAddButton.textContent = "儲存模板";
  elements.issueTemplateCancelButton.style.display = "none";
  renderBatchTemplatesPicker();
}

async function addOrUpdateIssueTemplate() {
  const subject = elements.issueTemplateSubjectInput.value.trim();
  if (!subject) {
    state.issueTemplatesWarnings = ["Subject 不可為空。"];
    renderBatchAlerts();
    return;
  }
  const editingId = state.editingIssueTemplateId;
  if (editingId) {
    const data = await fetchJson(`/api/issue-templates/${encodeURIComponent(editingId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    });
    const idx = state.issueTemplates.findIndex((t) => t.id === editingId);
    if (idx >= 0) state.issueTemplates[idx] = data.template;
  } else {
    const data = await fetchJson("/api/issue-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    });
    state.issueTemplates.push(data.template);
  }
  state.issueTemplatesWarnings = [];
  resetIssueTemplateForm();
}

async function deleteIssueTemplateById(id) {
  await fetchJson(`/api/issue-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
  state.issueTemplates = state.issueTemplates.filter((t) => t.id !== id);
  state.batchSelectedTemplateIds.delete(id);
}

function renderIssueBatchView() {
  if (!elements.batchProjectInput) return;
  renderBatchProjectsDatalist();
  renderBatchTrackerSelect();
  renderBatchTemplatesPicker();
  renderBatchRowsTable();
  renderBatchAlerts();
  renderBatchSummary();
  renderBatchResults();
}

function renderBatchProjectsDatalist() {
  const dl = elements.batchProjectsDatalist;
  if (!dl) return;
  dl.innerHTML = state.projectsList
    .map((p) => `<option value="${escapeHtml(p.name)}" data-id="${p.id}"></option>`)
    .join("");
  if (elements.batchProjectInput.value !== state.batchProjectInputValue) {
    elements.batchProjectInput.value = state.batchProjectInputValue || "";
  }
  syncBatchProjectHint();
}

function syncBatchProjectHint() {
  const hint = elements.batchProjectHint;
  if (!hint) return;
  if (!state.projectsLoaded) {
    hint.textContent = state.batchPrereqLoading ? "載入專案中…" : "";
    return;
  }
  const val = (state.batchProjectInputValue || "").trim();
  if (!val) { hint.textContent = `共 ${state.projectsList.length} 個可選專案`; return; }
  if (state.batchProjectId) {
    const p = state.projectsList.find((x) => x.id === state.batchProjectId);
    hint.textContent = p ? `已選 #${p.id}（${p.identifier}）` : "";
  } else {
    hint.textContent = "找不到符合的專案，請從清單挑選";
  }
}

function renderBatchTrackerSelect() {
  const sel = elements.batchTrackerSelect;
  if (!sel) return;
  if (!state.trackersLoaded) {
    sel.innerHTML = `<option value="">${state.batchPrereqLoading ? "載入 tracker 中…" : "（請先載入）"}</option>`;
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  const cur = state.batchTrackerId ? String(state.batchTrackerId) : "";
  const opts = [`<option value="">— 請選擇 —</option>`].concat(
    state.trackersList.map((t) => `<option value="${t.id}" ${String(t.id) === cur ? "selected" : ""}>${escapeHtml(t.name)}</option>`)
  );
  sel.innerHTML = opts.join("");
}

function updateBatchEditBanner() {
  const banner = elements.batchEditBanner;
  if (!banner) return;
  const editingId = state.editingIssueTemplateId;
  if (!editingId) {
    banner.hidden = true;
    return;
  }
  const tpl = state.issueTemplates.find((t) => t.id === editingId);
  if (elements.batchEditBannerSubject) {
    elements.batchEditBannerSubject.textContent = tpl ? tpl.subject : "";
  }
  banner.hidden = false;
}

function renderBatchTemplatesPicker() {
  const box = elements.batchTemplatesPicker;
  if (!box) {
    updateBatchEditBanner();
    return;
  }
  if (!state.issueTemplates.length) {
    box.innerHTML = `<div class="pj-batch-empty-state">
      <div>尚未建立 issue 模板</div>
      <button type="button" class="pj-ghost-button" id="batch-empty-add-cta">+ 新增第一個模板</button>
      <div class="muted">也可以略過模板，按下方「新增空白列」直接手動加列。</div>
    </div>`;
    const cta = box.querySelector("#batch-empty-add-cta");
    if (cta) {
      cta.addEventListener("click", () => {
        if (elements.issueTemplateSubjectInput) elements.issueTemplateSubjectInput.focus();
      });
    }
    updateBatchEditBanner();
    return;
  }
  const editingId = state.editingIssueTemplateId;
  box.innerHTML = state.issueTemplates.map((tpl) => {
    const checked = state.batchSelectedTemplateIds.has(tpl.id);
    const isEditing = editingId === tpl.id;
    return `
      <span class="pj-batch-template-chip ${checked ? "checked" : ""} ${isEditing ? "editing" : ""}" data-tpl-id="${escapeHtml(tpl.id)}">
        <label class="pj-batch-template-chip-toggle">
          <input type="checkbox" data-batch-template-toggle="${escapeHtml(tpl.id)}" ${checked ? "checked" : ""}>
          <span>${escapeHtml(tpl.subject)}</span>
        </label>
        <button class="pj-batch-template-chip-action" title="編輯" data-edit-issue-template="${escapeHtml(tpl.id)}">✎</button>
        <button class="pj-batch-template-chip-action" title="刪除" data-delete-issue-template="${escapeHtml(tpl.id)}">🗑</button>
      </span>
    `;
  }).join("");

  for (const cb of box.querySelectorAll("[data-batch-template-toggle]")) {
    cb.addEventListener("change", (e) => {
      const id = e.currentTarget.dataset.batchTemplateToggle;
      const wasAdded = e.currentTarget.checked;
      if (wasAdded) {
        state.batchSelectedTemplateIds.add(id);
        // 若還沒對應 row 才 push（避免重複勾選 → 重複觸發 → 重複加列）
        if (!state.batchRows.some((r) => r.templateId === id)) {
          const tpl = state.issueTemplates.find((t) => t.id === id);
          if (tpl) state.batchRows.push(makeBatchRow(tpl.subject, id));
        }
      } else {
        state.batchSelectedTemplateIds.delete(id);
        state.batchRows = state.batchRows.filter((r) => r.templateId !== id);
      }
      state.batchWarnings = [];
      renderBatchTemplatesPicker();
      renderBatchRowsTable();
      renderBatchSummary();
      renderBatchAlerts();
      // 套用模板加入新列後自動 scroll 到表格，讓使用者知道列已加入
      if (wasAdded) {
        requestAnimationFrame(() => {
          const tbl = document.getElementById("pj-batch-rows-table");
          if (tbl) tbl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    });
  }
  for (const btn of box.querySelectorAll("[data-edit-issue-template]")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      startEditIssueTemplate(e.currentTarget.dataset.editIssueTemplate);
    });
  }
  for (const btn of box.querySelectorAll("[data-delete-issue-template]")) {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const tplId = e.currentTarget.dataset.deleteIssueTemplate;
      const tpl = state.issueTemplates.find((t) => t.id === tplId);
      const subj = tpl?.subject?.slice(0, 40) || "此模板";
      const ok = await showConfirmModal({
        title: "刪除 issue 模板",
        body: `確定要刪除「${subj}」嗎？\n此操作無法復原。`,
        confirmText: "刪除",
        danger: true,
      });
      if (!ok) return;
      try {
        await withLoading("刪除 issue 模板中...", () => deleteIssueTemplateById(tplId));
        showToast("已刪除 issue 模板");
        renderBatchTemplatesPicker();
      } catch (err) {
        state.issueTemplatesWarnings = [err.message || String(err)];
        renderBatchAlerts();
      }
    });
  }
  updateBatchEditBanner();
}

function renderBatchRowsTable() {
  const tbody = elements.batchRowsTbody;
  if (!tbody) return;
  if (!state.batchRows.length) {
    tbody.innerHTML = `<tr><td colspan="5">${emptyStateHtml({
      icon: "➕",
      title: "還沒有要建立的 issue",
      hint: "從上方勾選 issue 模板自動加入列，或按「新增空白列」直接手動加。",
    })}</td></tr>`;
    return;
  }
  tbody.innerHTML = state.batchRows.map((row) => `
    <tr data-batch-row-uid="${escapeHtml(row.uid)}">
      <td class="pj-col-subject"><input type="text" data-batch-row-field="subject" value="${escapeHtml(row.subject)}" placeholder="subject"></td>
      <td class="pj-col-hours">
        <div class="pj-hours-stepper">
          <button type="button" class="pj-stepper-btn" data-batch-row-step="-0.5" data-batch-row-uid="${escapeHtml(row.uid)}" aria-label="減 0.5 小時">−</button>
          <input class="pj-hours-input" type="number" step="0.5" min="0" max="999" data-batch-row-field="estimated_hours" value="${escapeHtml(row.estimated_hours || "")}" placeholder="0">
          <button type="button" class="pj-stepper-btn" data-batch-row-step="0.5" data-batch-row-uid="${escapeHtml(row.uid)}" aria-label="加 0.5 小時">＋</button>
        </div>
      </td>
      <td class="pj-col-date"><input type="date" data-batch-row-field="start_date" value="${escapeHtml(row.start_date || "")}"></td>
      <td class="pj-col-date"><input type="date" data-batch-row-field="due_date" value="${escapeHtml(row.due_date || "")}"></td>
      <td class="pj-col-remove"><button class="pj-danger-button" data-batch-row-remove="${escapeHtml(row.uid)}">刪除</button></td>
    </tr>
  `).join("");

  for (const inp of tbody.querySelectorAll("[data-batch-row-field]")) {
    inp.addEventListener("input", (e) => {
      const tr = e.currentTarget.closest("tr");
      const uid = tr && tr.dataset.batchRowUid;
      const field = e.currentTarget.dataset.batchRowField;
      const row = state.batchRows.find((r) => r.uid === uid);
      if (!row) return;
      row[field] = e.currentTarget.value;
      renderBatchSummary();
    });
  }
  for (const btn of tbody.querySelectorAll("[data-batch-row-step]")) {
    btn.addEventListener("click", (e) => {
      const uid = e.currentTarget.dataset.batchRowUid;
      const step = parseFloat(e.currentTarget.dataset.batchRowStep);
      const row = state.batchRows.find((r) => r.uid === uid);
      if (!row) return;
      const current = parseFloat(row.estimated_hours) || 0;
      let next = Math.max(0, current + step);
      next = Math.round(next * 10) / 10;
      row.estimated_hours = next === 0 ? "" : String(next);
      const tr = e.currentTarget.closest("tr");
      const input = tr && tr.querySelector('[data-batch-row-field="estimated_hours"]');
      if (input) input.value = row.estimated_hours;
      renderBatchSummary();
    });
  }
  for (const btn of tbody.querySelectorAll("[data-batch-row-remove]")) {
    btn.addEventListener("click", (e) => {
      const uid = e.currentTarget.dataset.batchRowRemove;
      const removed = state.batchRows.find((r) => r.uid === uid);
      state.batchRows = state.batchRows.filter((r) => r.uid !== uid);
      // 若此 row 是從某 template 來的，連動 uncheck chip
      if (removed && removed.templateId) {
        state.batchSelectedTemplateIds.delete(removed.templateId);
      }
      renderBatchTemplatesPicker();
      renderBatchRowsTable();
      renderBatchSummary();
    });
  }
}

function renderBatchAlerts() {
  const box = elements.batchAlertStack;
  if (!box) return;
  const warns = [
    ...(state.batchWarnings || []),
    ...(state.issueTemplatesWarnings || []),
  ];
  box.innerHTML = warns.length
    ? `<div class="alert warn">${warns.map(escapeHtml).join("<br>")}</div>`
    : "";
}

function renderBatchSummary() {
  const summary = elements.batchSummary;
  if (!summary) return;
  const n = state.batchRows.length;
  const projectName = (() => {
    const p = state.projectsList.find((x) => x.id === state.batchProjectId);
    return p ? p.name : "(未選)";
  })();
  const trackerName = (() => {
    const t = state.trackersList.find((x) => x.id === state.batchTrackerId);
    return t ? t.name : "(未選)";
  })();
  if (!n) {
    summary.textContent = "尚未加入任何列。";
    summary.classList.remove("pj-has-rows");
    summary.classList.add("muted");
  } else {
    summary.textContent = `將在「${projectName}」以 tracker「${trackerName}」建立 ${n} 筆 issue。`;
    summary.classList.add("pj-has-rows");
    summary.classList.remove("muted");
  }
  if (elements.batchCreateButton) {
    elements.batchCreateButton.textContent = n ? `建立 ${n} 筆 issue` : "建立";
    elements.batchCreateButton.disabled = !n;
  }
}

function renderBatchResults() {
  const box = elements.batchResultsList;
  if (!box) return;
  const results = state.batchResults || [];
  if (!results.length) { box.innerHTML = ""; return; }
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  const header = `<div class="muted">本次建立結果：✓ ${okCount} 筆成功 / ✗ ${failCount} 筆失敗</div>`;
  const items = results.map((r) => {
    if (r.ok) {
      return `<div class="pj-batch-result-card ok">
        ✓ <strong>${escapeHtml(r.subject)}</strong>
        — <a href="${escapeHtml(r.issue_url || ("/issues/" + r.issue_id))}" target="_blank" rel="noopener">#${r.issue_id}</a>
      </div>`;
    }
    return `<div class="pj-batch-result-card fail">
      ✗ <strong>${escapeHtml(r.subject || "(空 subject)")}</strong>
      — ${escapeHtml(r.error || "未知錯誤")}
    </div>`;
  }).join("");
  box.innerHTML = header + items;
}

async function submitBatchCreate() {
  state.batchWarnings = [];
  state.batchResults = [];
  if (!state.batchProjectId) {
    state.batchWarnings.push("請選擇 project。");
  }
  if (!state.batchTrackerId) {
    state.batchWarnings.push("請選擇 tracker。");
  }
  if (!state.batchRows.length) {
    state.batchWarnings.push("請至少加入一筆 issue。");
  }
  const emptySubjectCount = state.batchRows.filter((r) => !String(r.subject || "").trim()).length;
  if (emptySubjectCount) {
    state.batchWarnings.push(`有 ${emptySubjectCount} 列的 subject 為空，請填寫或刪除。`);
  }
  if (state.batchWarnings.length) {
    renderBatchAlerts();
    return;
  }
  const payload = {
    project_id: state.batchProjectId,
    tracker_id: state.batchTrackerId,
    rows: state.batchRows.map((r) => ({
      subject: String(r.subject || "").trim(),
      estimated_hours: r.estimated_hours,
      start_date: r.start_date,
      due_date: r.due_date,
    })),
  };
  const data = await fetchJson("/api/issues/batch-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  state.batchResults = data.results || [];
  const successUids = new Set();
  let okIdx = 0;
  for (const row of state.batchRows) {
    const r = state.batchResults[okIdx++];
    if (r && r.ok) {
      successUids.add(row.uid);
      // 成功送出 → 同時取消對應 chip 勾選
      if (row.templateId) state.batchSelectedTemplateIds.delete(row.templateId);
    }
  }
  state.batchRows = state.batchRows.filter((r) => !successUids.has(r.uid));
}

async function previewEntries() {
  if (!state.draftEntries.length) return;
  const data = await fetchJson("/api/time-entries/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spent_on: state.batchSpentOn, entries: state.draftEntries }),
  });
  state.previewToken = data.preview_token || "";
  state.previewWarnings = data.warnings || [];
  state.commitResults = [];
  state.batchSpentOn = data.spent_on || state.batchSpentOn;
  state.draftEntries = data.entries || [];
}

async function commitEntries() {
  if (!state.previewToken) return;
  const data = await fetchJson("/api/time-entries/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      preview_token: state.previewToken,
      spent_on: state.batchSpentOn,
      entries: state.draftEntries,
    }),
  });
  state.commitResults = data.results || [];
  state.previewToken = "";
  const successIds = new Set(
    state.commitResults
      .filter((r) => r && r.created_time_entry_id)
      .map((r) => r.issue_id)
  );
  if (successIds.size > 0) {
    state.draftEntries = state.draftEntries.filter((entry) => !successIds.has(entry.issue_id));
    if (successIds.has(lastFocusedEntryId)) lastFocusedEntryId = null;
  }
}

function computeDailyTotal() {
  let total = 0;
  for (const entry of state.draftEntries) {
    if (!entry.selected) continue;
    const h = parseFloat(entry.hours);
    if (Number.isFinite(h)) total += h;
  }
  return total;
}

function updateDailyTotalBadge() {
  if (!elements.dailyTotalBadge) return;
  const total = computeDailyTotal();
  const limit = state.dailyHourLimit;
  elements.dailyTotalBadge.textContent = `${total.toFixed(1)} / ${limit} h`;
  elements.dailyTotalBadge.classList.toggle("overflow", total > limit + 0.001);
}

function collectPhraseFormPayload() {
  const activityInput = getPhraseActivityInput();
  return {
    label: elements.phraseLabelInput.value.trim(),
    hours: elements.phraseHoursInput.value.trim(),
    activity_id: activityInput ? activityInput.value.trim() : "",
    comments: elements.phraseCommentsInput.value.trim(),
  };
}

async function addOrUpdatePhrase() {
  const payload = collectPhraseFormPayload();
  if (!payload.hours && !payload.activity_id && !payload.comments) {
    state.phrasesWarnings = ["至少要設定工時、活動或備註其中一項。"];
    renderAlerts();
    return;
  }
  const editingId = state.editingPhraseId;
  if (editingId) {
    const data = await fetchJson(`/api/phrases/${encodeURIComponent(editingId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const index = state.phrases.findIndex((item) => item.id === editingId);
    if (index >= 0) state.phrases[index] = data.phrase;
  } else {
    const data = await fetchJson("/api/phrases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.phrases.push(data.phrase);
  }
  state.phrasesWarnings = [];
  resetPhraseForm();
}

async function deletePhraseById(phraseId) {
  await fetchJson(`/api/phrases/${encodeURIComponent(phraseId)}`, { method: "DELETE" });
  state.phrases = state.phrases.filter((item) => item.id !== phraseId);
}

async function addSavedQuery() {
  const name = elements.queryNameInput.value.trim();
  const rawId = elements.queryIdInput.value.trim();
  if (!name) {
    state.sourcesWarnings = ["請填寫 PJ 篩選器名稱。"];
    renderAlerts();
    return;
  }
  if (!rawId) {
    state.sourcesWarnings = ["請填寫 query_id。"];
    renderAlerts();
    return;
  }
  const data = await fetchJson("/api/saved-queries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, query_id: Number(rawId) }),
  });
  const query = data.query;
  const existingIndex = state.savedQueries.findIndex((item) => item.query_id === query.query_id);
  if (existingIndex >= 0) {
    state.savedQueries[existingIndex] = query;
  } else {
    state.savedQueries.push(query);
  }
  state.sourcesWarnings = [];
  elements.queryNameInput.value = "";
  elements.queryIdInput.value = "";
}

async function removeSavedQuery(queryId) {
  await fetchJson(`/api/saved-queries/${queryId}`, { method: "DELETE" });
  state.savedQueries = state.savedQueries.filter((item) => item.query_id !== queryId);
  if (state.currentSource.type === "query" && state.currentSource.id === queryId) {
    state.currentSource = { type: "mine" };
    await fetchIssues({ resetSelected: true });
  }
}

function loadStoreSettings() {
  const Store = window.__worklog_Store;
  if (!Store) return;
  const limit = Number(Store.get("daily_hour_limit", 6.5));
  if (Number.isFinite(limit) && limit >= 3 && limit <= 12) {
    state.dailyHourLimit = Math.round(limit * 2) / 2;
  }
}

function getDefaultSpentOnOffset() {
  const Store = window.__worklog_Store;
  if (!Store) return 1;
  const raw = Number(Store.get("default_spent_on_offset", 1));
  if (!Number.isFinite(raw) || raw < 0) return 1;
  return Math.min(Math.floor(raw), 30);
}

async function initializeApp() {
  loadStoreSettings();
  const stored = loadStoredState();
  const fallbackOffset = getDefaultSpentOnOffset();
  if (stored) {
    state.draftEntries = stored.draftEntries;
    state.batchSpentOn = stored.batchSpentOn || daysAgoString(fallbackOffset);
    state.currentSource = stored.currentSource || { type: "mine" };
  } else {
    state.batchSpentOn = daysAgoString(fallbackOffset);
  }
  updateAboutInfo();
  await withLoading("初始化中...", async () => {
    await Promise.all([fetchActivities(), fetchSavedQueries(), fetchPhrases(), fetchIssueTemplates()]);
    if (
      state.currentSource.type === "query" &&
      !state.savedQueries.some((q) => q.query_id === state.currentSource.id)
    ) {
      state.currentSource = { type: "mine" };
    }
    await fetchIssues();
  });
  initThemeButtons();
  renderAll();
}

elements.refreshButton.addEventListener("click", async () => {
  try {
    await withLoading("重新載入 issue 中...", () => fetchIssues({ resetSelected: false }));
    renderAll();
  } catch (error) {
    state.issueWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.filterDate.addEventListener("change", async (event) => {
  state.filterDate = event.target.value || "";
  try {
    await withLoading("套用篩選中...", () => fetchIssues({ resetSelected: false }));
    renderAll();
  } catch (error) {
    state.issueWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.filterSearch.addEventListener("input", (event) => {
  state.filterSearch = event.target.value || "";
  renderIssueList();
  updateButtons();
});

elements.selectAllButton.addEventListener("click", () => {
  for (const issue of filteredIssues()) {
    if (!isIssueInDrafts(issue.issue_id)) {
      upsertDraftEntry(issue.issue_id);
    }
  }
  renderAll();
});

elements.clearSelectionButton.addEventListener("click", () => {
  clearAllDrafts();
  renderAll();
});

for (const btn of document.querySelectorAll("[data-side-view]")) {
  btn.addEventListener("click", async () => {
    const target = btn.dataset.sideView;
    state.sideView = target;
    const isSchedule = state.currentSource.type === "schedule";
    try {
      if (target === "schedule" && !isSchedule) {
        await switchSource({ type: "schedule" });
      } else if (target === "worklog" && isSchedule) {
        await switchSource({ type: "mine" });
      } else if (target === "issue-batch") {
        renderAll();
        if (!state.projectsLoaded || !state.trackersLoaded) {
          try {
            await withLoading("載入專案 / tracker 中...", loadBatchPrerequisites);
          } catch (e) {
            state.batchWarnings = ["載入專案 / tracker 失敗：" + (e.message || String(e))];
          }
          renderAll();
        }
      } else {
        // phrases / sources / issue-templates 純 view 切換，不動 source
        renderAll();
      }
    } catch (err) {
      state.issueWarnings = [err.message || String(err)];
      renderAll();
    }
  });
}

elements.settingsButton.addEventListener("click", () => openSettings());
elements.settingsModalClose.addEventListener("click", () => closeSettings());
elements.settingsModal.addEventListener("click", (e) => {
  if (e.target === elements.settingsModal) closeSettings();
});
for (const btn of elements.settingsModal.querySelectorAll("[data-settings-tab]")) {
  btn.addEventListener("click", () => {
    state.settingsTab = btn.dataset.settingsTab;
    applySettingsTab();
  });
}

elements.phraseAddButton.addEventListener("click", async () => {
  const wasEditing = !!state.editingPhraseId;
  try {
    await withLoading("儲存工時模板中...", addOrUpdatePhrase);
    if (!state.phrasesWarnings.length) {
      showToast(wasEditing ? "已更新工時模板" : "已新增工時模板");
    }
    renderAll();  // 整體 re-render 讓 entry 下拉、phrases-list 同步
  } catch (error) {
    state.phrasesWarnings = [error.message || String(error)];
    renderAlerts();
  }
});

elements.phraseCancelButton.addEventListener("click", () => {
  resetPhraseForm();
});

elements.queryAddButton.addEventListener("click", async () => {
  try {
    await withLoading("加入 PJ 篩選器中...", addSavedQuery);
    if (!state.sourcesWarnings.length) showToast("已新增 PJ 篩選器");
    renderAll();  // pj-source-tabs、saved-queries-list、view 都同步
  } catch (error) {
    state.sourcesWarnings = [error.message || String(error)];
    renderAlerts();
  }
});

elements.commitButton.addEventListener("click", () => {
  openCommitModal();
});

elements.commitModalConfirm.addEventListener("click", async () => {
  const selectedDate = elements.commitModalDate.value;
  if (selectedDate !== state.batchSpentOn) {
    state.batchSpentOn = selectedDate;
    clearAllEntryPreviewState();
  }
  closeCommitModal();
  try {
    await withLoading("送出到 Redmine 中...", async () => {
      await previewEntries();
      const hasFieldErrors = state.draftEntries.some(
        (e) => Object.keys(e.errors || {}).length > 0
      );
      if (!state.previewToken || hasFieldErrors) {
        throw new Error("驗證未通過，請檢查欄位後再送出");
      }
      await commitEntries();
    });
    renderAll();
  } catch (error) {
    state.commitResults = [];
    state.previewWarnings = [error.message || String(error)];
    renderAll();
  }
});

elements.commitModalCancel.addEventListener("click", closeCommitModal);
elements.commitModalClose.addEventListener("click", closeCommitModal);
elements.commitModal.addEventListener("click", (e) => {
  if (e.target === elements.commitModal) closeCommitModal();
});
elements.commitModalDate.addEventListener("change", updateCommitModalDateWarn);
for (const btn of document.querySelectorAll("[data-modal-offset]")) {
  btn.addEventListener("click", (e) => {
    const offset = Number(e.currentTarget.dataset.modalOffset);
    elements.commitModalDate.value = daysAgoString(offset);
    updateCommitModalDateWarn();
  });
}

elements.batchSpentOn.addEventListener("change", (event) => {
  state.batchSpentOn = event.target.value;
  clearAllEntryPreviewState();
  renderAll();
});

for (const btn of document.querySelectorAll("[data-spent-on-offset]")) {
  btn.addEventListener("click", (event) => {
    const offset = Number(event.currentTarget.dataset.spentOnOffset);
    state.batchSpentOn = daysAgoString(offset);
    clearAllEntryPreviewState();
    renderAll();
  });
}

// 統一的日期快選按鈕（mine / visited 共用）
for (const btn of document.querySelectorAll("[data-day-filter]")) {
  btn.addEventListener("click", async () => {
    const offset = btn.dataset.dayFilter;
    state.filterDate = offset === "" ? "" : daysAgoString(Number(offset));
    try {
      await withLoading("套用篩選中...", () => fetchIssues({ resetSelected: false }));
    } catch (err) {
      state.issueWarnings = [err.message || String(err)];
    }
    renderAll();
  });
}

if (elements.scheduleApplyButton) {
  elements.scheduleApplyButton.addEventListener("click", async () => {
    try {
      await applyScheduleDates();
    } catch (error) {
      state.issueWarnings = [error.message || String(error)];
      renderAll();
    }
  });
}


if (elements.issueTemplateAddButton) {
  elements.issueTemplateAddButton.addEventListener("click", async () => {
    const wasEditing = !!state.editingIssueTemplateId;
    try {
      await withLoading("儲存 issue 模板中...", addOrUpdateIssueTemplate);
      if (!(state.issueTemplatesWarnings && state.issueTemplatesWarnings.length)) {
        showToast(wasEditing ? "已更新 issue 模板" : "已新增 issue 模板");
      }
      renderBatchTemplatesPicker();
      renderBatchAlerts();
    } catch (err) {
      state.issueTemplatesWarnings = [err.message || String(err)];
      renderBatchAlerts();
    }
  });
}
if (elements.issueTemplateCancelButton) {
  elements.issueTemplateCancelButton.addEventListener("click", () => {
    resetIssueTemplateForm();
  });
}
if (elements.batchEditBannerCancel) {
  elements.batchEditBannerCancel.addEventListener("click", () => {
    resetIssueTemplateForm();
  });
}
if (elements.issueTemplateSubjectInput) {
  elements.issueTemplateSubjectInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      elements.issueTemplateAddButton.click();
    }
  });
}

if (elements.batchProjectInput) {
  const matchProject = () => {
    const val = elements.batchProjectInput.value.trim();
    state.batchProjectInputValue = val;
    if (!val) { state.batchProjectId = null; syncBatchProjectHint(); return; }
    const exact = state.projectsList.find((p) => p.name === val);
    state.batchProjectId = exact ? exact.id : null;
    syncBatchProjectHint();
    renderBatchSummary();
  };
  elements.batchProjectInput.addEventListener("input", matchProject);
  elements.batchProjectInput.addEventListener("change", matchProject);
}
if (elements.batchTrackerSelect) {
  elements.batchTrackerSelect.addEventListener("change", (e) => {
    const v = Number(e.target.value);
    state.batchTrackerId = Number.isFinite(v) && v > 0 ? v : null;
    renderBatchSummary();
  });
}
if (elements.batchAddBlankRowButton) {
  elements.batchAddBlankRowButton.addEventListener("click", () => {
    state.batchRows.push(makeBatchRow());
    state.batchWarnings = [];
    renderBatchRowsTable();
    renderBatchSummary();
    renderBatchAlerts();
  });
}
if (elements.batchClearRowsButton) {
  elements.batchClearRowsButton.addEventListener("click", async () => {
    if (!state.batchRows.length) return;
    const ok = await showConfirmModal({
      title: "清空所有列",
      body: `確定要清空目前 ${state.batchRows.length} 列待建 issue？\n此操作無法復原。`,
      confirmText: "清空",
      danger: true,
    });
    if (!ok) return;
    state.batchRows = [];
    state.batchSelectedTemplateIds.clear();
    state.batchWarnings = [];
    renderBatchTemplatesPicker();
    renderBatchRowsTable();
    renderBatchSummary();
    renderBatchAlerts();
  });
}
if (elements.batchCreateButton) {
  elements.batchCreateButton.addEventListener("click", async () => {
    try {
      await withLoading("批次建立 issue 中...", submitBatchCreate);
      renderBatchTemplatesPicker();
      renderBatchAlerts();
      renderBatchRowsTable();
      renderBatchSummary();
      renderBatchResults();
    } catch (err) {
      state.batchWarnings = [err.message || String(err)];
      renderBatchAlerts();
    }
  });
}

// 給 settings-patch.js 設定即時生效用：worklog tab 改 daily_hour_limit 可立刻反映在 badge / summary
window.__worklog_applySettingChange = function (key, value) {
  if (key === "daily_hour_limit") {
    const v = Number(value);
    if (Number.isFinite(v) && v >= 3 && v <= 12) {
      state.dailyHourLimit = Math.round(v * 2) / 2;
      renderAll();
    }
  }
  // visit_retention_days 不需即時 mutate（下次 fetch issues source=visited 自動套用）
  // default_spent_on_offset 故意不即時改 state.batchSpentOn，避免 user 正在編輯時日期被覆蓋
};

applyTheme(loadTheme());

initializeApp().catch((error) => {
  state.issueWarnings = [error.message || String(error)];
  renderAll();
});

}


/* ===== Bootstrap =============================== */
function boot() {
  // 注入 Redmine 頂部 menu 入口（問題清單後面）
  if (!injectTopMenu()) {
    // 若 #top-menu-container 還沒就緒就稍等再試（Redmine 偶爾延遲）
    setTimeout(injectTopMenu, 500);
  }
  recordIssueVisit().catch(() => {});
  // 一次性清掉舊浮動按鈕位置殘留（已 deprecated）
  Store.del('launcher_pos');
  console.log('[LawPJ Worklog] userscript 已就緒（從上方 menu 進入工時助手）');
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

})();
