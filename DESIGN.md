# DESIGN.md

> 專案的設計說明書。所有 UI、色彩、字體、間距、元件與品牌語氣決策，都以本檔案為唯一真理源。
> 所有 AI 助理、設計師、前端工程師在做任何視覺或介面決策前，必須先閱讀本文件。
> 未經明確批准，不可偏離本文件定義。

---

## 1. Product Context

- 產品名稱：Project plugin
- 產品定位：這是針對www.easyredmine.com的project管理系統做擴充功能，一個給團隊使用的專案管理操作系統，整合專案規劃、任務追蹤、時程管理、資源分配、文件協作與決策紀錄。
- 目標使用者：中小型團隊、營運團隊、PM、產品經理、設計與工程跨職能團隊。
- 產品類型：工作流導向的 Web App / SaaS / 內部營運介面。
- 核心任務：
  - 快速掌握專案狀態
  - 明確辨識優先順序與阻塞點
  - 減少協作資訊散落
  - 讓任務、文件、時程、責任歸屬可追蹤
- 使用情境：
  - 每日站會前查看專案健康度
  - 管理者檢視跨專案進度與風險
  - 成員更新任務、交付物、截止日與依賴關係
- 品牌印象：
  - 不炫技
  - 有秩序
  - 安靜
  - 值得信任
  - 像一本被精心編排的工作手冊，而不是一個吵雜的儀表板

---

## 2. Aesthetic Direction

- 一句話方向：日系極簡 × 溫暖編輯感 × 安靜而精準的工作系統
- 情緒：
  - 像一本有秩序的紙本專案手冊
  - 有溫度，但不鬆散
  - 有效率，但不冷硬
  - 有層次，但不花俏
- 視覺主角：
  - typography
  - 留白
  - 清楚的資訊階層
  - 低彩度中帶一個有辨識度的 accent
- 設計意圖：
  - 專案管理不應該看起來像交易平台，也不應該像娛樂產品
  - 介面應降低焦躁感，提升判讀效率
  - 讓使用者感覺自己正在一個有秩序、可控、可信任的系統中工作

### 反模式（明確避開）

- 不要深色霓虹科技風
- 不要紫色、藍紫、彩虹漸層
- 不要 AI slop 式三欄 feature grid 套版
- 不要置中一切
- 不要泡泡按鈕
- 不要玻璃擬態（glassmorphism）
- 不要 oversized hero
- 不要過度圓角卡通風
- 不要厚重陰影與發光效果
- 不要大量裝飾性 icon 背景圓塊
- 不要把 dashboard 做成行銷頁

---

## 3. Design Principles

1. Clarity over novelty.
2. Calm over hype.
3. Typography over decoration.
4. Hierarchy over density.
5. Consistency over cleverness.
6. Signals, not noise.
7. Every color must have semantic purpose.
8. Every component must help scanning, not interrupt it.

---

## 4. Color System

此專案採用暖紙色系與克制的品牌紅作為主要識別，避免冷白、霓虹與高飽和科技感。

### Core Tokens

| Token | Value | 用途 |
|------|------|------|
| `--color-bg` | `#f9f5f1` | 主背景，暖紙色 |
| `--color-surface` | `#fdfaf7` | 卡片、浮層、模組背景 |
| `--color-surface-alt` | `#f3ede7` | 區塊分層、次背景 |
| `--color-primary` | `#2c2c2c` | 主文字、主要資訊 |
| `--color-secondary` | `#5f5a54` | 次文字、輔助說明 |
| `--color-accent` | `#d13a3a` | 品牌紅，連結、CTA、關鍵強調 |
| `--color-accent-hover` | `#b92f2f` | 主要操作 hover |
| `--color-border` | `#e8e2da` | 邊框、分隔線 |
| `--color-divider` | `#efe8e1` | 較淡分隔線 |
| `--color-success` | `#5c7a5a` | 成功、完成、健康狀態 |
| `--color-warning` | `#b7791f` | 風險、提醒、注意 |
| `--color-danger` | `#b93838` | 錯誤、阻塞、刪除 |
| `--color-info` | `#6b7280` | 中性提示 |

### Color Usage Rules

- `--color-accent` 只用於：
  - 主要 CTA
  - 重要連結
  - 關鍵狀態強調
  - 選取態的少量提示
- 不可把 `--color-accent` 大面積鋪滿整個畫面。
- 頁面主要氣質應由背景、字體、留白與版面建立，不是靠色彩堆疊。
- 成功、警告、危險色只用於語意狀態，不作品牌裝飾。
- 一個畫面中，非中性色的主角色最多兩種。

---

## 5. Typography

### Font Strategy

- 中文字體：
  - `Noto Serif TC` 用於大標、重點標題、品牌感文字
  - `Noto Sans TC` 用於介面、內文、表格、表單、導航
- 英數與 UI：
  - `Inter` 或 `Noto Sans TC`
- 原則：
  - Serif 用來提供編輯感與質地
  - Sans 用來維持系統介面的清楚與效率
  - 不使用過度幾何、過度未來感、過度可愛的字體

### Type Scale

| Token | Size | Weight | 用途 |
|------|------|------|------|
| `--text-xs` | 12px | 500 | meta、badge、輔助資訊 |
| `--text-sm` | 14px | 400/500 | 按鈕、導航、表頭、輔助文案 |
| `--text-base` | 16px | 400 | 主要內文、表單內容 |
| `--text-lg` | 18px | 500/600 | 小節標題、重要區塊標題 |
| `--text-xl` | 24px | 600 | 頁面標題 |
| `--text-2xl` | 32px | 600/700 | 首頁或總覽主標題 |

### Typography Rules

- 介面內文以 sans 為主。
- Serif 只在頁面主標、總覽主敘事區、品牌型標題出現。
- Dashboard 內不得濫用大標題；大字只保留給真正的頁面層級標題。
- 優先依靠字重、層級與留白建立視覺秩序，不靠顏色與裝飾。

---

## 6. Spacing System

- Base unit：4px

| Token | Value |
|------|------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |

### Spacing Rules

- 卡片內距預設：24px
- 表單欄位垂直間距：12px 或 16px
- 區塊與區塊之間：32px
- 大頁面 section 間距：40px 至 48px
- 不使用任意數值；所有 spacing 必須來自 token

---

## 7. Radius / Border / Shadow

### Radius

| Token | Value |
|------|------|
| `--radius-sm` | 6px |
| `--radius-md` | 10px |
| `--radius-lg` | 14px |

規則：
- 按鈕、輸入框：`--radius-sm`
- 卡片、浮層：`--radius-md`
- 大型容器：`--radius-lg`
- 避免過度圓潤的 SaaS 泡泡感

### Borders

- 預設邊框：`1px solid var(--color-border)`
- 分隔線：`1px solid var(--color-divider)`
- 優先使用淡邊框與背景層次，不用強烈描邊

### Shadows

- 陰影極淡，只用於層次區分
- 禁止使用厚重、模糊、浮誇陰影
- 卡片預設可無陰影，優先靠色差與邊框建立層次

---

## 8. Layout

### Overall Layout

- 介面以左對齊為主
- 主要工作區需具明確資訊階層
- 不追求行銷頁式的巨大 hero 與居中展示
- 所有頁面優先考慮「掃描效率」而不是「展示感」

### Grid

- Desktop：12-column grid
- Content width：1280px 內優先
- 頁面左右 padding：
  - desktop：24px
  - tablet：20px
  - mobile：16px

### Application Structure

專案管理操作系統建議結構：

1. Sidebar：工作區切換、專案列表、導航
2. Top bar：搜尋、篩選、通知、個人操作
3. Main content：頁面標題、摘要 KPI、主要內容區
4. Supporting panel：詳細資訊、活動紀錄、相關文件

---

## 9. Component Rules

### Buttons

#### Primary Button
- 背景：`--color-accent`
- 文字：白色
- 高度：40px
- Padding：0 16px
- 用途：每個畫面最重要的主要動作
- 規則：一個區塊只允許一個主 CTA

#### Secondary Button
- 背景：透明或 `--color-surface`
- 邊框：`1px solid var(--color-border)`
- 文字：`--color-primary`

#### Ghost Button
- 背景：透明
- 文字：`--color-primary`
- Hover：`--color-surface-alt`

### Inputs

- 高度：40px
- 背景：`--color-surface`
- 邊框：`1px solid var(--color-border)`
- 文字：`--color-primary`
- Placeholder：`--color-secondary`
- Focus：
  - border 使用 `--color-accent`
  - ring 要低調，不要霓虹

### Cards

- 背景：`--color-surface`
- 邊框：`1px solid var(--color-border)`
- Radius：`--radius-md`
- Padding：24px
- 卡片是資訊模組，不是裝飾積木
- 不使用彩色左邊條作為卡片識別

### Tables

- 適合任務、里程碑、資源配置、風險追蹤
- 表頭用 `--text-sm` / 600
- 內文用 `--text-sm` 或 `--text-base`
- Row height：44px 以上
- 預設不用 zebra stripes
- 以細分隔線與空間建立可讀性

### Badges / Status

- Badge 尺寸要小、安靜、可掃描
- Status 色彩必須具語意：
  - 完成：success
  - 進行中：中性或 accent 的低強度版本
  - 風險：warning
  - 阻塞：danger
- 不可把 badge 做成高飽和糖果色

### Modals / Drawers

- 用於建立任務、編輯專案、查看活動紀錄
- Modal 最大寬度：640px
- 大量資料優先用 drawer，不要把 modal 做成整頁表單
- 操作按鈕靠右，取消與確認層級明確

---

## 10. Data Visualization

- 圖表不是主角，只是輔助判讀
- 預設使用：
  - 中性色作基礎
  - `--color-accent` 作關鍵序列
  - success / warning / danger 作語意狀態
- 不使用高彩度多色圖表
- 線圖、長條圖、燃盡圖應以可讀性與趨勢判讀為優先
- 優先讓使用者快速知道：
  - 哪個專案延遲
  - 哪個團隊過載
  - 哪個里程碑有風險
  - 哪些任務卡住

---

## 11. Content Style

- 文案語氣：冷靜、明確、可信任
- 避免：
  - 過度熱情
  - 太像行銷頁
  - 過度擬人化
  - 可愛式提示語
- 優先使用：
  - 短句
  - 直接動詞
  - 可執行的錯誤訊息
  - 明確狀態名稱

### Good
- 建立新專案
- 指派負責人
- 尚未排定截止日
- 這項任務被兩個阻塞條件影響

### Avoid
- 讓我們一起開始吧！
- 太棒了，事情正在順利進行中！
- 這裡看起來空空的呢
- 恭喜你解鎖新任務！

---

## 12. Motion

- 動效原則：低調、功能性、不可打擾
- Duration：150ms–200ms
- Easing：ease-out
- 允許：
  - hover
  - focus
  - panel 展開/收合
  - modal / drawer 進出
  - list 重排
- 禁止：
  - 純裝飾浮動
  - 漸層流動背景
  - 大範圍發光
  - 華麗入場動畫

---

## 13. Accessibility

- 正文對比需達可讀標準
- 不可只靠顏色傳達狀態
- 所有互動元件必須有清楚 focus state
- 最小點擊區：40px，高密度場景下仍不可低於可操作門檻
- 表格、圖表、badge 需有文字輔助說明
- 錯誤訊息必須指出問題與可採取行動

---

## 14. AI Rules

所有 AI 助理在產生 UI 或修改前端前，必須遵守以下規則：

- Always read `DESIGN.md` before making any visual or UI decisions.
- Do not introduce new colors, gradients, shadows, spacing values, or border radii unless explicitly approved.
- Keep the interface quiet, editorial, warm, and operationally clear.
- Prefer typography, whitespace, and hierarchy over decorative UI.
- Avoid generic AI SaaS aesthetics.
- If a proposed design looks like a startup template, reject it and simplify.
- When in doubt, reduce decoration and improve information hierarchy.

---

## 15. Implementation Notes

- 所有 colors 必須先定義成 tokens，不直接在 component 中寫 hex
- 所有 spacing 必須來自 spacing scale
- 元件樣式必須可重複使用，不接受單頁特例樣式漂移
- 若發現實作與本文件不一致，以本文件為準回頭修正
- 真正的品牌感來自一致性，不來自「每頁都長得不一樣」

---

## 16. First Screens Priority

此產品最優先需要做到好的畫面：

1. 專案總覽 Dashboard
2. 專案列表 / 看板 / Timeline
3. 任務詳細頁
4. 團隊工作量與資源分配
5. 風險與阻塞追蹤
6. 決策紀錄 / 會議摘要 / 文件連動

這些頁面都應共享同一套視覺秩序，不可各自發明風格。

---

## 17. Anti-Drift Checklist

在 merge 前，請檢查：

- 是否新增了未定義色碼？
- 是否出現紫色或藍紫漸層？
- 是否過度置中？
- 是否出現泡泡按鈕？
- 是否過度依賴 icon 而不是 typography？
- 是否卡片層次太多、太碎？
- 是否畫面吵雜到影響掃描？
- 是否偏離暖紙色 × 深灰文字 × 品牌紅 accent 的基調？

若有任一項為是，請回頭修正。

---

## 18. Decisions Log

| 日期 | 決策 | 理由 |
|------|------|------|
| 2026-04-24 | 採用暖紙色背景與深灰主文字 | 降低專案管理介面的冷硬感，提升長時間使用的舒適度 |
| 2026-04-24 | 採用品牌紅作為 accent，而非藍紫科技色 | 保留編輯感與辨識度，避免落入通用 SaaS 模板風格 |
| 2026-04-24 | Serif 僅用於少量標題，UI 內文維持 sans | 兼顧品牌質感與系統可讀性 |
| 2026-04-24 | 明確禁止 AI slop 式三欄卡片與過度置中 | 防止介面失去操作系統應有的秩序與效率 |

---

## 19. One-Sentence Summary

這不是一個炫技的 PM 工具，而是一個安靜、溫暖、清楚、可信任的專案管理操作系統。
