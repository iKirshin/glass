// personaService.js
// Owns the user's persona profile: résumé text, competence boundaries and language
// level. Exposes the prompt block used by AskService and the résumé file import.

const { dialog, BrowserWindow } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const personaRepository = require('./repositories');
const internalBridge = require('../../bridge/internalBridge');
const {
    buildPersonaPromptBlock,
    normalizeProfile,
    COMPETENCE_MODES,
    LANGUAGE_LEVELS,
    MAX_RESUME_CHARS,
} = require('../common/prompts/personaPrompt');

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'markdown', 'json', 'csv'];

function toRow(profile = {}) {
    const p = normalizeProfile(profile);
    return {
        enabled: p.enabled ? 1 : 0,
        display_name: p.displayName,
        target_role: p.targetRole,
        resume_text: p.resumeText.slice(0, MAX_RESUME_CHARS * 2),
        resume_file_name: (profile.resume_file_name || profile.resumeFileName || '').trim() || null,
        competence_mode: p.competenceMode,
        expertise_notes: p.expertiseNotes,
        language_level: p.languageLevel,
        answer_language: p.answerLanguage,
        extra_instructions: p.extraInstructions,
    };
}

async function extractTextFromFile(filePath) {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_FILE_BYTES) {
        throw new Error(`File is too large (${Math.round(stat.size / 1024 / 1024)} MB). Limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
    }
    const buffer = await fs.readFile(filePath);

    if (ext === 'pdf') {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text || '';
    }
    if (ext === 'docx') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
    }
    if (SUPPORTED_EXTENSIONS.includes(ext)) {
        return buffer.toString('utf8');
    }
    throw new Error(`Unsupported file type: .${ext}. Use PDF, DOCX, TXT or Markdown.`);
}

function cleanupText(text) {
    return String(text || '')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

class PersonaService {
    async getProfile() {
        try {
            return personaRepository.getProfile();
        } catch (error) {
            console.error('[PersonaService] getProfile failed:', error);
            return null;
        }
    }

    async saveProfile(profile) {
        const saved = personaRepository.saveProfile(toRow(profile));
        console.log(`[PersonaService] Profile saved (résumé ${saved?.resume_text?.length || 0} chars, mode=${saved?.competence_mode}, level=${saved?.language_level})`);
        internalBridge.emit('persona:updated', saved);
        return saved;
    }

    async deleteProfile() {
        const removed = personaRepository.deleteProfile();
        internalBridge.emit('persona:updated', null);
        return removed;
    }

    /** System-prompt block for the current profile, '' when disabled or empty. */
    async getPromptBlock() {
        try {
            const profile = await this.getProfile();
            return buildPersonaPromptBlock(profile);
        } catch (error) {
            console.error('[PersonaService] Failed to build persona prompt block:', error);
            return '';
        }
    }

    getOptions() {
        return {
            competenceModes: Object.entries(COMPETENCE_MODES).map(([id, m]) => ({ id, label: m.label })),
            languageLevels: Object.entries(LANGUAGE_LEVELS).map(([id, l]) => ({ id, label: l.label })),
            maxResumeChars: MAX_RESUME_CHARS,
            supportedExtensions: SUPPORTED_EXTENSIONS,
        };
    }

    /** Opens a file picker and returns the extracted résumé text (does not save). */
    async importResumeFile() {
        const parent = BrowserWindow.getFocusedWindow() || undefined;
        const result = await dialog.showOpenDialog(parent, {
            title: 'Choose your résumé',
            properties: ['openFile'],
            filters: [
                { name: 'Documents', extensions: SUPPORTED_EXTENSIONS },
                { name: 'All Files', extensions: ['*'] },
            ],
        });
        if (result.canceled || !result.filePaths?.length) {
            return { success: false, canceled: true };
        }
        const filePath = result.filePaths[0];
        try {
            const text = cleanupText(await extractTextFromFile(filePath));
            if (!text) {
                return { success: false, error: 'No text could be extracted from this file (scanned PDF?). Paste the text manually.' };
            }
            return {
                success: true,
                text,
                fileName: path.basename(filePath),
                truncated: text.length > MAX_RESUME_CHARS,
            };
        } catch (error) {
            console.error('[PersonaService] importResumeFile failed:', error);
            return { success: false, error: error.message };
        }
    }

    openWindow() {
        internalBridge.emit('window:requestVisibility', { name: 'persona', visible: true });
        return { success: true };
    }

    closeWindow() {
        internalBridge.emit('window:requestVisibility', { name: 'persona', visible: false });
        return { success: true };
    }
}

module.exports = new PersonaService();
module.exports.extractTextFromFile = extractTextFromFile;
module.exports.cleanupText = cleanupText;
