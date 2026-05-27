# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LawPJ Worklog Helper — 針對 Easy Redmine (ER 2019 / Redmine 4.0.3) 的工時批次補登工具。**Tampermonkey userscript 版**，掛在瀏覽器上直接用，不需本機 server。

當前架構：
```
Browser (logged into lawpj.lawbroker.com.tw)
  ↓ Tampermonkey @match 注入 dist/worklog.user.js
  ↓ 啟動時把「⏱ 工時助手」li 注入 #top-menu-container（在「問題清單」後）
  ↓ 點主連結或下拉子項（填寫工時/兩週排程/工時模板/PJ 篩選器）開 overlay
  ↓ overlay：左側 Notion-style sidebar + 右側 main view
  ↓ overlay 內 fetch 直接打 Redmine REST API（同源 session 或 API Key）
Easy Redmine
```

## Commands

### Build userscript

```bash
python build-userscript.py
```

產出 `dist/worklog.user.js`。每次 build 會自動把 `@version` 刻成 `1.0.{YYYYMMDDhhmm}` 形式，確保 Tampermonkey 偵測到升版。

### Verify after build

```bash
node -e "new Function(require('fs').readFileSync('dist/worklog.user.js','utf8')); console.log('[OK]')"
```

## Architecture

### 檔案責任

| File | Role |
|------|------|
| `src-userscript/header.meta.js` | UserScript metadata (@name, @match, @grant, @updateURL) |
| `src-userscript/runtime.js` | 認證 (session/CSRF + API Key dual-mode)、redmineFetch、Store、訪問記錄、`fetchJsonAdapter` (spread merge 4 個 domain handler module) |
| `src-userscript/time-entry-preview-session.js` | 兩階段預覽/提交模組：token + SHA-256 簽章 + 30 分鐘 TTL（`create` / `validate` / `consume`）|
| `src-userscript/time-entry-handlers.js` | `GET /api/time-entry-activities`、`POST /api/time-entries/preview`、`POST /api/time-entries/commit`；內含 `validateEntry` + `__activitiesCache` |
| `src-userscript/issue-handlers.js` | `GET /api/issues`、`POST /api/issues/batch-create`、`POST /api/schedule/apply-dates` |
| `src-userscript/catalog-handlers.js` | `GET /api/projects`、`GET /api/trackers` |
| `src-userscript/storage-handlers.js` | 14 個 GM Store CRUD：phrases / saved-queries / issue-templates / issue-template-defaults |
| `src-userscript/menu-injector.js` | 把「⏱ 工時助手」li 注入 Redmine #top-menu-container；定義 `SIDE_VIEWS`（含 `inSettings` 欄位）作為 sidebar / menu / 設定 modal 三處共用 |
| `src-userscript/overlay.js` | overlay 掛載（fixed inset 32px）+ backdrop + ESC 關閉 + sidebar 動態 render |
| `src-userscript/settings-patch.js` | 設定 modal 注入「連線」tab（API Key 輸入 / 連線測試）+ sidebar 收合切換；`VIEW_TABS = SIDE_VIEWS.filter(v => v.inSettings)` |
| `src-userscript/inline-injector.js` | 在 Easy Redmine `/issues/{id}` 頁注入 Worktime mini modal（快速填工時 + phrase 套用）；活動 / phrases 都透過 `fetchJsonAdapter` 走 handler map 取資料 |
| `src-userscript/ui-template.html` | HTML/CSS template，build 工具直接從中抽 body HTML + CSS |
| `worklog_app.js` | 前端核心邏輯（state、render、event handler、`PhraseMenu` / `Renders` / `ScheduleEditor` 三個 IIFE 模組）；build 時包進 `__initWorklogApp()` 並用 sentinel 註解將 `fetchJson` body 替換成 `window.__worklog_fetchJson` 轉接 |
| `build-userscript.py` | 把上面所有部件組合輸出 `dist/worklog.user.js`；負責 CSS scoping、版號注入、HTML 抽取、JS 改寫 |
| `dist/worklog.user.js` | 最終產物，commit 進 repo 供 GitHub raw URL 給 Tampermonkey |

### Build pipeline

1. 讀 `header.meta.js` → 用 regex 換 `@version` 為 `1.0.{timestamp}`
2. 讀 `src-userscript/ui-template.html`：先把 `<style>` 整段抽走（避免 CSS 註解內含 `<body>` 字串干擾正則），再抽 body HTML
3. **`prefix_classes`：自家 class 加 `pj-` 前綴**（避開 Easy Redmine 全域 CSS 撞名；只處理含連字號的 class，utility 單字 class 跳過避免跟 JS object key 撞）。對 CSS / HTML / worklog_app.js / overlay.js / settings-patch.js / menu-injector.js / runtime.js 全部做 token-boundary 替換（`(?<![\w-])`/`(?![\w-])` 把連字號也算 token 邊界，避免破壞 `data-issue-id` 之類 dataset 屬性）
4. CSS 加 `#__worklog_root` scope 前綴（自寫 tokenizer 處理 @media 巢狀、:root/body/html 特殊轉換）
5. 移除 Google Fonts `<link>`（規避 CSP）
6. `worklog_app.js` 包進 `function __initWorklogApp()`：
   - `fetchJson` 函式體（brace-balancing 找完整函式邊界）換成 `return window.__worklog_fetchJson(url, options)`
   - `document.documentElement.setAttribute("data-theme"...)` 改為對 `#__worklog_root` 操作
   - `APP_VERSION` / `APP_BUILD_TIME` 用 regex 替換為 build 時間戳（讓設定→關於跟 @version metadata 同步）
7. 串接成 IIFE：metadata → APP_HTML/APP_CSS template literals → runtime → settings-patch → overlay → menu-injector → wrapped app-core → bootstrap（boot() 呼叫 `injectTopMenu()` + `VisitedIssuesRegistry.recordVisit()` + 一次性 `Store.del("launcher_pos")` 清舊殘留）

### 認證設計

- **預設 (session)**：CSRF token 從 `<meta name="csrf-token">` 抓，加 `X-CSRF-Token` header；fetch 帶 `credentials: include` 自動帶 cookie
- **備援 (API Key)**：使用者在設定 → 連線 tab 貼入；存 `GM_setValue("api_key")`；改用 `X-Redmine-API-Key` header（跳過 CSRF）

### Redmine API quirk

Easy Redmine `/issues.json` 對 filter shorthand 不照辦——直接 `?assigned_to_id=me` 會傳回非本人 issue。**必要組合**：
```
?assigned_to_id=me&status_id=o&set_filter=1
```
三個參數一起送才正確過濾。CSV/atom 端點認直接 shorthand，但 JSON 不認。

### Preview token (two-phase commit)

複製 master 分支 Python server 的安全機制到 client：
- preview：產生 `crypto.randomUUID()` 風格 token + SHA-256 內容簽章存 Map
- commit：驗 token + spent_on + 簽章三件，任一不符拒絕
- 30 分鐘 TTL

### CSS scoping

所有 master CSS 規則都會加 `#__worklog_root` scope 防污染 Easy Redmine 頁。特殊轉換：
- `body { ... }` → `#__worklog_root { ... }`
- `:root { ... }` → `#__worklog_root { ... }`
- `[data-theme="dark"] { ... }` → `#__worklog_root[data-theme="dark"] { ... }`
- `* { ... }` → `#__worklog_root * { ... }`
- `@media (...) { ... }` 遞迴處理裡層

`overlay.js` 的 `LAUNCHER_CSS`（沿用舊名，內容已僅剩 overlay root / backdrop / close 按鈕樣式）額外對 sticky-actions / shell max-width / overlay min-height 等加 `!important` 防禦覆寫，避免 master CSS 在 overlay 環境下有副作用（例如 `body { min-height: 100vh }` 會撐破 overlay 邊距）。

## Storage (Tampermonkey GM)

| Key | 內容 |
|-----|------|
| `api_key` | 使用者個人 Redmine API Key（選填） |
| `phrases` | 工時模板列表 |
| `saved_queries` | PJ 篩選器列表 |
| `issue_templates` | Issue subject 模板列表（嵌在「批次建 issue」view 內，僅存 `{ id, subject }`） |
| `visited_issues` | 近期查閱清單（保留 7 天，每次訪問 `/issues/{id}` 自動更新） |
| `side_nav_collapsed` | sidebar 收合狀態（true/false） |

## API surface (內部 adapter，不對外)

`window.__worklog_fetchJson` 攔截 worklog_app.js 對 `/api/*` 的呼叫，路由到本地 handler。Handler map 對映：

| 路徑 | 行為 |
|------|------|
| `GET /api/issues?source=mine|mine-grouped|schedule` | 直接打 `/issues.json?assigned_to_id=me&status_id=o&set_filter=1&...` |
| `GET /api/issues?source=visited` | 從 GM `visited_issues` 讀，可帶 date filter |
| `GET /api/issues?source=query&query_id=X` | 打 `/issues.json?query_id=X&set_filter=1` |
| `GET /api/time-entry-activities` | `/enumerations/time_entry_activities.json` 含 fallback |
| `GET/POST/PUT/DELETE /api/phrases[/{id}]` | 純 GM `phrases` CRUD |
| `GET/POST/DELETE /api/saved-queries[/{id}]` | 純 GM `saved_queries` CRUD |
| `POST /api/time-entries/preview` | client validate + 對每筆查 duplicate `/time_entries.json?issue_id=X&spent_on=Y&user_id=...` |
| `POST /api/time-entries/commit` | 驗 token，逐筆 POST `/time_entries.json` |
| `POST /api/schedule/apply-dates` | 逐筆 PUT `/issues/{id}.json` 更新 start_date/due_date |
| `GET /api/projects` | 打 `/projects.json?limit=100`，含 offset 分頁聚合（>100 筆專案時自動補抓） |
| `GET /api/trackers` | 打 `/trackers.json` |
| `GET/POST/PUT/DELETE /api/issue-templates[/{id}]` | 純 GM `issue_templates` CRUD |
| `POST /api/issues/batch-create` | 接 `{ project_id, tracker_id, rows: [{ subject, estimated_hours?, start_date?, due_date? }] }`，逐筆 POST `/issues.json`（自動帶當前使用者為 assigned_to_id，避免某些 tracker 必填 assignee 的 422）並回 `{ results }` |

## Sidebar / Main view 架構

```
┌─ Redmine 頂部 menu ──────────────────────────┐
│ 首頁 / 專案清單 / 問題清單 / [⏱ 工時助手 ▾] │  ← injectTopMenu() 注入
│                              ├─ 填寫工時      │     SIDE_VIEWS.map 出子項
│                              ├─ 兩週排程      │
│                              ├─ 工時模板      │
│                              └─ PJ 篩選器     │
└──────────────────────────────────────────────┘
                            ↓ 點任一項
┌─ Overlay (#__worklog_root, fixed inset 32px)─┐
│ ┌─sidebar──┐ ┌─main view──────────────────┐ │  ← mountOverlay() 動態
│ │📝 填寫工時│ │  data-view 切換             │ │     用 SIDE_VIEWS render
│ │📅 兩週排程│ │  worklog/schedule 共用容器  │ │     side-tab buttons
│ │✏️ 工時模板│ │  phrases / sources / issue- │ │
│ │🔍 PJ篩選器│ │  batch 各自容器             │ │
│ │➕批次建issue│ │  （issue 模板 CRUD 嵌在    │ │
│ │          │ │   batch view 內，非獨立 view）│ │
│ │──────────│ │                             │ │
│ │⚙️ 設定    │ │                             │ │
│ └──────────┘ └─────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**單一 source of truth**：`menu-injector.js` 的 `SIDE_VIEWS` 陣列。新增功能項只改這個，menu 跟 sidebar 同步出現。

**view 切換邏輯**（`worklog_app.js renderTopTabs`）：
- `state.sideView` 紀錄當前 sidebar 選的 view
- `[data-side-view]` button 按 sideView 設 active
- `.main-view[data-view]` 容器按 sideView 顯示／隱藏
- **schedule 借用 worklog 容器**（`visibleView = sideView === "schedule" ? "worklog" : sideView`），內部 `renderTable` / `renderIssueList` 依 `currentSource.type` 切 schedule UI
- `#main-toolbar`（source-tabs）只在 sideView === "worklog" 顯示

**Scroll 結構**：`#__worklog_root { overflow: hidden }`、`.app-shell { overflow: hidden }`、`.shell { overflow-y: auto; height: 100% }` — sidebar 永遠固定可見，scroll 只發生在 main 區。

## Decision log（為什麼這樣做）

按時序記載踩過的彎路與最終定案，新 session 接手能快速理解 why。

1. **`pj-` class prefix**：Easy Redmine 自家 CSS 有 `.issue-card { max-width: 300px !important }` 等同名 class，scoping `#__worklog_root .issue-card` 在 specificity 戰中**輸給 `!important`**。試過 LAUNCHER_CSS 加 `!important` 對抗，仍不可靠。最終把自家 class 全加 `pj-` 前綴避開撞名。**只處理含連字號的 class**：utility 單字 class（`selected`/`muted`/`tag`）跳過，避免跟 JS object key（如 `entry.selected`）撞名導致語法錯。

2. **token-boundary 替換**（`(?<![\w-])`/`(?![\w-])`）：原本用 `\b` 替換 class 名稱，結果把 `data-issue-id` 屬性裡的 `issue-id` 也改成 `data-pj-issue-id`，JS `dataset.issueId` 取不到 → checkbox 帶入時 `Number(undefined) === NaN`。改成把連字號也視為 token 邊界後，dataset 屬性名不再被誤改。

3. **schedule 共用 worklog view 容器**：原本架構 schedule 跟 worklog 共用 `.layout`，內部按 `currentSource.type` 動態切換 UI。重構左側 sidebar 後，sideView "schedule" 沒對應 `[data-view="schedule"]`，所有 main-view 全 hidden。修法：`visibleView = sideView === "schedule" ? "worklog" : sideView`，schedule 借 worklog 容器。

4. **SIDE_VIEWS 共用陣列**：sidebar tab 跟 Redmine 頂部 menu 下拉子項要保持同步。寫死兩處難維護。`menu-injector.js` 定義 `SIDE_VIEWS`，`injectTopMenu()` 跟 `mountOverlay()` 都從這裡 render。雙 icon 設計（`iconClass` 給 menu、`icon` emoji 給 sidebar）兼顧兩種視覺風格。

5. **mountOverlay 內也注入 LAUNCHER_CSS**：LAUNCHER_CSS 同時包含「浮動按鈕樣式」+「`#__worklog_root` 的 fixed 定位 + backdrop + close 按鈕」。原本由 `installLauncher()` 在 boot 階段注入。改用頂部 menu 入口後 boot 不再呼叫 installLauncher，但 LAUNCHER_CSS 沒挪去他處 → overlay 拿不到 `position: fixed; inset: 32px` → 變 normal flow 落到 body 末端。修法：`mountOverlay()` 開頭也注入 LAUNCHER_CSS。

6. **overlay scroll 從外移內**：`#__worklog_root { overflow: auto }` 時整個 overlay 是 scroll 容器，sidebar 跟著滾走。改 `overflow: hidden` + `.shell { overflow-y: auto }`，sidebar 固定可見。

7. **`min-height: 0 !important` override**：`worklog_ui.html` body 有 `min-height: 100vh`，scope 化變 `#__worklog_root { min-height: 100vh }`，跟 overlay 的 `top: 32; bottom: 32` 衝突 → 元素被撐高超出 viewport bottom。LAUNCHER_CSS 顯式設 `min-height: 0 !important; max-height: calc(100vh - 64px) !important` 蓋掉。

8. **set_filter=1 + status_id=o + assigned_to_id=me**：Easy Redmine `/issues.json` 對 session auth 的 filter 處理有 bug。試過：shorthand 直接帶（不過濾）、`f[]/op[]/v[][]` 完整語法（不過濾）、CSV+per-issue JSON（速度慢）、atom+per-issue JSON（同樣慢）。最後 user 實測證實「`assigned_to_id=me&status_id=o&set_filter=1`」三件套是 session 模式下唯一可靠組合。

9. **Phrases/queries CRUD 後 renderAll()**：原本 phrase 新增/刪除只 `renderPhrasesDrawer()`，沒同步刷新每筆 entry 右上角的「快速填入」下拉。改成觸發整體 `renderAll()`，所有依賴 `state.phrases` 的 component 一次刷新。component-style 的 single source of truth。

10. **build 時注入 `APP_VERSION`/`APP_BUILD_TIME`**：worklog_app.js 寫死的 `APP_VERSION = "1.2.0"` 永遠不更新。改成 build script 用 regex 替換為當下時間戳，跟 `@version` metadata 同步。

11. **批次建 issue 不採 preview/commit 兩階段**：`POST /api/issues/batch-create` 直接逐筆 POST `/issues.json`，不像 time entries 走 preview token + SHA-256 簽章。理由：建 issue 沒有「duplicate 偵測」需求（同 subject 多筆是允許的），且 client 已在 UI 上把 project / tracker / rows 顯示給 user 確認；多一層 preview 只增加複雜度。失敗時把錯誤訊息回傳到 `results[].error`，UI 顯示成功項 #ID 連結與失敗項紅色卡片，user 可手動重試失敗列。

12. **Projects 列表分頁聚合**：Redmine `/projects.json` 預設只回 25 筆且 `limit` 上限 100，無 `assigned_to_id` 之類的 filter（拉的是「user 可見」的全部 projects）。`GET /api/projects` handler 先 `limit=100`，再依 `total_count` 跑 offset loop 補抓（安全閥 2000 筆）。Project 多時首次載入會稍慢，所以用 lazy load：第一次切到 `issue-batch` view 才 fetch projects + trackers，不放 boot Promise.all。

13. **Issue 模板不獨立 view**：原本拆 `issue-templates` + `issue-batch` 兩個 sidebar 項目。實測 issue 模板 CRUD 跟批次建 issue 是同一個工作流（建模板就是為了用），分兩個 view 反而增加 navigation 成本。改成把模板 chip picker + 編輯/刪除按鈕 + inline add form 全部嵌在 `issue-batch` view 內，sidebar 只剩一個 `➕ 批次建 issue` 入口。`renderIssueTemplatesView` 已刪除，`renderBatchTemplatesPicker` 接管全部模板 UI。

14. **batch-create 預帶 assignee 為本人**：Easy Redmine 部分 tracker 設定為 assignee 必填，POST `/issues.json` 不帶 `assigned_to_id` 會 422 「指派給不能為空元」。`POST /api/issues/batch-create` 用既有的 `getCurrentUserId()` 抓本人，無條件塞進每筆 issue payload。需要轉派時可在 Redmine UI 改派，這層用本人當預設值降低首次成功門檻。

## Known rough edges（已知粗糙處 / 未來可清理）

非必要重構，但下次大整理可以一併處理：

- **CSS prefix 只處理含連字號 class**：utility class（`.selected` / `.muted` / `.tag` / `.active`）仍裸名，理論上有撞名風險。目前未踩到，未來碰到再個別 rename 加 hyphen。
- **commit message 被 git hook 改寫**：repo 有 pre-commit hook 把 oneline 改為 `F / LawPJ.tampermonkey / YYYYMMDDNN /` 格式，但 body 內容仍保留中文描述。`git log --oneline` 看不到細節，要 `git log` 看完整 message。這是 repo 慣例不需改。
- **`LAUNCHER_CSS` 常數沿用舊名**：內容已僅剩 overlay root / backdrop / close 按鈕樣式，但常數名沒一起改成 `OVERLAY_CSS`。語意稍弱但無功能差，下次大整理時再改名。
- **Sidebar 抽屜 (`app-shell.mobile-open`) 邏輯不完整**：CSS 已寫好 (ui-template.html `transform: translateX(-100%)` → `translateX(0)`)，但沒有任何 JS 會 toggle `mobile-open` class，所以 mobile viewport 在 overlay 內 sidebar 永遠收合。需要時補一個 hamburger / 手勢觸發。

## 已移除（曾經存在）

- `issue_tracker.py` — 本機 HTTP server（已不需要）
- `time_entry_api.py` — Python 端 Redmine API wrapper
- `phrases_store.py`, `saved_queries_store.py` — 本機 JSON 檔案 CRUD
- `worklog_selftest.py`, `tests/` — 後端測試（功能已移到 client，無對應測試）
- `config.example.json` — server 配置範本

## Agent skills

### Issue tracker

Issues 與 PRD 存在 GitHub Issues（`ZZ0075-Inforce/EasyRedmineTools`），透過 `gh` CLI 操作。詳見 `docs/agents/issue-tracker.md`。

### Triage labels

採用預設五個英文 label（`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`）。詳見 `docs/agents/triage-labels.md`。

### Domain docs

Single-context layout：root 一份 `CONTEXT.md` + `docs/adr/`。詳見 `docs/agents/domain.md`。
