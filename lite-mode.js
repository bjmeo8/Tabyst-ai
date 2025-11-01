/**
 * lite-mode.js
 * Fast scoring system with AI data support
 */

import { storage } from './storage.js';
import { db } from './db.js';
import { TFIDF } from './tfidf.js';

/**
 * Check if URL is accessible for content extraction
 */
function isAccessibleUrl(url) {
  if (!url) return false;

  const restrictedProtocols = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'edge://',
    'file://',
    'view-source:',
    'data:',
    'blob:'
  ];

  return !restrictedProtocols.some(protocol => url.startsWith(protocol));
}

/**
 * Extract text content from a tab with semantic enrichment
 */
async function extractTabContent(tabId) {
  try {
    // Get tab URL to check if accessible
    const tab = await chrome.tabs.get(tabId);

    if (!isAccessibleUrl(tab.url)) {
      console.log(`⏭️ URL not accessible for extraction: ${tab.url}`);
      return '';
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        let content = '';

        // 1. Meta description et keywords (strong weight)
        const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
        const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';
        if (metaDesc) content += `${metaDesc} ${metaDesc} ${metaDesc} `;
        if (metaKeywords) content += `${metaKeywords} ${metaKeywords} `;

        // 2. Open Graph tags (strong weight for SEO/sharing)
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
        if (ogTitle) content += `${ogTitle} ${ogTitle} `;
        if (ogDesc) content += `${ogDesc} `;

        // 3. Headers with weighting (important structure)
        const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim());
        const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim());
        const h3s = Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim());

        h1s.forEach(text => { if (text) content += `${text} ${text} ${text} ${text} ${text} `; }); // × 5
        h2s.forEach(text => { if (text) content += `${text} ${text} ${text} `; }); // × 3
        h3s.forEach(text => { if (text) content += `${text} ${text} `; }); // × 2

        // 4. Important links (navigation, anchors)
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.textContent.trim())
          .filter(text => text.length > 3 && text.length < 100);
        content += links.slice(0, 20).join(' ') + ' ';

        // 5. Images alt text (accessibility + context)
        const alts = Array.from(document.querySelectorAll('img[alt]'))
          .map(img => img.alt.trim())
          .filter(alt => alt.length > 3);
        content += alts.slice(0, 10).join(' ') + ' ';

        // 6. Main content (body text)
        const bodyText = document.body.innerText || '';
        content += bodyText;

        return content.slice(0, 15000);
      }
    });
    return results[0]?.result || '';
  } catch (error) {
    console.error('Error extracting content:', error);
    return '';
  }
}

/**
 * Build initial TF-IDF index with enriched metadata
 */
async function buildTFIDFIndex(tabs) {
  const tfidf = new TFIDF();

  for (const tab of tabs) {
    try {
      // Skip inaccessible tabs
      if (!isAccessibleUrl(tab.url)) {
        console.log(`⏭️ Skip restricted URL in index: ${tab.url}`);
        // Index at least with the title
        const titleRepeated = `${tab.title} ${tab.title} ${tab.title}`;
        const domain = new URL(tab.url).hostname;
        tfidf.addDocument(titleRepeated, tab.id, {
          domain: domain,
          title: tab.title,
          url: tab.url
        });
        continue;
      }

      const text = await extractTabContent(tab.id);
      const domain = new URL(tab.url).hostname;

      // Enriched text: title (3x weight) + content
      // Note: domain removed from index to avoid false positives on same domain
      const titleRepeated = `${tab.title} ${tab.title} ${tab.title}`;
      const combinedText = `${titleRepeated} ${text}`;

      // Use tab.id (Chrome tab ID) comme identifiant
      tfidf.addDocument(combinedText, tab.id, {
        domain: domain,
        title: tab.title,
        url: tab.url
      });
    } catch (error) {
      console.error('Error indexing tab:', tab.id, error);
    }
  }
  
  await storage.saveTFIDFIndex(tfidf.serialize());
  console.log('✅ Robust TF-IDF index built');
  
  return tfidf;
}

/**
 * Calculate TF-IDF score between two tabs (uses BM25)
 */
function calculateTFIDFScore(currentTabText, candidateTabId, tfidf) {
  if (!tfidf) return 0;
  return tfidf.bm25(currentTabText, candidateTabId);
}

/**
 * Calculate semantic similarity via cosine
 */
function calculateSemanticSimilarity(currentTabId, candidateTabId, tfidf) {
  if (!tfidf) return 0;
  return tfidf.cosineSimilarity(currentTabId, candidateTabId);
}

/**
 * Calculate behavioral score from history
 */
async function calculateBehavioralScore(currentTabId, candidateTabId) {
  try {
    const history = await db.getNavigationHistory(currentTabId, 100);
    
    const switches = history.filter(nav =>
      nav.toTab.tabId === candidateTabId
    );
    
    return Math.min(switches.length / 10, 1);
  } catch (error) {
    return 0;
  }
}

/**
 * Calculate temporal proximity score
 */
function calculateTemporalProximity(currentTab, candidateTab) {
  // Round timestamps to nearest minute for stability
  const oneMinute = 60 * 1000;
  const currentTime = Math.floor((currentTab.lastAccessed || Date.now()) / oneMinute) * oneMinute;
  const candidateTime = Math.floor((candidateTab.lastAccessed || 0) / oneMinute) * oneMinute;

  const timeDiff = Math.abs(currentTime - candidateTime);
  const thirtyMinutes = 30 * 60 * 1000;

  // Smoothed decay over 30 min instead of 5 min
  // Use quadratic decay to avoid temporal dominance
  const linearScore = Math.max(0, 1 - (timeDiff / thirtyMinutes));
  return Math.pow(linearScore, 2); // Quadratic to reduce impact
}

/**
 * Calculate access frequency score
 */
function calculateAccessFrequency(candidateTab) {
  // Based on accessCount si disponible
  const accessCount = candidateTab.accessCount || 0;
  
  // Normalization: 10+ accès = score max
  return Math.min(accessCount / 10, 1);
}

/**
 * Calculate recency score
 */
function calculateRecencyScore(candidateTab) {
  // Round to nearest minute for stability
  const oneMinute = 60 * 1000;
  const now = Math.floor(Date.now() / oneMinute) * oneMinute;
  const candidateTime = Math.floor((candidateTab.lastAccessed || 0) / oneMinute) * oneMinute;

  const hoursSinceAccess = (now - candidateTime) / (1000 * 60 * 60);

  // Decay over 24h
  return Math.max(0, 1 - (hoursSinceAccess / 24));
}

/**
 * Get AI enriched data for a tab
 */
async function getAIEnrichedData(tabId) {
  try {
    const dbEntry = await db.getTabByTabId(tabId);
    
    if (!dbEntry || !dbEntry.flags.isIndexed) {
      return null;
    }
    
    return {
      summary: dbEntry.content.summary,
      keywords: dbEntry.content.keywords || [],
      entities: dbEntry.content.entities || [],
      topics: dbEntry.content.topics || [],
      type: dbEntry.metadata.type
    };
  } catch (error) {
    return null;
  }
}

/**
 * Calculate score bonus based on AI data
 */
async function calculateAIBonus(currentTabId, candidateTabId) {
  try {
    const [currentAI, candidateAI] = await Promise.all([
      getAIEnrichedData(currentTabId),
      getAIEnrichedData(candidateTabId)
    ]);

    // Use AI even if only one of two tabs has data
    if (!currentAI && !candidateAI) {
      return 0; // No AI data available
    }

    let bonus = 0;

    // 1. Common entities (strong signal)
    const currentEntities = new Set((currentAI?.entities || []).map(e => e.toLowerCase()));
    const candidateEntities = new Set((candidateAI?.entities || []).map(e => e.toLowerCase()));
    const commonEntities = [...currentEntities].filter(e => candidateEntities.has(e));

    if (commonEntities.length > 0) {
      bonus += Math.min(commonEntities.length * 0.15, 0.3); // Max 0.3
      console.log(`🎯 [Lite AI] Entités: ${commonEntities.slice(0, 2).join(', ')}`);
    }

    // 2. Common topics
    const currentTopics = new Set((currentAI?.topics || []).map(t => t.toLowerCase()));
    const candidateTopics = new Set((candidateAI?.topics || []).map(t => t.toLowerCase()));
    const commonTopics = [...currentTopics].filter(t => candidateTopics.has(t));

    if (commonTopics.length > 0) {
      bonus += Math.min(commonTopics.length * 0.1, 0.2); // Max 0.2
      console.log(`🎯 [Lite AI] Topics: ${commonTopics.slice(0, 2).join(', ')}`);
    }

    // 3. Common keywords
    const currentKeywords = new Set((currentAI?.keywords || []).map(k => k.toLowerCase()));
    const candidateKeywords = new Set((candidateAI?.keywords || []).map(k => k.toLowerCase()));
    const commonKeywords = [...currentKeywords].filter(k => candidateKeywords.has(k));

    if (commonKeywords.length > 0) {
      bonus += Math.min(commonKeywords.length * 0.05, 0.15); // Max 0.15
    }

    // 4. Same document type
    if (currentAI?.type && candidateAI?.type && currentAI.type === candidateAI.type && currentAI.type !== 'other') {
      bonus += 0.1;
    }

    return Math.min(bonus, 0.5); // Max bonus of 0.5
    
  } catch (error) {
    console.error('Error calculating AI bonus:', error);
    return 0;
  }
}

/**
 * Lite Mode: Complete scoring with progressive AI support
 */
async function getLiteSuggestions(currentTab, allTabs) {
  // Get or build TF-IDF index
  let tfidf = null;
  try {
    const indexData = await storage.getTFIDFIndex();
    if (indexData) {
      tfidf = TFIDF.deserialize(indexData);
      console.log(`📊 TF-IDF index loaded (${tfidf.documents.length} documents)`);
    } else {
      console.log('🔨 Building new index TF-IDF...');
      tfidf = await buildTFIDFIndex(allTabs);
    }
  } catch (error) {
    console.error('TF-IDF error:', error);
  }
  
  const currentDomain = new URL(currentTab.url).hostname;
  // Note: domain removed from query to avoid false positives (ex: 2 Google Docs différents)
  const currentTabText = `${currentTab.title} ${currentTab.title} ${currentTab.title}`;
  const otherTabs = allTabs.filter(t => t.id !== currentTab.id);
  
  // Check if we have AI data
  const coldStartDone = await storage.isColdStartDone();
  
  // Score chaque tab
  const scored = await Promise.all(
    otherTabs.map(async candidateTab => {
      let score = 0;
      const candidateDomain = new URL(candidateTab.url).hostname;
      
      // 1. Textual BM25 (20% - reduced)
      const bm25Score = tfidf ? calculateTFIDFScore(currentTabText, candidateTab.id, tfidf) : 0;
      score += Math.min(bm25Score / 10, 1) * 0.20;
      
      // 2. Cosine similarity (15% - reduced)
      const cosineSim = tfidf ? calculateSemanticSimilarity(currentTab.id, candidateTab.id, tfidf) : 0;
      score += cosineSim * 0.15;
      
      // 3. Bonus AI (20%)
      let aiBonus = 0;
      if (coldStartDone) {
        aiBonus = await calculateAIBonus(currentTab.id, candidateTab.id);
        score += aiBonus * 0.20;
      }
      
      // 4. Navigation history (15%)
      const behavioralScore = await calculateBehavioralScore(currentTab.id, candidateTab.id);
      score += behavioralScore * 0.15;

      // 5. Access frequency (10%)
      const accessFrequency = calculateAccessFrequency(candidateTab);
      score += accessFrequency * 0.10;

      // 6. Recency (8%)
      const recencyScore = calculateRecencyScore(candidateTab);
      score += recencyScore * 0.08;

      // 7. Temporal proximity (7%)
      const temporalProximity = calculateTemporalProximity(currentTab, candidateTab);
      score += temporalProximity * 0.07;

      // Note: Domain bonus removed - same domain doesn't mean similar content
      // (ex: 2 Google Docs with different subjects)
      const domainScore = 0;
      
      return {
        ...candidateTab,
        score: score,
        aiBonus: aiBonus,
        behavioralScore: behavioralScore,
        temporalProximity: temporalProximity,
        reason: await generateLiteReason(currentTab, candidateTab, domainScore > 0, behavioralScore > 0.3, aiBonus > 0, tfidf)
      };
    })
  );
  
  // Sort by descending score with stable secondary sort (tabId)
  const topSuggestions = scored
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      return scoreDiff !== 0 ? scoreDiff : a.id - b.id;
    })
    .slice(0, 10);
  
  // Log for debug
  if (coldStartDone && topSuggestions.length > 0) {
    console.log(`🎯 Top suggestion: ${topSuggestions[0].title} (score: ${topSuggestions[0].score.toFixed(3)}, AI: ${topSuggestions[0].aiBonus.toFixed(3)})`);
  }
  
  return topSuggestions;
}

/**
 * Generate enriched reason for Lite mode
 */
async function generateLiteReason(currentTab, candidateTab, sameDomain, hasStrongHistory, hasAIBonus, tfidf) {
  // Prioritize strong history
  if (hasStrongHistory) {
    return 'Frequently used together';
  }
  
  // If AI found strong connection
  if (hasAIBonus) {
    try {
      const [currentAI, candidateAI] = await Promise.all([
        getAIEnrichedData(currentTab.id),
        getAIEnrichedData(candidateTab.id)
      ]);
      
      if (currentAI && candidateAI) {
        // Common entities
        const currentEntities = new Set(currentAI.entities.map(e => e.toLowerCase()));
        const candidateEntities = new Set(candidateAI.entities.map(e => e.toLowerCase()));
        const commonEntities = [...currentEntities].filter(e => candidateEntities.has(e));
        
        if (commonEntities.length > 0) {
          return `Related: ${commonEntities.slice(0, 2).join(', ')}`;
        }
        
        // Common topics
        const currentTopics = new Set(currentAI.topics.map(t => t.toLowerCase()));
        const candidateTopics = new Set(candidateAI.topics.map(t => t.toLowerCase()));
        const commonTopics = [...currentTopics].filter(t => candidateTopics.has(t));
        
        if (commonTopics.length > 0) {
          return `Similar topic: ${commonTopics[0]}`;
        }
      }
    } catch (e) {
      // Continue with fallback
    }
  }
  
  if (sameDomain) {
    return `Same domain: ${new URL(currentTab.url).hostname}`;
  }
  if (hasStrongHistory) {
    return 'Frequently used together';
  }
  
  // Try to extract common terms
  if (tfidf) {
    try {
      const topTerms = tfidf.getTopTerms(candidateTab.id, 3);
      if (topTerms.length > 0) {
        const terms = topTerms
          .filter(t => !t.includes('_')) // Pas les n-grams
          .slice(0, 2)
          .join(', ');
        if (terms) return `Related: ${terms}`;
      }
    } catch (e) {
      // Ignore
    }
  }
  
  return 'Recently accessed';
}

export {
  getLiteSuggestions,
  buildTFIDFIndex,
  extractTabContent,
  calculateBehavioralScore,
  calculateSemanticSimilarity,
  getAIEnrichedData,
  isAccessibleUrl
};