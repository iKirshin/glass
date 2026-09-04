// authService.js
// Local-only auth: InPro has no cloud accounts. There is always exactly one local
// user ('default_user'); the interface is kept so callers do not need to change.
const { BrowserWindow } = require('electron');
const encryptionService = require('./encryptionService');
const sessionRepository = require('../repositories/session');

const LOCAL_USER_ID = 'default_user';

class AuthService {
    constructor() {
        this.currentUserId = LOCAL_USER_ID;
        this.currentUserMode = 'local';
        this.currentUser = null;
        this.isInitialized = false;
        this.initializationPromise = null;

        sessionRepository.setAuthService(this);
    }

    initialize() {
        if (this.isInitialized) return this.initializationPromise;

        this.initializationPromise = (async () => {
            // Clean up zombie sessions from a previous run.
            try {
                await sessionRepository.endAllActiveSessions();
            } catch (error) {
                console.error('[AuthService] Failed to end stale sessions:', error);
            }
            encryptionService.resetSessionKey();
            this.isInitialized = true;
            console.log('[AuthService] Initialized in local mode.');
            this.broadcastUserState();
        })();

        return this.initializationPromise;
    }

    /** Kept for API compatibility: cloud login no longer exists. */
    async startFirebaseAuthFlow() {
        console.warn('[AuthService] Cloud login requested but InPro runs in local mode.');
        return { success: false, error: 'Cloud login is disabled: InPro runs fully locally with your own API keys.' };
    }

    async signOut() {
        // Nothing to sign out of in local mode.
        return { success: true };
    }

    broadcastUserState() {
        const userState = this.getCurrentUser();
        BrowserWindow.getAllWindows().forEach(win => {
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                win.webContents.send('user-state-changed', userState);
            }
        });
    }

    getCurrentUserId() {
        return this.currentUserId;
    }

    getCurrentUser() {
        return {
            uid: this.currentUserId,
            email: null,
            displayName: 'Local User',
            mode: 'local',
            isLoggedIn: false,
        };
    }
}

module.exports = new AuthService();
