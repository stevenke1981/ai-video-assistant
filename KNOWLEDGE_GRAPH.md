# AI Video Production Assistant — 知識圖譜

## 系統概覽

```
                        ┌─────────────────────────────────┐
                        │   AI Video Production Assistant  │
                        │      Chrome Extension (MV3)      │
                        └────────────────┬────────────────┘
                                         │
              ┌──────────────────────────┼───────────────────────────┐
              │                          │                           │
    ┌─────────▼────────┐      ┌─────────▼────────┐      ┌──────────▼────────┐
    │  Content Script  │      │  Service Worker  │      │      Popup         │
    │  (sidebar.ts)    │      │(service-worker)  │      │   (popup.ts)       │
    └─────────┬────────┘      └────────┬─────────┘      └─────────┬─────────┘
              │                        │                           │
              │ Shadow DOM             │ chrome.runtime            │ sendMessage
              │                        │                           │
    ┌─────────▼────────┐      ┌────────▼──────────────────────────▼─┐
    │   WorkflowUI     │      │         chrome.storage.local         │
    │ (workflow-ui.ts) │◄─────┤  aiv_templates, aiv_projects, etc.  │
    └─────────┬────────┘      └──────────────────────────────────────┘
              │
    ┌─────────▼──────────────────────────────────────────────────────┐
    │                    Platform Adapters                            │
    │  GrokAdapter | GeminiAdapter | ChatGPTAdapter | ClaudeAdapter   │
    └────────────────────────────────────────────────────────────────┘
```

---

## 模組依賴圖

```
src/models/workflow.ts
    ▲         ▲         ▲         ▲
    │         │         │         │
src/adapters/ src/storage/ src/content/ src/background/
    │             │           │               │
    └─────────────┴───────────┘               │
                  │                           │
           workflow-ui.ts               service-worker.ts
                  │
           sidebar.ts (entry)
```

---

## 核心類別關係

### SidebarController (sidebar.ts)
```
SidebarController
├── host: HTMLElement              (fixed position host)
├── shadowRoot: ShadowRoot         (style isolation)
├── ui: WorkflowUI | null          (lazy initialized)
├── adapter: PlatformAdapter       (current page adapter)
│
├── init()                         → sets up host, message listener, keyboard shortcut
├── show() / hide() / toggle()     → animation via CSS transition
├── show() → new WorkflowUI(...)   → lazy initialization on first open
│
└── callbacks: UICallbacks
    ├── onSendToAI(text)           → adapter.sendPrompt(text)
    ├── onCaptureImage()           → adapter.getLastImageUrl()
    ├── onExportProject(project)   → JSON blob download
    └── onClose()                  → this.hide()
```

### WorkflowUI (workflow-ui.ts)
```
WorkflowUI
├── State
│   ├── activeTab: TabId           ('story' | 'storyboard' | ...)
│   ├── activeCategory: string
│   ├── searchQuery: string
│   ├── activeToolFilter: string   (Feature #9)
│   ├── bilingualMode: boolean     (Feature #6)
│   ├── selectedTemplate: WorkflowTemplate | null
│   ├── varValues: Record<string, string>
│   ├── capturedImageUrl: string   (Feature #2)
│   ├── activeProject: StoryProject | null
│   └── platform: string
│
├── Data (loaded from storage)
│   ├── templates: WorkflowTemplate[]
│   ├── categories: Category[]
│   ├── tabGroups: TabGroup[]
│   ├── stylePresets: StylePreset[]
│   └── history: PromptHistoryEntry[]
│
└── View Methods (pure DOM builders)
    ├── render()                   → full repaint
    ├── buildHeader()
    ├── buildProjectBar()          → Feature #8 export button
    ├── buildTabBar()
    ├── buildTemplateView()        → assembles all sub-panels
    │   ├── buildVideoToolsPanel() → Feature #1
    │   ├── buildToolFilterBar()   → Feature #9
    │   ├── buildSearchBox()
    │   ├── buildCategoryBar()
    │   ├── buildImageCapturePanel()→ Feature #2
    │   └── buildCard(tpl)
    ├── buildDetailView()
    │   ├── buildBilingualRow()    → Feature #6
    │   ├── buildStyleSelector()   → Features #4, #7
    │   └── buildChainBar()        → Feature #3
    ├── buildHistoryView()         → Feature #10
    └── buildProjectView()         → Feature #5
```

---

## 資料流程圖

### Prompt 發送流程
```
使用者在 WorkflowUI 填入變數
        │
        ▼
getFilledContent()
├── fillTemplate(tpl.content, varValues)    → 替換 {{變數}}
├── bilingualMode ? append "請同時提供英文版本" : 無
└── hasStyle ? append style.suffix : 無
        │
        ▼
callbacks.onSendToAI(filledContent)
        │
        ▼
SidebarController
        │
        ▼
adapter.sendPrompt(text)            → 注入文字到 AI 平台輸入框
        │
        ├──→ addToHistory(entry)     → chrome.storage aiv_history (max 100)
        ├──→ incrementUsage(tplId)   → usageCount + 1
        └──→ saveVarCache(vars)      → aiv_var_cache (自動補全下次用)
```

### 圖片捕獲流程 (Feature #2)
```
使用者點擊「捕獲圖片」
        │
        ▼
callbacks.onCaptureImage()
        │
        ▼
adapter.getLastImageUrl()
        │
        ├── Grok:    querySelectorAll('img[src*="grok"], img[src^="blob:"]')
        │            filter: naturalWidth > 200, 取最後一個
        ├── Gemini:  querySelectorAll('img[src*="googleusercontent"]')
        ├── ChatGPT: querySelectorAll('img[src*="oaidalleapiprodscus"]')
        └── Claude:  querySelectorAll('.artifact img')
        │
        ▼
WorkflowUI.capturedImageUrl = url
render() → buildImageCapturePanel() 顯示縮圖
```

---

## 模板系統

### 模板生命週期
```
JSON 檔案                 Storage               UI
─────────────────────────────────────────────────────────
templates/*.json
        │
        ▼
  initDefaults(url)
  (首次安裝時)
        │
   fetch(url)
        ▼
  chrome.storage.local
    aiv_templates[]
        │
        ▼ WorkflowUI.init()
  載入到記憶體
        │
        ▼
  filterTemplates()     ← searchQuery + activeTab + activeToolFilter
        │
        ▼
  buildCard(tpl)         → 顯示在 UI
        │
使用者點擊模板
        ▼
  selectedTemplate = tpl
  render() → buildDetailView()
        │
使用者填寫變數並送出
        ▼
  getFilledContent() → sendPrompt()
```

### 變數提取
```typescript
// 從模板內容中提取 {{變數名}}
extractVariables(content: string): string[]
// 例: "{{主角}} 在 {{場景}}" → ["主角", "場景"]

// 填入變數值
fillTemplate(content: string, values: Record<string, string>): string
// 例: filled = "英雄 在 戰場"
```

---

## 風格系統 (Features #4 & #7)

```
風格選擇器 (StyleSelector)
        │
        ├── 內建風格包 (BUILT_IN_STYLE_PACKS)
        │   ├── 吉卜力  → suffix: "Studio Ghibli style, watercolor..."
        │   ├── 賽博龐克 → suffix: "cyberpunk aesthetic, neon lights..."
        │   ├── 復古電影 → suffix: "retro film grain, 35mm photography..."
        │   └── 電影感  → suffix: "cinematic photography, shallow depth..."
        │
        └── 使用者自訂 (StylePreset[])
            └── chrome.storage aiv_style_presets
                    │
                    ▼
        getFilledContent() 時追加至 Prompt 末尾
```

---

## 跨階段流程 (Feature #3)

```
STAGE_ORDER = ['story', 'storyboard', 'image-gen', 'image-prompt', 'video-prompt']

完成 story 階段發送
        │
        ▼
buildChainBar(nextStage='storyboard')
顯示「前往下一步：分鏡設計 →」按鈕
        │
點擊
        ▼
activeTab = 'storyboard'
render() → 切換 Tab
```

---

## 訊息傳遞架構

```
Keyboard: Ctrl+Shift+V
        │
        ▼
chrome.commands API
        │
        ▼
Service Worker
  onCommand('toggle-sidebar')
        │
        ▼
chrome.tabs.sendMessage(tabId, { action: 'toggle-sidebar' })
        │
        ▼
Content Script
  chrome.runtime.onMessage listener
        │
  SidebarController.toggle()
```

---

## 安全邊界

```
頁面 DOM
    │ (無法穿透)
    │ ════════════════ Shadow DOM 邊界 ════════════════
    │
    ▼
Shadow Root (#aiv-sidebar-host)
    │
    ├── 所有 UI 元素 (隔離於頁面 CSS 之外)
    │
    └── WorkflowUI
            │
            └── DOM 操作安全規則:
                ✅ textContent (純文字)
                ✅ setAttribute (受信任屬性)
                ❌ innerHTML (不使用，避免 XSS)

外部資源存取:
✅ chrome.storage.local (本地)
✅ fetch(chrome.runtime.getURL) (擴充功能內部資源)
❌ 遠端 API 呼叫 (無)
❌ eval() (無)
```

---

## 效能考量

| 策略 | 說明 |
|------|------|
| Lazy Init | WorkflowUI 僅在首次 `show()` 時建立 |
| Storage Cache | varCache 記住變數值，下次開啟自動填入 |
| Template Filtering | 記憶體內過濾，無需重新從 storage 讀取 |
| Shadow DOM | 避免與頁面 CSS 計算互相干擾 |
| esbuild | 構建速度快，輸出精簡 |
