// Run with: ./node_modules/.bin/electron tests/persona-profile.smoke.cjs
// Uses an isolated profile and fake IPC; never opens the user's database or calls an AI provider.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inpro-persona-smoke-'));
app.setPath('userData', path.join(outputDir, 'user-data'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        width: 580, height: 740, show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    });
    try {
        const bundle = await esbuild.build({
            entryPoints: [path.join(__dirname, '../src/ui/persona/PersonaView.js')],
            bundle: true, format: 'iife', write: false, platform: 'browser',
        });
        await win.loadURL('data:text/html,<html><head><style>html,body{margin:0;height:100%;background:%23141414}</style></head><body></body></html>');
        await win.webContents.executeJavaScript(`
            window.savedProfile = {
                enabled: 1, resume_text: 'Example Co: improved onboarding completion from 50% to 60%.',
                competence_mode: 'balanced', language_level: 'B2', answer_language: 'English',
                extra_instructions: 'Use confirmed facts.', job_description: '', case_studies: 'Original confirmed case'
            };
            window.api = { personaView: {
                getOptions: async () => ({
                    competenceModes: [{ id: 'balanced', label: 'Balanced' }],
                    languageLevels: [{ id: 'B2', label: 'B2' }],
                    maxResumeChars: 40000, maxJobDescriptionChars: 20000, maxCaseStudiesChars: 30000,
                    supportedExtensions: ['txt', 'md']
                }),
                getProfile: async () => ({ ...window.savedProfile }),
                saveProfile: async profile => {
                    window.savedProfile = { ...window.savedProfile, job_description: profile.jobDescription, case_studies: profile.caseStudies, resume_text: profile.resumeText };
                    return { success: true, profile: window.savedProfile };
                },
                importCasesFile: async () => ({ success: true, fileName: 'cases.md', text: 'Imported confirmed case', truncated: false }),
                optimizeResume: async () => ({ success: true, text: 'Condensed résumé', before: 500, after: 16, model: 'test' }),
                closeWindow() { window.closeRequested = true; }
            }};
            void 0;
        `);
        await win.webContents.executeJavaScript(bundle.outputFiles[0].text + '\nvoid 0;');
        const result = await win.webContents.executeJavaScript(`(async () => {
            const view = document.createElement('persona-view');
            document.body.append(view);
            await view.updateComplete;
            await Promise.resolve();
            await view.updateComplete;
            const field = view.shadowRoot.querySelector('#job-description');
            if (!field) throw new Error('Job description field missing');
            const casesField = view.shadowRoot.querySelector('#case-studies');
            if (!casesField) throw new Error('Interview cases field missing');
            const loadedCases = casesField.value === 'Original confirmed case';
            const casesLabel = view.shadowRoot.querySelector('label[for="case-studies"]');
            const casesAccessible = !!casesLabel && casesField.getAttribute('aria-describedby').includes('case-studies-hint');
            const cases = 'Confirmed case: Example Co onboarding\\nEvidence: funnel drop-off. My decision: simplify the quiz. Result: 50% to 60%. Unknown: test dates.';
            casesField.value = cases;
            casesField.dispatchEvent(new Event('input', { bubbles: true }));
            const vacancy = 'Product Manager — subscriptions\\nImprove onboarding and retention. Work with Engineering and Analytics.';
            field.value = vacancy;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            await view.updateComplete;
            const editable = view.profile.jobDescription === vacancy && view.profile.caseStudies === cases && view.dirty;
            const saveEnabled = !view.shadowRoot.querySelector('.footer .primary').disabled;
            await view.handleSave();
            await view.updateComplete;
            const saved = window.savedProfile.job_description === vacancy && window.savedProfile.case_studies === cases && !view.dirty;
            view.remove();
            const restored = document.createElement('persona-view');
            document.body.append(restored);
            await restored.updateComplete;
            await Promise.resolve();
            await restored.updateComplete;
            const reloaded = restored.shadowRoot.querySelector('#job-description').value === vacancy && restored.shadowRoot.querySelector('#case-studies').value === cases;
            await restored.handleOptimize();
            const optimizationPreservedCases = restored.profile.caseStudies === cases && restored.profile.resumeText === 'Condensed résumé';
            restored.handleUndoOptimize();
            const undoPreservedCases = restored.profile.caseStudies === cases;
            window.confirm = () => false;
            await restored.handleImportCasesFile();
            const canceledReplacementPreservedCases = restored.profile.caseStudies === cases;
            restored.handleClose();
            const unsavedCloseProtected = !window.closeRequested;
            window.confirm = () => true;
            await restored.handleImportCasesFile();
            const imported = restored.profile.caseStudies === 'Imported confirmed case' && window.savedProfile.case_studies === cases && restored.dirty;
            const saveProfile = window.api.personaView.saveProfile;
            window.api.personaView.saveProfile = async () => ({ success: false, error: 'Fixture save error' });
            await restored.handleSave();
            const saveErrorPreservedText = restored.dirty && restored.profile.caseStudies === 'Imported confirmed case' && restored.status.kind === 'error';
            window.api.personaView.saveProfile = saveProfile;
            await restored.handleSave();
            const importSaved = window.savedProfile.case_studies === 'Imported confirmed case';
            restored._update('caseStudies', 'x'.repeat(30001));
            await restored.updateComplete;
            const casesWarning = restored.shadowRoot.querySelector('#case-studies-limit').textContent.includes('Only the first');
            restored._update('caseStudies', '');
            await restored.handleSave();
            const casesCleared = window.savedProfile.case_studies === '' && !!window.savedProfile.resume_text;
            restored._update('jobDescription', 'x'.repeat(20001));
            await restored.updateComplete;
            const warning = restored.shadowRoot.textContent.includes('The full text is saved.');
            restored._update('jobDescription', '');
            await restored.handleSave();
            const cleared = window.savedProfile.job_description === '';
            // Leave a representative populated form for the screenshot, without saving it.
            restored._update('jobDescription', vacancy);
            restored._update('caseStudies', cases);
            await restored.updateComplete;
            restored.shadowRoot.querySelector('#case-studies').scrollIntoView({ block: 'center' });
            const footer = restored.shadowRoot.querySelector('.footer').getBoundingClientRect();
            const noHorizontalOverflow = restored.shadowRoot.querySelector('.scroll-area').scrollWidth <= restored.clientWidth;
            return { loadedCases, casesAccessible, editable, saveEnabled, saved, reloaded, warning, cleared,
                optimizationPreservedCases, undoPreservedCases, canceledReplacementPreservedCases, unsavedCloseProtected,
                imported, saveErrorPreservedText, importSaved, casesWarning, casesCleared,
                footerVisible: footer.bottom <= innerHeight, noHorizontalOverflow };
        })()`);
        for (const [name, passed] of Object.entries(result)) assert.equal(passed, true, name);
        win.showInactive();
        await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const screenshot = path.join(outputDir, 'persona-profile.png');
        fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
        console.log(JSON.stringify({ checks: result, screenshot }, null, 2));
        win.destroy();
        app.exit(0);
    } catch (error) {
        console.error(error);
        win.destroy();
        app.exit(1);
    }
});
