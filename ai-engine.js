/**
 * ai-engine.js
 * Intégration Chrome Built-in AI APIs (selon doc officielle)
 */

import { storage } from './storage.js';
import { db } from './db.js';
import { TFIDF } from './tfidf.js';

/**
 * Génère un résumé de 200 mots avec Summarizer API
 */
async function generateComprehensiveSummary(content) {
  try {
    // Vérifier disponibilité
    if (!('Summarizer' in self)) {
      return extractManualSummary(content);
    }
    
    const availability = await Summarizer.availability();
    
    if (availability === 'unavailable') {
      console.warn('Summarizer API non disponible');
      return extractManualSummary(content);
    }
    
    // Créer le summarizer
    const summarizer = await Summarizer.create({
      type: 'key-points',
      format: 'plain-text',
      length: 'medium',
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`Summarizer téléchargement: ${Math.round(e.loaded * 100)}%`);
        });
      }
    });
    
    // Résumer
    const summary = await summarizer.summarize(content.slice(0, 10000));
    
    // Cleanup
    summarizer.destroy();
    
    return summary;
    
  } catch (error) {
    console.error('Erreur Summarizer API:', error);
    return extractManualSummary(content);
  }
}

/**
 * Fallback : résumé manuel
 */
function extractManualSummary(content) {
  const words = content.split(/\s+/).slice(0, 200);
  return words.join(' ');
}

/**
 * Extrait métadonnées riches avec Prompt API
 */
async function extractRichKeywords(content, summary) {
  try {
    // Vérifier disponibilité
    if (!('LanguageModel' in self)) {
      return extractManualMetadata(content);
    }
    
    const availability = await LanguageModel.availability();
    
    if (availability === 'unavailable') {
      console.warn('Prompt API non disponible');
      return extractManualMetadata(content);
    }
    
    // Créer session
    const session = await LanguageModel.create({
      temperature: 0.3,
      topK: 3,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`Language Model téléchargement: ${Math.round(e.loaded * 100)}%`);
        });
      }
    });
    
    const prompt = `Analyze this document and extract key information in this exact format:

KEYWORDS: 8-10 main keywords or key phrases (comma-separated)
ENTITIES: People, organizations, products, projects mentioned (comma-separated)
TOPICS: 3-5 main topics or themes (comma-separated)
TYPE: document|email|meeting-notes|report|code|design|article|other

Document summary: ${summary.slice(0, 500)}

Output:`;

    const response = await session.prompt(prompt);
    
    // Parse la réponse
    const lines = response.split('\n');
    const keywords = parseLine(lines, 'KEYWORDS');
    const entities = parseLine(lines, 'ENTITIES');
    const topics = parseLine(lines, 'TOPICS');
    const type = parseLine(lines, 'TYPE', true);
    
    // Cleanup
    session.destroy();
    
    return {
      keywords: keywords || [],
      entities: entities || [],
      topics: topics || [],
      type: type || 'other'
    };
    
  } catch (error) {
    console.error('Erreur Prompt API:', error);
    return extractManualMetadata(content);
  }
}

/**
 * Parse une ligne de la réponse AI
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
 * Fallback : extraction manuelle métadonnées
 */
function extractManualMetadata(content) {
  const words = content.toLowerCase().split(/\s+/);
  const wordFreq = new Map();
  
  words.forEach(word => {
    if (word.length > 3) {
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
 * Compare sémantiquement deux résumés
 */
async function compareSemanticSimilarity(summary1, summary2) {
  try {
    if (!('LanguageModel' in self)) {
      return 0;
    }
    
    const availability = await LanguageModel.availability();
    if (availability === 'unavailable') return 0;
    
    const session = await LanguageModel.create({
      temperature: 0.1,
      topK: 1
    });
    
    const prompt = `Rate the semantic similarity between these two text summaries from 0.0 to 1.0.

Consider:
- Topic overlap
- Shared concepts and themes
- Related subject matter

Only respond with a single decimal number between 0.0 and 1.0 (e.g., 0.85).

Summary 1: ${summary1.slice(0, 300)}

Summary 2: ${summary2.slice(0, 300)}

Similarity score:`;

    const response = await session.prompt(prompt);
    session.destroy();
    
    const score = parseFloat(response.trim());
    return isNaN(score) ? 0 : Math.min(Math.max(score, 0), 1);
    
  } catch (error) {
    console.error('Erreur similarité sémantique:', error);
    return 0;
  }
}

/**
 * Génère une explication pour une suggestion
 */
async function generateSuggestionExplanation(currentTab, suggestedTab, commonEntities, commonTopics) {
  try {
    if (!('LanguageModel' in self)) {
      return generateManualExplanation(commonEntities, commonTopics);
    }
    
    const availability = await LanguageModel.availability();
    if (availability === 'unavailable') {
      return generateManualExplanation(commonEntities, commonTopics);
    }
    
    const session = await LanguageModel.create({
      temperature: 0.5,
      topK: 3
    });
    
    const entitiesStr = commonEntities.slice(0, 3).join(', ');
    const topicsStr = commonTopics.slice(0, 2).join(', ');
    
    const prompt = `Write a short explanation (max 10 words) for why these two browser tabs are related.

Current tab: ${currentTab.title}
Suggested tab: ${suggestedTab.title}
${entitiesStr ? `Common entities: ${entitiesStr}` : ''}
${topicsStr ? `Common topics: ${topicsStr}` : ''}

Format: "Both discuss [topic]" or "Contains [relevant info]"

Explanation:`;

    const response = await session.prompt(prompt);
    session.destroy();
    
    return response.trim().slice(0, 100);
    
  } catch (error) {
    console.error('Erreur génération explication:', error);
    return generateManualExplanation(commonEntities, commonTopics);
  }
}

/**
 * Génère explication manuelle
 */
function generateManualExplanation(commonEntities, commonTopics) {
  if (commonEntities.length > 0) {
    return `Both mention: ${commonEntities.slice(0, 2).join(', ')}`;
  }
  if (commonTopics.length > 0) {
    return `Related: ${commonTopics.slice(0, 2).join(', ')}`;
  }
  return 'Related content';
}

/**
 * Vérifie disponibilité des APIs AI
 */
async function checkAIAvailability() {
  const capabilities = {
    summarizer: false,
    languageModel: false
  };
  
  try {
    if ('Summarizer' in self) {
      const availability = await Summarizer.availability();
      capabilities.summarizer = availability !== 'unavailable';
    }
  } catch (e) {
    console.warn('Summarizer API non disponible');
  }
  
  try {
    if ('LanguageModel' in self) {
      const availability = await LanguageModel.availability();
      capabilities.languageModel = availability !== 'unavailable';
    }
  } catch (e) {
    console.warn('Language Model API non disponible');
  }
  
  return capabilities;
}

export {
  generateComprehensiveSummary,
  extractRichKeywords,
  compareSemanticSimilarity,
  generateSuggestionExplanation,
  checkAIAvailability
};