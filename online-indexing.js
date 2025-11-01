/**
 * online-indexing.js
 * Background AI indexing for new tabs (after cold start)
 */

import { db } from './db.js';
import { storage } from './storage.js';
import { TFIDF } from './tfidf.js';
import { extractTabContent } from './lite-mode.js';
import { createBasicRelationships, enrichRelationshipsWithAI } from './relationships.js';

// Dedicated AI sessions for online indexing
let onlineSummarizerSession = null;
let onlineLanguageModelSession = null;
let onlineSessionsReady = false;

// Indexing queue
let indexingQueue = [];
let isProcessing = false;

/**
 * Initialize AI sessions for online indexing
 */
async function initOnlineSessions() {
  if (onlineSessionsReady) {
    console.log('✅ Online sessions already ready');
    return true;
  }

  try {
    // Create Summarizer session
    if ('Summarizer' in self) {
      const availability = await Summarizer.availability();
      if (availability !== 'unavailable') {
        console.log('📥 [Online] Creating Summarizer session...');
        onlineSummarizerSession = await Summarizer.create({
          type: 'key-points',
          format: 'plain-text',
          length: 'medium'
        });
        console.log('✅ [Online] Summarizer session created');
      }
    }

    // Create Language Model session
    if ('LanguageModel' in self) {
      const availability = await LanguageModel.availability();
      if (availability !== 'unavailable') {
        console.log('📥 [Online] Creating Language Model session...');
        onlineLanguageModelSession = await LanguageModel.create({
          temperature: 0.3,
          topK: 3
        });
        console.log('✅ [Online] Language Model session created');
      }
    }

    onlineSessionsReady = onlineSummarizerSession !== null || onlineLanguageModelSession !== null;
    return onlineSessionsReady;

  } catch (error) {
    console.error('[Online] Error initializing sessions:', error);
    return false;
  }
}

/**
 * Detect app based on domain
 */
function detectApp(domain) {
  const apps = {
    'mail.google.com': 'gmail',
    'docs.google.com': 'google_docs',
    'sheets.google.com': 'google_sheets',
    'slides.google.com': 'google_slides',
    'drive.google.com': 'google_drive',
    'calendar.google.com': 'google_calendar',
    'notion.so': 'notion',
    'slack.com': 'slack',
    'github.com': 'github',
    'figma.com': 'figma',
    'linear.app': 'linear',
    'youtube.com': 'youtube'
  };
  
  return apps[domain] || 'other';
}

/**
 * Extract metadata with online session
 */
async function extractMetadataOnline(content, summary) {
  if (!onlineLanguageModelSession) {
    console.warn('[Online] No Language Model, manual fallback');
    return extractManualMetadata(summary);
  }
  
  try {
    const prompt = `Analyze this document and extract key information in this exact format:

KEYWORDS: 8-10 main keywords or key phrases (comma-separated)
ENTITIES: People, organizations, products, projects mentioned (comma-separated)
TOPICS: 3-5 main topics or themes (comma-separated)
TYPE: document|email|meeting-notes|report|code|design|article|other

Document summary: ${summary.slice(0, 500)}

Output:`;

    const response = await onlineLanguageModelSession.prompt(prompt);
    
    const lines = response.split('\n');
    const keywords = parseLine(lines, 'KEYWORDS');
    const entities = parseLine(lines, 'ENTITIES');
    const topics = parseLine(lines, 'TOPICS');
    const type = parseLine(lines, 'TYPE', true);
    
    return {
      keywords: keywords || [],
      entities: entities || [],
      topics: topics || [],
      type: type || 'other'
    };
  } catch (error) {
    console.error('[Online] Error extracting metadata:', error);
    return extractManualMetadata(summary);
  }
}

/**
 * Manual metadata extraction (fallback)
 */
function extractManualMetadata(text) {
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq = new Map();
  
  words.forEach(word => {
    if (word.length > 3 && !/^\d+$/.test(word)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  });
  
  const keywords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
  
  return {
    keywords,
    entities: [],
    topics: [],
    type: 'other'
  };
}

/**
 * Parse une ligne
 */
function parseLine(lines, prefix, single = false) {
  const line = lines.find(l => l.toUpperCase().startsWith(prefix + ':'));
  if (!line) return single ? '' : [];
  
  const content = line.split(':')[1]?.trim() || '';
  
  if (single) {
    return content.toLowerCase();
  }
  
  return content
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

/**
 * Update TF-IDF index
 */
async function updateTFIDFIndex(tabId, summary, keywords, title) {
  try {
    const indexData = await storage.getTFIDFIndex();
    
    if (!indexData) {
      console.warn('[Online] Pas d\'index TF-IDF');
      return;
    }
    
    const tfidf = TFIDF.deserialize(indexData);
    
    // Remove old if exists
    tfidf.removeDocument(tabId);
    
    // Add enriched
    const titleRepeated = `${title} ${title} ${title}`;
    const enrichedText = `${titleRepeated} ${summary} ${keywords.join(' ')}`;
    tfidf.addDocument(enrichedText, tabId);
    
    await storage.saveTFIDFIndex(tfidf.serialize());
    
    console.log(`✅ [Online] TF-IDF index updated for tab ${tabId}`);
    
  } catch (error) {
    console.error('[Online] Error updating TF-IDF:', error);
  }
}

/**
 * Add tab to indexing queue
 */
async function queueTabForIndexing(tab, priority = 'normal') {
  // Check if already in queue
  const alreadyQueued = indexingQueue.some(item => item.tab.id === tab.id);
  if (alreadyQueued) {
    console.log(`⏭️ [Online] Tab Tab ${tab.id} déjà en queue already in queue`);
    return;
  }
  
  const queueItem = {
    tab,
    priority: priority === 'high' ? 1 : 0,
    addedAt: Date.now()
  };
  
  indexingQueue.push(queueItem);
  
  // Trie par priorité (haute d'abord), puis par ordre d'ajout
  indexingQueue.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.addedAt - b.addedAt;
  });
  
  console.log(`📋 [Online] Tab added to queue (${indexingQueue.length} pending)`);
  
  // Lance le processing si pas déjà en cours
  if (!isProcessing) {
    processQueue();
  }
}

/**
 * Process indexing queue (un par un)
 */
async function processQueue() {
  if (isProcessing || indexingQueue.length === 0) {
    return;
  }
  
  isProcessing = true;
  
  while (indexingQueue.length > 0) {
    const queueItem = indexingQueue.shift();
    const tab = queueItem.tab;
    
    console.log(`⚙️ [Online] Processing tab ${tab.id} (${indexingQueue.length} remaining)`);
    
    try {
      await indexTabOnline(tab);
    } catch (error) {
      console.error(`[Online] Error indexing tab ${tab.id}:`, error);
    }
    
    // Small delay between each indexation
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  isProcessing = false;
  console.log(`✅ [Online] Queue completed`);
}

/**
 * Index a tab (fonction interne, appelée par la queue)
 */
async function indexTabOnline(tab) {
  console.log(`🆕 [Online] Indexing: ${tab.title}`);
  
  // Init sessions si nécessaire
  if (!onlineSessionsReady) {
    const ready = await initOnlineSessions();
    if (!ready) {
      console.error('[Online] Sessions not available');
      return;
    }
  }
  
  try {
    // Ignore URLs système
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
      console.log(`⏭️ [Online] System URL ignored`);
      return;
    }
    
    const domain = new URL(tab.url).hostname;
    const urlHash = await db.generateUrlHash(tab.url);
    
    // Crée entrée Lite d'abord
    await db.addTab({
      id: `tab_${tab.id}_${Date.now()}`,
      tabId: tab.id,
      url: tab.url,
      urlHash: urlHash,
      title: tab.title,
      domain: domain,
      favicon: tab.favIconUrl,
      
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      lastIndexedAt: null,
      accessCount: 0,
      
      content: {
        rawText: null,
        summary: null,
        keywords: null,
        entities: null,
        topics: null,
        language: 'en',
        wordCount: 0
      },
      
      metadata: {
        type: 'other',
        app: detectApp(domain),
        hasForm: false,
        hasVideo: false,
        readingTime: 0
      },
      
      relatedTabs: [],
      
      flags: {
        isActive: true,
        isPinned: tab.pinned,
        isAudible: tab.audible,
        isIndexed: false,
        needsReindex: false
      }
    });
    
    console.log(`✅ [Online] DB entry created`);
    
    // Attendre 2s que la page charge complètement
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extrait contenu
    const rawText = await Promise.race([
      extractTabContent(tab.id),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]).catch(() => null);
    
    if (!rawText || rawText.length < 50) {
      console.log(`⏭️ [Online] Insufficient content`);
      return;
    }

    // Clean text for AI (remove repetitions that break Summarizer API)
    const cleanText = rawText
      .replace(/[\r\n\t]+/g, ' ')  // Replace line breaks and tabs with spaces
      .replace(/\s+/g, ' ')         // Normalize multiple spaces
      .replace(/(\b\w+\b)(\s+\1){2,}/gi, '$1') // Remove 3+ consecutive word repetitions
      .trim();

    const wordCount = cleanText.split(/\s+/).length;

    // Generate summary
    console.log(`📝 [Online] Generating summary... (${cleanText.length} chars, ${wordCount} words)`);

    let summary;

    // Only use AI Summarizer if we have substantial content (at least 50 words)
    if (onlineSummarizerSession && wordCount >= 50) {
      summary = await onlineSummarizerSession.summarize(cleanText.slice(0, 10000)).catch((error) => {
        console.warn(`⚠️ [Online] Summary failed: ${error.message}, using fallback`);
        return cleanText.split(/\s+/).slice(0, 200).join(' ');
      });
    } else {
      // Use fallback for short content or if no summarizer
      console.log(`ℹ️ [Online] Using fallback summary (${wordCount < 50 ? 'insufficient words' : 'no AI session'})`);
      summary = cleanText.split(/\s+/).slice(0, 200).join(' ');
    }

    console.log(`✅ [Online] Summary generated (${summary.length} chars):`);
    console.log(`   "${summary.slice(0, 150)}${summary.length > 150 ? '...' : ''}"`);

    // Extract metadata
    console.log(`🏷️ [Online] Extracting metadata...`);
    const metadata = await extractMetadataOnline(cleanText, summary);

    console.log(`✅ [Online] Metadata extracted:`);
    console.log(`   Keywords (${metadata.keywords.length}): ${metadata.keywords.slice(0, 8).join(', ')}${metadata.keywords.length > 8 ? '...' : ''}`);
    console.log(`   Entities (${metadata.entities.length}): ${metadata.entities.slice(0, 8).join(', ')}${metadata.entities.length > 8 ? '...' : ''}`);
    console.log(`   Topics (${metadata.topics.length}): ${metadata.topics.slice(0, 8).join(', ')}${metadata.topics.length > 8 ? '...' : ''}`);
    console.log(`   Type: ${metadata.type || 'N/A'}`);

    // Met à jour DB
    const dbEntry = await db.getTabByTabId(tab.id);
    
    if (dbEntry) {
      await db.updateTab(dbEntry.id, {
        content: {
          rawText: rawText.slice(0, 15000),
          summary: summary,
          keywords: metadata.keywords,
          entities: metadata.entities,
          topics: metadata.topics,
          language: 'en',
          wordCount: rawText.split(/\s+/).length
        },
        metadata: {
          ...dbEntry.metadata,
          type: metadata.type
        },
        flags: {
          ...dbEntry.flags,
          isIndexed: true
        },
        lastIndexedAt: Date.now()
      });
      
      console.log(`✅ [Online] Tab ${tab.id} indexed`);

      // Update TF-IDF
      await updateTFIDFIndex(tab.id, summary, metadata.keywords, tab.title);

      // Create/enrich relationships with other indexed tabs based on content
      console.log(`🔗 [Online] Creating content-based relationships for tab ${tab.id}...`);

      // Get all indexed tabs
      const allTabs = await db.getAllTabs();
      const indexedTabs = allTabs.filter(t => t.flags.isIndexed && t.flags.isActive && t.tabId !== tab.id);

      // Get current tab's full data for content comparison
      const currentTab = await db.getTabByTabId(tab.id);
      if (!currentTab) {
        console.log(`⚠️ [Online] Could not find tab ${tab.id} in DB`);
        return;
      }

      // Generic words to filter out (not meaningful for relationships)
      const genericWords = new Set([
        'google', 'docs', 'document', 'wikipédia', 'wikipedia', 'recherche',
        'search', 'page', 'site', 'web', 'article', 'notes', 'sommaire',
        'références', 'liens', 'external', 'navigation', 'menu'
      ]);

      // Create content-based relationships with tabs that have shared entities/topics
      let created = 0;
      for (const otherTab of indexedTabs.slice(0, 20)) { // Check up to 20 most recent indexed tabs
        // Calculate common entities (excluding generic words)
        const entities1 = new Set((currentTab?.content?.entities || [])
          .map(e => e.toLowerCase())
          .filter(e => !genericWords.has(e) && e.length > 2));
        const entities2 = new Set((otherTab?.content?.entities || [])
          .map(e => e.toLowerCase())
          .filter(e => !genericWords.has(e) && e.length > 2));
        const sharedEntities = [...entities1].filter(e => entities2.has(e));

        // Calculate common topics (excluding generic words)
        const topics1 = new Set((currentTab?.content?.topics || [])
          .map(t => t.toLowerCase())
          .filter(t => !genericWords.has(t) && t.length > 2));
        const topics2 = new Set((otherTab?.content?.topics || [])
          .map(t => t.toLowerCase())
          .filter(t => !genericWords.has(t) && t.length > 2));
        const sharedTopics = [...topics1].filter(t => topics2.has(t));

        // Only create relationship if there's MEANINGFUL content overlap
        const hasMeaningfulOverlap = (
          sharedEntities.length >= 1 ||
          sharedTopics.length >= 1
        );

        if (hasMeaningfulOverlap) {
          const existing = await db.getRelationship(currentTab.id, otherTab.id);
          if (!existing) {
            await createBasicRelationships(tab.id, otherTab.tabId, 'content');
            created++;
          }
        }
      }

      console.log(`📝 [Online] Created ${created} content-based relationships`);

      // Enrich this tab's relationships with AI semantic analysis
      await enrichRelationshipsWithAI();

      console.log(`✅ [Online] Relationships enriched for tab ${tab.id}`);
    }

  } catch (error) {
    console.error(`[Online] Error indexing tab ${tab.id}:`, error);
  }
}

/**
 * Check if online sessions are ready
 */
function areOnlineSessionsReady() {
  return onlineSessionsReady;
}

export {
  queueTabForIndexing,
  initOnlineSessions,
  areOnlineSessionsReady
};