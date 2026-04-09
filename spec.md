# AI Video Production Assistant — 技術規格

## 1. 專案資訊

| 項目 | 內容 |
|------|------|
| 擴充功能 ID | `ai-video-assistant` |
| Manifest 版本 | V3 |
| 最低 Chrome 版本 | 116 |
| 快捷鍵 | `Ctrl+Shift+V` |
| 品牌色 | `#7c3aed` (violet) |
| CSS 前綴 | `aiv-` |

---

## 2. 檔案結構

```
d:\chrome-gen-videos\
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── plan.md
├── spec.md
├── KNOWLEDGE_GRAPH.md
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── scripts/
│   └── gen-icons.mjs
│
├── src/
│   ├── models/
│   │   └── workflow.ts          ← 所有型別 + 常數
│   │
│   ├── adapters/
│   │   ├── base.ts              ← PlatformAdapter interface
│   │   ├── grok.ts
│   │   ├── gemini.ts
│   │   ├── chatgpt.ts
│   │   ├── claude.ts
│   │   └── index.ts             ← detectAdapter()
│   │
│   ├── storage/
│   │   └── workflows.ts         ← chrome.storage CRUD
│   │
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.ts
│   │
│   └── content/
│       ├── sidebar.css          ← 完整樣式
│       ├── workflow-ui.ts       ← WorkflowUI class
│       └── sidebar.ts           ← SidebarController
│
└── templates/
    ├── story.json               ← 10 templates
    ├── storyboard.json          ← 8 templates
    ├── image-gen.json           ← 6 templates
    ├── image-prompt.json        ← 6 templates
    └── video-prompt.json        ← 8 templates
```

---

## 3. 資料模型

### WorkflowTemplate
```typescript
interface WorkflowTemplate {
  id: string;
  name: string;
  stage: TabId;                 // 'story'|'storyboard'|'image-gen'|'image-prompt'|'video-prompt'
  category: string;
  content: string;              // 模板內容，用 {{變數名}} 標記
  variables: Variable[];        // [{name, placeholder}]
  tags: string[];
  targetTools?: string[];       // ['Midjourney', 'Flux', 'Kling', ...]
  isFavorite?: boolean;
  usageCount: number;
  createdAt?: number;
  updatedAt?: number;
}
```

### StoryProject
```typescript
interface StoryProject {
  id: string;
  name: string;
  description: string;
  scenes: Scene[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface Scene {
  id: string;
  title: string;
  description: string;
  duration: number;             // 秒數 (Feature #5)
  imageUrl?: string;
  notes?: string;
}
```

### StylePreset
```typescript
interface StylePreset {
  id: string;
  name: string;
  description: string;
  suffix: string;               // 附加到 Prompt 末尾的風格描述
  isBuiltIn: boolean;
  createdAt: number;
}
```

### PromptHistoryEntry
```typescript
interface PromptHistoryEntry {
  id: string;
  templateId: string;
  templateName: string;
  stage: TabId;
  filledContent: string;        // 完整填入後的 Prompt
  platform: string;
  timestamp: number;
  varValues: Record<string, string>;
}
```

### Settings
```typescript
interface Settings {
  language: 'zh-TW' | 'en';
  theme: 'light' | 'dark' | 'auto';
  shiftBody: boolean;           // 側邊欄開啟時是否推移頁面
  maxHistory: number;           // 最大歷史記錄數 (default: 100)
  defaultBilingual: boolean;
  sidebarWidth: number;         // px (default: 400)
}
```

---

## 4. Storage Keys

| Key | 型別 | 說明 |
|-----|------|------|
| `aiv_templates` | `WorkflowTemplate[]` | 所有模板 (預設 + 使用者自訂) |
| `aiv_categories` | `Category[]` | 所有分類 |
| `aiv_tab_groups` | `TabGroup[]` | Tab 定義 |
| `aiv_projects` | `StoryProject[]` | 製作專案列表 |
| `aiv_active_project` | `string` | 當前活耀專案 ID |
| `aiv_style_presets` | `StylePreset[]` | 風格預設清單 |
| `aiv_history` | `PromptHistoryEntry[]` | 最近 100 筆發送記錄 |
| `aiv_settings` | `Settings` | 使用者設定 |
| `aiv_initialized` | `boolean` | 是否已初始化預設資料 |
| `aiv_var_cache` | `Record<string,string>` | 變數值快取 |

---

## 5. 平台 Adapter API

```typescript
interface PlatformAdapter {
  name: string;
  matches: (url: string) => boolean;
  sendPrompt: (text: string) => Promise<void>;
  getLastImageUrl?: () => string | null;  // Feature #2
}
```

### Adapter 實作細節

| Adapter | `matches()` | `sendPrompt()` 策略 | `getLastImageUrl()` |
|---------|-------------|---------------------|---------------------|
| Grok | `x.com`, `grok.com` | querySelector `textarea`, dispatch Enter | `img[src*="grok"], img[src^="blob:"]`, naturalWidth > 200 |
| Gemini | `gemini.google.com` | `[contenteditable]`, textarea fallback | `img[src*="googleusercontent"]` |
| ChatGPT | `chatgpt.com` | `#prompt-textarea`, Enter key | `img[src*="oaidalleapiprodscus"]` |
| Claude | `claude.ai` | `.ProseMirror`, Shift+Enter | `.artifact img` |

---

## 6. 構建系統

**Entry Points** (esbuild):
- `src/content/sidebar.ts` → `dist/content.js`
- `src/background/service-worker.ts` → `dist/service-worker.js`
- `src/popup/popup.ts` → `dist/popup.js`

**額外輸出**:
- `dist/content.css` — CSS 從 sidebar.css 複製
- `dist/defaults.json` — 5 個 template 檔案的 manifest 清單

**Path Aliases** (tsconfig):
```json
{
  "@models/*": "src/models/*",
  "@storage/*": "src/storage/*",
  "@adapters/*": "src/adapters/*",
  "@content/*": "src/content/*"
}
```

---

## 7. UI 架構

### Shadow DOM 注入
```
document.body
└── #aiv-sidebar-host       (position: fixed, right: 0, z-index: 2147483647)
    └── Shadow Root
        ├── <link> content.css
        └── .aiv-panel
            ├── .aiv-header
            ├── .aiv-project-bar
            ├── .aiv-tab-bar
            └── .aiv-content
                ├── [template view]
                │   ├── .aiv-tool-panel      (Feature #1)
                │   ├── .aiv-filter-bar      (Feature #9)
                │   ├── .aiv-search-box
                │   ├── .aiv-category-bar
                │   ├── .aiv-image-capture   (Feature #2)
                │   └── .aiv-template-grid
                │       └── .aiv-card (×N)
                ├── [detail view]
                │   ├── .aiv-bilingual-row   (Feature #6)
                │   ├── .aiv-var-form
                │   ├── .aiv-preview
                │   ├── .aiv-style-panel     (Features #4, #7)
                │   ├── .aiv-send-bar
                │   └── .aiv-chain-bar       (Feature #3)
                ├── [history view]           (Feature #10)
                └── [project view]           (Feature #5, #8)
```

### 生命週期
1. Content script 載入 → `SidebarController` 立即設定 host element + message listener
2. 首次 `show()` → 注入 Shadow DOM + 建立 `WorkflowUI` (lazy init)
3. `WorkflowUI.init()` → 從 `chrome.storage.local` 載入所有資料
4. `render()` → 完整重新渲染 (每次 state 改變)

---

## 8. 內建風格包 (BUILT_IN_STYLE_PACKS)

| Pack | ID | 附加詞 |
|------|----|--------|
| 吉卜力 | `ghibli` | `Studio Ghibli style, watercolor, soft pastels, Hayao Miyazaki aesthetic` |
| 賽博龐克 | `cyberpunk` | `cyberpunk aesthetic, neon lights, dark city, rain-soaked streets, high contrast` |
| 復古電影 | `retro-film` | `retro film grain, 35mm photography, vintage color grading, cinematic vignette` |
| 電影感 | `cinematic` | `cinematic photography, shallow depth of field, anamorphic lens, Hollywood color grading` |

---

## 9. 訊息傳遞協議

| 訊息 | 方向 | 說明 |
|------|------|------|
| `{ action: 'toggle-sidebar' }` | Background → Content | 快捷鍵觸發 |
| `{ action: 'open-history' }` | Background → Content | 開啟歷史紀錄頁 |
| `{ action: 'toggle-sidebar' }` | Popup → Content | 按鈕觸發 |

---

## 10. 安全性考量

- Shadow DOM 隔離避免頁面 CSS 污染
- 所有 DOM 操作使用 `textContent` / `setAttribute` 避免 XSS
- 圖片 URL 擷取僅讀取已渲染的 `<img>` 元素，不發起額外 HTTP 請求
- 無遠端程式碼執行，所有邏輯在本地執行
- `chrome.storage.local` 存取限於擴充功能本身
