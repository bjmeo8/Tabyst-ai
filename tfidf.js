/**
 * tfidf.js
 * Moteur TF-IDF robuste avec stop words statistiques
 */

class TFIDF {
    constructor() {
      this.documents = [];
      this.documentFreq = new Map();
      this.termFreqs = [];
      this.globalTermFreq = new Map(); // Fréquence globale pour détecter stop words
      this.totalTermCount = 0;
    }
  
    /**
     * Tokenization avec normalisation Unicode
     */
    tokenize(text) {
      // Normalisation Unicode (enlève accents)
      const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      return normalized
        .toLowerCase()
        .replace(/[^\w\s'-]/g, ' ')
        .split(/\s+/)
        .map(word => word.replace(/^[-']+|[-']+$/g, ''))
        .filter(word => {
          // Filtre basique : longueur + pas que chiffres
          return word.length > 2 && !/^\d+$/.test(word);
        });
    }
  
    /**
     * Détecte dynamiquement les stop words via fréquence
     * Mots trop fréquents (>40% des docs) = probablement stop words
     */
    isStopWord(term) {
      const numDocs = this.documents.length;
      if (numDocs < 3) return false; // Pas assez de docs pour décider
      
      const df = this.documentFreq.get(term) || 0;
      const docFrequency = df / numDocs;
      
      // Stop word si présent dans >40% des documents
      return docFrequency > 0.4;
    }
  
    /**
     * Filtre les termes selon critères statistiques
     */
    filterTerms(terms) {
      const numDocs = this.documents.length;
      
      return terms.filter(term => {
        // Trop court ou trop long
        if (term.length < 3 || term.length > 30) return false;
        
        // Stop word statistique
        if (this.isStopWord(term)) return false;
        
        // Termes trop rares (présent dans 1 seul doc et corpus >10 docs)
        if (numDocs > 10) {
          const df = this.documentFreq.get(term) || 0;
          if (df === 1) return false;
        }
        
        return true;
      });
    }
  
    /**
     * Extraction de n-grams
     */
    extractNGrams(tokens, n = 2) {
      const ngrams = [];
      for (let i = 0; i <= tokens.length - n; i++) {
        ngrams.push(tokens.slice(i, i + n).join('_'));
      }
      return ngrams;
    }
  
    /**
     * Ajoute un document avec enrichissement
     */
    addDocument(text, id, metadata = {}) {
      const tokens = this.tokenize(text);
      
      // Met à jour fréquences globales (pour stop words)
      tokens.forEach(term => {
        this.globalTermFreq.set(term, (this.globalTermFreq.get(term) || 0) + 1);
        this.totalTermCount++;
      });
      
      // Filtre avec statistiques (après mise à jour globale)
      const filteredTokens = this.filterTerms(tokens);
      
      // Ajoute bi-grams et tri-grams sur tokens filtrés
      const bigrams = this.extractNGrams(filteredTokens, 2);
      const trigrams = this.extractNGrams(filteredTokens, 3);
      
      const allTerms = [...filteredTokens, ...bigrams, ...trigrams];
      const termFreq = new Map();
      
      // Calcule fréquences des termes
      allTerms.forEach(term => {
        termFreq.set(term, (termFreq.get(term) || 0) + 1);
      });
      
      // Met à jour document frequency
      const uniqueTerms = new Set(allTerms);
      uniqueTerms.forEach(term => {
        if (!this.documentFreq.has(term)) {
          this.documentFreq.set(term, 0);
        }
        this.documentFreq.set(term, this.documentFreq.get(term) + 1);
      });
      
      this.termFreqs.push({ 
        id, 
        termFreq, 
        terms: allTerms, 
        uniqueTerms: uniqueTerms.size,
        totalTerms: allTerms.length,
        metadata
      });
      
      this.documents.push({ id, text, metadata });
    }
  
    removeDocument(id) {
      const index = this.documents.findIndex(d => d.id === id);
      if (index === -1) return;
      
      const doc = this.termFreqs[index];
      const uniqueTerms = new Set(doc.terms);
      
      uniqueTerms.forEach(term => {
        const freq = this.documentFreq.get(term);
        if (freq <= 1) {
          this.documentFreq.delete(term);
        } else {
          this.documentFreq.set(term, freq - 1);
        }
      });
      
      this.documents.splice(index, 1);
      this.termFreqs.splice(index, 1);
    }
  
    /**
     * BM25 (meilleur que TF-IDF classique)
     */
    bm25(queryText, documentId, k1 = 1.5, b = 0.75) {
      const queryTerms = this.tokenize(queryText);
      const filteredQuery = this.filterTerms(queryTerms);
      const doc = this.termFreqs.find(d => d.id === documentId);
      
      if (!doc) return 0;
      
      const numDocs = this.documents.length;
      if (numDocs === 0) return 0;
      
      const avgDocLength = this.termFreqs.reduce((sum, d) => sum + d.totalTerms, 0) / numDocs;
      
      let score = 0;
      
      filteredQuery.forEach(term => {
        const termFreqInDoc = doc.termFreq.get(term) || 0;
        if (termFreqInDoc === 0) return;
        
        const df = this.documentFreq.get(term) || 1;
        const idf = Math.log((numDocs - df + 0.5) / (df + 0.5) + 1);
        
        const numerator = termFreqInDoc * (k1 + 1);
        const denominator = termFreqInDoc + k1 * (1 - b + b * (doc.totalTerms / avgDocLength));
        
        score += idf * (numerator / denominator);
      });
      
      return score;
    }
  
    tfidf(queryText, documentId) {
      return this.bm25(queryText, documentId);
    }
  
    /**
     * Similarité cosinus avec pondération IDF
     */
    cosineSimilarity(doc1Id, doc2Id) {
      const doc1 = this.termFreqs.find(d => d.id === doc1Id);
      const doc2 = this.termFreqs.find(d => d.id === doc2Id);
      
      if (!doc1 || !doc2) return 0;
      
      const allTerms = new Set([
        ...Array.from(doc1.termFreq.keys()),
        ...Array.from(doc2.termFreq.keys())
      ]);
      
      const numDocs = this.documents.length;
      
      let dotProduct = 0;
      let mag1 = 0;
      let mag2 = 0;
      
      allTerms.forEach(term => {
        const freq1 = doc1.termFreq.get(term) || 0;
        const freq2 = doc2.termFreq.get(term) || 0;
        
        const tf1 = freq1 / doc1.totalTerms;
        const tf2 = freq2 / doc2.totalTerms;
        
        const df = this.documentFreq.get(term) || 1;
        const idf = Math.log(numDocs / df);
        
        const tfidf1 = tf1 * idf;
        const tfidf2 = tf2 * idf;
        
        dotProduct += tfidf1 * tfidf2;
        mag1 += tfidf1 * tfidf1;
        mag2 += tfidf2 * tfidf2;
      });
      
      if (mag1 === 0 || mag2 === 0) return 0;
      
      return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
    }
  
    /**
     * Trouve les termes les plus importants d'un document
     */
    getTopTerms(documentId, n = 10) {
      const doc = this.termFreqs.find(d => d.id === documentId);
      if (!doc) return [];
      
      const numDocs = this.documents.length;
      const termScores = [];
      
      doc.termFreq.forEach((freq, term) => {
        const tf = freq / doc.totalTerms;
        const df = this.documentFreq.get(term) || 1;
        const idf = Math.log(numDocs / df);
        const tfidf = tf * idf;
        
        if (term.length > 2 && term.length < 30 && !term.includes('_')) {
          termScores.push({ term, score: tfidf });
        }
      });
      
      return termScores
        .sort((a, b) => b.score - a.score)
        .slice(0, n)
        .map(t => t.term);
    }
  
    /**
     * Sérialisation
     */
    serialize() {
      return JSON.stringify({
        documents: this.documents,
        documentFreq: Array.from(this.documentFreq),
        globalTermFreq: Array.from(this.globalTermFreq),
        totalTermCount: this.totalTermCount,
        termFreqs: this.termFreqs.map(tf => ({
          id: tf.id,
          termFreq: Array.from(tf.termFreq),
          terms: tf.terms,
          uniqueTerms: tf.uniqueTerms,
          totalTerms: tf.totalTerms,
          metadata: tf.metadata
        }))
      });
    }
  
    static deserialize(data) {
      const parsed = JSON.parse(data);
      const tfidf = new TFIDF();
      
      tfidf.documents = parsed.documents;
      tfidf.documentFreq = new Map(parsed.documentFreq);
      tfidf.globalTermFreq = new Map(parsed.globalTermFreq || []);
      tfidf.totalTermCount = parsed.totalTermCount || 0;
      tfidf.termFreqs = parsed.termFreqs.map(tf => ({
        id: tf.id,
        termFreq: new Map(tf.termFreq),
        terms: tf.terms,
        uniqueTerms: tf.uniqueTerms,
        totalTerms: tf.totalTerms,
        metadata: tf.metadata || {}
      }));
      
      return tfidf;
    }
  }
  
  export { TFIDF };