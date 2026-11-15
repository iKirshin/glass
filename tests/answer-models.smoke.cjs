// Real Settings renderer, isolated userData and mock IPC. No saved keys or AI calls.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');
const { PROVIDERS } = require('../src/features/common/ai/factory');
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inpro-answer-models-ui-'));
app.setPath('userData', path.join(outputDir, 'profile'));
app.disableHardwareAcceleration();
const timeout = setTimeout(() => app.exit(1), 30000);

app.whenReady().then(async () => {
    const win = new BrowserWindow({ width: 480, height: 700, show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    try {
        await win.loadURL('data:text/html,<html><head><style>html,body{height:100%;overflow:hidden}body{margin:0;background:%23141414}</style></head><body></body></html>');
        await win.webContents.executeJavaScript(`window.api = { settingsView: {} }; void 0;`);
        const bundle = await esbuild.build({ entryPoints: [path.join(__dirname, '../src/ui/settings/SettingsView.js')], bundle: true, format: 'iife', platform: 'browser', write: false });
        await win.webContents.executeJavaScript(bundle.outputFiles[0].text + '\nvoid 0;');
        const catalog = Object.values(PROVIDERS).flatMap(p => p.llmModels).filter(m => !m.legacy || m.id === 'gpt-5.6-luna');
        const result = await win.webContents.executeJavaScript(`(async () => {
            const Settings = customElements.get('settings-view');
            for (const method of ['setupEventListeners','setupIpcListeners','setupWindowResize','loadAutoUpdateSetting','updateScrollHeight','cleanupEventListeners','cleanupIpcListeners','cleanupWindowResize']) Settings.prototype[method] = () => {};
            Settings.prototype.loadInitialData = async function() {
                this.isLoading = false;
                this.providerConfig = ${JSON.stringify(PROVIDERS)};
                this.availableLlmModels = ${JSON.stringify(catalog)};
                this.selectedLlm = 'gpt-5.6-luna';
                this.isLlmListVisible = true;
            };
            const view = document.createElement('settings-view'); document.body.append(view);
            await view.updateComplete; await Promise.resolve(); await view.updateComplete;
            const root = view.shadowRoot;
            const items = [...root.querySelectorAll('.model-item')];
            const priceFor = name => items.find(el => el.textContent.includes(name)).querySelector('.model-price');
            const selected = root.querySelector('.model-item.selected');
            const prices = items.map(el => el.querySelector('.model-price')?.textContent);
            const panel = root.querySelector('.settings-container');
            const defaults = {
                unchangedSelection: view.selectedLlm === 'gpt-5.6-luna',
                legacyLabel: selected.textContent.includes('предыдущая'),
                currentCount: items.length === 12,
                correctFormat: prices.every(text => /^\\$[0-9.]+ \\/ \\$[0-9.]+ per 1M$/.test(text)),
                lowPrice: priceFor('GPT-6 Luna').textContent === '$0.1 / $0.5 per 1M',
                opusPrice: priceFor('Claude Opus 5.5').textContent === '$4 / $20 per 1M',
                promotionNote: priceFor('Gemini 4 Argon').title.includes('2026-12-01'),
                contextNote: priceFor('Claude Haiku 5.5').title.includes('100K'),
                priceDate: priceFor('GPT-6.1 Terra').title.includes('2026-11-14'),
                hydrogenPrice: priceFor('Gemini 4 Hydrogen').textContent === '$1.5 / $7.5 per 1M',
                source: priceFor('GPT-6 Luna').title.includes('https://developers.openai.com/api/docs/pricing'),
                noInventedCustomPrice: view.formatModelPricing({ id: 'custom' }) === '',
                sttFormat: view.formatModelPricing({ pricing: { perMinute: 0.0048 } }) === '$0.0048/min',
                localFormat: view.formatModelPricing({ pricing: { free: true } }) === 'free · local',
                noOverflow: panel.scrollWidth <= panel.clientWidth && items.every(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= window.innerWidth),
            };
            root.querySelector('.model-list').scrollTop = 0;
            panel.scrollTop = root.querySelector('.model-selection-section').offsetTop - 12;
            await new Promise(resolve => requestAnimationFrame(resolve));
            const bounds = root.querySelector('.model-list').getBoundingClientRect();
            defaults.listVisible = bounds.top >= 0 && bounds.bottom <= window.innerHeight;
            return defaults;
        })()`);
        console.log(JSON.stringify(result));
        for (const [key, value] of Object.entries(result)) assert.equal(value, true, key);
        // Let the hidden window composite the scrolled content before capturing it.
        await new Promise(resolve => setTimeout(resolve, 200));
        fs.writeFileSync(path.join(outputDir, 'answer-models.png'), (await win.webContents.capturePage()).toPNG());
        console.log('Screenshot: ' + path.join(outputDir, 'answer-models.png'));
        clearTimeout(timeout); win.destroy(); app.exit(0);
    } catch (error) {
        console.error(error); clearTimeout(timeout); win.destroy(); app.exit(1);
    }
});
