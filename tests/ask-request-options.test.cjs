// No screen capture, database access or provider calls: all I/O is replaced with fixtures.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// Point this at a packaged app.asar to verify the actual release without launching it.
const appRoot = process.env.INPRO_TEST_APP_ROOT || path.join(__dirname, '..');
const { buildPersonaPromptBlock } = require(path.join(appRoot, 'src/features/common/prompts/personaPrompt'));
const { getSystemPrompt } = require(path.join(appRoot, 'src/features/common/prompts/promptBuilder'));

const profile = Object.freeze({
    enabled: true,
    displayName: 'PRIVATE_NAME',
    targetRole: 'PRIVATE_ROLE',
    resume_text: 'PRIVATE_RESUME',
    case_studies: 'PRIVATE_CASES',
    job_description: 'PRIVATE_VACANCY',
    expertiseNotes: 'PRIVATE_EXPERTISE_NOTES',
    extraInstructions: 'STYLE_RULE: be concise and never invent personal facts.',
    competenceMode: 'balanced',
    answerLanguageMode: 'question',
    languageLevel: 'B2',
    knownLanguages: [{ language: 'English', level: 'B2' }, { language: 'Russian', level: 'native' }],
});
const personalValues = Object.values(profile).filter(value => typeof value === 'string' && value.startsWith('PRIVATE_'));

function loadAsk({ failCapture = false, failVision = false, beforeModel } = {}) {
    const calls = { captures: 0, desktopCaptures: 0, requests: [], saved: [], states: [] };
    const win = { isDestroyed: () => false, isVisible: () => true, webContents: {
        send: (channel, state) => calls.states.push({ channel, state: { ...state } }),
    } };
    const dependencies = {
        electron: { BrowserWindow: {}, desktopCapturer: { getSources: async () => { calls.desktopCaptures++; return []; } } },
        '../common/ai/factory': { createStreamingLLM: () => ({ streamChat: async messages => {
            calls.requests.push(JSON.parse(JSON.stringify(messages)));
            if (failVision && calls.requests.length === 1) throw new Error('image is not supported');
            return { body: { getReader: () => ({ read: async () => ({ done: true }), cancel: async () => {} }) } };
        } }) },
        '../persona/personaService': { getPromptBlock: async options => buildPersonaPromptBlock(profile, options) },
        '../../window/windowManager': { windowPool: new Map([['ask', win]]) },
        '../../bridge/internalBridge': { emit() {} },
        '../common/repositories/session': { getOrCreateActive: async () => 'fixture-session' },
        './repositories': { addAiMessage: async row => calls.saved.push(row) },
        '../common/prompts/promptBuilder': { getSystemPrompt },
        '../common/services/modelStateService': { getCurrentModelInfo: async () => {
            if (beforeModel) await beforeModel();
            return { provider: 'fixture', apiKey: 'fixture', model: 'fixture' };
        } },
        '../listen/listenService': { getConversationHistory: () => ['Them: DIALOGUE_MARKER Explain the trade-off.'] },
        'node:path': path,
        'node:fs': { promises: { readFile: async () => Buffer.from('fixture-image'), unlink: async () => {} } },
        os: { tmpdir: () => '/fixture' },
        util: require('node:util'),
        child_process: { execFile: (_command, _args, callback) => {
            calls.captures++;
            callback(failCapture ? new Error('fixture capture failure') : null, '', '');
        } },
    };
    const context = {
        module: { exports: {} },
        console: { log() {}, warn() {}, error() {} },
        process: { platform: 'darwin' }, Buffer, AbortController, TextDecoder,
        require(name) {
            if (name === 'sharp') throw new Error('Use the capture fixture without image processing');
            assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
            return dependencies[name];
        },
    };
    const filename = path.join(appRoot, 'src/features/ask/askService.js');
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    return { service: context.module.exports, calls };
}

function assertContext(messages, included) {
    const text = JSON.stringify(messages);
    for (const value of personalValues) assert.equal(text.includes(value), included, value);
    for (const value of ['DIALOGUE_MARKER', 'STYLE_RULE', 'English — CEFR B2', 'Russian — Native / fluent']) {
        assert.ok(text.includes(value), value);
    }
}

for (const attachScreen of [false, true]) {
    for (const includePersonalContext of [false, true]) {
        test(`request with screen=${attachScreen}, personal context=${includePersonalContext}`, async () => {
            const { service, calls } = loadAsk();
            const result = await service.sendMessage('QUESTION_MARKER', [], { attachScreen, includePersonalContext });
            assert.equal(result.success, true);
            assert.equal(calls.captures, Number(attachScreen));
            assert.equal(calls.requests.length, 1);
            assertContext(calls.requests[0], includePersonalContext);
            assert.ok(JSON.stringify(calls.requests[0]).includes('QUESTION_MARKER'));
            const images = calls.requests[0][1].content.filter(part => part.type === 'image_url');
            assert.equal(images.length, Number(attachScreen));
        });
    }
}

test('a new app session defaults to no screen capture and includes personal context', async () => {
    const { service, calls } = loadAsk();
    assert.equal(service.getRequestOptions().attachScreen, false);
    assert.equal(service.getRequestOptions().includePersonalContext, true);
    await service.sendMessage('Question');
    assert.equal(calls.captures, 0);
    assert.equal(calls.desktopCaptures, 0);
    assertContext(calls.requests[0], true);
});

test('hotkey, summary, clear and reopen use the same session options without saving a profile', async () => {
    const { service, calls } = loadAsk();
    service.setRequestOptions({ attachScreen: false, includePersonalContext: false });
    await service.toggleAskButton(true);
    await service.clearResponse();
    await service.sendMessage('Question from summary');
    await service.closeAskWindow();
    assert.equal(service.getRequestOptions().includePersonalContext, false);
    await service.sendMessage('Question after reopening');
    assert.equal(calls.requests.length, 3);
    for (const messages of calls.requests) assertContext(messages, false);
    assert.equal(calls.captures, 0);
    service.setRequestOptions({ includePersonalContext: true });
    await service.sendMessage('Experience question');
    assertContext(calls.requests.at(-1), true);
    assert.equal(profile.resume_text, 'PRIVATE_RESUME');
});

test('unchecked screen never reuses a screenshot from a preceding request', async () => {
    const { service, calls } = loadAsk();
    await service.sendMessage('With screen', [], { attachScreen: true });
    await service.sendMessage('Without screen', [], { attachScreen: false });
    assert.equal(calls.captures, 1);
    assert.ok(calls.requests[0][1].content.some(part => part.type === 'image_url'));
    assert.ok(calls.requests[1][1].content.every(part => part.type !== 'image_url'));
});

test('capture failure and text-only retry do not restore omitted personal material', async () => {
    for (const failure of [{ failCapture: true }, { failVision: true }]) {
        const { service, calls } = loadAsk(failure);
        const result = await service.sendMessage('General question', [], { attachScreen: true, includePersonalContext: false });
        assert.equal(result.success, true);
        assert.equal(calls.requests.length, failure.failVision ? 2 : 1);
        for (const messages of calls.requests) assertContext(messages, false);
        const lastContent = calls.requests.at(-1)[1].content;
        assert.ok(typeof lastContent === 'string' || lastContent.every(part => part.type !== 'image_url'));
    }
});

test('options are snapshotted at submission; changes affect only the next question', async () => {
    let resume;
    const gate = new Promise(resolve => { resume = resolve; });
    const { service, calls } = loadAsk({ beforeModel: () => gate });
    const pending = service.sendMessage('General question', [], { attachScreen: false, includePersonalContext: false });
    service.setRequestOptions({ attachScreen: true, includePersonalContext: true });
    resume();
    await pending;
    assertContext(calls.requests[0], false);
    assert.equal(calls.captures, 0);
    await service.sendMessage('Next question');
    assertContext(calls.requests[1], true);
    assert.equal(calls.captures, 1);
});

test('only boolean request options are accepted, without altering response state', () => {
    const { service } = loadAsk();
    for (const options of [null, [], { attachScreen: 'true', includePersonalContext: 0, currentResponse: 'injected' }]) {
        service.setRequestOptions(options);
    }
    assert.equal(service.getRequestOptions().attachScreen, false);
    assert.equal(service.getRequestOptions().includePersonalContext, true);
    assert.equal(service.state.currentResponse, '');
});

test('general-question persona excludes experience guidance but preserves style and language for every competence mode', () => {
    for (const competenceMode of ['strict', 'balanced', 'open']) {
        const full = buildPersonaPromptBlock({ ...profile, competenceMode });
        const general = buildPersonaPromptBlock({ ...profile, competenceMode }, { includePersonalContext: false });
        for (const value of personalValues) assert.ok(!general.includes(value), value);
        for (const value of ['STYLE_RULE', 'latest actual question', 'English — CEFR B2', 'Russian — Native / fluent', `mode="${competenceMode}"`]) {
            assert.ok(general.includes(value), value);
        }
        assert.doesNotMatch(general, /<resume>|<interview_cases>|<job_description>|<experience_selection>|Answer ONLY from the experience/);
        assert.match(general, /intentionally not attached/);
        assert.match(general, /Never invent personal/);
        assert.ok(general.length < full.length);
    }
    assert.equal(buildPersonaPromptBlock({ ...profile, enabled: false }, { includePersonalContext: false }), '');
});

test('the real preload and IPC bridge carry checkbox values to Ask, including Summary requests', async () => {
    const { service, calls } = loadAsk();
    const handlers = new Map();
    let api;
    const electron = {
        ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
        ipcRenderer: { invoke: async (name, ...args) => {
            assert.ok(handlers.has(name), `Missing IPC handler: ${name}`);
            return handlers.get(name)({}, ...args);
        } },
        contextBridge: { exposeInMainWorld: (_name, exposed) => { api = exposed; } },
    };
    const bridgeModule = { exports: {} };
    const inertService = { on() {}, startPeriodicSync() {} };
    vm.runInNewContext(fs.readFileSync(path.join(appRoot, 'src/bridge/featureBridge.js'), 'utf8'), {
        module: bridgeModule, console: { log() {} },
        require(name) {
            if (name === 'electron') return electron;
            if (name === '../features/ask/askService') return service;
            return inertService;
        },
    });
    bridgeModule.exports.initialize();
    vm.runInNewContext(fs.readFileSync(path.join(appRoot, 'src/preload.js'), 'utf8'), {
        process: { platform: 'darwin' },
        require(name) { assert.equal(name, 'electron'); return electron; },
    });
    assert.equal((await api.askView.getRequestOptions()).attachScreen, false);
    await api.askView.sendMessage('General question', { attachScreen: false, includePersonalContext: false });
    assertContext(calls.requests[0], false);
    await api.summaryView.sendQuestionFromSummary('Summary question');
    assertContext(calls.requests[1], false);
    assert.equal(calls.captures, 0);
    await api.askView.setRequestOptions({ attachScreen: true, includePersonalContext: true });
    await api.summaryView.sendQuestionFromSummary('Experience question with screen');
    assertContext(calls.requests[2], true);
    assert.equal(calls.captures, 1);
});
