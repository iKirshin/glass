const express = require('express');
const router = express.Router();
const { ipcRequest } = require('../ipcBridge');

// Read-only view of the AI configuration (keys are reported as booleans only).
router.get('/', async (req, res) => {
    try {
        res.json(await ipcRequest(req, 'get-model-settings'));
    } catch (error) {
        console.error('Failed to get model settings via IPC:', error);
        res.status(500).json({ error: 'Failed to get model settings' });
    }
});

module.exports = router;
