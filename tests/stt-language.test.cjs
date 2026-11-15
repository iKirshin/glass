// No microphone, recordings, provider credentials or network access.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const catalog = require('../src/features/common/config/sttLanguages');

function load(relative, dependencies, globals = {}) {
    const filename = path.join(__dirname, '..', relative);
    const context = {
        module: { exports: {} }, Buffer, URLSearchParams,
        console: { log() {}, warn() {}, error() {} },
        setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
        require(id) {
            assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
            return dependencies[id];
        },
        ...globals,
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    return context.module.exports;
}

function serviceFixture(saved = 'multi') {
    const requests = [], timeouts = [];
    const settings = { language: saved, getSttLanguage() { return this.language; } };
    const Service = load('src/features/listen/stt/sttService.js', {
        electron: {}, child_process: { spawn() { throw new Error('Audio capture forbidden'); } },
        '../../common/config/sttLanguages': catalog,
        '../../common/ai/factory': { createSTT: async (provider, options) => {
            requests.push({ provider, ...options });
            return { close() {} };
        } },
        '../../common/services/modelStateService': { getCurrentModelInfo: async () => ({ provider: 'deepgram', model: 'nova-3', apiKey: 'not-a-real-key' }) },
        '../recordingService': {}, './speechBandFilter': {},
        '../../settings/repositories': settings,
    }, { process: { env: { OPENAI_TRANSCRIBE_LANG: 'en' } }, setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; } });
    const service = new Service();
    service._isThemFilterEnabled = () => false;
    service.sendToRenderer = () => {};
    return { service, requests, timeouts, settings };
}

test('Nova-3 catalog preserves every saved language code and labels the expanded multilingual mode', () => {
    const expected = `multi af af-ZA ar ar-AE ar-SA ar-QA ar-KW ar-SY ar-LB ar-PS ar-JO ar-EG ar-SD ar-TD ar-MA ar-DZ ar-TN ar-IQ ar-IR hy as as-IN be bn bs bg ca zh-HK zh zh-CN zh-Hans zh-TW zh-Hant hr cs cs-CZ da da-DK nl en en-US en-AU en-GB en-IN en-NZ et fi nl-BE fr fr-CA ka ka-GE de de-CH el gu he hi hu id it ja kn kk kk-KZ ko ko-KR lv lt mk ms mr mn ne no ps ps-AF fa pl pt pt-BR pt-PT pa pa-IN ro ru sr sk sl es es-419 sv sv-SE tl ta te th th-TH tr tr-TR uk ur vi`.split(' ');
    assert.deepEqual(catalog.STT_LANGUAGES.map(l => l.id).sort(), expected.sort());
    assert.equal(new Set(expected).size, expected.length);
    assert.equal(catalog.STT_LANGUAGES[0].label, 'Multilingual (Nova-3: 55 languages)');
    assert.equal(catalog.normalizeSttLanguage('invalid'), 'multi');
});

test('normal Listen startup uses saved multi on both channels, not the old English environment override', async () => {
    const { service, requests } = serviceFixture();
    await service.initializeSttSessions();
    assert.deepEqual(requests.map(r => r.language), ['multi', 'multi']);
    assert.equal(service.currentLanguage, 'multi');
});

test('every catalog code reaches both STT sessions unchanged', async () => {
    for (const { id } of catalog.STT_LANGUAGES) {
        const { service, requests } = serviceFixture(id);
        await service.initializeSttSessions();
        assert.deepEqual(requests.map(r => r.language), [id, id]);
    }
});

test('renewal, scheduled renewal and recovery retain this call language despite a setting change', async () => {
    const { service, requests, timeouts, settings } = serviceFixture('pt-PT');
    await service.initializeSttSessions();
    settings.language = 'ru';
    await service.renewSessions();
    await timeouts.find(t => t.ms === 20 * 60 * 1000).fn();
    await service._recoverSttSessions('test');
    assert.equal(requests.length, 8);
    assert.ok(requests.every(r => r.language === 'pt-PT'));
    await service.initializeSttSessions();
    assert.deepEqual(requests.slice(-2).map(r => r.language), ['ru', 'ru']);
});

test('Russian, English and mixed-script finals survive filtering and reach completion callbacks', async () => {
    const { service, requests } = serviceFixture();
    const completions = [];
    service.onTranscriptionComplete = (speaker, text) => completions.push({ speaker, text });
    await service.initializeSttSessions();
    for (const text of ['Расскажите о вашем опыте.', 'Tell me about your work.', 'Какие product metrics вы выбрали?']) {
        requests[1].callbacks.onmessage({ is_final: true, channel: { alternatives: [{ transcript: text }] } });
        service.flushTheirCompletion();
        assert.equal(completions.at(-1).text, text);
    }
    requests[0].callbacks.onmessage({ is_final: true, channel: { alternatives: [{ transcript: 'Спасибо, расскажу.' }] } });
    service.flushMyCompletion();
    assert.equal(completions.at(-1).speaker, 'Me');
    assert.equal(completions.at(-1).text, 'Спасибо, расскажу.');
    service.currentLanguage = 'en';
    assert.equal(service._filterTranscript('Them', 'Русский ответ.'), 'Русский ответ.');
    assert.equal(service._filterTranscript('Them', '### 123'), '');
});

test('Deepgram wire request uses multi by default and preserves explicit regional codes', async () => {
    const requests = [];
    class FakeSocket extends EventEmitter {
        constructor(url) { super(); requests.push(new URL(url)); queueMicrotask(() => this.emit('open')); }
        send() {} close() {} terminate() {}
    }
    const provider = load('src/features/common/ai/providers/deepgram.js', { '@deepgram/sdk': {}, ws: FakeSocket });
    for (const language of [undefined, 'ru', 'en', 'zh-Hant', 'pt-PT']) await provider.createSTT({ apiKey: 'test', language });
    assert.deepEqual(requests.map(u => u.searchParams.get('language')), ['multi', 'ru', 'en', 'zh-Hant', 'pt-PT']);
    assert.ok(requests.every(u => u.searchParams.get('model') === 'nova-3' && u.searchParams.get('endpointing') === '100'));
});

test('Listen does not force English when no language is supplied by the UI', async () => {
    let received;
    const service = load('src/features/listen/listenService.js', {
        electron: {}, './stt/sttService': class { setCallbacks() {} async initializeSttSessions(language) { received = language; } },
        './summary/summaryService': class { setCallbacks() {} }, '../common/services/authService': {},
        './recordingService': {}, '../common/repositories/session': {}, './stt/repositories': {}, '../../bridge/internalBridge': {},
    });
    service.sendToRenderer = () => {};
    service.initializeNewSession = async () => true;
    assert.equal(await service.initializeSession(), true);
    assert.equal(received, undefined);
});

test('OpenAI omits the language constraint for multi and receives ISO base codes otherwise', async () => {
    const sent = [];
    let socket;
    class FakeSocket {
        constructor() { socket = this; }
        send(json) { sent.push(JSON.parse(json)); }
    }
    const provider = load('src/features/common/ai/providers/openai.js', {
        openai: class {}, ws: FakeSocket, stream: {}, '../factory.js': {},
    });
    for (const language of ['multi','ru','pt-PT']) {
        const promise = provider.createSTT({ apiKey:'test', language });
        socket.onopen(); await promise;
    }
    assert.equal(Object.hasOwn(sent[0].session.audio.input.transcription, 'language'), false);
    assert.equal(sent[1].session.audio.input.transcription.language, 'ru');
    assert.equal(sent[2].session.audio.input.transcription.language, 'pt');
});

test('Gemini never receives multi-US; automatic mode omits the language code', async () => {
    const sent = [];
    const provider = load('src/features/common/ai/providers/gemini.js', {
        '@google/generative-ai': {}, '@google/genai': { GoogleGenAI: class { live = { connect: async request => { sent.push(request); return {}; } }; } },
    });
    await provider.createSTT({ apiKey:'test', language:'multi' });
    await provider.createSTT({ apiKey:'test', language:'ru' });
    assert.equal(Object.hasOwn(sent[0].config, 'speechConfig'), false);
    assert.equal(sent[1].config.speechConfig.languageCode, 'ru-RU');
});

test('Whisper retains auto mode and receives base language codes for explicit choices', async () => {
    const { WhisperProvider } = load('src/features/common/ai/providers/whisper.js', {
        child_process: { spawn() { throw new Error('Real capture forbidden'); } }, path, events: { EventEmitter },
    });
    const provider = new WhisperProvider();
    provider.whisperService = { ensureModelAvailable: async () => {} };
    const multilingual = await provider.createSTT({ language:'multi' });
    const russian = await provider.createSTT({ language:'ru' });
    const portuguese = await provider.createSTT({ language:'pt-PT' });
    assert.equal(multilingual.language, 'auto');
    assert.equal(russian.language, 'ru');
    assert.equal(portuguese.language, 'pt');
});
