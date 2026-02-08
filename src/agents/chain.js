/**
 * Dextinity - Agent Chain Orchestrator
 *
 * Manages the sequential execution of all agents in the chain.
 * Handles iteration loops, error recovery, progress tracking,
 * and comprehensive monitoring (timing, tokens, retries).
 */

import { IntentAgent } from './intent-agent.js';
import { PlannerAgent } from './planner-agent.js';
import { ArchitectAgent } from './architect-agent.js';
import { CoderAgent } from './coder-agent.js';
import { AdapterAgent } from './adapter-agent.js';
import { TesterAgent } from './tester-agent.js';
import { ImproverAgent } from './improver-agent.js';
import { agentMemory } from '../core/memory.js';
import { apiClient } from '../core/api.js';

/**
 * @typedef {object} ChainCallbacks
 * @property {function} onAgentStart - Called when an agent starts
 * @property {function} onAgentDone - Called when an agent finishes
 * @property {function} onAgentError - Called when an agent errors
 * @property {function} onAgentSkipped - Called when an agent is skipped
 * @property {function} onNarrate - Called for agent narration
 * @property {function} onChainStart - Called when the full chain starts
 * @property {function} onChainDone - Called when the full chain finishes
 * @property {function} onChainError - Called on chain-level error
 * @property {function} onProgress - Called with progress updates { step, total, agentId, percent }
 * @property {function} onMonitorUpdate - Called with monitoring data snapshot
 */

export class AgentChain {
  /**
   * @param {ChainCallbacks} callbacks
   */
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.isRunning = false;
    this.currentAgent = null;
    this._aborted = false;

    // Monitoring state
    this.monitor = this._createEmptyMonitor();

    // Create agents
    const onNarrate = (entry) => this.callbacks.onNarrate?.(entry);

    this.agents = {
      intent: new IntentAgent(onNarrate),
      planner: new PlannerAgent(onNarrate),
      architect: new ArchitectAgent(onNarrate),
      coder: new CoderAgent(onNarrate),
      adapter: new AdapterAgent(onNarrate),
      tester: new TesterAgent(onNarrate),
      improver: new ImproverAgent(onNarrate),
    };

    this.agentOrder = ['intent', 'planner', 'architect', 'coder', 'adapter', 'tester', 'improver'];
  }

  // ==== Monitoring ====

  _createEmptyMonitor() {
    return {
      chainStartTime: null,
      chainEndTime: null,
      agentTimings: {},
      agentTokens: {},
      totalTokens: { input: 0, output: 0 },
      iterationCount: 0,
      agentErrors: [],
      completedSteps: 0,
      totalSteps: 0,
    };
  }

  _resetMonitor(totalSteps) {
    const tokenSnapshot = apiClient.getStats().tokens;
    this.monitor = this._createEmptyMonitor();
    this.monitor.chainStartTime = performance.now();
    this.monitor.totalSteps = totalSteps;
    this._tokenBaseline = { input: tokenSnapshot.input, output: tokenSnapshot.output };
  }

  _monitorAgentStart(agentId) {
    const tokenSnapshot = apiClient.getStats().tokens;
    this.monitor.agentTimings[agentId] = {
      startTime: performance.now(),
      endTime: null,
      durationMs: null,
    };
    this._agentTokenStart = {
      input: tokenSnapshot.input,
      output: tokenSnapshot.output,
    };
  }

  _monitorAgentEnd(agentId) {
    const timing = this.monitor.agentTimings[agentId];
    if (timing) {
      timing.endTime = performance.now();
      timing.durationMs = Math.round(timing.endTime - timing.startTime);
    }

    const tokenSnapshot = apiClient.getStats().tokens;
    this.monitor.agentTokens[agentId] = {
      input: tokenSnapshot.input - (this._agentTokenStart?.input || 0),
      output: tokenSnapshot.output - (this._agentTokenStart?.output || 0),
    };
    this.monitor.totalTokens = {
      input: tokenSnapshot.input - this._tokenBaseline.input,
      output: tokenSnapshot.output - this._tokenBaseline.output,
    };

    this.monitor.completedSteps++;
    this._emitMonitorUpdate();
  }

  _emitMonitorUpdate() {
    const elapsed = this.monitor.chainStartTime
      ? Math.round(performance.now() - this.monitor.chainStartTime)
      : 0;
    const percent = this.monitor.totalSteps > 0
      ? Math.round((this.monitor.completedSteps / this.monitor.totalSteps) * 100)
      : 0;

    this.callbacks.onMonitorUpdate?.({
      ...this.monitor,
      chainElapsedMs: elapsed,
      currentAgent: this.currentAgent,
      isRunning: this.isRunning,
      percent,
    });

    this.callbacks.onProgress?.({
      step: this.monitor.completedSteps,
      total: this.monitor.totalSteps,
      agentId: this.currentAgent,
      percent,
    });
  }

  /**
   * Get the current monitoring snapshot.
   */
  getMonitor() {
    const elapsed = this.monitor.chainStartTime
      ? Math.round(performance.now() - this.monitor.chainStartTime)
      : 0;
    return {
      ...this.monitor,
      chainElapsedMs: elapsed,
      currentAgent: this.currentAgent,
      isRunning: this.isRunning,
    };
  }

  _checkAbort() {
    if (this._aborted) {
      throw new Error('Chain was stopped by user');
    }
  }

  // ==== Run a single agent with monitoring and abort check ====

  async _runAgent(agentId, context) {
    this._checkAbort();
    this.currentAgent = agentId;
    this._monitorAgentStart(agentId);
    this.callbacks.onAgentStart?.(agentId);

    try {
      const result = await this.agents[agentId].run(context);
      this._monitorAgentEnd(agentId);
      this.callbacks.onAgentDone?.(agentId);
      return result;
    } catch (err) {
      this._monitorAgentEnd(agentId);
      this.monitor.agentErrors.push({
        agentId,
        error: err.message,
        timestamp: Date.now(),
      });
      this.callbacks.onAgentError?.(agentId, err);
      throw new Error(`${agentId} agent failed: ${err.message}`);
    }
  }

  // ==== Full Chain ====

  /**
   * Run the full agent chain.
   * @param {object} userInput
   * @param {string} userInput.prompt - User's game description
   * @param {string} userInput.mode - 'vibe' | 'detailed' | 'upload'
   * @param {object} [userInput.options] - Detailed mode options
   * @param {Array} [userInput.uploadedFiles] - Uploaded project files
   * @returns {Promise<object>} Final output with all generated files
   */
  async run(userInput) {
    if (this.isRunning) {
      throw new Error('Chain is already running');
    }

    if (!apiClient.isConfigured()) {
      throw new Error('API key not configured. Open settings to add your key.');
    }

    this.isRunning = true;
    this._aborted = false;
    const maxIterations = apiClient.getSettings().maxIterations || 3;
    // 7 agents + up to (maxIterations - 1) extra tester+improver pairs
    this._resetMonitor(this.agentOrder.length + (maxIterations - 1) * 2);
    this.callbacks.onChainStart?.();

    let context = { ...userInput };

    try {
      // Add memory context
      const memoryContext = agentMemory.getRelevantContext(userInput.prompt);
      context.memoryContext = memoryContext;

      // Run agents in sequence
      for (const agentId of this.agentOrder) {
        context = await this._runAgent(agentId, context);
      }

      // Improvement iterations
      let iteration = 1;
      while (context.shouldIterate && iteration < maxIterations) {
        iteration++;
        this.monitor.iterationCount = iteration;
        this.callbacks.onNarrate?.({
          agent: 'system',
          agentName: 'System',
          message: `Starting improvement iteration ${iteration}/${maxIterations}...`,
          timestamp: Date.now(),
        });

        context = await this._runAgent('tester', context);
        context = await this._runAgent('improver', context);
      }

      // Adjust totalSteps to reflect actual work done
      this.monitor.totalSteps = this.monitor.completedSteps;
      this._emitMonitorUpdate();

      // Record in memory
      agentMemory.addProject({
        intent: userInput.prompt,
        systems: context.plan?.systems?.map(s => s.name) || [],
        fileCount: context.files?.length || 0,
      });

      if (context.improvements?.length > 0) {
        for (const imp of context.improvements) {
          agentMemory.addImprovement(imp);
        }
      }

      this.monitor.chainEndTime = performance.now();
      this.isRunning = false;
      this.currentAgent = null;

      // Attach monitoring summary to the result
      context._monitor = this.getMonitor();
      this.callbacks.onChainDone?.(context);

      return context;

    } catch (err) {
      this.monitor.chainEndTime = performance.now();
      this.isRunning = false;
      this.currentAgent = null;
      this.callbacks.onChainError?.(err);
      throw err;
    }
  }

  /**
   * Run only the upload analysis and improvement flow.
   */
  async runUploadImprove(userInput) {
    if (this.isRunning) throw new Error('Chain is already running');
    if (!apiClient.isConfigured()) throw new Error('API key not configured.');

    this.isRunning = true;
    this._aborted = false;
    // 4 agents: intent, adapter, tester, improver
    this._resetMonitor(4);
    this.callbacks.onChainStart?.();

    let context = { ...userInput };

    try {
      // Intent (to understand improvement goals)
      context = await this._runAgent('intent', context);

      // Skip planner/architect/coder since we have existing files
      // Notify that these were skipped (not done) so UI can show correct state
      for (const skip of ['planner', 'architect', 'coder']) {
        this.callbacks.onAgentSkipped?.(skip);
      }

      // Convert uploaded files into the expected format
      if (context.uploadedFiles) {
        context.files = context.uploadedFiles.map(f => ({
          path: f.name,
          scriptType: f.name.endsWith('.server.lua') ? 'Script'
            : f.name.endsWith('.client.lua') ? 'LocalScript'
            : 'ModuleScript',
          luau: f.content,
          antigravity: '',
          description: `Uploaded file: ${f.name}`,
        }));
      }

      // Adapter check
      context = await this._runAgent('adapter', context);

      // Tester
      context = await this._runAgent('tester', context);

      // Improver
      context = await this._runAgent('improver', context);

      agentMemory.addUploadAnalysis({
        files: context.files?.map(f => f.path) || [],
        issues: context.testResults?.testResults?.filter(t => t.status !== 'pass') || [],
        suggestions: context.improvements || [],
      });

      this.monitor.chainEndTime = performance.now();
      this.isRunning = false;
      this.currentAgent = null;
      context._monitor = this.getMonitor();
      this.callbacks.onChainDone?.(context);

      return context;

    } catch (err) {
      this.monitor.chainEndTime = performance.now();
      this.isRunning = false;
      this.currentAgent = null;
      this.callbacks.onChainError?.(err);
      throw err;
    }
  }

  /**
   * Stop the chain (best-effort). Active API calls will finish,
   * but no new agents will start.
   */
  stop() {
    this._aborted = true;
    this.isRunning = false;
    this.currentAgent = null;
    this.callbacks.onNarrate?.({
      agent: 'system',
      agentName: 'System',
      message: 'Chain stopped by user.',
      timestamp: Date.now(),
    });
  }
}
