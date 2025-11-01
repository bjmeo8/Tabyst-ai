/**
 * hybrid-scoring.js
 * Hybrid scoring system combining TF-IDF, AI and behavior
 */

import { storage } from './storage.js';
import { db } from './db.js';
import { TFIDF } from './tfidf.js';
import { getRelatedTabs } from './relationships.js';

/**
 * Calculate hybrid score for a candidate tab
 */
async function calculateHybridScore(currentTab, candidateTab, tfidf) {
  let score = 0;
  const scores = {}; // For debug

  // 1. TF-IDF enriched with AI (18%)
  const tfidfScore = await calculateTFIDFScore(currentTab, candidateTab, tfidf);
  score += tfidfScore * 0.18;
  scores.tfidf = tfidfScore;

  // 2. Cosine similarity (12%)
  const cosineSim = await calculateCosineSimilarity(currentTab.id, candidateTab.id, tfidf);
  score += cosineSim * 0.12;
  scores.cosine = cosineSim;

  // 3. Common AI entities (28%)
  const entityScore = await calculateEntityOverlap(currentTab.id, candidateTab.id);
  score += entityScore * 0.28;
  scores.entities = entityScore;

  // 4. Common AI topics (22%)
  const topicScore = await calculateTopicOverlap(currentTab.id, candidateTab.id);
  score += topicScore * 0.22;
  scores.topics = topicScore;

  // 5. AI relationships (10%)
  const relationshipScore = await calculateRelationshipScore(currentTab.id, candidateTab.id);
  score += relationshipScore * 0.10;
  scores.relationship = relationshipScore;

  // 6. Behavioral (10%)
  const behavioralScore = await calculateBehavioralScore(currentTab.id, candidateTab.id);
  score += behavioralScore * 0.10;
  scores.behavioral = behavioralScore;

  return {
    total: score,
    breakdown: scores
  };
}

/**
 * Calculate enriched TF-IDF score with BM25 + AI data
 */
async function calculateTFIDFScore(currentTab, candidateTab, tfidf) {
  if (!tfidf) return 0;

  try {
    // Get AI data from current tab
    const currentTabData = await db.getTabByTabId(currentTab.id);

    // Build enriched query with AI data if available
    // Note: domain removed to avoid false positives (ex: 2 different Google Docs)
    let queryText = `${currentTab.title} ${currentTab.title} ${currentTab.title}`;

    if (currentTabData?.flags.isIndexed && currentTabData.content) {
      const { summary, keywords, entities, topics } = currentTabData.content;

      // Add summary (moderate weight)
      if (summary) {
        queryText += ` ${summary}`;
      }

      // Add keywords (strong weight)
      if (keywords?.length > 0) {
        queryText += ` ${keywords.join(' ')} ${keywords.join(' ')}`;
      }

      // Add entities (very strong weight)
      if (entities?.length > 0) {
        queryText += ` ${entities.join(' ')} ${entities.join(' ')} ${entities.join(' ')}`;
      }

      // Add topics (strong weight)
      if (topics?.length > 0) {
        queryText += ` ${topics.join(' ')} ${topics.join(' ')}`;
      }
    }

    const bm25Score = tfidf.bm25(queryText, candidateTab.id);

    // Normalize (BM25 peut être > 10)
    return Math.min(bm25Score / 10, 1);
  } catch (error) {
    return 0;
  }
}

/**
 * Calculate cosine similarity between two tabs
 */
async function calculateCosineSimilarity(currentTabId, candidateTabId, tfidf) {
  if (!tfidf) return 0;
  
  try {
    return tfidf.cosineSimilarity(currentTabId, candidateTabId);
  } catch (error) {
    return 0;
  }
}

/**
 * Calculate entity overlap (AI)
 */
async function calculateEntityOverlap(currentTabId, candidateTabId) {
  try {
    const [currentTab, candidateTab] = await Promise.all([
      db.getTabByTabId(currentTabId),
      db.getTabByTabId(candidateTabId)
    ]);

    // Use AI if available for AT LEAST one of the tabs
    const currentIndexed = currentTab?.flags.isIndexed;
    const candidateIndexed = candidateTab?.flags.isIndexed;

    if (!currentIndexed && !candidateIndexed) {
      return 0; // No AI data
    }

    const currentEntities = new Set(
      (currentTab?.content?.entities || []).map(e => e.toLowerCase())
    );
    const candidateEntities = new Set(
      (candidateTab?.content?.entities || []).map(e => e.toLowerCase())
    );

    if (currentEntities.size === 0 || candidateEntities.size === 0) {
      return 0;
    }

    // Intersection
    const common = [...currentEntities].filter(e => candidateEntities.has(e));

    if (common.length > 0) {
      console.log(`🎯 [AI] Common entities (${common.length}): ${common.slice(0, 3).join(', ')}`);
    }

    // Jaccard similarity
    const union = new Set([...currentEntities, ...candidateEntities]);
    const jaccardScore = common.length / union.size;

    // Boost if many d'entités communes
    const overlapBonus = Math.min(common.length / 5, 0.5);

    return Math.min(jaccardScore + overlapBonus, 1);

  } catch (error) {
    return 0;
  }
}

/**
 * Calculate topic overlap (AI)
 */
async function calculateTopicOverlap(currentTabId, candidateTabId) {
  try {
    const [currentTab, candidateTab] = await Promise.all([
      db.getTabByTabId(currentTabId),
      db.getTabByTabId(candidateTabId)
    ]);

    // Use AI if available for AT LEAST one of the tabs
    const currentIndexed = currentTab?.flags.isIndexed;
    const candidateIndexed = candidateTab?.flags.isIndexed;

    if (!currentIndexed && !candidateIndexed) {
      return 0; // No AI data
    }

    const currentTopics = new Set(
      (currentTab?.content?.topics || []).map(t => t.toLowerCase())
    );
    const candidateTopics = new Set(
      (candidateTab?.content?.topics || []).map(t => t.toLowerCase())
    );

    if (currentTopics.size === 0 || candidateTopics.size === 0) {
      return 0;
    }

    // Intersection
    const common = [...currentTopics].filter(t => candidateTopics.has(t));

    if (common.length > 0) {
      console.log(`🎯 [AI] Topics communs (${common.length}): ${common.slice(0, 2).join(', ')}`);
    }

    // Jaccard similarity
    const union = new Set([...currentTopics, ...candidateTopics]);
    const jaccardScore = common.length / union.size;

    // Boost if many common topics
    const overlapBonus = Math.min(common.length / 3, 0.4);

    return Math.min(jaccardScore + overlapBonus, 1);

  } catch (error) {
    return 0;
  }
}

/**
 * Calculate score based on AI relationships between tabs
 */
async function calculateRelationshipScore(currentTabId, candidateTabId) {
  try {
    // Get current tab from DB
    const currentTab = await db.getTabByTabId(currentTabId);
    if (!currentTab) return 0;

    // Get relationships for current tab
    const relationships = await db.getRelationshipsForTab(currentTab.id);

    // Find relationship with candidate
    const candidateTab = await db.getTabByTabId(candidateTabId);
    if (!candidateTab) return 0;

    const relation = relationships.find(rel =>
      rel.tab1Id === candidateTab.id || rel.tab2Id === candidateTab.id
    );

    if (!relation) return 0;

    // Use relationship strength (0-1) comme score
    // Boost if AI-enriched
    let score = relation.strength;
    if (relation.flags.isAIEnriched && relation.metadata.semanticScore > 0) {
      // Combine basic strength and AI semantic score
      score = Math.max(score, relation.metadata.semanticScore);
      console.log(`🔗 [Relation] Force: ${relation.strength.toFixed(2)}, Sémantique: ${relation.metadata.semanticScore.toFixed(2)}`);
    }

    return Math.min(score, 1);

  } catch (error) {
    return 0;
  }
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

    // Normalize : 10+ switches = score max
    return Math.min(switches.length / 10, 1);
  } catch (error) {
    return 0;
  }
}

/**
 * Get hybrid suggestions for a tab
 */
async function getHybridSuggestions(currentTab, allTabs, workflowPrediction = null) {
  // Get TF-IDF index
  let tfidf = null;
  try {
    const indexData = await storage.getTFIDFIndex();
    if (indexData) {
      tfidf = TFIDF.deserialize(indexData);
      console.log(`📊 [Hybrid] Index TF-IDF chargé (${tfidf.documents.length} documents)`);
    }
  } catch (error) {
    console.error('[Hybrid] TF-IDF error:', error);
  }

  // Check how many tabs have AI data
  const currentTabData = await db.getTabByTabId(currentTab.id);
  const currentHasAI = currentTabData?.flags.isIndexed || false;
  console.log(`🤖 [Hybrid] Current tab AI indexed: ${currentHasAI ? 'OUI' : 'NON'}`);

  if (currentHasAI && currentTabData.content.entities) {
    console.log(`   Entités (${currentTabData.content.entities.length}): ${currentTabData.content.entities.slice(0, 3).join(', ')}`);
    console.log(`   Topics (${currentTabData.content.topics.length}): ${currentTabData.content.topics.slice(0, 2).join(', ')}`);
  }

  const otherTabs = allTabs.filter(t => t.id !== currentTab.id);

  // Score each tab
  const scored = await Promise.all(
    otherTabs.map(async candidateTab => {
      const result = await calculateHybridScore(currentTab, candidateTab, tfidf);

      // Workflow bonus: +0.3 to score if tab predicted by workflow
      let finalScore = result.total;
      let workflowBonus = 0;

      if (workflowPrediction && candidateTab.id === workflowPrediction.tab.id) {
        workflowBonus = 0.3 * workflowPrediction.confidence;
        finalScore += workflowBonus;
        console.log(`🔮 [Hybrid] Workflow bonus: +${workflowBonus.toFixed(3)} for ${candidateTab.title}`);
      }

      return {
        ...candidateTab,
        score: finalScore,
        scoreBreakdown: {
          ...result.breakdown,
          workflowBonus
        },
        reason: await generateHybridReason(currentTab, candidateTab, result.breakdown, workflowBonus > 0)
      };
    })
  );

  // AI statistics
  const tabsWithEntityScore = scored.filter(s => s.scoreBreakdown.entities > 0).length;
  const tabsWithTopicScore = scored.filter(s => s.scoreBreakdown.topics > 0).length;
  console.log(`📊 [Hybrid] ${tabsWithEntityScore}/${scored.length} tabs with entities, ${tabsWithTopicScore}/${scored.length} with topics`);

  // Sort by descending score with stable secondary sort (tabId)
  const topSuggestions = scored
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      return scoreDiff !== 0 ? scoreDiff : a.id - b.id;
    })
    .slice(0, 10);

  // Log top suggestion
  if (topSuggestions.length > 0) {
    const top = topSuggestions[0];
    console.log(`🎯 [Hybrid] Top: ${top.title}`);
    console.log(`   Score: ${top.score.toFixed(3)}`, top.scoreBreakdown);
  }

  return topSuggestions;
}

/**
 * Generate reason for suggestion
 */
async function generateHybridReason(currentTab, candidateTab, breakdown, hasWorkflowBonus = false) {
  // If workflow bonus, priority to this signal
  if (hasWorkflowBonus) {
    return 'Part of workflow pattern';
  }

  // Find strongest signal
  const signals = [
    { name: 'entities', score: breakdown.entities, text: 'Common entities' },
    { name: 'topics', score: breakdown.topics, text: 'Similar topics' },
    { name: 'behavioral', score: breakdown.behavioral, text: 'Frequently used together' },
    { name: 'tfidf', score: breakdown.tfidf, text: 'Related content' },
    { name: 'cosine', score: breakdown.cosine, text: 'Similar content' }
  ];

  const topSignal = signals.sort((a, b) => b.score - a.score)[0];
  
  // If entities/topics, give details
  if (topSignal.name === 'entities' && topSignal.score > 0.3) {
    try {
      const [currentTabData, candidateTabData] = await Promise.all([
        db.getTabByTabId(currentTab.id),
        db.getTabByTabId(candidateTab.id)
      ]);
      
      if (currentTabData?.flags.isIndexed && candidateTabData?.flags.isIndexed) {
        const currentEntities = new Set(
          (currentTabData.content.entities || []).map(e => e.toLowerCase())
        );
        const candidateEntities = new Set(
          (candidateTabData.content.entities || []).map(e => e.toLowerCase())
        );
        const common = [...currentEntities].filter(e => candidateEntities.has(e));
        
        if (common.length > 0) {
          return `Related: ${common.slice(0, 2).join(', ')}`;
        }
      }
    } catch (e) {
      // Continue
    }
  }
  
  if (topSignal.name === 'topics' && topSignal.score > 0.3) {
    try {
      const [currentTabData, candidateTabData] = await Promise.all([
        db.getTabByTabId(currentTab.id),
        db.getTabByTabId(candidateTab.id)
      ]);
      
      if (currentTabData?.flags.isIndexed && candidateTabData?.flags.isIndexed) {
        const currentTopics = new Set(
          (currentTabData.content.topics || []).map(t => t.toLowerCase())
        );
        const candidateTopics = new Set(
          (candidateTabData.content.topics || []).map(t => t.toLowerCase())
        );
        const common = [...currentTopics].filter(t => candidateTopics.has(t));
        
        if (common.length > 0) {
          return `Topic: ${common[0]}`;
        }
      }
    } catch (e) {
      // Continue
    }
  }
  
  // Common domain
  try {
    const currentDomain = new URL(currentTab.url).hostname;
    const candidateDomain = new URL(candidateTab.url).hostname;
    
    if (currentDomain === candidateDomain) {
      return `Same domain: ${currentDomain}`;
    }
  } catch (e) {
    // Continue
  }
  
  return topSignal.text;
}

export {
  getHybridSuggestions,
  calculateHybridScore,
  calculateEntityOverlap,
  calculateTopicOverlap
};