/**
 * WorkflowUI — Main UI engine for AI 影片製作助手
 * Renders template cards, variable filler, and all 10 new features.
 */

import {
  WorkflowTemplate,
  StoryProject,
  StylePreset,
  Settings,
  TabGroup,
  Category,
  WorkflowStage,
  VIDEO_TOOLS,
  BUILT_IN_STYLE_PACKS,
  fillTemplate,
  ApiConfig,
  ApiHistoryEntry,
  PRESET_MODELS,
} from "../models/workflow";
import {
  getTemplates,
  getTabGroups,
  getCategories,
  getSettings,
  saveSettings,
  getActiveProject,
  createProject,
  updateProject,
  getHistory,
  addToHistory,
  clearHistory,
  incrementUsage,
  getStylePresets,
  getVarCache,
  saveVarCache,
  duplicateTemplate,
  deleteTemplate,
  getApiConfig,
  saveApiConfig,
  getApiHistory,
  addToApiHistory,
  clearApiHistory,
  exportApiHistoryJson,
} from "../storage/workflows";

export interface UICallbacks {
  onSendToAI: (text: string) => void;
  onCaptureImage: () => string | null;
  onExportProject: (project: StoryProject) => void;
  onClose: () => void;
}

const STAGE_ORDER: WorkflowStage[] = [
  "story",
  "storyboard",
  "image-gen",
  "image-prompt",
  "video-prompt",
];

export class WorkflowUI {
  private root: HTMLElement;
  private callbacks: UICallbacks;

  // State
  private activeTab: WorkflowStage = "story";
  private activeCategory = "all";
  private searchQuery = "";
  private activeToolFilter: string | null = null;   // Feature #9
  private bilingualMode = false;                    // Feature #6
  private selectedTemplate: WorkflowTemplate | null = null;
  private varValues: Record<string, string> = {};
  private capturedImageUrl: string | null = null;   // Feature #2
  private activeProject: StoryProject | null = null;
  private platform = "unknown";

  // Loaded data
  private templates: WorkflowTemplate[] = [];
  private tabGroups: TabGroup[] = [];
  private categories: Category[] = [];
  private stylePresets: StylePreset[] = [];
  private settings: Settings | null = null;
  private varCache: Record<string, string> = {};

  // API
  private apiConfig: ApiConfig | null = null;

  // View
  private currentView: "templates" | "detail" | "history" | "settings" = "templates";

  constructor(root: HTMLElement, callbacks: UICallbacks, platform: string) {
    this.root = root;
    this.callbacks = callbacks;
    this.platform = platform;
  }

  async init(): Promise<void> {
    const [templates, tabGroups, categories, settings, project, stylePresets, varCache, apiConfig] =
      await Promise.all([
        getTemplates(),
        getTabGroups(),
        getCategories(),
        getSettings(),
        getActiveProject(),
        getStylePresets(),
        getVarCache(),
        getApiConfig(),
      ]);

    this.templates = templates;
    this.tabGroups = tabGroups;
    this.categories = categories;
    this.apiConfig = apiConfig;
    this.settings = settings;
    this.stylePresets = [...BUILT_IN_STYLE_PACKS.flatMap((p) => p.presets), ...stylePresets];
    this.activeProject = project;
    this.bilingualMode = settings.defaultBilingualMode;
    this.activeTab = settings.lastActiveTab ?? "story";
    this.varCache = varCache;

    this.render();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    this.root.innerHTML = "";

    this.root.appendChild(this.buildHeader());
    this.root.appendChild(this.buildProjectBar());
    this.root.appendChild(this.buildTabBar());

    const body = document.createElement("div");
    body.className = "aiv-body";

    switch (this.currentView) {
      case "templates": body.append(...this.buildTemplateView()); break;
      case "detail":    body.append(...this.buildDetailView());    break;
      case "history":   body.append(...this.buildHistoryView());   break;
      case "settings":  body.append(...this.buildSettingsView());  break;
    }

    this.root.appendChild(body);
    this.root.appendChild(this.buildResizeHandle());
  }

  private buildHeader(): HTMLElement {
    const el = document.createElement("div");
    el.className = "aiv-header";

    el.innerHTML = `
      <span class="aiv-header-logo">🎬</span>
      <div class="aiv-header-title">
        AI 影片製作助手
        <small>AI Video Production Assistant</small>
      </div>
      <span class="aiv-platform-badge">${this.platform}</span>
      <div class="aiv-header-actions">
        <button class="aiv-icon-btn" id="aiv-btn-history" title="提示詞歷史">📋</button>
        <button class="aiv-icon-btn" id="aiv-btn-settings" title="設定">⚙️</button>
        <button class="aiv-icon-btn" id="aiv-btn-close" title="關閉">✕</button>
      </div>`;

    el.querySelector("#aiv-btn-close")?.addEventListener("click", () => this.callbacks.onClose());
    el.querySelector("#aiv-btn-history")?.addEventListener("click", () => {
      this.currentView = "history";
      this.render();
    });
    el.querySelector("#aiv-btn-settings")?.addEventListener("click", () => {
      this.currentView = "settings";
      this.render();
    });

    return el;
  }

  private buildProjectBar(): HTMLElement {
    const el = document.createElement("div");
    el.className = "aiv-project-bar";

    if (this.activeProject) {
      el.innerHTML = `
        <span class="aiv-project-name">📁 ${this.esc(this.activeProject.name)}</span>
        <button class="aiv-project-btn" id="aiv-btn-export">⬇︎ 匯出</button>
        <button class="aiv-project-btn" id="aiv-btn-new-proj">＋ 新專案</button>`;

      el.querySelector("#aiv-btn-export")?.addEventListener("click", () => {
        if (this.activeProject) this.callbacks.onExportProject(this.activeProject);
      });
      el.querySelector("#aiv-btn-new-proj")?.addEventListener("click", () => this.promptNewProject());
    } else {
      el.innerHTML = `<span class="aiv-project-name" style="color:var(--aiv-muted)">尚未建立專案</span>
        <button class="aiv-project-btn" id="aiv-btn-new-proj">＋ 新建專案</button>`;
      el.querySelector("#aiv-btn-new-proj")?.addEventListener("click", () => this.promptNewProject());
    }

    return el;
  }

  private buildTabBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "aiv-tab-bar";

    const tabs = this.tabGroups.length > 0
      ? this.tabGroups
      : [
          { id: "story",        name: "故事",    icon: "📖", file: "", order: 0 },
          { id: "storyboard",   name: "分鏡",    icon: "🎞", file: "", order: 1 },
          { id: "image-gen",    name: "圖像生成", icon: "🖼", file: "", order: 2 },
          { id: "image-prompt", name: "圖像提示", icon: "🎨", file: "", order: 3 },
          { id: "video-prompt", name: "影片提示", icon: "🎬", file: "", order: 4 },
        ];

    tabs.sort((a, b) => a.order - b.order).forEach((tab) => {
      const btn = document.createElement("button");
      btn.className = "aiv-tab-btn" + (this.activeTab === tab.id ? " active" : "");
      btn.innerHTML = `<span class="aiv-tab-icon">${tab.icon}</span>${tab.name}`;
      btn.addEventListener("click", () => {
        this.activeTab = tab.id as WorkflowStage;
        this.activeCategory = "all";
        this.searchQuery = "";
        this.selectedTemplate = null;
        this.currentView = "templates";
        this.persistActiveTab();
        this.render();
      });
      bar.appendChild(btn);
    });

    return bar;
  }

  private buildTemplateView(): HTMLElement[] {
    const els: HTMLElement[] = [];

    // Feature #1: Video Tools Panel
    els.push(this.buildVideoToolsPanel());

    // Feature #9: Smart Tool Filter
    els.push(this.buildToolFilterBar());

    // Search
    els.push(this.buildSearchBox());

    // Category tabs
    els.push(this.buildCategoryBar());

    // Feature #2: Image Capture (on image-gen and image-prompt and video-prompt tabs)
    if (["image-gen", "image-prompt", "video-prompt"].includes(this.activeTab)) {
      els.push(this.buildImageCapturePanel());
    }

    // Template cards
    const cards = this.buildTemplateCards();
    if (cards.length === 0) els.push(this.buildEmpty());
    else els.push(...cards);

    return els;
  }

  // Feature #1: Platform Quick-Launch Panel
  private buildVideoToolsPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "aiv-tool-panel";

    const label = document.createElement("div");
    label.className = "aiv-section-label";
    label.textContent = "🚀 快速啟動影片/圖像工具";
    panel.appendChild(label);

    const grid = document.createElement("div");
    grid.className = "aiv-tool-grid";

    const relevantTools = VIDEO_TOOLS.filter((t) =>
      this.activeTab === "video-prompt"
        ? t.category !== "image"
        : this.activeTab === "image-prompt" || this.activeTab === "image-gen"
        ? t.category !== "video"
        : true
    );

    relevantTools.forEach((tool) => {
      const chip = document.createElement("a");
      chip.className = "aiv-tool-chip";
      chip.href = tool.url;
      chip.target = "_blank";
      chip.rel = "noopener noreferrer";
      chip.innerHTML = `${tool.icon} ${tool.name}`;
      grid.appendChild(chip);
    });

    panel.appendChild(grid);
    return panel;
  }

  // Feature #9: Smart Tool Filter
  private buildToolFilterBar(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "aiv-filter-bar";

    const allChip = this.makeFilterChip("全部", null);
    wrap.appendChild(allChip);

    const tools = Array.from(
      new Set(
        this.filteredTemplates()
          .flatMap((t) => t.targetTools ?? [])
      )
    );

    tools.forEach((tool) => wrap.appendChild(this.makeFilterChip(tool, tool)));

    return wrap;
  }

  private makeFilterChip(label: string, value: string | null): HTMLElement {
    const chip = document.createElement("button");
    chip.className =
      "aiv-filter-chip" + (this.activeToolFilter === value ? " active" : "");
    chip.textContent = label;
    chip.addEventListener("click", () => {
      this.activeToolFilter = value;
      this.render();
    });
    return chip;
  }

  private buildSearchBox(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "aiv-search";
    wrap.innerHTML = `<span class="aiv-search-icon">🔍</span>
      <input type="text" placeholder="搜尋模板…" value="${this.esc(this.searchQuery)}" />`;

    const input = wrap.querySelector("input")!;
    input.addEventListener("input", () => {
      this.searchQuery = input.value;
      this.renderCardArea();
    });

    return wrap;
  }

  private buildCategoryBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "aiv-cat-bar";

    const stageCategories = this.categories.filter(
      (c) => !c.id.includes("_") || c.id.startsWith(this.activeTab)
    );

    const cats: { id: string; name: string; icon: string }[] = [
      { id: "all", name: "全部", icon: "" },
      ...stageCategories,
    ];

    cats.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "aiv-cat-btn" + (this.activeCategory === cat.id ? " active" : "");
      btn.textContent = `${cat.icon} ${cat.name}`.trim();
      btn.addEventListener("click", () => {
        this.activeCategory = cat.id;
        this.render();
      });
      bar.appendChild(btn);
    });

    return bar;
  }

  // Feature #2: Image Capture Panel
  private buildImageCapturePanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "aiv-image-capture";

    if (this.capturedImageUrl) {
      const img = document.createElement("img");
      img.className = "aiv-captured-thumb";
      img.src = this.capturedImageUrl;
      img.alt = "已擷取圖像";
      panel.appendChild(img);

      const info = document.createElement("div");
      info.className = "aiv-capture-info";
      info.textContent = "已擷取 AI 生成圖像";
      panel.appendChild(info);

      const clearBtn = document.createElement("button");
      clearBtn.className = "aiv-capture-btn";
      clearBtn.style.background = "var(--aiv-muted)";
      clearBtn.textContent = "清除";
      clearBtn.addEventListener("click", () => {
        this.capturedImageUrl = null;
        this.render();
      });
      panel.appendChild(clearBtn);
    } else {
      const info = document.createElement("div");
      info.className = "aiv-capture-info";
      info.innerHTML = `🖼 <strong>擷取 AI 圖像</strong><br>自動抓取頁面最新生成圖像`;
      panel.appendChild(info);

      const captureBtn = document.createElement("button");
      captureBtn.className = "aiv-capture-btn";
      captureBtn.textContent = "📷 擷取";
      captureBtn.addEventListener("click", () => {
        const url = this.callbacks.onCaptureImage();
        if (url) {
          this.capturedImageUrl = url;
          this.render();
          this.toast("圖像已擷取！", "success");
        } else {
          this.toast("找不到可擷取的圖像", "error");
        }
      });
      panel.appendChild(captureBtn);
    }

    return panel;
  }

  private buildTemplateCards(): HTMLElement[] {
    const filtered = this.getFilteredTemplates();
    return filtered.map((tpl) => this.buildCard(tpl));
  }

  private buildCard(tpl: WorkflowTemplate): HTMLElement {
    const card = document.createElement("div");
    card.className = "aiv-card" + (tpl.isPinned ? " pinned" : "");

    const header = document.createElement("div");
    header.className = "aiv-card-header";

    const name = document.createElement("div");
    name.className = "aiv-card-name";
    name.textContent = tpl.name;

    const actions = document.createElement("div");
    actions.className = "aiv-card-actions";

    const favBtn = this.makeCardBtn(tpl.isFavorite ? "❤️" : "🤍", () => {
      this.updateTplFav(tpl);
    });
    favBtn.title = "收藏";

    const dupBtn = this.makeCardBtn("⧉", () => {
      duplicateTemplate(tpl.id).then(() => this.reload());
    });
    dupBtn.title = "複製";

    const delBtn = this.makeCardBtn("🗑", () => {
      if (confirm(`刪除「${tpl.name}」？`)) deleteTemplate(tpl.id).then(() => this.reload());
    });
    delBtn.title = "刪除";

    actions.append(favBtn, dupBtn, delBtn);
    header.append(name, actions);

    const preview = document.createElement("div");
    preview.className = "aiv-card-preview";
    preview.textContent = tpl.content.substring(0, 100);

    const footer = document.createElement("div");
    footer.className = "aiv-card-footer";

    tpl.tags?.slice(0, 3).forEach((tag) => {
      const t = document.createElement("span");
      t.className = "aiv-tag";
      t.textContent = tag;
      footer.appendChild(t);
    });

    if ((tpl.usageCount ?? 0) > 0) {
      const cnt = document.createElement("span");
      cnt.className = "aiv-usage-count";
      cnt.textContent = `使用 ${tpl.usageCount} 次`;
      footer.appendChild(cnt);
    }

    card.append(header, preview, footer);

    card.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".aiv-card-btn")) return;
      this.openTemplate(tpl);
    });

    return card;
  }

  private buildDetailView(): HTMLElement[] {
    if (!this.selectedTemplate) return [];

    const tpl = this.selectedTemplate;
    const els: HTMLElement[] = [];

    const detail = document.createElement("div");
    detail.className = "aiv-detail";

    // Header
    const header = document.createElement("div");
    header.className = "aiv-detail-header";
    const back = document.createElement("button");
    back.className = "aiv-back-btn";
    back.innerHTML = "‹";
    back.addEventListener("click", () => {
      this.selectedTemplate = null;
      this.currentView = "templates";
      this.render();
    });
    const title = document.createElement("div");
    title.className = "aiv-detail-title";
    title.textContent = tpl.name;
    header.append(back, title);
    detail.appendChild(header);

    // Feature #6: Bilingual Toggle
    detail.appendChild(this.buildBilingualRow());

    // Variable form
    if (tpl.variables && tpl.variables.length > 0) {
      const form = document.createElement("div");
      form.className = "aiv-var-form";

      tpl.variables.forEach((v) => {
        const group = document.createElement("div");
        group.className = "aiv-var-group";

        const label = document.createElement("label");
        label.className = "aiv-var-label";
        label.textContent = v.name;
        group.appendChild(label);

        const input = document.createElement("input");
        input.className = "aiv-var-input";
        input.type = "text";
        input.placeholder = v.placeholder || `輸入 ${v.name}…`;
        input.value = this.varValues[v.name] ?? this.varCache[v.name] ?? v.defaultValue ?? "";

        input.addEventListener("input", () => {
          this.varValues[v.name] = input.value;
          this.updatePreview(preview);
        });

        group.appendChild(input);
        form.appendChild(group);
      });

      detail.appendChild(form);
    }

    // Preview
    const preview = document.createElement("div");
    preview.className = "aiv-preview-box";
    this.updatePreview(preview);
    detail.appendChild(preview);

    // Feature #4: Style preset selector
    if (["image-gen", "image-prompt", "video-prompt"].includes(this.activeTab)) {
      detail.appendChild(this.buildStyleSelector());
    }

    // Action buttons
    const btnRow = document.createElement("div");
    btnRow.className = "aiv-btn-row";

    const copyBtn = document.createElement("button");
    copyBtn.className = "aiv-btn aiv-btn-outline";
    copyBtn.textContent = "📋 複製";
    copyBtn.addEventListener("click", () => {
      const text = this.getFilledContent();
      navigator.clipboard.writeText(text).then(() => this.toast("已複製到剪貼簿", "success"));
    });

    const sendBtn = document.createElement("button");
    sendBtn.className = "aiv-btn aiv-btn-send";
    sendBtn.textContent = "➤ 送出到 AI";
    sendBtn.addEventListener("click", () => this.handleSend(tpl));

    btnRow.append(copyBtn, sendBtn);

    // API Generate button — only shown when API is configured
    if (this.apiConfig?.enabled && this.apiConfig.key) {
      const apiBtn = document.createElement("button");
      apiBtn.className = "aiv-btn aiv-btn-api";
      apiBtn.style.marginTop = "6px";
      apiBtn.textContent = "🤖 API 生成";
      apiBtn.addEventListener("click", () => this.handleApiGenerate(tpl, preview, apiBtn));
      detail.appendChild(apiBtn);
    }
    detail.appendChild(btnRow);

    // Feature #3: Chain to next stage
    const nextStage = this.getNextStage();
    if (nextStage) detail.appendChild(this.buildChainBar(nextStage));

    els.push(detail);
    return els;
  }

  // Feature #6: Bilingual Toggle
  private buildBilingualRow(): HTMLElement {
    const row = document.createElement("div");
    row.className = "aiv-bilingual-row";

    const label = document.createElement("label");
    label.className = "aiv-toggle";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.bilingualMode;

    const track = document.createElement("div");
    track.className = "aiv-toggle-track";

    const thumb = document.createElement("div");
    thumb.className = "aiv-toggle-thumb";

    label.append(input, track, thumb);

    input.addEventListener("change", () => {
      this.bilingualMode = input.checked;
      const preview = this.root.querySelector<HTMLElement>(".aiv-preview-box");
      if (preview) this.updatePreview(preview);
    });

    const text = document.createElement("span");
    text.textContent = "中英雙語模式";

    row.append(label, text);
    return row;
  }

  // Feature #4: Style Preset Selector
  private buildStyleSelector(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "aiv-style-panel";

    const label = document.createElement("div");
    label.className = "aiv-section-label";
    label.textContent = "🎨 風格預設";
    panel.appendChild(label);

    const select = document.createElement("select");
    select.className = "aiv-style-select";

    const none = document.createElement("option");
    none.value = "";
    none.textContent = "無（不套用風格）";
    select.appendChild(none);

    const packs = BUILT_IN_STYLE_PACKS;
    packs.forEach((pack) => {
      const group = document.createElement("optgroup");
      group.label = `${pack.icon} ${pack.name}`;
      pack.presets.forEach((preset) => {
        const opt = document.createElement("option");
        opt.value = preset.id;
        opt.textContent = preset.name;
        group.appendChild(opt);
      });
      select.appendChild(group);
    });

    if (this.stylePresets.length > 0) {
      const customGroup = document.createElement("optgroup");
      customGroup.label = "自訂風格";
      this.stylePresets
        .filter((p) => !packs.some((pk) => pk.presets.some((pp) => pp.id === p.id)))
        .forEach((preset) => {
          const opt = document.createElement("option");
          opt.value = preset.id;
          opt.textContent = preset.name;
          customGroup.appendChild(opt);
        });
      if (customGroup.children.length > 0) select.appendChild(customGroup);
    }

    select.addEventListener("change", () => {
      if (!select.value) return;
      const preset = this.stylePresets.find((p) => p.id === select.value);
      if (!preset) return;
      const appendix = `\n\n風格：${preset.lighting}，${preset.colorGrade}，${preset.cameraStyle}，${preset.mood}`;
      this.varValues["__Style__"] = appendix;
      const preview = this.root.querySelector<HTMLElement>(".aiv-preview-box");
      if (preview) this.updatePreview(preview);
    });

    panel.appendChild(select);
    return panel;
  }

  // Feature #3: Chain to next stage bar
  private buildChainBar(nextStage: WorkflowStage): HTMLElement {
    const labels: Record<WorkflowStage, string> = {
      story: "故事",
      storyboard: "分鏡",
      "image-gen": "圖像生成",
      "image-prompt": "圖像提示",
      "video-prompt": "影片提示",
    };

    const bar = document.createElement("div");
    bar.className = "aiv-chain-bar";
    bar.style.marginTop = "8px";
    bar.innerHTML = `<span class="aiv-chain-arrow">→</span>
      <span>下一步：前往 <strong>${labels[nextStage]}</strong></span>`;

    const chainBtn = document.createElement("button");
    chainBtn.className = "aiv-chain-btn";
    chainBtn.textContent = "前往下一步 →";
    chainBtn.addEventListener("click", () => {
      this.activeTab = nextStage;
      this.selectedTemplate = null;
      this.currentView = "templates";
      this.render();
    });

    bar.appendChild(chainBtn);
    return bar;
  }

  // ── Settings View ──────────────────────────────────────────────────────────

  private buildSettingsView(): HTMLElement[] {
    const els: HTMLElement[] = [];

    // Back header
    const header = document.createElement("div");
    header.className = "aiv-detail-header";
    const back = document.createElement("button");
    back.className = "aiv-back-btn";
    back.innerHTML = "‹";
    back.addEventListener("click", () => { this.currentView = "templates"; this.render(); });
    const title = document.createElement("div");
    title.className = "aiv-detail-title";
    title.textContent = "⚙️ API 設定";
    header.append(back, title);
    els.push(header);

    const cfg = this.apiConfig ?? { key: "", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemma-3-27b-it", enabled: false };

    // ── API Config form ──
    const section = document.createElement("div");
    section.className = "aiv-settings-section";

    // Enable toggle
    const enableRow = document.createElement("div");
    enableRow.className = "aiv-settings-row";
    enableRow.innerHTML = `<span class="aiv-settings-label">啟用 API 協助</span>`;
    const toggleWrap = document.createElement("label");
    toggleWrap.className = "aiv-toggle";
    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.checked = cfg.enabled;
    const track = document.createElement("div");
    track.className = "aiv-toggle-track";
    const thumb = document.createElement("div");
    thumb.className = "aiv-toggle-thumb";
    toggleWrap.append(toggleInput, track, thumb);
    enableRow.appendChild(toggleWrap);
    section.appendChild(enableRow);

    // API Key
    const keyGroup = document.createElement("div");
    keyGroup.className = "aiv-var-group";
    keyGroup.innerHTML = `<label class="aiv-var-label">API 金鑰</label>`;
    const keyWrap = document.createElement("div");
    keyWrap.className = "aiv-settings-key-wrap";
    const keyInput = document.createElement("input");
    keyInput.className = "aiv-var-input";
    keyInput.type = "password";
    keyInput.placeholder = "sk-... 或 AIzaSy...";
    keyInput.value = cfg.key;
    const eyeBtn = document.createElement("button");
    eyeBtn.className = "aiv-settings-eye";
    eyeBtn.type = "button";
    eyeBtn.textContent = "👁";
    eyeBtn.title = "顯示/隱藏";
    eyeBtn.addEventListener("click", () => {
      keyInput.type = keyInput.type === "password" ? "text" : "password";
    });
    keyWrap.append(keyInput, eyeBtn);
    keyGroup.appendChild(keyWrap);
    section.appendChild(keyGroup);

    // Model selector + custom input
    const modelGroup = document.createElement("div");
    modelGroup.className = "aiv-var-group";
    modelGroup.innerHTML = `<label class="aiv-var-label">模型</label>`;

    const modelSelect = document.createElement("select");
    modelSelect.className = "aiv-style-select";
    const isCustom = !PRESET_MODELS.some((m) => m.value === cfg.model && m.value !== "__custom__");
    PRESET_MODELS.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.value;
      opt.textContent = m.label;
      modelSelect.appendChild(opt);
    });
    modelSelect.value = isCustom ? "__custom__" : cfg.model;

    const customInput = document.createElement("input");
    customInput.className = "aiv-var-input";
    customInput.style.marginTop = "4px";
    customInput.placeholder = "輸入自訂模型名稱";
    customInput.value = cfg.model;
    customInput.style.display = (modelSelect.value === "__custom__") ? "block" : "none";

    modelSelect.addEventListener("change", () => {
      customInput.style.display = modelSelect.value === "__custom__" ? "block" : "none";
      if (modelSelect.value !== "__custom__") customInput.value = modelSelect.value;
    });

    modelGroup.append(modelSelect, customInput);
    section.appendChild(modelGroup);

    // Endpoint
    const epGroup = document.createElement("div");
    epGroup.className = "aiv-var-group";
    epGroup.innerHTML = `<label class="aiv-var-label">API Endpoint（OpenAI 相容格式）</label>`;
    const epInput = document.createElement("input");
    epInput.className = "aiv-var-input";
    epInput.type = "text";
    epInput.placeholder = "https://generativelanguage.googleapis.com/v1beta/openai";
    epInput.value = cfg.endpoint;
    epGroup.appendChild(epInput);
    section.appendChild(epGroup);

    // Hint
    const hint = document.createElement("div");
    hint.className = "aiv-settings-hint";
    hint.textContent = "設定變更後自動儲存。金鑰僅存於本機 chrome.storage.local。";
    section.appendChild(hint);

    els.push(section);

    // Auto-save on any change
    const autoSave = () => {
      const model = modelSelect.value === "__custom__" ? customInput.value.trim() : modelSelect.value;
      const next: ApiConfig = {
        key: keyInput.value.trim(),
        endpoint: epInput.value.trim() || "https://generativelanguage.googleapis.com/v1beta/openai",
        model: model || "gemma-3-27b-it",
        enabled: toggleInput.checked,
      };
      this.apiConfig = next;
      saveApiConfig(next);
    };
    [keyInput, epInput, customInput].forEach((el) => el.addEventListener("input", autoSave));
    toggleInput.addEventListener("change", autoSave);
    modelSelect.addEventListener("change", autoSave);

    // ── API History ──
    const histHeader = document.createElement("div");
    histHeader.className = "aiv-detail-header";
    histHeader.style.marginTop = "12px";
    const histTitle = document.createElement("div");
    histTitle.className = "aiv-detail-title";
    histTitle.textContent = "📜 API 呼叫歷史";

    const exportBtn = document.createElement("button");
    exportBtn.className = "aiv-project-btn";
    exportBtn.textContent = "⬇ 匯出";
    exportBtn.addEventListener("click", () => {
      exportApiHistoryJson().then((json) => {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `api-history-${Date.now()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    });

    const clearBtn = document.createElement("button");
    clearBtn.className = "aiv-project-btn";
    clearBtn.textContent = "清除";
    clearBtn.addEventListener("click", () => {
      clearApiHistory().then(() => {
        this.currentView = "settings";
        this.render();
      });
    });

    histHeader.append(histTitle, exportBtn, clearBtn);
    els.push(histHeader);

    // History list (async)
    const listPlaceholder = document.createElement("div");
    els.push(listPlaceholder);
    getApiHistory().then((history) => {
      if (history.length === 0) {
        listPlaceholder.appendChild(this.buildEmpty("尚無 API 呼叫記錄", "使用「🤖 API 生成」後會記錄在此"));
        return;
      }
      const list = document.createElement("div");
      list.className = "aiv-history-list";
      history.forEach((entry) => {
        const item = document.createElement("div");
        item.className = "aiv-history-item";

        const meta = document.createElement("div");
        meta.className = "aiv-history-meta";
        meta.innerHTML = `
          <span class="aiv-history-stage">${entry.stage}</span>
          <span style="font-size:10px;color:var(--aiv-muted)">${entry.model}</span>
          <span class="aiv-history-time">${this.formatTime(entry.sentAt)}</span>`;

        const promptPreview = document.createElement("div");
        promptPreview.className = "aiv-history-preview";
        promptPreview.style.borderBottom = "1px solid var(--aiv-border)";
        promptPreview.style.paddingBottom = "4px";
        promptPreview.style.marginBottom = "4px";
        promptPreview.textContent = "▶ " + entry.prompt.substring(0, 80) + (entry.prompt.length > 80 ? "…" : "");

        const respPreview = document.createElement("div");
        respPreview.className = "aiv-history-preview";
        respPreview.textContent = "◀ " + entry.response.substring(0, 120) + (entry.response.length > 120 ? "…" : "");

        const reuseBtn = document.createElement("button");
        reuseBtn.className = "aiv-project-btn";
        reuseBtn.style.marginTop = "5px";
        reuseBtn.textContent = "↩ 回填回應";
        reuseBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(entry.response).then(() => this.toast("已複製 API 回應", "success"));
        });

        item.append(meta, promptPreview, respPreview, reuseBtn);
        list.appendChild(item);
      });
      listPlaceholder.appendChild(list);
    });

    return els;
  }

  // ── API Generate ───────────────────────────────────────────────────────────

  private async handleApiGenerate(
    tpl: WorkflowTemplate,
    preview: HTMLElement,
    btn: HTMLButtonElement
  ): Promise<void> {
    const prompt = this.getFilledContent();
    if (!prompt.trim()) { this.toast("請先填入變數", "error"); return; }

    btn.disabled = true;
    btn.textContent = "⏳ 生成中…";

    try {
      const response = await this.callApi(prompt);

      // Fill response into preview
      preview.innerHTML = this.esc(response).replace(/\n/g, "<br>");

      // Save to history
      const entry: ApiHistoryEntry = {
        id: crypto.randomUUID(),
        prompt,
        response,
        model: this.apiConfig?.model ?? "",
        stage: this.activeTab,
        sentAt: Date.now(),
      };
      await addToApiHistory(entry);

      btn.textContent = "✅ 生成完成";
      setTimeout(() => { btn.textContent = "🤖 API 生成"; btn.disabled = false; }, 2000);
      this.toast("API 回應已填入預覽區", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.toast(`API 錯誤：${msg}`, "error");
      btn.textContent = "🤖 API 生成";
      btn.disabled = false;
    }
  }

  private async callApi(prompt: string): Promise<string> {
    const cfg = this.apiConfig;
    if (!cfg || !cfg.key) throw new Error("尚未設定 API 金鑰");

    const endpoint = cfg.endpoint.replace(/\/$/, "") + "/chat/completions";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${res.status} ${err.substring(0, 200)}`);
    }

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("API 回應格式異常");
    return text;
  }

  private buildHistoryView(): HTMLElement[] {
    const els: HTMLElement[] = [];

    const header = document.createElement("div");
    header.className = "aiv-detail-header";

    const back = document.createElement("button");
    back.className = "aiv-back-btn";
    back.innerHTML = "‹";
    back.addEventListener("click", () => {
      this.currentView = "templates";
      this.render();
    });

    const title = document.createElement("div");
    title.className = "aiv-detail-title";
    title.textContent = "提示詞歷史";

    const clearBtn = document.createElement("button");
    clearBtn.className = "aiv-project-btn";
    clearBtn.textContent = "清除";
    clearBtn.addEventListener("click", () => {
      clearHistory().then(() => this.render());
    });

    header.append(back, title, clearBtn);
    els.push(header);

    getHistory().then((history) => {
      if (history.length === 0) {
        const empty = this.buildEmpty("目前沒有歷史記錄", "送出過的提示詞會出現在這裡");
        els.push(empty);
        this.root.querySelector(".aiv-body")?.append(...els.slice(1));
        return;
      }

      const list = document.createElement("div");
      list.className = "aiv-history-list";

      history.forEach((entry) => {
        const item = document.createElement("div");
        item.className = "aiv-history-item";

        const meta = document.createElement("div");
        meta.className = "aiv-history-meta";
        meta.innerHTML = `
          <span class="aiv-history-stage">${entry.stage}</span>
          <span style="font-size:10px;color:var(--aiv-muted)">${entry.platform}</span>
          <span class="aiv-history-time">${this.formatTime(entry.sentAt)}</span>`;

        const preview = document.createElement("div");
        preview.className = "aiv-history-preview";
        preview.textContent = entry.content;

        const reuseBtn = document.createElement("button");
        reuseBtn.className = "aiv-project-btn";
        reuseBtn.style.marginTop = "5px";
        reuseBtn.textContent = "重新使用";
        reuseBtn.addEventListener("click", () => {
          this.callbacks.onSendToAI(entry.content);
          this.toast("已重新送出", "success");
        });

        item.append(meta, preview, reuseBtn);
        list.appendChild(item);
      });

      this.root.querySelector(".aiv-body")?.appendChild(list);
    });

    return els;
  }

  private buildEmpty(title = "沒有符合的模板", desc = "請調整搜尋條件或分類"): HTMLElement {
    const el = document.createElement("div");
    el.className = "aiv-empty";
    el.innerHTML = `
      <div class="aiv-empty-icon">🔎</div>
      <div class="aiv-empty-title">${title}</div>
      <div class="aiv-empty-desc">${desc}</div>`;
    return el;
  }

  private buildResizeHandle(): HTMLElement {
    const handle = document.createElement("div");
    handle.className = "aiv-resize-handle";

    let startX = 0;
    let startW = 0;

    handle.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      startW = parseInt(getComputedStyle(this.root).width, 10);
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      e.preventDefault();
    });

    const onMove = (e: MouseEvent) => {
      const newW = Math.max(280, Math.min(600, startW - (e.clientX - startX)));
      this.root.style.setProperty("--aiv-w", `${newW}px`);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const w = parseInt(getComputedStyle(this.root).width, 10);
      if (this.settings) {
        this.settings.sidebarWidth = w;
        saveSettings(this.settings);
      }
    };

    return handle;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private openTemplate(tpl: WorkflowTemplate): void {
    this.selectedTemplate = tpl;
    this.varValues = {};
    this.currentView = "detail";
    this.render();
  }

  private async handleSend(tpl: WorkflowTemplate): Promise<void> {
    const text = this.getFilledContent();
    if (!text.trim()) return;

    this.callbacks.onSendToAI(text);
    await incrementUsage(tpl.id);

    // Feature #10: Save to history
    await addToHistory({
      id: crypto.randomUUID(),
      templateId: tpl.id,
      templateName: tpl.name,
      stage: this.activeTab,
      content: text,
      sentAt: Date.now(),
      platform: this.platform,
    });

    // Cache var values
    const updated = { ...this.varCache, ...this.varValues };
    await saveVarCache(updated);
    this.varCache = updated;

    this.toast("已送出到 AI！", "success");
  }

  private getFilledContent(): string {
    if (!this.selectedTemplate) return "";
    let text = fillTemplate(this.selectedTemplate.content, this.varValues);

    // Feature #6: append English translation note when bilingual
    if (this.bilingualMode) {
      text += "\n\n---\n[請同時提供以上內容的英文版本，格式相同]";
    }

    // Feature #4: append style appendix if set
    if (this.varValues["__Style__"]) {
      text += this.varValues["__Style__"];
    }

    return text;
  }

  private updatePreview(el: HTMLElement): void {
    if (!this.selectedTemplate) return;
    const values = { ...this.varValues };

    let html = this.selectedTemplate.content.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const k = key.trim();
      const val = values[k];
      if (val) return `<mark>${this.esc(val)}</mark>`;
      return `<span style="color:var(--aiv-warn)">{{${k}}}</span>`;
    });

    if (this.bilingualMode) {
      html += "<br><br><em style='color:var(--aiv-muted)'>[雙語模式啟用]</em>";
    }

    el.innerHTML = html;
  }

  private getNextStage(): WorkflowStage | null {
    const idx = STAGE_ORDER.indexOf(this.activeTab);
    if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
    return STAGE_ORDER[idx + 1];
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  private filteredTemplates(): WorkflowTemplate[] {
    return this.templates.filter((t) => t.stage === this.activeTab);
  }

  private getFilteredTemplates(): WorkflowTemplate[] {
    let items = this.filteredTemplates();

    if (this.activeCategory !== "all") {
      items = items.filter((t) => t.category === this.activeCategory);
    }

    if (this.activeToolFilter) {
      items = items.filter((t) => t.targetTools?.includes(this.activeToolFilter!));
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      items = items.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    // Pinned first, then by usage
    return items.sort((a, b) => {
      if ((a.isPinned ? 1 : 0) !== (b.isPinned ? 1 : 0)) return a.isPinned ? -1 : 1;
      return (b.usageCount ?? 0) - (a.usageCount ?? 0);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private renderCardArea(): void {
    const body = this.root.querySelector(".aiv-body");
    if (!body) return;

    // Remove existing cards & empty state
    body.querySelectorAll(".aiv-card, .aiv-empty").forEach((el) => el.remove());

    const cards = this.buildTemplateCards();
    if (cards.length === 0) body.appendChild(this.buildEmpty());
    else cards.forEach((c) => body.appendChild(c));
  }

  private async updateTplFav(tpl: WorkflowTemplate): Promise<void> {
    const { updateTemplate } = await import("../storage/workflows");
    await updateTemplate(tpl.id, { isFavorite: !tpl.isFavorite });
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.templates = await getTemplates();
    this.render();
  }

  private async persistActiveTab(): Promise<void> {
    if (!this.settings) return;
    this.settings.lastActiveTab = this.activeTab;
    await saveSettings(this.settings);
  }

  private promptNewProject(): void {
    const name = prompt("新專案名稱：");
    if (!name?.trim()) return;
    createProject(name.trim()).then((p) => {
      this.activeProject = p;
      this.render();
    });
  }

  public setCapturedImage(url: string): void {
    this.capturedImageUrl = url;
    this.render();
  }

  private esc(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  private makeCardBtn(icon: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "aiv-card-btn";
    btn.innerHTML = icon;
    btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  private formatTime(ts: number): string {
    return new Date(ts).toLocaleString("zh-TW", {
      month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }

  public toast(message: string, type: "success" | "error" | "info" = "info"): void {
    let container = document.getElementById("aiv-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "aiv-toast-container";
      container.className = "aiv-toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `aiv-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add("show"));
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}
