// platformSupport.js
// Tells whether "invisibility" (exclusion from screen sharing / capture) can work
// on this machine. On Windows the OS API behind Electron's setContentProtection
// (WDA_EXCLUDEFROMCAPTURE) exists only since Windows 10 build 19041 (May 2020
// update); older builds fall back to WDA_MONITOR, which shows the windows as
// black rectangles instead of hiding them.

const os = require('os');

const WINDOWS_MIN_BUILD_FOR_EXCLUDE = 19041;

function parseWindowsBuild(release = os.release()) {
    const parts = String(release).split('.');
    const build = parseInt(parts[2], 10);
    return Number.isFinite(build) ? build : null;
}

function windowsDisplayName(build) {
    if (!build) return 'Windows';
    if (build >= 22000) return 'Windows 11';
    const map = { 19045: '22H2', 19044: '21H2', 19043: '21H1', 19042: '20H2', 19041: '2004', 18363: '1909', 18362: '1903', 17763: '1809', 17134: '1803' };
    return `Windows 10 ${map[build] || `build ${build}`}`;
}

/**
 * @returns {{ platform: string, level: 'full'|'partial'|'none', osName: string, build: number|null, message: string }}
 */
function getInvisibilitySupport() {
    if (process.platform === 'darwin') {
        return { platform: 'darwin', level: 'full', osName: `macOS ${os.release()}`, build: null,
            message: 'Windows are excluded from screen sharing and screenshots.' };
    }
    if (process.platform === 'win32') {
        const build = parseWindowsBuild();
        const osName = windowsDisplayName(build);
        if (build !== null && build >= WINDOWS_MIN_BUILD_FOR_EXCLUDE) {
            return { platform: 'win32', level: 'full', osName, build,
                message: 'Windows are excluded from screen sharing and screenshots.' };
        }
        return { platform: 'win32', level: 'partial', osName, build,
            message: `This ${osName} is older than Windows 10 build ${WINDOWS_MIN_BUILD_FOR_EXCLUDE} (May 2020 update). In screen sharing the InPro windows will appear as black rectangles instead of being hidden. Update Windows to fix this.` };
    }
    return { platform: process.platform, level: 'none', osName: `${os.type()} ${os.release()}`, build: null,
        message: 'Invisibility during screen sharing is not available on this platform.' };
}

module.exports = { getInvisibilitySupport, parseWindowsBuild, WINDOWS_MIN_BUILD_FOR_EXCLUDE };
