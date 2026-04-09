/**
 * Adapter registry — auto-registers all platform adapters
 */
import { __registerAdapter, detectAdapter } from "./base";
import { GrokAdapter } from "./grok";
import { GeminiAdapter } from "./gemini";
import { ChatGPTAdapter } from "./chatgpt";
import { ClaudeAdapter } from "./claude";

__registerAdapter(new GrokAdapter());
__registerAdapter(new GeminiAdapter());
__registerAdapter(new ChatGPTAdapter());
__registerAdapter(new ClaudeAdapter());

export { detectAdapter };
export type { PlatformAdapter } from "./base";
