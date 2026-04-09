/**
 * Claude platform adapter
 */
import { PlatformAdapter, setContentEditableText } from "./base";

export class ClaudeAdapter implements PlatformAdapter {
  name = "Claude";

  matchUrl(url: string): boolean {
    return url.startsWith("https://claude.ai");
  }

  getInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('div[contenteditable="true"].ProseMirror') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]')
    );
  }

  setText(el: HTMLElement, text: string): void {
    setContentEditableText(el, text);
  }

  submit(el: HTMLElement): void {
    const sendBtn =
      document.querySelector<HTMLElement>('button[aria-label="Send Message"]') ??
      document.querySelector<HTMLElement>('button[aria-label="Send message"]');
    if (sendBtn) { sendBtn.click(); return; }
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }

  getTheme(): "light" | "dark" {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  getLastImageUrl(): string | null {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(
      'img[src^="blob:"], .artifact img'
    )).filter(img => img.naturalWidth > 200);
    return imgs.length > 0 ? (imgs[imgs.length - 1]?.src ?? null) : null;
  }
}
