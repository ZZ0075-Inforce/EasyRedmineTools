INDEX_HTML = """<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Worklog · Easy Redmine</title>
    <style>
      :root {
        --bg: #f8fafc;
        --panel: #ffffff;
        --panel-border: #e2e8f0;
        --ink: #0f172a;
        --muted: #64748b;
        --accent: #0f766e;
        --accent-soft: rgba(15, 118, 110, 0.08);
        --accent-hover: rgba(15, 118, 110, 0.13);
        --selected-bg: rgba(15, 118, 110, 0.06);
        --selected-border: rgba(15, 118, 110, 0.28);
        --danger: #dc2626;
        --danger-soft: rgba(220, 38, 38, 0.08);
        --warn-bg: rgba(217, 119, 6, 0.08);
        --warn-bg-strong: rgba(217, 119, 6, 0.14);
        --warn-border: rgba(217, 119, 6, 0.22);
        --warn-text: #b45309;
        --shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
        --shadow-md: 0 4px 12px rgba(0,0,0,.08);
        --input-bg: #ffffff;
        --hover-bg: rgba(0, 0, 0, 0.04);
        --card-bg: #ffffff;
        --subtle: rgba(0, 0, 0, 0.04);
      }

      [data-theme="dark"] {
        color-scheme: dark;
        --bg: #0f172a;
        --panel: #1e293b;
        --panel-border: #334155;
        --ink: #f1f5f9;
        --muted: #94a3b8;
        --accent: #2dd4bf;
        --accent-soft: rgba(45, 212, 191, 0.1);
        --accent-hover: rgba(45, 212, 191, 0.16);
        --selected-bg: rgba(45, 212, 191, 0.08);
        --selected-border: rgba(45, 212, 191, 0.32);
        --danger: #f87171;
        --danger-soft: rgba(248, 113, 113, 0.1);
        --warn-bg: rgba(251, 191, 36, 0.1);
        --warn-bg-strong: rgba(251, 191, 36, 0.18);
        --warn-border: rgba(251, 191, 36, 0.28);
        --warn-text: #fbbf24;
        --shadow: 0 1px 3px rgba(0,0,0,.3);
        --shadow-md: 0 4px 12px rgba(0,0,0,.45);
        --input-bg: #1e293b;
        --hover-bg: rgba(255, 255, 255, 0.05);
        --card-bg: #243044;
        --subtle: rgba(255, 255, 255, 0.05);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--ink);
        font-family: "Segoe UI Variable", "Noto Sans TC", "PingFang TC", sans-serif;
        font-size: 15px;
        line-height: 1.5;
      }

      button, input, select, textarea { font: inherit; }
      a { color: var(--accent); }

      .shell {
        max-width: 1380px;
        margin: 0 auto;
        padding: 20px 16px 44px;
      }

      /* ─── Panels ─────────────────────────────────────────── */
      .panel {
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        box-shadow: var(--shadow);
      }

      /* ─── Top tabs (mode switch: worklog / schedule) ─────── */
      .top-tabs {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px;
        margin-bottom: 12px;
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        box-shadow: var(--shadow);
      }
      .top-tab {
        border: 0;
        background: transparent;
        color: var(--muted);
        padding: 8px 18px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background 120ms, color 120ms;
      }
      .top-tab:hover { background: var(--hover-bg); color: var(--ink); }
      .top-tab.active { background: var(--accent); color: #fff; }
      .top-tabs-spacer { flex: 1; }

      /* ─── Main toolbar (source tabs only) ─────────────────── */
      .main-toolbar { margin-bottom: 12px; overflow: hidden; }
      .main-toolbar .source-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px 14px;
        align-items: center;
      }

      /* ─── List panel toolbar (search + actions for Issue List) */
      .list-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 0 0 12px;
        border-bottom: 1px solid var(--panel-border);
        margin-bottom: 12px;
      }

      .source-tab {
        border: 1px solid var(--panel-border);
        background: transparent;
        border-radius: 8px;
        padding: 8px 14px;
        cursor: pointer;
        font-size: 14px;
        color: var(--ink);
        white-space: nowrap;
        transition: background 120ms, border-color 120ms;
      }
      .source-tab:hover { background: var(--hover-bg); }
      .source-tab.active { background: var(--accent); color: white; border-color: var(--accent); }
      .source-tab .remove { margin-left: 6px; opacity: 0.7; cursor: pointer; }
      .source-spacer { flex: 1; }

      /* ─── Toolbar inner ─────────────────────────────────── */
      .filter-group {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 8px;
      }
      .toolbar-actions, .workbench-actions, .batch-meta-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      /* ─── Buttons ────────────────────────────────────────── */
      .nav-button, .action-button, .ghost-button, .danger-button {
        border: 0;
        border-radius: 8px;
        padding: 10px 16px;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        transition: background 120ms, opacity 120ms;
        white-space: nowrap;
      }

      .action-button { background: var(--accent); color: white; }
      .action-button:hover { opacity: 0.9; }
      .ghost-button {
        background: var(--subtle);
        color: var(--ink);
        border: 1px solid var(--panel-border);
      }
      .ghost-button:hover { background: var(--hover-bg); }
      .danger-button { background: var(--danger); color: white; }
      .danger-button:hover { opacity: 0.88; }
      button:disabled { opacity: 0.4; cursor: not-allowed; }

      .theme-toggle {
        border: 0;
        background: transparent;
        font-size: 18px;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
      }
      .theme-toggle:hover { background: var(--hover-bg); }

      .filter-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid var(--panel-border);
        background: var(--input-bg);
        color: var(--ink);
        cursor: pointer;
        font-size: 13px;
      }
      .filter-toggle .badge-dot {
        display: inline-block;
        width: 6px; height: 6px;
        border-radius: 50%;
        background: var(--accent);
      }

      .filter-advanced {
        display: none;
        gap: 10px;
        flex-wrap: wrap;
        padding: 12px 14px;
        border-radius: 10px;
        background: var(--subtle);
        border: 1px solid var(--panel-border);
        margin-bottom: 12px;
      }
      .filter-advanced.open { display: flex; }

      .quick-btn {
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid var(--panel-border);
        background: var(--input-bg);
        color: var(--muted);
        cursor: pointer;
        font-size: 13px;
        transition: background 120ms;
      }
      .quick-btn:hover { background: var(--accent-soft); color: var(--accent); }
      .quick-btn.active { background: var(--accent); color: white; border-color: var(--accent); }

      .tiny {
        padding: 4px 8px;
        font-size: 12px;
        border-radius: 6px;
        min-width: 28px;
      }

      /* ─── Layout ─────────────────────────────────────────── */
      .layout { display: grid; grid-template-columns: 1fr; gap: 12px; }
      .list-panel, .details-panel { padding: 16px; }

      /* ─── Issue list ─────────────────────────────────────── */
      .workbench-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
      }

      .section-title {
        display: block;
        margin-bottom: 6px;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .issue-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 8px;
        max-height: 620px;
        overflow-y: auto;
      }

      .issue-card {
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        background: var(--card-bg);
        padding: 10px 12px;
        box-shadow: var(--shadow);
        transition: border-color 120ms;
      }
      .issue-card.selected {
        background: var(--selected-bg);
        border-color: var(--selected-border);
      }

      .issue-select {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 10px;
        align-items: start;
        cursor: pointer;
      }
      .issue-checkbox {
        width: 18px; height: 18px;
        margin-top: 2px;
        cursor: pointer;
        accent-color: var(--accent);
      }

      .issue-heading-line {
        display: flex;
        align-items: baseline;
        gap: 6px;
        flex-wrap: wrap;
      }
      .issue-id { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
      .issue-date { color: var(--muted); font-size: 12px; margin-left: auto; }
      .issue-title { font-size: 14px; line-height: 1.4; flex: 1 1 auto; }

      .tag-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
      .tag {
        display: inline-flex;
        padding: 2px 8px;
        border-radius: 6px;
        background: var(--subtle);
        color: var(--muted);
        font-size: 11px;
      }
      .count-badge {
        display: inline-flex;
        padding: 1px 8px;
        border-radius: 6px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        margin-left: 6px;
      }

      /* ─── Project groups ──────────────────────────────────── */
      .project-group { list-style: none; }
      .project-header {
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
      }
      .project-header:hover { background: var(--accent-hover); border-color: var(--selected-border); }
      .group-arrow { color: var(--accent); font-size: 12px; width: 12px; }
      .group-name { flex: 1 1 auto; font-size: 14px; }
      .group-count { padding: 1px 8px; border-radius: 6px; background: var(--subtle); color: var(--muted); font-size: 12px; }
      .group-selected { font-size: 12px; color: var(--accent); }
      .group-issues { list-style: none; padding: 0 0 0 12px; margin: 0 0 8px; display: grid; gap: 6px; }

      /* ─── Schedule ────────────────────────────────────────── */
      .sched-project {
        list-style: none;
        padding: 10px 12px;
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        background: var(--card-bg);
        margin-bottom: 8px;
        box-shadow: var(--shadow);
      }
      .sched-project-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .sched-issue { padding: 6px 0; border-top: 1px dashed var(--panel-border); }
      .sched-issue-line { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }
      .sched-issue-budget { display: flex; align-items: center; gap: 8px; font-size: 12px; }
      .sched-budget-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
      .sched-budget { width: 70px; padding: 4px 8px; }

      .gantt-days { display: grid; gap: 8px; }
      .gantt-day {
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        padding: 10px 12px;
        background: var(--card-bg);
        box-shadow: var(--shadow);
      }
      .gantt-day.full { border-color: var(--selected-border); background: var(--selected-bg); }
      .gantt-day.empty { opacity: 0.65; }
      .gantt-day.partial { border-color: var(--warn-border); }
      .gantt-day-head { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
      .gantt-items { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
      .gantt-items li { display: flex; align-items: center; gap: 8px; font-size: 13px; }
      .gantt-hours {
        display: inline-flex;
        padding: 2px 8px;
        border-radius: 6px;
        background: var(--accent-soft);
        color: var(--accent);
        font-weight: 600;
        min-width: 44px;
        justify-content: center;
        font-size: 12px;
      }
      .gantt-issue { flex: 1 1 auto; }

      .sched-select-card {
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
      }
      .sched-select-card:hover { background: var(--hover-bg); }
      .sched-select-card.selected { border-color: var(--accent); background: var(--selected-bg); }
      .sched-select-card input[type="checkbox"] { width: auto; transform: scale(1.2); cursor: pointer; accent-color: var(--accent); }
      .sched-select-main { flex: 1 1 auto; }
      .sched-select-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
      .sched-select-meta { font-size: 12px; color: var(--muted); }

      .sched-footer-bar {
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
      }
      .sched-breadcrumb { margin-bottom: 10px; }

      .sched-project.drag-over,
      .sched-issue.drag-over { outline: 2px dashed var(--accent); outline-offset: 2px; }
      .sched-project[draggable="true"],
      .sched-issue[draggable="true"] { cursor: grab; }
      .sched-project[draggable="true"]:active,
      .sched-issue[draggable="true"]:active { cursor: grabbing; }

      .budget-badge {
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
      }
      .budget-badge.override { background: var(--warn-bg); color: var(--warn-text); }
      .budget-badge .clear-override { font-size: 11px; opacity: 0.7; }
      .budget-input { width: 80px !important; padding: 4px 8px !important; font-size: 13px; }

      /* ─── Batch worklog ───────────────────────────────────── */
      .batch-meta {
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
      }
      .date-quick-buttons { display: flex; gap: 6px; align-self: end; }
      .field-stack { display: grid; gap: 6px; min-width: 200px; }
      .field-stack.compact { min-width: 160px; }
      .field-stack span {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .daily-total-badge {
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        border-radius: 8px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 13px;
        font-weight: 600;
        border: 1px solid var(--selected-border);
      }
      .daily-total-badge.overflow {
        background: var(--warn-bg-strong);
        color: var(--warn-text);
        border-color: var(--warn-border);
      }

      .alert-stack { display: grid; gap: 8px; margin-bottom: 12px; }
      .alert {
        padding: 12px 14px;
        border-radius: 10px;
        border: 1px solid var(--panel-border);
        background: var(--card-bg);
        line-height: 1.6;
        font-size: 14px;
      }
      .alert.warn { background: var(--warn-bg); border-color: var(--warn-border); }

      /* ─── Worklog table ───────────────────────────────────── */
      .table-wrap {
        overflow-x: auto;
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        background: var(--card-bg);
      }
      table { width: 100%; border-collapse: collapse; min-width: 680px; }
      .col-send { width: 64px; }
      .col-hours { width: 100px; }
      .col-activity { width: 180px; }
      .col-comments { width: 300px; }
      .col-check { width: 180px; }

      th, td { padding: 10px 12px; border-bottom: 1px solid var(--panel-border); vertical-align: top; }
      th {
        text-align: left;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        background: var(--subtle);
      }

      /* Issue 標題行（佔滿整列） */
      .entry-issue-row td {
        padding: 10px 14px 6px;
        background: var(--subtle);
        border-bottom: 0;
        font-size: 14px;
        line-height: 1.4;
      }
      .entry-issue-id { color: var(--muted); font-size: 12px; margin-right: 6px; font-variant-numeric: tabular-nums; }
      .entry-issue-label { font-weight: 500; word-break: break-word; }
      .entry-issue-link { color: var(--accent); font-size: 13px; margin-left: 8px; text-decoration: none; opacity: 0.8; }
      .entry-issue-link:hover { opacity: 1; }

      /* 欄位行 */
      .entry-fields-row td { padding: 8px 12px 10px; border-bottom: 0; }

      /* Entry 群組分隔線 */
      tbody + tbody .entry-issue-row td { border-top: 1px solid var(--panel-border); }

      /* 焦點高亮（移至 tbody 層） */
      tbody.row-focused .entry-issue-row td { background: var(--selected-bg); }
      tbody.row-focused .entry-fields-row td { background: var(--accent-soft); }

      input[type="date"], input[type="number"], input[type="text"], select, textarea {
        width: 100%;
        padding: 9px 11px;
        border-radius: 8px;
        border: 1px solid var(--panel-border);
        background: var(--input-bg);
        color: var(--ink);
        transition: border-color 120ms;
      }
      input:focus, select:focus, textarea:focus {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
        border-color: var(--accent);
      }
      textarea { min-height: 80px; resize: vertical; }
      .hours-input { max-width: 96px; }

      .row-errors { margin: 0; padding-left: 16px; color: var(--danger); font-size: 13px; line-height: 1.5; }
      .duplicate-chip {
        display: inline-flex;
        margin-bottom: 6px;
        padding: 4px 10px;
        border-radius: 6px;
        background: var(--warn-bg);
        color: var(--warn-text);
        font-size: 12px;
        border: 1px solid var(--warn-border);
      }
      .duplicate-list, .result-list { margin: 0; padding-left: 16px; color: var(--muted); line-height: 1.55; }

      /* Mobile label spans — visible only on mobile */
      .mobile-label { display: none; }

      .draft-remove {
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        font-size: 16px;
        padding: 4px 6px;
        border-radius: 6px;
        line-height: 1;
      }
      .draft-remove:hover { background: var(--danger-soft); color: var(--danger); }

      /* ─── Sticky actions ──────────────────────────────────── */
      .sticky-actions {
        position: sticky;
        bottom: 0;
        padding: 10px 12px;
        margin: 12px -16px -16px;
        background: var(--panel);
        border-top: 1px solid var(--panel-border);
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        flex-wrap: wrap;
        border-radius: 0 0 12px 12px;
        box-shadow: 0 -4px 12px rgba(0,0,0,.06);
      }
      .send-note { margin-top: 10px; color: var(--muted); font-size: 13px; }

      /* ─── Misc helpers ────────────────────────────────────── */
      .empty-state {
        padding: 20px;
        border-radius: 10px;
        background: var(--hover-bg);
        color: var(--muted);
        line-height: 1.7;
        font-size: 14px;
      }
      .muted { color: var(--muted); }
      .helper-copy { color: var(--muted); line-height: 1.6; }
      .project-picker-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: end; }
      .phrase-field-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; }
      .phrase-preset-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      .preset-chip {
        display: inline-flex;
        padding: 3px 8px;
        border-radius: 6px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
      }
      .insert-btn {
        display: inline-flex;
        padding: 5px 10px;
        border-radius: 6px;
        border: 0;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        cursor: pointer;
      }
      .comment-cell { position: relative; }
      .phrase-chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
      .phrase-chip {
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
      }

      /* ─── Drawers ─────────────────────────────────────────── */
      .drawer-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.38);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
        z-index: 5;
      }
      .drawer-backdrop.open { opacity: 1; pointer-events: auto; }

      .drawer {
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
      }
      .drawer.open { transform: translateX(0); }

      .drawer-header { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
      .drawer-title { margin: 0; font-size: 20px; }
      .drawer-summary { margin-bottom: 14px; color: var(--muted); line-height: 1.65; font-size: 14px; }
      .drawer-list { display: grid; gap: 10px; }

      .item-card {
        padding: 12px;
        border-radius: 10px;
        border: 1px solid var(--panel-border);
        background: var(--card-bg);
        display: grid;
        gap: 8px;
      }
      .item-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
      .item-title { margin: 0; font-size: 14px; }
      .phrase-text {
        margin: 0;
        white-space: pre-wrap;
        color: var(--ink);
        background: var(--hover-bg);
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        line-height: 1.5;
        font-size: 14px;
      }
      .phrase-text:hover { background: var(--accent-soft); }
      .phrase-actions { display: flex; gap: 6px; flex-wrap: wrap; }

      .add-form {
        display: grid;
        gap: 10px;
        padding: 12px;
        border-radius: 10px;
        background: var(--accent-soft);
        border: 1px solid var(--selected-border);
        margin-bottom: 12px;
      }

      /* ─── Loading ─────────────────────────────────────────── */
      .loading-mask {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(15, 23, 42, 0.35);
        opacity: 0;
        pointer-events: none;
        transition: opacity 140ms ease;
        z-index: 40;
      }
      .loading-mask.open { opacity: 1; pointer-events: auto; }
      .loading-card {
        display: grid;
        justify-items: center;
        gap: 12px;
        min-width: 220px;
        padding: 22px 28px;
        border-radius: 14px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        box-shadow: var(--shadow-md);
      }
      .spinner {
        width: 32px; height: 32px;
        border-radius: 50%;
        border: 3px solid var(--accent-soft);
        border-top-color: var(--accent);
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

      /* ─── Commit Confirmation Modal ───────────────────────── */
      .modal-overlay {
        position: fixed; inset: 0; z-index: 50;
        background: rgba(15,23,42,.5);
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
      }
      .modal-overlay[hidden] { display: none; }
      .modal-box {
        background: var(--panel); border: 1px solid var(--panel-border);
        border-radius: 14px; width: 100%; max-width: 400px;
        box-shadow: 0 12px 40px rgba(0,0,0,.22);
      }
      .modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px 12px; border-bottom: 1px solid var(--panel-border);
      }
      .modal-header h3 { margin: 0; font-size: 15px; font-weight: 600; }
      .modal-x {
        background: none; border: none; cursor: pointer;
        font-size: 18px; color: var(--muted); line-height: 1;
        padding: 2px 7px; border-radius: 4px;
      }
      .modal-x:hover { background: var(--subtle); }
      .modal-body { padding: 16px 20px; }
      .modal-date-row {
        display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
      }
      .modal-date-label { font-size: 13px; font-weight: 500; white-space: nowrap; }
      .modal-date-row input[type="date"] { flex: 1; }
      .modal-quick-dates { display: flex; gap: 6px; margin-bottom: 14px; }
      .modal-quick-dates button {
        flex: 1; padding: 5px 0; font-size: 12px;
        border: 1px solid var(--panel-border); border-radius: 6px;
        background: var(--subtle); color: var(--text); cursor: pointer;
      }
      .modal-quick-dates button:hover {
        background: var(--accent); color: #fff; border-color: var(--accent);
      }
      .modal-date-warn {
        background: #fef3c7; border: 1px solid #f59e0b;
        border-radius: 6px; padding: 8px 10px;
        font-size: 12px; color: #92400e; margin-bottom: 12px;
      }
      [data-theme="dark"] .modal-date-warn {
        background: #451a03; border-color: #d97706; color: #fde68a;
      }
      .modal-summary { font-size: 13px; color: var(--muted); margin: 0; }
      .modal-footer {
        display: flex; justify-content: flex-end; gap: 8px;
        padding: 12px 20px 16px; border-top: 1px solid var(--panel-border);
      }

      /* Settings modal (wider + scrollable body) */
      .settings-modal-box {
        max-width: 560px;
        max-height: 88vh;
        display: flex;
        flex-direction: column;
      }
      .settings-modal-body {
        overflow-y: auto;
        padding: 16px 20px 24px;
      }
      .settings-tabs {
        display: flex;
        gap: 2px;
        padding: 4px 12px 0;
        border-bottom: 1px solid var(--panel-border);
        overflow-x: auto;
        flex-shrink: 0;
      }
      .settings-tabs::-webkit-scrollbar { display: none; }
      .settings-tab {
        border: 0;
        background: transparent;
        padding: 10px 14px;
        font-size: 13px;
        cursor: pointer;
        color: var(--muted);
        border-bottom: 2px solid transparent;
        white-space: nowrap;
        margin-bottom: -1px;
        transition: color 120ms, border-color 120ms;
      }
      .settings-tab:hover { color: var(--ink); }
      .settings-tab.active {
        color: var(--accent);
        border-bottom-color: var(--accent);
        font-weight: 500;
      }
      .settings-modal-body > [data-settings-section] { display: none; }
      .settings-modal-body > [data-settings-section].active { display: block; }
      .settings-group { margin-bottom: 0; }
      .settings-group-hint {
        font-size: 12px; color: var(--muted);
        margin-bottom: 10px; line-height: 1.6;
      }
      .settings-group-hint code {
        background: var(--subtle); padding: 1px 5px;
        border-radius: 4px; font-size: 11px;
      }
      .about-row {
        display: flex; justify-content: space-between;
        padding: 6px 0; font-size: 13px;
        border-bottom: 1px solid var(--panel-border);
      }
      .about-row:last-child { border-bottom: 0; }

      @media (max-width: 767px) {
        .settings-modal-box { max-height: calc(100vh - 32px); }
      }

      /* Per-entry phrase selector (inside entry-issue-row) */
      .entry-title-row {
        display: flex; align-items: center;
        gap: 10px; justify-content: space-between;
      }
      .entry-title-text { flex: 1; min-width: 0; }
      .entry-phrase-select {
        flex-shrink: 0;
        max-width: 180px;
        font-size: 12px;
        padding: 4px 6px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel);
        color: var(--text);
        cursor: pointer;
      }
      @media (max-width: 767px) {
        .entry-phrase-select { max-width: 140px; }
      }

      /* ─── Bottom Tab Bar (mobile only) ───────────────────── */
      .bottom-tab-bar {
        display: none;
        position: fixed;
        bottom: 0; left: 0; right: 0;
        background: var(--panel);
        border-top: 1px solid var(--panel-border);
        box-shadow: 0 -2px 8px rgba(0,0,0,.08);
        z-index: 20;
        padding-bottom: env(safe-area-inset-bottom, 0);
      }
      .bottom-tab-bar-inner { display: flex; height: 56px; }
      .tab-btn {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        border: 0;
        background: transparent;
        color: var(--muted);
        font-size: 10px;
        cursor: pointer;
        padding: 0;
        position: relative;
        transition: color 120ms;
        min-height: 44px;
      }
      .tab-btn.active { color: var(--accent); }
      .tab-btn .tab-icon { font-size: 20px; line-height: 1; }
      .tab-badge {
        position: absolute;
        top: 6px;
        right: calc(50% - 22px);
        min-width: 18px; height: 18px;
        border-radius: 9px;
        background: var(--accent);
        color: white;
        font-size: 11px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
      }

      /* ─── Settings page legacy (kept for class reuse) ───── */
      .settings-section {
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 12px;
        background: var(--panel);
        box-shadow: var(--shadow);
      }
      .settings-nav-item {
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
      }
      .settings-nav-item:last-child { border-bottom: 0; }
      .settings-nav-item:hover { background: var(--hover-bg); }
      .settings-nav-label { flex: 1; }
      .settings-nav-meta { color: var(--muted); font-size: 13px; }
      .settings-nav-arrow { color: var(--muted); font-size: 16px; }
      .settings-theme-row {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        gap: 10px;
        font-size: 15px;
      }
      .settings-theme-label { flex: 1; }
      .theme-option-group { display: flex; gap: 6px; }
      .theme-option {
        padding: 7px 14px;
        border-radius: 8px;
        border: 1px solid var(--panel-border);
        background: transparent;
        color: var(--muted);
        font-size: 14px;
        cursor: pointer;
        transition: all 120ms;
      }
      .theme-option.active { background: var(--accent); color: white; border-color: var(--accent); }

      /* ─── Mobile overrides (<768px) ──────────────────────── */
      @media (max-width: 767px) {
        .shell { padding: 12px 12px 72px; }
        .bottom-tab-bar { display: block; }

        /* Panel switching via data-mobile-tab on <body> */
        [data-mobile-tab="issues"] .details-panel { display: none; }

        [data-mobile-tab="drafts"] .main-toolbar { display: none; }
        [data-mobile-tab="drafts"] .top-tabs { display: none; }
        [data-mobile-tab="drafts"] .list-panel { display: none; }

        [data-mobile-tab="schedule"] .main-toolbar { display: none; }

        /* Issue list: no fixed height on mobile */
        .issue-list { max-height: none; }
        .source-tabs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
        .source-tabs::-webkit-scrollbar { display: none; }
        .source-tabs .source-spacer { display: none; }

        /* Sticky actions: fixed above tab bar */
        .sticky-actions {
          position: fixed;
          bottom: 56px;
          left: 0; right: 0;
          margin: 0;
          border-radius: 0;
          z-index: 15;
          padding: 8px 12px;
          justify-content: stretch;
        }
        .sticky-actions .ghost-button,
        .sticky-actions .danger-button,
        .sticky-actions .action-button { flex: 1; justify-content: center; }
        #sticky-summary { display: none; }

        /* Table → card view on mobile */
        .table-wrap {
          overflow-x: visible;
          border: 0;
          border-radius: 0;
          background: transparent;
        }
        table, thead, tr, td, th { display: block; }
        thead tr { display: none; }

        /* Each entry tbody = card */
        tbody[data-entry-row] {
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          margin-bottom: 10px;
          background: var(--panel);
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        tbody.row-focused { border-color: var(--accent) !important; }
        tbody.row-focused .entry-issue-row td { background: var(--selected-bg); }
        tbody.row-focused .entry-fields-row td { background: var(--selected-bg); }

        /* Issue 標題行：全寬，維持 block */
        .entry-issue-row td {
          padding: 12px 12px 8px;
          background: var(--subtle);
          border-bottom: 1px solid var(--panel-border) !important;
        }
        /* Desktop .entry-issue-row override reset */
        tbody + tbody .entry-issue-row td { border-top: 0; }

        /* 欄位行：grid 排列 */
        .entry-fields-row {
          display: grid !important;
          grid-template-areas:
            "hours activity"
            "comments comments"
            "check check"
            "send send";
          grid-template-columns: 1fr 1fr;
        }
        .entry-fields-row td:nth-child(1) {
          grid-area: send;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-top: 1px solid var(--panel-border);
        }
        .entry-fields-row td:nth-child(2) { grid-area: hours; padding: 8px 6px 6px 12px; }
        .entry-fields-row td:nth-child(3) { grid-area: activity; padding: 8px 12px 6px 6px; }
        .entry-fields-row td:nth-child(4) { grid-area: comments; padding: 4px 12px 8px; }
        .entry-fields-row td:nth-child(5) {
          grid-area: check;
          padding: 6px 12px 8px;
          border-top: 1px dashed var(--panel-border);
        }
        td { border-bottom: 0; }

        .mobile-label {
          display: block;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .hours-input { max-width: none; }
        .col-send, .col-hours, .col-activity, .col-comments, .col-check { width: auto; }

        /* Batch meta stacked on mobile */
        .batch-meta { flex-direction: column; align-items: stretch; }
        .date-quick-buttons { width: 100%; }
        .date-quick-buttons .quick-btn { flex: 1; text-align: center; }
        .details-panel { padding-bottom: 80px; }

        /* Touch-friendly sizing */
        .action-button, .ghost-button, .danger-button { min-height: 44px; }
        .quick-btn { min-height: 40px; }
        input[type="date"], input[type="number"], input[type="text"], select { min-height: 44px; }
      }

      /* ─── Desktop (≥768px) ────────────────────────────────── */
      @media (min-width: 768px) {
        .layout { grid-template-columns: 1fr 1.4fr; gap: 16px; }
        .bottom-tab-bar { display: none !important; }
      }
    </style>
  </head>
  <body data-mobile-tab="issues">
    <div class="shell">
      <section class="top-tabs" id="top-tabs">
        <button class="top-tab active" data-top-tab="worklog">填寫工時</button>
        <button class="top-tab" data-top-tab="schedule">兩週排程</button>
        <span class="top-tabs-spacer"></span>
        <button class="theme-toggle" id="settings-button" title="設定" aria-label="設定">⚙️</button>
      </section>

      <section class="panel main-toolbar" id="main-toolbar">
        <div class="source-tabs" id="source-tabs"></div>
      </section>

      <section class="layout">
        <article class="panel list-panel">
          <div class="workbench-header">
            <div>
              <span class="section-title">
                Issue List <span class="count-badge" id="issue-count">-</span>
              </span>
              <div class="muted" id="issue-summary">尚未載入</div>
            </div>
            <div class="muted">已選 <span id="selected-count">0 筆</span></div>
          </div>
          <div class="list-toolbar">
            <div class="filter-group">
              <label class="field-stack compact">
                <span>搜尋標題</span>
                <input id="filter-search" type="text" placeholder="關鍵字">
              </label>
              <button class="filter-toggle" id="filter-toggle-button" aria-expanded="false">
                篩選 <span class="badge-dot" id="filter-dot" style="display:none;"></span>
              </button>
            </div>
            <div class="toolbar-actions">
              <button class="ghost-button" id="select-all-button">全選</button>
              <button class="ghost-button" id="clear-selection-button">清空勾選</button>
              <button class="action-button" id="refresh-button">重新整理</button>
            </div>
          </div>
          <section class="filter-advanced" id="filter-advanced">
            <label class="field-stack compact">
              <span>更新日期</span>
              <input id="filter-date" type="date">
            </label>
            <button class="ghost-button" id="filter-clear-date">清除日期</button>
          </section>
          <ul class="issue-list" id="issue-list"></ul>
        </article>

        <aside class="panel details-panel">
          <div class="workbench-header">
            <div>
              <span class="section-title">工時填寫</span>
              <div class="muted" id="workbench-summary">先從左側勾選要補登工時的 issue。</div>
            </div>
          </div>
          <div class="batch-meta">
            <label class="field-stack">
              <span>工時日期</span>
              <input id="batch-spent-on" type="date">
            </label>
            <div class="date-quick-buttons">
              <button class="quick-btn" data-spent-on-offset="1">昨天</button>
              <button class="quick-btn" data-spent-on-offset="2">前天</button>
              <button class="quick-btn" data-spent-on-offset="3">三天前</button>
            </div>
            <div class="daily-total-badge" id="daily-total-badge" title="已勾選送出的時數加總">0 / 6.5 h</div>
          </div>
          <div class="alert-stack" id="alert-stack"></div>
          <div class="table-wrap" id="table-wrap"></div>
          <div class="sticky-actions" id="sticky-actions">
            <span class="muted" id="sticky-summary">至少填入一筆工時後即可送出。</span>
            <button class="danger-button" id="commit-button">送出工時</button>
          </div>
          <div class="sticky-actions" id="sticky-actions-schedule" style="display:none;">
            <span class="muted">送出會用目前的甘特分配，更新每筆 issue 的起迄日期</span>
            <button class="action-button" id="schedule-apply-button">送出更新起迄日 →</button>
          </div>
        </aside>
      </section>
    </div>

    <!-- Settings Modal -->
    <div id="settings-modal" class="modal-overlay" hidden aria-hidden="true">
      <div class="modal-box settings-modal-box" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div class="modal-header">
          <h3 id="settings-modal-title">設定</h3>
          <button class="modal-x" id="settings-modal-close" aria-label="關閉">&times;</button>
        </div>
        <div class="settings-tabs" role="tablist">
          <button class="settings-tab active" data-settings-tab="appearance" role="tab">外觀</button>
          <button class="settings-tab" data-settings-tab="phrases" role="tab">常用語句</button>
          <button class="settings-tab" data-settings-tab="sources" role="tab">PJ 篩選器</button>
          <button class="settings-tab" data-settings-tab="about" role="tab">關於</button>
        </div>
        <div class="modal-body settings-modal-body">

          <section class="settings-group active" data-settings-section="appearance">
            <div class="theme-option-group">
              <button class="theme-option" data-theme-value="light">淺色</button>
              <button class="theme-option" data-theme-value="dark">深色</button>
            </div>
          </section>

          <section class="settings-group" data-settings-section="phrases">
            <div class="settings-group-hint">
              每筆工時卡片右上角可直接套用。內容存在 <code>phrases.local.json</code>。
            </div>
            <div class="add-form">
              <label class="field-stack">
                <span>標籤 (選填)</span>
                <input type="text" id="phrase-label-input" placeholder="例：日常維運">
              </label>
              <div class="phrase-field-grid">
                <label class="field-stack compact">
                  <span>預設時數 (選填)</span>
                  <input type="number" step="0.1" min="0.1" id="phrase-hours-input">
                </label>
                <label class="field-stack compact">
                  <span>預設活動 (選填)</span>
                  <span id="phrase-activity-wrap"></span>
                </label>
              </div>
              <label class="field-stack">
                <span>預設備註 (選填)</span>
                <textarea id="phrase-comments-input"></textarea>
              </label>
              <div>
                <button class="action-button" id="phrase-add-button">儲存語句</button>
                <button class="ghost-button" id="phrase-cancel-button" style="display:none;">取消編輯</button>
              </div>
            </div>
            <div class="drawer-list" id="phrases-list"></div>
          </section>

          <section class="settings-group" data-settings-section="sources">
            <div class="settings-group-hint">
              把 Redmine 自訂查詢加入作為分頁。從網址抓 <code>query_id</code> 與顯示名稱貼進來即可。
            </div>
            <div class="add-form">
              <label class="field-stack">
                <span>顯示名稱</span>
                <input type="text" id="query-name-input" placeholder="例：我的任務分組">
              </label>
              <label class="field-stack">
                <span>Query ID</span>
                <input type="number" min="1" id="query-id-input" placeholder="例：762">
              </label>
              <div>
                <button class="action-button" id="query-add-button">新增 PJ 篩選器</button>
              </div>
            </div>
            <div class="drawer-list" id="saved-queries-list"></div>
          </section>

          <section class="settings-group" data-settings-section="about">
            <div class="about-row"><span class="muted">版本</span><span id="app-version">-</span></div>
            <div class="about-row"><span class="muted">更新</span><span id="app-build-time">-</span></div>
          </section>

        </div>
      </div>
    </div>

    <div class="loading-mask" id="loading-mask" aria-hidden="true">
      <div class="loading-card">
        <div class="spinner" aria-hidden="true"></div>
        <strong id="loading-message">載入中...</strong>
      </div>
    </div>

    <nav class="bottom-tab-bar" id="mobile-nav" aria-label="主導覽">
      <div class="bottom-tab-bar-inner">
        <button class="tab-btn active" data-tab="issues" aria-label="Issue 清單">
          <span class="tab-icon" aria-hidden="true">📋</span>
          <span>Issue</span>
        </button>
        <button class="tab-btn" data-tab="drafts" aria-label="工時草稿">
          <span class="tab-icon" aria-hidden="true">✏️</span>
          <span>待送出</span>
          <span class="tab-badge" id="draft-badge" style="display:none;" aria-live="polite">0</span>
        </button>
        <button class="tab-btn" data-tab="schedule" aria-label="排程分配">
          <span class="tab-icon" aria-hidden="true">📅</span>
          <span>排程</span>
        </button>
        <button class="tab-btn" data-tab="settings" aria-label="設定">
          <span class="tab-icon" aria-hidden="true">⚙️</span>
          <span>設定</span>
        </button>
      </div>
    </nav>

    <!-- Commit Confirmation Modal -->
    <div id="commit-modal" class="modal-overlay" hidden aria-hidden="true">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="commit-modal-title">
        <div class="modal-header">
          <h3 id="commit-modal-title">確認送出工時</h3>
          <button class="modal-x" id="commit-modal-close" aria-label="關閉">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-date-row">
            <label class="modal-date-label" for="commit-modal-date">工時日期</label>
            <input type="date" id="commit-modal-date" class="input">
          </div>
          <div class="modal-quick-dates">
            <button data-modal-offset="0">今天</button>
            <button data-modal-offset="1">昨天</button>
            <button data-modal-offset="2">前天</button>
          </div>
          <div id="commit-modal-date-warn" class="modal-date-warn" hidden></div>
          <p id="commit-modal-summary" class="modal-summary"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="commit-modal-cancel">取消</button>
          <button class="btn btn-primary" id="commit-modal-confirm">確認送出</button>
        </div>
      </div>
    </div>

    <script type="module" src="/worklog-app.js"></script>
  </body>
</html>
"""
