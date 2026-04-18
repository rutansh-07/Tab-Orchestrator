import { getActiveWorkspace, saveActiveWorkspace, getFocusMode, saveFocusMode, getTheme, saveTheme, getCustomWorkspaces, saveCustomWorkspaces } from '../background/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const focusToggle = document.getElementById('focusToggle');
  const workspaceSelect = document.getElementById('workspaceSelect');
  const themeToggle = document.getElementById('themeToggle');
  const addWorkspaceBtn = document.getElementById('addWorkspaceBtn');
  const addWorkspaceDiv = document.getElementById('addWorkspaceDiv');
  const newWorkspaceInput = document.getElementById('newWorkspaceInput');
  const saveWorkspaceBtn = document.getElementById('saveWorkspaceBtn');
  const removeWorkspaceBtn = document.getElementById('removeWorkspaceBtn');
  
  // Load state
  const currentFocus = await getFocusMode();
  const currentTheme = await getTheme();
  
  // Load custom workspaces into dropdown
  let customWorkspaces = await getCustomWorkspaces();
  customWorkspaces.forEach(ws => {
    const opt = document.createElement('option');
    opt.value = ws;
    opt.textContent = ws;
    workspaceSelect.appendChild(opt);
  });

  const currentWorkspace = await getActiveWorkspace();
  focusToggle.checked = currentFocus;
  workspaceSelect.value = currentWorkspace;
  setTheme(currentTheme);
  
  // Toggle remove button visibility
  removeWorkspaceBtn.style.display = customWorkspaces.includes(currentWorkspace) ? 'flex' : 'none';
  
  // Attach listeners
  addWorkspaceBtn.addEventListener('click', () => {
    addWorkspaceDiv.style.display = addWorkspaceDiv.style.display === 'none' ? 'flex' : 'none';
    if (addWorkspaceDiv.style.display === 'flex') {
      newWorkspaceInput.focus();
    }
  });

  removeWorkspaceBtn.addEventListener('click', async () => {
    const ws = workspaceSelect.value;
    if (customWorkspaces.includes(ws)) {
      customWorkspaces = customWorkspaces.filter(w => w !== ws);
      await saveCustomWorkspaces(customWorkspaces);
      
      const optionToRemove = workspaceSelect.querySelector(`option[value="${ws}"]`);
      if (optionToRemove) optionToRemove.remove();
      
      workspaceSelect.value = "General";
      await saveActiveWorkspace("General");
      removeWorkspaceBtn.style.display = 'none';
      
      if (await getFocusMode()) {
        triggerRefresh();
      }
    }
  });

  saveWorkspaceBtn.addEventListener('click', async () => {
    const newWs = newWorkspaceInput.value.trim();
    if (newWs && !customWorkspaces.includes(newWs)) {
      customWorkspaces.push(newWs);
      await saveCustomWorkspaces(customWorkspaces);
      
      const opt = document.createElement('option');
      opt.value = newWs;
      opt.textContent = newWs;
      workspaceSelect.appendChild(opt);
      
      workspaceSelect.value = newWs;
      await saveActiveWorkspace(newWs);
      removeWorkspaceBtn.style.display = 'flex';
      
      newWorkspaceInput.value = '';
      addWorkspaceDiv.style.display = 'none';
      
      if (await getFocusMode()) {
        triggerRefresh();
      }
    }
  });

  newWorkspaceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveWorkspaceBtn.click();
    }
  });

  themeToggle.addEventListener('click', async () => {
    const isLight = document.documentElement.dataset.theme === 'light';
    const newTheme = isLight ? 'dark' : 'light';
    setTheme(newTheme);
    await saveTheme(newTheme);
  });

  focusToggle.addEventListener('change', async (e) => {
    const isFocus = e.target.checked;
    await saveFocusMode(isFocus);
    triggerRefresh();
  });
  
  workspaceSelect.addEventListener('change', async (e) => {
    const ws = e.target.value;
    await saveActiveWorkspace(ws);
    removeWorkspaceBtn.style.display = customWorkspaces.includes(ws) ? 'flex' : 'none';
    
    // If focus mode is active, switching workspace should reorganize tabs immediately
    const isFocus = await getFocusMode();
    if (isFocus) {
      triggerRefresh();
    }
  });
});

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('themeToggle');
  if (theme === 'light') {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  } else {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
}

function triggerRefresh() {
  chrome.runtime.sendMessage({ action: 'refreshFocusMode' }, (response) => {
    if (chrome.runtime.lastError) {
      // Background script may not have loaded yet or no active tab
      console.warn("Could not reach background script:", chrome.runtime.lastError);
    }
  });
}
