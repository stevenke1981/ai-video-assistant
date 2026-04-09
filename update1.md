1. 需求確認與真實意圖分析
您希望在現有4 大工作流程 Tab 的基礎上，新增以下三項核心功能：

文字生圖（Text-to-Image）：純文字直接生成高品質圖片 Prompt
上傳圖片生圖（Image-to-Image / Img2Img）：以已上傳圖片為基礎，結合文字描述生成新圖片
上傳圖片生影片（Image-to-Video / Img2Vid）：以已上傳圖片為基礎，生成動態影片

宇宙主腦判斷：這三項功能與原有「分鏡圖片 Prompt → 圖生影片 Prompt」高度互補，能讓工作流程真正實現端到端閉環（故事 → 分鏡 → 圖像生成 → 影片生成）。
這不是單純新增模板，而是工作流程升級，因此我採取漸進整合策略（Reverse Destroyer 建議），避免 v1.0 過度複雜化。

2. 整體架構調整建議（推薦立即採用）
2.1 Tab 結構升級（從 4 Tab → 5 Tab）

維持原有 4 Tab，並新增第 5 Tab，避免破壞現有使用者習慣。
新 Tab 命名：🖼️ 圖像生成（專門處理文字生圖 + 上傳圖片生圖）
Tab 4「🎥 圖生影片」同步強化，增加「上傳圖片生影片」專區。

更新後 Tab 順序：

📖 故事生成
🎬 分鏡腳本
🖼️ 圖像生成 ← 全新 Tab
🎥 圖生影片（強化 Img2Vid）
（原 Tab 3 移至此，或保留為「分鏡圖片 Prompt」子分類）

2.2 工作流程延伸（StoryProject 模型升級）
在原有 StoryProject 中新增兩個階段狀態：
TypeScriptinterface StoryProject {
  // ... 原有欄位
  generatedImages?: GeneratedImage[];   // 新增
  currentImageStage: "text2img" | "img2img" | "none";
  imageReferences?: ImageReference[];   // 上傳圖片參考（URL 或 base64 快取）
}

interface GeneratedImage {
  sceneIndex: number;
  promptType: "text2img" | "img2img";
  prompt: string;
  referenceImageUrl?: string;   // 使用者上傳後的圖片 URL（由聊天平台提供）
  outputUrl?: string;           // AI 生成後的圖片 URL（手動貼入）
  strength?: number;            // Img2Img 強度 0.0~1.0
}

3. 新增功能詳細設計
Tab 3：🖼️ 圖像生成（全新）









































子分類說明模板數目標工具（2026 最新）文字生圖純文字 → 高精度 Prompt15Grok Imagine / Flux / Midjourney v7 / DALL-E 4上傳圖片生圖Img2Img（圖片 + 文字）15Grok Aurora / Kling Image / Runway Img2Img角色一致性固定角色多角度生成8專為動漫 / 真人角色設計風格轉換圖片風格轉移7合計45
代表模板範例（Img2Img）：
text請根據我剛上傳的參考圖片，生成一張新圖片。
要求：{{文字描述}}
風格：{{電影感 / 動漫 / 寫實}}
強度：{{0.75}}（0.0~1.0，越高越接近原圖）
輸出格式：完整英文 Prompt + Negative Prompt + --ar 16:9 --v 7
Tab 4：🎥 圖生影片（強化）
新增「上傳圖片生影片」子分類（10 個模板）：

專門針對 Kling 3.0 Img2Vid、Sora 2 Image-to-Video、Runway Gen-4 Img2Vid、Google Veo 3
模板會自動包含「Reference Image + Motion Description」


4. 技術實現重點（Chrome Extension 限制考量）

上傳圖片處理機制（核心挑戰）：
無法自動上傳（Chrome 安全性限制）。
解決方案：使用者在聊天平台（Grok / Gemini 等）先上傳圖片 → 平台會產生臨時 URL 或直接顯示 → 側邊欄提供「一鍵抓取最新上傳圖片描述」按鈕（透過 DOM 掃描 + Clipboard API）。
模板會自動插入「根據我剛上傳的圖片」或「Reference Image: [URL]」。

平台相容性（2026 最新）：
Grok：原生支援 Image-to-Video 最強（Aurora + Imagine）。
Gemini / ChatGPT：Img2Img 與 Img2Vid 皆優秀。
Claude：較弱，建議提示中明確標註「請忽略此平台限制」。

P0 優先功能（v1.1 必須）：
新 Tab 渲染（複用原有 WorkflowUI）
Img2Img / Img2Vid 專用變數（{{referenceImage}}、{{strength}}、{{motion}}）
「抓取聊天平台上傳圖片」快捷按鈕
跨階段傳遞（圖像生成結果 → 影片 Prompt）



5. 更新後開發 Phase 調整（更務實）
Phase 1（原計畫 + 新 Tab 基礎，7 天）

完成新 Tab UI + 45 個圖像生成模板
StoryProject 模型升級

Phase 2（強化 Img2Vid + 上傳整合，5 天）

Tab 4 強化
圖片抓取功能

Phase 3（測試 + 發布，3 天）

多平台驗證（重點 Grok）