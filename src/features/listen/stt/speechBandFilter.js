// speechBandFilter.js
// Cleans the "Them" (system audio) channel before it is sent to speech
// recognition: a 4th-order Butterworth band-pass limited to the speech band
// (≈250–3800 Hz) removes rumble, hiss and out-of-band interference, and a
// peak limiter tames sudden loud bursts that can stall server-side VAD.
// Works on 16-bit PCM mono chunks and keeps filter state across chunks.

const SAMPLE_RATE = 24000;

class Biquad {
    constructor(b0, b1, b2, a1, a2) {
        this.b0 = b0; this.b1 = b1; this.b2 = b2; this.a1 = a1; this.a2 = a2;
        this.z1 = 0; this.z2 = 0;
    }
    // Transposed direct form II
    process(x) {
        const y = this.b0 * x + this.z1;
        this.z1 = this.b1 * x - this.a1 * y + this.z2;
        this.z2 = this.b2 * x - this.a2 * y;
        return y;
    }
    static lowPass(fc, fs, q = Math.SQRT1_2) {
        const w0 = 2 * Math.PI * fc / fs, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q);
        const a0 = 1 + alpha;
        return new Biquad((1 - cos) / 2 / a0, (1 - cos) / a0, (1 - cos) / 2 / a0, -2 * cos / a0, (1 - alpha) / a0);
    }
    static highPass(fc, fs, q = Math.SQRT1_2) {
        const w0 = 2 * Math.PI * fc / fs, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q);
        const a0 = 1 + alpha;
        return new Biquad((1 + cos) / 2 / a0, -(1 + cos) / a0, (1 + cos) / 2 / a0, -2 * cos / a0, (1 - alpha) / a0);
    }
}

class SpeechBandFilter {
    /**
     * @param {object} [opts]
     * @param {number} [opts.sampleRate=24000]
     * @param {number} [opts.lowCut=250]      high-pass corner (Hz)
     * @param {number} [opts.highCut=3800]    low-pass corner (Hz)
     * @param {number} [opts.limitDb=-9]      limiter ceiling (dBFS)
     * @param {number} [opts.releaseMs=150]   limiter release time
     */
    constructor({ sampleRate = SAMPLE_RATE, lowCut = 250, highCut = 3800, limitDb = -9, releaseMs = 150 } = {}) {
        this.sampleRate = sampleRate;
        // Two cascaded 2nd-order sections per edge = 4th-order Butterworth (24 dB/oct)
        this.stages = [
            Biquad.highPass(lowCut, sampleRate, 0.5412), Biquad.highPass(lowCut, sampleRate, 1.3066),
            Biquad.lowPass(highCut, sampleRate, 0.5412), Biquad.lowPass(highCut, sampleRate, 1.3066),
        ];
        this.ceiling = Math.pow(10, limitDb / 20);
        this.releaseCoef = Math.exp(-1 / (releaseMs / 1000 * sampleRate));
        this.envelope = 0;
        this.stats = { samples: 0, limited: 0 };
    }

    /** @param {Buffer} pcm16 mono little-endian 16-bit PCM @returns {Buffer} */
    process(pcm16) {
        const n = pcm16.length >> 1;
        const out = Buffer.allocUnsafe(n * 2);
        for (let i = 0; i < n; i++) {
            let x = pcm16.readInt16LE(i * 2) / 32768;
            for (const stage of this.stages) x = stage.process(x);

            // Peak limiter: instant attack, exponential release
            const mag = Math.abs(x);
            this.envelope = mag > this.envelope ? mag : this.envelope * this.releaseCoef;
            if (this.envelope > this.ceiling) {
                x *= this.ceiling / this.envelope;
                this.stats.limited++;
            }
            this.stats.samples++;

            let s = Math.round(x * 32767);
            if (s > 32767) s = 32767; else if (s < -32768) s = -32768;
            out.writeInt16LE(s, i * 2);
        }
        return out;
    }

    /** Fraction of samples that hit the limiter since the last call. */
    takeLimiterRatio() {
        const { samples, limited } = this.stats;
        this.stats = { samples: 0, limited: 0 };
        return samples ? limited / samples : 0;
    }
}

module.exports = { SpeechBandFilter, Biquad };
