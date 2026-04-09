/**
 * Background Service Worker for AI 影片製作助手
 * Handles keyboard shortcut toggle and message routing.
 */

chrome.runtime.onInstalled.addListener(async () => {
  console.log("[aivideo] Extension installed.");
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-sidebar") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, { action: "toggle-sidebar" });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "open-tab") {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ ok: true });
  }
  return true;
});
