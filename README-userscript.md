# LawPJ Worklog — Tampermonkey 版

這是 `master` 分支（Python server 版）改裝成的 userscript 版本。不用啟動 server，裝進 Tampermonkey 後直接在 Redmine 頁面右下角叫出工時助手。

## 適用環境

- Easy Redmine（ER 2019 / Redmine 4.0.3）
- 網域：`https://lawpj.lawbroker.com.tw`
- 瀏覽器：Chrome / Edge + [Tampermonkey](https://www.tampermonkey.net/)

## 安裝

1. 先裝好 Tampermonkey 擴充功能
2. 點這個連結（會跳出 Tampermonkey 安裝對話框）：
   ```
   https://raw.githubusercontent.com/ZZ0075-Inforce/EasyRedmineTools/tampermonkey/dist/worklog.user.js
   ```
3. 按「安裝」
4. 登入 Redmine，任一頁右下角會出現 ⏱ 紅色浮動按鈕
5. 點擊浮動按鈕即開啟工時助手 overlay，按 `ESC` 或右上 ✕ 關閉

## 認證方式

預設走**登入 session**：userscript 與 Redmine 同源，自動帶 cookie + CSRF token，不需要任何設定。

若某些 POST/PUT 遇到 401/403（多半是 CSRF token 行為差異），可到設定 → 連線 → 貼上 API Key 當備援：

1. 到 Redmine「我的帳號」→ 右側「API 存取金鑰」→ 點「顯示」
2. 複製那串字
3. 在 userscript 的設定 → 連線 → 貼上 → 儲存
4. 可點「連線測試」確認

API Key 存在 Tampermonkey 的 `GM_setValue` 儲存中，僅限這個 userscript 讀取；同網域下其他 JS 無法看到。

## 功能對照

| 原本 Python server 版 | Userscript 版 |
|---------------------|---------------|
| `python issue_tracker.py serve` 啟動 | 瀏覽器裝好 Tampermonkey 後自動載入 |
| `config.local.json` 存 API Key | 設定 → 連線 tab 貼入 |
| `phrases.local.json` | 存在 `GM_setValue("phrases")` |
| `saved_queries.local.json` | 存在 `GM_setValue("saved_queries")` |
| Python proxy Redmine API | 瀏覽器直接同源 fetch |
| Preview token（server 記憶體） | 瀏覽器端 Map + SHA-256 簽章 |

## 開發

從本機 clone 後：
```bash
python build-userscript.py
```
輸出 `dist/worklog.user.js`。放到 GitHub 後，Tampermonkey 的 `@updateURL` 會自動 pull 更新（預設 24h 檢查一次，可在 Tampermonkey 設定調）。

### 檔案結構
```
src-userscript/
  header.meta.js       ← UserScript metadata (@name, @match, @grant, @updateURL)
  runtime.js           ← 認證、Redmine API、preview token、handler map
  overlay.js           ← 浮動按鈕 + overlay 掛載
  settings-patch.js    ← 設定 modal 注入 API Key 欄 + 連線測試
build-userscript.py    ← 讀 src-userscript/ui-template.html + worklog_app.js，scope CSS，輸出 single file
dist/
  worklog.user.js      ← 最終產物（commit 進 repo，GitHub raw URL 給 Tampermonkey）
```

build 時會：
1. 從 `src-userscript/ui-template.html` 抽出 body HTML + CSS
2. CSS 全部加 `#__worklog_root` scope 前綴，避免污染 Redmine 頁
3. 移除 Google Fonts `<link>`（規避 CSP，改用系統 fallback）
4. 把 `worklog_app.js` 包進 `__initWorklogApp()` 函式
5. `fetchJson` 改為呼叫內建 adapter，所有 `/api/*` 路徑本地處理
6. 主題切換從 `<html>` 改套在 `#__worklog_root`
7. 串接成單一 `.user.js`

## 已知限制

- 僅支援 `lawpj.lawbroker.com.tw` 網域（`@match` 寫死）。如要支援其他 Redmine 實例需自行修改 metadata
- 必須先登入 Redmine 才能用（session 或 API Key 二擇一）
- `GM_setValue` 存的資料不跨機器同步；換電腦需重貼 API Key、重建工時模板與 PJ 篩選器
- `@run-at document-idle`：Tampermonkey 在頁面完全載入後才執行，所以 Redmine SPA 頁跳轉時可能需要點一下浮動按鈕再次觸發

## 與 master 分支的關係

- `master`：本機 Python server + SPA 的原版，功能完整
- `tampermonkey`：此分支，只保留 userscript 所需檔案；`worklog_app.js` 與 `src-userscript/ui-template.html` 由 build 工具讀取，不做實質改動
- 若 `master` 更新核心邏輯，切到這分支執行 `git merge master` 後重新 `python build-userscript.py` 即可產出新的 userscript
