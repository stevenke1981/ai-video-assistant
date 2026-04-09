/**
 * sidebar.ts — Content script entry point
 * Injects the AI Video Assistant sidebar into supported AI platforms.
 */

import { detectAdapter } from "../adapters";
import { initDefaults, getSettings, saveSettings } from "../storage/workflows";
import { WorkflowUI, UICallbacks } from "./workflow-ui";
import type { StoryProject } from "../models/workflow";

const SIDEBAR_ROOT_ID = "aiv-root";
const SHADOW_HOST_ID = "aiv-shadow-host";

class SidebarController {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private panel: HTMLElement | null = null;
  private ui: WorkflowUI | null = null;
  private visible = false;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Load defaults from bundled JSON
    const baseUrl = chrome.runtime.getURL("defaults.json");
    await initDefaults(baseUrl);

    this.buildDOM();
    this.setupMessageListener();
    this.setupKeyboardShortcut();
  }

  private buildDOM(): void {
    // Shadow host element — isolated from page styles
    this.host = document.createElement("div");
    this.host.id = SHADOW_HOST_ID;
    this.host.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 0;
      height: 100vh;
      z-index: 2147483647;
      pointer-events: none;`;

    this.shadow = this.host.attachShadow({ mode: "open" });

    // Inject CSS into shadow root
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("sidebar.css");
    this.shadow.appendChild(link);

    // Sidebar panel
    this.panel = document.createElement("div");
    this.panel.id = SIDEBAR_ROOT_ID;
    this.panel.className = "aiv-sidebar";
    this.panel.style.cssText = `
      position: fixed;
      top: 0;
      right: -400px;
      width: 360px;
      height: 100vh;
      pointer-events: all;
      transition: right 0.25s cubic-bezier(.4,0,.2,1);
      overflow: hidden;`;

    this.shadow.appendChild(this.panel);
    document.documentElement.appendChild(this.host);
  }

  private async show(): Promise<void> {
    if (!this.panel) return;

    const settings = await getSettings();

    if (!this.ui) {
      const adapter = detectAdapter();
      const platform = adapter?.name ?? "unknown";

      const callbacks: UICallbacks = {
        onSendToAI: (text: string) => {
          const a = detectAdapter();
          if (a) a.sendMessage(text);
        },
        onCaptureImage: () => {
          const a = detectAdapter();
          return a?.getLastImageUrl?.() ?? null;
        },
        onExportProject: (project: StoryProject) => {
          this.exportProject(project);
        },
        onClose: () => this.hide(),
      };

      this.ui = new WorkflowUI(this.panel, callbacks, platform);
      await this.ui.init();
    }

    const w = settings.sidebarWidth ?? 360;
    this.panel.style.width = `${w}px`;
    this.panel.style.right = "0";
    this.host!.style.width = `${w}px`;
    this.panel.style.setProperty("--aiv-w", `${w}px`);
    this.visible = true;

    // Shift page content if setting enabled
    if (settings.autoShiftPage) {
      document.body.style.marginRight = `${w}px`;
      document.body.style.transition = "margin-right 0.25s cubic-bezier(.4,0,.2,1)";
    }
  }

  private hide(): void {
    if (!this.panel) return;
    this.panel.style.right = `-${this.panel.offsetWidth + 20}px`;
    this.host!.style.width = "0";
    this.visible = false;
    document.body.style.marginRight = "";
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  setVisible(show: boolean): void {
    if (show) this.show();
    else this.hide();
  }

  openHistory(): void {
    if (!this.visible) this.show().then(() => {
      // WorkflowUI exposes internal nav via a method we forward via message
    });
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.action === "toggle-sidebar") {
        this.toggle();
        sendResponse({ ok: true });
      }
      if (msg.action === "open-history") {
        this.openHistory();
        sendResponse({ ok: true });
      }
      return false;
    });
  }

  private setupKeyboardShortcut(): void {
    // Extension command fires through background; this is a fallback for dev
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === "V") {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  private exportProject(project: StoryProject): void {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name || "project"}_${Date.now()}.json`;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// Boot
const controller = new SidebarController();
controller.init().catch(console.error);
