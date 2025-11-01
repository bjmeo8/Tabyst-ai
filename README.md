# Tabyst - Browser Companion for Contextual Intelligence

> **Cursor Tab, but for browser tabs. Find the right tab instantly.**

Tabyst is an intelligent browser tab management extension that leverages Chrome's Built-in AI APIs to provide context-aware tab recommendations and seamless navigation. Built for the **Google Chrome AI Challenge 2025**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://chrome.google.com/webstore)

---

## 🚀 Quick Start

### Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project directory
5. The Tabyst icon should appear in your toolbar

### Usage

- **Open Tabyst Modal**: Press `Ctrl+Shift+L` (Windows/Linux) or `Cmd+Shift+L` (Mac)
- **Quick Return**: Press `Ctrl+Shift+K` (Windows/Linux) or `Cmd+Shift+K` (Mac) to return to previous tab
- **Search**: Type to search tabs by title, URL, or content
- **Navigate**: Use arrow keys to navigate suggestions
- **Switch**: Press Enter to switch to selected tab

---

## 📁 Project Structure

```
Tabyst-final/
├── manifest.json                 # Extension configuration
├── README.md                     # This file
├── STRUCTURE.md                  # Detailed structure documentation
│
├── assets/                       # Static assets
│   └── tabyst.png               # Extension icon
│
├── docs/                         # Documentation
│   ├── PROJECT.md               # Comprehensive project documentation
│   ├── USER_GUIDE.md            # User guide and instructions
│   ├── enrich.md                # AI enrichment documentation
│   └── tasks.md                 # Development tasks and roadmap
│
└── src/                          # Source code
    ├── ai/                       # AI processing modules
    │   ├── ai-engine.js         # Chrome Built-in AI integration
    │   ├── cold-start.js        # Initial bulk indexing
    │   └── online-indexing.js   # Background indexing for new tabs
    │
    ├── analysis/                 # Analysis and pattern detection
    │   ├── relationships.js     # Tab relationship mapping
    │   └── workflows.js         # Workflow pattern detection
    │
    ├── background/               # Background service workers
    │   ├── background.js        # Main service worker
    │   └── background_v1.js     # Legacy version
    │
    ├── content/                  # Content scripts
    │   └── content.js           # Injected UI modal
    │
    ├── core/                     # Core utilities
    │   ├── db.js                # IndexedDB abstraction
    │   └── storage.js           # Chrome storage wrapper
    │
    ├── search/                   # Search and scoring
    │   ├── tfidf.js             # TF-IDF implementation
    │   ├── fuzzy-search.js      # Fuzzy search algorithm
    │   ├── hybrid-scoring.js    # AI + TF-IDF hybrid scoring
    │   └── lite-mode.js         # Fast TF-IDF-only mode
    │
    └── ui/                       # User interface
        ├── popup.html           # Extension popup
        ├── popup.js             # Popup logic
        └── taby.html            # Alternative UI (experimental)
```

---

## 🔑 Key Features

### 🧠 AI-Powered Intelligence
- **Smart Recommendations**: AI-ranked tab suggestions based on content and context
- **Semantic Search**: Find tabs by meaning, not just keywords
- **Content Summarization**: Automatic tab content summarization using Chrome's Summarizer API
- **Entity & Topic Extraction**: Identify people, organizations, and themes

### 🔒 Privacy-First Architecture
- **100% Local Processing**: All AI operations run on-device
- **No Data Transmission**: Your browsing data never leaves your machine
- **GDPR Compliant**: Complete data sovereignty and privacy by design

### ⚡ Performance Optimized
- **Progressive Enhancement**: Works instantly with TF-IDF, enhanced by AI
- **Smart Caching**: 30-second suggestion cache with context fingerprinting
- **Stable Sorting**: Deterministic ranking prevents UI flicker
- **Lazy Loading**: Index tabs progressively for instant usability

### 🔄 Workflow Detection
- **Pattern Recognition**: Automatically identify sequential tab patterns
- **Predictive Suggestions**: Suggest next tab based on your habits
- **Relationship Mapping**: Understand connections between related tabs

---

## 🛠️ Technology Stack

- **Runtime**: Chrome Extension Manifest V3
- **Language**: JavaScript (ES2022)
- **AI**: Chrome Built-in AI APIs
  - Summarizer API (text summarization)
  - Prompt API / LanguageModel (structured extraction)
- **Storage**: IndexedDB (local, persistent)
- **Search**: Custom TF-IDF + BM25 implementation
- **UI**: Shadow DOM for CSS isolation

---

## 📊 Performance Benchmarks

| Tabs Count | Lite Mode (TF-IDF) | Hybrid Mode (AI) | Storage Size |
|------------|-------------------|------------------|--------------|
| 10 tabs    | < 10ms            | 50-100ms         | ~500KB       |
| 50 tabs    | < 20ms            | 100-200ms        | ~2MB         |
| 100 tabs   | < 50ms            | 200-500ms        | ~5MB         |
| 500 tabs   | < 200ms           | 500ms-1s         | ~20MB        |

---

## 📚 Documentation

- **[PROJECT.md](docs/PROJECT.md)** - Comprehensive technical documentation
- **[USER_GUIDE.md](docs/USER_GUIDE.md)** - User guide and tutorials
- **[STRUCTURE.md](STRUCTURE.md)** - Detailed file and folder structure
- **[enrich.md](docs/enrich.md)** - AI enrichment pipeline documentation
- **[tasks.md](docs/tasks.md)** - Development roadmap and tasks

---

## 🏆 Chrome AI Challenge 2025

Tabyst demonstrates the power of Chrome's Built-in AI APIs for:

1. **On-Device AI for Privacy**: 100% local processing, zero data transmission
2. **Innovative AI Applications**: Hybrid architecture combining classical algorithms with AI
3. **User Productivity Enhancement**: Instant access, context preservation, cognitive load reduction

---

## 🚀 Development

### Prerequisites

- Google Chrome (Canary or Dev channel recommended for latest AI APIs)
- Chrome Built-in AI APIs enabled

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd Tabyst-final

# Load as unpacked extension in Chrome
# chrome://extensions/ -> Enable Developer Mode -> Load unpacked
```

### Key Components

- **Background Service Worker** (`src/background/background.js`): Orchestrates all operations
- **AI Engine** (`src/ai/ai-engine.js`): Chrome Built-in AI integration
- **Search Engine** (`src/search/`): TF-IDF and hybrid scoring
- **Database** (`src/core/db.js`): IndexedDB abstraction layer
- **UI Modal** (`src/content/content.js`): Injected search interface

---

## 🔄 Architecture

### Data Flow

```
User Opens Tab
      │
      ▼
┌─────────────────┐
│  Background.js  │ ← Main orchestrator
└────────┬────────┘
         │
         ├─────────────────────┐
         │                     │
         ▼                     ▼
┌─────────────────┐   ┌──────────────┐
│  Cold Start     │   │   Online     │
│  (Bulk Index)   │   │   Indexing   │
└────────┬────────┘   └──────┬───────┘
         │                    │
         ▼                    ▼
┌────────────────────────────────┐
│       AI Processing Layer      │
│  ┌──────────┐  ┌────────────┐ │
│  │Summarizer│  │Prompt API  │ │
│  └──────────┘  └────────────┘ │
└───────────────┬────────────────┘
                │
                ▼
┌───────────────────────────────┐
│      IndexedDB Storage        │
│  • Tabs index                 │
│  • Relationships              │
│  • Navigation history         │
│  • Workflow patterns          │
└───────────────────────────────┘
```

---

## 🎯 Future Enhancements

- 🎨 Visual relationship graph
- 📊 Analytics dashboard
- 🔄 Cross-device sync (privacy-preserving)
- 🧠 Advanced AI features
- ⚙️ Customization options

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- Google Chrome Team for Built-in AI APIs
- Chrome AI Challenge 2025 organizers
- Open source community

---

## 📧 Contact

For questions, feedback, or collaboration:
- **Project**: Tabyst
- **Challenge**: Google Chrome AI 2025
- **Focus**: Privacy-First Intelligent Tab Management

---

**Built with ❤️ for the Google Chrome AI Challenge 2025**

*Demonstrating the power of on-device AI for privacy-preserving productivity enhancement.*

