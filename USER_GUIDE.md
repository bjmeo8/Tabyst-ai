# Tabyst User Guide

**Welcome to Tabyst!** 🎉

Your intelligent tab management assistant powered by Chrome's Built-in AI.

---

## 📖 Table of Contents

1. [Getting Started](#getting-started)
2. [First Time Setup](#first-time-setup)
3. [Using Tabyst](#using-tabyst)
4. [Understanding Recommendations](#understanding-recommendations)
5. [Advanced Features](#advanced-features)
6. [Settings & Configuration](#settings--configuration)
7. [Troubleshooting](#troubleshooting)
8. [Privacy & Data](#privacy--data)
9. [FAQ](#faq)

---

## 🚀 Getting Started

### Installation

1. **Download the Extension**
   - Visit Chrome Web Store (link coming soon)
   - Or load unpacked from GitHub (for developers)

2. **Grant Permissions**
   - Tabyst needs permission to:
     - ✅ Read and modify tab data (for content analysis)
     - ✅ Access Chrome Built-in AI (for smart recommendations)
     - ✅ Store data locally (IndexedDB)

   **Privacy Note**: All processing happens locally on your device. No data is sent to external servers.

3. **Pin the Extension** (Recommended)
   - Click the puzzle icon in Chrome toolbar
   - Find "Tabyst" and click the pin icon 📌
   - Now accessible with one click!

---

## 🎬 First Time Setup

### Cold Start: Initial AI Indexing

When you first install Tabyst, it needs to index your existing tabs with AI.

#### Step 1: Open Tabyst Popup

Click the Tabyst icon in your toolbar (or press `Ctrl+Shift+L` / `Cmd+Shift+L` on Mac)

```
╔════════════════════════════════════════╗
║            🧠 Tabyst                   ║
╠════════════════════════════════════════╣
║                                        ║
║  📊 Statistics                         ║
║     Total Tabs: 12                     ║
║     Indexed: 0                         ║
║                                        ║
║  ┌──────────────────────────────────┐  ║
║  │   🚀 Start AI Indexing           │  ║
║  └──────────────────────────────────┘  ║
║                                        ║
║  ⚡ You can use TF-IDF suggestions    ║
║     while AI indexes in background!   ║
║                                        ║
╚════════════════════════════════════════╝
```

#### Step 2: Start AI Indexing

Click **"🚀 Start AI Indexing"**

```
╔════════════════════════════════════════╗
║            🧠 Tabyst                   ║
╠════════════════════════════════════════╣
║                                        ║
║  🔄 Indexing in Progress...            ║
║                                        ║
║  ▓▓▓▓▓▓▓▓░░░░░░░░░░ 42%               ║
║                                        ║
║  Processing: 5/12 tabs                 ║
║  Current: React Documentation          ║
║                                        ║
║  ⏸️ Pause  │  You can close this      ║
║             and indexing continues!    ║
║                                        ║
╚════════════════════════════════════════╝
```

#### What Happens During Indexing?

For each tab, Tabyst:
1. **Extracts content** from the page (DOM scraping)
2. **Generates AI summary** using Chrome's Summarizer API
3. **Extracts metadata** (keywords, entities, topics) using Prompt API
4. **Builds relationships** between related tabs
5. **Updates search index** for fast suggestions

**⏱️ Time Required:**
- **High-performance machines**: 1-2 minutes per tab
- **Low-VRAM machines**: 5-10 minutes per tab

**💡 Pro Tip**: You can start using Tabyst immediately! TF-IDF suggestions work while AI indexes in the background.

#### Step 3: Completion

When indexing completes, you'll see a notification:

```
╔════════════════════════════════════════╗
║  🎉 Tabyst - Indexing Completed        ║
╠════════════════════════════════════════╣
║                                        ║
║  AI indexing completed!                ║
║  12 tabs successfully indexed.         ║
║                                        ║
║  You're all set! Press Ctrl+Shift+L   ║
║  to access smart tab suggestions.      ║
║                                        ║
╚════════════════════════════════════════╝
```

---

## 🎯 Using Tabyst

### Opening the Tab Switcher

**Keyboard Shortcuts:**
- `Ctrl+Shift+L` (Windows/Linux)
- `Cmd+Shift+L` (Mac)

**Or click** the Tabyst icon in your toolbar.

### The Tab Switcher Interface

```
╔════════════════════════════════════════════════════════════╗
║  🔍  Search tabs by title or URL...                        ║
╠════════════════════════════════════════════════════════════╣
║                                                             ║
║  SUGGESTED TABS                                            ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │ 🌐  React Hooks Tutorial                      [1]   │   ║
║  │     react.dev                                       │   ║
║  │     💡 Similar content • 95% match                  │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │ 📄  Component Patterns in React               [2]   │   ║
║  │     patterns.dev                                    │   ║
║  │     🔗 Complementary • Related topics               │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │ 💻  GitHub - my-react-project                [3]   │   ║
║  │     github.com                                      │   ║
║  │     📋 Part of workflow pattern                     │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │ 📊  Google Analytics Dashboard               [4]   │   ║
║  │     analytics.google.com                            │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
╠════════════════════════════════════════════════════════════╣
║  ↑↓ Navigate  •  Enter Switch  •  Esc Close               ║
╚════════════════════════════════════════════════════════════╝
```

### Navigation Controls

| Key | Action |
|-----|--------|
| `↑` | Move selection up |
| `↓` | Move selection down |
| `Enter` | Switch to selected tab |
| `Esc` | Close Tabyst |
| Type text | Search tabs |

### Searching for Tabs

Start typing to filter tabs:

```
╔════════════════════════════════════════════════════════════╗
║  🔍  react hooks                                           ║
╠════════════════════════════════════════════════════════════╣
║                                                             ║
║  SEARCH RESULTS (3 matches)                                ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │ 🌐  React Hooks Tutorial                      [1]   │   ║
║  │     react.dev                                       │   ║
║  │     Matches: "react" "hooks"                        │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │ 📄  Understanding React Hooks                 [2]   │   ║
║  │     medium.com                                      │   ║
║  │     Matches: "react" "hooks"                        │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │ 💻  Custom Hooks in React                     [3]   │   ║
║  │     github.com                                      │   ║
║  │     Matches: "hooks" "react"                        │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
╚════════════════════════════════════════════════════════════╝
```

**Search Features:**
- 🔍 **Fuzzy matching**: Find tabs even with typos
- 🎯 **Semantic search**: AI understands meaning, not just keywords
- ⚡ **Instant results**: Updates as you type
- 📊 **Smart ranking**: Most relevant tabs appear first

---

## 🧠 Understanding Recommendations

### Recommendation Indicators

Tabyst shows **why** each tab is recommended:

#### 💡 Similar Content
```
💡 Similar content • 95% match
```
- Tabs share similar topics, keywords, or entities
- High AI entity/topic overlap
- Good for related research or documentation

#### 🔗 Complementary
```
🔗 Complementary • Related topics
```
- Tabs work together (e.g., docs + code editor)
- AI detected complementary relationship
- Good for workflows requiring multiple resources

#### 📋 Workflow Pattern
```
📋 Part of workflow pattern
```
- You often visit these tabs in sequence
- Detected from your navigation history
- Good for repeated tasks

#### ⏱️ Recent Access
```
⏱️ Recently accessed
```
- Tabs you visited recently
- Temporal proximity scoring
- Good for resuming recent work

#### 🔄 Frequent
```
🔄 Frequently accessed
```
- Tabs you visit often
- High access count
- Good for your most-used resources

### How Recommendations Work

Tabyst uses a **hybrid scoring system**:

```
Final Score = Weighted Sum of Components

Components:
├─ 18% TF-IDF Similarity (text matching)
├─ 12% Cosine Similarity (document vectors)
├─ 28% AI Entity Overlap (people, orgs, products)
├─ 22% AI Topic Overlap (themes)
├─ 10% AI Relationship Strength (semantic)
└─ 10% Behavioral Patterns (frequency, recency)
```

**Example:**

Current Tab: "React Hooks Documentation"

Top Recommendation: "React Custom Hooks Tutorial"
- ✅ Same entities (React, Hooks)
- ✅ Same topics (React development, functional programming)
- ✅ Related content (docs → tutorial progression)
- ✅ Recently accessed together
- **Score: 0.92 (92%)**

---

## ⚙️ Advanced Features

### Workflow Detection

Tabyst automatically learns your browsing patterns.

**Example Workflow:**

```
Your Pattern:
GitHub Issue → Stack Overflow → Documentation → Code Editor

Detected Workflow:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ GitHub   │───▶│ Stack    │───▶│   Docs   │───▶│  VSCode  │
│  Issue   │    │ Overflow │    │          │    │   Web    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘

Frequency: 12 times
Confidence: 85%
```

**When on "Stack Overflow" tab**, Tabyst will suggest "Docs" next with a workflow bonus.

### Relationship Graph

Tabyst builds an AI-powered relationship graph between your tabs.

**Relationship Types:**

1. **Similar** (Same topic, different angles)
   - "React Tutorial" ↔️ "React Best Practices"

2. **Complementary** (Work together)
   - "API Documentation" ↔️ "Postman Collection"

3. **Sequential** (Natural progression)
   - "Getting Started" ↔️ "Advanced Guide"

These relationships improve recommendation accuracy over time.

### Smart Caching

Tabyst caches suggestions for speed:

```
Cache Strategy:
├─ Cache Duration: 30 seconds
├─ Invalidation: When tabs added/removed
└─ Fingerprint: Tab count
```

**Result:**
- First request: 100-500ms (compute with AI)
- Cached requests: < 50ms (instant)

---

## 🔧 Settings & Configuration

### Accessing Settings

Click the Tabyst icon → Click "Settings" (gear icon)

### Available Settings

#### 1. **AI Indexing**

```
┌──────────────────────────────────────┐
│ 🧠 AI Indexing Settings              │
├──────────────────────────────────────┤
│                                      │
│ ☑️ Enable AI indexing                │
│ ☑️ Index new tabs automatically      │
│ ☐ Index in background only          │
│                                      │
│ Re-index All Tabs                    │
│ [Button]                             │
│                                      │
└──────────────────────────────────────┘
```

#### 2. **Recommendation Preferences**

```
┌──────────────────────────────────────┐
│ 🎯 Recommendation Settings           │
├──────────────────────────────────────┤
│                                      │
│ Prioritize:                          │
│ ○ AI Similarity (default)            │
│ ○ Recent Access                      │
│ ○ Workflow Patterns                  │
│ ○ Balanced                           │
│                                      │
│ Number of suggestions: [10] ▼        │
│                                      │
└──────────────────────────────────────┘
```

#### 3. **Privacy Settings**

```
┌──────────────────────────────────────┐
│ 🔒 Privacy Settings                  │
├──────────────────────────────────────┤
│                                      │
│ ☑️ Process all tabs locally          │
│ ☐ Exclude incognito tabs            │
│ ☐ Exclude specific domains          │
│                                      │
│ Clear All Data                       │
│ [Button - requires confirmation]     │
│                                      │
└──────────────────────────────────────┘
```

#### 4. **Keyboard Shortcuts**

```
┌──────────────────────────────────────┐
│ ⌨️ Keyboard Shortcuts                │
├──────────────────────────────────────┤
│                                      │
│ Open Tabyst:                         │
│ [Ctrl+Shift+L] [Change]              │
│                                      │
│ Quick Search:                        │
│ [Ctrl+Shift+F] [Change]              │
│                                      │
└──────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### Common Issues

#### Issue: "No suggestions appear"

**Possible Causes:**
1. AI indexing hasn't completed yet
2. Not enough tabs open (need 2+ tabs)
3. Cache issue

**Solutions:**
```
✅ Wait for AI indexing to complete
✅ Open more tabs
✅ Try searching manually
✅ Reload the extension
```

#### Issue: "Suggestions seem irrelevant"

**Possible Causes:**
1. AI still learning your patterns
2. Not enough data yet
3. Workflow detection needs more samples

**Solutions:**
```
✅ Use Tabyst more often (learn patterns)
✅ Wait for more tabs to be indexed
✅ Try manual search to find what you need
```

#### Issue: "Indexing is very slow"

**This is normal!** On low-VRAM machines, AI indexing takes longer.

**Expected Times:**
- High-performance: 1-2 min/tab
- Medium-performance: 3-5 min/tab
- Low-VRAM: 5-10+ min/tab

**💡 Remember**: TF-IDF suggestions work immediately while AI indexes!

#### Issue: "Extension seems to freeze"

**Possible Causes:**
1. Too many tabs being indexed simultaneously
2. Chrome AI model downloading

**Solutions:**
```
✅ Wait for current indexing to complete
✅ Check Chrome console for errors (F12)
✅ Reload the extension
✅ Restart Chrome
```

### Resetting Tabyst

If something goes wrong, you can reset Tabyst:

1. Open Tabyst popup
2. Click Settings (gear icon)
3. Scroll to "Privacy Settings"
4. Click "Clear All Data"
5. Confirm deletion
6. Restart AI indexing

**⚠️ Warning**: This deletes all indexed data. You'll need to re-index.

---

## 🔒 Privacy & Data

### What Data Does Tabyst Store?

Tabyst stores the following **locally on your device**:

1. **Tab Metadata**
   - Title, URL, domain
   - Favicon URL
   - Access timestamps
   - Access count

2. **AI-Generated Content**
   - Summaries (200-300 words)
   - Keywords (8-10 per tab)
   - Entities (people, organizations)
   - Topics (3-5 themes)

3. **Relationships**
   - Tab-to-tab connections
   - Relationship strength
   - Semantic similarity scores

4. **Behavioral Data**
   - Navigation history (tab switches)
   - Workflow patterns
   - Access frequency

### Where Is Data Stored?

```
Your Computer (Local Storage)
├─ IndexedDB: Tab index, relationships, workflows
├─ Chrome Storage: Settings, cache
└─ No external servers ✅
```

**All data stays on your device.** Nothing is sent to external servers.

### What Tabyst NEVER Does

❌ **Never** sends data to external servers
❌ **Never** tracks your browsing across sites
❌ **Never** shares data with third parties
❌ **Never** uses your data for advertising
❌ **Never** accesses incognito tabs (optional setting)

### GDPR & Privacy Compliance

✅ **Right to Access**: All data in IndexedDB (viewable in DevTools)
✅ **Right to Delete**: "Clear All Data" button in settings
✅ **Right to Export**: Data export feature (coming soon)
✅ **Data Minimization**: Only stores what's needed
✅ **Privacy by Design**: Local-first architecture

### For Enterprise Users

Tabyst is safe for corporate environments:

- ✅ **No data leakage**: All processing local
- ✅ **No compliance issues**: GDPR/CCPA/HIPAA friendly
- ✅ **Confidential work safe**: Proprietary data stays local
- ✅ **IT-friendly**: No external connections to monitor

---

## ❓ FAQ

### General Questions

**Q: Is Tabyst free?**
A: Yes! Tabyst is open source and free to use.

**Q: Does Tabyst work offline?**
A: Yes! Once tabs are indexed, all features work offline. AI indexing requires Chrome's AI models to be downloaded first.

**Q: Which browsers does Tabyst support?**
A: Currently only Google Chrome (version 128+) with Built-in AI APIs enabled.

**Q: How do I enable Chrome's Built-in AI?**
A:
1. Open `chrome://flags`
2. Enable "Prompt API for Gemini Nano"
3. Enable "Summarization API for Gemini Nano"
4. Restart Chrome

### Performance Questions

**Q: Why is AI indexing so slow on my machine?**
A: AI indexing speed depends on your machine's VRAM. Low-VRAM machines take longer (5-10 min/tab vs 1-2 min/tab). This is normal and expected.

**Q: Can I speed up indexing?**
A: Not really - we removed all timeouts to prioritize quality over speed. But you can use TF-IDF suggestions immediately while AI works!

**Q: Will Tabyst slow down my browser?**
A: No. Tabyst uses minimal resources when idle. AI indexing happens in the background without blocking the UI.

### Feature Questions

**Q: Can Tabyst automatically close unused tabs?**
A: Not yet, but it's planned for a future update.

**Q: Can I sync across devices?**
A: Not yet, but privacy-preserving sync is on the roadmap.

**Q: Can I export my data?**
A: Coming soon! Export to JSON is planned.

**Q: Does Tabyst support tab groups?**
A: Not yet, but it's on the roadmap.

### Privacy Questions

**Q: Does Tabyst collect any analytics?**
A: No. Zero analytics, zero telemetry, zero tracking.

**Q: Can I use Tabyst with sensitive work data?**
A: Yes! All processing is local. Your data never leaves your device.

**Q: What if Chrome's AI model is cloud-based?**
A: Chrome's Built-in AI runs **on-device** using Gemini Nano. It's not cloud-based.

**Q: Can I prevent Tabyst from indexing certain sites?**
A: Domain exclusion is coming in a future update.

---

## 🆘 Getting Help

### Need Support?

- **GitHub Issues**: [Link to repository issues]
- **Documentation**: This guide + PROJECT.md
- **Community**: [Link to discussion forum]

### Reporting Bugs

When reporting bugs, please include:
1. Chrome version
2. Tabyst version
3. Steps to reproduce
4. Console errors (F12 → Console tab)
5. Number of tabs open

### Feature Requests

We love feedback! Submit feature requests on GitHub.

---

## 🎓 Tips & Best Practices

### Getting the Most Out of Tabyst

1. **Let AI Index Fully**
   - Wait for cold start to complete
   - Better recommendations with complete data

2. **Use Regularly**
   - Workflow detection needs usage data
   - More usage = better patterns = smarter suggestions

3. **Keep Tabs Organized**
   - Close tabs you're done with
   - Pin important tabs
   - Group related work

4. **Search by Meaning**
   - Search for concepts, not exact words
   - AI understands semantic meaning
   - Example: "authentication" finds "login", "sign in", etc.

5. **Trust the Recommendations**
   - Top suggestions are usually relevant
   - Give it time to learn your patterns

### Keyboard Shortcuts Power User

```
Workflow:
1. Ctrl+Shift+L    → Open Tabyst
2. Type search     → Filter tabs
3. ↓↓↓             → Navigate to desired tab
4. Enter           → Switch to tab
```

**Result**: Switch tabs in < 3 seconds! 🚀

---

## 📚 Additional Resources

- **PROJECT.md**: Technical documentation and architecture
- **GitHub Repository**: Source code and contribution guide
- **Chrome Built-in AI Docs**: Learn more about the AI APIs

---

## 🎉 Welcome to Smarter Tab Management!

Thank you for using Tabyst. We hope it makes your browsing more productive and enjoyable.

**Remember**: Your privacy is our priority. All AI processing happens locally on your device.

Happy browsing! 🚀

---

**Version**: 1.0.0
**Last Updated**: 2025
**Built for**: Google Chrome AI Challenge 2025
