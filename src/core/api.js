/**
 * Dextinity - AI API Integration Module
 *
 * Secure, provider-agnostic AI API client.
 * Supports Anthropic (Claude), OpenAI, and custom endpoints.
 * API key stored only in localStorage, never logged or transmitted elsewhere.
 */

const STORAGE_KEY = 'dextinity_settings';

const DEFAULT_SETTINGS = {
  provider: 'anthropic',
  apiKey: '',
  endpoint: '',
  model: 'claude-sonnet-4-20250514',
  maxIterations: 3,
};

export class AIApiClient {
  constructor() {
    this.settings = this._loadSettings();
    this.requestCount = 0;
    this.tokenUsage = { input: 0, output: 0 };
  }

  // ---- Settings Management ----

  _loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }

  getSettings() {
    return { ...this.settings };
  }

  isConfigured() {
    return !!this.settings.apiKey;
  }

  // ---- API Call Abstraction ----

  /**
   * Send a structured prompt to the AI and get a response.
   * @param {object} params
   * @param {string} params.systemPrompt - System instructions
   * @param {Array<{role: string, content: string}>} params.messages - Conversation messages
   * @param {number} [params.maxTokens=4096] - Max response tokens
   * @param {number} [params.temperature=0.7] - Temperature
   * @param {boolean} [params.jsonMode=false] - Request JSON output
   * @returns {Promise<{content: string, usage: {input: number, output: number}}>}
   */
  async call({ systemPrompt, messages, maxTokens = 4096, temperature = 0.7, jsonMode = false }) {
    if (!this.isConfigured()) {
      throw new Error('API key not configured. Open settings to add your key.');
    }

    const provider = this.settings.provider;

    if (provider === 'anthropic') {
      return this._callAnthropic({ systemPrompt, messages, maxTokens, temperature });
    } else {
      return this._callOpenAI({ systemPrompt, messages, maxTokens, temperature, jsonMode });
    }
  }

  // ---- Anthropic (Claude) ----

  async _callAnthropic({ systemPrompt, messages, maxTokens, temperature }) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.settings.model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    this.requestCount++;
    if (data.usage) {
      this.tokenUsage.input += data.usage.input_tokens || 0;
      this.tokenUsage.output += data.usage.output_tokens || 0;
    }

    const content = data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    return {
      content,
      usage: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0,
      },
    };
  }

  // ---- OpenAI / Custom ----

  async _callOpenAI({ systemPrompt, messages, maxTokens, temperature, jsonMode }) {
    const endpoint = this.settings.provider === 'custom'
      ? this.settings.endpoint
      : 'https://api.openai.com/v1/chat/completions';

    const body = {
      model: this.settings.model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    };

    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    this.requestCount++;
    if (data.usage) {
      this.tokenUsage.input += data.usage.prompt_tokens || 0;
      this.tokenUsage.output += data.usage.completion_tokens || 0;
    }

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0,
      },
    };
  }

  // ---- Stats ----

  getStats() {
    return {
      requests: this.requestCount,
      tokens: { ...this.tokenUsage },
    };
  }
}

// Singleton
export const apiClient = new AIApiClient();
