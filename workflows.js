/**
 * workflows.js
 * Automatic workflow detection and next tab prediction
 */

import { db } from './db.js';
import { storage } from './storage.js';

/**
 * Extract navigation sequences from history
 */
async function extractSequences(minLength = 2, maxLength = 5) {
  try {
    const navHistory = await db.getRecentNavigations(Date.now() - (30 * 24 * 60 * 60 * 1000)); // Last 30 days
    
    if (navHistory.length < minLength) {
      return [];
    }
    
    // Sort by timestamp
    const sorted = navHistory.sort((a, b) => a.timestamp - b.timestamp);
    
    const sequences = [];
    
    // Extract sequences of different lengths
    for (let len = minLength; len <= maxLength; len++) {
      for (let i = 0; i <= sorted.length - len; i++) {
        const sequence = sorted.slice(i, i + len);
        
        // Check if sequence is contiguous (within 10 minutes between each step)
        let isContiguous = true;
        for (let j = 1; j < sequence.length; j++) {
          const timeDiff = sequence[j].timestamp - sequence[j - 1].timestamp;
          if (timeDiff > 10 * 60 * 1000) { // 10 minutes
            isContiguous = false;
            break;
          }
        }
        
        if (isContiguous) {
          sequences.push({
            tabs: sequence.map(nav => ({
              tabId: nav.toTab.tabId,
              url: nav.toTab.url,
              timestamp: nav.timestamp
            })),
            length: len,
            startTime: sequence[0].timestamp,
            endTime: sequence[sequence.length - 1].timestamp
          });
        }
      }
    }
    
    return sequences;
    
  } catch (error) {
    console.error('Error extracting sequences:', error);
    return [];
  }
}

/**
 * Detect workflows from sequences
 */
async function detectWorkflows() {
  try {
    console.log('🔍 Detecting workflows...');
    
    const sequences = await extractSequences(2, 5);
    
    if (sequences.length === 0) {
      console.log('No sequences found');
      return [];
    }
    
    // Group identical sequences
    const sequenceMap = new Map();
    
    for (const seq of sequences) {
      // Create a key based on tab URLs
      const key = seq.tabs.map(t => t.url).join('->');
      
      if (!sequenceMap.has(key)) {
        sequenceMap.set(key, {
          pattern: seq.tabs.map(t => t.url),
          occurrences: [],
          frequency: 0
        });
      }
      
      const entry = sequenceMap.get(key);
      entry.occurrences.push({
        startTime: seq.startTime,
        endTime: seq.endTime
      });
      entry.frequency++;
    }
    
    // Filter workflows with frequency >= 3
    const workflows = [];
    
    for (const [key, data] of sequenceMap.entries()) {
      if (data.frequency >= 3) {
        // Calculate average time between occurrences
        const sortedOccurrences = data.occurrences.sort((a, b) => a.startTime - b.startTime);
        let totalInterval = 0;
        
        for (let i = 1; i < sortedOccurrences.length; i++) {
          totalInterval += sortedOccurrences[i].startTime - sortedOccurrences[i - 1].endTime;
        }
        
        const avgInterval = sortedOccurrences.length > 1 ? totalInterval / (sortedOccurrences.length - 1) : 0;
        
        workflows.push({
          id: `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pattern: data.pattern,
          frequency: data.frequency,
          lastOccurrence: sortedOccurrences[sortedOccurrences.length - 1].startTime,
          avgInterval: avgInterval,
          confidence: Math.min(data.frequency / 10, 1), // Confidence increases with frequency
          type: 'navigation_sequence'
        });
      }
    }
    
    // Sort by frequency
    workflows.sort((a, b) => b.frequency - a.frequency);
    
    console.log(`✅ Found ${workflows.length} workflows`);
    
    // Save to DB
    for (const workflow of workflows) {
      await db.upsertWorkflow(workflow);
    }
    
    return workflows;
    
  } catch (error) {
    console.error('Error detecting workflows:', error);
    return [];
  }
}

/**
 * Predict next likely tab based on current tab
 */
async function predictNextTab(currentTabId) {
  try {
    const currentTab = await db.getTabByTabId(currentTabId);
    if (!currentTab) return null;
    
    // Get all workflows
    const workflows = await db.getAllWorkflows();
    
    if (workflows.length === 0) {
      return null;
    }
    
    // Find workflows that contain the current tab URL
    const matchingWorkflows = [];
    
    for (const workflow of workflows) {
      const currentIndex = workflow.pattern.findIndex(url => url === currentTab.url);
      
      if (currentIndex !== -1 && currentIndex < workflow.pattern.length - 1) {
        // There's a next tab in this workflow
        const nextUrl = workflow.pattern[currentIndex + 1];
        
        matchingWorkflows.push({
          workflow: workflow,
          nextUrl: nextUrl,
          confidence: workflow.confidence,
          position: currentIndex
        });
      }
    }
    
    if (matchingWorkflows.length === 0) {
      return null;
    }
    
    // Sort by confidence
    matchingWorkflows.sort((a, b) => b.confidence - a.confidence);
    
    // Get the most confident prediction
    const prediction = matchingWorkflows[0];
    
    // Find the actual tab with this URL
    const allTabs = await db.getAllTabs();
    const nextTab = allTabs.find(t => t.url === prediction.nextUrl && t.flags.isActive);
    
    if (nextTab) {
      return {
        tab: nextTab,
        confidence: prediction.confidence,
        workflow: prediction.workflow,
        reason: `Part of workflow (${prediction.workflow.frequency}x)`
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('Error predicting next tab:', error);
    return null;
  }
}

/**
 * Describe a workflow using AI (optional enhancement)
 */
async function describeWorkflow(workflow) {
  try {
    // Simple description without AI
    const domains = workflow.pattern.map(url => {
      try {
        return new URL(url).hostname.replace('www.', '');
      } catch {
        return 'unknown';
      }
    });
    
    const uniqueDomains = [...new Set(domains)];
    
    if (uniqueDomains.length === 1) {
      return `Single-domain workflow on ${uniqueDomains[0]}`;
    } else {
      return `Multi-domain workflow: ${uniqueDomains.slice(0, 3).join(' → ')}`;
    }
    
  } catch (error) {
    console.error('Error describing workflow:', error);
    return 'Unknown workflow';
  }
}

/**
 * Get workflow suggestions for current tab
 */
async function getWorkflowSuggestions(currentTabId) {
  try {
    const prediction = await predictNextTab(currentTabId);
    
    if (!prediction) {
      return [];
    }
    
    return [{
      ...prediction.tab,
      score: prediction.confidence,
      reason: prediction.reason,
      isWorkflowPrediction: true
    }];
    
  } catch (error) {
    console.error('Error getting workflow suggestions:', error);
    return [];
  }
}

/**
 * Update workflows periodically
 */
async function updateWorkflows() {
  try {
    console.log('🔄 Updating workflows...');
    
    await detectWorkflows();
    
    console.log('✅ Workflows updated');
    
  } catch (error) {
    console.error('Error updating workflows:', error);
  }
}

/**
 * Get workflow statistics
 */
async function getWorkflowStats() {
  try {
    const workflows = await db.getAllWorkflows();
    
    const stats = {
      totalWorkflows: workflows.length,
      highConfidence: workflows.filter(w => w.confidence >= 0.7).length,
      mediumConfidence: workflows.filter(w => w.confidence >= 0.4 && w.confidence < 0.7).length,
      lowConfidence: workflows.filter(w => w.confidence < 0.4).length,
      avgFrequency: workflows.length > 0 
        ? workflows.reduce((sum, w) => sum + w.frequency, 0) / workflows.length 
        : 0,
      mostFrequent: workflows.length > 0 
        ? workflows.sort((a, b) => b.frequency - a.frequency)[0] 
        : null
    };
    
    return stats;
    
  } catch (error) {
    console.error('Error getting workflow stats:', error);
    return null;
  }
}

export {
  extractSequences,
  detectWorkflows,
  predictNextTab,
  describeWorkflow,
  getWorkflowSuggestions,
  updateWorkflows,
  getWorkflowStats
};