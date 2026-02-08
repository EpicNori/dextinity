/**
 * Dextinity - Base Agent
 *
 * Foundation for all agents in the chain.
 * Provides structured I/O, narration (Ralph Wiggum method), and error handling.
 */

import { apiClient } from '../core/api.js';

export class BaseAgent {
  /**
   * @param {object} config
   * @param {string} config.name - Agent display name
   * @param {string} config.id - Agent identifier (intent, planner, etc.)
   * @param {string} config.description - What this agent does
   * @param {string} config.systemPrompt - System prompt for the AI
   * @param {function} [config.onNarrate] - Callback for narration logging
   */
  constructor(config) {
    this.name = config.name;
    this.id = config.id;
    this.description = config.description;
    this.systemPrompt = config.systemPrompt;
    this.onNarrate = config.onNarrate || (() => {});
  }

  /**
   * Narrate what the agent is doing (Ralph Wiggum Method: say what you're doing).
   */
  narrate(message) {
    this.onNarrate({
      agent: this.id,
      agentName: this.name,
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Call the AI with a structured prompt and parse JSON response.
   * @param {string} userMessage - The user-facing message/prompt
   * @param {object} [context] - Additional context from previous agents
   * @returns {Promise<object>} Parsed JSON response
   */
  async callAI(userMessage, context = {}) {
    const contextKeys = Object.keys(context);
    let contextStr = '';
    if (contextKeys.length > 0) {
      // Truncate very large context objects to avoid exceeding token limits
      const contextJson = JSON.stringify(context, null, 2);
      const maxContextChars = 20000;
      contextStr = contextJson.length > maxContextChars
        ? `\n\nContext from previous agents (truncated):\n${contextJson.substring(0, maxContextChars)}...\n[truncated]`
        : `\n\nContext from previous agents:\n${contextJson}`;
    }

    const messages = [
      {
        role: 'user',
        content: userMessage + contextStr,
      },
    ];

    const result = await apiClient.call({
      systemPrompt: this.systemPrompt,
      messages,
      maxTokens: 8192,
      temperature: 0.7,
      jsonMode: true,
    });

    if (!result || !result.content) {
      this.narrate('Warning: AI returned empty response, retrying may help.');
      return { raw: '' };
    }

    return this._parseResponse(result.content);
  }

  /**
   * Parse AI response, extracting JSON if present.
   * Uses multiple strategies: fenced JSON block, raw JSON, brace extraction,
   * and balanced-brace scanning as a last resort.
   */
  _parseResponse(content) {
    if (!content || typeof content !== 'string') {
      return { raw: content || '' };
    }

    // Strategy 1: Extract JSON from ```json ... ``` fenced block
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e) {
        // Fall through to next strategy
      }
    }

    // Strategy 2: Extract JSON from ``` ... ``` (without json label)
    const codeMatch = content.match(/```\s*([\s\S]*?)```/);
    if (codeMatch) {
      try {
        const candidate = codeMatch[1].trim();
        if (candidate.startsWith('{') || candidate.startsWith('[')) {
          return JSON.parse(candidate);
        }
      } catch (e) {
        // Fall through
      }
    }

    // Strategy 3: Try to parse the entire response as JSON
    try {
      return JSON.parse(content.trim());
    } catch (e) {
      // Fall through
    }

    // Strategy 4: Find the outermost { ... } in the response
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(content.substring(firstBrace, lastBrace + 1));
      } catch (e) {
        // Fall through
      }
    }

    // Strategy 5: Balanced-brace extraction - find the first valid JSON object
    // by tracking brace depth (handles cases where outermost braces span
    // an invalid region but a valid JSON object exists inside)
    if (firstBrace !== -1) {
      const parsed = this._extractBalancedJson(content, firstBrace);
      if (parsed) return parsed;
    }

    // All strategies failed - log for debugging
    console.warn(`[${this.id}] _parseResponse: all strategies failed. Content preview:`, content.substring(0, 300));
    return { raw: content };
  }

  /**
   * Extract a balanced JSON object starting from a given position.
   * Tracks brace depth while respecting string literals.
   */
  _extractBalancedJson(content, startIdx) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIdx; i < content.length; i++) {
      const ch = content[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(content.substring(startIdx, i + 1));
          } catch (e) {
            // This balanced region wasn't valid JSON, try next opening brace
            const nextBrace = content.indexOf('{', startIdx + 1);
            if (nextBrace !== -1 && nextBrace < i) {
              return this._extractBalancedJson(content, nextBrace);
            }
            return null;
          }
        }
      }
    }
    return null;
  }

  /**
   * Run the agent. Override in subclasses.
   * @param {object} input - Structured input from previous agent or user
   * @returns {Promise<object>} Structured output for next agent
   */
  async run(input) {
    throw new Error(`${this.name}: run() not implemented`);
  }
}
