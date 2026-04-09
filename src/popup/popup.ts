/**
 * Popup script for AI 影片製作助手
 */

const SUPPORTED_ORIGINS = [
  "x.com",
  "grok.com",
  "gemini.google.com",
  "chatgpt.com",
  "claude.ai",
];

function isSupportedTab(tab: chrome.tabs.Tab): boolean {
  try {
    const url = new URL(tab.url ?? "");
    return SUPPORTED_ORIGINS.some((o) => url.hostname === o || url.hostname.endsWith(`.${o}`));
  } catch {
    return false;
  }
}

async function sendToTab(tabId: number, action: string): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { action });
  } catch {
    // Content script not ready or tab not supported — ignore
  }
}

document.getElementById("btn-open")?.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    if (tab?.id !== undefined) {
      if (!isSupportedTab(tab)) {
        alert("請先切換到支援的 AI 平台（Grok / Gemini / ChatGPT / Claude）");
        return;
      }
      await sendToTab(tab.id, "toggle-sidebar");
      window.close();
    }
  });
});

document.getElementById("btn-history")?.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    if (tab?.id !== undefined) {
      if (!isSupportedTab(tab)) {
        alert("請先切換到支援的 AI 平台（Grok / Gemini / ChatGPT / Claude）");
        return;
      }
      await sendToTab(tab.id, "open-history");
      window.close();
    }
  });
});
