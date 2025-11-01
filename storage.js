/**
 * storage.js
 * Couche d'abstraction pour chrome.storage.local
 * Gère le cache chaud et la configuration
 */

class TabyStorage {
    constructor() {
      this.initialized = false;
    }
  
    /**
     * Initialise le storage avec valeurs par défaut
     */
    async init() {
      const defaults = {
        config: {
          coldStartDone: false,
          lastColdStartAt: null,
          totalTabsIndexed: 0,
          version: '0.4.0',
          preferences: {
            shortcut: 'Cmd+Shift+L',
            maxSuggestions: 5,
            enableProactiveSuggestions: false,
            privacyMode: false
          },
          excludedDomains: []
        },
        hotCache: {
          currentTabId: null,
          recentTabIds: [],
          cachedSuggestions: null
        },
        stats: {
          totalSwitches: 0,
          successfulSwitches: 0,
          avgSwitchTime: 0,
          lastSyncAt: Date.now()
        },
        indexingProgress: null,
        tfidfIndex: null
      };
  
      // Récupère les données existantes
      const existing = await this.getAll();
      
      // Merge avec defaults (ne remplace pas ce qui existe)
      const merged = { ...defaults, ...existing };
      
      await chrome.storage.local.set(merged);
      this.initialized = true;
      
      console.log('✅ TabyStorage: Initialisé');
      return merged;
    }
  
    /**
     * Récupère toutes les données du storage
     */
    async getAll() {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });
    }
  
    /**
     * Récupère une ou plusieurs clés
     */
    async get(keys) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });
    }
  
    /**
     * Définit une ou plusieurs valeurs
     */
    async set(data) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
  
    /**
     * Supprime une ou plusieurs clés
     */
    async remove(keys) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
  
    /**
     * Vide tout le storage
     */
    async clear() {
      return new Promise((resolve, reject) => {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            console.log('✅ TabyStorage: Vidé');
            resolve();
          }
        });
      });
    }
  
    // ==========================================
    // HELPERS SPÉCIFIQUES
    // ==========================================
  
    /**
     * Met à jour la config
     */
    async updateConfig(updates) {
      const { config } = await this.get('config');
      const newConfig = { ...config, ...updates };
      await this.set({ config: newConfig });
      return newConfig;
    }
  
    /**
     * Met à jour le cache chaud
     */
    async updateHotCache(updates) {
      const { hotCache } = await this.get('hotCache');
      const newCache = { ...hotCache, ...updates };
      await this.set({ hotCache: newCache });
      return newCache;
    }
  
    /**
     * Met à jour les stats
     */
    async updateStats(updates) {
      const { stats } = await this.get('stats');
      const newStats = { ...stats, ...updates };
      await this.set({ stats: newStats });
      return newStats;
    }
  
    /**
     * Cache les suggestions pour un onglet
     */
    async cacheSuggestions(tabId, suggestions) {
      await this.updateHotCache({
        cachedSuggestions: {
          forTabId: tabId,
          computedAt: Date.now(),
          suggestions: suggestions.map(s => ({
            id: s.id,
            tabId: s.tabId,
            title: s.title,
            url: s.url,
            domain: s.domain,
            favicon: s.favIconUrl || s.favicon,
            score: s.score,
            reason: s.reason,
            keywords: s.keywords || []
          }))
        }
      });
    }
  
    /**
     * Récupère les suggestions en cache
     */
    async getCachedSuggestions(tabId, maxAge = 30000) {
      const { hotCache } = await this.get('hotCache');
      
      if (!hotCache?.cachedSuggestions) return null;
      if (hotCache.cachedSuggestions.forTabId !== tabId) return null;
      
      const age = Date.now() - hotCache.cachedSuggestions.computedAt;
      if (age > maxAge) return null; // Trop vieux
      
      return hotCache.cachedSuggestions.suggestions;
    }
  
    /**
     * Met à jour l'onglet courant
     */
    async setCurrentTab(tabId) {
      const { hotCache } = await this.get('hotCache');
      const recentTabIds = hotCache.recentTabIds || [];
      
      // Ajoute au début et garde les 10 derniers
      const newRecent = [tabId, ...recentTabIds.filter(id => id !== tabId)].slice(0, 10);
      
      await this.updateHotCache({
        currentTabId: tabId,
        recentTabIds: newRecent
      });
    }
  
    /**
     * Met à jour la progression de l'indexation
     */
    async updateIndexingProgress(current, total, currentTab) {
      await this.set({
        indexingProgress: {
          current,
          total,
          currentTab,
          percentage: Math.round((current / total) * 100),
          updatedAt: Date.now()
        }
      });
    }
  
    /**
     * Efface la progression (indexation terminée)
     */
    async clearIndexingProgress() {
      await this.set({ indexingProgress: null });
    }
  
    /**
     * Enregistre un switch de tab (pour stats)
     */
    async recordSwitch(wasHelpful = true, switchTime = 0) {
      const { stats } = await this.get('stats');
      
      const newStats = {
        totalSwitches: stats.totalSwitches + 1,
        successfulSwitches: stats.successfulSwitches + (wasHelpful ? 1 : 0),
        avgSwitchTime: (stats.avgSwitchTime * stats.totalSwitches + switchTime) / (stats.totalSwitches + 1),
        lastSyncAt: Date.now()
      };
      
      await this.set({ stats: newStats });
      return newStats;
    }
  
    /**
     * Sauvegarde l'index TF-IDF
     */
    async saveTFIDFIndex(indexData) {
      await this.set({ tfidfIndex: indexData });
    }
  
    /**
     * Récupère l'index TF-IDF
     */
    async getTFIDFIndex() {
      const { tfidfIndex } = await this.get('tfidfIndex');
      return tfidfIndex;
    }
  
    /**
     * Marque le cold start comme terminé
     */
    async markColdStartDone() {
      await this.updateConfig({
        coldStartDone: true,
        lastColdStartAt: Date.now()
      });
    }
  
    /**
     * Vérifie si le cold start est fait
     */
    async isColdStartDone() {
      const { config } = await this.get('config');
      return config?.coldStartDone || false;
    }

    /**
     * Set last known tab count for context change detection
     */
    async setLastTabCount(count) {
      await this.updateHotCache({ lastTabCount: count });
    }

    /**
     * Get last known tab count
     */
    async getLastTabCount() {
      const { hotCache } = await this.get('hotCache');
      return hotCache?.lastTabCount || null;
    }

    /**
     * Clear suggestions cache
     */
    async clearSuggestionsCache() {
      await this.updateHotCache({ cachedSuggestions: null });
    }
  }
  
  // Instance singleton
  const storage = new TabyStorage();
  
  // Export
  export { storage, TabyStorage };