// customModels.js
// Main-process helper that lets users register additional models for any
// API-based provider without touching factory.js. Models are persisted in
// <userData>/custom-models.json with the following shape:
//
// {
//   "openai":    { "llmModels": [{ "id": "gpt-5.6-terra", "name": "GPT-5.6 Terra" }], "sttModels": [] },
//   "anthropic": { "llmModels": [{ "id": "claude-opus-4-8", "name": "Claude Opus 4.8" }] }
// }
//
// The file can be edited by hand (restart required) or through the Settings
// window ("Add custom model"), which calls addCustomModel()/removeCustomModel().

const fs = require('fs');
const path = require('path');

const FILE_NAME = 'custom-models.json';
const MODEL_LIST_KEYS = { llm: 'llmModels', stt: 'sttModels' };
// Local providers manage their own model catalogs.
const UNSUPPORTED_PROVIDERS = new Set(['ollama', 'whisper']);

function getFilePath() {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), FILE_NAME);
}

function loadCustomModels() {
    try {
        const filePath = getFilePath();
        if (!fs.existsSync(filePath)) return {};
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.error('[CustomModels] Failed to read custom-models.json:', error.message);
        return {};
    }
}

function saveCustomModels(data) {
    const filePath = getFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeEntry(entry) {
    if (!entry) return null;
    const id = typeof entry === 'string' ? entry : entry.id;
    if (!id || typeof id !== 'string' || !id.trim()) return null;
    const name = (typeof entry === 'object' && entry.name && String(entry.name).trim()) || id.trim();
    return { id: id.trim(), name, custom: true };
}

/**
 * Merges the persisted custom models into the shared PROVIDERS registry.
 * Safe to call multiple times: duplicates (by id) are skipped.
 */
function applyCustomModels(PROVIDERS, data = loadCustomModels()) {
    let added = 0;
    for (const [providerId, lists] of Object.entries(data)) {
        const provider = PROVIDERS[providerId];
        if (!provider || UNSUPPORTED_PROVIDERS.has(providerId) || !lists || typeof lists !== 'object') continue;

        for (const listKey of Object.values(MODEL_LIST_KEYS)) {
            const entries = Array.isArray(lists[listKey]) ? lists[listKey] : [];
            if (!Array.isArray(provider[listKey])) provider[listKey] = [];
            for (const raw of entries) {
                const model = normalizeEntry(raw);
                if (!model) continue;
                if (provider[listKey].some(m => m.id === model.id)) continue;
                provider[listKey].push(model);
                added++;
            }
        }
    }
    if (added > 0) console.log(`[CustomModels] Registered ${added} custom model(s).`);
    return added;
}

function addCustomModel(PROVIDERS, { provider, type, id, name }) {
    const listKey = MODEL_LIST_KEYS[type];
    if (!listKey) throw new Error(`Unknown model type: ${type}`);
    if (!PROVIDERS[provider]) throw new Error(`Unknown provider: ${provider}`);
    if (UNSUPPORTED_PROVIDERS.has(provider)) throw new Error(`Custom models are not supported for provider: ${provider}`);

    const model = normalizeEntry({ id, name });
    if (!model) throw new Error('Model id is required');

    const data = loadCustomModels();
    data[provider] = data[provider] || {};
    data[provider][listKey] = Array.isArray(data[provider][listKey]) ? data[provider][listKey] : [];

    if (!data[provider][listKey].some(m => (typeof m === 'string' ? m : m.id) === model.id)) {
        data[provider][listKey].push({ id: model.id, name: model.name });
        saveCustomModels(data);
    }

    applyCustomModels(PROVIDERS, { [provider]: { [listKey]: [model] } });
    return model;
}

function removeCustomModel(PROVIDERS, { provider, type, id }) {
    const listKey = MODEL_LIST_KEYS[type];
    if (!listKey || !PROVIDERS[provider]) return false;

    const data = loadCustomModels();
    const list = data[provider]?.[listKey];
    if (Array.isArray(list)) {
        data[provider][listKey] = list.filter(m => (typeof m === 'string' ? m : m.id) !== id);
        saveCustomModels(data);
    }

    const models = PROVIDERS[provider][listKey];
    const index = models.findIndex(m => m.id === id && m.custom);
    if (index === -1) return false;
    models.splice(index, 1);
    return true;
}

module.exports = {
    FILE_NAME,
    getFilePath,
    loadCustomModels,
    applyCustomModels,
    addCustomModel,
    removeCustomModel,
};
