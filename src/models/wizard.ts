/**
 * AI Wizard Mode — data models and prompt builders
 */

export type WizardStageId =
  | "story"
  | "storyboard"
  | "image-gen"
  | "image-prompt"
  | "video-prompt";

export interface WizardStageResult {
  generatedContent: string;  // Raw API output
  finalContent: string;      // After user edits
  completed: boolean;
  generatedAt?: number;
}

export interface WizardSetup {
  projectName: string;
  initialIdea: string;
  targetStyle: string;
  targetPlatforms: string;
  imageTool: string;
  videoTool: string;
}

export interface WizardSession {
  id: string;
  setup: WizardSetup;
  currentStage: WizardStageId | "setup" | "complete";
  stages: Partial<Record<WizardStageId, WizardStageResult>>;
  createdAt: number;
  updatedAt: number;
}

export const WIZARD_STAGE_ORDER: WizardStageId[] = [
  "story",
  "storyboard",
  "image-gen",
  "image-prompt",
  "video-prompt",
];

export const WIZARD_STAGE_META: Record<WizardStageId, { icon: string; name: string; desc: string }> = {
  "story":        { icon: "📖", name: "故事大綱",     desc: "建立角色、情節與世界觀" },
  "storyboard":   { icon: "🎞", name: "分鏡腳本",     desc: "場景切分、鏡頭描述、時長規劃" },
  "image-gen":    { icon: "🖼", name: "圖像生成提示", desc: "每個場景的圖像生成指令" },
  "image-prompt": { icon: "🎨", name: "圖像 Prompt",  desc: "工具專用的最終圖像提示詞" },
  "video-prompt": { icon: "🎬", name: "影片 Prompt",  desc: "各場景的影片生成指令" },
};

// ── Prompt Builders ──────────────────────────────────────────────────────────

export function buildStoryPrompt(setup: WizardSetup): string {
  return `根據以下創作需求，生成一個完整的短影片故事大綱。

**主題 / 初始想法：** ${setup.initialIdea}
**目標風格：** ${setup.targetStyle}
**目標平台：** ${setup.targetPlatforms}

請嚴格依照以下格式完整輸出（不可省略任何段落）：

# 故事標題
[片名]

# 核心概念
[一句話說明故事精髓，50字以內]

# 主要角色
[列出2-4個角色，每個包含：姓名、年齡性別、外貌特徵、個性特質]

# 故事結構
## 開場（0-20%）
[畫面、情境、氛圍描述]
## 發展（20-60%）
[衝突、轉折點描述]
## 高潮（60-85%）
[最強烈的情緒點]
## 結局（85-100%）
[收尾、情感落點]

# 情感基調
[關鍵詞：例如 溫暖、懸疑、熱血...]

# 預計時長
[X分X秒]`;
}

export function buildStoryboardPrompt(setup: WizardSetup, storyContent: string): string {
  return `根據以下故事大綱，生成詳細的分鏡腳本。

**故事大綱：**
${storyContent}

**風格：** ${setup.targetStyle}
**平台：** ${setup.targetPlatforms}

請嚴格依照以下表格格式，為每個場景完整輸出（至少6個場景，不可省略任何欄位）：

| 場景 | 時長 | 鏡頭類型 | 畫面描述 | 人物動作 | 對話／旁白 | 情緒氛圍 |
|------|------|----------|----------|----------|------------|----------|
[填入每個場景的詳細資訊]

表格之後，額外輸出：
# 音樂建議
[整體配樂風格、節奏建議]

# 剪輯節奏
[快剪／慢節奏／混合，說明理由]`;
}

export function buildImageGenPrompt(setup: WizardSetup, storyboardContent: string): string {
  return `根據以下分鏡腳本，為每個關鍵場景生成圖像生成提示詞。

**分鏡腳本：**
${storyboardContent}

**藝術風格：** ${setup.targetStyle}
**圖像工具：** ${setup.imageTool}

請嚴格依照以下格式，為每個場景輸出圖像生成提示詞（不可省略任何場景）：

## 場景 1
**畫面描述：** [具體的視覺元素]
**主體：** [人物或物件描述]
**環境：** [背景、場所、時間]
**光線：** [光線類型、方向、強度]
**色調：** [整體色彩風格]
**鏡頭：** [焦距、角度、景深]
**風格關鍵詞：** [適合${setup.imageTool}的風格標籤]

[依此格式繼續輸出所有場景]`;
}

export function buildImagePromptOptimize(setup: WizardSetup, imageGenContent: string): string {
  return `將以下圖像生成需求，優化為 ${setup.imageTool} 的專用提示詞格式。

**圖像生成描述：**
${imageGenContent}

**目標工具：** ${setup.imageTool}
**整體風格：** ${setup.targetStyle}

請嚴格依照以下格式，為每個場景輸出最終優化後的提示詞：

## 場景 1
**正向提示詞（英文）：**
\`\`\`
[完整的英文提示詞，包含風格、光線、相機、品質標籤]
\`\`\`
**負向提示詞（英文）：**
\`\`\`
[negative prompt]
\`\`\`
**參數建議：** [寬高比、風格化數值等]

[依此格式繼續輸出所有場景]`;
}

export function buildVideoPrompt(setup: WizardSetup, storyboardContent: string, imagePromptContent: string): string {
  return `根據以下完整素材，為每個場景生成影片生成提示詞。

**分鏡腳本摘要：**
${storyboardContent.substring(0, 1500)}

**圖像 Prompt 參考：**
${imagePromptContent.substring(0, 1000)}

**影片工具：** ${setup.videoTool}
**整體風格：** ${setup.targetStyle}

請嚴格依照以下格式，為每個場景輸出影片生成提示詞：

## 場景 1
**影片提示詞（英文）：**
\`\`\`
[完整的影片生成提示詞]
\`\`\`
**鏡頭運動：** [推、拉、搖、移、跟、靜止]
**過渡效果：** [與下一場景的銜接方式]
**時長：** [秒數]
**聲音建議：** [音效、配樂]

[依此格式繼續輸出所有場景]

---
# 完整影片 Prompt（整合版）
[將所有場景合併為一個連貫的影片生成描述]`;
}
