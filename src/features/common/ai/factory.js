// factory.js

/**
 * @typedef {object} ModelPricing
 * @property {number} [input]     USD per 1M input tokens
 * @property {number} [output]    USD per 1M output tokens
 * @property {number} [perMinute] USD per minute of audio (STT)
 * @property {boolean} [free]     runs locally, no per-use cost
 * @property {string} [note]
 */
/**
 * @typedef {object} ModelOption
 * @property {string} id 
 * @property {string} name
 * @property {ModelPricing} [pricing] list price at the time of writing (Sep 2026)
 */

/**
 * @typedef {object} Provider
 * @property {string} name
 * @property {() => any} handler
 * @property {ModelOption[]} llmModels
 * @property {ModelOption[]} sttModels
 */

/**
 * @type {Object.<string, Provider>}
 */
const PROVIDERS = {
  'openai': {
      name: 'OpenAI',
      handler: () => require("./providers/openai"),
      llmModels: [
          { id: 'gpt-5.6', name: 'GPT-5.6 Sol', pricing: { input: 4, output: 20 } },
          { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', pricing: { input: 2, output: 12 } },
          { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', pricing: { input: 0.2, output: 1.2 } },
      ],
      sttModels: [
          { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini Transcribe', pricing: { perMinute: 0.003 } },
          { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe', pricing: { perMinute: 0.006 } },
          { id: 'gpt-live-transcribe', name: 'GPT Live Transcribe', pricing: { perMinute: 0.017 } },
      ],
  },

  'gemini': {
      name: 'Gemini',
      handler: () => require("./providers/gemini"),
      llmModels: [
          { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', pricing: { input: 0.75, output: 3.75 } },
          { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (preview)', pricing: { input: 2, output: 12, note: 'prompts ≤200K tokens' } },
      ],
      sttModels: [
          { id: 'gemini-live-2.5-flash-preview', name: 'Gemini Live 2.5 Flash', pricing: { perMinute: 0.005 } },
          { id: 'gemini-3.1-flash-live-preview', name: 'Gemini 3.1 Flash Live (preview)', pricing: { perMinute: 0.005 } },
      ],
  },
  'anthropic': {
      name: 'Anthropic',
      handler: () => require("./providers/anthropic"),
      llmModels: [
          { id: 'claude-opus-5', name: 'Claude Opus 5', pricing: { input: 5, output: 25 } },
          { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', pricing: { input: 2, output: 10 } },
          { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', pricing: { input: 1, output: 5 } },
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
  createSTT,
  createLLM,
  createStreamingLLM,
  getProviderClass,
  getAvailableProviders,
};