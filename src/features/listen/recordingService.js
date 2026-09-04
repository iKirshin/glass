// recordingService.js
// Records both Listen channels (microphone = "me", system audio = "them") to WAV
// files from session start to stop so a failed transcription can be re-listened.
// Files: <userData>/recordings/<timestamp>_<session>/me.wav | them.wav | meta.json

const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');

const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const MAX_RECORDINGS_KEPT = 20;

function wavHeader(dataBytes) {
    const header = Buffer.alloc(44);
    const byteRate = SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE / 8;
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataBytes, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);            // PCM chunk size
    header.writeUInt16LE(1, 20);             // PCM format
    header.writeUInt16LE(CHANNELS, 22);
    header.writeUInt32LE(SAMPLE_RATE, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(CHANNELS * BITS_PER_SAMPLE / 8, 32);
    header.writeUInt16LE(BITS_PER_SAMPLE, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataBytes, 40);
    return header;
}

class WavWriter {
    constructor(filePath) {
        this.filePath = filePath;
        this.fd = fs.openSync(filePath, 'w');
        this.bytes = 0;
        fs.writeSync(this.fd, wavHeader(0));
    }
    write(buffer) {
        if (this.fd === null || !buffer || buffer.length === 0) return;
        fs.writeSync(this.fd, buffer);
        this.bytes += buffer.length;
    }
    close() {
        if (this.fd === null) return;
        try {
            fs.writeSync(this.fd, wavHeader(this.bytes), 0, 44, 0);
        } finally {
            fs.closeSync(this.fd);
            this.fd = null;
        }
    }
    get seconds() {
        return this.bytes / (SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE / 8);
    }
}

class RecordingService {
    constructor() {
        this.dir = null;
        this.me = null;
        this.them = null;
        this.startedAt = 0;
    }

    getRecordingsRoot() {
        return path.join(app.getPath('userData'), 'recordings');
    }

    isEnabled() {
        try {
            const settingsRepository = require('../settings/repositories');
            return settingsRepository.getRecordListen();
        } catch (error) {
            console.error('[Recording] Could not read setting, defaulting to enabled:', error.message);
            return true;
        }
    }

    isActive() {
        return !!this.dir;
    }

    start(sessionId, meta = {}) {
        if (this.dir) return this.dir;
        if (!this.isEnabled()) {
            console.log('[Recording] Disabled in settings, not recording this session.');
            return null;
        }
        try {
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const dir = path.join(this.getRecordingsRoot(), `${stamp}_${String(sessionId || 'session').slice(0, 8)}`);
            fs.mkdirSync(dir, { recursive: true });
            this.me = new WavWriter(path.join(dir, 'me.wav'));
            this.them = new WavWriter(path.join(dir, 'them.wav'));
            this.dir = dir;
            this.startedAt = Date.now();
            fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
                sessionId, startedAt: new Date(this.startedAt).toISOString(), sampleRate: SAMPLE_RATE, channels: CHANNELS, ...meta,
            }, null, 2));
            console.log(`[Recording] Started: ${dir}`);
            this.pruneOld();
            return dir;
        } catch (error) {
            console.error('[Recording] Failed to start:', error);
            this.dir = null; this.me = null; this.them = null;
            return null;
        }
    }

    writeMe(buffer) {
        try { this.me?.write(buffer); } catch (error) { console.error('[Recording] me.wav write failed:', error.message); }
    }

    writeThem(buffer) {
        try { this.them?.write(buffer); } catch (error) { console.error('[Recording] them.wav write failed:', error.message); }
    }

    stop() {
        if (!this.dir) return null;
        const dir = this.dir;
        const meSec = this.me?.seconds || 0;
        const themSec = this.them?.seconds || 0;
        try { this.me?.close(); } catch (e) { console.error('[Recording] close me.wav:', e.message); }
        try { this.them?.close(); } catch (e) { console.error('[Recording] close them.wav:', e.message); }
        try {
            const metaPath = path.join(dir, 'meta.json');
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            meta.endedAt = new Date().toISOString();
            meta.meSeconds = Math.round(meSec);
            meta.themSeconds = Math.round(themSec);
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        } catch (e) { /* meta is best-effort */ }
        console.log(`[Recording] Stopped: ${dir} (me ${Math.round(meSec)}s, them ${Math.round(themSec)}s)`);
        this.dir = null; this.me = null; this.them = null;
        return dir;
    }

    pruneOld() {
        try {
            const root = this.getRecordingsRoot();
            const dirs = fs.readdirSync(root, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name)
                .sort();
            while (dirs.length > MAX_RECORDINGS_KEPT) {
                const victim = dirs.shift();
                fs.rmSync(path.join(root, victim), { recursive: true, force: true });
                console.log(`[Recording] Pruned old recording: ${victim}`);
            }
        } catch (error) {
            console.error('[Recording] Prune failed:', error.message);
        }
    }

    async openFolder() {
        const root = this.getRecordingsRoot();
        fs.mkdirSync(root, { recursive: true });
        const result = await shell.openPath(root);
        return { success: !result, error: result || undefined, path: root };
    }
}

module.exports = new RecordingService();
module.exports.WavWriter = WavWriter;
