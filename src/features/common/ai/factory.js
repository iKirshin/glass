// factory.js

/**
 * @typedef {object} ModelPricing
 * @property {number} [input]     USD per 1M input tokens
 * @property {number} [output]    USD per 1M output tokens
 * @property {number} [perMinute] USD per minute of audio (STT)
 * @property {boolean} [free]     runs locally, no per-use cost
 * @property {string} [note]
 * @property {string} [verifiedAt] date of the official price check (YYYY-MM-DD)
 * @property {string} [source] official pricing page
 * @property {{from: string, input?: number, output?: number}} [priceAfter] announced change date and standard rates
 */
/**
 * @typedef {object} ModelOption
 * @property {string} id 
 * @property {string} name
 * @property {boolean} [legacy] retain saved selections, hide from new-model suggestions
 * @property {boolean} [retired] unavailable for new selections and requests
 * @property {ModelPricing} [pricing] standard list price, not a usage/cost estimate
 */

/**
 * @typedef {object} Provider
 * @property {string} name
 * @property {() => any} handler
 * @property {ModelOption[]} llmModels
 * @property {ModelOption[]} sttModels
 */

// Standard API prices, USD per 1M uncached input / output tokens.
// Do not substitute Batch/Flex/cached-input prices. Date-limited and long-context
// tariffs are explained in the picker tooltip, not silently presented as universal.
const LLM_PRICING_SOURCES = {
    openai: 'https://developers.openai.com/api/docs/pricing',
    anthropic: 'https://platform.claude.com/docs/en/about-claude/pricing',
    gemini: 'https://aistudio.google.com/docs/pricing',
};
function llmPricing(provider, input, output, note = '', details = {}) {
    return { input, output, note, verifiedAt: '2026-11-24', source: LLM_PRICING_SOURCES[provider], ...details };
}

// Dates without a time zone in provider pricing are treated as UTC calendar dates.
function resolveModelPricing(model, date = new Date()) {
    const pricing = model.pricing;
    const change = pricing?.priceAfter;
    if (!change || date.toISOString().slice(0, 10) < change.from) return model;
    const { input, output, priceAfter, ...details } = pricing;
    const rates = change.input === undefined ? { priceUnconfirmed: true } : { input: change.input, output: change.output };
    return { ...model, pricing: { ...details, ...rates } };
}

function normalizeLlmModelId(id) {
    return id === 'gpt-5.6' ? 'gpt-5.6-sol' : id;
}
const OPENAI_CONTEXT_NOTE = 'До 272K входных токенов. Свыше 272K: вход ×2, выход ×1.5 для всего запроса.';

/** @type {Object.<string, Provider>} */
const PROVIDERS = {
  'openai': {
      name: 'OpenAI',
      handler: () => require("./providers/openai"),
      llmModels: [
          { id: 'gpt-6.2-sol', name: 'GPT-6.2 Sol', pricing: llmPricing('openai', 2, 10, OPENAI_CONTEXT_NOTE, { verifiedAt: '2026-11-24' }) },
          { id: 'gpt-6.2-astra', name: 'GPT-6.2 Astra', pricing: llmPricing('openai', 8, 40, OPENAI_CONTEXT_NOTE, { verifiedAt: '2026-11-24' }) },
          { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', pricing: llmPricing('openai', 2, 10, OPENAI_CONTEXT_NOTE) },
          { id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra', pricing: llmPricing('openai', 1, 5, OPENAI_CONTEXT_NOTE, { verifiedAt: '2026-11-14' }) },
          { id: 'gpt-6-astra', name: 'GPT-6 Astra', pricing: llmPricing('openai', 10, 50, OPENAI_CONTEXT_NOTE) },
          { id: 'gpt-6-luna', name: 'GPT-6 Luna', pricing: llmPricing('openai', 0.1, 0.5, OPENAI_CONTEXT_NOTE) },
          { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', legacy: true, pricing: llmPricing('openai', 4, 20, `${OPENAI_CONTEXT_NOTE} Акционная цена по 2026-11-30. После акции сверяйтесь с OpenAI.`, { verifiedAt: '2026-11-14', priceAfter: { from: '2026-12-01' } }) },
          { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', legacy: true, pricing: llmPricing('openai', 2, 12, OPENAI_CONTEXT_NOTE) },
          { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', legacy: true, pricing: llmPricing('openai', 0.2, 1.2, OPENAI_CONTEXT_NOTE) },
      ],
      sttModels: [
          { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini Transcribe', pricing: { perMinute: 0.003, note: 'OpenAI shutdown: 2027-02-26. Live replacement: GPT Live Transcribe.' } },
          { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe', pricing: { perMinute: 0.006, note: 'OpenAI shutdown: 2027-02-26. Live replacement: GPT Live Transcribe.' } },
          { id: 'gpt-live-transcribe', name: 'GPT Live Transcribe', pricing: { perMinute: 0.017 } },
      ],
  },

  'gemini': {
      name: 'Gemini',
      handler: () => require("./providers/gemini"),
      llmModels: [
          { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', pricing: llmPricing('gemini', 0.75, 3.75, 'Платный Standard API. Цена до 2026-12-31; с 2027-01-01: $1.5 / $7.5 per 1M.', { verifiedAt: '2026-11-14', priceAfter: { from: '2027-01-01', input: 1.5, output: 7.5 } }) },
          { id: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', pricing: llmPricing('gemini', 1.5, 7.5, 'Платный Standard API.', { verifiedAt: '2026-11-14' }) },
          { id: 'gemini-4-carbon', name: 'Gemini 4 Carbon', pricing: llmPricing('gemini', 2, 10, 'Только платный API. Цена до 2026-11-30; с 2026-12-01: $4 / $20 per 1M.', { verifiedAt: '2026-11-24', priceAfter: { from: '2026-12-01', input: 4, output: 20 } }) },
          { id: 'gemini-4-neon', name: 'Gemini 4 Neon', pricing: llmPricing('gemini', 3, 15, 'Платный Standard API.', { verifiedAt: '2026-11-24' }) },
          { id: 'gemini-4-argon', name: 'Gemini 4 Argon', pricing: llmPricing('gemini', 2, 10, 'Только платный API. Цена до 2026-11-30; с 2026-12-01: $4 / $20 per 1M.', { verifiedAt: '2026-11-14', priceAfter: { from: '2026-12-01', input: 4, output: 20 } }) },
          { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', pricing: llmPricing('gemini', 0.3, 2.5, 'Платный Standard API.') },
          { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (preview)', legacy: true, pricing: llmPricing('gemini', 2, 12, 'До 200K входных токенов. Свыше 200K: $4 / $18 per 1M для всего запроса.') },
      ],
      sttModels: [
          { id: 'gemini-3.1-flash-live-preview', name: 'Gemini 3.1 Flash Live (preview)', pricing: { perMinute: 0.005 } },
          { id: 'gemini-live-2.5-flash-preview', name: 'Gemini Live 2.5 Flash', retired: true },
      ],
  },
  'anthropic': {
      name: 'Anthropic',
      handler: () => require("./providers/anthropic"),
      llmModels: [
          { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', pricing: llmPricing('anthropic', 2, 10) },
          { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', pricing: llmPricing('anthropic', 4, 20) },
          { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', pricing: llmPricing('anthropic', 0.1, 0.5, 'До 100K входных токенов. Свыше 100K (включая кеш): $0.5 / $2.5 per 1M для всего запроса.') },
          { id: 'claude-fable-5-2', name: 'Claude Fable 5.2', pricing: llmPricing('anthropic', 8, 40, 'Adaptive thinking. Provider requires 30-day data retention.', { verifiedAt: '2026-11-24' }) },
          { id: 'claude-opus-5', name: 'Claude Opus 5', legacy: true, pricing: llmPricing('anthropic', 5, 25) },
          { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', legacy: true, pricing: llmPricing('anthropic', 2, 10) },
          { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', legacy: true, pricing: llmPricing('anthropic', 1, 5) },
      ],
      sttModels: [],
  },
  'deepgram': {
    name: 'Deepgram',
    handler: () => require("./providers/deepgram"),
    llmModels: [],
    sttModels: [
        { id: 'nova-3', name: 'Nova-3 (General)', pricing: { perMinute: 0.0048 } },
        ],
    },
  'ollama': {
      name: 'Ollama (Local)',
      handler: () => require("./providers/ollama"),
      llmModels: [], // Dynamic models populated from installed Ollama models
      sttModels: [], // Ollama doesn't support STT yet
  },
  'whisper': {
      name: 'Whisper (Local)',
      handler: () => {
          // This needs to remain a function due to its conditional logic for renderer/main process
          if (typeof window === 'undefined') {
              const { WhisperProvider } = require("./providers/whisper");
              return new WhisperProvider();
          }
          // Return a dummy object for the renderer process
          return {
              validateApiKey: async () => ({ success: true }), // Mock validate for renderer
              createSTT: () => { throw new Error('Whisper STT is only available in main process'); },
          };
      },
      llmModels: [],
      sttModels: [
          { id: 'whisper-tiny', name: 'Whisper Tiny (39M)', pricing: { free: true } },
          { id: 'whisper-base', name: 'Whisper Base (74M)', pricing: { free: true } },
          { id: 'whisper-small', name: 'Whisper Small (244M)', pricing: { free: true } },
          { id: 'whisper-medium', name: 'Whisper Medium (769M)', pricing: { free: true } },
      ],
  },
};

function createSTT(provider, opts) {
  if (PROVIDERS[provider]?.sttModels.some(model => model.id === opts?.model && model.retired)) {
    throw new Error('This speech recognition model has been retired. Choose another STT model in Settings.');
  }
  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createSTT) {
      throw new Error(`STT not supported for provider: ${provider}`);
  }
  return handler.createSTT(opts);
}

function createLLM(provider, opts) {
  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createLLM) {
      throw new Error(`LLM not supported for provider: ${provider}`);
  }
  return handler.createLLM(opts);
}

function createStreamingLLM(provider, opts) {
  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createStreamingLLM) {
      throw new Error(`Streaming LLM not supported for provider: ${provider}`);
  }
  return handler.createStreamingLLM(opts);
}

function getProviderClass(providerId) {
    const providerConfig = PROVIDERS[providerId];
    if (!providerConfig) return null;
    
    const actualProviderId = providerId;

    // The handler function returns the module, from which we get the class.
    const module = providerConfig.handler();
    
    // Map provider IDs to their actual exported class names
    const classNameMap = {
        'openai': 'OpenAIProvider',
        'anthropic': 'AnthropicProvider',
        'gemini': 'GeminiProvider',
        'deepgram': 'DeepgramProvider',
        'ollama': 'OllamaProvider',
        'whisper': 'WhisperProvider'
    };
    
    const className = classNameMap[actualProviderId];
    return className ? module[className] : null;
}

function getAvailableProviders() {
  const stt = [];
  const llm = [];
  for (const [id, provider] of Object.entries(PROVIDERS)) {
      if (provider.sttModels.length > 0) stt.push(id);
      if (provider.llmModels.length > 0) llm.push(id);
  }
  return { stt: [...new Set(stt)], llm: [...new Set(llm)] };
}

module.exports = {
  PROVIDERS,
  normalizeLlmModelId,
  resolveModelPricing,
  createSTT,
  createLLM,
  createStreamingLLM,
  getProviderClass,
  getAvailableProviders,
};
