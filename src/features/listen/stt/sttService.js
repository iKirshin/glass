const { BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const { createSTT } = require('../../common/ai/factory');
const modelStateService = require('../../common/services/modelStateService');

const COMPLETION_DEBOUNCE_MS = 2000;

// ── New heartbeat / renewal constants ────────────────────────────────────────────
// Interval to send low-cost keep-alive messages so the remote service does not
// treat the connection as idle. One minute is safely below the typical 2-5 min
// idle timeout window seen on provider websockets.
const KEEP_ALIVE_INTERVAL_MS = 60 * 1000;         // 1 minute

// Interval after which we pro-actively tear down and recreate the STT sessions
// to dodge the 30-minute hard timeout enforced by some providers. 20 minutes
// gives a 10-minute safety buffer.
const SESSION_RENEW_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

// Duration to allow the old and new sockets to run in parallel so we don't
// miss any packets at the exact swap moment.
const SOCKET_OVERLAP_MS = 2 * 1000; // 2 seconds
const recordingService = require('../recordingService');
const { SpeechBandFilter } = require('./speechBandFilter');

// System-audio health monitoring (macOS SystemAudioDump)
const AUDIO_STATS_INTERVAL_MS = 10 * 1000;   // periodic "is audio flowing" summary in the log
const AUDIO_STALL_MS = 4 * 1000;             // no stdout data for this long -> capture is dead, restart it
const AUDIO_STALL_MAX_RESTARTS = 5;
const AUDIO_SPEECH_RMS = 0.01;               // above this the system audio clearly contains sound (int16 scaled to 1.0)
const STT_AFTER_STOP_MS = 5 * 1000;          // speech_stopped seen but no transcript within this -> stalled session
const STT_STUCK_SPEECH_MS = 25 * 1000;       // speech_started with no speech_stopped for this long -> stuck VAD
const STT_DEAD_MS = 15 * 1000;               // sound present but no VAD events at all -> dead session
const STT_STALL_MIN_INTERVAL_MS = 15 * 1000; // never recreate more often than this
const MIC_GATE_WHILE_THEM_SPEAKS = true;     // half-duplex: drop mic audio while the other side is talking (kills speaker echo)
const MIC_GATE_HANGOVER_MS = 400;
const ECHO_WINDOW_MS = 20 * 1000;            // a "Me" transcript that repeats a recent "Them" line is speaker echo
const ECHO_OVERLAP_RATIO = 0.6;

class SttService {
    constructor() {
        this.mySttSession = null;
        this.theirSttSession = null;
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';
        
        // Turn-completion debouncing
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
        this.myCompletionTimer = null;
        this.theirCompletionTimer = null;
        
        // System audio capture
        this.systemAudioProc = null;
        this.audioHealth = null;          // stats for the current SystemAudioDump run
        this.audioHealthInterval = null;
        this.lastTheirSttEventAt = 0;     // last transcription (delta/completed) received on the "Them" session
        this.lastTheirVadAt = 0;          // last VAD event on the "Them" session
        this.theirSpeechStartedAt = 0;
        this.theirSpeechStoppedAt = 0;
        this.themActiveUntil = 0;         // mic gate: other side is producing sound until this time
        this.recentTheirTexts = [];       // for echo detection: [{ text, at }]
        this.gatedMicChunks = 0;
        this.droppedEchoes = 0;
        this.currentLanguage = 'en';
        this.themFilter = null;           // speech band-pass + limiter for the "Them" channel (null = off)
        this.lastSttStallRecoveryAt = 0;

        // Keep-alive / renewal timers
        this.keepAliveInterval = null;
        this.sessionRenewTimeout = null;

        // Callbacks
        this.onTranscriptionComplete = null;
        this.onStatusUpdate = null;

        this.modelInfo = null; 
    }

    setCallbacks({ onTranscriptionComplete, onStatusUpdate }) {
        this.onTranscriptionComplete = onTranscriptionComplete;
        this.onStatusUpdate = onStatusUpdate;
    }

    sendToRenderer(channel, data) {
        // Listen 관련 이벤트는 Listen 윈도우에만 전송 (Ask 윈도우 충돌 방지)
        const { windowPool } = require('../../../window/windowManager');
        const listenWindow = windowPool?.get('listen');
        
        if (listenWindow && !listenWindow.isDestroyed()) {
            listenWindow.webContents.send(channel, data);
        }
    }

    async handleSendSystemAudioContent(data, mimeType) {
        try {
            await this.sendSystemAudioContent(data, mimeType);
            this.sendToRenderer('system-audio-data', { data });
            return { success: true };
        } catch (error) {
            console.error('Error sending system audio:', error);
            return { success: false, error: error.message };
        }
    }

    flushMyCompletion() {
        const rawText = (this.myCompletionBuffer + this.myCurrentUtterance).trim();
        const finalText = this._filterTranscript('Me', rawText);
        if (!this.modelInfo || !finalText) { this.myCompletionBuffer = ''; this.myCurrentUtterance = ''; this.myCompletionTimer = null; return; }

        // Notify completion callback
        if (this.onTranscriptionComplete) {
            this.onTranscriptionComplete('Me', finalText);
        }
        
        // Send to renderer as final
        this.sendToRenderer('stt-update', {
            speaker: 'Me',
            text: finalText,
            isPartial: false,
            isFinal: true,
            timestamp: Date.now(),
        });

        this.myCompletionBuffer = '';
        this.myCompletionTimer = null;
        this.myCurrentUtterance = '';
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate('Listening...');
        }
    }

    flushTheirCompletion() {
        const rawText = (this.theirCompletionBuffer + this.theirCurrentUtterance).trim();
        const finalText = this._filterTranscript('Them', rawText);
        if (!this.modelInfo || !finalText) { this.theirCompletionBuffer = ''; this.theirCurrentUtterance = ''; this.theirCompletionTimer = null; return; }
        
        // Notify completion callback
        if (this.onTranscriptionComplete) {
            this.onTranscriptionComplete('Them', finalText);
        }
        
        // Send to renderer as final
        this.sendToRenderer('stt-update', {
            speaker: 'Them',
            text: finalText,
            isPartial: false,
            isFinal: true,
            timestamp: Date.now(),
        });

        this.theirCompletionBuffer = '';
        this.theirCompletionTimer = null;
        this.theirCurrentUtterance = '';
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate('Listening...');
        }
    }

    debounceMyCompletion(text) {
        if (this.modelInfo?.provider === 'gemini') {
            this.myCompletionBuffer += text;
        } else {
            this.myCompletionBuffer += (this.myCompletionBuffer ? ' ' : '') + text;
        }

        if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
        this.myCompletionTimer = setTimeout(() => this.flushMyCompletion(), COMPLETION_DEBOUNCE_MS);
    }

    debounceTheirCompletion(text) {
        if (this.modelInfo?.provider === 'gemini') {
            this.theirCompletionBuffer += text;
        } else {
            this.theirCompletionBuffer += (this.theirCompletionBuffer ? ' ' : '') + text;
        }

        if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
        this.theirCompletionTimer = setTimeout(() => this.flushTheirCompletion(), COMPLETION_DEBOUNCE_MS);
    }

    async initializeSttSessions(language = 'en') {
        this.currentLanguage = language || 'en';
        this.themFilter = this._isThemFilterEnabled() ? new SpeechBandFilter() : null;
        console.log(`[SttService] "Them" audio filter: ${this.themFilter ? 'on (250–3800 Hz band-pass + limiter)' : 'off'}`);
        const effectiveLanguage = process.env.OPENAI_TRANSCRIBE_LANG || language || 'en';

        const modelInfo = await modelStateService.getCurrentModelInfo('stt');
        if (!modelInfo || !modelInfo.apiKey) {
            throw new Error('AI model or API key is not configured.');
        }
        this.modelInfo = modelInfo;
        console.log(`[SttService] Initializing STT for ${modelInfo.provider} using model ${modelInfo.model}`);

        const handleMyMessage = message => {
            if (!this.modelInfo) {
                console.log('[SttService] Ignoring message - session already closed');
                return;
            }
            // console.log('[SttService] handleMyMessage', message);
            
            if (this.modelInfo.provider === 'whisper') {
                // Whisper STT emits 'transcription' events with different structure
                if (message.text && message.text.trim()) {
                    const finalText = message.text.trim();
                    
                    // Filter out Whisper noise transcriptions
                    const noisePatterns = [
                        '[BLANK_AUDIO]',
                        '[INAUDIBLE]',
                        '[MUSIC]',
                        '[SOUND]',
                        '[NOISE]',
                        '(BLANK_AUDIO)',
                        '(INAUDIBLE)',
                        '(MUSIC)',
                        '(SOUND)',
                        '(NOISE)'
                    ];
                    
                    const isNoise = noisePatterns.some(pattern => 
                        finalText.includes(pattern) || finalText === pattern
                    );
                    
                    
                    if (!isNoise && finalText.length > 2) {
                        this.debounceMyCompletion(finalText);
                        
                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: finalText,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                    } else {
                        console.log(`[Whisper-Me] Filtered noise: "${finalText}"`);
                    }
                }
                return;
            } else if (this.modelInfo.provider === 'gemini') {
                if (!message.serverContent?.modelTurn) {
                    console.log('[Gemini STT - Me]', JSON.stringify(message, null, 2));
                }

                if (message.serverContent?.turnComplete) {
                    if (this.myCompletionTimer) {
                        clearTimeout(this.myCompletionTimer);
                        this.flushMyCompletion();
                    }
                    return;
                }
            
                const transcription = message.serverContent?.inputTranscription;
                if (!transcription || !transcription.text) return;
                
                const textChunk = transcription.text;
                if (!textChunk.trim() || textChunk.trim() === '<noise>') {
                    return; // 1. Ignore whitespace-only chunks or noise
                }
            
                this.debounceMyCompletion(textChunk);
                
                this.sendToRenderer('stt-update', {
                    speaker: 'Me',
                    text: this.myCompletionBuffer,
                    isPartial: true,
                    isFinal: false,
                    timestamp: Date.now(),
                });
                
            // Deepgram 
            } else if (this.modelInfo.provider === 'deepgram') {
                const text = message.channel?.alternatives?.[0]?.transcript;
                if (!text || text.trim().length === 0) return;

                const isFinal = message.is_final;
                console.log(`[SttService-Me-Deepgram] Received: isFinal=${isFinal}, text="${text}"`);

                if (isFinal) {
                    // 최종 결과가 도착하면, 현재 진행중인 부분 발화는 비우고
                    // 최종 텍스트로 debounce를 실행합니다.
                    this.myCurrentUtterance = ''; 
                    this.debounceMyCompletion(text); 
                } else {
                    // 부분 결과(interim)인 경우, 화면에 실시간으로 업데이트합니다.
                    if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
                    this.myCompletionTimer = null;

                    this.myCurrentUtterance = text;
                    
                    const continuousText = (this.myCompletionBuffer + ' ' + this.myCurrentUtterance).trim();

                    this.sendToRenderer('stt-update', {
                        speaker: 'Me',
                        text: continuousText,
                        isPartial: true,
                        isFinal: false,
                        timestamp: Date.now(),
                    });
                }
                
            } else {
                const type = message.type;
                const text = message.transcript || message.delta || (message.alternatives && message.alternatives[0]?.transcript) || '';
                this._noteRealtimeEvent('Me', message);

                if (type === 'conversation.item.input_audio_transcription.delta') {
                    if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
                    this.myCompletionTimer = null;
                    this.myCurrentUtterance += text;
                    const continuousText = this.myCompletionBuffer + (this.myCompletionBuffer ? ' ' : '') + this.myCurrentUtterance;
                    if (text && !text.includes('vq_lbr_audio_')) {
                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: continuousText,
                            isPartial: true,
                            isFinal: false,
                            timestamp: Date.now(),
                        });
                    }
                } else if (type === 'conversation.item.input_audio_transcription.completed') {
                    if (text && text.trim()) {
                        const finalUtteranceText = text.trim();
                        this.myCurrentUtterance = '';
                        this.debounceMyCompletion(finalUtteranceText);
                    }
                }
            }

            if (message.error) {
                console.error('[Me] STT Session Error:', message.error);
            }
        };

        const handleTheirMessage = message => {
            if (!message || typeof message !== 'object') return;

            if (!this.modelInfo) {
                console.log('[SttService] Ignoring message - session already closed');
                return;
            }
            
            if (this.modelInfo.provider === 'whisper') {
                // Whisper STT emits 'transcription' events with different structure
                if (message.text && message.text.trim()) {
                    const finalText = message.text.trim();
                    
                    // Filter out Whisper noise transcriptions
                    const noisePatterns = [
                        '[BLANK_AUDIO]',
                        '[INAUDIBLE]',
                        '[MUSIC]',
                        '[SOUND]',
                        '[NOISE]',
                        '(BLANK_AUDIO)',
                        '(INAUDIBLE)',
                        '(MUSIC)',
                        '(SOUND)',
                        '(NOISE)'
                    ];
                    
                    const isNoise = noisePatterns.some(pattern => 
                        finalText.includes(pattern) || finalText === pattern
                    );
                    
                    
                    // Only process if it's not noise, not a false positive, and has meaningful content
                    if (!isNoise && finalText.length > 2) {
                        this.debounceTheirCompletion(finalText);
                        
                        this.sendToRenderer('stt-update', {
                            speaker: 'Them',
                            text: finalText,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                    } else {
                        console.log(`[Whisper-Them] Filtered noise: "${finalText}"`);
                    }
                }
                return;
            } else if (this.modelInfo.provider === 'gemini') {
                if (!message.serverContent?.modelTurn) {
                    console.log('[Gemini STT - Them]', JSON.stringify(message, null, 2));
                }

                if (message.serverContent?.turnComplete) {
                    if (this.theirCompletionTimer) {
                        clearTimeout(this.theirCompletionTimer);
                        this.flushTheirCompletion();
                    }
                    return;
                }
            
                const transcription = message.serverContent?.inputTranscription;
                if (!transcription || !transcription.text) return;

                const textChunk = transcription.text;
                if (!textChunk.trim() || textChunk.trim() === '<noise>') {
                    return; // 1. Ignore whitespace-only chunks or noise
                }

                this.debounceTheirCompletion(textChunk);
                
                this.sendToRenderer('stt-update', {
                    speaker: 'Them',
                    text: this.theirCompletionBuffer,
                    isPartial: true,
                    isFinal: false,
                    timestamp: Date.now(),
                });

            // Deepgram
            } else if (this.modelInfo.provider === 'deepgram') {
                const text = message.channel?.alternatives?.[0]?.transcript;
                if (!text || text.trim().length === 0) return;

                const isFinal = message.is_final;

                if (isFinal) {
                    this.theirCurrentUtterance = ''; 
                    this.debounceTheirCompletion(text); 
                } else {
                    if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
                    this.theirCompletionTimer = null;

                    this.theirCurrentUtterance = text;
                    
                    const continuousText = (this.theirCompletionBuffer + ' ' + this.theirCurrentUtterance).trim();

                    this.sendToRenderer('stt-update', {
                        speaker: 'Them',
                        text: continuousText,
                        isPartial: true,
                        isFinal: false,
                        timestamp: Date.now(),
                    });
                }

            } else {
                const type = message.type;
                const text = message.transcript || message.delta || (message.alternatives && message.alternatives[0]?.transcript) || '';
                this._noteRealtimeEvent('Them', message);
                if (type === 'conversation.item.input_audio_transcription.delta') {
                    if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
                    this.theirCompletionTimer = null;
                    this.theirCurrentUtterance += text;
                    const continuousText = this.theirCompletionBuffer + (this.theirCompletionBuffer ? ' ' : '') + this.theirCurrentUtterance;
                    if (text && !text.includes('vq_lbr_audio_')) {
                        this.sendToRenderer('stt-update', {
                            speaker: 'Them',
                            text: continuousText,
                            isPartial: true,
                            isFinal: false,
                            timestamp: Date.now(),
                        });
                    }
                } else if (type === 'conversation.item.input_audio_transcription.completed') {
                    if (text && text.trim()) {
                        const finalUtteranceText = text.trim();
                        this.theirCurrentUtterance = '';
                        this.debounceTheirCompletion(finalUtteranceText);
                    }
                }
            }
            
            if (message.error) {
                console.error('[Them] STT Session Error:', message.error);
            }
        };

        const mySttConfig = {
            language: effectiveLanguage,
            callbacks: {
                onmessage: handleMyMessage,
                onerror: error => console.error('My STT session error:', error.message),
                onclose: event => console.log('My STT session closed:', event.reason),
            },
        };
        
        const theirSttConfig = {
            language: effectiveLanguage,
            callbacks: {
                onmessage: handleTheirMessage,
                onerror: error => console.error('Their STT session error:', error.message),
                onclose: event => console.log('Their STT session closed:', event.reason),
            },
        };
        
        const sttOptions = {
            apiKey: this.modelInfo.apiKey,
            model: this.modelInfo.model,
            language: effectiveLanguage,
        };

        // Add sessionType for Whisper to distinguish between My and Their sessions
        const myOptions = { ...sttOptions, callbacks: mySttConfig.callbacks, sessionType: 'my' };
        const theirOptions = { ...sttOptions, callbacks: theirSttConfig.callbacks, sessionType: 'their' };

        [this.mySttSession, this.theirSttSession] = await Promise.all([
            createSTT(this.modelInfo.provider, myOptions),
            createSTT(this.modelInfo.provider, theirOptions),
        ]);

        console.log('✅ Both STT sessions initialized successfully.');

        // ── Setup keep-alive heart-beats ────────────────────────────────────────
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = setInterval(() => {
            this._sendKeepAlive();
        }, KEEP_ALIVE_INTERVAL_MS);

        // ── Schedule session auto-renewal ───────────────────────────────────────
        if (this.sessionRenewTimeout) clearTimeout(this.sessionRenewTimeout);
        this.sessionRenewTimeout = setTimeout(async () => {
            try {
                console.log('[SttService] Auto-renewing STT sessions…');
                await this.renewSessions(language);
            } catch (err) {
                console.error('[SttService] Failed to renew STT sessions:', err);
            }
        }, SESSION_RENEW_INTERVAL_MS);

        return true;
    }

    /**
     * Send a lightweight keep-alive to prevent idle disconnects.
     * Currently only implemented for OpenAI provider because Gemini's SDK
     * already performs its own heart-beats.
     */
    _sendKeepAlive() {
        if (!this.isSessionActive()) return;

        if (this.modelInfo?.provider === 'openai') {
            try {
                this.mySttSession?.keepAlive?.();
                this.theirSttSession?.keepAlive?.();
            } catch (err) {
                console.error('[SttService] keepAlive error:', err.message);
            }
        }
    }

    /**
     * Gracefully tears down then recreates the STT sessions. Should be invoked
     * on a timer to avoid provider-side hard timeouts.
     */
    async renewSessions(language = 'en') {
        if (!this.isSessionActive()) {
            console.warn('[SttService] renewSessions called but no active session.');
            return;
        }

        const oldMySession = this.mySttSession;
        const oldTheirSession = this.theirSttSession;

        console.log('[SttService] Spawning fresh STT sessions in the background…');

        // We reuse initializeSttSessions to create fresh sessions with the same
        // language and handlers. The method will update the session pointers
        // and timers, but crucially it does NOT touch the system audio capture
        // pipeline, so audio continues flowing uninterrupted.
        await this.initializeSttSessions(language);

        // Close the old sessions after a short overlap window.
        setTimeout(() => {
            try {
                oldMySession?.close?.();
                oldTheirSession?.close?.();
                console.log('[SttService] Old STT sessions closed after hand-off.');
            } catch (err) {
                console.error('[SttService] Error closing old STT sessions:', err.message);
            }
        }, SOCKET_OVERLAP_MS);
    }

    /**
     * Logs OpenAI Realtime housekeeping events that would otherwise be silent
     * (VAD start/stop, commits, failed transcriptions) and records "Them" activity
     * for the stall watchdog.
     */
    _noteRealtimeEvent(speaker, message) {
        const type = message?.type || '';
        if (speaker === 'Them') {
            const now = Date.now();
            if (type === 'conversation.item.input_audio_transcription.delta' || type === 'conversation.item.input_audio_transcription.completed') {
                this.lastTheirSttEventAt = now;
            } else if (type === 'input_audio_buffer.speech_started') {
                this.lastTheirVadAt = now; this.theirSpeechStartedAt = now;
            } else if (type === 'input_audio_buffer.speech_stopped' || type === 'input_audio_buffer.committed') {
                this.lastTheirVadAt = now; this.theirSpeechStoppedAt = now;
            }
        }
        if (type === 'conversation.item.input_audio_transcription.failed') {
            console.error(`[${speaker}] STT transcription failed:`, JSON.stringify(message.error || message));
            this._recoverSttSessions(`${speaker} transcription failed`);
        } else if (type === 'input_audio_buffer.speech_started' || type === 'input_audio_buffer.speech_stopped') {
            console.log(`[${speaker}] STT ${type.replace('input_audio_buffer.', '')}`);
        } else if (type === 'session.updated') {
            console.log(`[${speaker}] STT session configured (${message.session?.audio?.input?.transcription?.model || 'model n/a'})`);
        }
    }

    _isThemFilterEnabled() {
        try {
            return require('../../settings/repositories').getFilterThemAudio();
        } catch (error) {
            console.error('[SttService] Could not read filter setting, defaulting to on:', error.message);
            return true;
        }
    }

    /** Applies the speech band-pass + limiter to a "Them" PCM chunk (raw is what gets recorded). */
    _cleanThemAudio(pcm16) {
        return this.themFilter ? this.themFilter.process(pcm16) : pcm16;
    }

    /** Recreates both STT sessions (rate-limited). Some in-flight speech may be lost. */
    async _recoverSttSessions(reason) {
        const now = Date.now();
        if (now - this.lastSttStallRecoveryAt < STT_STALL_MIN_INTERVAL_MS) return false;
        if (!this.isSessionActive()) return false;
        this.lastSttStallRecoveryAt = now;
        console.warn(`[SttService] Recreating STT sessions: ${reason}`);
        this.onStatusUpdate?.('Restarting speech recognition…');
        try {
            await this.renewSessions(this.currentLanguage);
            this.lastTheirSttEventAt = Date.now();
            this.theirSpeechStartedAt = 0; this.theirSpeechStoppedAt = 0;
            return true;
        } catch (err) {
            console.error('[SttService] STT recovery failed:', err.message);
            return false;
        }
    }

    _noteThemActivity(pcm16Buffer) {
        if (this._computeRms(pcm16Buffer) > AUDIO_SPEECH_RMS) {
            this.themActiveUntil = Date.now() + MIC_GATE_HANGOVER_MS;
        }
    }

    /**
     * Drops transcripts that are speaker echo (a "Me" line repeating what "Them" just
     * said) or known transcription junk. Returns the cleaned text or '' to drop.
     */
    _filterTranscript(speaker, text) {
        let cleaned = String(text || '')
            .replace(/context:\s*#+[\s#]*/gi, ' ')   // prompt-like hallucination seen on echo/noise
            .replace(/#{2,}/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!cleaned) return '';
        const letters = (cleaned.match(/\p{L}/gu) || []).length;
        if (letters < 2) return '';
        if ((this.currentLanguage || 'en').startsWith('en') && !/[A-Za-z]/.test(cleaned)) {
            console.log(`[SttService] Dropped non-English junk from ${speaker}: "${cleaned}"`);
            return '';
        }

        const now = Date.now();
        if (speaker === 'Them') {
            this.recentTheirTexts.push({ text: cleaned, at: now });
            this.recentTheirTexts = this.recentTheirTexts.filter(t => now - t.at < ECHO_WINDOW_MS * 2).slice(-8);
            return cleaned;
        }

        // "Me": compare against recent "Them" lines
        const tokens = (t) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 2));
        const mine = tokens(cleaned);
        if (mine.size >= 3) {
            for (const recent of this.recentTheirTexts) {
                if (now - recent.at > ECHO_WINDOW_MS) continue;
                const theirs = tokens(recent.text);
                let hit = 0;
                for (const w of mine) if (theirs.has(w)) hit++;
                if (hit / mine.size >= ECHO_OVERLAP_RATIO) {
                    this.droppedEchoes++;
                    console.log(`[SttService] Dropped speaker echo from Me (${Math.round(hit / mine.size * 100)}% overlap): "${cleaned}"`);
                    return '';
                }
            }
        }
        return cleaned;
    }

    _computeRms(pcm16Buffer) {
        const samples = pcm16Buffer.length >> 1;
        if (samples === 0) return 0;
        let sum = 0;
        for (let i = 0; i < samples; i++) {
            const v = pcm16Buffer.readInt16LE(i * 2) / 32768;
            sum += v * v;
        }
        return Math.sqrt(sum / samples);
    }

    _startAudioHealthMonitor(language) {
        this._stopAudioHealthMonitor();
        this.audioHealth = { startedAt: Date.now(), lastDataAt: Date.now(), chunks: 0, rmsSum: 0, peak: 0, restarts: this.audioHealth?.restarts || 0, loudSince: 0 };
        let lastReportAt = Date.now();

        this.audioHealthInterval = setInterval(async () => {
            const h = this.audioHealth;
            if (!h || !this.theirSttSession) return;
            const now = Date.now();

            // 1) Capture stall: SystemAudioDump stopped delivering samples (typical after an
            //    output-device switch, e.g. headphones connected). Restart the helper process.
            if (this.systemAudioProc && now - h.lastDataAt > AUDIO_STALL_MS) {
                if (h.restarts >= AUDIO_STALL_MAX_RESTARTS) {
                    console.error(`[SystemAudio] No audio data for ${Math.round((now - h.lastDataAt) / 1000)}s and restart limit reached. Stop and start Listen to recover.`);
                    this.onStatusUpdate?.('System audio capture stopped — restart Listen');
                    return;
                }
                console.warn(`[SystemAudio] No audio data for ${Math.round((now - h.lastDataAt) / 1000)}s, restarting SystemAudioDump (attempt ${h.restarts + 1}/${AUDIO_STALL_MAX_RESTARTS})…`);
                h.restarts += 1;
                h.lastDataAt = now;
                try {
                    this.stopMacOSAudioCapture({ keepMonitor: true });
                    await this.startMacOSAudioCapture({ keepMonitor: true });
                } catch (err) {
                    console.error('[SystemAudio] Restart failed:', err.message);
                }
                return;
            }

            // 2) STT stall detection, based on the provider's own VAD signals so that a long
            //    sentence in progress is never mistaken for a failure:
            //    a) speech ended but no transcript followed within STT_AFTER_STOP_MS;
            //    b) speech "started" and never stopped for STT_STUCK_SPEECH_MS (stuck VAD);
            //    c) sound present for STT_DEAD_MS with no VAD events at all (dead session).
            const stopped = this.theirSpeechStoppedAt, started = this.theirSpeechStartedAt;
            let stallReason = null;
            if (stopped && stopped >= started && now - stopped > STT_AFTER_STOP_MS && this.lastTheirSttEventAt < stopped) {
                stallReason = `speech ended ${Math.round((now - stopped) / 1000)}s ago without a transcript`;
            } else if (started && started > stopped && now - started > STT_STUCK_SPEECH_MS) {
                stallReason = `speech_started ${Math.round((now - started) / 1000)}s ago and never stopped`;
            } else if (h.loudSince && now - h.loudSince > STT_DEAD_MS && this.lastTheirVadAt < h.loudSince && this.lastTheirSttEventAt < h.loudSince) {
                stallReason = `sound for ${Math.round((now - h.loudSince) / 1000)}s but no VAD or transcript events`;
            }
            if (stallReason) {
                if (await this._recoverSttSessions(stallReason)) {
                    h.loudSince = now;
                    this.theirSpeechStartedAt = 0; this.theirSpeechStoppedAt = 0;
                }
                return;
            }

            // 3) Periodic summary so a silent failure is visible in the log.
            if (now - lastReportAt >= AUDIO_STATS_INTERVAL_MS) {
                const avg = h.chunks ? (h.rmsSum / h.chunks) : 0;
                const sinceEvent = this.lastTheirSttEventAt ? `${Math.round((now - this.lastTheirSttEventAt) / 1000)}s ago` : 'never';
                const limited = this.themFilter ? ` limiter=${(this.themFilter.takeLimiterRatio() * 100).toFixed(1)}%` : '';
                const gate = ` micGated=${this.gatedMicChunks} echoesDropped=${this.droppedEchoes}`; this.gatedMicChunks = 0; this.droppedEchoes = 0;
                console.log(`[SystemAudio] last ${Math.round((now - lastReportAt) / 1000)}s: chunks=${h.chunks} avgRMS=${avg.toFixed(4)} peak=${h.peak.toFixed(3)}${limited}${gate} | last "Them" STT event: ${sinceEvent}`);
                h.chunks = 0; h.rmsSum = 0; h.peak = 0;
                lastReportAt = now;
            }
        }, 1000);
    }

    _stopAudioHealthMonitor() {
        if (this.audioHealthInterval) {
            clearInterval(this.audioHealthInterval);
            this.audioHealthInterval = null;
        }
        this.audioHealth = null;
    }

    async sendMicAudioContent(data, mimeType) {
        // const provider = await this.getAiProvider();
        // const isGemini = provider === 'gemini';
        
        if (!this.mySttSession) {
            throw new Error('User STT session not active');
        }

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        if (recordingService.isActive() && typeof data === 'string') {
            recordingService.writeMe(Buffer.from(data, 'base64'));
        }

        // Half-duplex gate: while the other side is producing sound, the mic mostly
        // carries their voice from the speakers (echo). Drop it instead of transcribing.
        if (MIC_GATE_WHILE_THEM_SPEAKS && Date.now() < this.themActiveUntil) {
            this.gatedMicChunks++;
            return;
        }

        let payload;
        if (modelInfo.provider === 'gemini') {
            payload = { audio: { data, mimeType: mimeType || 'audio/pcm;rate=24000' } };
        } else if (modelInfo.provider === 'deepgram') {
            payload = Buffer.from(data, 'base64'); 
        } else {
            payload = data;
        }
        await this.mySttSession.sendRealtimeInput(payload);
    }

    async sendSystemAudioContent(data, mimeType) {
        if (!this.theirSttSession) {
            throw new Error('Their STT session not active');
        }

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        if (typeof data === 'string') {
            const raw = Buffer.from(data, 'base64');
            if (recordingService.isActive()) recordingService.writeThem(raw);
            this._noteThemActivity(raw);
            if (this.themFilter) data = this._cleanThemAudio(raw).toString('base64');
        }

        let payload;
        if (modelInfo.provider === 'gemini') {
            payload = { audio: { data, mimeType: mimeType || 'audio/pcm;rate=24000' } };
        } else if (modelInfo.provider === 'deepgram') {
            payload = Buffer.from(data, 'base64');
        } else {
            payload = data;
        }

        await this.theirSttSession.sendRealtimeInput(payload);
    }

    killExistingSystemAudioDump() {
        return new Promise(resolve => {
            console.log('Checking for existing SystemAudioDump processes...');

            const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
                stdio: 'ignore',
            });

            killProc.on('close', code => {
                if (code === 0) {
                    console.log('Killed existing SystemAudioDump processes');
                } else {
                    console.log('No existing SystemAudioDump processes found');
                }
                resolve();
            });

            killProc.on('error', err => {
                console.log('Error checking for existing processes (this is normal):', err.message);
                resolve();
            });

            setTimeout(() => {
                killProc.kill();
                resolve();
            }, 2000);
        });
    }

    async startMacOSAudioCapture({ keepMonitor = false } = {}) {
        if (process.platform !== 'darwin' || !this.theirSttSession) return false;

        await this.killExistingSystemAudioDump();
        console.log('Starting macOS audio capture for "Them"...');

        const { app } = require('electron');
        const path = require('path');
        const systemAudioPath = app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'ui', 'assets', 'SystemAudioDump')
            : path.join(app.getAppPath(), 'src', 'ui', 'assets', 'SystemAudioDump');

        console.log('SystemAudioDump path:', systemAudioPath);

        this.systemAudioProc = spawn(systemAudioPath, [], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        if (!this.systemAudioProc.pid) {
            console.error('Failed to start SystemAudioDump');
            return false;
        }

        console.log('SystemAudioDump started with PID:', this.systemAudioProc.pid);

        const CHUNK_DURATION = 0.1;
        const SAMPLE_RATE = 24000;
        const BYTES_PER_SAMPLE = 2;
        const CHANNELS = 2;
        const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

        let audioBuffer = Buffer.alloc(0);

        // const provider = await this.getAiProvider();
        // const isGemini = provider === 'gemini';

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        this.systemAudioProc.stdout.on('data', async data => {
            audioBuffer = Buffer.concat([audioBuffer, data]);

            while (audioBuffer.length >= CHUNK_SIZE) {
                const chunk = audioBuffer.slice(0, CHUNK_SIZE);
                audioBuffer = audioBuffer.slice(CHUNK_SIZE);

                const monoChunk = CHANNELS === 2 ? this.convertStereoToMono(chunk) : chunk;
                if (recordingService.isActive()) recordingService.writeThem(monoChunk);
                const base64Data = this._cleanThemAudio(monoChunk).toString('base64');

                const h = this.audioHealth;
                if (h) {
                    const rms = this._computeRms(monoChunk);
                    if (rms > AUDIO_SPEECH_RMS) this.themActiveUntil = Date.now() + MIC_GATE_HANGOVER_MS;
                    h.lastDataAt = Date.now();
                    h.chunks += 1;
                    h.rmsSum += rms;
                    if (rms > h.peak) h.peak = rms;
                    if (rms > AUDIO_SPEECH_RMS) {
                        if (!h.loudSince) h.loudSince = Date.now();
                        h.quietChunks = 0;
                    } else {
                        // ~3s of quiet (30 x 100ms chunks) ends the "sound present" window
                        h.quietChunks = (h.quietChunks || 0) + 1;
                        if (h.quietChunks > 30) h.loudSince = 0;
                    }
                }

                this.sendToRenderer('system-audio-data', { data: base64Data });

                if (this.theirSttSession) {
                    try {
                        let payload;
                        if (modelInfo.provider === 'gemini') {
                            payload = { audio: { data: base64Data, mimeType: 'audio/pcm;rate=24000' } };
                        } else if (modelInfo.provider === 'deepgram') {
                            payload = Buffer.from(base64Data, 'base64');
                        } else {
                            payload = base64Data;
                        }

                        await this.theirSttSession.sendRealtimeInput(payload);
                    } catch (err) {
                        console.error('Error sending system audio:', err.message);
                    }
                }
            }
        });

        this.systemAudioProc.stderr.on('data', data => {
            console.error('SystemAudioDump stderr:', data.toString());
        });

        this.systemAudioProc.on('close', code => {
            console.log('SystemAudioDump process closed with code:', code);
            this.systemAudioProc = null;
        });

        this.systemAudioProc.on('error', err => {
            console.error('SystemAudioDump process error:', err);
            this.systemAudioProc = null;
        });

        if (!keepMonitor) {
            this._startAudioHealthMonitor(this.currentLanguage);
        } else if (this.audioHealth) {
            this.audioHealth.lastDataAt = Date.now();
        }

        return true;
    }

    convertStereoToMono(stereoBuffer) {
        const samples = stereoBuffer.length / 4;
        const monoBuffer = Buffer.alloc(samples * 2);

        for (let i = 0; i < samples; i++) {
            const leftSample = stereoBuffer.readInt16LE(i * 4);
            monoBuffer.writeInt16LE(leftSample, i * 2);
        }

        return monoBuffer;
    }

    stopMacOSAudioCapture({ keepMonitor = false } = {}) {
        if (!keepMonitor) this._stopAudioHealthMonitor();
        if (this.systemAudioProc) {
            console.log('Stopping SystemAudioDump...');
            this.systemAudioProc.kill('SIGTERM');
            this.systemAudioProc = null;
        }
    }

    isSessionActive() {
        return !!this.mySttSession && !!this.theirSttSession;
    }

    async closeSessions() {
        this.stopMacOSAudioCapture();

        // Clear heartbeat / renewal timers
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        if (this.sessionRenewTimeout) {
            clearTimeout(this.sessionRenewTimeout);
            this.sessionRenewTimeout = null;
        }

        // Clear timers
        if (this.myCompletionTimer) {
            clearTimeout(this.myCompletionTimer);
            this.myCompletionTimer = null;
        }
        if (this.theirCompletionTimer) {
            clearTimeout(this.theirCompletionTimer);
            this.theirCompletionTimer = null;
        }

        const closePromises = [];
        if (this.mySttSession) {
            closePromises.push(this.mySttSession.close());
            this.mySttSession = null;
        }
        if (this.theirSttSession) {
            closePromises.push(this.theirSttSession.close());
            this.theirSttSession = null;
        }

        await Promise.all(closePromises);
        console.log('All STT sessions closed.');

        // Reset state
        this.lastTheirSttEventAt = 0;
        this.lastTheirVadAt = 0; this.theirSpeechStartedAt = 0; this.theirSpeechStoppedAt = 0;
        this.themActiveUntil = 0; this.recentTheirTexts = [];
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
        this.modelInfo = null; 
    }
}

module.exports = SttService; 