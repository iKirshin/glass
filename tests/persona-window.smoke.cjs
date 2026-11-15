// Run after npm run build:renderer with:
// env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/persona-window.smoke.cjs
// Loads the actual content.html / PickleGlassApp shell, not just the persona component.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inpro-persona-window-'));
app.setPath('userData', path.join(outputDir, 'user-data'));
app.disableHardwareAcceleration();
const timeout = setTimeout(() => { console.error('Persona window test timed out'); app.exit(1); }, 30000);

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        width: 480, height: 800, frame: false, show: false,
        webPreferences: {
            contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
            preload: path.join(__dirname, 'fixtures/persona-window.preload.cjs'),
        },
    });
    try {
        await win.loadFile(path.join(__dirname, '../src/ui/app/content.html'), { query: { view: 'persona' } });
        await win.webContents.executeJavaScript(`(async () => {
            await customElements.whenDefined('pickle-glass-app');
            const app = document.querySelector('pickle-glass-app');
            await app.updateComplete;
            window.testPersona = app.shadowRoot.querySelector('persona-view');
            await testPersona.updateComplete;
            await Promise.resolve();
            await testPersona.updateComplete;
            if (!testPersona.profile.caseStudies) throw new Error('Fixture profile did not load');
        })()`);
        win.showInactive();
        const measurements = [];
        for (const [height, zoom] of [[800, 1], [560, 1], [360, 1], [560, 1.5]]) {
            win.setContentSize(480, height);
            win.webContents.setZoomFactor(zoom);
            await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
            const result = await win.webContents.executeJavaScript(`(() => {
                const root = testPersona.shadowRoot;
                const scroll = root.querySelector('.scroll-area');
                const footer = root.querySelector('.footer');
                const title = root.querySelector('.titlebar');
                const lastField = [...root.querySelectorAll('textarea')].at(-1);
                root.activeElement?.blur();
                scroll.scrollTop = 0;
                const initialTitleTop = title.getBoundingClientRect().top;
                lastField.focus();
                const focusedBounds = lastField.getBoundingClientRect();
                const scrollBounds = scroll.getBoundingClientRect();
                const focusRevealsLastField = focusedBounds.top >= scrollBounds.top && focusedBounds.bottom <= scrollBounds.bottom + 1;
                scroll.scrollTop = 0;
                scroll.scrollBy({ top: 100, behavior: 'instant' });
                const scrollsDown = scroll.scrollTop > 0;
                scroll.scrollBy({ top: -100, behavior: 'instant' });
                const scrollsUp = scroll.scrollTop === 0;
                scroll.scrollTop = scroll.scrollHeight;
                const bounds = scroll.getBoundingClientRect();
                const last = lastField.getBoundingClientRect();
                const bottom = footer.getBoundingClientRect();
                return {
                    viewportHeight: innerHeight, formHeight: testPersona.clientHeight,
                    contentHeight: scroll.scrollHeight, visibleHeight: scroll.clientHeight,
                    scrollTop: scroll.scrollTop,
                    boundedForm: testPersona.clientHeight <= innerHeight,
                    scrolls: scroll.scrollHeight > scroll.clientHeight && scroll.scrollTop > 0,
                    lastFieldVisible: last.top >= bounds.top && last.bottom <= bounds.bottom + 1,
                    footerVisible: bottom.top >= 0 && bottom.bottom <= innerHeight,
                    noOverlap: bounds.bottom <= bottom.top,
                    titleFixed: title.getBoundingClientRect().top === initialTitleTop && initialTitleTop >= 0,
                    keyboardFocus: root.activeElement === lastField,
                    focusRevealsLastField, scrollsDown, scrollsUp,
                    noHorizontalOverflow: scroll.scrollWidth <= scroll.clientWidth,
                    profileUnchanged: !testPersona.dirty,
                };
            })()`);
            measurements.push({ height, zoom, ...result });
            console.log(JSON.stringify(measurements.at(-1)));
            for (const [name, passed] of Object.entries(result)) {
                if (typeof passed === 'boolean') assert.equal(passed, true, `${height}px @ ${zoom}x: ${name}`);
            }
            const screenshot = path.join(outputDir, `persona-bottom-${height}-${zoom}.png`);
            await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
            fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
        }
        console.log(JSON.stringify({ screenshots: outputDir }));
        clearTimeout(timeout);
        win.destroy();
        app.exit(0);
    } catch (error) {
        console.error(error);
        clearTimeout(timeout);
        win.destroy();
        app.exit(1);
    }
});
