const { screen } = require('electron');

/**
 * 
 * @param {BrowserWindow} window 
 * @returns {Display}
 */
function getCurrentDisplay(window) {
    if (!window || window.isDestroyed()) return screen.getPrimaryDisplay();

    const windowBounds = window.getBounds();
    const windowCenter = {
        x: windowBounds.x + windowBounds.width / 2,
        y: windowBounds.y + windowBounds.height / 2,
    };

    return screen.getDisplayNearestPoint(windowCenter);
}

class WindowLayoutManager {
    /**
     * @param {Map<string, BrowserWindow>} windowPool - 관리할 창들의 맵
     */
    constructor(windowPool) {
        this.windowPool = windowPool;
        this.isUpdating = false;
        this.PADDING = 80;
    }

    getHeaderPosition = () => {
        const header = this.windowPool.get('header');
        if (header) {
            const [x, y] = header.getPosition();
            return { x, y };
        }
        return { x: 0, y: 0 };
    };


    /**
     * 
     * @returns {{name: string, primary: string, secondary: string}}
     */
    determineLayoutStrategy(headerBounds, screenWidth, screenHeight, relativeX, relativeY, workAreaX, workAreaY) {
        const headerRelX = headerBounds.x - workAreaX;
        const headerRelY = headerBounds.y - workAreaY;

        const spaceBelow = screenHeight - (headerRelY + headerBounds.height);
        const spaceAbove = headerRelY;
        const spaceLeft = headerRelX;
        const spaceRight = screenWidth - (headerRelX + headerBounds.width);

        if (spaceBelow >= 400) {
            return { name: 'below', primary: 'below', secondary: relativeX < 0.5 ? 'right' : 'left' };
        } else if (spaceAbove >= 400) {
            return { name: 'above', primary: 'above', secondary: relativeX < 0.5 ? 'right' : 'left' };
        } else if (relativeX < 0.3 && spaceRight >= 800) {
            return { name: 'right-side', primary: 'right', secondary: spaceBelow > spaceAbove ? 'below' : 'above' };
        } else if (relativeX > 0.7 && spaceLeft >= 800) {
            return { name: 'left-side', primary: 'left', secondary: spaceBelow > spaceAbove ? 'below' : 'above' };
        } else {
            return { name: 'adaptive', primary: spaceBelow > spaceAbove ? 'below' : 'above', secondary: spaceRight > spaceLeft ? 'right' : 'left' };
        }
    }



    /**
     * @returns {{x: number, y: number} | null}
     */
    calculateSettingsWindowPosition() {
        const header = this.windowPool.get('header');
        const settings = this.windowPool.get('settings');

        if (!header || header.isDestroyed() || !settings || settings.isDestroyed()) {
            return null;
        }

        const headerBounds = header.getBounds();
        const settingsBounds = settings.getBounds();
        const display = getCurrentDisplay(header);
        const { x: workAreaX, y: workAreaY, width: screenWidth, height: screenHeight } = display.workArea;

        const PAD = 5;
        const buttonPadding = 170;

        const x = headerBounds.x + headerBounds.width - settingsBounds.width + buttonPadding;
        const y = headerBounds.y + headerBounds.height + PAD;

        const clampedX = Math.max(workAreaX + 10, Math.min(workAreaX + screenWidth - settingsBounds.width - 10, x));
        const clampedY = Math.max(workAreaY + 10, Math.min(workAreaY + screenHeight - settingsBounds.height - 10, y));

        return { x: Math.round(clampedX), y: Math.round(clampedY) };
    }


    calculateHeaderResize(header, { width, height }) {
        if (!header) return null;
        const currentBounds = header.getBounds();
        const centerX = currentBounds.x + currentBounds.width / 2;
        const newX = Math.round(centerX - width / 2);
        return { x: newX, y: currentBounds.y, width, height };
    }
    
    calculateManualPosition(header, { x, y }) {
        if (!header || header.isDestroyed() || !Number.isFinite(x) || !Number.isFinite(y)) return null;
        // Dragging and arrow shortcuts honor the user's position, including offscreen.
        // Only explicit edge/display commands bring a window back into the work area.
        return { x: Math.round(x), y: Math.round(y) };
    }
    
    calculateWindowHeightAdjustment(senderWindow, targetHeight) {
        if (!senderWindow) return null;
        const currentBounds = senderWindow.getBounds();
        const minHeight = senderWindow.getMinimumSize()[1];
        const maxHeight = senderWindow.getMaximumSize()[1];
        let adjustedHeight = Math.max(minHeight, targetHeight);
        if (maxHeight > 0) {
            adjustedHeight = Math.min(maxHeight, adjustedHeight);
        }
        console.log(`[Layout Debug] calculateWindowHeightAdjustment: targetHeight=${targetHeight}`);
        return { ...currentBounds, height: adjustedHeight };
    }
    
    // 기존 getTargetBoundsForFeatureWindows를 이 함수로 대체합니다.
    calculateFeatureWindowLayout(visibility, headerBoundsOverride = null) {
        const header = this.windowPool.get('header');
        const headerBounds = headerBoundsOverride || (header ? header.getBounds() : null);

        if (!headerBounds) return {};

        let display;
        if (headerBoundsOverride) {
            const boundsCenter = {
                x: headerBounds.x + headerBounds.width / 2,
                y: headerBounds.y + headerBounds.height / 2,
            };
            display = screen.getDisplayNearestPoint(boundsCenter);
        } else {
            display = getCurrentDisplay(header);
        }
    
        const { width: screenWidth, height: screenHeight, x: workAreaX, y: workAreaY } = display.workArea;
        const headerOutsideHorizontally = headerBounds.x < workAreaX
            || headerBounds.x + headerBounds.width > workAreaX + screenWidth;
    
        const ask = this.windowPool.get('ask');
        const listen = this.windowPool.get('listen');
    
        const askVis = visibility.ask && ask && !ask.isDestroyed();
        const listenVis = visibility.listen && listen && !listen.isDestroyed();
    
        if (!askVis && !listenVis) return {};
    
        const PAD = 8;
        const headerTopRel = headerBounds.y - workAreaY;
        const headerBottomRel = headerTopRel + headerBounds.height;
        const headerCenterXRel = headerBounds.x - workAreaX + headerBounds.width / 2;
        
        const relativeX = headerCenterXRel / screenWidth;
        const relativeY = (headerBounds.y - workAreaY) / screenHeight;
        const strategy = this.determineLayoutStrategy(headerBounds, screenWidth, screenHeight, relativeX, relativeY, workAreaX, workAreaY);
    
        const askB = askVis ? ask.getBounds() : null;
        const listenB = listenVis ? listen.getBounds() : null;

        if (askVis) {
            console.log(`[Layout Debug] Ask Window Bounds: height=${askB.height}, width=${askB.width}`);
        }
        if (listenVis) {
            console.log(`[Layout Debug] Listen Window Bounds: height=${listenB.height}, width=${listenB.width}`);
        }
    
        const layout = {};
    
        if (askVis && listenVis) {
            let askXRel = headerCenterXRel - (askB.width / 2);
            let listenXRel = askXRel - listenB.width - PAD;
    
            if (!headerOutsideHorizontally && listenXRel < PAD) {
                listenXRel = PAD;
                askXRel = listenXRel + listenB.width + PAD;
            }
            if (!headerOutsideHorizontally && askXRel + askB.width > screenWidth - PAD) {
                askXRel = screenWidth - PAD - askB.width;
                listenXRel = askXRel - listenB.width - PAD;
            }
            
            if (strategy.primary === 'above') {
                const windowBottomAbs = headerBounds.y - PAD;
                layout.ask = { x: Math.round(askXRel + workAreaX), y: Math.round(windowBottomAbs - askB.height), width: askB.width, height: askB.height };
                layout.listen = { x: Math.round(listenXRel + workAreaX), y: Math.round(windowBottomAbs - listenB.height), width: listenB.width, height: listenB.height };
            } else { // 'below'
                const yAbs = headerBounds.y + headerBounds.height + PAD;
                layout.ask = { x: Math.round(askXRel + workAreaX), y: Math.round(yAbs), width: askB.width, height: askB.height };
                layout.listen = { x: Math.round(listenXRel + workAreaX), y: Math.round(yAbs), width: listenB.width, height: listenB.height };
            }
        } else { // Single window
            const winName = askVis ? 'ask' : 'listen';
            const winB = askVis ? askB : listenB;
            if (!winB) return {};
    
            let xRel = headerCenterXRel - winB.width / 2;
            if (!headerOutsideHorizontally) {
                xRel = Math.max(PAD, Math.min(screenWidth - winB.width - PAD, xRel));
            }
    
            let yPos;
            if (strategy.primary === 'above') {
                yPos = (headerBounds.y - workAreaY) - PAD - winB.height;
            } else { // 'below'
                yPos = (headerBounds.y - workAreaY) + headerBounds.height + PAD;
            }
            
            layout[winName] = { x: Math.round(xRel + workAreaX), y: Math.round(yPos + workAreaY), width: winB.width, height: winB.height };
        }
        return layout;
    }
    
    calculateShortcutSettingsWindowPosition(windowName = 'shortcut-settings') {
        const header = this.windowPool.get('header');
        const shortcutSettings = this.windowPool.get(windowName);
        if (!header || !shortcutSettings) return null;
    
        const headerBounds = header.getBounds();
        const shortcutBounds = shortcutSettings.getBounds();
        const { workArea } = getCurrentDisplay(header);
        // Opening a settings dialog should remain safe on smaller displays even
        // though subsequent manual movement is allowed outside the screen.
        const width = Math.min(shortcutBounds.width, workArea.width);
        const height = Math.min(shortcutBounds.height, workArea.height);
    
        let newX = Math.round(headerBounds.x + (headerBounds.width / 2) - (width / 2));
        let newY = Math.round(headerBounds.y);
    
        newX = Math.max(workArea.x, Math.min(newX, workArea.x + workArea.width - width));
        newY = Math.max(workArea.y, Math.min(newY, workArea.y + workArea.height - height));
    
        return { x: newX, y: newY, width, height };
    }

    calculateStepMovePosition(header, direction) {
        if (!header) return null;
        const currentBounds = header.getBounds();
        const stepSize = 80; // 이동 간격
        let targetX = currentBounds.x;
        let targetY = currentBounds.y;
    
        switch (direction) {
            case 'left': targetX -= stepSize; break;
            case 'right': targetX += stepSize; break;
            case 'up': targetY -= stepSize; break;
            case 'down': targetY += stepSize; break;
        }
    
        return this.calculateManualPosition(header, { x: targetX, y: targetY });
    }
    
    calculateEdgePosition(header, direction) {
        if (!header) return null;
        const display = getCurrentDisplay(header);
        const { workArea } = display;
        const currentBounds = header.getBounds();
    
        let targetX = currentBounds.x;
        let targetY = currentBounds.y;
    
        switch (direction) {
            case 'left': targetX = workArea.x; break;
            case 'right': targetX = workArea.x + workArea.width - currentBounds.width; break;
            case 'up': targetY = workArea.y; break;
            case 'down': targetY = workArea.y + workArea.height - currentBounds.height; break;
        }
        // An explicit snap also recovers the other axis if the user hid the window.
        return {
            x: Math.max(workArea.x, Math.min(targetX, workArea.x + workArea.width - currentBounds.width)),
            y: Math.max(workArea.y, Math.min(targetY, workArea.y + workArea.height - currentBounds.height)),
        };
    }
    
    calculateNewPositionForDisplay(window, targetDisplayId) {
        if (!window) return null;
    
        const targetDisplay = screen.getAllDisplays().find(d => d.id === targetDisplayId);
        if (!targetDisplay) return null;
    
        const currentBounds = window.getBounds();
        const currentDisplay = getCurrentDisplay(window);
    
        const relativeX = (currentBounds.x - currentDisplay.workArea.x) / currentDisplay.workArea.width;
        const relativeY = (currentBounds.y - currentDisplay.workArea.y) / currentDisplay.workArea.height;
        
        const targetX = targetDisplay.workArea.x + targetDisplay.workArea.width * relativeX;
        const targetY = targetDisplay.workArea.y + targetDisplay.workArea.height * relativeY;
    
        const clampedX = Math.max(targetDisplay.workArea.x, Math.min(targetX, targetDisplay.workArea.x + targetDisplay.workArea.width - currentBounds.width));
        const clampedY = Math.max(targetDisplay.workArea.y, Math.min(targetY, targetDisplay.workArea.y + targetDisplay.workArea.height - currentBounds.height));
    
        return { x: Math.round(clampedX), y: Math.round(clampedY) };
    }
    
    /**
     * @param {Rectangle} bounds1
     * @param {Rectangle} bounds2
     * @returns {boolean}
     */
    boundsOverlap(bounds1, bounds2) {
        const margin = 10;
        return !(
            bounds1.x + bounds1.width + margin < bounds2.x ||
            bounds2.x + bounds2.width + margin < bounds1.x ||
            bounds1.y + bounds1.height + margin < bounds2.y ||
            bounds2.y + bounds2.height + margin < bounds1.y
        );
    }
}

module.exports = WindowLayoutManager;
