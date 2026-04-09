/**
 * Core data models for AI 影片製作助手
 */

// ── Variable Extraction ─────────────────────────────────────────────────────

export interface Variable {
  name: string;
  placeholder?: string;
  defaultValue?: string;
}

/** Extract {{variable}} placeholders from template content */
export function extractVariables(content: string): Variable[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const seen = new Set<string>();
  const vars: Variable[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1].trim();
    if (!seen.has(name)) {
      seen.add(name);
      vars.push({ name, placeholder: "", defaultValue: "" });
    }
  }
  return vars;
}

/** Replace {{variable}} with actual values */
export function fillTemplate(
  content: string,
  values: Record<string, string>
): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    return values[trimmed] ?? `{{${trimmed}}}`;
  });
}

// ── Stage Types ─────────────────────────────────────────────────────────────

export type WorkflowStage =
  | "story"
  | "storyboard"
  | "image-gen"
  | "image-prompt"
  | "video-prompt";

export type ImageGenMode = "text2img" | "img2img" | "none";

// ── Template Model ──────────────────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  stage: WorkflowStage;
  category: string;
  content: string;
  variables: Variable[];
  outputFormat?: string;
  /** Target AI tools: Sora / Kling / Runway / Veo / Midjourney / Flux / Grok */
  targetTools?: string[];
  tags?: string[];
  isFavorite?: boolean;
  isPinned?: boolean;
  usageCount?: number;
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ── Style Preset ────────────────────────────────────────────────────────────

/** Feature #4: Style Preset Manager */
export interface StylePreset {
  id: string;
  name: string;
  packName?: string; // e.g. "Ghibli", "Cyberpunk"
  lighting: string;
  colorGrade: string;
  cameraStyle: string;
  mood: string;
  negativePrompt?: string;
  extraTags?: string;
  createdAt: number;
}

// ── Scene / Project ─────────────────────────────────────────────────────────

export interface Scene {
  index: number;
  description: string;
  imagePrompt?: string;
  imageGenPrompt?: string; // from image-gen tab
  videoPrompt?: string;
  duration?: number; // seconds
  referenceImageUrl?: string; // for img2img/img2vid
  generatedImageUrl?: string; // output URL from AI tool (manually pasted)
  targetTool?: string; // Which AI tool to use for this scene
  stylePresetId?: string; // linked StylePreset
  notes?: string;
}

export interface GeneratedImage {
  sceneIndex: number;
  promptType: ImageGenMode;
  prompt: string;
  referenceImageUrl?: string;
  outputUrl?: string;
  strength?: number; // img2img strength 0.0~1.0
  createdAt: number;
}

export interface StoryProject {
  id: string;
  name: string;
  storyOutline?: string;
  scenes?: Scene[];
  generatedImages?: GeneratedImage[];
  currentImageStage: ImageGenMode;
  imageReferences?: ImageReference[];
  totalDuration?: number; // computed
  targetStyle?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ImageReference {
  id: string;
  url: string;
  capturedAt: number;
  platform: string;
  label?: string;
}

// ── History ─────────────────────────────────────────────────────────────────

/** Feature #10: Prompt History */
export interface PromptHistoryEntry {
  id: string;
  templateId: string;
  templateName: string;
  stage: WorkflowStage;
  content: string;
  sentAt: number;
  platform: string;
}

// ── Tab / Category ──────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
}

export interface TabGroup {
  id: string;
  name: string;
  icon: string;
  file: string;
  order: number;
}

export interface DefaultsManifest {
  files: string[];
  tabGroups: TabGroup[];
}

export interface TemplateFile {
  categories: Category[];
  templates: Omit<WorkflowTemplate, "id" | "createdAt" | "updatedAt">[];
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface Settings {
  sidebarWidth: number;
  autoShow: boolean;
  theme: "auto" | "light" | "dark";
  defaultBilingualMode: boolean; // Feature #6
  lastActiveTab: WorkflowStage;
  activeProjectId?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  sidebarWidth: 360,
  autoShow: true,
  theme: "auto",
  defaultBilingualMode: false,
  lastActiveTab: "story",
};

// ── Platform Quick-Launch URLs (Feature #1) ─────────────────────────────────

export interface VideoTool {
  id: string;
  name: string;
  url: string;
  icon: string;
  category: "video" | "image" | "both";
  stage: WorkflowStage;
}

export const VIDEO_TOOLS: VideoTool[] = [
  { id: "kling", name: "Kling", url: "https://klingai.com/", icon: "🎞", category: "both", stage: "video-prompt" },
  { id: "sora", name: "Sora", url: "https://sora.com/", icon: "🌀", category: "video", stage: "video-prompt" },
  { id: "runway", name: "Runway", url: "https://runwayml.com/", icon: "✈️", category: "video", stage: "video-prompt" },
  { id: "veo", name: "Veo 3", url: "https://labs.google/fx/tools/video-fx", icon: "🎬", category: "video", stage: "video-prompt" },
  { id: "midjourney", name: "Midjourney", url: "https://www.midjourney.com/", icon: "🎨", category: "image", stage: "image-prompt" },
  { id: "flux", name: "Flux", url: "https://blackforestlabs.ai/", icon: "⚡", category: "image", stage: "image-prompt" },
  { id: "grok-img", name: "Grok Imagine", url: "https://grok.com/", icon: "🔮", category: "both", stage: "image-gen" },
];

// ── Style Packs (Feature #7) ────────────────────────────────────────────────

export interface StylePack {
  id: string;
  name: string;
  icon: string;
  description: string;
  presets: StylePreset[];
}

export const BUILT_IN_STYLE_PACKS: StylePack[] = [
  {
    id: "ghibli",
    name: "吉卜力風",
    icon: "🌿",
    description: "宮崎駿動畫風格，自然柔和色彩",
    presets: [
      {
        id: "ghibli-day",
        name: "吉卜力日景",
        packName: "Ghibli",
        lighting: "soft natural daylight, golden hour",
        colorGrade: "warm greens and blues, painterly",
        cameraStyle: "wide establishing shot, gentle camera movement",
        mood: "peaceful, nostalgic, wonder",
        negativePrompt: "dark, gritty, photorealistic, 3D render",
        extraTags: "Studio Ghibli style, anime, hand-drawn, whimsical",
        createdAt: 0,
      },
    ],
  },
  {
    id: "cyberpunk",
    name: "賽博龐克",
    icon: "🌆",
    description: "霓虹燈、高科技、反烏托邦未來感",
    presets: [
      {
        id: "cyberpunk-night",
        name: "賽博龐克夜城",
        packName: "Cyberpunk",
        lighting: "neon lights, rain reflections, high contrast",
        colorGrade: "cyan and magenta, dark shadows",
        cameraStyle: "low angle, dutch tilt, rack focus",
        mood: "dystopian, intense, electrifying",
        negativePrompt: "daylight, natural, cheerful, low-tech",
        extraTags: "cyberpunk, neon, futuristic, rain, blade runner",
        createdAt: 0,
      },
    ],
  },
  {
    id: "retro-film",
    name: "復古膠片",
    icon: "🎞",
    description: "70-80年代電影感，膠片顆粒效果",
    presets: [
      {
        id: "retro-70s",
        name: "70年代膠片",
        packName: "Retro Film",
        lighting: "soft diffused, film grain, lens flare",
        colorGrade: "warm amber, faded highlights, analog",
        cameraStyle: "handheld, zoom lens, shallow depth",
        mood: "nostalgic, warm, cinematic",
        negativePrompt: "digital, sharp, modern, 4K",
        extraTags: "film grain, 35mm, vintage, analog photography",
        createdAt: 0,
      },
    ],
  },
  {
    id: "cinematic",
    name: "電影大片",
    icon: "🎥",
    description: "好萊塢大片質感，攝影師級構圖",
    presets: [
      {
        id: "cinematic-epic",
        name: "史詩電影感",
        packName: "Cinematic",
        lighting: "dramatic side lighting, volumetric, IMAX",
        colorGrade: "teal and orange, high contrast, cinematic",
        cameraStyle: "dolly zoom, tracking shot, anamorphic lens",
        mood: "epic, dramatic, intense",
        negativePrompt: "amateur, flat lighting, selfie, snapshot",
        extraTags: "cinematic, epic, IMAX, golden ratio composition",
        createdAt: 0,
      },
    ],
  },
];
