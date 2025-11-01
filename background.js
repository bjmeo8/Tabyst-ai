/**
 * background.js - Service Worker with DB and automatic indexing
 */

// Import direct (files must export)
import { db } from './db.js';
import { storage } from './storage.js';
import { TFIDF } from './tfidf.js';
import { getLiteSuggestions, buildTFIDFIndex, isAccessibleUrl } from './lite-mode.js';
import { getHybridSuggestions } from './hybrid-scoring.js';
import { FuzzySearch } from './fuzzy-search.js';
import { startColdStart, pauseColdStart } from './cold-start.js';
import { queueTabForIndexing, initOnlineSessions, areOnlineSessionsReady } from './online-indexing.js';
import { createBasicRelationships, applyRelationshipDecay } from './relationships.js';
import { updateWorkflows, getWorkflowSuggestions } from './workflows.js';

const navigationStack = [];
const fuzzySearch = new FuzzySearch();

// Initialisation au démarrage
chrome.runtime.onInstalled.addListener(async () => {
  console.log('ðŸš€ Taby: Installation/Mise Ã  jour');
  
  await db.init();
  await storage.init();
  
  console.log('âœ… Taby: Ready');
});

// Initialisation au démarrage du service worker
(async () => {
  try {
    await db.init();
    await storage.init();
    console.log('âœ… Taby: Service worker initialisé');
    
    // Decay quotidien des relationships
    applyRelationshipDecay();
    setInterval(() => applyRelationshipDecay(), 24 * 60 * 60 * 1000);
    
    // Update workflows every 6 hours
    updateWorkflows();
    setInterval(() => updateWorkflows(), 6 * 60 * 60 * 1000);
    
  } catch (error) {
    console.error('âŒ Taby: Error initialisation', error);
  }
})();

/**
 * Action principale (clic sur icône)
 */
chrome.action.onClicked.addListener(async (tab) => {
  // Clic sur icône = ouvre popup manuallement
  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 400,
    height: 600
  });
});

/**
 * Ã‰coute les commandes for ouvrir le modal
 */
chrome.commands.onCommand.addListener(async (command) => {
    if (command === "open-tabyst-modal") {
      // Cmd+Shift+L = ouvre modal Taby
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await openTabyModal(tab);
    } else if (command === "quick-return") {
      if (navigationStack.length > 0) {
        const previousTabInfo = navigationStack.pop();
        if (previousTabInfo && previousTabInfo.id) {
          chrome.tabs.update(previousTabInfo.id, { active: true });
          chrome.windows.update(previousTabInfo.windowId, { focused: true });
        }
      }
    } else if (command === "open-popup") {
      // Cmd+Shift+P = ouvre popup
      chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 400,
        height: 600
      });
    }
});

/**
 * Switch tab + tracking
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "switch-tab") {
    handleTabSwitch(request, sender);
    sendResponse({ success: true });
  } else if (request.action === "fuzzy-search") {
    // Recherche fuzzy en temps réel
    const results = fuzzySearch.search(request.query, 5);
    sendResponse({ results });
  } else if (request.action === "get-stats") {
    // Stats for popup
    getStats().then(stats => sendResponse({ stats }));
    return true;
  } else if (request.action === "get-cold-start-status") {
    // Status cold start
    getColdStartStatus().then(status => sendResponse(status));
    return true;
  } else if (request.action === "start-cold-start") {
    // Démarre cold start
    startColdStartHandler().then(() => sendResponse({ success: true }));
    return true;
  } else if (request.action === "pause-cold-start") {
    // Pause cold start
    pauseColdStartHandler().then(() => sendResponse({ success: true }));
    return true;
  } else if (request.action === "get-workflow-stats") {
    // Get workflow statistics
    getWorkflowStatsHandler().then(stats => sendResponse({ stats }));
    return true;
  }
  return true;
});

async function handleTabSwitch(request, sender) {
  // Push to navigation stack
  if (sender.tab) {
    if (navigationStack.length === 0 || navigationStack[navigationStack.length - 1].id !== sender.tab.id) {
      navigationStack.push({ id: sender.tab.id, windowId: sender.tab.windowId });
    }
    
    // Record la navigation in DB
    try {
      const fromTab = await db.getTabByTabId(sender.tab.id);
      const toTab = await db.getTabByTabId(request.tabId);
      
      if (fromTab && toTab) {
        await db.addNavigation({
          id: `nav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          fromTab: { tabId: fromTab.id, url: fromTab.url },
          toTab: { tabId: toTab.id, url: toTab.url },
          trigger: 'taby_suggestion',
          wasHelpful: true,
          durationOnTarget: 0,
          returnedToSource: false
        });
        
        // Crée/renforce relationship
        await createBasicRelationships(sender.tab.id, request.tabId, 'navigation');
      }
    } catch (error) {
      console.error('Error tracking navigation:', error);
    }
  }
  
  // Switch
  chrome.tabs.update(request.tabId, { active: true });
  if (request.windowId) {
    chrome.windows.update(request.windowId, { focused: true });
  }
  
  // Stats
  await storage.recordSwitch(true, 0);
}

/**
 * Listeners for tracking des tabs + indexation automatique
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log('ðŸ†• Nouveau tab créé:', tab.id);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log(`ðŸ”„ [Debug] Tab chargé: ${tab.title} (ID: ${tabId})`);
    
    // Ignore URLs système
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
      console.log('â­ï¸ [Online] URL système ignorée');
      return;
    }
    
    // Vérifie par URL (plus fiable que tabId qui change au redémarrage)
    const urlHash = await db.generateUrlHash(tab.url);
    const existingTab = await db.getTabByUrlHash(urlHash);
    
    console.log(`ðŸ” [Debug] URL ${tab.url} in DB:`, existingTab ? 'OUI' : 'NON');
    
    if (!existingTab) {
      // NOUVEAU tab uniquement
      console.log('ðŸ¤– [Online] Nouveau tab détecté');
      
      // Init sessions si nécessaire
      if (!areOnlineSessionsReady()) {
        await initOnlineSessions();
      }
      
      // Add Ã  la queue
      queueTabForIndexing(tab, 'normal');
    } else {
      // Met Ã  jour le tabId Chrome (peut avoir changé)
      if (existingTab.tabId !== tabId) {
        console.log(`ðŸ”„ [Online] Mise Ã  jour tabId: ${existingTab.tabId} â†’ ${tabId}`);
        await db.updateTab(existingTab.id, { tabId: tabId });
      }
      console.log(`â­ï¸ [Online] Tab existe déjÃ , pas d'indexation`);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  console.log('ðŸ—‘ï¸ Tab fermé:', tabId);
  
  // Marque comme inactif in la DB
  try {
    const dbEntry = await db.getTabByTabId(tabId);
    if (dbEntry) {
      await db.updateTab(dbEntry.id, {
        flags: {
          ...dbEntry.flags,
          isActive: false
        }
      });
    }
  } catch (error) {
    console.error('Error marquage tab inactif:', error);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await storage.setCurrentTab(activeInfo.tabId);
  console.log('âœ¨ Tab activé:', activeInfo.tabId);
  
  // Met Ã  jour lastAccessedAt
  try {
    const dbEntry = await db.getTabByTabId(activeInfo.tabId);
    if (dbEntry) {
      await db.updateTab(dbEntry.id, {
        lastAccessedAt: Date.now(),
        accessCount: (dbEntry.accessCount || 0) + 1
      });
    }
  } catch (error) {
    console.error('Error mise Ã  jour lastAccessed:', error);
  }
});

/**
 * Récupère suggestions for un tab
 */
async function getSuggestionsForTab(tabId) {
  try {
    // Get all tabs to check context
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const currentTab = allTabs.find(t => t.id === tabId);

    if (!currentTab) return allTabs;

    // Check if context has changed (tabs added/removed)
    const tabCount = allTabs.length;
    const lastKnownCount = await storage.getLastTabCount();
    const contextChanged = lastKnownCount !== null && lastKnownCount !== tabCount;

    // Check cache only if context hasn't changed
    if (!contextChanged) {
      const cached = await storage.getCachedSuggestions(tabId);
      if (cached && cached.length > 0) {
        console.log('✅ Using cached suggestions (context stable)');

        // Reconstruct full suggestion list from cache
        const cachedIds = new Set(cached.map(s => s.id));
        const otherTabs = allTabs.filter(t => t.id !== tabId && !cachedIds.has(t.id));

        // Merge: cached (scored & sorted) + others (unscored)
        return [...cached, ...otherTabs];
      }
    } else if (contextChanged) {
      console.log('🔄 Context changed, cache invalidated');
      await storage.clearSuggestionsCache();
    }

    // Update tab count for future context detection
    await storage.setLastTabCount(tabCount);

    // Check if AI data exists
    const hasAIData = await checkIfAnyTabsIndexd();

    // Récupère prédiction workflow (si disponible)
    const workflowSuggestions = await getWorkflowSuggestions(tabId);
    const workflowPrediction = workflowSuggestions.length > 0 ? {
      tab: workflowSuggestions[0],
      confidence: workflowSuggestions[0].score || 0.7,
      reason: workflowSuggestions[0].reason
    } : null;

    if (workflowPrediction) {
      console.log('🔮 Workflow prediction:', workflowPrediction.tab.title);
    }

    let suggestions;

    if (hasAIData) {
      // Mode Hybrid : utilise données AI + workflow bonus
      console.log('🎯 Mode Hybrid activated');
      suggestions = await getHybridSuggestions(currentTab, allTabs, workflowPrediction);
    } else {
      // Mode Lite : TF-IDF + comportement
      console.log('⚡ Mode Lite activated');
      suggestions = await getLiteSuggestions(currentTab, allTabs);

      // Ajoute workflow bonus en lite mode aussi
      if (workflowPrediction) {
        suggestions = suggestions.map(s => {
          if (s.id === workflowPrediction.tab.id) {
            return {
              ...s,
              score: s.score + (0.3 * workflowPrediction.confidence),
              reason: 'Part of workflow pattern'
            };
          }
          return s;
        });
        // Re-sort after bonus with stable sort
        suggestions.sort((a, b) => {
          const scoreDiff = b.score - a.score;
          return scoreDiff !== 0 ? scoreDiff : a.id - b.id;
        });
      }
    }
    
    // Get les tabs non scored
    const scoredIds = new Set(suggestions.map(s => s.id));
    const otherTabs = allTabs.filter(t => t.id !== tabId && !scoredIds.has(t.id));
    
    // Combine
    const allSuggestions = [...suggestions, ...otherTabs];
    
    // Cache top 10 for longer stability
    await storage.cacheSuggestions(tabId, suggestions.slice(0, 10));
    
    return allSuggestions;
    
  } catch (error) {
    console.error('Error suggestions:', error);
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    return allTabs.filter(t => t.id !== tabId);
  }
}

/**
 * Vérifie si au moins quelques tabs ont des données AI
 */
async function checkIfAnyTabsIndexd() {
  try {
    const stats = await db.getStats();
    return stats.tabs.indexed > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Récupère les stats for le popup
 */
async function getStats() {
  return await db.getStats();
}

/**
 * Récupère le status du cold start
 */
async function getColdStartStatus() {
  const coldStartDone = await storage.isColdStartDone();
  const { indexingProgress } = await storage.get('indexingProgress');
  
  return {
    coldStartDone,
    isIndexing: indexingProgress !== null,
    progress: indexingProgress
  };
}

/**
 * Démarre le cold start
 */
async function startColdStartHandler() {
  await startColdStart();
}

/**
 * Pause le cold start
 */
async function pauseColdStartHandler() {
  await pauseColdStart();
}

/**
 * Get workflow statistics
 */
async function getWorkflowStatsHandler() {
  const { getWorkflowStats } = await import('./workflows.js');
  return await getWorkflowStats();
}

/**
 * Open modal Taby
 */
async function openTabyModal(tab) {
  if (!tab || !tab.id) return;

  // Check if URL is accessible before injecting script
  if (!isAccessibleUrl(tab.url)) {
    console.warn(`⏭️ Cannot open modal on restricted page: ${tab.url}`);
    return;
  }

  // Index tabs for fuzzy search
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  fuzzySearch.indexTabs(allTabs);

  // Get suggestions via Lite mode (improved by AI indexing)
  const suggestions = await getSuggestionsForTab(tab.id);

  // Try to send message to existing content script first
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: "toggle-supertab-modal",
      suggestions: suggestions
    });
    // Success - content script already exists, no need to inject
    return;
  } catch (error) {
    // Content script not injected yet, inject it now
    console.log('Content script not found, injecting...');
  }

  // Inject content script only if it wasn't already present
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (e) {
    console.error('Error injecting script:', e);
    return;
  }

  // Send message again after injection
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: "toggle-supertab-modal",
      suggestions: suggestions
    });
  } catch (error) {
    console.error('Error sending message:', error);
  }
}