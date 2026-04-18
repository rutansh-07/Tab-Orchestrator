import { handleTabUpdate } from './orchestrator.js';
import { getActiveWorkspace, getFocusMode, getWorkspaceMappings, saveWorkspaceMappings } from './storage.js';

/**
 * Main Background Service Worker
 */

// Colors for Tab Groups
const GROUP_COLORS = {
  'Development': 'blue',
  'Research': 'purple',
  'Finance': 'green',
  'Personal': 'pink',
  'General': 'grey'
};

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    await processTab(tabId, tab);
  }
});

// Process a tab and apply Focus Mode logic if active
async function processTab(tabId, tab) {
  const workspace = await handleTabUpdate(tabId, tab);
  if (!workspace) return;
  
  const focusMode = await getFocusMode();
  if (focusMode) {
    await applyFocusMode();
  } else {
    // If focus mode isn't purely active dynamically, ensure no stray grouping happens.
    // Usually ungroupAllTabs() happens on explicit toggle off, so we only need to ignore grouping here.
  }
}

// Applies Focus Mode logic across all tabs in current window
export async function applyFocusMode() {
  const activeWorkspace = await getActiveWorkspace();
  const mappings = await getWorkspaceMappings();
  const tabs = await chrome.tabs.query({ currentWindow: true });
  
  // Clean up stale mappings
  const liveTabIds = new Set(tabs.map(t => t.id));
  let mappingsChanged = false;
  for (const tid of Object.keys(mappings)) {
    if (!liveTabIds.has(parseInt(tid))) {
      delete mappings[tid];
      mappingsChanged = true;
    }
  }
  if (mappingsChanged) {
    await saveWorkspaceMappings(mappings);
  }

  // Organize by workspace
  const workspaceTabs = {};
  for (const tab of tabs) {
    const ws = mappings[tab.id] || 'General';
    if (!workspaceTabs[ws]) workspaceTabs[ws] = [];
    workspaceTabs[ws].push(tab.id);
  }
  
  // We need to manage Chrome native tab groups.
  // First, find existing groups if any
  const existingGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  const existingGroupTitles = {};
  existingGroups.forEach(g => {
    if (g.title) existingGroupTitles[g.title] = g.id;
  });

  for (const [ws, tabIds] of Object.entries(workspaceTabs)) {
    if (tabIds.length === 0) continue;
    
    try {
      // Group the tabs
      const groupId = await chrome.tabs.group({ tabIds: tabIds });
      
      // Configure the group
      await chrome.tabGroups.update(groupId, {
        title: ws,
        color: GROUP_COLORS[ws] || 'grey',
        collapsed: ws !== activeWorkspace // Collapse if not active!
      });
      
    } catch (e) {
      console.warn(`Failed to group tabs for ${ws}:`, e);
    }
  }
}

// Ungroups all tabs in the current window
export async function ungroupAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    // Filter out tabs that are actually in a group (groupId > -1)
    const groupedTabIds = tabs.filter(t => t.groupId > -1).map(t => t.id);
    if (groupedTabIds.length > 0) {
      await chrome.tabs.ungroup(groupedTabIds);
    }
  } catch (e) {
    console.warn("Failed to ungroup tabs:", e);
  }
}

// Expose refresh to Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'refreshFocusMode') {
    getFocusMode().then(focusMode => {
      if (focusMode) {
        applyFocusMode().then(() => sendResponse({ success: true }));
      } else {
        ungroupAllTabs().then(() => sendResponse({ success: true }));
      }
    });
    return true; // Keep message channel open for async response
  }
});
