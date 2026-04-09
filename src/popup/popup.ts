/**
 * Popup script for AI 影片製作助手
 */

document.getElementById("btn-open")?.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab?.id !== undefined) {
      chrome.tabs.sendMessage(tab.id, { action: "toggle-sidebar" });
      window.close();
    }
  });
});

document.getElementById("btn-history")?.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab?.id !== undefined) {
      chrome.tabs.sendMessage(tab.id, { action: "open-history" });
      window.close();
    }
  });
});
