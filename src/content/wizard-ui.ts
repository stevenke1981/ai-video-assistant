/**
 * AI精靈模式 (AI Wizard Mode) UI
 * Guides users through all 5 workflow stages sequentially,
 * auto-generating prompts for each stage using the API.
 */

import { ApiConfig, ProviderSettings } from "../models/workflow";
import {
  WizardSession,
  WizardSetup,
  WizardStageId,
  WizardStageResult,
  WIZARD_STAGE_ORDER,
  WIZARD_STAGE_META,
  DEFAULT_WIZARD_SETUP,
  buildStoryPrompt,
  buildStoryboardPrompt,
  buildImageGenPrompt,
  buildImagePromptOptimize,
  buildVideoPrompt,
} from "../models/wizard";
import {
  createWizardSession,
  updateWizardSession,
  updateWizardStage,
  getWizardSessions,
  deleteWizardSession,
  setActiveWizardSession,
} from "../storage/wizard";

export interface WizardCallbacks {
  onBack: () => void;
  onSendToAI: (text: string) => void;
  onToast: (msg: string, type: "success" | "error" | "info") => void;
}

const SYSTEM_PROMPT = [
  "你是一個專業的影片製作提示詞生成助手。",
  "規則（不可違反）：",
  "1. 收到任務後立即直接生成最終內容，從第一個段落開始輸出。",
  "2. 禁止說明你將要做什麼、禁止確認任務、禁止問使用者任何問題。",
  "3. 嚴格依照模板結構順序完整輸出每個指定段落，不得省略。",
  "4. 若模板要求多個角度或多個段落，必須逐一完整輸出，不得合併或縮略。",
  "5. 輸出語言與模板保持一致。",
].join("\n");

export class WizardUI {
  private root: HTMLElement;
  private apiConfig: ApiConfig;
  private callbacks: WizardCallbacks;

  private session: WizardSession | null = null;
  private phase: "list" | "setup" | "stage" = "list";
  private currentStageIdx = 0;
  private isGenerating = false;
  // User-edited prompt overrides (keyed by stageId)
  private customPrompts: Partial<Record<WizardStageId, string>> = {};

  constructor(root: HTMLElement, apiConfig: ApiConfig, callbacks: WizardCallbacks) {
    this.root = root;
    this.apiConfig = apiConfig;
    this.callbacks = callbacks;
  }

  render(): void {
    this.root.innerHTML = "";
    switch (this.phase) {
      case "list":  this.root.append(...this.buildListView());  break;
      case "setup": this.root.append(...this.buildSetupView()); break;
      case "stage": this.root.append(...this.buildStageView()); break;
    }
  }

  // ── List View: existing sessions + start new ──────────────────────────────

  private buildListView(): HTMLElement[] {
    const els: HTMLElement[] = [];

    const header = this.buildHeader("🪄 AI精靈模式", () => this.callbacks.onBack());
    els.push(header);

    const intro = document.createElement("div");
    intro.className = "aiv-wizard-intro";
    intro.innerHTML = `
      <div class="aiv-wizard-intro-icon">✨</div>
      <div class="aiv-wizard-intro-text">
        <strong>一鍵完成全流程</strong><br>
        精靈將引導你完成故事大綱→分鏡腳本→圖像提示→影片提示，每個步驟自動生成內容。
      </div>`;
    els.push(intro);

    const newBtn = document.createElement("button");
    newBtn.className = "aiv-btn aiv-btn-wizard-start";
    newBtn.innerHTML = "✨ 開始新的精靈工作階段";
    newBtn.addEventListener("click", () => {
      this.phase = "setup";
      this.render();
    });
    els.push(newBtn);

    // Load existing sessions
    const listPlaceholder = document.createElement("div");
    els.push(listPlaceholder);

    getWizardSessions().then((sessions) => {
      if (sessions.length === 0) return;

      const sectionLabel = document.createElement("div");
      sectionLabel.className = "aiv-section-label";
      sectionLabel.style.marginTop = "12px";
      sectionLabel.textContent = "📂 歷史工作階段";
      listPlaceholder.appendChild(sectionLabel);

      sessions.forEach((s) => {
        const item = document.createElement("div");
        item.className = "aiv-wizard-session-item";

        const completedCount = Object.values(s.stages).filter((r) => r?.completed).length;
        const totalStages = WIZARD_STAGE_ORDER.length;

        item.innerHTML = `
          <div class="aiv-wizard-session-title">${this.esc(s.setup.projectName)}</div>
          <div class="aiv-wizard-session-meta">
            進度 ${completedCount}/${totalStages} 步驟 ·
            ${new Date(s.updatedAt).toLocaleDateString("zh-TW")}
          </div>
          <div class="aiv-wizard-progress-bar">
            <div class="aiv-wizard-progress-fill" style="width:${(completedCount / totalStages) * 100}%"></div>
          </div>`;

        const btnRow = document.createElement("div");
        btnRow.className = "aiv-wizard-session-actions";

        const resumeBtn = document.createElement("button");
        resumeBtn.className = "aiv-btn aiv-btn-outline";
        resumeBtn.style.fontSize = "11px";
        resumeBtn.textContent = s.currentStage === "complete" ? "📋 檢視" : "▶ 繼續";
        resumeBtn.addEventListener("click", () => {
          this.session = s;
          this.currentStageIdx = s.currentStage === "complete"
            ? WIZARD_STAGE_ORDER.length - 1
            : Math.max(0, WIZARD_STAGE_ORDER.indexOf(s.currentStage as WizardStageId));
          this.phase = "stage";
          this.render();
        });

        const delBtn = document.createElement("button");
        delBtn.className = "aiv-btn aiv-btn-outline";
        delBtn.style.fontSize = "11px";
        delBtn.style.color = "var(--aiv-error)";
        delBtn.textContent = "🗑 刪除";
        delBtn.addEventListener("click", () => {
          deleteWizardSession(s.id).then(() => this.render());
        });

        btnRow.append(resumeBtn, delBtn);
        item.appendChild(btnRow);
        listPlaceholder.appendChild(item);
      });
    });

    return els;
  }

  // ── Setup View: fill project info ─────────────────────────────────────────

  private buildSetupView(): HTMLElement[] {
    const els: HTMLElement[] = [];

    const header = this.buildHeader("✨ 新精靈工作階段", () => {
      this.phase = "list";
      this.render();
    });
    els.push(header);

    const form = document.createElement("div");
    form.className = "aiv-wizard-setup-form";

    const fields: { label: string; key: keyof WizardSetup; placeholder: string; type?: string }[] = [
      { label: "專案名稱",    key: "projectName",     placeholder: "例：我的短影片企劃" },
      { label: "初始想法",    key: "initialIdea",     placeholder: "簡單描述故事主題或想法…",    type: "textarea" },
      { label: "目標風格",    key: "targetStyle",     placeholder: "例：吉卜力風格、賽博龐克、寫實電影感" },
      { label: "目標平台",    key: "targetPlatforms", placeholder: "例：TikTok、YouTube Shorts、Instagram" },
      { label: "圖像生成工具", key: "imageTool",       placeholder: "例：Midjourney、Flux、Stable Diffusion" },
      { label: "影片生成工具", key: "videoTool",       placeholder: "例：Kling、Sora、Runway、Veo" },
    ];

    // Pre-fill with defaults so the user can start immediately
    const values: WizardSetup = { ...DEFAULT_WIZARD_SETUP };

    fields.forEach(({ label, key, placeholder, type }) => {
      const group = document.createElement("div");
      group.className = "aiv-var-group";

      const lbl = document.createElement("label");
      lbl.className = "aiv-var-label";
      lbl.textContent = label;
      group.appendChild(lbl);

      if (type === "textarea") {
        const ta = document.createElement("textarea");
        ta.className = "aiv-var-input aiv-wizard-textarea";
        ta.placeholder = placeholder;
        ta.rows = 3;
        ta.value = values[key];
        ta.addEventListener("input", () => { values[key] = ta.value; });
        group.appendChild(ta);
      } else {
        const inp = document.createElement("input");
        inp.className = "aiv-var-input";
        inp.type = "text";
        inp.placeholder = placeholder;
        inp.value = values[key];
        inp.addEventListener("input", () => { values[key] = inp.value; });
        group.appendChild(inp);
      }

      form.appendChild(group);
    });

    els.push(form);

    const startBtn = document.createElement("button");
    startBtn.className = "aiv-btn aiv-btn-wizard-start";
    startBtn.innerHTML = "🚀 開始生成第一步：故事大綱";
    startBtn.addEventListener("click", async () => {
      const setup: WizardSetup = {
        projectName: (values.projectName as string ?? "").trim() || "未命名專案",
        initialIdea: (values.initialIdea as string ?? "").trim(),
        targetStyle: (values.targetStyle as string ?? "").trim(),
        targetPlatforms: (values.targetPlatforms as string ?? "").trim(),
        imageTool: (values.imageTool as string ?? "").trim() || "Midjourney",
        videoTool: (values.videoTool as string ?? "").trim() || "Kling",
      };

      if (!setup.initialIdea) {
        this.callbacks.onToast("請填入初始想法", "error");
        return;
      }

      const now = Date.now();
      const session: WizardSession = {
        id: crypto.randomUUID(),
        setup,
        currentStage: "story",
        stages: {},
        createdAt: now,
        updatedAt: now,
      };

      await createWizardSession(session);
      this.session = session;
      this.currentStageIdx = 0;
      this.phase = "stage";
      this.render();

      // Auto-start generation
      setTimeout(() => this.handleGenerate(), 100);
    });

    els.push(startBtn);
    return els;
  }

  // ── Stage View: show/edit one stage ──────────────────────────────────────

  private buildStageView(): HTMLElement[] {
    const els: HTMLElement[] = [];
    if (!this.session) return els;

    const stageId = WIZARD_STAGE_ORDER[this.currentStageIdx];
    if (!stageId) return els;

    const meta = WIZARD_STAGE_META[stageId];
    const stageResult = this.session.stages[stageId];

    const header = this.buildHeader(
      `${meta.icon} ${meta.name}`,
      () => { this.phase = "list"; this.render(); }
    );
    els.push(header);

    // Progress bar
    const progressWrap = document.createElement("div");
    progressWrap.className = "aiv-wizard-progress-wrap";

    WIZARD_STAGE_ORDER.forEach((sid, idx) => {
      const m = WIZARD_STAGE_META[sid];
      const isDone = !!this.session!.stages[sid]?.completed;
      const isCurrent = idx === this.currentStageIdx;

      const step = document.createElement("div");
      step.className = "aiv-wizard-step" +
        (isDone ? " done" : "") +
        (isCurrent ? " current" : "");
      step.innerHTML = `
        <div class="aiv-wizard-step-dot">${isDone ? "✓" : m.icon}</div>
        <div class="aiv-wizard-step-name">${m.name}</div>`;

      step.addEventListener("click", () => {
        if (isDone || isCurrent) {
          this.currentStageIdx = idx;
          this.render();
        }
      });

      progressWrap.appendChild(step);

      if (idx < WIZARD_STAGE_ORDER.length - 1) {
        const sep = document.createElement("div");
        sep.className = "aiv-wizard-step-sep" + (isDone ? " done" : "");
        progressWrap.appendChild(sep);
      }
    });

    els.push(progressWrap);

    // Stage desc
    const descEl = document.createElement("div");
    descEl.className = "aiv-wizard-stage-desc";
    descEl.innerHTML = `<strong>${meta.name}</strong> — ${meta.desc}`;
    els.push(descEl);

    // Previous stage context (collapsible)
    if (this.currentStageIdx > 0) {
      const prevStageId = WIZARD_STAGE_ORDER[this.currentStageIdx - 1];
      if (prevStageId) {
        const prevResult = this.session.stages[prevStageId];
        if (prevResult) {
          const prevMeta = WIZARD_STAGE_META[prevStageId];
          els.push(this.buildCollapsible(`📎 上一步：${prevMeta.name}`, prevResult.finalContent));
        }
      }
    }

    // Editable prompt template (AI API prompt defaults)
    els.push(this.buildPromptEditor(stageId));

    // Content area
    const contentWrap = document.createElement("div");
    contentWrap.className = "aiv-wizard-content-wrap";

    if (stageResult) {
      // Show existing content, editable
      const label = document.createElement("div");
      label.className = "aiv-section-label";
      label.style.marginBottom = "4px";
      label.textContent = stageResult.completed ? "✅ 已完成 — 可直接編輯" : "✏️ 生成內容（可編輯）";
      contentWrap.appendChild(label);

      const textarea = document.createElement("textarea");
      textarea.className = "aiv-wizard-result-textarea";
      textarea.value = stageResult.finalContent;
      textarea.rows = 12;
      contentWrap.appendChild(textarea);

      // Button row
      const btnRow = document.createElement("div");
      btnRow.className = "aiv-btn-row";
      btnRow.style.flexWrap = "wrap";
      btnRow.style.gap = "6px";

      const regenBtn = document.createElement("button");
      regenBtn.className = "aiv-btn aiv-btn-outline";
      regenBtn.textContent = "🔄 重新生成";
      regenBtn.disabled = this.isGenerating;

      const copyBtn = document.createElement("button");
      copyBtn.className = "aiv-btn aiv-btn-outline";
      copyBtn.textContent = "📋 複製";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(textarea.value).then(() =>
          this.callbacks.onToast("已複製", "success")
        );
      });

      const sendBtn = document.createElement("button");
      sendBtn.className = "aiv-btn aiv-btn-send";
      sendBtn.textContent = "➤ 送出到 AI";
      sendBtn.addEventListener("click", () => {
        if (textarea.value.trim()) this.callbacks.onSendToAI(textarea.value);
      });

      btnRow.append(regenBtn, copyBtn, sendBtn);
      contentWrap.appendChild(btnRow);

      // Save & continue
      const isLastStage = this.currentStageIdx >= WIZARD_STAGE_ORDER.length - 1;
      const continueBtn = document.createElement("button");
      continueBtn.className = "aiv-btn aiv-btn-wizard-start";
      continueBtn.style.marginTop = "8px";
      continueBtn.textContent = isLastStage ? "🎉 完成全部流程！" : "✅ 儲存並繼續下一步 →";
      continueBtn.disabled = this.isGenerating;

      continueBtn.addEventListener("click", async () => {
        // Save edited content back
        const edited = textarea.value;
        const result: WizardStageResult = {
          ...stageResult,
          finalContent: edited,
          completed: true,
        };
        await updateWizardStage(this.session!.id, stageId, result);
        this.session!.stages[stageId] = result;

        if (isLastStage) {
          await updateWizardSession(this.session!.id, { currentStage: "complete" });
          this.session!.currentStage = "complete";
          this.callbacks.onToast("🎉 恭喜！所有提示詞已完成！", "success");
          this.phase = "list";
          this.render();
        } else {
          this.currentStageIdx++;
          const nextStageId = WIZARD_STAGE_ORDER[this.currentStageIdx];
          if (nextStageId) {
            await updateWizardSession(this.session!.id, { currentStage: nextStageId });
            this.session!.currentStage = nextStageId;
          }
          this.render();
          setTimeout(() => this.handleGenerate(), 100);
        }
      });

      contentWrap.appendChild(continueBtn);

      regenBtn.addEventListener("click", () => {
        this.handleGenerate();
      });

    } else {
      // No content yet — show generate button
      const genWrap = document.createElement("div");
      genWrap.className = "aiv-wizard-gen-wrap";
      genWrap.id = "aiv-wizard-gen-wrap";

      const genBtn = document.createElement("button");
      genBtn.id = "aiv-wizard-gen-btn";
      genBtn.className = "aiv-btn aiv-btn-wizard-start";
      genBtn.textContent = this.isGenerating ? "⏳ AI 生成中…" : `🤖 生成 ${meta.name}`;
      genBtn.disabled = this.isGenerating;
      genBtn.addEventListener("click", () => this.handleGenerate());

      if (this.isGenerating) {
        const spinner = document.createElement("div");
        spinner.className = "aiv-wizard-spinner";
        genWrap.appendChild(spinner);
      }

      genWrap.appendChild(genBtn);
      contentWrap.appendChild(genWrap);
    }

    els.push(contentWrap);
    return els;
  }

  // ── API Generation ─────────────────────────────────────────────────────────

  private async handleGenerate(): Promise<void> {
    if (!this.session || this.isGenerating) return;
    if (!this.apiConfig.enabled || !this.apiConfig[this.apiConfig.activeProvider]?.key) {
      this.callbacks.onToast("請先在設定中配置 API 金鑰", "error");
      return;
    }

    this.isGenerating = true;
    this.render();

    const stageId = WIZARD_STAGE_ORDER[this.currentStageIdx];
    if (!stageId) { this.isGenerating = false; return; }

    try {
      // Use user-edited custom prompt if available, otherwise build default
      const prompt = this.customPrompts[stageId] ?? this.buildPromptForStage(stageId);
      const generated = await this.callApi(prompt);

      const result: WizardStageResult = {
        generatedContent: generated,
        finalContent: generated,
        completed: false,
        generatedAt: Date.now(),
      };

      await updateWizardStage(this.session.id, stageId, result);
      this.session.stages[stageId] = result;

      this.callbacks.onToast(`${WIZARD_STAGE_META[stageId].name} 生成完成`, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.callbacks.onToast(`生成失敗：${msg}`, "error");
    } finally {
      this.isGenerating = false;
      this.render();
    }
  }

  private buildPromptForStage(stageId: WizardStageId): string {
    const s = this.session!;
    const setup = s.setup;

    const storyContent = s.stages["story"]?.finalContent ?? "";
    const storyboardContent = s.stages["storyboard"]?.finalContent ?? "";
    const imageGenContent = s.stages["image-gen"]?.finalContent ?? "";
    const imagePromptContent = s.stages["image-prompt"]?.finalContent ?? "";

    switch (stageId) {
      case "story":
        return buildStoryPrompt(setup);
      case "storyboard":
        return buildStoryboardPrompt(setup, storyContent);
      case "image-gen":
        return buildImageGenPrompt(setup, storyboardContent);
      case "image-prompt":
        return buildImagePromptOptimize(setup, imageGenContent);
      case "video-prompt":
        return buildVideoPrompt(setup, storyboardContent, imagePromptContent);
    }
  }

  private async callApi(prompt: string): Promise<string> {
    const cfg = this.apiConfig;
    const p = cfg.activeProvider;
    const ps = cfg[p];
    if (!ps.key) throw new Error("尚未設定 API 金鑰");

    const userPrompt = `請立即依照以下格式生成指定內容：\n\n${prompt}`;

    return p === "openrouter"
      ? this.callOpenRouter(ps, userPrompt)
      : this.callGemini(ps, cfg.thinkingEnabled, userPrompt);
  }

  private async callGemini(ps: ProviderSettings, thinking: boolean, prompt: string): Promise<string> {
    const url = `${ps.endpoint.replace(/\/$/, "")}/models/${ps.model}:generateContent?key=${encodeURIComponent(ps.key)}`;
    const body: Record<string, unknown> = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: prompt }] }],
    };
    if (thinking) body.generationConfig = { thinkingConfig: { thinkingBudget: 8192 } };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).substring(0, 200)}`);
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
    if (!text) throw new Error("API 回應格式異常");
    return text;
  }

  private async callOpenRouter(ps: ProviderSettings, prompt: string): Promise<string> {
    const url = ps.endpoint.replace(/\/$/, "") + "/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ps.key}`,
        "HTTP-Referer": "https://github.com/stevenke1981/ai-video-assistant",
        "X-Title": "AI Video Assistant",
      },
      body: JSON.stringify({
        model: ps.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).substring(0, 200)}`);
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("API 回應格式異常");
    return text;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildHeader(title: string, onBack: () => void): HTMLElement {
    const el = document.createElement("div");
    el.className = "aiv-detail-header";

    const back = document.createElement("button");
    back.className = "aiv-back-btn";
    back.innerHTML = "‹";
    back.addEventListener("click", onBack);

    const titleEl = document.createElement("div");
    titleEl.className = "aiv-detail-title";
    titleEl.textContent = title;

    el.append(back, titleEl);
    return el;
  }

  private buildPromptEditor(stageId: WizardStageId): HTMLElement {
    const defaultPrompt = this.buildPromptForStage(stageId);
    const currentPrompt = this.customPrompts[stageId] ?? defaultPrompt;
    const isCustomized = !!this.customPrompts[stageId];

    const wrap = document.createElement("details");
    wrap.className = "aiv-wizard-collapsible";

    const summary = document.createElement("summary");
    summary.className = "aiv-wizard-collapsible-title aiv-wizard-prompt-title";
    summary.innerHTML = isCustomized
      ? `📝 AI Prompt 模板 <span class="aiv-wizard-prompt-badge">已自訂</span>`
      : `📝 AI Prompt 模板（預設）`;
    wrap.appendChild(summary);

    const body = document.createElement("div");
    body.className = "aiv-wizard-collapsible-body";
    body.style.padding = "0";

    const ta = document.createElement("textarea");
    ta.className = "aiv-wizard-prompt-textarea";
    ta.value = currentPrompt;
    ta.rows = 10;
    ta.addEventListener("input", () => {
      const val = ta.value;
      if (val.trim() === defaultPrompt.trim()) {
        delete this.customPrompts[stageId];
        summary.innerHTML = `📝 AI Prompt 模板（預設）`;
      } else {
        this.customPrompts[stageId] = val;
        summary.innerHTML = `📝 AI Prompt 模板 <span class="aiv-wizard-prompt-badge">已自訂</span>`;
      }
    });
    body.appendChild(ta);

    const footer = document.createElement("div");
    footer.className = "aiv-wizard-prompt-footer";

    const resetBtn = document.createElement("button");
    resetBtn.className = "aiv-btn aiv-btn-outline";
    resetBtn.style.fontSize = "11px";
    resetBtn.textContent = "↺ 恢復預設";
    resetBtn.addEventListener("click", () => {
      ta.value = defaultPrompt;
      delete this.customPrompts[stageId];
      summary.innerHTML = `📝 AI Prompt 模板（預設）`;
      this.callbacks.onToast("已恢復預設 Prompt", "info");
    });

    const hint = document.createElement("span");
    hint.className = "aiv-wizard-prompt-hint";
    hint.textContent = "修改後下次生成將使用此 Prompt";

    footer.append(resetBtn, hint);
    body.appendChild(footer);
    wrap.appendChild(body);
    return wrap;
  }

  private buildCollapsible(label: string, content: string): HTMLElement {
    const wrap = document.createElement("details");
    wrap.className = "aiv-wizard-collapsible";

    const summary = document.createElement("summary");
    summary.className = "aiv-wizard-collapsible-title";
    summary.textContent = label;

    const body = document.createElement("div");
    body.className = "aiv-wizard-collapsible-body";
    body.textContent = content;

    wrap.append(summary, body);
    return wrap;
  }

  private esc(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
