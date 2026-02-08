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
    const contextStr = Object.keys(context).length > 0
      ? `\n\nContext from previous agents:\n${JSON.stringify(context, null, 2)}`
      : '';

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
    });

    return this._parseResponse(result.content);
  }

  /**
   * Parse AI response, extracting JSON if present.
   */
  _parseResponse(content) {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e) {
        // Fall through to try raw parse
      }
    }

    // Try to parse the entire response as JSON
    try {
      return JSON.parse(content);
    } catch (e) {
      // Return as wrapped text
      return { raw: content };
    }
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
