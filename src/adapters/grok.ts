/**
 * Grok platform adapter — also handles image URL capture (Feature #2)
 */

import { PlatformAdapter, dispatchInput } from "./base";

export class GrokAdapter implements PlatformAdapter {
  name = "Grok";

  matchUrl(url: string): boolean {
    return /^https:\/\/(x\.com\/i\/grok|grok\.com)/.test(url);
  }

  getInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('textarea[data-testid="grokInput"]') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]') ??
      document.querySelector<HTMLElement>("textarea")
    );
  }

  setText(el: HTMLElement, text: string): void {
    if (el instanceof HTMLTextAreaElement) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      if (nativeSetter) nativeSetter.call(el, text);
      else el.value = text;
      dispatchInput(el);
    } else {
      el.textContent = text;
      dispatchInput(el);
    }
  }

  submit(el: HTMLElement): void {
    const sendBtn =
      document.querySelector<HTMLElement>('button[data-testid="sendButton"]') ??
      document.querySelector<HTMLElement>('button[aria-label="Send"]') ??
      document.querySelector<HTMLElement>('button[aria-label="送出"]');
    if (sendBtn) { sendBtn.click(); return; }
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }

  getTheme(): "light" | "dark" {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }

  /** Scan DOM for most recent generated image (Feature #2) */
  getLastImageUrl(): string | null {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(
      'img[src*="grok"], img[src*="x.com"], img[src^="blob:"], img[src*="pbs.twimg"]'
    )).filter(img => img.naturalWidth > 200);
    return imgs.length > 0 ? (imgs[imgs.length - 1]?.src ?? null) : null;
  }
}
