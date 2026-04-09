/**
 * Gemini platform adapter
 */
import { PlatformAdapter, dispatchInput, setContentEditableText } from "./base";

export class GeminiAdapter implements PlatformAdapter {
  name = "Gemini";

  matchUrl(url: string): boolean {
    return url.startsWith("https://gemini.google.com");
  }

  getInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>(".ql-editor[contenteditable='true']") ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]') ??
      document.querySelector<HTMLElement>("rich-textarea .ql-editor") ??
      document.querySelector<HTMLElement>(".input-area-container textarea")
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
      document.querySelector<HTMLElement>("button.send-button") ??
      document.querySelector<HTMLElement>('button[aria-label="Send message"]') ??
      document.querySelector<HTMLElement>('button[aria-label="傳送訊息"]') ??
      document.querySelector<HTMLElement>('button[mattooltip="Send message"]');
    if (sendBtn) { sendBtn.click(); return; }
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }

  getTheme(): "light" | "dark" {
    return document.documentElement.getAttribute("dark") !== null ||
      document.body.classList.contains("dark-theme") ? "dark" : "light";
  }

  getLastImageUrl(): string | null {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(
      'img[src*="googleusercontent"], img[src^="blob:"]'
    )).filter(img => img.naturalWidth > 200);
    return imgs.length > 0 ? (imgs[imgs.length - 1]?.src ?? null) : null;
  }
}
