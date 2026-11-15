// Run with: node --test tests/window-movement.test.cjs
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/window/windowLayoutManager.js'), 'utf8');
const displays = [
    { id: 1, workArea: { x: 0, y: 24, width: 1440, height: 876 } },
    { id: 2, workArea: { x: -1920, y: -200, width: 1920, height: 1080 } },
];
const fakeWindow = (bounds) => ({
    getBounds: () => ({ width: 350, height: 47, ...bounds }),
    isDestroyed: () => false,
});
function fixture(bounds, children = {}) {
    const screen = {
        getPrimaryDisplay: () => displays[0],
        getAllDisplays: () => displays,
        getDisplayNearestPoint: point => displays.reduce((nearest, display) => {
            const distance = ({ workArea: a }) => Math.max(a.x - point.x, 0, point.x - a.x - a.width) ** 2
                + Math.max(a.y - point.y, 0, point.y - a.y - a.height) ** 2;
            return distance(display) < distance(nearest) ? display : nearest;
        }),
    };
    const module = { exports: {} };
    vm.compileFunction(source, ['require', 'module', 'console'])(() => ({ screen }), module, { log() {} });
    const header = fakeWindow(bounds);
    const pool = new Map([['header', header], ...Object.entries(children)]);
    return { header, layout: new module.exports(pool) };
}

for (const point of [{ x: -150, y: 64 }, { x: 1380, y: 64 }, { x: 500, y: -100 },
    { x: 500, y: 950 }, { x: -2000, y: -240 }]) {
    test(`manual movement preserves offscreen coordinates ${JSON.stringify(point)}`, () => {
        const { header, layout } = fixture({ x: 500, y: 64 });
        assert.deepEqual(layout.calculateManualPosition(header, point), point);
    });
}

test('movement rounds fractional coordinates and rejects invalid IPC values', () => {
    const { header, layout } = fixture({ x: 500, y: 64 });
    assert.deepEqual(layout.calculateManualPosition(header, { x: -70.7, y: 950.2 }), { x: -71, y: 950 });
    for (const x of [NaN, Infinity, '100', undefined]) {
        assert.equal(layout.calculateManualPosition(header, { x, y: 100 }), null);
    }
    assert.equal(layout.calculateManualPosition(null, { x: 1, y: 1 }), null);
});

for (const [direction, expected] of Object.entries({
    left: { x: -80, y: 24 }, right: { x: 80, y: 24 }, up: { x: 0, y: -56 }, down: { x: 0, y: 104 },
})) {
    test(`keyboard movement takes a full 80px step ${direction}`, () => {
        const { header, layout } = fixture({ x: 0, y: 24 });
        assert.deepEqual(layout.calculateStepMovePosition(header, direction), expected);
    });
}

test('resizing a partly hidden header preserves its center and vertical position', () => {
    const { header, layout } = fixture({ x: -100, y: 950 });
    assert.deepEqual(layout.calculateHeaderResize(header, { width: 480, height: 61 }),
        { x: -165, y: 950, width: 480, height: 61 });
});

for (const visibility of [{ ask: true }, { listen: true }, { ask: true, listen: true }]) {
    test(`child windows can follow a partly offscreen header: ${JSON.stringify(visibility)}`, () => {
        const { layout } = fixture({ x: 1380, y: 64 }, {
            ask: fakeWindow({ width: 600, height: 240 }), listen: fakeWindow({ width: 400, height: 240 }),
        });
        const positions = layout.calculateFeatureWindowLayout(visibility);
        const rightmost = positions.ask || positions.listen;
        assert.ok(rightmost.x + rightmost.width > 1440);
    });
}

test('normal onscreen layout still keeps both panels inside the work area', () => {
    const { layout } = fixture({ x: 0, y: 64 }, {
        ask: fakeWindow({ width: 600, height: 240 }), listen: fakeWindow({ width: 400, height: 240 }),
    });
    for (const bounds of Object.values(layout.calculateFeatureWindowLayout({ ask: true, listen: true }))) {
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 1440);
    }
});

test('explicit edge snapping recovers a window hidden below the screen', () => {
    const { header, layout } = fixture({ x: 1500, y: 1200 });
    assert.deepEqual(layout.calculateEdgePosition(header, 'left'), { x: 0, y: 853 });
    assert.deepEqual(layout.calculateEdgePosition(header, 'right'), { x: 1090, y: 853 });
});

test('explicit display selection recovers an offscreen position, even on the same display', () => {
    const { header, layout } = fixture({ x: 1500, y: 1200 });
    assert.deepEqual(layout.calculateNewPositionForDisplay(header, 1), { x: 1090, y: 853 });
    const target = layout.calculateNewPositionForDisplay(header, 2);
    assert.ok(target.x >= -1920 && target.x + 350 <= 0);
    assert.ok(target.y >= -200 && target.y + 47 <= 880);
});

test('opening a tall profile still fits the display rather than hiding its footer', () => {
    const { layout } = fixture({ x: 500, y: 64 }, { persona: fakeWindow({ width: 480, height: 1000 }) });
    assert.deepEqual(layout.calculateShortcutSettingsWindowPosition('persona'),
        { x: 435, y: 24, width: 480, height: 876 });
});
