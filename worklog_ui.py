INDEX_HTML = """<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Easy Redmine Worklog Batch Preview</title>
    <style>
      :root {
        --bg: linear-gradient(135deg, #f7f1e3 0%, #dfe9f3 100%);
        --panel: rgba(255, 255, 255, 0.88);
        --panel-border: rgba(24, 33, 47, 0.08);
        --ink: #16202c;
        --muted: #5b6777;
        --accent: #0f766e;
        --accent-soft: rgba(15, 118, 110, 0.1);
        --danger: #b91c1c;
        --shadow: 0 18px 46px rgba(22, 32, 44, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--ink);
        font-family: "Segoe UI Variable", "Noto Sans TC", "PingFang TC", sans-serif;
      }

      button,
      input,
      select,
      textarea {
        font: inherit;
      }

      .shell {
        max-width: 1380px;
        margin: 0 auto;
        padding: 28px 18px 44px;
      }

      .hero {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 18px;
        margin-bottom: 18px;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 24px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(12px);
      }

      .hero-card {
        padding: 26px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 14px 0 10px;
        font-size: clamp(28px, 4vw, 44px);
        line-height: 1.04;
      }

      .summary {
        margin: 0;
        color: var(--muted);
        line-height: 1.72;
      }

      .status-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 18px;
      }

      .status-item {
        padding: 14px 16px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.76);
        border: 1px solid rgba(24, 33, 47, 0.08);
      }

      .status-item strong,
      .section-title {
        display: block;
        margin-bottom: 8px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 22px;
        margin-bottom: 18px;
      }

      .date-nav {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 10px;
      }

      .nav-button,
      .action-button,
      .ghost-button,
      .danger-button {
        border: 0;
        border-radius: 999px;
        padding: 10px 16px;
        cursor: pointer;
      }

      .nav-button {
        min-width: 48px;
      }

      .toolbar-actions,
      .workbench-actions,
      .batch-meta-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .action-button {
        background: var(--accent);
        color: white;
      }

      .ghost-button {
        background: rgba(24, 33, 47, 0.06);
        color: var(--ink);
      }

      .danger-button {
        background: var(--danger);
        color: white;
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .layout {
        display: grid;
        grid-template-columns: 1fr;
        gap: 18px;
      }

      .list-panel,
      .details-panel {
        padding: 18px;
      }

      .issue-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 12px;
      }

      .issue-card {
        border: 1px solid rgba(24, 33, 47, 0.08);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.76);
        padding: 16px;
      }

      .issue-card.selected {
        background: rgba(15, 118, 110, 0.08);
        border-color: rgba(15, 118, 110, 0.28);
      }

      .issue-select {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 12px;
        align-items: start;
      }

      .issue-checkbox {
        margin-top: 4px;
        transform: scale(1.2);
      }

      .issue-headline {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        color: var(--muted);
        margin-bottom: 8px;
      }

      .issue-title {
        display: block;
        font-size: 17px;
        line-height: 1.5;
        margin-bottom: 10px;
      }

      .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .tag {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(24, 33, 47, 0.06);
        color: var(--muted);
        font-size: 12px;
      }

      .empty-state {
        padding: 24px;
        border-radius: 18px;
        background: rgba(24, 33, 47, 0.04);
        color: var(--muted);
        line-height: 1.7;
      }

      .workbench-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .batch-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
        padding: 16px;
        border-radius: 18px;
        background: rgba(24, 33, 47, 0.04);
      }

      .field-stack {
        display: grid;
        gap: 8px;
        min-width: 220px;
      }

      .field-stack.compact {
        min-width: 210px;
      }

      .field-stack span {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .helper-copy {
        color: var(--muted);
        line-height: 1.6;
      }

      .alert-stack {
        display: grid;
        gap: 10px;
        margin-bottom: 14px;
      }

      .alert {
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(24, 33, 47, 0.08);
        background: rgba(24, 33, 47, 0.04);
        line-height: 1.6;
      }

      .alert.warn {
        background: rgba(180, 83, 9, 0.08);
        border-color: rgba(180, 83, 9, 0.16);
      }

      .table-wrap {
        overflow-x: auto;
        border: 1px solid rgba(24, 33, 47, 0.08);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.8);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 1120px;
      }

      .col-send {
        width: 70px;
      }

      .col-hours {
        width: 110px;
      }

      .col-activity {
        width: 220px;
      }

      .col-comments {
        width: 420px;
      }

      .col-check {
        width: 260px;
      }

      th,
      td {
        padding: 12px;
        border-bottom: 1px solid rgba(24, 33, 47, 0.08);
        vertical-align: top;
      }

      th {
        text-align: left;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        background: rgba(24, 33, 47, 0.04);
      }

      tr:last-child td {
        border-bottom: 0;
      }

      input[type="date"],
      input[type="number"],
      input[type="text"],
      select,
      textarea {
        width: 100%;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(24, 33, 47, 0.12);
        background: white;
        color: var(--ink);
      }

      textarea {
        min-height: 84px;
        resize: vertical;
      }

      .hours-input {
        max-width: 100px;
      }

      .row-errors {
        margin: 0;
        padding-left: 18px;
        color: var(--danger);
        font-size: 13px;
        line-height: 1.5;
      }

      .duplicate-chip {
        display: inline-flex;
        margin-bottom: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(180, 83, 9, 0.1);
        color: #b45309;
        font-size: 12px;
      }

      .duplicate-list,
      .result-list {
        margin: 0;
        padding-left: 18px;
        color: var(--muted);
        line-height: 1.55;
      }

      .muted {
        color: var(--muted);
      }

      .send-note {
        margin-top: 12px;
        color: var(--muted);
        font-size: 13px;
      }

      .drawer-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(22, 32, 44, 0.34);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
      }

      .drawer-backdrop.open {
        opacity: 1;
        pointer-events: auto;
      }

      .drawer {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(560px, 100vw);
        padding: 22px 18px 24px;
        background: rgba(248, 250, 252, 0.96);
        border-left: 1px solid rgba(24, 33, 47, 0.08);
        box-shadow: -16px 0 40px rgba(22, 32, 44, 0.18);
        transform: translateX(100%);
        transition: transform 180ms ease;
        overflow-y: auto;
        z-index: 10;
      }

      .drawer.open {
        transform: translateX(0);
      }

      .drawer-header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .drawer-title {
        margin: 0;
        font-size: 24px;
      }

      .drawer-summary {
        margin-bottom: 16px;
        color: var(--muted);
        line-height: 1.65;
      }

      .drawer-list {
        display: grid;
        gap: 14px;
      }

      .default-card {
        padding: 16px;
        border-radius: 18px;
        border: 1px solid rgba(24, 33, 47, 0.08);
        background: white;
      }

      .default-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .default-title {
        margin: 0 0 8px;
        font-size: 16px;
        line-height: 1.5;
      }

      .source-chip {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(15, 118, 110, 0.12);
        color: var(--accent);
        font-size: 12px;
      }

      .default-grid {
        display: grid;
        grid-template-columns: 110px 1fr;
        gap: 12px;
      }

      .default-field {
        display: grid;
        gap: 8px;
      }

      .default-field.full {
        grid-column: 1 / -1;
      }

      .default-field span {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .default-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-top: 14px;
      }

      .loading-mask {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(22, 32, 44, 0.32);
        opacity: 0;
        pointer-events: none;
        transition: opacity 140ms ease;
        z-index: 40;
      }

      .loading-mask.open {
        opacity: 1;
        pointer-events: auto;
      }

      .loading-card {
        display: grid;
        justify-items: center;
        gap: 14px;
        min-width: 240px;
        padding: 24px 28px;
        border-radius: 22px;
        border: 1px solid rgba(24, 33, 47, 0.08);
        background: rgba(255, 255, 255, 0.96);
        box-shadow: var(--shadow);
      }

      .spinner {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 3px solid rgba(15, 118, 110, 0.18);
        border-top-color: var(--accent);
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }

      a {
        color: var(--accent);
      }

      @media (max-width: 1080px) {
        .hero,
        .layout,
        .status-grid {
          grid-template-columns: 1fr;
        }

        .default-grid {
          grid-template-columns: 1fr;
        }

        .col-comments {
          width: 320px;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <article class="panel hero-card">
          <span class="eyebrow">Read First, Write Later</span>
          <h1>從你看過的 Easy Redmine issue 建立批次工時預覽</h1>
          <p class="summary">
            先切到任一天的 Issue Source，再勾選那天看過的 issue。Batch Worklog 仍然用單一日期批次預覽，
            每個 issue 可記住自己的預設時數、活動與備註；只有完成預覽後，送出按鈕才會啟用。
          </p>
          <div class="status-grid">
            <div class="status-item">
              <strong>Issue Count</strong>
              <span id="issue-count">-</span>
            </div>
            <div class="status-item">
              <strong>Selected</strong>
              <span id="selected-count">0 筆</span>
            </div>
          </div>
        </article>

        <aside class="panel hero-card">
          <div class="status-item">
            <strong>Redmine API</strong>
            <div id="api-status" class="muted">載入中</div>
          </div>
          <div class="status-item" style="margin-top: 12px;">
            <strong>工時活動</strong>
            <div id="activity-status" class="muted">載入中</div>
          </div>
          <div class="status-item" style="margin-top: 12px;">
            <strong>可讀來源</strong>
            <div id="source-list" class="muted">載入中</div>
          </div>
        </aside>
      </section>

      <section class="panel toolbar">
        <div class="date-nav">
          <button class="ghost-button nav-button" id="source-prev-button" aria-label="前一天">←</button>
          <label class="field-stack compact">
            <span>Issue Source 日期</span>
            <input id="source-date-input" type="date">
          </label>
          <button class="ghost-button nav-button" id="source-next-button" aria-label="後一天">→</button>
        </div>
        <div class="toolbar-actions">
          <button class="ghost-button" id="select-all-button">全選</button>
          <button class="ghost-button" id="clear-selection-button">清空勾選</button>
          <button class="action-button" id="refresh-button">重新整理</button>
        </div>
      </section>

      <section class="layout">
        <article class="panel list-panel">
          <div class="workbench-header">
            <div>
              <span class="section-title">Issue Source</span>
              <div class="muted" id="issue-summary">尚未載入</div>
            </div>
          </div>
          <ul class="issue-list" id="issue-list"></ul>
        </article>

        <aside class="panel details-panel">
          <div class="workbench-header">
            <div>
              <span class="section-title">Batch Worklog</span>
              <div class="muted" id="workbench-summary">先從上方勾選要補登工時的 issue。</div>
            </div>
            <div class="workbench-actions">
              <button class="ghost-button" id="defaults-button">Issue 預設</button>
              <button class="ghost-button" id="preview-button">預覽送出</button>
              <button class="danger-button" id="commit-button">送出到 Redmine</button>
            </div>
          </div>
          <div class="batch-meta">
            <label class="field-stack">
              <span>工時日期</span>
              <input id="batch-spent-on" type="date">
            </label>
            <div class="helper-copy" id="batch-date-helper">
              切換 Issue Source 日期時，這個全域工時日期會同步重設。只要日期或任一欄位有改動，都必須重新預覽。
            </div>
          </div>
          <div class="alert-stack" id="alert-stack"></div>
          <div class="table-wrap" id="table-wrap"></div>
          <div class="send-note">
            送出按鈕只有在你完成預覽、且至少一筆有效資料仍被勾選時才會啟用。
          </div>
        </aside>
      </section>
    </div>

    <div class="drawer-backdrop" id="drawer-backdrop"></div>
    <aside class="drawer" id="defaults-drawer" aria-hidden="true">
      <div class="drawer-header">
        <div>
          <span class="section-title">Issue Defaults</span>
          <h2 class="drawer-title">每筆 issue 的預設記憶</h2>
        </div>
        <button class="ghost-button" id="drawer-close-button">關閉</button>
      </div>
      <div class="drawer-summary" id="drawer-summary">
        這裡只管理目前 Issue Source 清單中的 issue。儲存後只會改 `issue_defaults.local.json`，不會直接改共享檔。
      </div>
      <div class="drawer-list" id="drawer-list"></div>
    </aside>

    <div class="loading-mask" id="loading-mask" aria-hidden="true">
      <div class="loading-card">
        <div class="spinner" aria-hidden="true"></div>
        <strong id="loading-message">載入中...</strong>
      </div>
    </div>

    <script type="module" src="/worklog-app.js"></script>
  </body>
</html>
"""
