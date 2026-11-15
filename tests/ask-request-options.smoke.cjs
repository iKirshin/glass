// Run: env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/ask-request-options.smoke.cjs
// Real Ask renderer and preload, isolated userData, fixture IPC. No provider, résumé or screen access.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inpro-ask-options-smoke-'));
app.setPath('userData', path.join(outputDir, 'user-data'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    const win = new BrowserWindow({ width: 600, height: 160, show: false,
        webPreferences: { preload: path.join(__dirname, '../src/preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    });
    const requests = [];
    const errors = [];
    let requestedHeight = 0;
    const state = { attachScreen: false, includePersonalContext: true, isLoading: false, isStreaming: false,
        currentResponse: '', currentQuestion: '', showTextInput: true };
    const options = () => ({ attachScreen: state.attachScreen, includePersonalContext: state.includePersonalContext });
    const broadcast = () => win.webContents.send('ask:stateUpdate', { ...state });
    ipcMain.handle('ask:getRequestOptions', options);
    ipcMain.handle('ask:setRequestOptions', (_event, values) => { Object.assign(state, values); return options(); });
    ipcMain.handle('ask:sendQuestionFromAsk', (_event, text, values) => {
        requests.push({ text, ...values });
        Object.assign(state, values, { currentQuestion: text, isLoading: true, showTextInput: false });
        broadcast();
        return { success: true };
    });
    ipcMain.handle('ask:clearResponse', () => {
        Object.assign(state, { isLoading: false, isStreaming: false, currentQuestion: '', currentResponse: '', showTextInput: true });
        broadcast();
        return { success: true };
    });
    ipcMain.handle('ask:closeAskWindow', () => ({ success: true }));
    ipcMain.handle('adjust-window-height', (_event, values) => {
        assert.equal(values.winName, 'ask');
        requestedHeight = values.height;
    });
    win.webContents.on('console-message', event => {
        if (event.level === 'error') errors.push(event.message);
    });
    try {
        const bundle = await esbuild.build({ entryPoints: [path.join(__dirname, '../src/ui/ask/AskView.js')],
            bundle: true, format: 'iife', write: false, platform: 'browser' });
        async function loadView() {
            await win.loadURL('data:text/html,<html><head><style>html,body{margin:0;background:%23141414}</style></head><body></body></html>');
            for (const asset of ['marked-4.3.0.min.js', 'highlight-11.9.0.min.js', 'dompurify-3.0.7.min.js']) {
                await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, '../src/ui/assets', asset), 'utf8') + '\nvoid 0;');
            }
            await win.webContents.executeJavaScript(bundle.outputFiles[0].text + '\nvoid 0;');
            await win.webContents.executeJavaScript(`(async () => {
                window.view = document.createElement('ask-view');
                document.body.append(view);
                window.settle = async () => {
                    await window.api.askView.getRequestOptions();
                    await view.updateComplete;
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    await view.updateComplete;
                };
                await settle();
            })()`);
        }
        await loadView();
        const initial = await win.webContents.executeJavaScript(`(() => {
            const inputs = [...view.shadowRoot.querySelectorAll('input[type="checkbox"]')];
            return {
                defaults: inputs.length === 2 && !inputs[0].checked && inputs[1].checked,
                labels: inputs[0].labels[0].textContent.includes('Прикрепить экран') && inputs[1].labels[0].textContent.includes('Использовать резюме, кейсы и вакансию'),
                noScreenHint: !view.shadowRoot.querySelector('#textInput').placeholder.includes('screen'),
            };
        })()`);
        for (const [name, passed] of Object.entries(initial)) assert.equal(passed, true, name);
        await win.webContents.executeJavaScript(`(async () => {
            view.shadowRoot.querySelector('[name="attachScreen"]').labels[0].click();
            view.shadowRoot.querySelector('[name="includePersonalContext"]').labels[0].click();
            await settle();
            view.shadowRoot.querySelector('#textInput').value = 'Fixture submit question';
            view.shadowRoot.querySelector('.submit-btn').click();
            await settle();
        })()`);
        assert.deepEqual(requests[0], { text: 'Fixture submit question', attachScreen: true, includePersonalContext: false });
        assert.equal(await win.webContents.executeJavaScript('view.shadowRoot.querySelector(".text-input-container").inert'), true);
        await win.webContents.executeJavaScript('(async () => { await view.handleClearResponse(); await settle(); })()');
        const afterClear = await win.webContents.executeJavaScript(`({
            choicesKept: view.attachScreen && !view.includePersonalContext,
            inputRestored: !view.shadowRoot.querySelector('.text-input-container').inert,
        })`);
        assert.ok(afterClear.choicesKept && afterClear.inputRestored);
        await win.webContents.executeJavaScript(`(async () => {
            view.shadowRoot.querySelector('[name="attachScreen"]').click();
            const input = view.shadowRoot.querySelector('#textInput');
            input.value = 'Fixture Enter question';
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            await settle();
        })()`);
        assert.deepEqual(requests[1], { text: 'Fixture Enter question', attachScreen: false, includePersonalContext: false });
        await win.webContents.executeJavaScript('(async () => { await view.handleClearResponse(); await settle(); })()');
        win.webContents.send('ask:stateUpdate', { ...state, attachScreen: true, includePersonalContext: true });
        await win.webContents.executeJavaScript('settle()');
        assert.equal(await win.webContents.executeJavaScript('!view.attachScreen && !view.includePersonalContext'), true, 'stale stream state must not undo checkbox changes');
        await loadView();
        assert.equal(await win.webContents.executeJavaScript('!view.attachScreen && !view.includePersonalContext'), true, 'choices survive renderer reload');

        // Both normal and narrow window widths must fit the extra row in the measured height.
        for (const width of [600, 400]) {
            win.setContentSize(width, 180);
            await win.webContents.executeJavaScript('(async () => { view.adjustWindowHeight(); await settle(); })()');
            assert.ok(requestedHeight > 60 && requestedHeight <= 180);
            win.setContentSize(width, Math.ceil(requestedHeight));
            const layout = await win.webContents.executeJavaScript(`(async () => {
                await settle();
                const row = view.shadowRoot.querySelector('.request-options');
                return { visible: row.getBoundingClientRect().bottom <= innerHeight,
                    fits: row.scrollWidth <= row.clientWidth && document.body.scrollWidth <= innerWidth };
            })()`);
            assert.ok(layout.visible && layout.fits, 'checkbox row fits at width ' + width);
        }
        win.setContentSize(600, 180);
        await win.webContents.executeJavaScript(`(async () => {
            view.shadowRoot.querySelector('[name="includePersonalContext"]').click();
            view.adjustWindowHeight();
            await settle();
        })()`);
        win.setContentSize(600, Math.ceil(requestedHeight));
        win.showInactive();
        await win.webContents.executeJavaScript('settle()');
        const screenshot = path.join(outputDir, 'ask-request-options.png');
        fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ passed: true, checks: ['defaults', 'labels', 'Submit', 'Enter', 'clear', 'stale updates', 'renderer reload', '600px and 400px layout'], screenshot }, null, 2));
        win.destroy();
        app.exit(0);
    } catch (error) {
        console.error(error);
        win.destroy();
        app.exit(1);
    }
});
