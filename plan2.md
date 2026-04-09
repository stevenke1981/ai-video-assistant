# AI 影片製作助手 — Chrome Extension 計畫書（plan2.md）

> 版本：v1.0  
> 日期：2026-07-19  
> 基礎參考：AI Prompt Sidebar（mychromeext）— 仿照其架構設計  
> 狀態：📋 計畫階段

---

## 1. 產品定位

**AI 影片製作助手**是一個注入 AI 聊天平台（Grok / Gemini / ChatGPT / Claude）的 Chrome 側邊欄工具，協助創作者完成從「靈感 → 故事 → 分鏡腳本 → 圖片 Prompt → 圖生影片 Prompt」的完整影片創作工作流程。

### 目標族群

| 族群 | 需求 |
|------|------|
| YouTube / TikTok 創作者 | 快速生成短影音腳本與分鏡 |
| AI 影片研究者 | 系統化的 Sora / Kling / Runway Prompt 模板 |
| 廣告創意人員 | 品牌廣告腳本 + 分鏡表快速產出 |
| 獨立電影人 | 短片三幕結構 + 場景規劃 |

---

## 2. 核心工作流程

```
[1] 故事生成
    輸入：主題 / 類型 / 時長 / 目標族群
    ↓
[2] 分鏡腳本
    輸入：故事大綱 → 輸出：逐幕分鏡表（場景/角色/對話/攝影）
    ↓
[3] 分鏡圖片 Prompt
    輸入：單幕描述 → 輸出：Midjourney / DALL-E / Flux 可用 Prompt
    ↓
[4] 圖生影片 Prompt
    輸入：圖片描述 + 動態要求 → 輸出：Sora / Kling / Veo / Runway 可用 Prompt
```

每個階段對應一個主分頁（Tab），各分頁提供 20–30 個精選模板。

---

## 3. 架構設計（仿照 mychromeext）

### 3.1 技術棧

| 元件 | 技術 | 說明 |
|------|------|------|
| 擴充框架 | Chrome MV3 | 強制規範 |
| 語言 | TypeScript | 型別安全 |
| 打包 | esbuild | 快速打包 |
| UI | Vanilla DOM + CSS Variables | 無框架，輕量 |
| 儲存 | chrome.storage.local | 離線可用、隱私 |
| 資料格式 | JSON（模板）+ TypeScript 型別 | 同現有架構 |

### 3.2 檔案結構

```
aivideo-ext/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── src/
│   ├── adapters/             ← 平台適配器（複用 mychromeext 設計）
│   │   ├── base.ts
│   │   ├── grok.ts
│   │   ├── gemini.ts
│   │   ├── chatgpt.ts
│   │   └── claude.ts
│   ├── content/
│   │   ├── sidebar.ts        ← 側邊欄注入主入口
│   │   ├── sidebar.css       ← 樣式（同前綴 aps-）
│   │   └── workflow-ui.ts    ← 工作流程 UI 渲染類別（對應 template-ui.ts）
│   ├── background/
│   │   └── service-worker.ts ← 定時任務（可選）
│   ├── models/
│   │   └── workflow.ts       ← WorkflowTemplate、Scene、StoryOutline 型別
│   ├── storage/
│   │   └── workflows.ts      ← CRUD + 工作流程狀態持久化
│   └── popup/
│       ├── popup.html
│       └── popup.ts
├── templates/
│   ├── story.json            ← 故事生成模板（30 個）
│   ├── storyboard.json       ← 分鏡腳本模板（25 個）
│   ├── image-prompt.json     ← 分鏡圖片 Prompt（30 個）
│   └── video-prompt.json     ← 圖生影片 Prompt（30 個）
└── dist/                     ← 建置輸出
```

---

## 4. 資料模型

### 4.1 WorkflowTemplate（對應現有 Template）

```typescript
interface WorkflowTemplate {
  id: string;                   // crypto.randomUUID()
  name: string;                 // 模板名稱，max 200 chars
  stage: "story" | "storyboard" | "image-prompt" | "video-prompt";
  category: string;             // 中文顯示分類名稱
  content: string;              // 提示詞本體，含 {{變數}} 語法
  variables: Variable[];        // 自動從 content 提取
  outputFormat?: string;        // 預期輸出格式說明
  targetTools?: string[];       // 目標 AI 工具（Sora / Kling / Midjourney 等）
  tags?: string[];              // 用於子分組過濾
  isFavorite?: boolean;
  isPinned?: boolean;
  usageCount?: number;
  createdAt: number;
  updatedAt: number;
}

interface Variable {
  name: string;
  placeholder?: string;
  defaultValue?: string;
}
```

### 4.2 StoryProject（跨階段工作流程狀態）

```typescript
interface StoryProject {
  id: string;
  name: string;                 // 專案名稱
  storyOutline?: string;        // [1] 故事大綱輸出
  scenes?: Scene[];             // [2] 分鏡場景列表
  createdAt: number;
  updatedAt: number;
}

interface Scene {
  index: number;                // 場景編號
  description: string;         // 場景文字描述
  imagePrompt?: string;         // [3] 分鏡圖片 Prompt（由使用者生成後貼入）
  videoPrompt?: string;         // [4] 圖生影片 Prompt
  duration?: number;            // 建議時長（秒）
}
```

---

## 5. 主分頁（Tab Groups）設計

### Tab 1：故事生成（📖 Story）

**目的**：將創意想法轉化為完整故事大綱

| 子分類 | 說明 | 模板數 |
|--------|------|--------|
| 短影音 | TikTok / Reels 15-60 秒故事 | 8 |
| 廣告腳本 | 產品廣告、品牌故事 30-90 秒 | 6 |
| 短片 | 5-15 分鐘獨立短片三幕結構 | 6 |
| 紀錄片 | 人物 / 地方 / 事件紀錄敘事 | 5 |
| 懸疑驚悚 | 懸念設計、轉折安排、視覺張力 | 5 |
| **合計** | | **30** |

**代表模板**：
- `三幕結構短片大綱`：`請根據主題「{{主題}}」撰寫一個約 {{時長}} 分鐘的短片三幕結構故事大綱，包含：第一幕（建立、角色介紹、鉤子）、第二幕（衝突、轉捩點）、第三幕（高潮、解決、結尾畫面）。風格：{{風格}}。`
- `TikTok 病毒短影音腳本`：`請為「{{產品/主題}}」撰寫一個 30 秒以內的 TikTok 腳本，包含：開場 3 秒鉤子（Hook）、中間展示（Product/Story）、結尾 CTA。目標族群：{{目標族群}}。`

---

### Tab 2：分鏡腳本（🎬 Storyboard）

**目的**：將故事大綱拆解為可執行的逐幕分鏡表

| 子分類 | 說明 | 模板數 |
|--------|------|--------|
| 標準分鏡表 | 場景/對話/攝影角度/時長格式 | 7 |
| 情緒場景 | 情感敘事、氛圍鏡頭安排 | 5 |
| 動作場景 | 快剪、動態鏡頭、衝突場景 | 5 |
| 商業廣告 | 產品特寫、剪接節奏、配樂建議 | 4 |
| 單場景擴寫 | 針對單一場景深化分鏡細節 | 4 |
| **合計** | | **25** |

**輸出格式範例**：
```
分鏡表 — 場景 N：[場景名稱]

鏡頭 | 時間  | 畫面描述        | 攝影角度  | 對白/旁白     | BGM/音效
 1   | 0-3s  | 主角走進咖啡廳  | Low Angle | （無）        | 環境音
 2   | 3-8s  | 咖啡特寫        | ECU       | 旁白：「...」  | 輕鋼琴
```

**代表模板**：
- `逐幕分鏡表生成`：`請將以下故事大綱：\n\n{{故事大綱}}\n\n拆解成 {{場景數量}} 個場景的分鏡表，每個場景包含：鏡頭編號、時間區間、畫面描述、攝影機角度（ECU/CU/MS/WS/LS/EWS）、對白或旁白、建議 BGM 或音效。`

---

### Tab 3：分鏡圖片 Prompt（🖼️ Image Prompt）

**目的**：將分鏡描述轉換為適合 AI 圖片工具的英文 Prompt

| 子分類 | 說明 | 目標工具 |
|--------|------|---------|
| 電影級場景 | 電影光影、景深、構圖 | Midjourney v7 / Flux |
| 人物肖像 | 角色一致性、表情、服裝 | DALL-E 3 / Flux |
| 環境氛圍 | 場景背景、時間光線、天氣 | Midjourney / SD |
| 動態預覽 | 暗示動態的靜態畫面 | DALL-E / Ideogram |
| 樣式轉換 | 真實 / 動漫 / 油畫 / 賽博龐克 | Midjourney / Flux |
| Prompt 優化 | 補充細節、負面提示詞 | 通用 |
| **合計** | | **30** |

**Prompt 結構範例**：
```
[主題] + [場景細節] + [鏡頭角度], [光線], [色調],
cinematic, [相機型號], [解析度關鍵字], --ar 16:9 --v 7
```

**代表模板**：
- `電影分鏡圖片 Prompt`：`請根據以下分鏡場景描述：「{{場景描述}}」，生成一組英文 Midjourney Prompt，包含：主要畫面描述、攝影構圖（{{攝影角度}}）、光線氛圍（{{光線}}）、畫面色調（{{色調}}）、電影風格後綴（cinematic shot, film grain, --ar 16:9 --v 7）。`

---

### Tab 4：圖生影片 Prompt（🎥 Video Prompt）

**目的**：將靜態圖片描述轉換為 AI 影片工具的動態 Prompt

| 子分類 | 說明 | 目標工具 | 模板數 |
|--------|------|---------|--------|
| Sora 風格 | 流暢物理運動、長鏡頭敘事 | Sora 2 | 6 |
| Kling 風格 | 中文友善、動作流暢 | Kling 3.0 | 5 |
| Runway 風格 | 電影質感、特效合成 | Runway Gen-4 | 5 |
| Veo 風格 | 高解析度、自然光 | Google Veo 3 | 5 |
| 運鏡指令 | Pan / Tilt / Dolly / Zoom 語法 | 通用 | 5 |
| Prompt 工具 | 時長建議、格式轉換 | 通用 | 4 |
| **合計** | | | **30** |

**參數模板範例（Kling）**：
```
[圖片動態描述],
Camera: [運鏡方式],
Motion: [主體動作],
Duration: [3s/5s/10s],
Style: [cinematic/realistic],
Negative: [低品質排除詞]
```

**代表模板**：
- `Kling 圖生影片 Prompt`：`請將以下圖片場景轉換為 Kling AI 可用的影片生成 Prompt：\n場景：{{圖片場景描述}}\n主體動作：{{主體要做什麼}}\n攝影機運鏡：{{運鏡方式}}\n時長：{{影片時長}}\n風格：{{電影感/真實感/夢幻感}}\n輸出格式：英文 Prompt，包含 Negative Prompt。`

---

## 6. UI 設計（仿照 mychromeext）

### 6.1 側邊欄結構

```
┌─────────────────────────────────┐
│  🎬 AI 影片助手    [▶ 工作流] [⚙]│  ← Header
├─────────────────────────────────┤
│  📖 故事  🎬 分鏡  🖼 圖片  🎥 影片 │  ← 主 Tab（4 個）
├─────────────────────────────────┤
│  [全部] [短影音] [廣告] [短片] ... │  ← 子分組 Quick Tag
├─────────────────────────────────┤
│  🔍 搜尋...              N 個模板  │  ← 工具列
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ 模板名稱               ⎘ ▶ │  ← 模板卡片
│  │ 分類標籤                  │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 模板名稱               ⎘ ▶ │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### 6.2 工作流程檢視（跨階段串聯）

點擊 Header 的 `▶ 工作流` 按鈕，展開專案管理面板：

```
┌─────────────────────────────────┐
│  📋 當前專案：{{專案名稱}}        │
│  ──────────────────────────────│
│  [1] 故事 ✅  →  [2] 分鏡 🔄  → │
│  [3] 圖片 ⏳  →  [4] 影片 ⏳    │
│  ──────────────────────────────│
│  📝 故事大綱預覽（可展開）        │
│  🎬 場景列表（N 個場景）         │
└─────────────────────────────────┘
```

### 6.3 從模板輸出到下一階段

詳情頁新增「複製作為下一步輸入」按鈕，允許將當前 AI 輸出貼入下一階段的模板變數：

| 當前階段 | 下一階段 | 傳遞資料 |
|---------|---------|---------|
| 故事生成 | 分鏡腳本 | `storyOutline` → `{{故事大綱}}` 變數 |
| 分鏡腳本 | 分鏡圖片 Prompt | 單場景描述 → `{{場景描述}}` 變數 |
| 分鏡圖片 Prompt | 圖生影片 Prompt | 圖片 Prompt → `{{圖片場景描述}}` 變數 |

---

## 7. 功能規劃

### P0（核心功能，v1.0 必須）

| # | 功能 | 說明 |
|---|------|------|
| 1 | 4 主分頁 + 子分組導航 | 同 mychromeext 架構 |
| 2 | 模板搜尋 + 高亮 | debounce 150ms，`<mark>` 標記 |
| 3 | 變數填入 + 快取 | 同 F15 智慧變數快取 |
| 4 | 一鍵快速複製 ⎘ | 無需展開詳情 |
| 5 | 一鍵直送 ▶ | 使用快取/預設值 |
| 6 | 模板收藏 ⭐ | 個人常用標記 |
| 7 | 排序模式切換 ⇅ | 預設/最新/最常用/名稱 |
| 8 | 分頁模板計數標籤 | 顯示 N 個模板數量 |
| 9 | 模板釘選 📌 | 常用工作流置頂 |
| 10 | 平台適配（Grok/Gemini/ChatGPT/Claude）| 4 平台 setText + submit |

### P1（v1.1 擴充）

| # | 功能 | 說明 |
|---|------|------|
| 11 | StoryProject 管理 | 建立/命名/切換專案，儲存跨階段狀態 |
| 12 | 場景列表 | 在分鏡 tab 記錄場景列表，可個別點選 |
| 13 | 跨階段傳遞 | 「用作下一步輸入」按鈕，自動填入對應變數 |
| 14 | 輸出暫存 | 每次 AI 輸出可手動貼入 + 存至 Scene |
| 15 | 模板匯入/匯出 | JSON 格式，支援分享 |

### P2（v2.0 未來）

| # | 功能 | 說明 |
|---|------|------|
| 16 | 定時自動發送 | 搭配 chrome.alarms |
| 17 | 影片工具快開 | 一鍵開啟 Sora / Kling / Runway 網頁 |
| 18 | 圖片預覽 | 直接在側邊欄顯示已生成圖片（clipboard API） |
| 19 | 批次分鏡生成 | 一次填入 N 個場景，批次複製 Prompt |
| 20 | GPT-4o 直接整合 | 選用 API Key 模式，不需要跳平台 |

---

## 8. 模板規劃（總計 115 個）

| 分頁 | 分類數 | 模板數 | 重點方向 |
|------|--------|--------|---------|
| 故事生成 | 5 | 30 | 短影音 / 廣告 / 短片 / 紀錄 / 懸疑 |
| 分鏡腳本 | 5 | 25 | 標準表格 / 情緒 / 動作 / 廣告 / 單幕擴寫 |
| 分鏡圖片 Prompt | 6 | 30 | 電影 / 人物 / 環境 / 動態 / 樣式 / 優化 |
| 圖生影片 Prompt | 6 | 30 | Sora / Kling / Runway / Veo / 運鏡 / 工具 |
| **合計** | **22** | **115** | |

---

## 9. 與 mychromeext 架構差異

| 項目 | mychromeext | plan2（aivideo-ext） |
|------|-------------|---------------------|
| 主分頁數 | 5 個 | 4 個 |
| 模板總數 | 450+ | 115（v1.0） |
| 核心 UI 類別 | `TemplateUI` | `WorkflowUI` |
| 資料模型 | `Template` | `WorkflowTemplate` + `StoryProject` |
| 跨分頁狀態 | 無 | `StoryProject` 串聯各階段 |
| 子分組 | 3 個分頁（image/video/daily） | 全 4 個分頁皆有 |
| 定時功能 | ✅ 有 | P2（未來） |
| 模板管理頁 | ✅ 有 | P1 追加 |

**可複用的程式碼**（直接 fork）：
- `src/adapters/` — 全部 4 個平台適配器
- `src/utils/` — DOM / toast / events
- `src/storage/templates.ts` — 架構相同，重命名欄位即可
- `src/content/sidebar.css` — CSS Variables + aps- 前綴樣式

---

## 10. 建置與發布計畫

### Phase 1（1 週）：基礎架構

```
✅ manifest.json + esbuild 設定
✅ sidebar 注入 + 4 平台 adapter 複用
✅ WorkflowUI 渲染框架（4 個 Tab + 子分組）
✅ 模板 JSON 初稿（story 30 + storyboard 25）
✅ 基本搜尋 + 變數填入 + 快速複製
```

### Phase 2（3 天）：影片 Prompt 模板 + P0 功能

```
✅ image-prompt.json 30 個模板
✅ video-prompt.json 30 個模板（Sora/Kling/Runway/Veo 分類）
✅ 排序切換 + 分頁計數 + 搜尋高亮
✅ 一鍵直送 ▶ + 變數快取（F15 邏輯移植）
```

### Phase 3（2 天）：QA + 打包

```
✅ 4 個平台 dom adapter 驗證（Grok / Gemini / ChatGPT / Claude）
✅ Jest 單元測試（fillTemplate / variable parsing / storage）
✅ Build 驗證 → dist/
✅ Chrome Web Store 打包（icons + privacy policy）
```

### Phase 4：P1 追加（v1.1）

```
⏳ StoryProject 管理介面
⏳ 跨階段傳遞按鈕
⏳ 模板匯入匯出
```

---

## 11. 建置指令（規劃）

```bash
# 安裝依賴
npm install

# 開發模式
npm run dev

# 生產模式
npm run build     # → dist/

# 測試
npm test

# Chrome 載入
# 1. chrome://extensions
# 2. 開發者模式 → 載入未封裝擴充功能
# 3. 選擇 dist/
```

---

*計畫書結束 — 等待使用者確認後進入 Phase 1 實作*
