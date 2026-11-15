// Offline contract tests. No user database, API keys, screen capture or network calls.
// INPRO_TEST_APP_ROOT can point at the release app.asar.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const appRoot = process.env.INPRO_TEST_APP_ROOT || path.join(__dirname, '..');
const { PROVIDERS, normalizeLlmModelId, resolveModelPricing, createSTT } = require(path.join(appRoot, 'src/features/common/ai/factory'));
const plain = value => JSON.parse(JSON.stringify(value));
const current = provider => PROVIDERS[provider].llmModels.filter(m => !m.legacy);

function loadModule(file, dependencies, globals = {}) {
    const context = {
        module: { exports: {} }, console: { log() {}, warn() {}, error() {} },
        ReadableStream, Response, TextEncoder, Buffer,
        require(id) {
            assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
            return dependencies[id];
        },
        ...globals,
    };
    vm.runInNewContext(fs.readFileSync(path.join(appRoot, file), 'utf8'), context, { filename: file });
    return context.module.exports;
}

test('current answer catalog has exact official IDs and standard, non-Batch prices', () => {
    const expected = {
        openai: [['gpt-6.1-sol', 2, 10], ['gpt-6.1-terra', 1, 5], ['gpt-6-astra', 10, 50], ['gpt-6-luna', 0.1, 0.5]],
        anthropic: [['claude-sonnet-5-5', 2, 10], ['claude-opus-5-5', 4, 20], ['claude-haiku-5-5', 0.1, 0.5]],
        gemini: [['gemini-3.8-flash', 0.75, 3.75], ['gemini-4-hydrogen', 1.5, 7.5], ['gemini-4-argon', 2, 10], ['gemini-3.5-flash-lite', 0.3, 2.5]],
    };
    const ids = new Set();
    for (const [provider, entries] of Object.entries(expected)) {
        assert.deepEqual(current(provider).map(m => [m.id, m.pricing.input, m.pricing.output]), entries);
        for (const m of PROVIDERS[provider].llmModels) {
            assert.ok(!ids.has(m.id)); ids.add(m.id);
            assert.match(m.pricing.verifiedAt, /^2026-(10-19|11-14)$/);
            assert.match(m.pricing.source, /^https:\/\//);
            assert.ok(m.pricing.input > 0 && m.pricing.output > 0);
        }
    }
});

test('price conditions include long context and announced promotion expiry dates', () => {
    for (const model of current('openai')) assert.match(model.pricing.note, /272K/);
    assert.match(current('anthropic').find(m => m.id === 'claude-haiku-5-5').pricing.note, /100K.*\$0.5 \/ \$2.5/);
    assert.match(current('gemini').find(m => m.id === 'gemini-4-argon').pricing.note, /2026-12-01: \$4 \/ \$20/);
    assert.match(current('gemini').find(m => m.id === 'gemini-3.8-flash').pricing.note, /2027-01-01: \$1.5 \/ \$7.5/);
});

test('standard rates change on the announced UTC dates without mutating the catalog', () => {
    const prices = (id, date) => {
        const model = Object.values(PROVIDERS).flatMap(p => p.llmModels).find(m => m.id === id);
        const { input, output, priceUnconfirmed } = resolveModelPricing(model, new Date(date)).pricing;
        return priceUnconfirmed ? null : [input, output];
    };
    assert.deepEqual(prices('gemini-4-argon', '2026-11-30T23:59:59Z'), [2, 10]);
    assert.deepEqual(prices('gemini-4-argon', '2026-12-01T00:00:00Z'), [4, 20]);
    assert.deepEqual(prices('gemini-3.8-flash', '2026-12-31T23:59:59Z'), [0.75, 3.75]);
    assert.deepEqual(prices('gemini-3.8-flash', '2027-01-01T00:00:00Z'), [1.5, 7.5]);
    assert.deepEqual(prices('gpt-5.6-sol', '2026-11-30T23:59:59Z'), [4, 20]);
    assert.equal(prices('gpt-5.6-sol', '2026-12-01T00:00:00Z'), null);
    assert.deepEqual(prices('gemini-4-argon', '2026-11-30T23:59:59Z'), [2, 10]);
});

function modelState(selected = 'gpt-5.6-luna', custom = false) {
    const registry = Object.fromEntries(Object.entries(PROVIDERS).map(([id, p]) => [id, { ...p, llmModels: [...p.llmModels] }]));
    if (custom) registry.openai.llmModels.push({ id: selected, name: 'My custom model', custom: true });
    const settings = [
        { provider: 'openai', api_key: 'fixture', selected_llm_model: selected },
        { provider: 'deepgram', api_key: 'fixture', selected_stt_model: 'nova-3' },
        { provider: 'anthropic', api_key: null },
    ];
    const writes = [];
    const repo = {
        getAll: async () => settings,
        getActiveSettings: async () => ({ llm: settings[0], stt: settings[1] }),
        getActiveProvider: async type => type === 'llm' ? settings[0] : settings[1],
        getByProvider: async id => settings.find(s => s.provider === id),
        upsert: async (id, value) => { writes.push(id); Object.assign(settings.find(s => s.provider === id), value); },
        setActiveProvider: async (id, type) => writes.push([id, type]),
    };
    const service = loadModule('src/features/common/services/modelStateService.js', {
        events: require('node:events'), 'electron-store': class {},
        '../ai/factory': { PROVIDERS: registry, normalizeLlmModelId, resolveModelPricing }, '../ai/customModels': {},
        './encryptionService': {}, '../repositories/providerSettings': repo,
        './authService': {}, '../repositories/ollamaModel': { getInstalledModels: () => [{ name: 'local-fixture' }] },
    });
    return { service, settings, writes };
}

test('catalog refresh preserves a saved legacy model on startup and hides other old entries', async () => {
    const { service, writes } = modelState();
    await service._autoSelectAvailableModels([], true);
    assert.deepEqual(writes, []);
    assert.equal((await service.getSelectedModels()).llm, 'gpt-5.6-luna');
    const available = plain(await service.getAvailableModels('llm'));
    assert.deepEqual(available.map(m => m.id), ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-astra', 'gpt-6-luna', 'gpt-5.6-luna']);
    assert.equal(available.at(-1).legacy, true);
    assert.equal(service.getProviderForModel('gpt-5.6', 'llm'), 'openai');
    assert.equal(service.getProviderForModel('llm', 'gpt-5.6-terra'), 'openai');
    assert.equal(service.getProviderForModel('local-fixture', 'llm'), 'ollama');
});

test('a saved GPT-5.6 Sol alias resolves to the canonical API ID without writing settings on startup', async () => {
    const { service, writes } = modelState('gpt-5.6');
    await service._autoSelectAvailableModels([], true);
    assert.deepEqual(writes, []);
    assert.equal((await service.getSelectedModels()).llm, 'gpt-5.6-sol');
    assert.equal((await service.getCurrentModelInfo('llm')).model, 'gpt-5.6-sol');
    assert.ok((await service.getAvailableModels('llm')).some(m => m.id === 'gpt-5.6-sol'));
    const { adapter } = providerFixture('openai');
    assert.equal(adapter.buildChatParams({ model: 'gpt-5.6', messages: [], maxTokens: 100 }).model, 'gpt-5.6-sol');
});

test('retired Gemini Live 2.5 cannot be selected or sent to the provider', async () => {
    const { service, settings, writes } = modelState();
    const model = 'gemini-live-2.5-flash-preview';
    settings.push({ provider: 'gemini', api_key: 'fixture', selected_stt_model: model });
    const choices = await service.getAvailableModels('stt');
    assert.ok(!choices.some(m => m.id === model));
    assert.ok(choices.some(m => m.id === 'gemini-3.1-flash-live-preview'));
    assert.equal(await service.setSelectedModel('stt', model), false);
    assert.deepEqual(writes, []);
    assert.throws(() => createSTT('gemini', { model }), /has been retired/);
});

test('explicit selection of a new model works and removes the obsolete suggestion', async () => {
    const { service } = modelState();
    assert.equal(await service.setSelectedModel('llm', 'gpt-6-luna'), true);
    assert.equal((await service.getSelectedModels()).llm, 'gpt-6-luna');
    assert.ok((await service.getAvailableModels('llm')).every(m => !m.legacy));
    assert.equal((await service.getSelectedModels()).stt, 'nova-3');
});

test('custom selections are retained, not priced speculatively or replaced on startup', async () => {
    const { service, writes } = modelState('my-private-model', true);
    await service._autoSelectAvailableModels([], true);
    assert.deepEqual(writes, []);
    const custom = (await service.getAvailableModels('llm')).find(m => m.id === 'my-private-model');
    assert.equal(custom.custom, true);
    assert.equal(custom.pricing, undefined);
});

test('new installations select the balanced default, not the most expensive model', async () => {
    const { service } = modelState(null);
    await service._autoSelectAvailableModels([], true);
    assert.equal((await service.getSelectedModels()).llm, 'gpt-6.1-sol');
});

function providerFixture(provider) {
    const requests = [];
    const answer = 'Fixture answer.';
    const dependencies = {
        openai: class { constructor() { this.chat = { completions: { create: async params => {
            requests.push(plain(params)); return { choices: [{ message: { content: answer } }] };
        } } }; } },
        ws: class {}, stream: require('node:stream'), '../factory.js': { normalizeLlmModelId },
        '@anthropic-ai/sdk': { Anthropic: class { constructor() { this.messages = { create: async params => {
            requests.push(plain(params));
            if (params.stream) return (async function* () {
                yield { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'PRIVATE_THINKING' } };
                yield { type: 'content_block_delta', delta: { type: 'text_delta', text: answer } };
            })();
            return { content: [{ type: 'thinking', thinking: 'PRIVATE_THINKING' }, { type: 'text', text: answer }] };
        } }; } } },
        '@google/genai': {},
        '@google/generative-ai': { GoogleGenerativeAI: class { getGenerativeModel(config) {
            return {
                generateContent: async content => { requests.push(plain({ ...config, content })); return { response: { text: () => answer } }; },
                startChat: () => ({ sendMessage: async content => { requests.push(plain({ ...config, content })); return { response: { text: () => answer } }; } }),
                generateContentStream: async content => {
                    requests.push(plain({ ...config, content }));
                    return { stream: (async function* () { yield { text: () => answer }; })() };
                },
            };
        } } },
    };
    const adapter = loadModule(`src/features/common/ai/providers/${provider}.js`, dependencies, {
        fetch: async (url, opts) => {
            assert.equal(url, 'https://api.openai.com/v1/chat/completions');
            requests.push(JSON.parse(opts.body));
            return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: answer } }] })}\n\ndata: [DONE]\n\n`);
        },
    });
    return { adapter, requests, answer };
}

for (const provider of ['openai', 'anthropic', 'gemini']) {
    for (const { id: model } of current(provider)) {
        for (const withImage of [false, true]) {
            test(`${model}: streaming and non-streaming answers, screen=${withImage}`, async () => {
                const { adapter, requests, answer } = providerFixture(provider);
                const messages = [{ role: 'system', content: 'Answer briefly in plain text.' }, {
                    role: 'user', content: withImage ? [
                        { type: 'text', text: 'Synthetic question.' },
                        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,cGl4ZWw=' } },
                    ] : 'Synthetic question.',
                }];
                const options = { apiKey: 'fixture', model, maxTokens: 2048, temperature: 0.7 };
                const reply = await adapter.createLLM(options).chat(messages);
                assert.equal(reply.content, answer);
                const response = await adapter.createStreamingLLM(options).streamChat(messages);
                const streamText = await response.text();
                assert.match(streamText, /Fixture answer/);
                assert.match(streamText, /\[DONE\]/);
                assert.ok(!streamText.includes('PRIVATE_THINKING'));
                assert.equal(requests.length, 2);
                for (const request of requests) {
                    assert.equal(request.model, model);
                    if (provider === 'openai') {
                        assert.equal(request.reasoning_effort, 'low');
                        assert.equal(request.max_completion_tokens, 2048);
                        assert.equal(request.temperature, undefined);
                        assert.equal(request.max_tokens, undefined);
                    } else if (provider === 'anthropic') {
                        assert.equal(request.output_config.effort, 'low');
                        assert.equal(request.max_tokens, 2048);
                        assert.equal(request.temperature, undefined);
                        assert.equal(request.thinking, undefined);
                    } else {
                        assert.equal(request.generationConfig.maxOutputTokens, 2048);
                        assert.equal(request.generationConfig.responseMimeType, 'text/plain');
                        assert.equal(request.generationConfig.temperature, model.startsWith('gemini-4-') ? undefined : 0.7);
                        assert.equal(request.generationConfig.thinkingConfig?.thinkingLevel, model === 'gemini-4-hydrogen' ? 'LOW' : undefined);
                    }
                    assert.equal(JSON.stringify(request).includes('cGl4ZWw='), withImage);
                    if (withImage) assert.match(JSON.stringify(request), /image\/jpeg/);
                }
            });
        }
    }
}

test('legacy and arbitrary custom model request parameters remain unchanged', async () => {
    const openai = providerFixture('openai').adapter;
    assert.deepEqual(plain(openai.buildChatParams({ model: 'gpt-4.1', messages: [], temperature: 0.7, maxTokens: 100 })), {
        model: 'gpt-4.1', messages: [], temperature: 0.7, max_tokens: 100,
    });
    for (const model of ['claude-opus-5', 'claude-haiku-4-5', 'my-custom-claude']) {
        const { adapter, requests } = providerFixture('anthropic');
        await adapter.createLLM({ apiKey: 'fixture', model, temperature: 0.7, maxTokens: 100 }).chat([{ role: 'user', content: 'Synthetic question.' }]);
        const request = requests[0];
        assert.equal(request.output_config, undefined);
        assert.equal(request.temperature, model === 'claude-haiku-4-5' ? 0.7 : undefined);
    }
    const gemini = providerFixture('gemini').adapter;
    assert.equal(gemini.buildGenerationConfig('custom-gemini', 0.3, 100).temperature, 0.3);
});
