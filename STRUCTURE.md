# Tabyst - Project Structure Documentation

This document provides a comprehensive overview of the Tabyst project structure, explaining the purpose and functionality of each file and folder.

---

## 📂 Directory Structure Overview

```
Tabyst-final/
├── manifest.json
├── README.md
├── STRUCTURE.md
├── assets/
├── docs/
└── src/
    ├── ai/
    ├── analysis/
    ├── background/
    ├── content/
    ├── core/
    ├── search/
    └── ui/
```

---

## 📄 Root Files

### `manifest.json`
**Type**: Configuration
**Purpose**: Chrome extension manifest file (Manifest V3)

**Key configurations**:
- Extension metadata (name, version, description)
- Permissions (tabs, scripting, storage, notifications)
- Background service worker registration
- Keyboard shortcuts (commands)
- Extension icon

**Important paths** (relative to root):
- Background script: `src/background/background.js`
- Popup UI: `src/ui/popup.html`
- Icon: `assets/tabyst.png`

---

### `README.md`
**Type**: Documentation
**Purpose**: Main project documentation and quick start guide

**Contents**:
- Project overview and description
- Quick start instructions
- Key features
- Technology stack
- Performance benchmarks
- Links to other documentation

---

### `STRUCTURE.md`
**Type**: Documentation
**Purpose**: This file - detailed structure and file documentation

---

## 📁 Directory: `assets/`

Static assets used by the extension.

### `assets/tabyst.png`
**Type**: Image (PNG)
**Size**: 128x128px
**Purpose**: Extension icon displayed in Chrome toolbar and extensions page

**Used in**:
- `manifest.json` - Extension icon configuration

---

## 📁 Directory: `docs/`

Documentation files for the project.

### `docs/PROJECT.md`
**Type**: Documentation
**Purpose**: Comprehensive technical documentation

**Contents**:
- Project overview and problem statement
- Chrome AI Challenge 2025 alignment
- Privacy & security architecture
- Technical architecture diagrams
- AI processing pipeline
- Data models and schemas
- Workflow detection system
- Performance optimizations
- Technology stack details

**Target audience**: Developers, technical reviewers, challenge judges

---

### `docs/USER_GUIDE.md`
**Type**: Documentation
**Purpose**: End-user guide and tutorials

**Contents**:
- Installation instructions
- Feature explanations
- Usage tutorials
- Keyboard shortcuts
- Troubleshooting
- FAQ

**Target audience**: End users

---

### `docs/enrich.md`
**Type**: Documentation
**Purpose**: AI enrichment pipeline documentation

**Contents**:
- AI processing workflow
- Summarization techniques
- Keyword and entity extraction
- Topic modeling
- Enrichment strategies

**Target audience**: Developers working on AI features

---

### `docs/tasks.md`
**Type**: Documentation
**Purpose**: Development roadmap and task tracking

**Contents**:
- Completed features
- In-progress tasks
- Planned enhancements
- Bug fixes
- Technical debt

**Target audience**: Development team

---

## 📁 Directory: `src/`

Main source code directory containing all JavaScript modules.

---

## 📁 Directory: `src/ai/`

AI processing modules using Chrome Built-in AI APIs.

### `src/ai/ai-engine.js`
**Type**: Module (ES6)
**Purpose**: Core AI integration with Chrome Built-in AI APIs

**Exports**:
- `generateComprehensiveSummary(content)` - Generate 200-word summary using Summarizer API
- `extractRichKeywords(content, summary)` - Extract 8-10 keywords using Prompt API
- `extractEntitiesAndTopics(content, summary)` - Extract entities and topics
- `checkAIAvailability()` - Check if AI APIs are available

**Dependencies**:
- `../core/storage.js` - Settings and state management
- `../core/db.js` - Database operations
- `../search/tfidf.js` - TF-IDF processing

**Chrome APIs used**:
- `self.ai.summarizer.create()` - Summarizer API
- `self.ai.languageModel.create()` - Prompt API

**Key features**:
- Session creation and management
- Content summarization (200 words)
- Structured metadata extraction
- Error handling and fallbacks

---

### `src/ai/cold-start.js`
**Type**: Module (ES6)
**Purpose**: Initial bulk indexing when extension is installed or after reset

**Exports**:
- `startColdStart()` - Begin cold start indexing process
- `pauseColdStart()` - Pause ongoing indexing
- `resumeColdStart()` - Resume paused indexing
- `getColdStartProgress()` - Get indexing progress

**Dependencies**:
- `../core/db.js` - Database operations
- `../core/storage.js` - Settings and progress tracking
- `../search/tfidf.js` - TF-IDF index building
- `./ai-engine.js` - AI processing
- `../search/lite-mode.js` - Fast content extraction
- `../analysis/relationships.js` - Relationship creation

**Process flow**:
1. Create lightweight entries for all tabs (instant TF-IDF)
2. Progressive AI indexing (1-10 min/tab depending on hardware)
3. Build relationship graph
4. Complete indexing

**Features**:
- Progressive indexing (users can use extension immediately)
- No timeouts on AI operations (quality over speed)
- Progress tracking and notifications
- Pause/resume capability

---

### `src/ai/online-indexing.js`
**Type**: Module (ES6)
**Purpose**: Background indexing for new tabs after cold start

**Exports**:
- `queueTabForIndexing(tabId)` - Add tab to indexing queue
- `initOnlineSessions()` - Initialize AI sessions
- `areOnlineSessionsReady()` - Check if sessions are ready
- `cleanupOnlineSessions()` - Cleanup AI sessions

**Dependencies**:
- `../core/db.js` - Database operations
- `../core/storage.js` - Settings
- `../search/tfidf.js` - TF-IDF updates
- `../search/lite-mode.js` - Content extraction
- `../analysis/relationships.js` - Relationship updates

**Features**:
- Dedicated AI sessions for online indexing
- Debounced queue processing (2-second delay after page load)
- Automatic relationship enrichment
- TF-IDF index updates

---

## 📁 Directory: `src/analysis/`

Pattern detection and relationship analysis modules.

### `src/analysis/relationships.js`
**Type**: Module (ES6)
**Purpose**: Manage and analyze relationships between tabs

**Exports**:
- `createBasicRelationships(tab1Id, tab2Id, reason)` - Create basic relationship
- `enrichRelationshipsWithAI(tab1, tab2, session)` - AI-powered relationship analysis
- `getRelatedTabs(tabId, limit)` - Get related tabs for a given tab
- `initializeRelationships()` - Build initial relationship graph
- `applyRelationshipDecay()` - Apply time-based decay to relationships

**Dependencies**:
- `../core/db.js` - Database operations
- `../core/storage.js` - Settings

**Relationship types**:
- **Similar**: Same topic, different aspects (e.g., two React tutorials)
- **Complementary**: Work together (e.g., docs + code)
- **Sequential**: Natural progression (e.g., tutorial → advanced)
- **Unrelated**: No meaningful connection

**Strength calculation**:
```
strength = 0.3 (base) + 0.3 (Jaccard similarity) + 0.4 (AI semantic score)
```

**Features**:
- Time-based decay (relationships weaken over time)
- Bidirectional relationship storage
- AI-powered semantic analysis

---

### `src/analysis/workflows.js`
**Type**: Module (ES6)
**Purpose**: Automatic workflow pattern detection and prediction

**Exports**:
- `updateWorkflows(fromTabId, toTabId)` - Record navigation for workflow detection
- `getWorkflowSuggestions(currentTabId, limit)` - Get workflow-based suggestions
- `getWorkflowStats()` - Get workflow statistics
- `extractSequences(minLength, maxLength)` - Extract navigation sequences

**Dependencies**:
- `../core/db.js` - Database operations (navigation history)
- `../core/storage.js` - Settings

**Process**:
1. **Record Navigation**: Track tab-to-tab navigation
2. **Extract Sequences**: Identify patterns of 2-5 tabs
3. **Frequency Analysis**: Count how often patterns repeat
4. **Prediction**: Suggest next tab based on patterns

**Features**:
- Temporal contiguity detection (sequences within time windows)
- Confidence scoring based on frequency
- +0.3 score bonus for workflow matches
- Pattern cleanup (remove old patterns)

---

## 📁 Directory: `src/background/`

Background service workers that orchestrate the extension.

### `src/background/background.js`
**Type**: Service Worker (ES6 Module)
**Purpose**: Main orchestrator for all extension operations

**Dependencies**:
- `../core/db.js` - Database operations
- `../core/storage.js` - Settings
- `../search/tfidf.js` - TF-IDF engine
- `../search/lite-mode.js` - Fast suggestions
- `../search/hybrid-scoring.js` - AI-powered suggestions
- `../search/fuzzy-search.js` - Fuzzy search
- `../ai/cold-start.js` - Initial indexing
- `../ai/online-indexing.js` - Background indexing
- `../analysis/relationships.js` - Relationship management
- `../analysis/workflows.js` - Workflow detection

**Key responsibilities**:
1. **Initialization**: Set up database, storage, and indexes
2. **Tab Management**: Monitor tab events (created, updated, removed, activated)
3. **Navigation Tracking**: Record tab-to-tab navigation for workflows
4. **Search**: Handle search requests from content script
5. **Indexing**: Coordinate cold start and online indexing
6. **Caching**: Maintain 30-second suggestion cache
7. **Cleanup**: Periodic relationship decay and index updates

**Message handlers**:
- `GET_SUGGESTIONS` - Get tab suggestions
- `SWITCH_TO_TAB` - Switch to a specific tab
- `GET_COLD_START_STATUS` - Check indexing progress
- `START_COLD_START` - Trigger cold start
- `PAUSE_COLD_START` - Pause indexing
- `GET_DB_STATS` - Database statistics
- `GET_WORKFLOW_STATS` - Workflow statistics
- `SEARCH_TABS` - Search tabs by query

**Events**:
- `chrome.tabs.onCreated` - New tab created
- `chrome.tabs.onUpdated` - Tab updated
- `chrome.tabs.onRemoved` - Tab removed
- `chrome.tabs.onActivated` - Tab switched
- `chrome.commands.onCommand` - Keyboard shortcuts

**Features**:
- Smart caching with context fingerprinting
- Stable sorting (deterministic ranking)
- Navigation stack for quick return
- Progressive enhancement (TF-IDF → AI)

---

### `src/background/background_v1.js`
**Type**: Service Worker
**Purpose**: Legacy version (kept for reference)

**Status**: Not actively used
**Note**: Original version before current architecture

---

## 📁 Directory: `src/content/`

Content scripts injected into web pages.

### `src/content/content.js`
**Type**: Content Script (ES6)
**Purpose**: Injected UI modal for tab search and selection

**Features**:
- **Shadow DOM**: Isolated styles (no CSS conflicts)
- **Keyboard navigation**: Arrow keys, Enter, Escape
- **Fuzzy search**: Real-time search as you type
- **Visual feedback**: Selected tab highlighting
- **Favicon display**: Show tab favicons
- **Reason display**: Show why each tab is suggested

**UI components**:
1. **Search input**: Filter tabs by title/URL
2. **Suggestions list**: AI-ranked tab suggestions
3. **Loading indicator**: Cold start progress
4. **Tab items**: Title, favicon, URL, match reason

**Keyboard shortcuts**:
- `Ctrl+Shift+L` / `Cmd+Shift+L` - Open modal
- `Arrow Up/Down` - Navigate suggestions
- `Enter` - Switch to selected tab
- `Escape` - Close modal

**Communication**:
- Sends messages to background script for suggestions
- Receives tab data and displays in modal

---

## 📁 Directory: `src/core/`

Core utilities and abstractions.

### `src/core/db.js`
**Type**: Module (ES6)
**Purpose**: IndexedDB abstraction layer

**Database**: `tabystDB`
**Version**: 4

**Object stores**:

1. **`tabs`** (keyPath: `id`)
   - Stores tab metadata and AI-processed content
   - Indexes: `tabId`, `url`, `urlHash`, `domain`, `lastAccessedAt`

2. **`relationships`** (keyPath: `id`)
   - Stores relationships between tabs
   - Indexes: `tab1Id`, `tab2Id`, `strength`

3. **`navigationHistory`** (keyPath: `id`)
   - Stores tab-to-tab navigation events
   - Index: `timestamp`

4. **`workflows`** (keyPath: `id`)
   - Stores detected workflow patterns
   - Index: `frequency`

**Exported functions**:

**Tab operations**:
- `saveTab(tab)` - Save or update tab
- `getTabByTabId(tabId)` - Get tab by Chrome tab ID
- `getTabById(id)` - Get tab by database ID
- `getAllTabs()` - Get all tabs
- `deleteTab(tabId)` - Delete tab
- `updateTabAccess(tabId)` - Update last access time
- `getTabsByDomain(domain)` - Get tabs from same domain

**Relationship operations**:
- `saveRelationship(rel)` - Save relationship
- `getRelationshipsForTab(tabId)` - Get all relationships for a tab
- `deleteRelationshipsForTab(tabId)` - Delete all relationships
- `getAllRelationships()` - Get all relationships

**Navigation operations**:
- `saveNavigation(nav)` - Save navigation event
- `getRecentNavigations(since)` - Get recent navigation history
- `clearOldNavigations(before)` - Cleanup old navigation

**Workflow operations**:
- `saveWorkflow(workflow)` - Save workflow pattern
- `getWorkflow(id)` - Get workflow by ID
- `getAllWorkflows()` - Get all workflows
- `deleteWorkflow(id)` - Delete workflow

**Statistics**:
- `getTabCount()` - Count indexed tabs
- `getRelationshipCount()` - Count relationships
- `clearAllData()` - Clear all data (factory reset)

---

### `src/core/storage.js`
**Type**: Module (ES6)
**Purpose**: Chrome storage wrapper with defaults

**Storage type**: `chrome.storage.local` (unlimited storage permission)

**Settings**:

```javascript
{
  // Indexing
  coldStartDone: false,        // Cold start completion flag
  indexingInProgress: false,   // Currently indexing
  lastIndexedAt: 0,            // Last indexing timestamp

  // AI
  aiAvailable: false,          // AI APIs available
  useLiteMode: false,          // Force TF-IDF only mode

  // Workflow
  workflowsEnabled: true,      // Enable workflow detection

  // Cache
  suggestionCache: null,       // Cached suggestions
  cacheTimestamp: 0,           // Cache creation time
  cacheContextFingerprint: 0,  // Cache validation (tab count)

  // Progress (cold start)
  coldStartProgress: {
    current: 0,
    total: 0,
    phase: 'idle'
  }
}
```

**Exported functions**:
- `get(key, defaultValue)` - Get setting
- `set(key, value)` - Set setting
- `getAll()` - Get all settings
- `setMultiple(obj)` - Set multiple settings
- `clear()` - Clear all settings

---

## 📁 Directory: `src/search/`

Search and scoring algorithms.

### `src/search/tfidf.js`
**Type**: Module (ES6)
**Purpose**: TF-IDF (Term Frequency-Inverse Document Frequency) implementation

**Class**: `TFIDF`

**Methods**:
- `addDocument(doc, text)` - Add document to index
- `removeDocument(doc)` - Remove document from index
- `search(query, limit)` - Search documents by query
- `tfidf(term, document)` - Calculate TF-IDF score for term
- `getDocuments()` - Get all indexed documents
- `getDocumentCount()` - Get document count

**Algorithm**:
```
TF(term, doc) = (count of term in doc) / (total terms in doc)
IDF(term) = log((total docs) / (docs containing term))
TF-IDF(term, doc) = TF(term, doc) * IDF(term)
```

**Features**:
- Case-insensitive search
- Tokenization and stemming
- Stop word removal
- BM25-style term frequency normalization

**Use cases**:
- Fast text search without AI
- Instant suggestions during cold start
- Fallback when AI is unavailable

---

### `src/search/fuzzy-search.js`
**Type**: Module (ES6)
**Purpose**: Fuzzy string matching for tab search

**Class**: `FuzzySearch`

**Methods**:
- `search(query, items, keys)` - Search items with fuzzy matching
- `match(pattern, str)` - Match pattern against string
- `score(pattern, str)` - Calculate match score

**Algorithm**:
- Character-by-character matching
- Bonus for consecutive matches
- Bonus for word boundary matches
- Case-insensitive

**Use cases**:
- Search tabs by partial title
- Search tabs by partial URL
- Handle typos in search queries

---

### `src/search/lite-mode.js`
**Type**: Module (ES6)
**Purpose**: Fast TF-IDF-only scoring (no AI)

**Exports**:
- `getLiteSuggestions(currentTabId, limit)` - Get TF-IDF suggestions
- `buildTFIDFIndex()` - Build/rebuild TF-IDF index
- `extractTabContent(tabId)` - Extract content from tab
- `isAccessibleUrl(url)` - Check if URL is accessible

**Dependencies**:
- `../core/storage.js` - Settings
- `../core/db.js` - Database operations
- `./tfidf.js` - TF-IDF engine

**Scoring components**:
1. **TF-IDF similarity** (60%)
2. **Domain match bonus** (20%)
3. **Recency score** (10%)
4. **Access frequency** (10%)

**Features**:
- Instant results (< 50ms for 100 tabs)
- No AI required
- Content extraction via Chrome scripting API
- DOM text extraction with cleanup

**Use cases**:
- During cold start (before AI indexing)
- When AI is unavailable
- Force lite mode (user preference)

---

### `src/search/hybrid-scoring.js`
**Type**: Module (ES6)
**Purpose**: Hybrid scoring combining TF-IDF and AI

**Exports**:
- `getHybridSuggestions(currentTabId, limit)` - Get AI-enhanced suggestions
- `calculateHybridScore(currentTab, candidateTab, tfidf)` - Calculate score

**Dependencies**:
- `../core/storage.js` - Settings
- `../core/db.js` - Database operations
- `./tfidf.js` - TF-IDF engine
- `../analysis/relationships.js` - Relationship strength

**Scoring formula** (100% total):

```javascript
{
  tfidfSimilarity: 18%,      // Classical text similarity
  cosineSimilarity: 12%,     // Document vector similarity
  entityOverlap: 28%,        // AI: shared entities (people, orgs)
  topicOverlap: 22%,         // AI: shared topics
  relationshipStrength: 10%, // AI: semantic relationship
  behavioralScore: 10%       // Access frequency + recency
}
```

**Features**:
- Jaccard similarity for entity/topic overlap
- Time-based recency decay
- Relationship strength integration
- Stable sorting with secondary sort key

**Requirements**:
- Tabs must be AI-indexed (`flags.isIndexed = true`)
- Falls back to lite mode if not indexed

---

## 📁 Directory: `src/ui/`

User interface files.

### `src/ui/popup.html`
**Type**: HTML
**Purpose**: Extension popup UI (click on toolbar icon)

**Features**:
- **Cold start status**: Shows indexing progress
- **Statistics**: Tab count, relationship count
- **Controls**: Start/pause cold start, force reindex
- **Settings**: Toggle workflows, lite mode
- **Workflow stats**: View detected patterns

**Styles**: Inline CSS (modern, clean design)

**Dependencies**:
- `popup.js` - Popup logic

---

### `src/ui/popup.js`
**Type**: JavaScript
**Purpose**: Popup UI logic and interaction

**Functionality**:
- Load and display statistics
- Start/pause cold start
- Toggle settings
- Display workflow patterns
- Real-time progress updates

**Communication**:
- Sends messages to background script for operations
- Updates UI based on responses

---

### `src/ui/taby.html`
**Type**: HTML
**Purpose**: Alternative experimental UI

**Status**: Experimental
**Note**: Not currently integrated into main extension

---

## 🔄 Data Flow

### 1. Extension Installation / First Use

```
User installs extension
         │
         ▼
┌────────────────────┐
│  background.js     │
│  chrome.runtime.   │
│  onInstalled       │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Initialize DB     │
│  (db.js)           │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  cold-start.js     │
│  startColdStart()  │
└─────────┬──────────┘
          │
          ├──────────────────────────┐
          │                          │
          ▼                          ▼
┌──────────────────┐      ┌─────────────────┐
│  Create lite     │      │  Progressive    │
│  entries         │      │  AI indexing    │
│  (TF-IDF only)   │      │  (1-10 min/tab) │
└──────────────────┘      └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  ai-engine.js   │
                          │  • Summarize    │
                          │  • Extract data │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Update DB      │
                          │  (db.js)        │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Build          │
                          │  relationships  │
                          └─────────────────┘
```

### 2. User Opens Tabyst Modal (Ctrl+Shift+L)

```
User presses Ctrl+Shift+L
         │
         ▼
┌────────────────────┐
│  background.js     │
│  Command handler   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Inject            │
│  content.js        │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Show modal        │
│  (Shadow DOM)      │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Request           │
│  suggestions       │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  background.js     │
│  GET_SUGGESTIONS   │
└─────────┬──────────┘
          │
          ├──────────────────┬──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
    ┌─────────┐      ┌──────────┐      ┌──────────┐
    │  Cache? │      │ Lite     │      │ Hybrid   │
    └─────────┘      │ mode     │      │ mode     │
                     └──────────┘      └──────────┘
                           │                  │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │  Return         │
                           │  suggestions    │
                           └────────┬────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │  Display in     │
                           │  modal          │
                           └─────────────────┘
```

### 3. New Tab Opened

```
User opens new tab
         │
         ▼
┌────────────────────┐
│  background.js     │
│  tabs.onCreated    │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Create lite entry │
│  (lite-mode.js)    │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Queue for AI      │
│  (online-indexing) │
└─────────┬──────────┘
          │
          ▼ (2s delay)
┌────────────────────┐
│  Extract content   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  AI processing     │
│  (ai-engine.js)    │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Update DB & index │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Create/update     │
│  relationships     │
└────────────────────┘
```

---

## 🔍 Module Dependencies Graph

```
background.js (orchestrator)
    ├── core/
    │   ├── db.js
    │   └── storage.js
    │
    ├── search/
    │   ├── tfidf.js
    │   ├── fuzzy-search.js
    │   ├── lite-mode.js ──────┐
    │   │   ├── tfidf.js       │
    │   │   ├── db.js          │
    │   │   └── storage.js     │
    │   │                      │
    │   └── hybrid-scoring.js ─┤
    │       ├── tfidf.js       │
    │       ├── db.js          │
    │       ├── storage.js     │
    │       └── relationships.js
    │
    ├── ai/
    │   ├── ai-engine.js
    │   │   ├── tfidf.js
    │   │   ├── db.js
    │   │   └── storage.js
    │   │
    │   ├── cold-start.js ─────┤
    │   │   ├── ai-engine.js   │
    │   │   ├── lite-mode.js   │
    │   │   ├── relationships.js
    │   │   ├── tfidf.js       │
    │   │   ├── db.js          │
    │   │   └── storage.js     │
    │   │                      │
    │   └── online-indexing.js ┤
    │       ├── lite-mode.js   │
    │       ├── relationships.js
    │       ├── tfidf.js       │
    │       ├── db.js          │
    │       └── storage.js     │
    │
    └── analysis/
        ├── relationships.js
        │   ├── db.js
        │   └── storage.js
        │
        └── workflows.js
            ├── db.js
            └── storage.js

content.js (UI modal)
    └── (communicates with background.js via messages)

popup.js (popup UI)
    └── (communicates with background.js via messages)
```

---

## 🎯 Key Design Patterns

### 1. **Modular Architecture**
- Each module has a single responsibility
- Clear separation of concerns
- Minimal coupling between modules

### 2. **Progressive Enhancement**
- Works immediately with TF-IDF (lite mode)
- Enhanced by AI when available
- Graceful degradation if AI unavailable

### 3. **Lazy Loading**
- Index tabs progressively, not all at once
- Users can search while indexing continues
- No blocking operations

### 4. **Event-Driven**
- Background script listens to Chrome events
- Content script communicates via messages
- Asynchronous operations throughout

### 5. **Data Persistence**
- IndexedDB for structured data
- Chrome storage for settings
- No external servers (privacy-first)

---

## 🚦 Performance Considerations

### Caching Strategy
- **Suggestion cache**: 30-second TTL
- **Context fingerprinting**: Invalidate on tab count change
- **Stable sorting**: Prevent UI flicker

### Indexing Strategy
- **Cold start**: Lite entries first (instant TF-IDF), AI later
- **Online indexing**: 2-second debounce, background processing
- **No timeouts**: Quality over speed for AI operations

### Database Optimization
- **Indexes**: Fast lookups on `tabId`, `domain`, `timestamp`
- **Batch operations**: Use transactions for multiple operations
- **Cleanup**: Periodic removal of old navigation history

### Memory Management
- **Session reuse**: Keep AI sessions alive (avoid reinitialization)
- **Cleanup**: Destroy sessions when not needed
- **Garbage collection**: Remove closed tabs from database

---

## 📝 Development Guidelines

### Adding a New Feature

1. **Identify module**: Determine which module should handle the feature
2. **Update schema**: If needed, modify database schema in `db.js`
3. **Implement logic**: Write code in appropriate module
4. **Export functions**: Export public API
5. **Update background**: Integrate with background orchestrator
6. **Test**: Verify functionality and performance
7. **Document**: Update this file and README.md

### Modifying AI Processing

1. **Edit**: `src/ai/ai-engine.js`
2. **Test**: Verify with Chrome AI APIs
3. **Fallback**: Ensure graceful degradation
4. **Performance**: Monitor processing time

### Changing Scoring Algorithm

1. **Edit**: `src/search/hybrid-scoring.js` or `src/search/lite-mode.js`
2. **Weights**: Adjust scoring weights (must sum to 1.0)
3. **Test**: Compare results with previous algorithm
4. **Document**: Update formula in this file

---

## 🐛 Debugging

### Enable Chrome DevTools

**Background script**:
1. Go to `chrome://extensions/`
2. Find Tabyst
3. Click "Inspect views: service worker"

**Content script**:
1. Open DevTools on any page (F12)
2. Look for shadow DOM in Elements panel
3. Console logs will appear in page DevTools

**Popup**:
1. Right-click extension icon
2. Click "Inspect popup"

### Common Issues

**AI not working**:
- Check Chrome version (Canary/Dev recommended)
- Verify AI APIs are enabled
- Check `checkAIAvailability()` result

**Indexing stuck**:
- Check cold start progress in popup
- Verify tabs are accessible (not chrome://)
- Check for errors in background console

**Suggestions not updating**:
- Verify cache invalidation
- Check if tabs are indexed
- Verify TF-IDF index is built

---

## 📚 Additional Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Chrome Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [TF-IDF Algorithm](https://en.wikipedia.org/wiki/Tf%E2%80%93idf)

---

**Last Updated**: October 31, 2025
**Version**: 0.4.0
**Maintainer**: Tabyst Team
