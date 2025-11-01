/**
 * cold-start.js
 * Background AI indexing logic with progressive improvements
 */

import { db } from './db.js';
import { storage } from './storage.js';
import { TFIDF } from './tfidf.js';
import { generateComprehensiveSummary, extractRichKeywords, checkAIAvailability } from './ai-engine.js';
import { extractTabContent, buildTFIDFIndex } from './lite-mode.js';
import { enrichRelationshipsWithAI, initializeRelationships } from './relationships.js';

let isIndexing = false;
let indexingQueue = [];
let currentIndex = 0;
let initialTabCount = 0; // To track closed tabs

// Reusable sessions - kept even after cold start
let summarizerSession = null;
let languageModelSession = null;
let sessionsInitialized = false;

/**
 * Start cold start
 */
async function startColdStart() {
  if (isIndexing) {
    console.log('⚠️ Indexing already in progress');
    return;
  }

  console.log('🚀 Cold Start started');

  // Reset state for clean start
  indexingQueue = [];
  currentIndex = 0;
  initialTabCount = 0;

  // Check AI availability
  const aiAvailable = await checkAIAvailability();
  console.log('AI Capabilities:', aiAvailable);

  if (!aiAvailable.summarizer && !aiAvailable.languageModel) {
    console.error('❌ No AI API available');
    await storage.updateConfig({ coldStartDone: false });
    return;
  }

  // Initialize reusable sessions (if not already done)
  if (!sessionsInitialized) {
    console.log('🔧 Initializing AI sessions...');
    await initAISessions();
  }

  // Get all tabs
  const tabs = await chrome.tabs.query({});

  if (tabs.length === 0) {
    console.log('⚠️ No tabs to index');
    await finishColdStart();
    return;
  }

  indexingQueue = tabs;
  currentIndex = 0;
  initialTabCount = tabs.length;
  isIndexing = true;

  console.log(`📊 ${tabs.length} tabs to index`);

  // Create Lite entries for all tabs first
  try {
    await createLiteEntries(tabs);
  } catch (error) {
    console.error('Error creating Lite entries:', error);
  }

  // Build initial TF-IDF index
  try {
    await buildTFIDFIndex(tabs);
  } catch (error) {
    console.error('Error building TF-IDF index:', error);
  }

  // Start AI indexing
  await processIndexingQueue();
}

/**
 * Initialize reusable AI sessions
 */
async function initAISessions() {
  if (sessionsInitialized) {
    console.log('✅ AI sessions already initialized');
    return;
  }
  
  try {
    // Create session Summarizer
    if ('Summarizer' in self) {
      const availability = await Summarizer.availability();
      if (availability !== 'unavailable') {
        console.log('📥 Creating session Summarizer...');
        summarizerSession = await Summarizer.create({
          type: 'key-points',
          format: 'plain-text',
          length: 'medium',
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              console.log(`Summarizer téléchargement: ${Math.round(e.loaded * 100)}%`);
            });
          }
        });
        console.log('✅ Session Summarizer created');
      }
    }
    
    // Create session Language Model
    if ('LanguageModel' in self) {
      const availability = await LanguageModel.availability();
      if (availability !== 'unavailable') {
        console.log('📥 Creating session Language Model...');
        languageModelSession = await LanguageModel.create({
          temperature: 0.3,
          topK: 3,
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              console.log(`Language Model téléchargement: ${Math.round(e.loaded * 100)}%`);
            });
          }
        });
        console.log('✅ Session Language Model created');
      }
    }
    
    sessionsInitialized = true;
  } catch (error) {
    console.error('Error init AI sessions:', error);
  }
}

/**
 * Create Lite entries for all tabs (fast)
 */
async function createLiteEntries(tabs) {
  console.log('📝 Creating Lite entries...');
  
  for (const tab of tabs) {
    try {
      const domain = new URL(tab.url).hostname;
      const urlHash = await db.generateUrlHash(tab.url);
      
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
    } catch (error) {
      console.error('Error creating Lite entry:', tab.id, error);
    }
  }
  
  console.log('✅ Lite entries created');
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
 * Process AI indexing queue
 */
async function processIndexingQueue() {
  if (!isIndexing) {
    console.log('⏸️ Indexing paused');
    return;
  }

  // Check if we've processed all tabs
  if (currentIndex >= indexingQueue.length) {
    await finishColdStart();
    return;
  }

  const tab = indexingQueue[currentIndex];

  // Check if tab still exists
  const exists = await chrome.tabs.get(tab.id).catch(() => null);

  if (!exists) {
    console.log(`⏭️ Tab ${tab.id} closed, skipping`);
    currentIndex++;
    // Continue immediately to next tab
    setTimeout(() => processIndexingQueue(), 10);
    return;
  }

  // Calculate progress (tabs processed / total initial)
  const tabsProcessed = currentIndex + 1;
  const progressPercentage = Math.round((tabsProcessed / initialTabCount) * 100);

  console.log(`[${tabsProcessed}/${initialTabCount}] Indexing: ${tab.title} (${progressPercentage}%)`);

  // Update progress
  await storage.updateIndexingProgress(
    tabsProcessed,
    initialTabCount,
    tab.title
  );

  try {
    await indexTabWithAI(tab);
  } catch (error) {
    console.error(`Error indexing tab ${tab.id}:`, error);
    // Continue anyway to prevent blocking
  }

  currentIndex++;

  // Continue with next (with 100ms delay)
  setTimeout(() => processIndexingQueue(), 100);
}

/**
 * Index a tab with AI (reuse sessions)
 * NO TIMEOUT - AI takes as long as needed (especially on low-VRAM machines)
 * TF-IDF available for users while AI works in background
 */
async function indexTabWithAI(tab) {
  try {
    await performIndexing(tab);
  } catch (error) {
    console.error(`Error AI indexing tab ${tab.id}:`, error.message);
    // Always continue to next tab, never block
  }
}

/**
 * Perform actual indexing
 */
async function performIndexing(tab) {
  // Check if tab still exists
  const currentTab = await chrome.tabs.get(tab.id).catch(() => null);
  if (!currentTab) {
    console.log(`⏭️ Tab ${tab.id} no longer exists`);
    return;
  }

  // 1. Extract content (with timeout)
  const rawText = await Promise.race([
    extractTabContent(tab.id),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Content extraction timeout')), 10000))
  ]).catch((error) => {
    console.warn(`  ⚠️ Tab ${tab.id}: ${error.message}`);
    return null;
  });

  if (!rawText || rawText.length < 50) {
    console.log(`  ⏭️ Tab ${tab.id}: insufficient content (${rawText?.length || 0} chars)`);
    return;
  }

  // Clean text for AI (remove repetitions that break Summarizer API)
  const cleanText = rawText
    .replace(/[\r\n\t]+/g, ' ')  // Replace line breaks and tabs with spaces
    .replace(/\s+/g, ' ')         // Normalize multiple spaces
    .replace(/(\b\w+\b)(\s+\1){2,}/gi, '$1') // Remove 3+ consecutive word repetitions
    .trim();

  const wordCount = cleanText.split(/\s+/).length;

  // 2. Generate summary (NO timeout - let AI take the time it needs)
  console.log(`  📝 Generating summary... (${cleanText.length} chars, ${wordCount} words)`);

  let summary;

  // Only use AI Summarizer if we have substantial content (at least 50 words)
  if (summarizerSession && wordCount >= 50) {
    summary = await summarizerSession.summarize(cleanText.slice(0, 10000)).catch((error) => {
      console.warn(`  ⚠️ Summary failed: ${error.message}, using fallback`);
      return cleanText.split(/\s+/).slice(0, 200).join(' ');
    });
  } else {
    // Use fallback for short content or if no summarizer
    console.log(`  ℹ️ Using fallback summary (${wordCount < 50 ? 'insufficient words' : 'no AI session'})`);
    summary = cleanText.split(/\s+/).slice(0, 200).join(' ');
  }

  console.log(`  ✅ Summary generated (${summary.length} chars):`);
  console.log(`     "${summary.slice(0, 150)}${summary.length > 150 ? '...' : ''}"`);

  // 3. Extract metadata (NO timeout - let AI take the time it needs)
  console.log(`  🏷️ Extracting metadata...`);
  const metadata = await extractMetadataWithSession(cleanText, summary);

  console.log(`  ✅ Metadata extracted:`);
  console.log(`     Keywords (${metadata.keywords.length}): ${metadata.keywords.slice(0, 8).join(', ')}${metadata.keywords.length > 8 ? '...' : ''}`);
  console.log(`     Entities (${metadata.entities.length}): ${metadata.entities.slice(0, 8).join(', ')}${metadata.entities.length > 8 ? '...' : ''}`);
  console.log(`     Topics (${metadata.topics.length}): ${metadata.topics.slice(0, 8).join(', ')}${metadata.topics.length > 8 ? '...' : ''}`);
  console.log(`     Type: ${metadata.type || 'N/A'}`);

  // 4. Update DB
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

    console.log(`  ✅ Tab ${tab.id} indexed in DB`);

    // 5. Update TF-IDF with AI data IMMEDIATELY
    await updateTFIDFWithAIData(tab.id, summary, metadata.keywords, dbEntry.title);
  } else {
    console.warn(`  ⚠️ Tab ${tab.id} not found in DB, skipping`);
  }
}

/**
 * Extract metadata using reusable session
 */
async function extractMetadataWithSession(content, summary) {
  if (!languageModelSession) {
    console.warn('⚠️ No Language Model session, using manual fallback');
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

    // NO timeout - let AI take the time it needs for quality metadata extraction
    const response = await languageModelSession.prompt(prompt);

    // Parse response
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
    console.error('Error extracting metadata:', error);
    console.log('⏭️ Falling back to manual extraction');
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
 * Parse a line
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
 * Update TF-IDF index with AI data
 * CRITICAL: This function updates the index PROGRESSIVELY during indexing
 */
async function updateTFIDFWithAIData(tabId, summary, keywords, title) {
  try {
    const indexData = await storage.getTFIDFIndex();
    
    if (!indexData) {
      console.warn('⚠️ Pas d\'index TF-IDF existant');
      return;
    }
    
    const tfidf = TFIDF.deserialize(indexData);
    
    // Remove old document (utilise le tabId Chrome)
    tfidf.removeDocument(tabId);
    
    // Add enriched document with repeated title (boost), summary and keywords
    const titleRepeated = `${title} ${title} ${title}`;
    const enrichedText = `${titleRepeated} ${summary} ${keywords.join(' ')}`;
    tfidf.addDocument(enrichedText, tabId);
    
    // Save updated index IMMEDIATELY so lite-mode benefits from improvements
    await storage.saveTFIDFIndex(tfidf.serialize());
    
    console.log(`  ✅ TF-IDF index updated for tab ${tabId}`);
    
  } catch (error) {
    console.error('Error updating TF-IDF:', error);
  }
}

/**
 * Finish cold start
 */
async function finishColdStart() {
  isIndexing = false;

  // Do NOT clear queue or reset index to allow resumption
  // indexingQueue = [];
  // currentIndex = 0;

  await storage.markColdStartDone();
  await storage.clearIndexingProgress();

  console.log('🎉 Cold Start completed!');
  console.log('💡 AI sessions kept for future indexing');

  // Enrich tab relationships with AI semantic analysis
  console.log('🔗 Enriching AI relationships...');

  // Initialize basic relationships first (if not already done)
  await initializeRelationships();

  // Enrich with AI semantic analysis
  await enrichRelationshipsWithAI();

  console.log('✅ AI relationships enriched');

  // Notify user with stats
  const stats = await db.getStats();
  const indexedCount = stats.tabs.indexed;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'tabyst.png',
    title: 'Taby - Indexing Completed',
    message: `AI indexing completed! ${indexedCount} tabs successfully indexed. 🎉`
  });
}

/**
 * Pause cold start
 */
async function pauseColdStart() {
  isIndexing = false;
  await storage.clearIndexingProgress();
  console.log('⏸️ Cold Start paused');
  console.log('💡 AI sessions preserved');
}

/**
 * Resume cold start
 */
async function resumeColdStart() {
  if (currentIndex >= indexingQueue.length) {
    console.log('⚠️ Nothing to resume');
    return;
  }

  isIndexing = true;
  console.log('▶️ Cold Start resumed');
  await processIndexingQueue();
}

/**
 * Index a new tab (used after cold start)
 */
async function indexNewTab(tab) {
  // Initialize sessions if necessary
  if (!sessionsInitialized) {
    await initAISessions();
  }

  console.log(`🆕 Indexing new tab: ${tab.title}`);

  try {
    // Ignore chrome:// and about: URLs
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
      console.log(`⏭️ System URL ignored: ${tab.url}`);
      return;
    }

    // Create Lite entry first
    const domain = new URL(tab.url).hostname;
    const urlHash = await db.generateUrlHash(tab.url);
    
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
    
    // Start AI indexing in background (non-blocking)
    setTimeout(async () => {
      await indexTabWithAI(tab);
    }, 1000); // Delay to avoid blocking UI

    console.log(`✅ New tab ${tab.id} added`);
    
  } catch (error) {
    console.error('Error indexing new tab:', error);
  }
}

/**
 * Check if AI sessions are available
 */
async function areSessionsReady() {
  if (!sessionsInitialized) {
    console.log('⚠️ Sessions not initialized, attempting init...');
    await initAISessions();
  }
  return summarizerSession !== null || languageModelSession !== null;
}

export {
  startColdStart,
  pauseColdStart,
  resumeColdStart,
  indexNewTab,
  areSessionsReady
};