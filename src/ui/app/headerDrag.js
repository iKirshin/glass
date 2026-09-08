// headerDrag.js
// JS-driven window dragging for the frameless header views.
//
// Native `-webkit-app-region: drag` regions are handled by the OS/Chromium and,
// starting with newer Electron versions, swallow every mouse event inside them
// (including clicks on `no-drag` children living in a Shadow DOM). The header
// views therefore move the window themselves via IPC and never rely on native
// drag regions.

const INTERACTIVE = 'button, input, select, textarea, a, [role="button"], label';

/**
 * @param {object} api  object with getHeaderPosition() and moveHeaderTo(x, y) (e.g. window.api.mainHeader)
 * @param {{ onDragEnd?: (moved: boolean) => void }} [opts]
 * @returns {{ onMouseDown: (e: MouseEvent) => void, wasJustDragged: () => boolean }}
 */
export function createHeaderDrag(api, opts = {}) {
    let dragState = null;
    let justDragged = false;

    const onMouseMove = (e) => {
        if (!dragState) return;
        const dx = e.screenX - dragState.initialMouseX;
        const dy = e.screenY - dragState.initialMouseY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
        api.moveHeaderTo(dragState.initialWindowX + dx, dragState.initialWindowY + dy);
    };

    const onMouseUp = () => {
        if (!dragState) return;
        const moved = dragState.moved;
        window.removeEventListener('mousemove', onMouseMove, { capture: true });
        dragState = null;
        if (moved) {
            justDragged = true;
            setTimeout(() => { justDragged = false; }, 0);
        }
        opts.onDragEnd?.(moved);
    };

    const onMouseDown = async (e) => {
        if (e.button !== 0) return;
        // Let interactive controls handle their own mouse events.
        const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
        if (path.some(el => el instanceof Element && el.matches(INTERACTIVE))) return;
        e.preventDefault();
        let pos;
        try {
            pos = await api.getHeaderPosition();
        } catch {
            return;
        }
        if (!pos) return;
        dragState = {
            initialMouseX: e.screenX,
            initialMouseY: e.screenY,
            initialWindowX: pos.x,
            initialWindowY: pos.y,
            moved: false,
        };
        window.addEventListener('mousemove', onMouseMove, { capture: true });
        window.addEventListener('mouseup', onMouseUp, { once: true, capture: true });
    };

    return { onMouseDown, wasJustDragged: () => justDragged };
}
