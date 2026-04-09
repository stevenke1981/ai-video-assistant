/**
 * Storage layer for AI Wizard Mode sessions
 */

import { WizardSession, WizardStageId, WizardStageResult } from "../models/wizard";

const KEY = "aiv_wizard_sessions";
const ACTIVE_KEY = "aiv_wizard_active";
const MAX_SESSIONS = 20;

function get<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result[key] as T));
  });
}

function set(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

export async function getWizardSessions(): Promise<WizardSession[]> {
  return (await get<WizardSession[]>(KEY)) ?? [];
}

export async function saveWizardSessions(sessions: WizardSession[]): Promise<void> {
  await set(KEY, sessions);
}

export async function createWizardSession(session: WizardSession): Promise<void> {
  const sessions = await getWizardSessions();
  sessions.unshift(session);
  if (sessions.length > MAX_SESSIONS) sessions.length = MAX_SESSIONS;
  await saveWizardSessions(sessions);
  await set(ACTIVE_KEY, session.id);
}

export async function updateWizardSession(
  id: string,
  updates: Partial<WizardSession>
): Promise<void> {
  const sessions = await getWizardSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const current = sessions[idx];
  if (!current) return;
  sessions[idx] = { ...current, ...updates, updatedAt: Date.now() };
  await saveWizardSessions(sessions);
}

export async function updateWizardStage(
  sessionId: string,
  stageId: WizardStageId,
  result: WizardStageResult
): Promise<void> {
  const sessions = await getWizardSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;
  const current = sessions[idx];
  if (!current) return;
  sessions[idx] = {
    ...current,
    stages: { ...current.stages, [stageId]: result },
    updatedAt: Date.now(),
  };
  await saveWizardSessions(sessions);
}

export async function getActiveWizardSession(): Promise<WizardSession | null> {
  const id = await get<string>(ACTIVE_KEY);
  if (!id) return null;
  const sessions = await getWizardSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export async function setActiveWizardSession(id: string): Promise<void> {
  await set(ACTIVE_KEY, id);
}

export async function deleteWizardSession(id: string): Promise<void> {
  const sessions = await getWizardSessions();
  await saveWizardSessions(sessions.filter((s) => s.id !== id));
}
