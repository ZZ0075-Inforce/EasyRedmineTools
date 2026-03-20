# Easy Redmine Issue Tracker

這個原型先不碰 Easy Redmine 主機端，直接從你本機瀏覽器歷史紀錄抓出有瀏覽過的 issue URL，再選擇性呼叫 Redmine API 補上 issue 資訊。

## 目前做到的事

- 讀取 Chrome、Edge、Firefox 歷史紀錄
- 篩出 `https://lawpj.lawbroker.com.tw/issues/<id>` 這類網址
- 支援查詢 `today` / `yesterday` / 指定日期
- 有 CLI 版，也有本機 Web UI
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
$env:REDMINE_API_KEY = "你的個人 API key"
```

如果沒設定 API key，工具仍然可以列出看過的 issue，但不會向 Redmine 取回標題、狀態、專案等欄位。

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

你可以切換「今日 / 昨日」，左邊列出 issue，右邊則顯示：

- 最近瀏覽時間
- issue 基本資訊
- 對應的 `curl.exe` 範例

## curl 先行驗證

查看單一 issue：

```powershell
$env:REDMINE_API_KEY = "你的個人 API key"
curl.exe -H "X-Redmine-API-Key: $env:REDMINE_API_KEY" "https://lawpj.lawbroker.com.tw/issues/195451.json"
```

查看某 issue 在某天的工時：

```powershell
curl.exe -H "X-Redmine-API-Key: $env:REDMINE_API_KEY" "https://lawpj.lawbroker.com.tw/time_entries.json?issue_id=195451&user_id=me&spent_on=2026-03-20"
```

補登工時：

```powershell
curl.exe -X POST `
  -H "Content-Type: application/json" `
  -H "X-Redmine-API-Key: $env:REDMINE_API_KEY" `
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
- `activity_id` 需符合你們 Easy Redmine 上的工時活動設定。
- 本機 UI 現在先做到「列出你看過的 issue + 生成 curl」，下一步可以再接真正的工時填寫表單與送單按鈕。
