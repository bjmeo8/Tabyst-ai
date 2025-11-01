/**
 * fuzzy-search.js
 * Recherche floue avec scoring pour suggestions instantanées
 */

class FuzzySearch {
    constructor() {
      this.index = [];
    }
  
    /**
     * Indexe les tabs pour recherche rapide
     */
    indexTabs(tabs) {
      this.index = tabs.map(tab => ({
        id: tab.id,
        title: tab.title?.toLowerCase() || '',
        url: tab.url?.toLowerCase() || '',
        domain: this.extractDomain(tab.url),
        favicon: tab.favIconUrl,
        // Termes recherchables
        searchTerms: this.buildSearchTerms(tab)
      }));
    }
  
    extractDomain(url) {
      try {
        return new URL(url).hostname.replace('www.', '');
      } catch {
        return '';
      }
    }
  
    buildSearchTerms(tab) {
      const title = tab.title || '';
      const url = tab.url || '';
      const domain = this.extractDomain(url);
      
      return `${title} ${domain} ${url}`.toLowerCase();
    }
  
    /**
     * Distance de Levenshtein (similarité entre strings)
     */
    levenshteinDistance(a, b) {
      const matrix = [];
      
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              matrix[i][j - 1] + 1,     // insertion
              matrix[i - 1][j] + 1      // deletion
            );
          }
        }
      }
      
      return matrix[b.length][a.length];
    }
  
    /**
     * Similarité entre deux strings (0-1)
     */
    stringSimilarity(str1, str2) {
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;
      
      if (longer.length === 0) return 1.0;
      
      const distance = this.levenshteinDistance(shorter, longer);
      return (longer.length - distance) / longer.length;
    }
  
    /**
     * Score un tab par rapport à une query
     */
    scoreTab(tab, query) {
      const q = query.toLowerCase().trim();
      
      if (!q) return 0;
      
      let score = 0;
      
      // 1. Correspondance exacte (poids élevé)
      if (tab.title.includes(q)) {
        score += 1.0;
      }
      if (tab.domain.includes(q)) {
        score += 0.8;
      }
      if (tab.url.includes(q)) {
        score += 0.5;
      }
      
      // 2. Correspondance au début (préfixe)
      if (tab.title.startsWith(q)) {
        score += 0.6;
      }
      if (tab.domain.startsWith(q)) {
        score += 0.5;
      }
      
      // 3. Correspondance des mots
      const queryWords = q.split(/\s+/);
      const titleWords = tab.title.split(/\s+/);
      
      queryWords.forEach(qWord => {
        titleWords.forEach(tWord => {
          if (tWord.includes(qWord)) {
            score += 0.3;
          }
        });
      });
      
      // 4. Similarité floue (Levenshtein)
      const titleSimilarity = this.stringSimilarity(q, tab.title);
      if (titleSimilarity > 0.6) {
        score += titleSimilarity * 0.4;
      }
      
      const domainSimilarity = this.stringSimilarity(q, tab.domain);
      if (domainSimilarity > 0.6) {
        score += domainSimilarity * 0.3;
      }
      
      // 5. Acronyme matching (ex: "gd" → "Google Docs")
      if (this.matchesAcronym(q, tab.title)) {
        score += 0.5;
      }
      
      return score;
    }
  
    /**
     * Détecte si query correspond à l'acronyme du titre
     */
    matchesAcronym(query, title) {
      const words = title.split(/\s+/);
      if (words.length < 2) return false;
      
      const acronym = words.map(w => w[0]).join('').toLowerCase();
      return acronym.startsWith(query.toLowerCase());
    }
  
    /**
     * Recherche avec suggestions en temps réel
     */
    search(query, limit = 5) {
      if (!query || query.trim().length === 0) {
        return this.index.slice(0, limit);
      }
      
      const scored = this.index
        .map(tab => ({
          ...tab,
          score: this.scoreTab(tab, query)
        }))
        .filter(tab => tab.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      return scored;
    }
  
    /**
     * Highlight les parties correspondantes dans le texte
     */
    highlightMatches(text, query) {
      if (!query || query.trim().length === 0) return text;
      
      const q = query.toLowerCase();
      const words = q.split(/\s+/);
      
      let highlighted = text;
      
      // Highlight chaque mot de la query
      words.forEach(word => {
        const regex = new RegExp(`(${this.escapeRegex(word)})`, 'gi');
        highlighted = highlighted.replace(regex, '<mark>$1</mark>');
      });
      
      return highlighted;
    }
  
    escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  
    /**
     * Suggère des corrections orthographiques
     */
    suggestCorrection(query) {
      const words = query.toLowerCase().split(/\s+/);
      const allTitles = this.index.map(t => t.title);
      
      const suggestions = [];
      
      words.forEach(word => {
        let bestMatch = null;
        let bestSimilarity = 0;
        
        allTitles.forEach(title => {
          const titleWords = title.split(/\s+/);
          
          titleWords.forEach(tWord => {
            if (tWord.length < 3) return;
            
            const similarity = this.stringSimilarity(word, tWord);
            
            // Si très similaire mais pas identique → probablement une typo
            if (similarity > 0.7 && similarity < 1.0 && similarity > bestSimilarity) {
              bestSimilarity = similarity;
              bestMatch = tWord;
            }
          });
        });
        
        if (bestMatch) {
          suggestions.push({ original: word, suggestion: bestMatch, similarity: bestSimilarity });
        }
      });
      
      return suggestions;
    }
  }
  
  export { FuzzySearch };