import { sanitizeUrl, sanitizeTitle } from './security.js';
import { getWorkspaceMappings, saveWorkspaceMappings, getCustomWorkspaces } from './storage.js';

/**
 * Orchestrator - Clustering Engine
 */

const WORKSPACES = {
  DEV: 'Development',
  RESEARCH: 'Research',
  FINANCE: 'Finance',
  PERSONAL: 'Personal',
  GENERAL: 'General'
};

const KEYWORD_RULES = {
  [WORKSPACES.DEV]: /localhost|127\.0\.0\.1|github|gitlab|stackoverflow|dev\.to|vscode|aws|azure|gcp|vercel|netlify|supabase/i,
  [WORKSPACES.RESEARCH]: /wikipedia|scholar|arxiv|researchgate|sciencedirect|pubmed|medium|towardsdatascience/i,
  [WORKSPACES.FINANCE]: /bank|chase|paypal|stripe|crypto|binance|coinbase|robinhood|mint|fidelity|vanguard/i,
  [WORKSPACES.PERSONAL]: /youtube|netflix|spotify|reddit|twitter|instagram|facebook|amazon|movies/i
};

// Check if window.ai (Gemini Nano) is available and functional
async function isLocalAIAvailable() {
  if (typeof window !== 'undefined' && window.ai) {
    try {
      const capabilities = await window.ai.languageModel.capabilities();
      return capabilities.available === 'readily';
    } catch (e) {
      return false;
    }
  }
  return false;
}

// Fallback logic using deterministic regex
function ruleBasedClustering(cleanUrl, cleanTitle, customWorkspaces = []) {
  const targetString = `${cleanUrl} ${cleanTitle}`.toLowerCase();
  
  // Try custom workspaces first by string matching
  for (const ws of customWorkspaces) {
    if (targetString.includes(ws.toLowerCase())) {
      return ws;
    }
  }

  for (const [workspace, regex] of Object.entries(KEYWORD_RULES)) {
    if (regex.test(targetString)) {
      return workspace;
    }
  }
  
  return WORKSPACES.GENERAL;
}

// Predict workspace intent
export async function predictWorkspace(tab) {
  // 1. Sanitize Data
  const cleanUrl = sanitizeUrl(tab.url || "");
  const cleanTitle = sanitizeTitle(tab.title || "");
  
  // Skip internal chrome pages
  if (!cleanUrl || cleanUrl.startsWith('chrome://') || cleanUrl.startsWith('edge://') || cleanUrl.startsWith('about:')) {
    return WORKSPACES.GENERAL;
  }

  const customWorkspaces = await getCustomWorkspaces();
  const allWorkspaces = [...Object.values(WORKSPACES), ...customWorkspaces];
  const workspaceListStr = allWorkspaces.join(', ');

  // 2. Try Local AI if available
  const aiAvailable = await isLocalAIAvailable();
  
  if (aiAvailable) {
    try {
      const prompt = `Categorize this browser tab into exactly one of these workspaces: ${workspaceListStr}.
      URL: ${cleanUrl}
      Title: ${cleanTitle}
      Reply with only the workspace name.`;
      
      const session = await window.ai.languageModel.create();
      const response = await session.prompt(prompt);
      
      const prediction = response.trim();
      
      if (allWorkspaces.includes(prediction)) {
        return prediction;
      }
    } catch (e) {
      console.warn("Local AI classification failed. Falling back to rule-based engine.", e);
    }
  }
  
  // 3. Fallback to Rule-based
  return ruleBasedClustering(cleanUrl, cleanTitle, customWorkspaces);
}

// Orchestrate tab updates
export async function handleTabUpdate(tabId, tab) {
  if (tab.status !== 'complete' || !tab.url) return;
  
  // Predict workspace
  const workspace = await predictWorkspace(tab);
  
  // Update state mappings
  const mappings = await getWorkspaceMappings();
  mappings[tabId] = workspace;
  await saveWorkspaceMappings(mappings);
  
  return workspace;
}
