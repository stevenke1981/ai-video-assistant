/**
 * ChatGPT platform adapter
 */
import { PlatformAdapter, dispatchInput, setContentEditableText } from "./base";

export class ChatGPTAdapter implements PlatformAdapter {
  name = "ChatGPT";

  matchUrl(url: string): boolean {
    return url.startsWith("https://chatgpt.com");
  }

  getInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>("#prompt-textarea") ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]') ??
      document.querySelector<HTMLElement>("textarea")
    );
  }

  setText(el: HTMLElement, text: string): void {
    if (el instanceof HTMLTextAreaElement) {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (nativeSetter) nativeSetter.call(el, text); else el.value = text;
      dispatchInput(el);
    } else {
      setContentEditableText(el, text);
    }
  }

  submit(el: HTMLElement): void {
    const sendBtn =
      document.querySelector<HTMLElement>('button[data-testid="send-button"]') ??
      document.querySelector<HTMLElement>('button[aria-label="Send prompt"]');
    if (sendBtn) { sendBtn.click(); return; }
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }

  getTheme(): "light" | "dark" {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }

  getLastImageUrl(): string | null {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(
      'img[src*="oaidalleapiprodscus"], img[src*="openai"], img[src^="blob:"]'
    )).filter(img => img.naturalWidth > 200);
    return imgs.length > 0 ? (imgs[imgs.length - 1]?.src ?? null) : null;
  }
}
