// personaPrompt.js
// Turns the user's persona profile (résumé, competence boundaries, language level)
// into a system-prompt block so generated answers sound like the user, not like an
// omniscient assistant.

const COMPETENCE_MODES = {
    strict: {
        label: 'Strict — only my real experience',
        rules: `- Answer ONLY from the experience, skills and facts in the résumé.
- If a question goes beyond that experience, do what a real candidate would do: briefly acknowledge the limit ("I haven't done X hands-on, but…"), then reason it through from adjacent experience, transferable principles and common sense. Do not pretend to be an expert.
- Never invent projects, employers, tools, metrics, certifications or dates that are not in the résumé.`,
    },
    balanced: {
        label: 'Balanced — my experience plus general professional knowledge',
        rules: `- Ground answers in the résumé first; use its projects, roles and results as concrete examples.
- For topics the résumé does not cover, answer the way a competent professional with this background would: show general understanding, be honest about depth ("I know this at a high level"), and reason aloud instead of asserting expert-level detail.
- Never invent projects, employers, tools, metrics, certifications or dates that are not in the résumé.`,
    },
    open: {
        label: 'Open — use full knowledge, résumé for examples',
        rules: `- Use the résumé to personalise answers with real examples, but otherwise answer with full expertise.
- Still do not invent personal facts (projects, employers, metrics) that are not in the résumé.`,
    },
};

const LANGUAGE_LEVELS = {
    native: {
        label: 'Native / fluent',
        rules: '',
    },
    C2: {
        label: 'C2 — proficient',
        rules: `- Fluent, precise and idiomatic; no simplification needed.`,
    },
    C1: {
        label: 'C1 — advanced',
        rules: `- Fluent and well-structured, but slightly less idiomatic than a native speaker.
- Prefer clear, standard phrasing over rare idioms or wordplay; an occasional slightly formal or non-native turn of phrase is natural.`,
    },
    B2: {
        label: 'B2 — upper-intermediate',
        rules: `- Clear and confident, but with noticeably simpler vocabulary and structure than a native speaker.
- Use mostly common words and straightforward sentence structures; avoid idioms, phrasal-verb-heavy phrasing and rare terminology (keep necessary professional terms).
- Sentences of moderate length; simple connectors (because, so, but, also, for example).
- Occasional minor non-native phrasing is acceptable; grammar mistakes should be rare.`,
    },
    B1: {
        label: 'B1 — intermediate',
        rules: `- Simple, short sentences built from common everyday and basic professional vocabulary.
- One idea per sentence; simple connectors only (and, but, because, so, then, for example).
- Avoid idioms, complex tenses, passive constructions and rare words; it is fine to repeat words instead of using synonyms.
- Small, natural non-native imperfections are acceptable (slightly awkward word order, missing articles), but the answer must stay understandable.
- Keep answers shorter than a native speaker would.`,
    },
    A2: {
        label: 'A2 — elementary',
        rules: `- Very simple, short sentences with basic vocabulary and present/past simple tenses.
- Only the most common connectors (and, but, because).
- Short answers; it is fine to sound plain and to repeat words. Non-native imperfections are natural.`,
    },
};

const MAX_RESUME_CHARS = 40000;

function normalizeProfile(profile) {
    const p = profile || {};
    return {
        enabled: p.enabled === undefined || p.enabled === null ? true : !!p.enabled,
        displayName: (p.display_name || p.displayName || '').trim(),
        targetRole: (p.target_role || p.targetRole || '').trim(),
        resumeText: (p.resume_text || p.resumeText || '').trim(),
        competenceMode: COMPETENCE_MODES[p.competence_mode || p.competenceMode] ? (p.competence_mode || p.competenceMode) : 'balanced',
        expertiseNotes: (p.expertise_notes || p.expertiseNotes || '').trim(),
        languageLevel: LANGUAGE_LEVELS[p.language_level || p.languageLevel] ? (p.language_level || p.languageLevel) : 'native',
        answerLanguage: (p.answer_language || p.answerLanguage || '').trim(),
        extraInstructions: (p.extra_instructions || p.extraInstructions || '').trim(),
    };
}

function hasContent(profile) {
    const p = normalizeProfile(profile);
    return !!(p.resumeText || p.expertiseNotes || p.targetRole || p.languageLevel !== 'native' || p.extraInstructions);
}

/**
 * Builds the persona block for the system prompt. Returns '' when the persona is
 * disabled or empty so existing behaviour is untouched.
 */
function buildPersonaPromptBlock(profile) {
    const p = normalizeProfile(profile);
    if (!p.enabled || !hasContent(profile)) return '';

    const who = [p.displayName && `Name: ${p.displayName}`, p.targetRole && `Target role / interview context: ${p.targetRole}`]
        .filter(Boolean)
        .join('\n');

    const resume = p.resumeText.length > MAX_RESUME_CHARS
        ? p.resumeText.slice(0, MAX_RESUME_CHARS) + '\n[résumé truncated]'
        : p.resumeText;

    const sections = [];
    sections.push(`<persona>
You are helping THE USER answer in a live conversation (typically a job interview). Whenever the transcript ends with a question addressed to the user, produce the answer THE USER would say aloud: first person ("I"), natural spoken register, no meta commentary about being an assistant.
Keep the app's response structure (short headline, then the spoken answer in 1-3 short paragraphs or bullets the user can read while speaking).${who ? '\n' + who : ''}`);

    if (resume) {
        sections.push(`<resume>
${resume}
</resume>
Use concrete items from the résumé (roles, projects, tools, results, numbers) as examples whenever they fit the question. Prefer specific, story-like answers ("At <company> I…") over generic ones.`);
    }

    const mode = COMPETENCE_MODES[p.competenceMode];
    sections.push(`<competence_boundaries mode="${p.competenceMode}">
${mode.rules}${p.expertiseNotes ? `\nAdditional notes about what the user does and does not know:\n${p.expertiseNotes}` : ''}
</competence_boundaries>`);

    const level = LANGUAGE_LEVELS[p.languageLevel];
    if (p.languageLevel !== 'native' || p.answerLanguage) {
        sections.push(`<language>
${p.answerLanguage ? `Answer in ${p.answerLanguage}.\n` : ''}The user's proficiency in the answer language is CEFR ${p.languageLevel} (${level.label}). Write the spoken answer at exactly that level so it sounds like this person speaking:
${level.rules || '- Fluent, natural speech.'}
Do not mention the language level itself.
</language>`);
    } else {
        sections.push(`<language>\nAnswer in the language the question was asked in.\n</language>`);
    }

    if (p.extraInstructions) {
        sections.push(`<extra_instructions>\n${p.extraInstructions}\n</extra_instructions>`);
    }

    sections.push('</persona>');
    return sections.join('\n\n');
}

module.exports = {
    COMPETENCE_MODES,
    LANGUAGE_LEVELS,
    MAX_RESUME_CHARS,
    normalizeProfile,
    hasContent,
    buildPersonaPromptBlock,
};
