/**
 * Dextinity - Agent Chain Orchestrator
 *
 * Manages the sequential execution of all agents in the chain.
 * Handles iteration loops, error recovery, and progress tracking.
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
 * @property {function} onNarrate - Called for agent narration
 * @property {function} onChainStart - Called when the full chain starts
 * @property {function} onChainDone - Called when the full chain finishes
 * @property {function} onChainError - Called on chain-level error
 * @property {function} onProgress - Called with progress updates
 */

export class AgentChain {
  /**
   * @param {ChainCallbacks} callbacks
   */
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.isRunning = false;
    this.currentAgent = null;
    this.abortController = null;

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
    this.callbacks.onChainStart?.();

    let context = { ...userInput };
    const maxIterations = apiClient.getSettings().maxIterations || 3;

    try {
      // Add memory context
      const memoryContext = agentMemory.getRelevantContext(userInput.prompt);
      context.memoryContext = memoryContext;

      // Run agents in sequence
      for (const agentId of this.agentOrder) {
        this.currentAgent = agentId;
        this.callbacks.onAgentStart?.(agentId);

        try {
          context = await this.agents[agentId].run(context);
          this.callbacks.onAgentDone?.(agentId);
        } catch (err) {
          this.callbacks.onAgentError?.(agentId, err);
          throw new Error(`${agentId} agent failed: ${err.message}`);
        }
      }

      // Improvement iterations
      let iteration = 1;
      while (context.shouldIterate && iteration < maxIterations) {
        iteration++;
        this.callbacks.onNarrate?.({
          agent: 'system',
          agentName: 'System',
          message: `Starting improvement iteration ${iteration}/${maxIterations}...`,
          timestamp: Date.now(),
        });

        // Re-run tester and improver
        this.currentAgent = 'tester';
        this.callbacks.onAgentStart?.('tester');
        context = await this.agents.tester.run(context);
        this.callbacks.onAgentDone?.('tester');

        this.currentAgent = 'improver';
        this.callbacks.onAgentStart?.('improver');
        context = await this.agents.improver.run(context);
        this.callbacks.onAgentDone?.('improver');
      }

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

      this.isRunning = false;
      this.currentAgent = null;
      this.callbacks.onChainDone?.(context);

      return context;

    } catch (err) {
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
    this.callbacks.onChainStart?.();

    let context = { ...userInput };

    try {
      // Intent (to understand improvement goals)
      this.currentAgent = 'intent';
      this.callbacks.onAgentStart?.('intent');
      context = await this.agents.intent.run(context);
      this.callbacks.onAgentDone?.('intent');

      // Skip planner/architect since we have existing files
      // Mark them as skipped
      for (const skip of ['planner', 'architect', 'coder']) {
        this.callbacks.onAgentDone?.(skip);
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
      this.currentAgent = 'adapter';
      this.callbacks.onAgentStart?.('adapter');
      context = await this.agents.adapter.run(context);
      this.callbacks.onAgentDone?.('adapter');

      // Tester
      this.currentAgent = 'tester';
      this.callbacks.onAgentStart?.('tester');
      context = await this.agents.tester.run(context);
      this.callbacks.onAgentDone?.('tester');

      // Improver
      this.currentAgent = 'improver';
      this.callbacks.onAgentStart?.('improver');
      context = await this.agents.improver.run(context);
      this.callbacks.onAgentDone?.('improver');

      agentMemory.addUploadAnalysis({
        files: context.files?.map(f => f.path) || [],
        issues: context.testResults?.testResults?.filter(t => t.status !== 'pass') || [],
        suggestions: context.improvements || [],
      });

      this.isRunning = false;
      this.currentAgent = null;
      this.callbacks.onChainDone?.(context);

      return context;

    } catch (err) {
      this.isRunning = false;
      this.currentAgent = null;
      this.callbacks.onChainError?.(err);
      throw err;
    }
  }

  /**
   * Stop the chain (best-effort).
   */
  stop() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isRunning = false;
    this.currentAgent = null;
  }
}
