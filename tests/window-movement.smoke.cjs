// env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/window-movement.smoke.cjs
// Isolated native windows: no profile database, microphone or AI requests.
const { app, BrowserWindow, screen } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WindowLayoutManager = require('../src/window/windowLayoutManager');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'inpro-movement-smoke-')));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    let win;
    try {
        const area = screen.getPrimaryDisplay().workArea;
        const start = { x: area.x + 100, y: area.y + 100 };
        win = new BrowserWindow({
            ...start, width: 350, height: 47, show: false, frame: false,
            transparent: true, resizable: false,
            enableLargerThanScreen: true,
        });
        win.showInactive();
        const layout = new WindowLayoutManager(new Map([['header', win]]));
        const points = {
            left: { x: area.x - 175, y: start.y },
            right: { x: area.x + area.width - 175, y: start.y },
            bottom: { x: start.x, y: area.y + area.height + 40 },
            top: { x: start.x, y: area.y - 100 },
        };
        for (const [direction, requested] of Object.entries(points)) {
            const position = layout.calculateManualPosition(win, requested);
            win.setPosition(position.x, position.y, false);
            await new Promise(resolve => setTimeout(resolve, 30));
            const { x, y } = win.getBounds();
            console.log(JSON.stringify({ direction, requested, actual: { x, y } }));
            assert.deepEqual({ x, y }, requested);
        }
        const recovery = layout.calculateEdgePosition(win, 'left');
        win.setPosition(recovery.x, recovery.y, false);
        const recovered = win.getBounds();
        assert.ok(recovered.x >= area.x && recovered.y >= area.y);
        assert.ok(recovered.x + recovered.width <= area.x + area.width);
        assert.ok(recovered.y + recovered.height <= area.y + area.height);
        console.log('Native movement and recovery passed');
        win.destroy();
        app.exit(0);
    } catch (error) {
        console.error(error);
        if (win && !win.isDestroyed()) win.destroy();
        app.exit(1);
    }
});
