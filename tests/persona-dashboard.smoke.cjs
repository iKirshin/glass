// Run after npm run build:web:
// env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/persona-dashboard.smoke.cjs
// Mounts the real React page with a fake local API; no user data or AI requests.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');

const webRoot = path.join(__dirname, '../pickleglass_web');
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inpro-dashboard-smoke-'));
app.setPath('userData', path.join(outputDir, 'user-data'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        width: 1100, height: 900, show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    });
    try {
        const bundle = await esbuild.build({
            stdin: {
                contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
                    import Page from './app/personalize/page';
                    window.mountProfile = () => {
                        window.profileRoot = createRoot(document.getElementById('root'));
                        window.profileRoot.render(<Page />);
                    }; window.mountProfile();`,
                resolveDir: webRoot, loader: 'tsx',
            },
            bundle: true, format: 'iife', platform: 'browser', write: false,
            jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
            plugins: [{ name: 'mock-persona-api', setup(build) {
                build.onResolve({ filter: /^@\/utils\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }));
                build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
                    contents: `
                        export const getPersona = async () => ({ ...window.savedProfile });
                        export const getPersonaOptions = async () => ({
                            competenceModes: [{ id: 'balanced', label: 'Balanced' }],
                            languageLevels: [{ id: 'B2', label: 'B2' }, { id: 'native', label: 'Native' }],
                            maxResumeChars: 40000, maxJobDescriptionChars: 20000, maxCaseStudiesChars: 30000
                        });
                        export const savePersona = async form => {
                            if (window.failSave) throw new Error('Fixture save error');
                            window.savedProfile = { ...window.savedProfile, job_description: form.jobDescription,
                                case_studies: form.caseStudies, resume_text: form.resumeText,
                                known_languages: form.knownLanguages, answer_language_mode: form.answerLanguageMode };
                            window.saveCount = (window.saveCount || 0) + 1;
                            return { ...window.savedProfile };
                        };
                        export const deletePersona = async () => { window.savedProfile = null; };
                    `,
                }));
            } }],
        });
        await win.loadURL('data:text/html,<html><body><div id="root"></div></body></html>');
        const cssDir = path.join(webRoot, 'out/_next/static/css');
        const cssFiles = fs.readdirSync(cssDir).filter(name => name.endsWith('.css'));
        for (const name of cssFiles) await win.webContents.insertCSS(fs.readFileSync(path.join(cssDir, name), 'utf8'));
        await win.webContents.executeJavaScript(`window.savedProfile = {
            enabled: 1, resume_text: 'Original résumé', job_description: 'Original vacancy', case_studies: 'Original case',
            competence_mode: 'balanced', language_level: 'B2', answer_language: 'English', extra_instructions: 'Use facts.'
        }; window.confirm = () => true; void 0;`);
        await win.webContents.executeJavaScript(bundle.outputFiles[0].text + '\nvoid 0;');
        const result = await win.webContents.executeJavaScript(`(async () => {
            const waitFor = async check => {
                for (let i=0; i<200; i++) {
                    if (check()) return;
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                throw new Error('Timed out waiting for dashboard update');
            };
            const field = id => document.getElementById(id);
            const save = () => [...document.querySelectorAll('button')].find(b => /^Sav(e|ing)/.test(b.textContent.trim()));
            const setText = async (id, value) => {
                Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field(id), value);
                field(id).dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 0));
            };
            await waitFor(() => field('case-studies'));
            const loaded = field('case-studies').value === 'Original case' && field('job-description').value === 'Original vacancy';
            const labelled = !!document.querySelector('label[for="case-studies"]') && field('case-studies').getAttribute('aria-describedby').includes('case-studies-hint');
            const changeField = async (id, value, prototype, event) => {
                Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field(id), value);
                field(id).dispatchEvent(new Event(event, { bubbles:true }));
                await new Promise(resolve => setTimeout(resolve,0));
            };
            const legacyLanguagePreserved = field('known-language-0').value === 'English' && field('known-level-0').value === 'B2';
            await changeField('answer-language-mode','question',HTMLSelectElement.prototype,'change');
            [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Add language').click();
            await waitFor(() => field('known-language-1'));
            await changeField('known-language-1','Russian',HTMLInputElement.prototype,'input');
            await changeField('known-level-1','native',HTMLSelectElement.prototype,'change');
            await setText('job-description', 'New vacancy');
            await setText('case-studies', 'New confirmed case with evidence and limitations.');
            const editable = !save().disabled;
            save().click();
            await waitFor(() => window.saveCount === 1);
            const saved = window.savedProfile.case_studies === 'New confirmed case with evidence and limitations.' && window.savedProfile.job_description === 'New vacancy';
            window.profileRoot.unmount(); window.mountProfile();
            await waitFor(() => field('case-studies'));
            const reloaded = field('case-studies').value === window.savedProfile.case_studies;
            const languagesReloaded = field('answer-language-mode').value === 'question' && !field('answer-language') && field('known-language-1').value === 'Russian' && field('known-level-1').value === 'native';
            await setText('case-studies', 'x'.repeat(30001));
            const warning = field('case-studies-limit').textContent.includes('Only the first');
            await setText('case-studies', '');
            save().click(); await waitFor(() => window.saveCount === 2);
            const cleared = window.savedProfile.case_studies === '' && window.savedProfile.resume_text === 'Original résumé';
            const files = new DataTransfer();
            files.items.add(new File(['Imported case: facts, decisions, outcomes.'], 'cases.md', { type: 'text/markdown' }));
            const input = [...document.querySelectorAll('input[type="file"]')][1];
            input.files = files.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            await waitFor(() => field('case-studies').value.startsWith('Imported case:'));
            const importedNotSaved = window.savedProfile.case_studies === '' && !save().disabled;
            window.failSave = true; save().click();
            await waitFor(() => document.querySelector('[role="status"]')?.textContent.includes('Fixture save error'));
            const errorPreserved = field('case-studies').value.startsWith('Imported case:') && !save().disabled;
            window.failSave = false; save().click(); await waitFor(() => window.saveCount === 3);
            await waitFor(() => save().disabled);
            const importSaved = window.savedProfile.case_studies.startsWith('Imported case:');
            const uploads = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('Load'));
            const uploadTextReadable = uploads.length === 2 && uploads.every(button => {
                const rgb = getComputedStyle(button).color.match(/[0-9.]+/g).slice(0, 3).map(Number);
                const linear = rgb.map(value => value / 255 <= 0.04045 ? value / 255 / 12.92 : Math.pow((value / 255 + 0.055) / 1.055, 2.4));
                const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
                return 1.05 / (luminance + .05) >= 4.5;
            });
            field('case-studies').scrollIntoView({ block: 'center' });
            return { loaded, labelled, editable, saved, reloaded, legacyLanguagePreserved, languagesReloaded, warning, cleared, importedNotSaved, errorPreserved, importSaved, uploadTextReadable,
                noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth };
        })()`);
        for (const [name, passed] of Object.entries(result)) assert.equal(passed, true, name);
        win.showInactive();
        await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const screenshot = path.join(outputDir, 'persona-dashboard.png');
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
