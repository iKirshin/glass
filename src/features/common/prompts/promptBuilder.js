const { profilePrompts } = require('./promptTemplates.js');

function buildSystemPrompt(promptParts, customPrompt = '', googleSearchEnabled = true, personaBlock = '') {
    const sections = [promptParts.intro, '\n\n', promptParts.formatRequirements];

    // Persona (résumé, competence limits, language level) takes priority over the
    // generic instructions but comes before the conversation context.
    if (personaBlock) {
        sections.push('\n\n', personaBlock);
    }

    if (googleSearchEnabled) {
        sections.push('\n\n', promptParts.searchUsage);
    }

    sections.push('\n\n', promptParts.content, '\n\nUser-provided context\n-----\n', customPrompt, '\n-----\n\n', promptParts.outputInstructions);

    return sections.join('');
}

function getSystemPrompt(profile, customPrompt = '', googleSearchEnabled = true, personaBlock = '') {
    const promptParts = profilePrompts[profile] || profilePrompts.interview;
    return buildSystemPrompt(promptParts, customPrompt, googleSearchEnabled, personaBlock);
}

module.exports = {
    getSystemPrompt,
};
