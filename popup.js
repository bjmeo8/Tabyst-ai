/**
 * popup.js
 * Logique du popup de l'extension
 */

// Éléments DOM
const totalTabsEl = document.getElementById('totalTabs');
const indexedTabsEl = document.getElementById('indexedTabs');
const beforeColdStart = document.getElementById('beforeColdStart');
const duringColdStart = document.getElementById('duringColdStart');
const afterColdStart = document.getElementById('afterColdStart');
const startColdStartBtn = document.getElementById('startColdStartBtn');
const pauseColdStartBtn = document.getElementById('pauseColdStartBtn');
const progressFill = document.getElementById('progressFill');
const progressPercentage = document.getElementById('progressPercentage');
const progressText = document.getElementById('progressText');

// État
let updateInterval = null;

/**
 * Initialisation
 */
async function init() {
  await updateStats();
  await updateColdStartStatus();
  
  // Rafraîchit toutes les 2 secondes pendant l'indexation
  updateInterval = setInterval(async () => {
    await updateStats();
    await updateColdStartStatus();
  }, 2000);
}

/**
 * Met à jour les statistiques
 */
async function updateStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get-stats' });
    
    if (response && response.stats) {
      totalTabsEl.textContent = response.stats.tabs.total;
      indexedTabsEl.textContent = response.stats.tabs.indexed;
    }
  } catch (error) {
    console.error('Erreur stats:', error);
  }
}

/**
 * Met à jour le statut du cold start
 */
async function updateColdStartStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get-cold-start-status' });
    
    if (!response) return;
    
    const { coldStartDone, isIndexing, progress } = response;
    
    if (coldStartDone && !isIndexing) {
      // Cold start terminé
      showSection('after');
    } else if (isIndexing && progress) {
      // En cours d'indexation
      showSection('during');
      updateProgress(progress);
    } else {
      // Pas encore commencé
      showSection('before');
    }
  } catch (error) {
    console.error('Erreur cold start status:', error);
  }
}

/**
 * Affiche la section appropriée
 */
function showSection(section) {
  beforeColdStart.classList.add('hidden');
  duringColdStart.classList.add('hidden');
  afterColdStart.classList.add('hidden');
  
  if (section === 'before') {
    beforeColdStart.classList.remove('hidden');
  } else if (section === 'during') {
    duringColdStart.classList.remove('hidden');
  } else if (section === 'after') {
    afterColdStart.classList.remove('hidden');
  }
}

/**
 * Met à jour la barre de progression
 */
function updateProgress(progress) {
  const { current, total, currentTab, percentage } = progress;
  
  progressFill.style.width = `${percentage}%`;
  progressPercentage.textContent = `${percentage}%`;
  progressText.textContent = `${current}/${total} tabs • Currently: ${currentTab || 'Processing...'}`;
}

/**
 * Démarre le cold start
 */
startColdStartBtn.addEventListener('click', async () => {
  try {
    startColdStartBtn.disabled = true;
    startColdStartBtn.textContent = '⏳ Starting...';
    
    await chrome.runtime.sendMessage({ action: 'start-cold-start' });
    
    // Mise à jour immédiate
    await updateColdStartStatus();
  } catch (error) {
    console.error('Erreur start cold start:', error);
    startColdStartBtn.disabled = false;
    startColdStartBtn.textContent = '🚀 Start AI Indexing';
  }
});

/**
 * Pause le cold start
 */
pauseColdStartBtn.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ action: 'pause-cold-start' });
    await updateColdStartStatus();
  } catch (error) {
    console.error('Erreur pause cold start:', error);
  }
});

// Cleanup quand le popup se ferme
window.addEventListener('unload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

// Lance l'initialisation
init();