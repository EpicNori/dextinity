/**
 * Dextinity - Agent Memory System
 *
 * Persistent memory between iterations and sessions.
 * Stores project context, past decisions, and improvement history.
 * Uses localStorage for browser persistence.
 */

const MEMORY_KEY = 'dextinity_memory';

export class AgentMemory {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(MEMORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load memory:', e);
    }
    return {
      projects: [],         // Past project contexts
      decisions: [],        // Architecture decisions made
      improvements: [],     // What was improved and why
      patterns: {},         // Learned patterns (game type -> systems)
      uploadHistory: [],    // Uploaded project analyses
    };
  }

  _save() {
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save memory:', e);
    }
  }

  /**
   * Record a completed project generation.
   */
  addProject(project) {
    this.data.projects.push({
      timestamp: Date.now(),
      intent: project.intent,
      systems: project.systems,
      fileCount: project.fileCount,
    });
    // Keep only last 20 projects
    if (this.data.projects.length > 20) {
      this.data.projects = this.data.projects.slice(-20);
    }
    this._save();
  }

  /**
   * Record an architecture decision for future reference.
   */
  addDecision(decision) {
    this.data.decisions.push({
      timestamp: Date.now(),
      context: decision.context,
      choice: decision.choice,
      reasoning: decision.reasoning,
    });
    if (this.data.decisions.length > 50) {
      this.data.decisions = this.data.decisions.slice(-50);
    }
    this._save();
  }

  /**
   * Record an improvement made to a project.
   */
  addImprovement(improvement) {
    this.data.improvements.push({
      timestamp: Date.now(),
      area: improvement.area,
      before: improvement.before,
      after: improvement.after,
    });
    if (this.data.improvements.length > 50) {
      this.data.improvements = this.data.improvements.slice(-50);
    }
    this._save();
  }

  /**
   * Store a learned pattern (e.g., "simulator" games need these systems).
   */
  setPattern(gameType, systems) {
    this.data.patterns[gameType] = systems;
    this._save();
  }

  /**
   * Get relevant context for a new generation based on past experience.
   */
  getRelevantContext(intent) {
    // Common words that should not trigger a match
    const stopWords = new Set([
      'game', 'make', 'with', 'that', 'this', 'from', 'have', 'will',
      'what', 'when', 'where', 'which', 'about', 'been', 'would', 'could',
      'should', 'their', 'there', 'they', 'them', 'then', 'than', 'each',
      'were', 'some', 'like', 'want', 'need', 'good', 'very', 'also',
      'just', 'more', 'into', 'over', 'your', 'does', 'only',
    ]);

    const relevantProjects = this.data.projects
      .filter(p => {
        const intentLower = (intent || '').toLowerCase();
        const pIntentLower = (p.intent || '').toLowerCase();
        const words = intentLower.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
        return words.some(w => pIntentLower.includes(w));
      })
      .slice(-3);

    const recentDecisions = this.data.decisions.slice(-5);
    const recentImprovements = this.data.improvements.slice(-5);

    return {
      pastProjects: relevantProjects,
      recentDecisions,
      recentImprovements,
      patterns: this.data.patterns,
    };
  }

  /**
   * Record an uploaded project analysis.
   */
  addUploadAnalysis(analysis) {
    this.data.uploadHistory.push({
      timestamp: Date.now(),
      files: analysis.files,
      issues: analysis.issues,
      suggestions: analysis.suggestions,
    });
    if (this.data.uploadHistory.length > 10) {
      this.data.uploadHistory = this.data.uploadHistory.slice(-10);
    }
    this._save();
  }

  /**
   * Clear all memory.
   */
  clear() {
    localStorage.removeItem(MEMORY_KEY);
    this.data = this._load();
  }
}

export const agentMemory = new AgentMemory();
