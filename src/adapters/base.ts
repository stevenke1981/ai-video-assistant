/**
 * Platform adapter interface and base utilities
 */

export interface PlatformAdapter {
  name: string;
  matchUrl(url: string): boolean;
  getInputElement(): HTMLElement | null;
  setText(element: HTMLElement, text: string): void;
  submit(element: HTMLElement): void;
  getTheme(): "light" | "dark";
  getLastImageUrl?(): string | null;
}

/** Dispatch native InputEvent so frameworks (React/Svelte) pick up the change */
export function dispatchInput(el: HTMLElement): void {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Safely set contenteditable innerHTML using textContent (prevents XSS) */
export function setContentEditableText(el: HTMLElement, text: string): void {
  el.innerHTML = "";
  const lines = text.split("\n");
  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = line;
    el.appendChild(p);
  }
  dispatchInput(el);
}

/**
 * Detect and return the appropriate platform adapter
 */
export function detectAdapter(): PlatformAdapter | null {
  const url = window.location.href;
  for (const adapter of ALL_ADAPTERS) {
    if (adapter.matchUrl(url)) return adapter;
  }
  return null;
}

let ALL_ADAPTERS: PlatformAdapter[] = [];

export function __registerAdapter(adapter: PlatformAdapter): void {
  ALL_ADAPTERS.push(adapter);
}

export function __clearAdapters(): void {
  ALL_ADAPTERS = [];
}
