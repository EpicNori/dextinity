/**
 * Dextinity - AI API Integration Module
 *
 * Secure, provider-agnostic AI API client with support for:
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google Gemini
 * - Mistral AI
 * - Groq
 * - xAI (Grok)
 * - DeepSeek
 * - Cohere
 * - Custom OpenAI-compatible endpoints
 *
 * API key stored only in localStorage, never logged or transmitted elsewhere.
 */

const STORAGE_KEY = 'dextinity_settings';

// ---- Provider Registry ----

export const PROVIDERS = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models. Best for structured reasoning and code generation.',
    endpoint: 'https://api.anthropic.com/v1/messages',
    authType: 'x-api-key',
    keyPrefix: 'sk-ant-',
    keyPlaceholder: 'sk-ant-api03-...',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', recommended: true },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
      { id: 'claude-haiku-3-5-20241022', name: 'Claude 3.5 Haiku' },
    ],
    defaultModel: 'claude-sonnet-4-20250514',
    supportsSystemPrompt: true,
    supportsJsonMode: false,
    maxContextWindow: 200000,
    color: '#d97706',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models. Versatile and widely supported.',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    authType: 'bearer',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-proj-...',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', recommended: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'o3-mini', name: 'o3-mini' },
    ],
    defaultModel: 'gpt-4o',
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    maxContextWindow: 128000,
    color: '#10a37f',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini models via the Generative Language API.',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    authType: 'query-key',
    keyPrefix: '',
    keyPlaceholder: 'AIzaSy...',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', recommended: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ],
    defaultModel: 'gemini-2.5-flash',
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    maxContextWindow: 1000000,
    color: '#4285f4',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'European AI lab. Strong coding and multilingual models.',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    authType: 'bearer',
    keyPrefix: '',
    keyPlaceholder: 'your-mistral-key...',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', recommended: true },
      { id: 'mistral-medium-latest', name: 'Mistral Medium' },
      { id: 'mistral-small-latest', name: 'Mistral Small' },
      { id: 'codestral-latest', name: 'Codestral' },
    ],
    defaultModel: 'mistral-large-latest',
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    maxContextWindow: 128000,
    color: '#ff7000',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast LPU inference. Fastest generation speeds available.',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    authType: 'bearer',
    keyPrefix: 'gsk_',
    keyPlaceholder: 'gsk_...',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', recommended: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
    ],
    defaultModel: 'llama-3.3-70b-versatile',
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    maxContextWindow: 131072,
    color: '#f55036',
  },
  xai: {
    id: 'xai',
    name: 'xAI',
    description: 'Grok models from xAI. OpenAI-compatible API.',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    authType: 'bearer',
    keyPrefix: 'xai-',
    keyPlaceholder: 'xai-...',
    models: [
      { id: 'grok-3', name: 'Grok 3', recommended: true },
      { id: 'grok-3-mini', name: 'Grok 3 Mini' },
      { id: 'grok-2', name: 'Grok 2' },
    ],
    defaultModel: 'grok-3',
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    maxContextWindow: 131072,
    color: '#000000',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Strong coding and reasoning models at competitive pricing.',
    endpoint: 'https://api.deepseek.com/chat/completions',
    authType: 'bearer',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-...',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', recommended: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1' },
    ],
    defaultModel: 'deepseek-chat',
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    maxContextWindow: 65536,
    color: '#4d6bfe',
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    description: 'Enterprise AI with strong RAG and tool use capabilities.',
    endpoint: 'https://api.cohere.com/v2/chat',
    authType: 'bearer',
    keyPrefix: '',
    keyPlaceholder: 'your-cohere-key...',
    models: [
      { id: 'command-r-plus', name: 'Command R+', recommended: true },
      { id: 'command-r', name: 'Command R' },
      { id: 'command-a-03-2025', name: 'Command A' },
    ],
    defaultModel: 'command-r-plus',
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    maxContextWindow: 128000,
    color: '#39594d',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    description: 'Any OpenAI-compatible API endpoint (LM Studio, Ollama, vLLM, etc.)',
    endpoint: '',
    authType: 'bearer',
    keyPrefix: '',
    keyPlaceholder: 'your-api-key...',
    models: [],
    defaultModel: '',
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    maxContextWindow: 128000,
    color: '#8b949e',
  },
};

const PROVIDER_ORDER = ['anthropic', 'openai', 'gemini', 'mistral', 'groq', 'xai', 'deepseek', 'cohere', 'custom'];

const DEFAULT_SETTINGS = {
  provider: 'anthropic',
  apiKey: '',
  endpoint: '',
  model: 'claude-sonnet-4-20250514',
  maxIterations: 3,
  creativity: 0.5,
};

// ---- Retry Configuration ----

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

export class AIApiClient {
  constructor() {
    this.settings = this._loadSettings();
    this.requestCount = 0;
    this.tokenUsage = { input: 0, output: 0 };
    this._lastError = null;
    this._lastLatencyMs = null;
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
    const provider = PROVIDERS[this.settings.provider];
    if (this.settings.provider === 'custom') {
      return !!this.settings.apiKey && !!this.settings.endpoint;
    }
    return !!this.settings.apiKey && !!provider;
  }

  getProviderInfo() {
    return PROVIDERS[this.settings.provider] || PROVIDERS.custom;
  }

  static getProviders() {
    return PROVIDER_ORDER.map(id => PROVIDERS[id]);
  }

  static getProviderById(id) {
    return PROVIDERS[id] || null;
  }

  // ---- Retry Logic ----

  async _withRetry(fn, context = '') {
    let lastError;
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;

        const statusMatch = err.message.match(/\((\d+)\)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 0;

        // For 429 rate limits, use longer backoff and provide better messaging
        if (status === 429) {
          // Try to extract retry-after from the error message
          const retryAfterMatch = err.message.match(/retry.?after[:\s]*(\d+)/i);
          const retryAfterSecs = retryAfterMatch ? parseInt(retryAfterMatch[1]) : null;

          if (attempt === RETRY_CONFIG.maxRetries) {
            throw new Error(
              `${context} rate limit exceeded (429). ` +
              `You've hit the API rate limit. This often happens with free-tier API keys. ` +
              `Try again in a few minutes, reduce max iterations in settings, or upgrade your API plan.`
            );
          }

          // Use retry-after header value or exponential backoff with longer base for rate limits
          const delay = retryAfterSecs
            ? retryAfterSecs * 1000
            : Math.min(RETRY_CONFIG.baseDelayMs * Math.pow(3, attempt + 1), 30000);

          console.warn(
            `[Dextinity] ${context} rate limited (429), waiting ${Math.round(delay / 1000)}s before retry ${attempt + 1}/${RETRY_CONFIG.maxRetries}...`
          );
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        const isRetryable = RETRY_CONFIG.retryableStatusCodes.includes(status)
          || err.message.includes('network')
          || err.message.includes('fetch')
          || err.name === 'TypeError';

        if (!isRetryable || attempt === RETRY_CONFIG.maxRetries) {
          throw err;
        }

        const delay = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
          RETRY_CONFIG.maxDelayMs
        );
        const jitter = delay * (0.5 + Math.random() * 0.5);

        console.warn(
          `[Dextinity] ${context} attempt ${attempt + 1} failed (${status || err.message}), retrying in ${Math.round(jitter)}ms...`
        );

        await new Promise(r => setTimeout(r, jitter));
      }
    }
    throw lastError;
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
    const startTime = performance.now();

    try {
      let result;

      if (provider === 'anthropic') {
        result = await this._withRetry(
          () => this._callAnthropic({ systemPrompt, messages, maxTokens, temperature }),
          'Anthropic'
        );
      } else if (provider === 'gemini') {
        result = await this._withRetry(
          () => this._callGemini({ systemPrompt, messages, maxTokens, temperature, jsonMode }),
          'Gemini'
        );
      } else if (provider === 'cohere') {
        result = await this._withRetry(
          () => this._callCohere({ systemPrompt, messages, maxTokens, temperature }),
          'Cohere'
        );
      } else {
        // OpenAI-compatible: openai, mistral, groq, xai, deepseek, custom
        result = await this._withRetry(
          () => this._callOpenAICompatible({ systemPrompt, messages, maxTokens, temperature, jsonMode }),
          PROVIDERS[provider]?.name || 'Custom'
        );
      }

      this._lastLatencyMs = Math.round(performance.now() - startTime);
      this._lastError = null;
      return result;

    } catch (err) {
      this._lastLatencyMs = Math.round(performance.now() - startTime);
      this._lastError = err.message;

      // Provide friendlier error messages for common issues
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        const provider = PROVIDERS[this.settings.provider]?.name || this.settings.provider;
        throw new Error(
          `Could not reach ${provider} API. Check your internet connection, API key, and ensure the provider allows browser requests (CORS).`
        );
      }
      throw err;
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

    const content = (data.content || [])
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

  // ---- Google Gemini ----

  async _callGemini({ systemPrompt, messages, maxTokens, temperature, jsonMode }) {
    const model = this.settings.model || PROVIDERS.gemini.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.settings.apiKey}`;

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const generationConfig = {
      maxOutputTokens: maxTokens,
      temperature,
    };

    // Enable JSON output mode when requested
    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const body = {
      contents,
      generationConfig,
    };

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    this.requestCount++;

    // Gemini 2.5 thinking models return parts with thought:true for reasoning.
    // We must filter these out to get only the actual response text.
    const allParts = data.candidates?.[0]?.content?.parts || [];
    const responseParts = allParts.filter(p => !p.thought);
    // If filtering removes everything (shouldn't happen), fall back to all parts
    const partsToUse = responseParts.length > 0 ? responseParts : allParts;
    const text = partsToUse.map(p => p.text || '').join('');

    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    this.tokenUsage.input += inputTokens;
    this.tokenUsage.output += outputTokens;

    return {
      content: text,
      usage: { input: inputTokens, output: outputTokens },
    };
  }

  // ---- Cohere ----

  async _callCohere({ systemPrompt, messages, maxTokens, temperature }) {
    const formattedMessages = [];

    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const m of messages) {
      formattedMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      });
    }

    const body = {
      model: this.settings.model || PROVIDERS.cohere.defaultModel,
      messages: formattedMessages,
      max_tokens: maxTokens,
      temperature,
    };

    const response = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Cohere API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    this.requestCount++;

    const text = data.message?.content?.[0]?.text || '';
    const inputTokens = data.usage?.tokens?.input_tokens || 0;
    const outputTokens = data.usage?.tokens?.output_tokens || 0;
    this.tokenUsage.input += inputTokens;
    this.tokenUsage.output += outputTokens;

    return {
      content: text,
      usage: { input: inputTokens, output: outputTokens },
    };
  }

  // ---- OpenAI-Compatible (OpenAI, Mistral, Groq, xAI, DeepSeek, Custom) ----

  async _callOpenAICompatible({ systemPrompt, messages, maxTokens, temperature, jsonMode }) {
    const providerInfo = PROVIDERS[this.settings.provider];
    const endpoint = this.settings.provider === 'custom'
      ? this.settings.endpoint
      : providerInfo?.endpoint || 'https://api.openai.com/v1/chat/completions';

    const body = {
      model: this.settings.model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    };

    if (jsonMode && providerInfo?.supportsJsonMode) {
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
      const name = providerInfo?.name || 'API';
      throw new Error(`${name} error (${response.status}): ${err}`);
    }

    const data = await response.json();
    this.requestCount++;
    if (data.usage) {
      this.tokenUsage.input += data.usage.prompt_tokens || 0;
      this.tokenUsage.output += data.usage.completion_tokens || 0;
    }

    const choices = data.choices || [];
    return {
      content: choices[0]?.message?.content || '',
      usage: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0,
      },
    };
  }

  // ---- Connection Test ----

  /**
   * Test connectivity to the configured provider with a minimal request.
   * @returns {Promise<{ok: boolean, latencyMs: number, model: string, error?: string}>}
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return { ok: false, latencyMs: 0, model: '', error: 'API key not configured' };
    }

    const start = performance.now();
    try {
      const result = await this.call({
        systemPrompt: 'Respond with exactly: OK',
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 8,
        temperature: 0,
      });

      const latencyMs = Math.round(performance.now() - start);
      return {
        ok: true,
        latencyMs,
        model: this.settings.model,
        response: result.content.trim().substring(0, 50),
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        ok: false,
        latencyMs,
        model: this.settings.model,
        error: err.message,
      };
    }
  }

  // ---- Stats ----

  getStats() {
    return {
      requests: this.requestCount,
      tokens: { ...this.tokenUsage },
      lastLatencyMs: this._lastLatencyMs,
      lastError: this._lastError,
      provider: this.settings.provider,
    };
  }

  /**
   * Reset usage stats (useful at the start of a new generation).
   */
  resetStats() {
    this.requestCount = 0;
    this.tokenUsage = { input: 0, output: 0 };
    this._lastError = null;
    this._lastLatencyMs = null;
  }
}

// Singleton
export const apiClient = new AIApiClient();
