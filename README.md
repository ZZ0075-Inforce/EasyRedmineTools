# Easy Redmine Issue Tracker

這個版本會先從你本機瀏覽器歷史紀錄抓出有瀏覽過的 issue URL，再選擇性呼叫 Redmine API 補上 issue 資訊，並提供「批次工時預覽 -> 二段送出」流程。

## 目前做到的事

- 讀取 Chrome、Edge、Firefox 歷史紀錄
- 篩出 `https://lawpj.lawbroker.com.tw/issues/<id>` 這類網址
- 支援查詢 `today` / `yesterday` / 指定日期
- 有 CLI 版，也有本機 Web UI
- Web UI 支援單日左右切換、多選 issue、全域工時日期、先預覽再送出
- 活動清單優先走 Redmine API，若不支援則退回手動輸入 `activity_id`
- 支援 `issue_defaults.json` + `issue_defaults.local.json` 的雙層 issue 預設記憶
- 主要非同步操作會顯示全頁 loading mask，避免重複點擊
- 會產生可直接拿來補登工時的 `curl.exe` 範例

## 設定

1. 複製 `config.example.json` 成 `config.local.json`
2. 填入你的 Redmine 個人 API key

```json
{
  "redmine_base_url": "https://lawpj.lawbroker.com.tw",
  "redmine_api_key": "你的個人 API key",
  "enabled_browsers": ["chrome", "edge", "firefox"]
}
```

你也可以不建檔，直接用環境變數：

```powershell
$env:REDMINE_BASE_URL = "https://lawpj.lawbroker.com.tw"
$env:LAWPJ_API_KEY = "你的個人 API key"
```

程式現在優先讀取 `LAWPJ_API_KEY`。若你的環境還留著舊的 `REDMINE_API_KEY`，目前也仍可當 fallback 使用。

如果沒設定 API key，工具仍然可以列出看過的 issue，但不會向 Redmine 取回標題、狀態、專案等欄位，也不能提交工時。

## Issue 預設記憶

- 共享檔：`issue_defaults.json`
- 個人覆蓋檔：`issue_defaults.local.json`

兩者格式相同，都是：

```json
{
  "issues": {
    "195451": {
      "hours": "1.0",
      "activity_id": 9,
      "comments": "每日固定工時內容"
    }
  }
}
```

載入規則是先讀共享檔，再讀個人覆蓋檔；同一個 issue 只要 local 有值，就整筆覆蓋 shared。UI 內的「Issue 預設」抽屜只會改 `issue_defaults.local.json`。

## CLI 用法

列出今天看過的 issue：

```powershell
python .\issue_tracker.py issues --day today
```

列出昨天看過的 issue，改成 JSON：

```powershell
python .\issue_tracker.py issues --day yesterday --json
```

如果你只是要驗證瀏覽歷史抓取，不想先碰 Redmine API：

```powershell
python .\issue_tracker.py issues --day today --no-api
```

## 本機 UI

啟動本機介面：

```powershell
python .\issue_tracker.py serve
```

打開 [http://127.0.0.1:8765](http://127.0.0.1:8765)

你可以用左 / 右箭頭或直接選日期，切到指定日後再勾選看過的 issue。Batch Worklog 則會：

- 建立批次工時表單
- 在頂端統一指定 `spent_on`
- 逐列編輯 `hours / activity / comments`
- 可開啟側邊抽屜，針對目前清單中的 issue 設定預設時數、活動、備註
- 載入 issue、預覽、送出、儲存預設時都會顯示 loading mask
- 先呼叫 preview API 檢查欄位與重複工時
- 只有在完成 preview 且仍有有效勾選列時，才允許送出到 Redmine

## 安全原則

- `--no-api` 只讀瀏覽器歷史，不會呼叫 Redmine API。
- `preview` 只做 GET 驗證與比對，不會送出工時。
- 真正寫入只在 `/api/time-entries/commit` 發生，而且必須帶前一步 preview 回來的 `preview_token`。
- 只要全域日期、任一列欄位或 issue 預設有修改，就必須重新 preview。
- 測試時請優先跑 mock 自測，不要直接對正式站台驗證 `POST`。

## Mock 自測

這支自測不會碰你的正式 Easy Redmine：

```powershell
python .\worklog_selftest.py
```

## curl 先行驗證

查看單一 issue：

```powershell
$env:LAWPJ_API_KEY = "你的個人 API key"
curl.exe -H "X-Redmine-API-Key: $env:LAWPJ_API_KEY" "https://lawpj.lawbroker.com.tw/issues/195451.json"
```

查看某 issue 在某天的工時：

```powershell
curl.exe -H "X-Redmine-API-Key: $env:LAWPJ_API_KEY" "https://lawpj.lawbroker.com.tw/time_entries.json?issue_id=195451&user_id=me&spent_on=2026-03-20"
```

補登工時：

```powershell
curl.exe -X POST `
  -H "Content-Type: application/json" `
  -H "X-Redmine-API-Key: $env:LAWPJ_API_KEY" `
  -d '{"time_entry":{"issue_id":195451,"spent_on":"2026-03-20","hours":1.5,"activity_id":9,"comments":"補登工時"}}' `
  "https://lawpj.lawbroker.com.tw/time_entries.json"
```

也可以讓程式替你產生對應範例：

```powershell
python .\issue_tracker.py curl-examples --issue-id 195451 --spent-on 2026-03-20 --hours 1.5 --activity-id 9 --comments "補登工時"
```

## 已知限制

- 這是「讀歷史紀錄」方案，不是即時瀏覽器 extension，所以它反映的是瀏覽器已記錄的頁面。
- 無痕模式、被清掉的歷史、或不是用支援的瀏覽器瀏覽，都抓不到。
- 以目前 `ER 2019 / Redmine 4.0.3` 的官方標準 REST API 來看，沒有可直接查「某使用者哪天看過哪些 issue」的端點，所以資料來源仍先維持瀏覽器歷史。
- `activity_id` 需符合你們 Easy Redmine 上的工時活動設定。
- 這個版本已經有真正的提交 API，但一般測試流程仍建議只跑 preview 與 mock 自測。
