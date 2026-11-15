// Actual renderer components, isolated userData and mock IPC. No recording or AI calls.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');
const { LANGUAGE_LEVELS } = require('../src/features/common/prompts/personaPrompt');
const { STT_LANGUAGES } = require('../src/features/common/config/sttLanguages');
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inpro-language-ui-'));
app.setPath('userData', path.join(outputDir, 'profile'));
app.disableHardwareAcceleration();
const timeout = setTimeout(() => app.exit(1), 30000);

app.whenReady().then(async () => {
    const win = new BrowserWindow({ width: 480, height: 700, show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    try {
        await win.loadURL('data:text/html,<html><head><style>body{margin:0;background:%23141414}</style></head><body></body></html>');
        await win.webContents.executeJavaScript(`
            window.savedProfile = { enabled: 1, resume_text: 'Keep my real experience', case_studies: 'Keep my cases', language_level: 'B2', answer_language: 'English' };
            window.recognitionLanguage = 'multi';
            window.failLanguageSave = false;
            window.api = {
                settingsView: {
                    getSttLanguage: async () => window.recognitionLanguage,
                    setSttLanguage: async language => {
                        if (window.failLanguageSave) return { success: false, error: 'Test save failure' };
                        window.recognitionLanguage = language; return { success: true, language };
                    }
                },
                personaView: {
                    getOptions: async () => ({ competenceModes: [{ id:'balanced',label:'Balanced' }], languageLevels: ${JSON.stringify(Object.entries(LANGUAGE_LEVELS).map(([id, l]) => ({ id, label:l.label })))}, maxKnownLanguages:12 }),
                    getProfile: async () => window.savedProfile,
                    saveProfile: async profile => {
                        window.savedProfile = Object.fromEntries(Object.entries(profile).map(([key,value]) => [key.replace(/[A-Z]/g, m => '_' + m.toLowerCase()), value]));
                        return { success:true, profile:window.savedProfile };
                    }
                }
            }; void 0;
        `);
        for (const component of ['persona/PersonaView.js', 'settings/SettingsView.js']) {
            const bundle = await esbuild.build({ entryPoints: [path.join(__dirname, '../src/ui', component)], bundle:true, format:'iife', platform:'browser', write:false });
            await win.webContents.executeJavaScript(bundle.outputFiles[0].text + '\nvoid 0;');
        }
        const result = await win.webContents.executeJavaScript(`(async () => {
            const mountProfile = async () => {
                const v = document.createElement('persona-view'); document.body.append(v);
                await v.updateComplete; await Promise.resolve(); await v.updateComplete; return v;
            };
            const view = await mountProfile();
            const set = async (id, value, type='change') => {
                const field = view.shadowRoot.querySelector('#' + id);
                field.value = value; field.dispatchEvent(new Event(type, { bubbles:true })); await view.updateComplete;
            };
            const legacyPreserved = view.profile.knownLanguages[0].language === 'English' && view.profile.knownLanguages[0].level === 'B2' && view.profile.answerLanguageMode === 'fixed';
            await set('answer-language-mode','question');
            const fixedHidden = !view.shadowRoot.querySelector('#answer-language');
            [...view.shadowRoot.querySelectorAll('button')].find(b => b.textContent.trim() === 'Add language').click();
            await view.updateComplete;
            await set('known-language-1','Russian','input'); await set('known-level-1','native');
            await view.handleSave(); await view.updateComplete;
            const saved = !view.dirty && window.savedProfile.answer_language_mode === 'question' && window.savedProfile.known_languages[1].level === 'native';
            const unchangedContext = window.savedProfile.resume_text === 'Keep my real experience' && window.savedProfile.case_studies === 'Keep my cases';
            view.remove(); const restored = await mountProfile();
            const reloaded = restored.profile.answerLanguageMode === 'question' && restored.profile.knownLanguages.length === 2;
            restored.shadowRoot.querySelector('[aria-label="Remove language 2"]').click(); await restored.updateComplete;
            const removed = restored.profile.knownLanguages.length === 1 && restored.dirty;
            restored.remove();
            const Settings = customElements.get('settings-view');
            // Only window lifecycle / unrelated account loading is replaced; render and language handlers are real.
            for (const method of ['setupEventListeners','setupIpcListeners','setupWindowResize','loadAutoUpdateSetting','updateScrollHeight','cleanupEventListeners','cleanupIpcListeners','cleanupWindowResize']) Settings.prototype[method] = () => {};
            Settings.prototype.loadInitialData = async function() { this.isLoading=false; await this.loadSttLanguageSetting(); };
            const settings = document.createElement('settings-view'); document.body.append(settings);
            await settings.updateComplete; await Promise.resolve(); await settings.updateComplete;
            const select = settings.shadowRoot.querySelector('#stt-language');
            const catalogCount = select.options.length;
            for (const code of ['ru','uk','pt-PT','zh-Hant','ar-SA','multi']) {
                select.value = code; await settings.handleSttLanguageChange({target:select}); await settings.updateComplete;
                if (window.recognitionLanguage !== code || settings.sttLanguage !== code) throw new Error('Language not saved: ' + code);
            }
            window.failLanguageSave = true; select.value = 'ru';
            await settings.handleSttLanguageChange({target:select}); await settings.updateComplete;
            const failedSavePreservesChoice = settings.sttLanguage === 'multi' && select.value === 'multi' && settings.sttLanguageStatus.includes('failure');
            const panel = settings.shadowRoot.querySelector('.settings-container');
            const noOverflow = select.getBoundingClientRect().right <= settings.getBoundingClientRect().right + 1 && panel.scrollWidth <= panel.clientWidth;
            return { legacyPreserved,fixedHidden,saved,unchangedContext,reloaded,removed,catalogCount,failedSavePreservesChoice,noOverflow };
        })()`);
        console.log(JSON.stringify(result));
        for (const [key,value] of Object.entries(result)) if (typeof value === 'boolean') assert.equal(value,true,key);
        assert.equal(result.catalogCount, STT_LANGUAGES.length);
        fs.writeFileSync(path.join(outputDir, 'recognition-settings.png'), (await win.webContents.capturePage()).toPNG());
        console.log('Screenshot: ' + outputDir);
        clearTimeout(timeout); win.destroy(); app.exit(0);
    } catch(error) { console.error(error); clearTimeout(timeout); win.destroy(); app.exit(1); }
});
