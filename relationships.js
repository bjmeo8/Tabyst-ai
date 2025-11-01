/**
 * relationships.js
 * Managing relationships between tabs
 */

import { db } from './db.js';
import { storage } from './storage.js';

/**
 * Create basic relationships between tabs (without AI)
 */
async function createBasicRelationships(tab1Id, tab2Id, reason = 'navigation') {
  try {
    const [tab1, tab2] = await Promise.all([
      db.getTabByTabId(tab1Id),
      db.getTabByTabId(tab2Id)
    ]);
    
    if (!tab1 || !tab2) return;
    
    // Check if relationship exists
    const existing = await db.getRelationship(tab1.id, tab2.id);
    
    if (existing) {
      // Strengthen existing relationship
      await strengthenRelationship(existing.id);
    } else {
      // Create new relationship
      await db.addRelationship({
        id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tab1Id: tab1.id,
        tab2Id: tab2.id,
        
        strength: 0.3, // Initial strength
        type: reason, // navigation|domain|content|ai
        
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
        
        metadata: {
          commonDomain: new URL(tab1.url).hostname === new URL(tab2.url).hostname,
          sharedEntities: [],
          sharedTopics: [],
          coOccurrenceScore: 0
        },
        
        flags: {
          isAIEnriched: false,
          needsUpdate: false
        }
      });
      
      console.log(`🔗 Relationship created [${reason}]: ${tab1.title} ↔ ${tab2.title}`);
    }
  } catch (error) {
    console.error('Error creating relationship:', error);
  }
}

/**
 * Semantic analysis of relationship between two tabs with Prompt API
 */
async function analyzeSemanticRelationship(tab1, tab2) {
  try {
    // Check availability Prompt API
    if (!('LanguageModel' in self)) {
      return null;
    }

    const availability = await LanguageModel.availability();
    if (availability === 'unavailable') {
      return null;
    }

    // Create session
    const session = await LanguageModel.create({
      temperature: 0.2,
      topK: 3
    });

    const prompt = `Analyze the semantic relationship between these two browser tabs and rate their similarity.

Tab 1:
Title: ${tab1.title}
Summary: ${tab1.content.summary?.slice(0, 300) || 'N/A'}
Keywords: ${(tab1.content.keywords || []).slice(0, 8).join(', ')}
Entities: ${(tab1.content.entities || []).slice(0, 8).join(', ')}
Topics: ${(tab1.content.topics || []).slice(0, 5).join(', ')}

Tab 2:
Title: ${tab2.title}
Summary: ${tab2.content.summary?.slice(0, 300) || 'N/A'}
Keywords: ${(tab2.content.keywords || []).slice(0, 8).join(', ')}
Entities: ${(tab2.content.entities || []).slice(0, 8).join(', ')}
Topics: ${(tab2.content.topics || []).slice(0, 5).join(', ')}

Provide:
1. SIMILARITY_SCORE: A number from 0.0 to 1.0 indicating how related these tabs are
2. RELATIONSHIP_TYPE: One of [complementary, similar, sequential, unrelated]
3. REASON: A brief explanation (max 50 words)

Format:
SIMILARITY_SCORE: 0.X
RELATIONSHIP_TYPE: xxx
REASON: xxx`;

    const response = await session.prompt(prompt);
    session.destroy();

    // Parse response
    const lines = response.split('\n');
    const scoreLine = lines.find(l => l.toUpperCase().includes('SIMILARITY_SCORE'));
    const typeLine = lines.find(l => l.toUpperCase().includes('RELATIONSHIP_TYPE'));
    const reasonLine = lines.find(l => l.toUpperCase().includes('REASON'));

    const score = parseFloat(scoreLine?.split(':')[1]?.trim() || '0');
    const type = typeLine?.split(':')[1]?.trim().toLowerCase() || 'unrelated';
    const reason = reasonLine?.split(':')[1]?.trim() || '';

    return {
      semanticScore: isNaN(score) ? 0 : Math.min(Math.max(score, 0), 1),
      relationshipType: type,
      reason
    };

  } catch (error) {
    console.error('Error semantic analysis:', error);
    return null;
  }
}

/**
 * Enrich relationships with AI data et analyse sémantique
 */
async function enrichRelationshipsWithAI() {
  try {
    // Get non-enriched relationships
    const relationships = await db.getAllRelationships();
    const toEnrich = relationships.filter(r => !r.flags.isAIEnriched);

    console.log(`🤖 AI enrichment: ${toEnrich.length} relations`);

    for (const rel of toEnrich) {
      try {
        const [tab1, tab2] = await Promise.all([
          db.getTab(rel.tab1Id),
          db.getTab(rel.tab2Id)
        ]);

        // Skip if no AI data for AT LEAST one tab
        const tab1Indexed = tab1?.flags.isIndexed;
        const tab2Indexed = tab2?.flags.isIndexed;

        if (!tab1Indexed && !tab2Indexed) {
          continue;
        }

        // Calculate common entities
        const entities1 = new Set((tab1?.content?.entities || []).map(e => e.toLowerCase()));
        const entities2 = new Set((tab2?.content?.entities || []).map(e => e.toLowerCase()));
        const sharedEntities = [...entities1].filter(e => entities2.has(e));

        // Calculate common topics
        const topics1 = new Set((tab1?.content?.topics || []).map(t => t.toLowerCase()));
        const topics2 = new Set((tab2?.content?.topics || []).map(t => t.toLowerCase()));
        const sharedTopics = [...topics1].filter(t => topics2.has(t));

        // Score de co-occurrence (Jaccard)
        const allEntities = new Set([...entities1, ...entities2]);
        const allTopics = new Set([...topics1, ...topics2]);
        const entityScore = allEntities.size > 0 ? sharedEntities.length / allEntities.size : 0;
        const topicScore = allTopics.size > 0 ? sharedTopics.length / allTopics.size : 0;
        const jaccardScore = (entityScore + topicScore) / 2;

        // Semantic analysis with Prompt API (si les deux tabs indexés)
        let semanticAnalysis = null;
        if (tab1Indexed && tab2Indexed) {
          semanticAnalysis = await analyzeSemanticRelationship(tab1, tab2);
          // Add delay to prevent "model crashed too many times" errors
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Calculate final strength
        let finalStrength = rel.strength + (jaccardScore * 0.3);
        let finalType = rel.type;
        let aiReason = '';

        if (semanticAnalysis) {
          finalStrength = Math.min(finalStrength + (semanticAnalysis.semanticScore * 0.4), 1);
          finalType = semanticAnalysis.relationshipType;
          aiReason = semanticAnalysis.reason;
          console.log(`  🧠 Semantic analysis: ${semanticAnalysis.semanticScore.toFixed(2)} (${semanticAnalysis.relationshipType})`);
        }

        // Delete relationship if clearly unrelated
        const isUnrelated = (
          (semanticAnalysis?.semanticScore || 0) < 0.2 &&
          sharedEntities.length === 0 &&
          sharedTopics.length === 0
        );

        if (isUnrelated) {
          await db.deleteRelationship(rel.id);
          console.log(`  🗑️ Relationship deleted: unrelated content (semantic: ${(semanticAnalysis?.semanticScore || 0).toFixed(2)}, entities: 0, topics: 0)`);
          continue;
        }

        // Update relationship
        await db.updateRelationship(rel.id, {
          type: finalType,
          metadata: {
            ...rel.metadata,
            sharedEntities,
            sharedTopics,
            coOccurrenceScore: jaccardScore,
            semanticScore: semanticAnalysis?.semanticScore || 0,
            aiReason
          },
          strength: finalStrength,
          flags: {
            ...rel.flags,
            isAIEnriched: true
          }
        });

        console.log(`  ✅ Relationship enriched: ${sharedEntities.length} entities, ${sharedTopics.length} topics, strength: ${finalStrength.toFixed(2)}`);

      } catch (error) {
        console.error('Error enriching relationship:', error);
      }
    }

    console.log(`✅ Enrichment completed`);

  } catch (error) {
    console.error('Error enriching relationships:', error);
  }
}

/**
 * Strengthen relationship (augmente strength)
 */
async function strengthenRelationship(relationshipId) {
  try {
    const rel = await db.getRelationship(relationshipId);
    if (!rel) return;
    
    const newStrength = Math.min(rel.strength + 0.1, 1);
    const newAccessCount = rel.accessCount + 1;
    
    await db.updateRelationship(relationshipId, {
      strength: newStrength,
      accessCount: newAccessCount,
      lastAccessedAt: Date.now()
    });
    
    console.log(`💪 Relationship strengthened: ${newStrength.toFixed(2)}`);
  } catch (error) {
    console.error('Error strengthening relationship:', error);
  }
}

/**
 * Apply decay to relationships non utilisées
 */
async function applyRelationshipDecay() {
  try {
    const relationships = await db.getAllRelationships();
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    
    let decayed = 0;
    
    for (const rel of relationships) {
      const timeSinceAccess = now - rel.lastAccessedAt;
      
      if (timeSinceAccess > oneWeek) {
        // Time-proportional decay
        const weeksInactive = timeSinceAccess / oneWeek;
        const decayAmount = Math.min(weeksInactive * 0.05, 0.3);
        const newStrength = Math.max(rel.strength - decayAmount, 0);
        
        if (newStrength < 0.1) {
          // Remove too weak relationships
          await db.deleteRelationship(rel.id);
          console.log(`🗑️ Relationship deleted (trop faible)`);
        } else {
          await db.updateRelationship(rel.id, {
            strength: newStrength
          });
          decayed++;
        }
      }
    }
    
    console.log(`⏱️ Decay applied: ${decayed} relations`);
    
  } catch (error) {
    console.error('Error decay relationships:', error);
  }
}

/**
 * Get related tabs à un tab donné
 */
async function getRelatedTabs(tabId, minStrength = 0.3) {
  try {
    const tab = await db.getTabByTabId(tabId);
    if (!tab) return [];
    
    const relationships = await db.getRelationshipsForTab(tab.id);
    
    // Filter by minimum strength et trie
    const related = relationships
      .filter(r => r.strength >= minStrength)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10);
    
    // Get tabs
    const relatedTabs = await Promise.all(
      related.map(async rel => {
        const otherTabId = rel.tab1Id === tab.id ? rel.tab2Id : rel.tab1Id;
        const otherTab = await db.getTab(otherTabId);
        
        if (!otherTab) return null;
        
        return {
          ...otherTab,
          relationshipStrength: rel.strength,
          relationshipType: rel.type,
          sharedEntities: rel.metadata.sharedEntities,
          sharedTopics: rel.metadata.sharedTopics
        };
      })
    );
    
    return relatedTabs.filter(Boolean);
    
  } catch (error) {
    console.error('Error getting related tabs:', error);
    return [];
  }
}

/**
 * Initialize relationships for all existing tabs
 * Only creates relationships based on AI content analysis, not domain
 */
async function initializeRelationships() {
  try {
    console.log('🔗 Initializing relationships...');

    const allTabs = await db.getAllTabs();
    const activeTabs = allTabs.filter(t => t.flags.isActive);
    const indexedTabs = activeTabs.filter(t => t.flags.isIndexed);

    console.log(`📊 ${activeTabs.length} active tabs, ${indexedTabs.length} indexed with AI data`);

    // Only create relationships for tabs with AI data
    if (indexedTabs.length < 2) {
      console.log('⏭️ Not enough indexed tabs for relationship creation');
      return;
    }

    // Generic words to filter out (not meaningful for relationships)
    const genericWords = new Set([
      'google', 'docs', 'document', 'wikipédia', 'wikipedia', 'recherche',
      'search', 'page', 'site', 'web', 'article', 'notes', 'sommaire',
      'références', 'liens', 'external', 'navigation', 'menu'
    ]);

    // Create content-based relationships only for indexed tabs
    let created = 0;
    for (let i = 0; i < indexedTabs.length; i++) {
      for (let j = i + 1; j < indexedTabs.length; j++) {
        const tab1 = indexedTabs[i];
        const tab2 = indexedTabs[j];

        // Calculate common entities (excluding generic words)
        const entities1 = new Set((tab1?.content?.entities || [])
          .map(e => e.toLowerCase())
          .filter(e => !genericWords.has(e) && e.length > 2));
        const entities2 = new Set((tab2?.content?.entities || [])
          .map(e => e.toLowerCase())
          .filter(e => !genericWords.has(e) && e.length > 2));
        const sharedEntities = [...entities1].filter(e => entities2.has(e));

        // Calculate common topics (excluding generic words)
        const topics1 = new Set((tab1?.content?.topics || [])
          .map(t => t.toLowerCase())
          .filter(t => !genericWords.has(t) && t.length > 2));
        const topics2 = new Set((tab2?.content?.topics || [])
          .map(t => t.toLowerCase())
          .filter(t => !genericWords.has(t) && t.length > 2));
        const sharedTopics = [...topics1].filter(t => topics2.has(t));

        // Only create relationship if there's MEANINGFUL content overlap
        // Require at least 1 shared entity OR 1 shared topic (both non-generic)
        const hasMeaningfulOverlap = (
          sharedEntities.length >= 1 ||
          sharedTopics.length >= 1
        );

        if (hasMeaningfulOverlap) {
          // Check if relationship already exists
          const existing = await db.getRelationship(tab1.id, tab2.id);
          if (!existing) {
            await createBasicRelationships(tab1.tabId, tab2.tabId, 'content');
            created++;
          }
        }
      }
    }

    console.log(`📝 Created ${created} content-based relationships`);

    // Enrich with AI semantic analysis
    await enrichRelationshipsWithAI();

    console.log('✅ Relationships initialized');

  } catch (error) {
    console.error('Error initializing relationships:', error);
  }
}

export {
  createBasicRelationships,
  enrichRelationshipsWithAI,
  strengthenRelationship,
  applyRelationshipDecay,
  getRelatedTabs,
  initializeRelationships
};