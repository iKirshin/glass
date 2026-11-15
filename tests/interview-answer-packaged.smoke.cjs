// Opt-in live check of the installed app's prompts and streaming provider.
// INPRO_LIVE_PROMPT_TEST=1 ELECTRON_RUN_AS_NODE=1 /Applications/InPro.app/Contents/MacOS/InPro tests/interview-answer-packaged.smoke.cjs
// Uses the selected OpenAI model/key read-only, but sends ONLY synthetic context.
// Never captures the screen, reads résumé/cases/recordings, or writes user data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

if (process.env.INPRO_LIVE_PROMPT_TEST !== '1') {
    console.log('Skipped: set INPRO_LIVE_PROMPT_TEST=1 to allow four live API requests.');
    process.exit(0);
}

const archive = path.join(process.resourcesPath, 'app.asar');
assert.equal(archive, '/Applications/InPro.app/Contents/Resources/app.asar');
const fromApp = file => require(path.join(archive, file));
const Database = fromApp('node_modules/better-sqlite3');
const { buildPersonaPromptBlock } = fromApp('src/features/common/prompts/personaPrompt.js');
const { getSystemPrompt } = fromApp('src/features/common/prompts/promptBuilder.js');
const { createStreamingLLM } = fromApp('src/features/common/ai/factory.js');
const instructions = fs.readFileSync(path.join(__dirname, '../docs/interview-answer-instructions.txt'), 'utf8').trim();
const db = new Database('/Users/ikirshin/Library/Application Support/InPro/pickleglass.db', { readonly: true, fileMustExist: true });
let selected;
try {
    selected = db.prepare('SELECT provider, selected_llm_model, api_key FROM provider_settings WHERE is_active_llm = 1').get();
    const saved = db.prepare('SELECT enabled, extra_instructions FROM persona_profile WHERE uid = ?').get('default_user');
    assert.ok(saved?.enabled && saved.extra_instructions === instructions, 'Installed profile must use the approved instructions');
} finally { db.close(); }

assert.ok(selected?.provider === 'openai', 'This opt-in fixture supports the selected OpenAI provider only');
assert.ok(selected.api_key?.startsWith('sk-'), 'Key is unavailable or encrypted; do not change credentials for this test');
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    return nativeFetch(url, { ...options, signal: AbortSignal.timeout(45000) });
};
const llm = createStreamingLLM(selected.provider, {
    apiKey: selected.api_key, model: selected.selected_llm_model, temperature: 0.7, maxTokens: 2048,
});
const persona = buildPersonaPromptBlock({
    enabled: true,
    resumeText: 'At ExampleCo I proposed a shorter onboarding quiz. Completion increased from 50% to 60%.',
    caseStudies: 'Confirmed fixture: I proposed the change; the team implemented it. Test duration is unknown.',
    competenceMode: 'balanced', languageLevel: 'B2', answerLanguageMode: 'question',
    knownLanguages: [{ language: 'English', level: 'B2' }, { language: 'Russian', level: 'native' }],
    extraInstructions: instructions,
});
const fixtures = [
    { id: 'english-default', language: 'en', question: 'How would you explain the trade-off between consistency and availability in a distributed system?' },
    { id: 'russian-default', language: 'ru', question: 'Чем отличаются толстый и тонкий клиент, и как выбрать подходящий вариант?' },
    { id: 'ranking-two-sentences', language: 'en', sentences: 2, question: 'Rank these release notes for clarity and accuracy. The only verified fact is that users can now export CSV files. A: Exports are always instant. B: You can now export your data as a CSV file. C: CSV output functionality is available to users. Give the complete order and a brief reason in exactly two sentences.' },
    { id: 'editing-one-sentence', language: 'en', sentences: 1, question: 'Rewrite this as a direct instruction: Once the user has proceeded to the Settings screen, the button labeled Save should be pressed. Return only the revised sentence.' },
];

async function check(fixture) {
    const system = getSystemPrompt('pickle_glass_analysis', `Them: ${fixture.question}`, false, persona);
    assert.doesNotMatch(system, /Short headline answer|\*\*Main points\*\*|Keep the app's response structure|reason aloud/);
    const response = await llm.streamChat([
        { role: 'system', content: system },
        { role: 'user', content: [{ type: 'text', text: 'User Request: ' }] },
    ]);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '', output = '', finishReason;
    function consume(line) {
        if (!line.startsWith('data:')) return;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') return;
        const event = JSON.parse(data);
        if (event.error) throw new Error('Provider returned an error in the stream');
        const choice = event.choices?.[0];
        output += choice?.delta?.content || '';
        if (choice?.finish_reason) finishReason = choice.finish_reason;
    }
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split(/\r?\n/);
        pending = lines.pop();
        lines.forEach(consume);
    }
    pending += decoder.decode();
    if (pending.trim()) consume(pending);
    output = output.trim();
    const sentences = [...new Intl.Segmenter(fixture.language, { granularity: 'sentence' }).segment(output)].length;
    const noMarkdown = !/\*\*|```|^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)/m.test(output);
    const languageMatches = fixture.language === 'ru' ? /[А-Яа-яЁё]/.test(output) : !/[А-Яа-яЁё]/.test(output);
    const sentenceCountMatches = fixture.sentences ? sentences === fixture.sentences : sentences >= 2 && sentences <= 4;
    const passed = !!output && finishReason === 'stop' && noMarkdown && languageMatches && sentenceCountMatches;
    console.log(JSON.stringify({ id: fixture.id, passed, noMarkdown, languageMatches, sentences, finishReason, output }));
    return passed;
}

(async () => {
    console.log(JSON.stringify({ installedVersion: fromApp('package.json').version, model: selected.selected_llm_model, syntheticContextOnly: true }));
    const results = await Promise.all(fixtures.map(check));
    assert.ok(results.every(Boolean), 'One or more live format checks failed');
    console.log(`PASS: ${results.length}/${results.length} live packaged prompt checks.`);
})().catch(error => {
    console.error('Live prompt smoke check failed: ' + error.message);
    process.exitCode = 1;
});
