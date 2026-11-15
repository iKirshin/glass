// Prompt-composition regressions; no real model requests or user database access.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { buildPersonaPromptBlock } = require('../src/features/common/prompts/personaPrompt');
const { getSystemPrompt } = require('../src/features/common/prompts/promptBuilder');

const instructions = fs.readFileSync(path.join(__dirname, '../docs/interview-answer-instructions.txt'), 'utf8').trim();
const profile = {
    enabled: true,
    resumeText: 'At Example Co I improved onboarding completion from 50% to 60%.',
    caseStudies: 'Confirmed case: I proposed a shorter quiz. The team implemented it. The test duration is unknown.',
    jobDescription: 'Product Manager: improve onboarding and prioritize initiatives.',
    competenceMode: 'balanced',
    answerLanguageMode: 'question',
    languageLevel: 'B2',
    knownLanguages: [{ language: 'English', level: 'B2' }, { language: 'Russian', level: 'native' }],
    extraInstructions: instructions,
};

function askPrompt(overrides = {}, conversation = 'Them: Rank A, B and C and explain your choice in exactly two sentences.') {
    return getSystemPrompt('pickle_glass_analysis', conversation, false, buildPersonaPromptBlock({ ...profile, ...overrides }));
}

test('Ask delivers the requested result before rationale even without a persona', () => {
    const prompt = getSystemPrompt('pickle_glass_analysis', '', false);
    for (const rule of [
        'Selection: name the chosen option',
        'Ranking: state the complete order first',
        'Editing: provide the revised wording first; add rationale only if requested',
        'Process: describe a short sequence of connected actions',
        'Experience: use one relevant, confirmed example',
        'default to 2-4 concise, connected spoken sentences without a heading or bullets',
        'sentence counts, word limits, rankings and output types override all default formatting and examples below',
    ]) assert.ok(prompt.includes(rule), rule);
    assert.doesNotMatch(prompt, /Short headline answer|\*\*Main points\*\*|\*\*Sub-details\*\*/);
});

test('the approved personal instructions reach the assembled Ask prompt exactly once', () => {
    const prompt = askPrompt();
    assert.equal(prompt.split(instructions).length - 1, 1);
    assert.ok(prompt.includes(`<extra_instructions>\n${instructions}\n</extra_instructions>`));
    assert.ok(instructions.includes('Otherwise, default to 2–4 concise sentences.'));
    assert.ok(instructions.includes('without deliberate mistakes or artificial hesitation'));
});

test('two-sentence tasks do not inherit mandatory headings, bullets or separate confirmation notes', () => {
    for (const competenceMode of ['strict', 'balanced', 'open']) {
        const prompt = askPrompt({ competenceMode });
        assert.ok(prompt.includes('When exactly two sentences are requested, return exactly two sentences'));
        assert.ok(prompt.includes('Add no heading, preamble, bullets, extra notes or closing summary'));
        assert.ok(prompt.includes('never append it to an exact-sentence answer'));
        assert.ok(prompt.includes('Express material uncertainty within the requested format'));
        assert.doesNotMatch(prompt, /Keep the app's response structure|short headline, then|put it separately under|reason aloud/);
    }
});

test('experience detail is conditional and generic conversation suggestions cannot replace an answer', () => {
    const prompt = askPrompt({}, 'Them: Edit this instruction and return only the revised wording.');
    for (const rule of [
        'For an experience question, develop ONE relevant example',
        'Do not add a résumé story to an editing, ranking or selection task unless requested',
        'Do not attach a résumé story, metric, validation plan or follow-up question to every answer',
        'Use this fallback only when there is no current question or explicit task to answer',
        'Do not append these suggestions to a completed answer',
    ]) assert.ok(prompt.includes(rule), rule);
});

test('concise answers retain factual, metric and competence boundaries', () => {
    const prompt = askPrompt();
    for (const rule of [
        'Never invent facts or hide material uncertainty to satisfy a format',
        'Never invent personal experience, metrics, dates, tests or results',
        'Missing detail is not proof that the user lacks experience',
        'NOT historical achievements',
        'percentages from percentage points',
        'team outcomes from personal contributions',
        'distinguish an initial target from the final result',
        'Use "I would" for hypothetical approaches',
        'Do not assert unsupported expert-level detail',
    ]) assert.ok(prompt.includes(rule), rule);
    for (const value of [profile.resumeText, profile.caseStudies, profile.jobDescription]) assert.ok(prompt.includes(value));
});

test('answer-language selection and per-language levels remain independent of the new style', () => {
    const prompt = askPrompt({}, 'Them: Как бы вы расставили варианты по приоритету?');
    for (const rule of [
        'latest actual question',
        'English — CEFR B2',
        'Russian — Native / fluent',
        'Never apply the English level to Russian',
        'Simplify wording, not reasoning, and do not deliberately introduce errors',
    ]) assert.ok(prompt.includes(rule), rule);
    assert.ok(prompt.indexOf('<language>') > prompt.indexOf('</extra_instructions>'));
    assert.ok(askPrompt({ answerLanguageMode: 'fixed', answerLanguage: 'English' }).includes('Answer in English.'));
});
