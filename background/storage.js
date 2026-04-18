import { encryptData, decryptData } from './security.js';

/**
 * Storage Wrapper
 * Encrypts and decrypts state saved to chrome.storage.local
 */

export const WORKSPACE_MAPPINGS_KEY = "TO_WORKSPACE_MAPPINGS";
export const ACTIVE_WORKSPACE_KEY = "TO_ACTIVE_WORKSPACE";
export const FOCUS_MODE_KEY = "TO_FOCUS_MODE";
export const THEME_KEY = "TO_THEME";
export const CUSTOM_WORKSPACES_KEY = "TO_CUSTOM_WORKSPACES";

export async function saveWorkspaceMappings(mappings) {
  const encrypted = await encryptData(mappings);
  await chrome.storage.local.set({ [WORKSPACE_MAPPINGS_KEY]: encrypted });
}

export async function getWorkspaceMappings() {
  const result = await chrome.storage.local.get(WORKSPACE_MAPPINGS_KEY);
  if (!result[WORKSPACE_MAPPINGS_KEY]) return {};
  
  const decrypted = await decryptData(result[WORKSPACE_MAPPINGS_KEY]);
  return decrypted || {}; // returns empty object if decryption fails (e.g. key reset)
}

export async function saveActiveWorkspace(workspaceId) {
  await chrome.storage.local.set({ [ACTIVE_WORKSPACE_KEY]: workspaceId });
}

export async function getActiveWorkspace() {
  const result = await chrome.storage.local.get(ACTIVE_WORKSPACE_KEY);
  return result[ACTIVE_WORKSPACE_KEY] || "General";
}

export async function saveFocusMode(isActive) {
  await chrome.storage.local.set({ [FOCUS_MODE_KEY]: isActive });
}

export async function getFocusMode() {
  const result = await chrome.storage.local.get(FOCUS_MODE_KEY);
  return !!result[FOCUS_MODE_KEY];
}

export async function saveTheme(theme) {
  await chrome.storage.local.set({ [THEME_KEY]: theme });
}

export async function getTheme() {
  const result = await chrome.storage.local.get(THEME_KEY);
  return result[THEME_KEY] || "dark";
}

export async function getCustomWorkspaces() {
  const result = await chrome.storage.local.get(CUSTOM_WORKSPACES_KEY);
  return result[CUSTOM_WORKSPACES_KEY] || [];
}

export async function saveCustomWorkspaces(workspaces) {
  await chrome.storage.local.set({ [CUSTOM_WORKSPACES_KEY]: workspaces });
}

