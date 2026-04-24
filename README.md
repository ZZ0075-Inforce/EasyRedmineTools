# Easy Redmine Worklog Helper

這個版本已經拿掉瀏覽器歷史抓取，全面改走 Redmine REST API：切換「我名下」或「關注專案」來源，勾選 issue 後建立批次工時表單，先預覽再送出。

## 主要功能

- 從 Redmine API 直接查 issue，頂部以 tab 切換來源：
  - **我的 issue**：`assigned_to_id=me`，列表模式；可加「更新日期」條件。
  - **我的 project**：同樣資料改按專案分組呈現，點標題可收合。
  - **分配工時**：兩階段流程。Step 1 勾選要排程的 project；Step 2 拖拉 / ↑↓ 排序 project 與 issue，點預算數字可覆寫。以本週一為基準往後填，每日上限 6.5h，會依總需求自動延伸到足夠多的工作日。按底部「送出更新起迄日 →」會依甘特結果對每筆 issue 發 `PUT /issues/{id}.json` 更新 `start_date / due_date`。
  - **PJ 篩選器**：直接引用 Redmine 自訂查詢（Custom Query）。先在 Redmine 網站建好篩選條件，把網址 `?query_id=X` 的 ID 和顯示名稱加進來即可。移除 PJ 篩選器只能從右上角「PJ篩選器」抽屜操作，避免誤按。
- PJ 篩選器儲存在 `saved_queries.local.json`。
- Issue 清單有即時標題搜尋框；全選只作用於搜尋後的可見項。
- 常用語句庫（`phrases.local.json`）：每筆可選擇預設「時數、活動、備註」其中任意組合。先在批次表格點一下要套用的列，再回側邊欄按「套用」即可一次帶入。
- 批次工時表單：逐列編輯 hours / activity / comments，頂端統一指定 `spent_on`。目前列會被標色。
- 活動清單走 `/enumerations/time_entry_activities.json`，API 不支援時退回手動輸入 `activity_id`。
- 二段式提交：preview 只做 GET 驗證與比對重複工時；commit 必帶上一階段的 `preview_token`，且內容一改就失效。
- 非同步操作有全頁 loading mask，避免重複點擊。
- 附 CLI 可列出 issue，也能產生可直接拿來驗證的 `curl.exe` 範例。

## 設定

1. 複製 `config.example.json` 成 `config.local.json`
2. 填入你的 Redmine 個人 API key

```json
{
  "redmine_base_url": "https://lawpj.lawbroker.com.tw",
  "redmine_api_key": "你的個人 API key"
}
```

或直接用環境變數（優先級高於設定檔）：

```powershell
$env:REDMINE_BASE_URL = "https://lawpj.lawbroker.com.tw"
$env:LAWPJ_API_KEY = "你的個人 API key"
```

舊版的 `REDMINE_API_KEY` 仍可當 fallback。

沒設 API key 的狀態下不能取 issue 也不能送工時。

## 本機 UI

```powershell
python .\issue_tracker.py serve
```

打開 [http://127.0.0.1:8765](http://127.0.0.1:8765)

操作流程：

1. 上方「Source 分頁」選擇來源。第一次進來只有「我名下」，按「+ 加入關注專案」可從 Redmine 的專案清單挑選。
2. Filter 列可填「更新日期」作為 issue 的更新範圍；專案模式還能決定「是否只看我名下 / 是否只看進行中」。
3. 左側勾選要補登的 issue，右側會同步建立工時草稿。
4. 點右上「常用語句」叫出側邊欄，可新增 / 編輯 / 刪除。在表格裡點任一「備註」欄位，再回側邊欄點語句即可插入到游標位置。
5. 填完所有列 → 預覽 → 送出。預覽結果只要任一欄位或日期被改動，就必須重新預覽才能送出。

## 本機儲存檔格式

`saved_queries.local.json`：

```json
{
  "queries": [
    { "query_id": 762, "name": "我的任務分組" }
  ]
}
```

`phrases.local.json`（每筆至少要有 hours / activity_id / comments 其中一項）：

```json
{
  "phrases": [
    {
      "id": "abc123",
      "label": "日常維運",
      "hours": "1",
      "activity_id": 25,
      "comments": "日常quartz、IPO資料維運"
    }
  ]
}
```

兩個檔都在 `.gitignore` 內，不會被 commit。

## CLI 用法

查我身上進行中的 issue：

```powershell
python .\issue_tracker.py issues
```

加上更新日期條件：

```powershell
python .\issue_tracker.py issues --day yesterday
```

用 Redmine 自訂 Query：

```powershell
python .\issue_tracker.py issues --query-id 762
```

`--json` 直接輸出 JSON。

## Mock 自測

```powershell
python .\worklog_selftest.py
```

也可以只跑單元測試：

```powershell
python -m unittest worklog_selftest
```

## curl 先行驗證

```powershell
$env:LAWPJ_API_KEY = "你的個人 API key"
curl.exe -H "X-Redmine-API-Key: $env:LAWPJ_API_KEY" "https://lawpj.lawbroker.com.tw/issues/195451.json"
```

或由程式產生對應 curl：

```powershell
python .\issue_tracker.py curl-examples --issue-id 195451 --spent-on 2026-03-20 --hours 1.5 --activity-id 9 --comments "補登工時"
```

## 安全原則

- `preview` 只做 GET 驗證與比對重複工時，不會寫入。
- 真正寫入只在 `/api/time-entries/commit` 發生，而且必須帶 `preview_token` 且內容與 preview 簽章一致。
- 改全域日期、任何列欄位都會讓 preview 失效。
- 建議新環境先跑 mock 自測，不要直接對正式站台驗證 `POST`。

## 已知限制

- 「我名下 + 更新日期」抓的是「當天 issue 被任何方式更新過」的集合，不一定完全等於你實際工作過的 issue。若需更精確，可用關注專案模式手動挑選。
- `activity_id` 必須符合你們 Easy Redmine 設定的工時活動。
- `/projects.json` 回傳的清單是「你能看到」的專案，不代表你是成員。
