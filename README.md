# EasyRedmineTools — LawPJ Worklog Helper

針對 Easy Redmine（lawpj.lawbroker.com.tw，ER 2019 / Redmine 4.0.3）的工時批次補登 + issue 管理輔助工具。**Tampermonkey 版**——裝完瀏覽器擴充後直接用，不需啟動本機 server。

> 完整 architecture / decision log 請看 [`CLAUDE.md`](./CLAUDE.md)。

## 安裝（一條 URL 搞定）

1. 瀏覽器先裝 [Tampermonkey](https://www.tampermonkey.net/)
2. 點下面這個連結觸發安裝：
   ```
   https://raw.githubusercontent.com/ZZ0075-Inforce/EasyRedmineTools/tampermonkey/dist/worklog.user.js
   ```
3. 登入 Redmine，**頂部 menu** 在「問題清單」後面會多一個「⏱ 工時助手」入口
4. 點主連結或下拉子項即可開啟對應 overlay 畫面

## 主要功能

工具掛在 Redmine 頂部 menu，點開後 overlay 內是 **左側 Notion-style sidebar + 右側 main view** 結構，分成 5 個功能區：

- **📝 填寫工時**：Issue 多選 + 工時模板快速填入；preview/commit 兩階段（含 SHA-256 內容簽章 + 30 分鐘 token TTL）防誤送；duplicate 偵測自動取消勾選同日已存在的 issue
- **📅 兩週排程**：以「開始排程日期」為基準，依需求自動延伸 ≥10 個工作日，每日上限可在設定調整（預設 6.5h），可拖拉重排，送出後逐筆 PUT 更新 `start_date / due_date`
- **✏️ 工時模板**：CRUD 預先存好「時數 / 活動 / 備註」組合，每筆工時卡片右上角下拉一鍵套用
- **🔍 PJ 篩選器**：把 Redmine 自訂查詢（Custom Query，URL 帶 `?query_id=X`）加進來當「填寫工時」的 issue 來源分頁
- **➕ 批次建 issue**：選一個 project + tracker，從預先建好的「Issue 模板」勾選即套用為列、取消勾選即移除；可手動加空白列；每列可獨立填估計工時 / 開始日期 / 完成日期；assignee 自動帶當前使用者，避開部分 tracker 必填 assignee 的 422

額外：

- **近期查閱**：自動記錄 N 天內（預設 7，可在設定 → 填寫工時調整）在 Redmine 點開過的 issue，當作填寫工時的快速來源
- **設定 modal**：左側垂直 nav + 右側 pane，分 8 個 tab：
  - 外觀（淺色 / 深色 theme）
  - 填寫工時（近期查閱保留天數、每日工時上限、預設工時日期偏移）
  - 兩週排程 / 工時模板 / PJ 篩選器 / 批次建 issue（為未來預留）
  - 連線（Redmine API Key 備援設定 + 連線測試）
  - 關於（版本 / build 時間）

## 認證

- **預設**：使用 Redmine 登入 session（瀏覽器 cookie + CSRF token），免設定
- **備援**：若遇到 401/403/CSRF 錯誤，可到設定 → 連線 → 貼上個人 API Key（Redmine「我的帳號 → API 存取金鑰」可取得）；切換成 API Key 模式會跳過 CSRF 檢查

## 開發

```bash
python build-userscript.py
```

輸出 `dist/worklog.user.js`。Push 到 GitHub 後，Tampermonkey 會自動偵測新版（每次 build 會把版號刻時間戳，例如 `1.0.202604300226`）。

驗證 build 產物無語法錯誤：

```bash
node -e "new Function(require('fs').readFileSync('dist/worklog.user.js','utf8')); console.log('[OK]')"
```

### 檔案結構

```
src-userscript/
  header.meta.js       # UserScript metadata (@name, @match, @grant, @updateURL)
  runtime.js           # 認證 / Redmine API / preview token + 簽章 / handler map / 訪問記錄
  menu-injector.js     # Redmine 頂部 menu 注入 + SIDE_VIEWS 共用陣列（sidebar + menu 同步來源）
  overlay.js           # overlay 掛載（fixed inset 32px）+ backdrop + ESC + sidebar 動態 render
  settings-patch.js    # 設定 modal 注入連線 tab + 5 個 view tab + sidebar 收合切換
  ui-template.html     # HTML / CSS template，build 工具直接讀取
worklog_app.js         # 前端核心邏輯（state / render / event handler；build 時被包進 __initWorklogApp()）
build-userscript.py    # 把上面所有部件組合輸出 dist/worklog.user.js
dist/
  worklog.user.js      # 最終產物（commit 進 repo，GitHub raw URL 給 Tampermonkey 讀）
CLAUDE.md              # Architecture 概述 + decision log（推薦先看這個）
DESIGN.md              # 視覺 / 品牌系統決策
```

build 流程概要：

1. 讀 `header.meta.js`，把 `@version` 換成 `1.0.{YYYYMMDDhhmm}` 確保 Tampermonkey 偵測升版
2. 從 `ui-template.html` 抽 HTML body + CSS
3. 自家 class（含連字號者）全加 `pj-` 前綴避開 Easy Redmine 全域 CSS 撞名（utility 單字 class 跳過避免跟 JS object key 撞）
4. CSS 全加 `#__worklog_root` scope 前綴避免污染 Redmine 頁；`:root` / `body` / `[data-theme]` 等特殊規則做 scope 轉換
5. 移除 Google Fonts `<link>`（規避 CSP）
6. `worklog_app.js` 包進 `__initWorklogApp()`：`fetchJson` 改走 `window.__worklog_fetchJson` 本地 adapter；`APP_VERSION` / `APP_BUILD_TIME` 換成 build 時間戳
7. 串接 IIFE：`metadata → APP_HTML/APP_CSS → runtime → settings-patch → overlay → menu-injector → wrapped app-core → bootstrap`

## Storage（Tampermonkey GM）

| Key | 內容 |
|-----|------|
| `api_key` | Redmine API Key（選填備援） |
| `phrases` | 工時模板列表 |
| `saved_queries` | PJ 篩選器列表 |
| `issue_templates` | Issue subject 模板列表（批次建 issue 用，僅 `{ id, subject }`） |
| `visited_issues` | 近期查閱清單（保留 N 天，每次訪問 `/issues/{id}` 自動更新） |
| `visit_retention_days` | 近期查閱保留天數（預設 7，可調 1-365） |
| `daily_hour_limit` | 每日工時上限（預設 6.5，可調 3-12） |
| `default_spent_on_offset` | 預設工時日期偏移（預設 1，0 = 今天） |
| `side_nav_collapsed` | sidebar 收合狀態 |

## 已知限制 / 怪癖

- 僅支援 `lawpj.lawbroker.com.tw` 網域（`@match` 寫死）
- 必須登入 Redmine（session 或 API Key 二擇一）
- `GM_setValue` 存的所有 user data 不跨機器同步
- **Easy Redmine `/issues.json` filter 怪癖**：必須帶 `set_filter=1` + `status_id=o` + `assigned_to_id=me` 三件套才能正確過濾本人 issue（CSV/atom 端點認 shorthand，但 JSON 不認）
- repo 有 pre-commit hook 把 commit 的 oneline 改寫成 `F / LawPJ.tampermonkey / YYYYMMDDNN /` 格式，body 保留中文描述。`git log --oneline` 看不到細節，要 `git log` 看完整 message
