# AI Video Production Assistant — 專案計劃

## 專案概述

**名稱**: AI Video Production Assistant (ai-video-assistant)  
**類型**: Chrome Extension (Manifest V3)  
**目標**: 在 Grok / Gemini / ChatGPT / Claude 等 AI 平台注入側邊欄，提供完整的影片製作 Prompt 工作流程

---

## 核心功能

### 5 個製作階段 (Tab)

| 順序 | Tab ID | 名稱 | 說明 |
|------|--------|------|------|
| 1 | `story` | 故事腳本 | 世界觀、角色、衝突、主題、三幕結構 |
| 2 | `storyboard` | 分鏡設計 | 場景、鏡頭語言、轉場、蒙太奇 |
| 3 | `image-gen` | 圖像生成 | 角色一致性、場景生成、風格包、縮圖 |
| 4 | `image-prompt` | 圖像提示詞 | Midjourney、Flux、DALL-E、Grok Aurora |
| 5 | `video-prompt` | 影片提示詞 | 鏡頭動作、Kling AI、Runway Gen-3、Sora |

---

## 10 項新增實用功能

| # | 功能名稱 | 說明 | UI 元素 |
|---|---------|------|---------|
| 1 | **Platform Quick-Launch** | 依當前 Tab 顯示可用 AI 工具快捷入口 | `.aiv-tool-panel` |
| 2 | **Image URL Capture** | 自動從 AI 平台捕獲最後生成的圖片 URL | `.aiv-image-capture` |
| 3 | **Cross-Stage Pipeline** | 完成當前階段後一鍵跳轉下一製作階段 | `.aiv-chain-bar` |
| 4 | **Style Preset Manager** | 儲存、選取、套用自訂風格預設 | `.aiv-style-panel` |
| 5 | **Scene Duration Tracker** | 在專案場景中追蹤每個場景時長 | `.aiv-scene-list` |
| 6 | **Bilingual Prompt Toggle** | 一鍵在 Prompt 末尾追加英文翻譯需求 | `.aiv-bilingual-row` |
| 7 | **Style Collection Packs** | 內建 4 大風格包：Ghibli / Cyberpunk / 復古電影 / 電影感 | `.aiv-style-select` optgroups |
| 8 | **Project Export** | 將整個製作專案匯出為 JSON 備份 | `.aiv-export-bar` |
| 9 | **Smart Tool Filter** | 依目標工具 (Midjourney、Flux、Kling…) 篩選模板 | `.aiv-filter-chip` |
| 10 | **Prompt History & Replay** | 記錄最近 100 條已傳送的 Prompt，支援重播 | `.aiv-history-list` |

---

## 支援平台

| 平台 | 網域 | Adapter | Image Capture |
|------|------|---------|---------------|
| Grok | x.com, grok.com | `grok.ts` | `img[src*="grok"]`, blob URL, naturalWidth > 200 |
| Gemini | gemini.google.com | `gemini.ts` | `img[src*="googleusercontent"]` |
| ChatGPT | chatgpt.com | `chatgpt.ts` | `img[src*="oaidalleapiprodscus"]` |
| Claude | claude.ai | `claude.ts` | `.artifact img` |

---

## 技術架構

```
Chrome MV3 Extension
├── Content Script     → SidebarController (Shadow DOM)
│   └── WorkflowUI     → 5 Tab 模板系統 + 10 功能
├── Service Worker     → toggle-sidebar 指令路由
├── Popup              → 快速開啟 + 平台說明
└── Storage            → chrome.storage.local (aiv_ 前綴)
```

### 技術棧
- **語言**: TypeScript 5.7 (strict mode)
- **打包**: esbuild 0.24 (3 entry points)
- **樣式**: Vanilla CSS Variables, Shadow DOM 隔離
- **品牌色**: `#7c3aed` (violet)
- **快捷鍵**: `Ctrl+Shift+V`

---

## 開發進度

### ✅ 完成項目 (26/26)

**基礎配置**
- [x] `manifest.json` — Chrome MV3 manifest
- [x] `package.json` — npm 配置
- [x] `tsconfig.json` — TypeScript 配置
- [x] `esbuild.config.mjs` — 構建系統

**資料模型**
- [x] `src/models/workflow.ts` — 所有型別定義 + 常數

**平台 Adapters**
- [x] `src/adapters/base.ts`
- [x] `src/adapters/grok.ts`
- [x] `src/adapters/gemini.ts`
- [x] `src/adapters/chatgpt.ts`
- [x] `src/adapters/claude.ts`
- [x] `src/adapters/index.ts`

**Extension 核心**
- [x] `src/storage/workflows.ts` — 完整 CRUD
- [x] `src/background/service-worker.ts`
- [x] `src/popup/popup.html`
- [x] `src/popup/popup.ts`

**UI 系統**
- [x] `src/content/sidebar.css` — 500+ 行完整樣式
- [x] `src/content/workflow-ui.ts` — WorkflowUI 引擎
- [x] `src/content/sidebar.ts` — SidebarController

**模板資料**
- [x] `templates/story.json` — 10 個故事模板
- [x] `templates/storyboard.json` — 8 個分鏡模板
- [x] `templates/image-gen.json` — 6 個圖像生成模板
- [x] `templates/image-prompt.json` — 6 個圖像提示詞模板
- [x] `templates/video-prompt.json` — 8 個影片提示詞模板

**資源**
- [x] `icons/icon16.png`
- [x] `icons/icon48.png`
- [x] `icons/icon128.png`
- [x] `scripts/gen-icons.mjs`

**文件**
- [x] `plan.md`
- [x] `spec.md`
- [x] `KNOWLEDGE_GRAPH.md`

---

## 部署流程

```bash
# 1. 安裝依賴
npm install

# 2. 構建
npm run build

# 3. 載入擴充功能 (Chrome)
# chrome://extensions → 開發者模式 → 載入已解壓縮

# 4. 推送 GitHub
git push -u origin main
```
