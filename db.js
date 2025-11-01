/**
 * db.js
 * IndexdDB abstraction layer
 * Manages all database operations for Taby
 */

const DB_NAME = 'TabyDB';
const DB_VERSION = 1;

class TabyDatabase {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize the database de données
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('TabyDB: Error opening DB', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('âœ… TabyDB: Base de données initialisée');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('TabyDB: Création/mise Ã  jour du schéma...');

        // ==========================================
        // TABLE 1: tabs_index
        // ==========================================
        if (!db.objectStoreNames.contains('tabs_index')) {
          const tabsStore = db.createObjectStore('tabs_index', { keyPath: 'id' });
          
          // Indexes for fast queries
          tabsStore.createIndex('tabId', 'tabId', { unique: false });
          tabsStore.createIndex('urlHash', 'urlHash', { unique: false });
          tabsStore.createIndex('domain', 'domain', { unique: false });
          tabsStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
          tabsStore.createIndex('isActive', 'flags.isActive', { unique: false });
          tabsStore.createIndex('isIndexed', 'flags.isIndexed', { unique: false });
          
          console.log('âœ… Table tabs_index créée');
        }

        // ==========================================
        // TABLE 2: navigation_history
        // ==========================================
        if (!db.objectStoreNames.contains('navigation_history')) {
          const navStore = db.createObjectStore('navigation_history', { keyPath: 'id' });
          
          navStore.createIndex('timestamp', 'timestamp', { unique: false });
          navStore.createIndex('fromTabId', 'fromTab.tabId', { unique: false });
          navStore.createIndex('toTabId', 'toTab.tabId', { unique: false });
          
          console.log('âœ… Table navigation_history créée');
        }

        // ==========================================
        // TABLE 3: tab_relationships
        // ==========================================
        if (!db.objectStoreNames.contains('tab_relationships')) {
          const relStore = db.createObjectStore('tab_relationships', { keyPath: 'id' });
          
          relStore.createIndex('tab1', 'tab1', { unique: false });
          relStore.createIndex('tab2', 'tab2', { unique: false });
          relStore.createIndex('overallScore', 'overallScore', { unique: false });
          
          console.log('âœ… Table tab_relationships créée');
        }

        // ==========================================
        // TABLE 4: workflows
        // ==========================================
        if (!db.objectStoreNames.contains('workflows')) {
          const workflowStore = db.createObjectStore('workflows', { keyPath: 'id' });
          
          workflowStore.createIndex('frequency', 'frequency', { unique: false });
          workflowStore.createIndex('lastOccurrence', 'lastOccurrence', { unique: false });
          
          console.log('âœ… Table workflows créée');
        }
      };
    });
  }

  /**
   * Génère un hash SHA-256 simple for les URLs
   */
  async generateUrlHash(url) {
    const msgBuffer = new TextEncoder().encode(url);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ==========================================
  // OPERATIONS: tabs_index
  // ==========================================

  /**
   * Add un tab Ã  l'index
   */
  async addTab(tabData) {
    return new Promise(async (resolve, reject) => {
      const transaction = this.db.transaction(['tabs_index'], 'readwrite');
      const store = transaction.objectStore('tabs_index');
      
      // Génère le hash URL
      tabData.urlHash = await this.generateUrlHash(tabData.url);
      
      const request = store.add(tabData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Met Ã  jour un tab
   */
  async updateTab(id, updates) {
    return new Promise(async (resolve, reject) => {
      const transaction = this.db.transaction(['tabs_index'], 'readwrite');
      const store = transaction.objectStore('tabs_index');
      
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const tab = getRequest.result;
        if (!tab) {
          reject(new Error(`Tab ${id} not found`));
          return;
        }
        
        // Merge updates
        const updatedTab = { ...tab, ...updates };
        
        const putRequest = store.put(updatedTab);
        putRequest.onsuccess = () => resolve(updatedTab);
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Récupère un tab par ID
   */
  async getTab(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tabs_index'], 'readonly');
      const store = transaction.objectStore('tabs_index');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère all tabs actifs
   */
  async getActiveTabs() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tabs_index'], 'readonly');
      const store = transaction.objectStore('tabs_index');
      const index = store.index('isActive');
      const request = index.getAll(true);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère all tabs
   */
  async getAllTabs() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tabs_index'], 'readonly');
      const store = transaction.objectStore('tabs_index');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete un tab
   */
  async deleteTab(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tabs_index'], 'readwrite');
      const store = transaction.objectStore('tabs_index');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère un tab par tabId Chrome
   */
  async getTabByTabId(tabId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tabs_index'], 'readonly');
      const store = transaction.objectStore('tabs_index');
      const index = store.index('tabId');
      const request = index.get(tabId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère un tab par son URL hash
   */
  async getTabByUrlHash(urlHash) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tabs_index'], 'readonly');
      const store = transaction.objectStore('tabs_index');
      const index = store.index('urlHash');
      const request = index.get(urlHash);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================
  // OPERATIONS: navigation_history
  // ==========================================

  /**
   * Record une navigation
   */
  async addNavigation(navData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['navigation_history'], 'readwrite');
      const store = transaction.objectStore('navigation_history');
      const request = store.add(navData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère l'historique de navigation for un tab
   */
  async getNavigationHistory(tabId, limit = 100) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['navigation_history'], 'readonly');
      const store = transaction.objectStore('navigation_history');
      const index = store.index('fromTabId');
      const request = index.getAll(tabId);
      
      request.onsuccess = () => {
        const results = request.result
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère all navigations récentes
   */
  async getRecentNavigations(since) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['navigation_history'], 'readonly');
      const store = transaction.objectStore('navigation_history');
      const index = store.index('timestamp');
      const range = IDBKeyRange.lowerBound(since);
      const request = index.getAll(range);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================
  // OPERATIONS: tab_relationships
  // ==========================================

  /**
   * Add ou met Ã  jour une relationship
   */
  async upsertRelationship(relData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tab_relationships'], 'readwrite');
      const store = transaction.objectStore('tab_relationships');
      const request = store.put(relData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère une relationship spécifique
   */
  async getRelationship(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tab_relationships'], 'readonly');
      const store = transaction.objectStore('tab_relationships');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère all relationships for un tab
   */
  async getRelationshipsForTab(tabId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tab_relationships'], 'readonly');
      const store = transaction.objectStore('tab_relationships');
      
      const index1 = store.index('tab1');
      const request1 = index1.getAll(tabId);
      
      request1.onsuccess = () => {
        const results1 = request1.result;
        
        const index2 = store.index('tab2');
        const request2 = index2.getAll(tabId);
        
        request2.onsuccess = () => {
          const results2 = request2.result;
          resolve([...results1, ...results2]);
        };
        request2.onerror = () => reject(request2.error);
      };
      request1.onerror = () => reject(request1.error);
    });
  }

  /**
   * Delete all relationships liées Ã  un tab
   */
  async deleteRelationshipsForTab(tabId) {
    const relationships = await this.getRelationshipsForTab(tabId);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tab_relationships'], 'readwrite');
      const store = transaction.objectStore('tab_relationships');
      
      relationships.forEach(rel => {
        store.delete(rel.id);
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get all relationships
   */
  async getAllRelationships() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tab_relationships'], 'readonly');
      const store = transaction.objectStore('tab_relationships');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete une relationship
   */
  async deleteRelationship(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tab_relationships'], 'readwrite');
      const store = transaction.objectStore('tab_relationships');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update une relationship
   */
  async updateRelationship(id, updates) {
    return new Promise(async (resolve, reject) => {
      const transaction = this.db.transaction(['tab_relationships'], 'readwrite');
      const store = transaction.objectStore('tab_relationships');
      
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const rel = getRequest.result;
        if (!rel) {
          reject(new Error(`Relationship ${id} not found`));
          return;
        }
        
        const updatedRel = { ...rel, ...updates };
        const putRequest = store.put(updatedRel);
        putRequest.onsuccess = () => resolve(updatedRel);
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Add une relationship
   */
  async addRelationship(relData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tab_relationships'], 'readwrite');
      const store = transaction.objectStore('tab_relationships');
      const request = store.add(relData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================
  // OPERATIONS: workflows
  // ==========================================

  /**
   * Add ou met Ã  jour un workflow
   */
  async upsertWorkflow(workflowData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['workflows'], 'readwrite');
      const store = transaction.objectStore('workflows');
      const request = store.put(workflowData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère all workflows
   */
  async getAllWorkflows() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['workflows'], 'readonly');
      const store = transaction.objectStore('workflows');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================
  // UTILITY
  // ==========================================

  /**
   * Clear all tables (for debug/reset)
   */
  async clearAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        ['tabs_index', 'navigation_history', 'tab_relationships', 'workflows'],
        'readwrite'
      );
      
      transaction.objectStore('tabs_index').clear();
      transaction.objectStore('navigation_history').clear();
      transaction.objectStore('tab_relationships').clear();
      transaction.objectStore('workflows').clear();
      
      transaction.oncomplete = () => {
        console.log('âœ… TabyDB: Toutes les tables vidées');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const tabs = await this.getAllTabs();
    const activeTabs = tabs.filter(t => t.flags?.isActive);
    const indexedTabs = activeTabs.filter(t => t.flags?.isIndexed);

    const navHistory = await this.getRecentNavigations(0);
    const relationships = await new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tab_relationships'], 'readonly');
      const store = transaction.objectStore('tab_relationships');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const workflows = await this.getAllWorkflows();

    return {
      tabs: {
        total: activeTabs.length,
        active: activeTabs.length,
        indexed: indexedTabs.length,
        indexProgress: activeTabs.length > 0 ? Math.round((indexedTabs.length / activeTabs.length) * 100) : 0
      },
      navigationHistory: navHistory.length,
      relationships: relationships.length,
      workflows: workflows.length
    };
  }
}

// Instance singleton
const db = new TabyDatabase();

// Export for utilisation in d'autres scripts
export { db, TabyDatabase };