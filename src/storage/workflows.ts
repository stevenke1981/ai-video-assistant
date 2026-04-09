/**
 * Storage layer for AI 影片製作助手
 * Uses chrome.storage.local for offline availability and privacy.
 */

import {
  WorkflowTemplate,
  StoryProject,
  StylePreset,
  PromptHistoryEntry,
  Settings,
  DEFAULT_SETTINGS,
  Category,
  TabGroup,
  DefaultsManifest,
  TemplateFile,
  extractVariables,
  ApiConfig,
  ApiHistoryEntry,
  DEFAULT_API_CONFIG,
  ApiProvider,
} from "../models/workflow";

// ── Storage Keys ─────────────────────────────────────────────────────────────

const KEYS = {
  TEMPLATES: "aiv_templates",
  CATEGORIES: "aiv_categories",
  TAB_GROUPS: "aiv_tab_groups",
  PROJECTS: "aiv_projects",
  ACTIVE_PROJECT: "aiv_active_project",
  STYLE_PRESETS: "aiv_style_presets",
  HISTORY: "aiv_history",
  SETTINGS: "aiv_settings",
  INITIALIZED: "aiv_initialized",
  VAR_CACHE: "aiv_var_cache",
  API_CONFIG: "aiv_api_config",
  API_HISTORY: "aiv_api_history",
} as const;

const MAX_HISTORY = 100;

// ── Helpers ──────────────────────────────────────────────────────────────────

function get<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result[key] as T));
  });
}

function set(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

// ── Defaults Initialisation ──────────────────────────────────────────────────

export async function initDefaults(defaultsUrl: string): Promise<void> {
  const alreadyInit = await get<boolean>(KEYS.INITIALIZED);
  if (alreadyInit) return;

  try {
    const res = await fetch(defaultsUrl);
    const manifest: DefaultsManifest = await res.json();

    const allTemplates: WorkflowTemplate[] = [];
    const allCategories: Category[] = [];

    for (const file of manifest.files) {
      try {
        const fileUrl = defaultsUrl.replace("defaults.json", `templates/${file}`);
        const fileRes = await fetch(fileUrl);
        const fileData: TemplateFile = await fileRes.json();

        allCategories.push(...(fileData.categories ?? []));

        for (const tpl of fileData.templates) {
          const now = Date.now();
          allTemplates.push({
            ...tpl,
            id: crypto.randomUUID(),
            variables: extractVariables(tpl.content),
            createdAt: now,
            updatedAt: now,
          });
        }
      } catch (e) {
        console.warn(`[aivideo] Failed to load template file: ${file}`, e);
      }
    }

    await Promise.all([
      set(KEYS.TEMPLATES, allTemplates),
      set(KEYS.CATEGORIES, allCategories),
      set(KEYS.TAB_GROUPS, manifest.tabGroups),
      set(KEYS.INITIALIZED, true),
    ]);
  } catch (e) {
    console.error("[aivideo] initDefaults failed:", e);
  }
}

// ── Templates CRUD ────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<WorkflowTemplate[]> {
  return (await get<WorkflowTemplate[]>(KEYS.TEMPLATES)) ?? [];
}

export async function saveTemplates(templates: WorkflowTemplate[]): Promise<void> {
  await set(KEYS.TEMPLATES, templates);
}

export async function addTemplate(
  data: Omit<WorkflowTemplate, "id" | "createdAt" | "updatedAt">
): Promise<WorkflowTemplate> {
  const templates = await getTemplates();
  const now = Date.now();
  const tpl: WorkflowTemplate = {
    ...data,
    variables: extractVariables(data.content),
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  templates.push(tpl);
  await saveTemplates(templates);
  return tpl;
}

export async function updateTemplate(
  id: string,
  updates: Partial<WorkflowTemplate>
): Promise<void> {
  const templates = await getTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const current = templates[idx];
  if (!current) return;
  if (updates.content) updates.variables = extractVariables(updates.content);
  templates[idx] = { ...current, ...updates, updatedAt: Date.now() };
  await saveTemplates(templates);
}

export async function deleteTemplate(id: string): Promise<void> {
  const templates = await getTemplates();
  await saveTemplates(templates.filter((t) => t.id !== id));
}

export async function deleteTemplates(ids: string[]): Promise<void> {
  const set_ = new Set(ids);
  const templates = await getTemplates();
  await saveTemplates(templates.filter((t) => !set_.has(t.id)));
}

export async function duplicateTemplate(id: string): Promise<void> {
  const templates = await getTemplates();
  const original = templates.find((t) => t.id === id);
  if (!original) return;
  const now = Date.now();
  templates.push({
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} (複製)`,
    isPinned: false,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  await saveTemplates(templates);
}

export async function incrementUsage(id: string): Promise<void> {
  const templates = await getTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const t = templates[idx];
  if (!t) return;
  templates[idx] = {
    ...t,
    usageCount: (t.usageCount ?? 0) + 1,
    lastUsedAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveTemplates(templates);
}

// ── Categories & Tab Groups ───────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  return (await get<Category[]>(KEYS.CATEGORIES)) ?? [];
}

export async function getTabGroups(): Promise<TabGroup[]> {
  return (await get<TabGroup[]>(KEYS.TAB_GROUPS)) ?? [];
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getProjects(): Promise<StoryProject[]> {
  return (await get<StoryProject[]>(KEYS.PROJECTS)) ?? [];
}

export async function saveProjects(projects: StoryProject[]): Promise<void> {
  await set(KEYS.PROJECTS, projects);
}

export async function getActiveProject(): Promise<StoryProject | null> {
  const id = await get<string>(KEYS.ACTIVE_PROJECT);
  if (!id) return null;
  const projects = await getProjects();
  return projects.find((p) => p.id === id) ?? null;
}

export async function setActiveProject(id: string): Promise<void> {
  await set(KEYS.ACTIVE_PROJECT, id);
}

export async function createProject(name: string): Promise<StoryProject> {
  const projects = await getProjects();
  const now = Date.now();
  const project: StoryProject = {
    id: crypto.randomUUID(),
    name,
    currentImageStage: "none",
    scenes: [],
    generatedImages: [],
    imageReferences: [],
    createdAt: now,
    updatedAt: now,
  };
  projects.push(project);
  await saveProjects(projects);
  await setActiveProject(project.id);
  return project;
}

export async function updateProject(
  id: string,
  updates: Partial<StoryProject>
): Promise<void> {
  const projects = await getProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return;
  const current = projects[idx];
  if (!current) return;
  projects[idx] = { ...current, ...updates, updatedAt: Date.now() };
  await saveProjects(projects);
}

export async function deleteProject(id: string): Promise<void> {
  const projects = await getProjects();
  await saveProjects(projects.filter((p) => p.id !== id));
}

// ── Style Presets ─────────────────────────────────────────────────────────────

export async function getStylePresets(): Promise<StylePreset[]> {
  return (await get<StylePreset[]>(KEYS.STYLE_PRESETS)) ?? [];
}

export async function saveStylePreset(preset: StylePreset): Promise<void> {
  const presets = await getStylePresets();
  const idx = presets.findIndex((p) => p.id === preset.id);
  if (idx === -1) presets.push(preset);
  else presets[idx] = preset;
  await set(KEYS.STYLE_PRESETS, presets);
}

export async function deleteStylePreset(id: string): Promise<void> {
  const presets = await getStylePresets();
  await set(KEYS.STYLE_PRESETS, presets.filter((p) => p.id !== id));
}

// ── Prompt History ────────────────────────────────────────────────────────────

export async function getHistory(): Promise<PromptHistoryEntry[]> {
  return (await get<PromptHistoryEntry[]>(KEYS.HISTORY)) ?? [];
}

export async function addToHistory(entry: PromptHistoryEntry): Promise<void> {
  const history = await getHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await set(KEYS.HISTORY, history);
}

export async function clearHistory(): Promise<void> {
  await set(KEYS.HISTORY, []);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const stored = await get<Partial<Settings>>(KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await set(KEYS.SETTINGS, settings);
}

// ── Variable Cache ───────────────────────────────────────────────────────────

export async function getVarCache(): Promise<Record<string, string>> {
  return (await get<Record<string, string>>(KEYS.VAR_CACHE)) ?? {};
}

export async function saveVarCache(cache: Record<string, string>): Promise<void> {
  await set(KEYS.VAR_CACHE, cache);
}

// ── API Config ────────────────────────────────────────────────────────────────

export async function getApiConfig(): Promise<ApiConfig> {
  return (await get<ApiConfig>(KEYS.API_CONFIG)) ?? { ...DEFAULT_API_CONFIG };
}

export async function saveApiConfig(config: ApiConfig): Promise<void> {
  await set(KEYS.API_CONFIG, config);
}

// ── API History ───────────────────────────────────────────────────────────────

const MAX_API_HISTORY = 50;

export async function getApiHistory(): Promise<ApiHistoryEntry[]> {
  return (await get<ApiHistoryEntry[]>(KEYS.API_HISTORY)) ?? [];
}

export async function addToApiHistory(entry: ApiHistoryEntry): Promise<void> {
  const history = await getApiHistory();
  history.unshift(entry);
  if (history.length > MAX_API_HISTORY) history.length = MAX_API_HISTORY;
  await set(KEYS.API_HISTORY, history);
}

export async function clearApiHistory(): Promise<void> {
  await set(KEYS.API_HISTORY, []);
}

export async function exportApiHistoryJson(): Promise<string> {
  const history = await getApiHistory();
  return JSON.stringify(history, null, 2);
}
